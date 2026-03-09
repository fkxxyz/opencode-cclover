import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import EventEmitter from "eventemitter3"
import * as lockfile from "proper-lockfile"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { StateManager } from "../state/StateManager"
import type { BossManager } from "./BossManager"
import type { Message, MessageDirection, Event } from "../types"
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
}

/**
 * 消息客户端
 * 员工通过客户端收发消息
 */
export class MessageClient {
  constructor(
    private employeeName: string,
    private service: MessageService
  ) {}

  /**
   * 接收消息（阻塞）
   * 如果有未读消息，立即返回第一条
   * 如果没有未读消息，等待新消息到达
   */
  async recv(): Promise<Message> {
    // 1. 检查未读队列
    const queue = this.service.getUnreadQueue(this.employeeName)

    if (queue.length > 0) {
      // 2. 如果有未读消息,立即返回第一条
      return queue.shift()!
    }

    // 3. 如果没有未读消息,返回 Promise 并等待
    return new Promise((resolve) => {
      const listener = () => {
        this.service.eventEmitter.off(`message:${this.employeeName}`, listener)
        // 从队列中获取消息(事件只是通知)
        const queue = this.service.getUnreadQueue(this.employeeName)
        const message = queue.shift()
        // 防御性检查：如果队列为空（竞态条件），递归调用 recv() 继续等待
        if (message) {
          resolve(message)
        } else {
          resolve(this.recv())
        }
      }
      this.service.eventEmitter.on(`message:${this.employeeName}`, listener)
    })
  }

  /**
   * 发送消息
   */
  async send(
    to: string,
    content: string,
    reference_docs?: string[]
  ): Promise<void> {
    await this.service.send(this.employeeName, to, content, reference_docs)
  }

  /**
   * 查询历史消息
   * @param peer 对方名称
   * @param limit 返回消息数量（可选，返回最近的 N 条）
   */
  async history(
    peer: string,
    limit?: number,
    before?: string
  ): Promise<Message[]> {
    // 1. 读取消息文件
    const filePath = this.service.getMessageFilePath(this.employeeName, peer)

    try {
      const content = await fs.readFile(filePath, "utf-8")

      // 2. 解析 YAML
      const messages = (yaml.parse(content) as YamlMessage[]) || []

      // 3. 转换格式
      const result = messages.map((msg) => ({
        from: msg.direction === "receive" ? peer : this.employeeName,
        to: msg.direction === "receive" ? this.employeeName : peer,
        content: msg.content,
        timestamp: msg.timestamp,
        direction: msg.direction,
        ...(msg.reference_docs &&
          msg.reference_docs.length > 0 && {
            reference_docs: msg.reference_docs,
          }),
        ...(msg.fromRole && { fromRole: msg.fromRole }),
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
export class MessageService {
  private projectId: string
  private clients: Map<string, MessageClient> = new Map()
  private unreadQueues: Map<string, Message[]> = new Map()
  public eventEmitter: EventEmitter = new EventEmitter()
  constructor(
    private workspaceRoot: string,
    private stateManager?: StateManager,
    projectId?: string,
    private bossManager?: BossManager,
    private opcodeClient?: OpencodeClient
  ) {
    this.projectId = projectId || "default"
  }

  /**
   * 获取员工的消息客户端
   */
  getClient(employeeName: string): MessageClient {
    if (!this.clients.has(employeeName)) {
      this.clients.set(employeeName, new MessageClient(employeeName, this))
    }
    return this.clients.get(employeeName)!
  }

  /**
   * 发送消息
   * 同时写入双方的消息文件，并通知接收方
   */
  async send(
    from: string,
    to: string,
    content: string,
    reference_docs?: string[]
  ): Promise<void> {
    // 1. 校验：不能向自己发送
    if (from === to) {
      throw new Error(`不能向自己发送消息`)
    }

    // 2. 校验：目标必须存在（员工或 boss）
    const isEmployee = this.stateManager?.getEmployee(to) !== undefined
    const isBoss = this.bossManager?.isBoss(to) === true

    if (!isEmployee && !isBoss) {
      throw new Error(`目标 '${to}' 不存在`)
    }

    // 3. 查询发送者角色
    let fromRole: string | undefined
    if (this.bossManager?.isBoss(from)) {
      fromRole = "boss"
    } else {
      const employee = this.stateManager?.getEmployee(from)
      fromRole = employee?.role
    }

    const timestamp = new Date().toISOString()
    const message: Message = {
      from,
      to,
      content,
      timestamp,
      direction: "receive",
      ...(reference_docs && reference_docs.length > 0 && { reference_docs }),
      ...(fromRole && { fromRole }),
    }

    // 1. 写入发送方的消息文件
    await this.appendMessage(from, to, {
      timestamp,
      direction: "send",
      content,
      ...(reference_docs && reference_docs.length > 0 && { reference_docs }),
      ...(fromRole && { fromRole }),
    })

    // 2. 写入接收方的消息文件
    await this.appendMessage(to, from, {
      timestamp,
      direction: "receive",
      content,
      ...(reference_docs && reference_docs.length > 0 && { reference_docs }),
      ...(fromRole && { fromRole }),
    })

    // 3. 添加到接收方的未读队列
    this.addToUnreadQueue(to, message)

    // 4. 触发事件通知接收方
    this.notifyNewMessage(to)

    // 5. 转发消息到用户 session（如果接收方有记录的 session）
    if (this.bossManager) {
      const sessionId = await this.bossManager.getSession(to, from)
      if (sessionId && this.opcodeClient) {
        await this.forwardToSession(
          sessionId,
          from,
          to,
          content,
          reference_docs,
          fromRole
        )
      }
    }

    // 6. 发射事件到 StateManager
    this.stateManager?.addEvent({
      projectId: this.projectId,
      type: "message",
      timestamp,
      employeeName: from,
      details: {
        from,
        to,
        content,
        ...(fromRole && { fromRole }),
      },
    })
  }

  /**
   * 获取未读消息队列
   */
  getUnreadQueue(employeeName: string): Message[] {
    if (!this.unreadQueues.has(employeeName)) {
      this.unreadQueues.set(employeeName, [])
    }
    return this.unreadQueues.get(employeeName)!
  }

  /**
   * 获取消息文件路径
   */
  getMessageFilePath(owner: string, peer: string): string {
    // 检查 owner 是否是 boss
    if (this.bossManager?.isBoss(owner)) {
      return path.join(
        this.workspaceRoot,
        "bosses",
        owner,
        "messages",
        peer,
        "chat.yaml"
      )
    }
    // 原有逻辑：employee 的消息
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
  async getPeers(employeeName: string): Promise<string[]> {
    // 获取消息目录路径
    const messagesDir = this.bossManager?.isBoss(employeeName)
      ? path.join(this.workspaceRoot, "bosses", employeeName, "messages")
      : path.join(this.workspaceRoot, "employees", employeeName, "messages")

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
    owner: string,
    peer: string,
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
  private addToUnreadQueue(employeeName: string, message: Message): void {
    const queue = this.getUnreadQueue(employeeName)
    queue.push(message)
  }

  /**
   * 通知新消息
   * 事件不传递消息数据,只作为唤醒信号
   */
  private notifyNewMessage(to: string): void {
    this.eventEmitter.emit(`message:${to}`)
  }

  /**
   * 转发消息到用户的 OpenCode session
   * @param sessionId 用户的 session ID
   * @param from 发送者名称
   * @param to 用户名称
   * @param content 消息内容
   * @param reference_docs 参考文档（可选）
   * @param fromRole 发送者角色（可选）
   */
  private async forwardToSession(
    sessionId: string,
    from: string,
    to: string,
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
        employeeName: to,
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
