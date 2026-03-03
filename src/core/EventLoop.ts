import type { OpencodeClient } from "@opencode-ai/sdk"
import type { MessageClient, Message } from "./MessageService"
import type { MemoryManager, Memory, Task } from "./MemoryManager"
import { buildSystemPrompt, buildEventMessage } from "../utils/ContextBuilder"
import { agentRegistry } from "../utils/AgentRegistry"
import { sessionRegistry } from "../utils/SessionRegistry"
import type { StateManager } from "../state/StateManager"
import { logger } from "../lib/logger"

/**
 * 角色定义
 */
export interface Role {
  name: string
  systemPrompt: string
}

/**
 * 事件类型
 */
export type Event = MessageEvent | AgentEvent | TaskAvailableEvent

export interface MessageEvent {
  type: "message"
  from: string
  content: string
  timestamp: string
}

export interface AgentEvent {
  type: "agent_completed"
  agentId: string
  taskName: string
  result: string
  timestamp: string
}

export interface TaskAvailableEvent {
  type: "task_available"
  tasks: Task[]
  timestamp: string
}

/**
 * Session 信息
 */
interface SessionInfo {
  id: string
  messageCount: number
  tokenCount: number
}

/**
 * 事件循环
 * 员工的核心运行机制，负责等待事件、处理事件、调用 AI、管理 session 生命周期
 */
export class EventLoop {
  private currentSession: SessionInfo | null = null
  private readonly TOKEN_THRESHOLD = 100000 // 10万 token
  private readonly MESSAGE_THRESHOLD = 20 // 20 轮对话
  constructor(
    private projectPath: string,
    private employeeName: string,
    private role: Role,
    private messageClient: MessageClient,
    private memoryManager: MemoryManager,
    private opcodeClient: OpencodeClient,
    private stateManager?: StateManager
  ) {}

  /**
   * 主循环
   */
  async run(): Promise<void> {
    logger.info(
      `[${this.employeeName}] Starting event loop for project ${this.projectPath} with role ${this.role.name}`
    )
    // 更新员工状态为 active
    await this.stateManager?.updateEmployeeStatus(this.employeeName, "active")

    while (true) {
      try {
        // 1. 更新状态为 idle（等待事件）
        await this.stateManager?.updateEmployeeStatus(this.employeeName, "idle")

        // 2. 等待事件
        const event = await this.waitForEvent()
        console.log(`[${this.employeeName}] Received event:`, event.type)
        if (event.type === "message") {
          console.log(
            `[${this.employeeName}] Message from ${event.from}: ${event.content}`
          )
        } else if (event.type === "agent_completed") {
          console.log(
            `[${this.employeeName}] Agent completed: ${event.taskName}, result: ${event.result}`
          )
        }

        // 3. 更新状态为 active（处理事件）
        await this.stateManager?.updateEmployeeStatus(
          this.employeeName,
          "active"
        )

        // 4. 处理事件
        await this.handleEvent(event)

        // 5. 检查是否需要总结
        await this.summarizeIfNeeded()
      } catch (error) {
        console.error(`[${this.employeeName}] Error in event loop:`, error)
        // 更新状态为 error
        await this.stateManager?.updateEmployeeStatus(
          this.employeeName,
          "error"
        )
        // 继续循环，不退出
      }
    }
  }

  /**
   * 等待事件
   * 并发等待多种事件源
   */
  private async waitForEvent(): Promise<Event> {
    return Promise.race([
      // 1. 等待新消息
      this.waitForMessage(),

      // 2. 等待 Agent 完成
      this.waitForAgentCompletion(),

      // 3. 检查可执行任务
      this.waitForTaskAvailable(),
    ])
  }

  /**
   * 等待新消息
   */
  private async waitForMessage(): Promise<MessageEvent> {
    const msg = await this.messageClient.recv()
    return {
      type: "message",
      from: msg.from,
      content: msg.content,
      timestamp: msg.timestamp,
    }
  }

  /**
   * 等待 Agent 完成
   * 订阅 OpenCode 事件流，监听 session 状态变化
   */
  private async waitForAgentCompletion(): Promise<AgentEvent> {
    // 订阅 OpenCode 事件流
    const events = await this.opcodeClient.event.subscribe()

    for await (const event of events.stream) {
      // 监听 message.updated 事件（assistant 消息完成）
      if (event.type === "message.updated") {
        const msg = (event as any).properties.info
        if (msg.role === "assistant" && msg.time.completed) {
          const sessionId = msg.sessionID

          // 检查是否是我们创建的 agent
          const agentInfo = agentRegistry.getInfo(sessionId)
          if (agentInfo && agentInfo.employeeName === this.employeeName) {
            // 获取 agent 的最后一条消息作为结果
            const result = await this.getAgentResult(sessionId)

            // 取消注册
            agentRegistry.unregister(sessionId)
            // 记录 agent 完成事件
            await this.stateManager?.addEvent({
              projectId: "",
              type: "agent_completed",
              timestamp: new Date().toISOString(),
              employeeName: this.employeeName,
              details: {
                agentId: sessionId,
                taskName: agentInfo.taskName,
                result,
              },
            })

            return {
              type: "agent_completed",
              agentId: sessionId,
              taskName: agentInfo.taskName,
              result,
              timestamp: new Date().toISOString(),
            }
          }
        }
      }
    }

    // 永远不会到达这里（for await 会一直等待）
    throw new Error("Unexpected end of event stream")
  }
  /**
   * 等待可执行任务
   * 延迟检查，避免和消息/Agent事件竞争
   */
  private async waitForTaskAvailable(): Promise<TaskAvailableEvent> {
    // 延迟 1 秒再检查，让消息和 Agent 完成事件优先触发
    await new Promise((resolve) => setTimeout(resolve, 1000))
    // 检查是否有可执行任务
    const executableTasks = await this.memoryManager.getExecutableTasks(
      this.employeeName
    )
    if (executableTasks.length > 0) {
      return {
        type: "task_available",
        tasks: executableTasks,
        timestamp: new Date().toISOString(),
      }
    }
    // 如果没有可执行任务，继续等待
    return this.waitForTaskAvailable()
  }

  /**
   * 获取 Agent 的执行结果
   */
  private async getAgentResult(sessionId: string): Promise<string> {
    try {
      // 获取 session 的消息列表
      const messages = await this.opcodeClient.session.messages({
        path: { id: sessionId },
      })

      // 找到最后一条 assistant 消息
      const assistantMessages = (messages.data ?? []).filter(
        (m) => m.info.role === "assistant"
      )

      if (assistantMessages.length === 0) {
        return "Agent 未返回任何结果"
      }

      const lastMessage = assistantMessages[assistantMessages.length - 1]

      // 提取文本内容
      const textParts = lastMessage.parts.filter((p) => p.type === "text")
      if (textParts.length === 0) {
        return "Agent 未返回文本结果"
      }

      return textParts.map((p) => (p as any).text).join("\n")
    } catch (error) {
      console.error(`[${this.employeeName}] Failed to get agent result:`, error)
      return "获取 Agent 结果失败"
    }
  }

  /**
   * 处理事件
   */
  private async handleEvent(event: Event): Promise<void> {
    console.log(`[${this.employeeName}] Received event:`, event.type)

    // 1. 确保 session 存在
    const session = await this.ensureSession()
    console.log(
      `[${this.employeeName}] Handling event in session: ${session.id}`
    )

    // 2. 读取当前记忆
    const memory = await this.memoryManager.read(this.employeeName)

    // 3. 构建事件消息
    const eventMessage = buildEventMessage(event)

    // 4. 构建系统提示词(仅在第一条消息时)
    const systemPrompt =
      session.messageCount === 0
        ? buildSystemPrompt(this.role.systemPrompt, memory)
        : undefined

    // 5. 发送给 AI
    await this.opcodeClient.session.prompt({
      path: { id: session.id },
      body: {
        system: systemPrompt,
        parts: [{ type: "text", text: eventMessage }],
        tools: {
          send_message: true,
          edit_tasks: true,
          create_agent: true,
        },
      },
      headers: {
        "x-opencode-directory": this.projectPath,
      },
    })

    // 6. 更新 session 信息
    this.currentSession!.messageCount++

    console.log(`[${this.employeeName}] Event handled`)
  }

  /**
   * 确保 session 存在
   * 如果没有 session，创建新的；如果有，复用
   */
  private async ensureSession(): Promise<SessionInfo> {
    if (this.currentSession) {
      return this.currentSession
    }

    // 创建新 session
    const response = await this.opcodeClient.session.create({
      body: {
        title: `${this.employeeName} - ${new Date().toISOString()}`,
      },
      query: {
        directory: this.projectPath,
      },
    })

    const sessionId = response.data?.id

    if (!sessionId) {
      throw new Error("Failed to create session")
    }

    // 注册 session
    sessionRegistry.register(sessionId, this.employeeName)

    this.currentSession = {
      id: sessionId,
      messageCount: 0,
      tokenCount: 0,
    }

    console.log(`[${this.employeeName}] Created session: ${sessionId}`)

    return this.currentSession
    // 记录 session 创建事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_created",
      timestamp: new Date().toISOString(),
      employeeName: this.employeeName,
      details: {
        sessionId,
      },
    })
  }

  /**
   * 关闭当前 session
   */
  private async closeSession(): Promise<void> {
    if (!this.currentSession) return

    console.log(
      `[${this.employeeName}] Closing session: ${this.currentSession.id}`
    )

    // 取消注册
    sessionRegistry.unregister(this.currentSession.id)

    this.currentSession = null
  }

  /**
   * 检查是否需要总结
   * 达到 token 阈值或消息数阈值时触发总结
   */
  private async summarizeIfNeeded(): Promise<void> {
    if (!this.currentSession) return

    // 获取当前 session 的详细信息
    const session = await this.opcodeClient.session.get({
      path: { id: this.currentSession.id },
    })

    const tokenCount = (session.data as any)?.tokens?.total ?? 0
    const messageCount = this.currentSession.messageCount

    // 检查是否达到阈值
    if (
      tokenCount >= this.TOKEN_THRESHOLD ||
      messageCount >= this.MESSAGE_THRESHOLD
    ) {
      console.log(
        `[${this.employeeName}] Threshold reached (tokens: ${tokenCount}, messages: ${messageCount}), summarizing...`
      )

      // 1. 请求 AI 总结
      const summary = await this.requestSummary()

      // 2. 保存总结
      await this.saveSummary(summary)

      // 3. 关闭当前 session
      await this.closeSession()

      console.log(`[${this.employeeName}] Summary completed`)
      // 记录 session 总结事件
      await this.stateManager?.addEvent({
        projectId: "",
        type: "session_summarized",
        timestamp: new Date().toISOString(),
        employeeName: this.employeeName,
        details: {
          sessionId: this.currentSession.id,
          messageCount,
          tokenCount,
        },
      })
    }
  }

  /**
   * 请求 AI 总结记忆
   * 使用 structured output 获取结构化的总结
   */
  private async requestSummary(): Promise<{
    knowledge: string[]
    custom: Record<string, any>
  }> {
    if (!this.currentSession) {
      throw new Error("No active session")
    }

    // 使用 structured output 获取总结
    const response = await this.opcodeClient.session.prompt({
      path: { id: this.currentSession.id },
      body: {
        parts: [
          {
            type: "text",
            text: "请总结你在本次对话中积累的经验知识和自定义数据。只总结新的、有价值的信息,不要重复已有的知识。请以 JSON 格式返回,包含 knowledge (字符串数组) 和 custom (对象) 两个字段。",
          },
        ],
      },
      headers: {
        "x-opencode-directory": this.projectPath,
      },
    })

    // 提取文本响应
    const messages = await this.opcodeClient.session.messages({
      path: { id: this.currentSession.id },
    })
    const lastMessage = (messages.data ?? [])
      .filter((m) => m.info.role === "assistant")
      .pop()

    if (!lastMessage) {
      return { knowledge: [], custom: {} }
    }

    const textParts = lastMessage.parts.filter((p) => p.type === "text")
    const text = textParts.map((p) => (p as any).text).join("\n")

    // 尝试解析 JSON
    try {
      const parsed = JSON.parse(text)
      return {
        knowledge: parsed.knowledge ?? [],
        custom: parsed.custom ?? {},
      }
    } catch {
      // 解析失败，返回空结果
      console.warn(`[${this.employeeName}] Failed to parse summary JSON`)
      return { knowledge: [], custom: {} }
    }
  }

  /**
   * 保存总结到记忆
   */
  private async saveSummary(summary: {
    knowledge: string[]
    custom: Record<string, any>
  }): Promise<void> {
    // 读取当前记忆
    const memory = await this.memoryManager.read(this.employeeName)

    // 合并知识（去重）
    const knowledgeSet = new Set([...memory.knowledge, ...summary.knowledge])

    // 合并自定义数据
    const custom = { ...memory.custom, ...summary.custom }

    // 写入更新后的记忆
    await this.memoryManager.write(this.employeeName, {
      knowledge: Array.from(knowledgeSet),
      tasks: memory.tasks, // tasks 不需要总结，保持原样
      custom,
    })
  }
}
