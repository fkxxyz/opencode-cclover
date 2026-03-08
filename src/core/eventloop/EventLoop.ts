import type { OpencodeClient } from "@opencode-ai/sdk"
import type { MessageClient } from "../MessageService"
import type { Event, Message } from "../../types"
import type { MemoryManager } from "../MemoryManager"
import type { RoleManager } from "../RoleManager"
import type { StateManager } from "../../state/StateManager"
import { SessionManager } from "./SessionManager"
import { SummaryService } from "./SummaryService"
import { ErrorRecovery } from "./ErrorRecovery"
import { ProgressTracker } from "./ProgressTracker"
import { buildEventMessage } from "../../utils/ContextBuilder"
import { agentRegistry } from "../../utils/AgentRegistry"
import { sessionRegistry } from "../../utils/SessionRegistry"
import { vacationRegistry } from "../../utils/VacationRegistry"
import { logger } from "../../lib/logger"

/**
 * Internal agent event type (for agentRegistry queue)
 */
export interface InternalAgentEvent {
  type: "agent_completed"
  agentId: string
  taskName: string
  result: string
  timestamp: string
}

/**
 * 事件循环
 * 员工的核心运行机制，负责等待事件、处理事件、调用 AI、管理 session 生命周期
 */
export class EventLoop {
  private running = true
  private sessionManager: SessionManager
  private summaryService: SummaryService
  private errorRecovery: ErrorRecovery
  private progressTracker: ProgressTracker

  constructor(
    private projectPath: string,
    private employeeName: string,
    private roleName: string,
    private roleManager: RoleManager,
    private messageClient: MessageClient,
    private memoryManager: MemoryManager,
    private opcodeClient: OpencodeClient,
    private stateManager?: StateManager
  ) {
    // 初始化子模块
    this.sessionManager = new SessionManager(
      projectPath,
      employeeName,
      roleName,
      roleManager,
      memoryManager,
      opcodeClient,
      stateManager
    )
    this.summaryService = new SummaryService(
      projectPath,
      employeeName,
      roleName,
      roleManager,
      memoryManager,
      opcodeClient,
      stateManager
    )
    this.errorRecovery = new ErrorRecovery(employeeName, stateManager)
    this.progressTracker = new ProgressTracker(
      employeeName,
      memoryManager,
      stateManager
    )
    // 设置 SummaryService 引用（避免循环依赖）
    this.sessionManager.setSummaryService(this.summaryService)
  }

  /**
   * 主循环
   */
  async run(): Promise<void> {
    logger.debug(
      `[${this.employeeName}] Starting event loop for project ${this.projectPath} with role ${this.roleName}`
    )

    // 启动 Agent 监听器（后台运行，不阻塞）
    this.waitForAgentCompletion().catch((error) => {
      console.error(`[${this.employeeName}] Agent listener error:`, error)
    })

    // 启动时检查是否有立即可用的事件，决定初始状态
    const hasImmediate = await this.hasImmediateEvent()
    await this.stateManager?.updateEmployeeStatus(
      this.employeeName,
      hasImmediate ? "busy" : "idle"
    )

    // 启动时确保 session 存在并检查是否需要总结
    // 这样可以在恢复已有 session 时立即触发总结（如果已超过阈值）
    try {
      await this.sessionManager.ensureSession()
      await this.sessionManager.summarizeIfNeeded()
    } catch (error) {
      console.error(
        `[${this.employeeName}] Error during startup session check:`,
        error
      )
    }

    while (this.running) {
      try {
        // 1. 检查是否有立即可用的事件
        const hasImmediate = await this.hasImmediateEvent()

        // 2. 只有在没有立即可用事件时，才设置为 idle
        if (!hasImmediate) {
          await this.stateManager?.updateEmployeeStatus(
            this.employeeName,
            "idle"
          )
        }

        // 3. 等待事件
        const event = await this.waitForEvent()
        console.log(`[${this.employeeName}] Received event:`, event.type)
        if (event.type === "message") {
          console.log(
            `[${this.employeeName}] Message from ${event.details.from}: ${event.details.content}`
          )
        } else if (event.type === "agent_completed") {
          console.log(
            `[${this.employeeName}] Agent completed: ${event.details.taskName}, result: ${event.details.result}`
          )
        }

        // 4. 更新状态为 busy（处理事件）
        await this.stateManager?.updateEmployeeStatus(this.employeeName, "busy")

        // 5. 处理事件
        await this.handleEvent(event)

        // 6. 检查是否需要总结
        await this.sessionManager.summarizeIfNeeded()

        // 成功：重置错误追踪
        this.errorRecovery.resetErrorTracking()
      } catch (error) {
        // 检查是否是假期请求导致的退出
        if ((error as any).message === "VACATION_REQUESTED") {
          logger.info(
            `[${this.employeeName}] EventLoop exiting due to vacation request`
          )
          return // 正常退出，不记录错误
        }

        // 处理错误（分类和恢复）
        const shouldStop = await this.errorRecovery.handleError(error, () => {
          this.running = false
        })
        if (shouldStop) {
          await this.cleanup()
          return
        }
      }
    }
  }

  /**
   * 等待事件
   * 按优先级顺序检查：假期通知 > 消息 > Agent完成 > 可执行任务 > in_progress任务
   */
  private async waitForEvent(): Promise<Event> {
    // 0. HIGHEST PRIORITY: Check vacation notification
    const vacationEvent = vacationRegistry.getVacationEvent(this.employeeName)
    if (vacationEvent) {
      return {
        projectId: "",
        type: "vacation_requested",
        timestamp: vacationEvent.timestamp,
        details: {},
      }
    }

    // 1. 非阻塞检查未读消息
    const messageService = (this.messageClient as any).service
    const unreadQueue = messageService.getUnreadQueue(this.employeeName)
    if (unreadQueue.length > 0) {
      const msg = unreadQueue.shift()!
      // 收到消息，清空快照和计数器
      this.progressTracker.clearProgressTracking()
      return {
        projectId: "",
        type: "message",
        timestamp: msg.timestamp,
        details: {
          from: msg.from,
          to: msg.to,
          content: msg.content,
          ...(msg.fromRole && { fromRole: msg.fromRole }),
        },
      }
    }

    // 2. 非阻塞检查 Agent 完成队列
    const completedAgent = agentRegistry.getCompletedEvent(this.employeeName)
    if (completedAgent) {
      // Agent 完成，清空快照和计数器
      this.progressTracker.clearProgressTracking()
      return {
        projectId: "",
        type: "agent_completed",
        timestamp: completedAgent.timestamp,
        details: {
          agentId: completedAgent.agentId,
          taskName: completedAgent.taskName,
          result: completedAgent.result,
        },
      }
    }

    // 3. 检查是否有运行中的 Agent
    const runningAgents = agentRegistry.getAgentsByEmployee(this.employeeName)
    const hasRunningAgent = runningAgents.length > 0

    // 4. 获取当前员工状态
    const employee = await this.stateManager?.getEmployee(this.employeeName)
    const isAbnormal = employee?.status === "abnormal"

    // 只有在没有运行中的 Agent 且不是异常状态时才检查任务
    if (!hasRunningAgent && !isAbnormal) {
      // 5. 检查可执行任务
      const executableTasks = await this.memoryManager.getExecutableTasks(
        this.employeeName
      )
      if (executableTasks.length > 0) {
        return {
          projectId: "",
          type: "task_available",
          timestamp: new Date().toISOString(),
          details: {
            tasks: executableTasks,
          },
        }
      }

      // 6. 检查 in_progress 任务
      const inProgressTasks = await this.memoryManager.getInProgressTasks(
        this.employeeName
      )
      if (inProgressTasks.length > 0) {
        return {
          projectId: "",
          type: "task_reminder",
          timestamp: new Date().toISOString(),
          details: {
            tasks: inProgressTasks,
          },
        }
      }
    }

    // 7. 以上都没有，阻塞等待
    return Promise.race([this.waitForMessage(), this.waitForAgentCompletion()])
  }

  /**
   * 检查是否有立即可用的事件
   * 用于避免不必要的 idle 状态切换
   */
  private async hasImmediateEvent(): Promise<boolean> {
    // 0. 检查假期通知
    if (vacationRegistry.hasVacationEvent(this.employeeName)) {
      return true
    }

    // 1. 检查未读消息
    const messageService = (this.messageClient as any).service
    const unreadQueue = messageService.getUnreadQueue(this.employeeName)
    if (unreadQueue.length > 0) return true

    // 2. 检查 Agent 完成队列
    const completedAgent = agentRegistry.getCompletedEvent(this.employeeName)
    if (completedAgent) {
      // 放回队列（因为只是检查，不是真正取出）
      agentRegistry.addCompletedEvent(this.employeeName, completedAgent)
      return true
    }

    // 3. 检查是否有运行中的 Agent
    const runningAgents = agentRegistry.getAgentsByEmployee(this.employeeName)
    const hasRunningAgent = runningAgents.length > 0

    // 只有在没有运行中的 Agent 时才检查任务
    if (!hasRunningAgent) {
      // 4. 检查可执行任务
      const executableTasks = await this.memoryManager.getExecutableTasks(
        this.employeeName
      )
      if (executableTasks.length > 0) return true

      // 5. 检查 in_progress 任务
      const inProgressTasks = await this.memoryManager.getInProgressTasks(
        this.employeeName
      )
      if (inProgressTasks.length > 0) return true
    }

    return false
  }

  /**
   * 等待新消息
   */
  private async waitForMessage(): Promise<Event> {
    const msg = await this.messageClient.recv()
    return {
      projectId: "",
      type: "message",
      timestamp: msg.timestamp,
      details: {
        from: msg.from,
        to: msg.to,
        content: msg.content,
        ...(msg.fromRole && { fromRole: msg.fromRole }),
      },
    }
  }

  /**
   * 等待 Agent 完成
   * 订阅 OpenCode 事件流，监听 session 状态变化
   * 将完成的 agent 放入队列，而不是直接返回
   */
  private async waitForAgentCompletion(): Promise<Event> {
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
          if (agentInfo) {
            // 获取 agent 的最后一条消息作为结果
            const result = await this.getAgentResult(sessionId)

            // 取消注册
            agentRegistry.unregister(sessionId)

            // 创建事件对象
            const agentEvent: InternalAgentEvent = {
              type: "agent_completed",
              agentId: sessionId,
              taskName: agentInfo.taskName,
              result,
              timestamp: new Date().toISOString(),
            }

            // 记录 agent 完成事件
            await this.stateManager?.addEvent({
              projectId: "",
              type: "agent_completed",
              timestamp: agentEvent.timestamp,
              employeeName: this.employeeName,
              details: {
                agentId: sessionId,
                taskName: agentInfo.taskName,
                result,
              },
            })

            // 如果是当前员工的 agent，放入队列
            if (agentInfo.employeeName === this.employeeName) {
              agentRegistry.addCompletedEvent(this.employeeName, agentEvent)
            }

            // 继续监听（不返回，让 waitForEvent 从队列中取）
          }
        }
      }
    }

    // 永远不会到达这里（for await 会一直等待）
    throw new Error("Unexpected end of event stream")
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

    // 1. 处理假期请求事件
    if (event.type === "vacation_requested") {
      // 更新状态为 offline
      await this.stateManager?.updateEmployeeStatus(
        this.employeeName,
        "offline"
      )

      // 记录状态变更事件
      await this.stateManager?.addEvent({
        projectId: "",
        type: "employee_status_changed",
        timestamp: new Date().toISOString(),
        employeeName: this.employeeName,
        details: {
          oldStatus: "busy", // or get from stateManager
          newStatus: "offline",
          reason: "vacation_requested",
        },
      })

      // 抛出特定错误以触发 EventLoop 退出
      throw new Error("VACATION_REQUESTED")
    }

    // 2. 如果是消息或 agent 事件，清空快照并恢复正常状态
    if (event.type === "message" || event.type === "agent_completed") {
      this.progressTracker.clearProgressTracking()
      const employee = await this.stateManager?.getEmployee(this.employeeName)
      if (employee?.status === "abnormal") {
        await this.stateManager?.updateEmployeeStatus(this.employeeName, "busy")
        logger.info(
          `[${this.employeeName}] Recovered from abnormal status due to ${event.type} event`
        )
      }
    }

    // 2. 确保 session 存在
    const session = await this.sessionManager.ensureSession()
    console.log(
      `[${this.employeeName}] Handling event in session: ${session.id}`
    )

    // 3. 读取当前记忆
    const memory = await this.memoryManager.read(this.employeeName)

    // 4. 构建事件消息
    const eventMessage = buildEventMessage(event)

    // 5. 使用缓存的系统提示词（每次都传递）
    const systemPrompt = session.systemPrompt

    // 6. 记录 session prompt 开始事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_prompt_started",
      timestamp: new Date().toISOString(),
      employeeName: this.employeeName,
      details: {
        sessionId: session.id,
        eventType: event.type,
        messageCount: session.messageCount,
      },
    })

    // 7. 发送给 AI
    await this.opcodeClient.session.prompt({
      path: { id: session.id },
      body: {
        agent: "cclover-empty-agent", // 使用空 agent 避免预设提示词污染
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

    // 8. 更新 session 信息
    this.sessionManager.incrementMessageCount()

    // 9. 记录 session prompt 完成事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_prompt_completed",
      timestamp: new Date().toISOString(),
      employeeName: this.employeeName,
      details: {
        sessionId: session.id,
        messageCount: session.messageCount,
      },
    })

    // 10. 如果是任务事件，检测进展
    if (event.type === "task_available" || event.type === "task_reminder") {
      await this.progressTracker.checkProgress()
    }

    console.log(`[${this.employeeName}] Event handled`)
  }

  /**
   * 刷新系统提示词
   */
  async refreshSystemPrompt(): Promise<void> {
    await this.sessionManager.refreshSystemPrompt()
  }

  /**
   * 清理资源
   */
  private async cleanup(): Promise<void> {
    logger.info(`[${this.employeeName}] Cleaning up resources`)

    // 关闭 session
    await this.sessionManager.closeSession()

    // 其他清理工作...
  }

  /**
   * 优雅停止事件循环
   */
  async stop(): Promise<void> {
    logger.info(`[${this.employeeName}] Stopping event loop`)
    this.running = false
    await this.cleanup()
  }
}
