import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import EventEmitter from "eventemitter3"
import * as lockfile from "proper-lockfile"
import type { StateManager } from "../state/StateManager"
import type { BossManager } from "./BossManager"

/**
 * 消息对象（API 格式）
 */
export interface Message {
  from: string
  content: string
  timestamp: string
}

/**
 * YAML 文件中的消息格式
 */
interface YamlMessage {
  timestamp: string
  direction: "send" | "receive"
  content: string
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
      // 2. 如果有未读消息，立即返回第一条
      return queue.shift()!
    }

    // 3. 如果没有未读消息，返回 Promise 并等待
    return new Promise((resolve) => {
      const listener = (message: Message) => {
        this.service.eventEmitter.off(`message:${this.employeeName}`, listener)
        resolve(message)
      }
      this.service.eventEmitter.on(`message:${this.employeeName}`, listener)
    })
  }

  /**
   * 发送消息
   */
  async send(to: string, content: string): Promise<void> {
    await this.service.send(this.employeeName, to, content)
  }

  /**
   * 查询历史消息
   * @param peer 对方名称
   * @param limit 返回消息数量（可选，返回最近的 N 条）
   */
  async history(peer: string, limit?: number): Promise<Message[]> {
    // 1. 读取消息文件
    const filePath = this.service.getMessageFilePath(this.employeeName, peer)

    try {
      const content = await fs.readFile(filePath, "utf-8")

      // 2. 解析 YAML
      const messages = (yaml.parse(content) as YamlMessage[]) || []

      // 3. 转换格式
      const result = messages.map((msg) => ({
        from: msg.direction === "receive" ? peer : this.employeeName,
        content: msg.content,
        timestamp: msg.timestamp,
      }))

      // 4. 限制数量（返回最近的 N 条）
      if (limit) {
        return result.slice(-limit)
      }

      return result
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
    private bossManager?: BossManager
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
  async send(from: string, to: string, content: string): Promise<void> {
    const timestamp = new Date().toISOString()
    const message: Message = { from, content, timestamp }

    // 1. 写入发送方的消息文件
    await this.appendMessage(from, to, {
      timestamp,
      direction: "send",
      content,
    })

    // 2. 写入接收方的消息文件
    await this.appendMessage(to, from, {
      timestamp,
      direction: "receive",
      content,
    })

    // 3. 添加到接收方的未读队列
    this.addToUnreadQueue(to, message)

    // 4. 触发事件通知接收方
    this.notifyNewMessage(to, message)

    // 5. 发射事件到 StateManager
    this.stateManager?.addEvent({
      projectId: this.projectId,
      type: "message",
      timestamp,
      employeeName: from,
      details: {
        from,
        to,
        content,
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
   */
  private notifyNewMessage(to: string, message: Message): void {
    this.eventEmitter.emit(`message:${to}`, message)
  }
}
