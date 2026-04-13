import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import EventEmitter from "eventemitter3"
import * as lockfile from "proper-lockfile"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { StateManager } from "../state/StateManager"
import type { IBossManager } from "../types/boss-manager"
import type { Message, MessageDirection, Event } from "../types"
import type { EmployeeId, BossId, TaskId } from "../types/employee"
import type {
  RecipientResolution,
  MessageRouter,
} from "../types/message-routing"
import { RoutingRules } from "../types/message-routing"
import { parseEmployeeId, isBossId } from "../types/employee"
import { buildEventMessage } from "../utils/ContextBuilder"
import { logger } from "../lib/logger"

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
    private employeeId: EmployeeId | BossId,
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
    peer: EmployeeId | BossId,
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
  private pendingUrgentInterruptions: Set<EmployeeId | BossId> = new Set()
  public eventEmitter: EventEmitter = new EventEmitter()
  constructor(
    private workspaceRoot: string,
    private stateManager?: StateManager,
    projectId?: string,
    private bossManager?: IBossManager,
    private opcodeClient?: OpencodeClient
  ) {
    this.projectId = projectId || "default"
  }

  /**
   * 解析收件人到目标 employeeId 或 BossId
   * 实现三种路由规则:
   * 1. 同任务通信 (短名称)
   * 2. 跨任务通信 (完整 employeeId)
   * 3. Boss/非任务员工 (特殊处理)
   */
  resolveRecipient(
    sender: EmployeeId | BossId,
    recipient: string
  ): RecipientResolution {
    // Special handling for Boss sender
    const senderIsBoss =
      isBossId(sender) &&
      this.bossManager &&
      this.bossManager.isBoss(RoutingRules.extractNameFromBossId(sender))
    if (senderIsBoss) {
      // Boss can only send to full employeeId or BossId
      if (!RoutingRules.isFullEmployeeId(recipient)) {
        throw new Error(
          `Boss cannot use short names. Use full employeeId format: {taskId}-{name}`
        )
      }
      // Continue to Rule 2 or Rule 3
    }

    // Rule 1: 同任务通信 (短名称) - only for non-Boss senders
    if (!RoutingRules.isFullEmployeeId(recipient)) {
      // 提取发送者的 taskId
      const { taskId: senderTaskId } = parseEmployeeId(sender)
      const targetEmployeeId = RoutingRules.buildSameTaskEmployeeId(
        senderTaskId,
        recipient
      )
      return {
        targetEmployeeId,
        isBoss: false,
        isSameTask: true,
        isCrossTask: false,
      }
    }

    // Rule 2: 跨任务通信 (完整 employeeId)
    if (!RoutingRules.isBossOrNonTask(recipient)) {
      return {
        targetEmployeeId: recipient,
        isBoss: false,
        isSameTask: false,
        isCrossTask: true,
      }
    }

    // Rule 3: Boss/非任务员工 (特殊处理)
    const name = RoutingRules.extractNameFromBossId(recipient)

    // 3.1 优先检查是否为 Boss
    if (this.bossManager?.isBoss(name)) {
      // 检查是否同时存在员工 "0-{name}"
      const employee = this.stateManager?.getEmployee(recipient)
      if (employee) {
        logger.warn(
          `[MessageService] Both Boss and employee "${recipient}" exist, routing to Boss`
        )
      }
      return {
        targetEmployeeId: recipient,
        isBoss: true,
        isSameTask: false,
        isCrossTask: false,
      }
    }

    // 3.2 查找非任务员工
    const employee = this.stateManager?.getEmployee(recipient)
    if (!employee) {
      throw new Error(`目标 '${recipient}' 不存在`)
    }

    return {
      targetEmployeeId: recipient,
      isBoss: false,
      isSameTask: false,
      isCrossTask: false,
    }
  }

  /**
   * 获取员工的消息客户端
   */
  getClient(employeeId: EmployeeId | BossId): MessageClient {
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
    from: EmployeeId | BossId,
    to: string,
    content: string,
    reference_docs?: string[],
    urgent?: boolean,
    expect_reply?: boolean
  ): Promise<void> {
    // 1. 解析收件人
    const resolution = this.resolveRecipient(from, to)
    const targetEmployeeId = resolution.targetEmployeeId

    // 2. 校验：不能向自己发送
    if (from === targetEmployeeId) {
      throw new Error(`不能向自己发送消息`)
    }

    // 3. 查询发送者角色
    let fromRole: string | undefined
    const fromIsBoss =
      isBossId(from) &&
      this.bossManager &&
      this.bossManager.isBoss(RoutingRules.extractNameFromBossId(from))
    if (fromIsBoss) {
      fromRole = "boss"
    } else {
      const employee = this.stateManager?.getEmployee(from)
      fromRole = employee?.role
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
    if (this.bossManager && resolution.isBoss) {
      const sessionId = await this.bossManager.getSession(
        targetEmployeeId,
        from
      )
      if (sessionId && this.opcodeClient) {
        await this.forwardToSession(
          sessionId,
          from,
          targetEmployeeId,
          content,
          reference_docs,
          fromRole
        )
      }
    }

    // 10. 发射事件到 StateManager
    this.stateManager?.addEvent({
      projectId: this.projectId,
      type: "message",
      timestamp,
      employeeId: from,
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
  getUnreadQueue(employeeId: EmployeeId | BossId): Message[] {
    if (!this.unreadQueues.has(employeeId)) {
      this.unreadQueues.set(employeeId, [])
    }
    return this.unreadQueues.get(employeeId)!
  }

  /**
   * 获取消息文件路径
   */
  getMessageFilePath(
    owner: EmployeeId | BossId,
    peer: EmployeeId | BossId
  ): string {
    // 检查 owner 是否是 boss (需要同时满足格式和在 boss 列表中)
    if (isBossId(owner) && this.bossManager) {
      const bossName = RoutingRules.extractNameFromBossId(owner)
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
      "employees",
      owner,
      "messages",
      peer,
      "chat.yaml"
    )
  }

  /**
   * 获取员工的所有对话对象列表
   */
  async getPeers(employeeId: EmployeeId | BossId): Promise<string[]> {
    // 获取消息目录路径
    let messagesDir: string
    if (isBossId(employeeId) && this.bossManager) {
      const bossName = RoutingRules.extractNameFromBossId(employeeId)
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
          "employees",
          employeeId,
          "messages"
        )
      }
    } else {
      messagesDir = path.join(
        this.workspaceRoot,
        "employees",
        employeeId,
        "messages"
      )
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
    owner: EmployeeId | BossId,
    peer: EmployeeId | BossId,
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
    employeeId: EmployeeId | BossId,
    message: Message
  ): void {
    const queue = this.getUnreadQueue(employeeId)
    queue.push(message)
  }

  /**
   * 添加到未读队列队首（紧急消息）
   */
  private addToUnreadQueueFront(
    employeeId: EmployeeId | BossId,
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
    to: EmployeeId | BossId
  ): Promise<void> {
    await this.abortActiveSession(to)
  }

  /**
   * 中断员工当前活跃 session
   */
  async abortActiveSession(to: EmployeeId | BossId): Promise<void> {
    // 获取接收方的活跃 session ID
    const employee = this.stateManager?.getEmployee(to)
    logger.debug(
      `[MessageService] Checking active session for ${to}: ${employee?.activeSessionId || "none"}`
    )
    if (!employee?.activeSessionId) {
      this.pendingUrgentInterruptions.add(to)
      logger.debug(
        `[MessageService] No active session for ${to}, skipping interruption`
      )
      return
    }

    // 调用 abort() 中断 session
    try {
      logger.debug(
        `[MessageService] Calling abort() for session ${employee.activeSessionId}`
      )
      await this.opcodeClient?.session.abort({
        path: { id: employee.activeSessionId },
      })
      this.pendingUrgentInterruptions.delete(to)
      logger.info(
        `[MessageService] Successfully aborted session ${employee.activeSessionId} for urgent message to ${to}`
      )
    } catch (error: any) {
      logger.error(
        `[MessageService] Failed to abort session ${employee.activeSessionId}: ${error.message}`
      )
    }
  }

  hasPendingUrgentInterruption(employeeId: EmployeeId | BossId): boolean {
    return this.pendingUrgentInterruptions.has(employeeId)
  }

  clearPendingUrgentInterruption(employeeId: EmployeeId | BossId): void {
    this.pendingUrgentInterruptions.delete(employeeId)
  }

  /**
   * 通知新消息
   * 事件不传递消息数据,只作为唤醒信号
   */
  private notifyNewMessage(to: EmployeeId | BossId): void {
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
    from: EmployeeId | BossId,
    to: EmployeeId | BossId,
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
        employeeId: to,
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
            create_agent: true,
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
        await this.bossManager.clearSession(to, from).catch(() => {
          // 忽略清除错误
        })
      }
    }
  }
}
