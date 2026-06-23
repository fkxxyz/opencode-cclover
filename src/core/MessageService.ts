import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import EventEmitter from "eventemitter3"
import * as lockfile from "proper-lockfile"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { StateManager } from "../state/StateManager"
import type { IBossManager } from "../types/boss-manager"
import type { Message, MessageDirection, Event } from "../types"
import type { BossId, EmployeeWorkSessionId } from "../types/employee"
import type { EmployeeWorkSessionManager } from "./EmployeeWorkSessionManager"
import type {
  RecipientResolution,
  MessageRouter,
} from "../types/message-routing"
import { RoutingRules } from "../types/message-routing"
import { buildEventMessage } from "../utils/ContextBuilder"
import { logger } from "../lib/logger"

function asEmployeeWorkSessionId(value: string): EmployeeWorkSessionId {
  return value as EmployeeWorkSessionId
}

function asBossId(value: string): BossId {
  return value as BossId
}

/**
 * YAML 文件中的消息格式
 */
interface YamlMessage {
  timestamp: string
  direction: "send" | "receive"
  content: string
  reference_docs?: string[]
  fromRole?: string
  urgent?: boolean
  expect_reply?: boolean
}

/**
 * 消息客户端
 * 员工通过客户端收发消息
 */
export class MessageClient {
  constructor(
    private employeeId: EmployeeWorkSessionId | BossId,
    private service: MessageService
  ) {}

  /**
   * 接收消息（阻塞）
   * 如果有未读消息，立即返回第一条
   * 如果没有未读消息，等待新消息到达
   */
  async recv(): Promise<Message> {
    // 1. 检查未读队列
    const queue = this.service.getUnreadQueue(this.employeeId)

    if (queue.length > 0) {
      // 2. 如果有未读消息,立即返回第一条
      return queue.shift()!
    }

    // 3. 如果没有未读消息,返回 Promise 并等待
    return new Promise((resolve) => {
      const listener = () => {
        this.service.eventEmitter.off(`message:${this.employeeId}`, listener)
        // 从队列中获取消息(事件只是通知)
        const queue = this.service.getUnreadQueue(this.employeeId)
        const message = queue.shift()
        // 防御性检查：如果队列为空（竞态条件），递归调用 recv() 继续等待
        if (message) {
          resolve(message)
        } else {
          resolve(this.recv())
        }
      }
      this.service.eventEmitter.on(`message:${this.employeeId}`, listener)
    })
  }

  /**
   * 发送消息
   */
  async send(
    to: string,
    content: string,
    reference_docs?: string[],
    urgent?: boolean,
    expect_reply?: boolean
  ): Promise<void> {
    await this.service.send(
      this.employeeId,
      to,
      content,
      reference_docs,
      urgent,
      expect_reply
    )
  }

  /**
   * 查询历史消息
   * @param peer 对方 employeeId 或 BossId
   * @param limit 返回消息数量（可选，返回最近的 N 条）
   */
  async history(
    peer: EmployeeWorkSessionId | BossId,
    limit?: number,
    before?: string
  ): Promise<Message[]> {
    // 1. 读取消息文件
    const filePath = this.service.getMessageFilePath(this.employeeId, peer)

    try {
      const content = await fs.readFile(filePath, "utf-8")

      // 2. 解析 YAML
      const messages = (yaml.parse(content) as YamlMessage[]) || []

      // 3. 转换格式
      const result = messages.map((msg) => ({
        from: msg.direction === "receive" ? peer : this.employeeId,
        to: msg.direction === "receive" ? this.employeeId : peer,
        content: msg.content,
        timestamp: msg.timestamp,
        direction: msg.direction,
        ...(msg.reference_docs &&
          msg.reference_docs.length > 0 && {
            reference_docs: msg.reference_docs,
          }),
        ...(msg.fromRole && { fromRole: msg.fromRole }),
        ...(msg.urgent !== undefined && { urgent: msg.urgent }),
        ...(msg.expect_reply !== undefined && {
          expect_reply: msg.expect_reply,
        }),
      }))

      // 4. 如果提供了游标，过滤出游标之前的消息
      const filtered = before
        ? result.filter((msg) => msg.timestamp < before)
        : result

      // 5. 限制数量（返回最近的 N 条）
      if (limit) {
        return filtered.slice(-limit)
      }

      return filtered
    } catch (error: any) {
      // 文件不存在时返回空数组
      if (error.code === "ENOENT") {
        return []
      }
      throw error
    }
  }
}

/**
 * 消息服务
 * 负责消息的发送、接收和持久化
 */
export class MessageService implements MessageRouter {
  private projectId: string
  private clients: Map<string, MessageClient> = new Map()
  private unreadQueues: Map<string, Message[]> = new Map()
  private pendingUrgentInterruptions: Set<EmployeeWorkSessionId | BossId> =
    new Set()
  public eventEmitter: EventEmitter = new EventEmitter()
  constructor(
    private workspaceRoot: string,
    private stateManager?: StateManager,
    projectId?: string,
    private bossManager?: IBossManager,
    private opcodeClient?: OpencodeClient,
    private employeeWorkSessionManager?: EmployeeWorkSessionManager
  ) {
    this.projectId = projectId || "default"
  }

  /**
   * 解析收件人到目标 employeeId 或 BossId。
   * Phase 1 契约不再支持从 employeeId 推断 taskId。
   */
  resolveRecipient(
    sender: EmployeeWorkSessionId | BossId,
    recipient: string
  ): RecipientResolution {
    // Special handling for Boss sender
    const senderIsBoss =
      RoutingRules.isBossId(sender) &&
      this.bossManager &&
      this.bossManager.isBoss(
        RoutingRules.extractNameFromBossId(sender as BossId)
      )
    if (RoutingRules.isEmployeeWorkSessionId(recipient)) {
      return {
        targetId: asEmployeeWorkSessionId(recipient),
        targetType: "employee-work-session",
        resolvedBy: "employee_work_session_id",
      }
    }

    if (!RoutingRules.isBossId(recipient)) {
      throw new Error(
        `Unsupported message target '${recipient}'. Use employee_work_session_id or boss_id.`
      )
    }

    const name = RoutingRules.extractNameFromBossId(asBossId(recipient))
    const isConfiguredBoss = this.bossManager?.isBoss(name)
    if (isConfiguredBoss) {
      return {
        targetId: asBossId(recipient),
        targetType: "boss",
        resolvedBy: "boss_id",
      }
    }

    throw new Error(
      `Unsupported message target '${recipient}'. Use employee_work_session_id or configured boss_id.`
    )
  }

  /**
   * 获取员工的消息客户端
   */
  getClient(employeeId: EmployeeWorkSessionId | BossId): MessageClient {
    if (!this.clients.has(employeeId)) {
      this.clients.set(employeeId, new MessageClient(employeeId, this))
    }
    return this.clients.get(employeeId)!
  }

  /**
   * 发送消息
   * 同时写入双方的消息文件，并通知接收方
   */
  async send(
    from: EmployeeWorkSessionId | BossId,
    to: string,
    content: string,
    reference_docs?: string[],
    urgent?: boolean,
    expect_reply?: boolean
  ): Promise<void> {
    // 1. 解析收件人
    const resolution = this.resolveRecipient(from, to)
    const targetEmployeeId = resolution.targetId

    // 2. 校验：不能向自己发送
    if (from === targetEmployeeId) {
      throw new Error(`不能向自己发送消息`)
    }

    // 3. 查询发送者角色
    let fromRole: string | undefined
    const fromIsBoss =
      RoutingRules.isBossId(from) &&
      this.bossManager &&
      this.bossManager.isBoss(
        RoutingRules.extractNameFromBossId(from as BossId)
      )
    if (fromIsBoss) {
      fromRole = "boss"
    } else {
      const employeeWorkSession =
        await this.employeeWorkSessionManager?.getEmployeeWorkSession(
          from as EmployeeWorkSessionId
        )
      const employee = employeeWorkSession
        ? this.stateManager?.getEmployee(employeeWorkSession.employeeId)
        : undefined
      fromRole = employee?.roleId
    }

    const timestamp = new Date().toISOString()
    const message: Message = {
      from,
      to: targetEmployeeId,
      content,
      timestamp,
      direction: "receive",
      ...(reference_docs && reference_docs.length > 0 && { reference_docs }),
      ...(fromRole && { fromRole }),
      ...(urgent !== undefined && { urgent }),
      ...(expect_reply !== undefined && { expect_reply }),
    }

    // 4. 写入发送方的消息文件
    await this.appendMessage(from, targetEmployeeId, {
      timestamp,
      direction: "send",
      content,
      ...(reference_docs && reference_docs.length > 0 && { reference_docs }),
      ...(fromRole && { fromRole }),
      ...(urgent !== undefined && { urgent }),
      ...(expect_reply !== undefined && { expect_reply }),
    })

    // 5. 写入接收方的消息文件
    await this.appendMessage(targetEmployeeId, from, {
      timestamp,
      direction: "receive",
      content,
      ...(reference_docs && reference_docs.length > 0 && { reference_docs }),
      ...(fromRole && { fromRole }),
      ...(urgent !== undefined && { urgent }),
      ...(expect_reply !== undefined && { expect_reply }),
    })

    // 6. 处理紧急消息中断
    if (urgent) {
      logger.debug(
        `[MessageService] Urgent message detected, attempting to interrupt ${targetEmployeeId}`
      )
      await this.handleUrgentInterruption(targetEmployeeId)
    }

    // 7. 添加到接收方的未读队列（紧急消息插入队首）
    if (urgent) {
      this.addToUnreadQueueFront(targetEmployeeId, message)
    } else {
      this.addToUnreadQueue(targetEmployeeId, message)
    }

    // 8. 触发事件通知接收方
    this.notifyNewMessage(targetEmployeeId)

    // 9. 转发消息到用户 session（如果接收方有记录的 session）
    if (this.bossManager && resolution.targetType === "boss") {
      const bossName = RoutingRules.extractNameFromBossId(
        targetEmployeeId as BossId
      )

      logger.debug(
        `[MessageService] Looking up session for boss="${bossName}", employee="${from}"`
      )

      const sessionId = RoutingRules.isEmployeeWorkSessionId(from)
        ? await this.bossManager.getSession(
            bossName,
            from as EmployeeWorkSessionId
          )
        : undefined

      logger.debug(
        `[MessageService] Session lookup result: sessionId=${sessionId || "not found"}`
      )

      if (sessionId && this.opcodeClient) {
        logger.debug(
          `[MessageService] Forwarding message to session ${sessionId}`
        )
        await this.forwardToSession(
          sessionId,
          from,
          targetEmployeeId,
          content,
          reference_docs,
          fromRole
        )
      } else if (!sessionId) {
        logger.debug(
          `[MessageService] No session found for boss="${bossName}", employee="${from}" - message not forwarded to OpenCode UI`
        )
      }
    }

    // 10. 发射事件到 StateManager
    await this.stateManager?.addEvent({
      projectId: this.projectId,
      type: "message",
      timestamp,
      employeeWorkSessionId: RoutingRules.isEmployeeWorkSessionId(from)
        ? (from as EmployeeWorkSessionId)
        : undefined,
      details: {
        from,
        to: targetEmployeeId,
        content,
        ...(fromRole && { fromRole }),
      },
    })
  }

  /**
   * 获取未读消息队列
   */
  getUnreadQueue(employeeId: EmployeeWorkSessionId | BossId): Message[] {
    if (!this.unreadQueues.has(employeeId)) {
      this.unreadQueues.set(employeeId, [])
    }
    return this.unreadQueues.get(employeeId)!
  }

  /**
   * 获取消息文件路径
   */
  getMessageFilePath(
    owner: EmployeeWorkSessionId | BossId,
    peer: EmployeeWorkSessionId | BossId
  ): string {
    // 检查 owner 是否是 boss (需要同时满足格式和在 boss 列表中)
    if (RoutingRules.isBossId(owner) && this.bossManager) {
      const bossName = RoutingRules.extractNameFromBossId(owner as BossId)
      if (this.bossManager.isBoss(bossName)) {
        return path.join(
          this.workspaceRoot,
          "bosses",
          bossName,
          "messages",
          peer,
          "chat.yaml"
        )
      }
    }
    // employee 的消息
    return path.join(
      this.workspaceRoot,
      "ews",
      owner,
      "messages",
      peer,
      "chat.yaml"
    )
  }

  /**
   * 获取员工的所有对话对象列表
   */
  async getPeers(
    employeeId: EmployeeWorkSessionId | BossId
  ): Promise<string[]> {
    // 获取消息目录路径
    let messagesDir: string
    if (RoutingRules.isBossId(employeeId) && this.bossManager) {
      const bossName = RoutingRules.extractNameFromBossId(employeeId as BossId)
      if (this.bossManager.isBoss(bossName)) {
        messagesDir = path.join(
          this.workspaceRoot,
          "bosses",
          bossName,
          "messages"
        )
      } else {
        messagesDir = path.join(
          this.workspaceRoot,
          "ews",
          employeeId,
          "messages"
        )
      }
    } else {
      messagesDir = path.join(this.workspaceRoot, "ews", employeeId, "messages")
    }

    try {
      // 读取目录下的所有子目录（每个子目录代表一个对话对象）
      const entries = await fs.readdir(messagesDir, { withFileTypes: true })
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    } catch (error: any) {
      // 目录不存在时返回空数组
      if (error.code === "ENOENT") {
        return []
      }
      throw error
    }
  }

  /**
   * 追加消息到文件
   */
  private async appendMessage(
    owner: EmployeeWorkSessionId | BossId,
    peer: EmployeeWorkSessionId | BossId,
    message: YamlMessage
  ): Promise<void> {
    const filePath = this.getMessageFilePath(owner, peer)

    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // 确保文件存在（用于加锁）
    try {
      await fs.access(filePath)
    } catch {
      await fs.writeFile(filePath, yaml.stringify([]), "utf-8")
    }

    // 加锁写入
    let release: (() => Promise<void>) | undefined
    try {
      // 获取文件锁（5秒超时）
      release = await lockfile.lock(filePath, {
        retries: {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 1000,
        },
        stale: 5000,
      })

      // 读取现有内容
      let messages: YamlMessage[] = []
      try {
        const content = await fs.readFile(filePath, "utf-8")
        messages = yaml.parse(content) || []
      } catch (error: any) {
        // 文件为空时，messages 保持为空数组
        if (error.code !== "ENOENT") {
          throw error
        }
      }

      // 追加新消息
      messages.push(message)

      // 写入文件
      await fs.writeFile(filePath, yaml.stringify(messages), "utf-8")
    } catch (error) {
      console.error(`[MessageService] Failed to append message: ${error}`)
      throw error
    } finally {
      // 释放锁
      if (release) {
        await release()
      }
    }
  }

  /**
   * 添加到未读队列
   */
  private addToUnreadQueue(
    employeeId: EmployeeWorkSessionId | BossId,
    message: Message
  ): void {
    const queue = this.getUnreadQueue(employeeId)
    queue.push(message)
  }

  /**
   * 添加到未读队列队首（紧急消息）
   */
  private addToUnreadQueueFront(
    employeeId: EmployeeWorkSessionId | BossId,
    message: Message
  ): void {
    const queue = this.getUnreadQueue(employeeId)
    queue.unshift(message)
  }

  /**
   * 处理紧急消息中断
   * 如果接收方有活跃的 session，调用 abort() 中断
   */
  private async handleUrgentInterruption(
    to: EmployeeWorkSessionId | BossId
  ): Promise<void> {
    await this.abortActiveSession(to)
  }

  /**
   * 中断员工当前活跃 session
   */
  async abortActiveSession(to: EmployeeWorkSessionId | BossId): Promise<void> {
    // 获取接收方的活跃 session ID
    const employeeWorkSession =
      await this.employeeWorkSessionManager?.getEmployeeWorkSession(
        to as EmployeeWorkSessionId
      )
    logger.debug(
      `[MessageService] Checking active session for ${to}: ${employeeWorkSession?.opencodeSessionId || "none"}`
    )
    if (!employeeWorkSession?.opencodeSessionId) {
      this.pendingUrgentInterruptions.add(to)
      logger.debug(
        `[MessageService] No active session for ${to}, skipping interruption`
      )
      return
    }

    // 调用 abort() 中断 session
    try {
      logger.debug(
        `[MessageService] Calling abort() for session ${employeeWorkSession.opencodeSessionId}`
      )
      await this.opcodeClient?.session.abort({
        path: { id: employeeWorkSession.opencodeSessionId },
      })
      this.pendingUrgentInterruptions.delete(to)
      logger.info(
        `[MessageService] Successfully aborted session ${employeeWorkSession.opencodeSessionId} for urgent message to ${to}`
      )
    } catch (error: any) {
      logger.error(
        `[MessageService] Failed to abort session ${employeeWorkSession.opencodeSessionId}: ${error.message}`
      )
    }
  }

  hasPendingUrgentInterruption(
    employeeId: EmployeeWorkSessionId | BossId
  ): boolean {
    return this.pendingUrgentInterruptions.has(employeeId)
  }

  clearPendingUrgentInterruption(
    employeeId: EmployeeWorkSessionId | BossId
  ): void {
    this.pendingUrgentInterruptions.delete(employeeId)
  }

  /**
   * 通知新消息
   * 事件不传递消息数据,只作为唤醒信号
   */
  private notifyNewMessage(to: EmployeeWorkSessionId | BossId): void {
    this.eventEmitter.emit(`message:${to}`)
  }

  /**
   * 转发消息到用户的 OpenCode session
   * @param sessionId 用户的 session ID
   * @param from 发送者 employeeId 或 BossId
   * @param to 用户 employeeId 或 BossId
   * @param content 消息内容
   * @param reference_docs 参考文档（可选）
   * @param fromRole 发送者角色（可选）
   */
  private async forwardToSession(
    sessionId: string,
    from: EmployeeWorkSessionId | BossId,
    to: EmployeeWorkSessionId | BossId,
    content: string,
    reference_docs?: string[],
    fromRole?: string
  ): Promise<void> {
    try {
      // 构造消息事件（与员工接收的格式相同）
      const event: Event = {
        projectId: this.projectId,
        type: "message",
        timestamp: new Date().toISOString(),
        employeeWorkSessionId: RoutingRules.isEmployeeWorkSessionId(to)
          ? (to as EmployeeWorkSessionId)
          : undefined,
        details: {
          from,
          to,
          content,
          ...(reference_docs &&
            reference_docs.length > 0 && { reference_docs }),
          ...(fromRole && { fromRole }),
        },
      }

      // 使用现有工具构建事件消息
      const eventMessage = buildEventMessage(event)

      // 从 workspaceRoot 推导项目路径
      // workspaceRoot: /path/to/project/.cclover/workspace
      // projectPath: /path/to/project
      const projectPath = path.dirname(path.dirname(this.workspaceRoot))

      // 转发到用户 session
      await this.opcodeClient!.session.prompt({
        path: { id: sessionId },
        body: {
          agent: "cclover-empty-agent",
          parts: [{ type: "text", text: eventMessage }],
          tools: {
            send_message: true,
            edit_tasks: true,
          },
        },
        headers: {
          "x-opencode-directory": projectPath,
        },
      })

      logger.info(
        `[MessageService] Forwarded message from ${from} to user ${to}'s session ${sessionId}`
      )
    } catch (error: any) {
      // 记录错误但不抛出（session 可能已关闭）
      logger.warn(
        `[MessageService] Failed to forward message to user session ${sessionId}: ${error.message}`
      )

      // 清除无效的 session 映射
      if (this.bossManager) {
        await this.bossManager
          .clearSession(to, from as EmployeeWorkSessionId)
          .catch(() => {
            // 忽略清除错误
          })
      }
    }
  }
}
