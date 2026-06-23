import type { OpencodeClient } from "@opencode-ai/sdk"
import type { MessageClient } from "../MessageService"
import type {
  Event,
  Message,
  EmployeeId,
  EmployeeWorkSessionId,
} from "../../types"
import type { MemoryManager } from "../MemoryManager"
import type { RoleManager } from "../RoleManager"
import type { EmployeeWorkSessionManager } from "../EmployeeWorkSessionManager"
import type { StateManager } from "../../state/StateManager"
import type { ModelConfigManager } from "../../config/ModelConfigManager"
import type { RuntimeEvent } from "../../utils/ContextBuilder"
import { SessionManager } from "./SessionManager"
import { SummaryService } from "./SummaryService"
import { ErrorRecovery } from "./ErrorRecovery"
import { ProgressTracker } from "./ProgressTracker"
import { ReplyTracker } from "./ReplyTracker"
import { buildEventMessage } from "../../utils/ContextBuilder"
import { haltRegistry } from "../../utils/HaltRegistry"
import { sessionRegistry } from "../../utils/SessionRegistry"
import { logger } from "../../lib/logger"

export interface InternalPromptRecoveryEvent {
  type: "prompt_recovery"
  timestamp: string
  sessionId: string
  startedAt: string
  triggerEventType: string
  version?: number
}

interface RuntimePromptRecoveryEvent {
  projectId: string
  type: "prompt_recovery"
  timestamp: string
  details: {
    sessionId: string
    startedAt: string
    triggerEventType: string
    version?: number
  }
}

interface RuntimeHaltEvent {
  projectId: string
  type: "halt_requested"
  timestamp: string
  details: {
    reason?: string
    triggeredBy?: string
  }
}

/**
 * 事件循环
 * 员工的核心运行机制，负责等待事件、处理事件、调用 AI、管理 session 生命周期
 */
export class EventLoop {
  private running = true
  private recoveryQueue: InternalPromptRecoveryEvent[] = []
  private sessionManager: SessionManager
  private summaryService: SummaryService
  private errorRecovery: ErrorRecovery
  private progressTracker: ProgressTracker
  private replyTracker: ReplyTracker

  private formatErrorForLog(error: unknown): {
    message: string
    stack?: string
    name?: string
  } {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    try {
      return {
        message: JSON.stringify(error),
      }
    } catch {
      return {
        message: String(error),
      }
    }
  }

  constructor(
    private projectPath: string,
    private employeeWorkSessionId: EmployeeWorkSessionId,
    private employeeId: EmployeeId,
    private roleName: string,
    private roleManager: RoleManager,
    private messageClient: MessageClient,
    private memoryManager: MemoryManager,
    private opcodeClient: OpencodeClient,
    private modelConfigManager: ModelConfigManager,
    private employeeWorkSessionManager: EmployeeWorkSessionManager,
    private stateManager?: StateManager
  ) {
    // 初始化子模块
    this.sessionManager = new SessionManager(
      projectPath,
      employeeWorkSessionId,
      employeeId,
      roleName,
      roleManager,
      memoryManager,
      opcodeClient,
      employeeWorkSessionManager,
      stateManager
    )
    this.summaryService = new SummaryService(
      projectPath,
      employeeWorkSessionId,
      roleName,
      roleManager,
      memoryManager,
      opcodeClient,
      stateManager
    )
    this.errorRecovery = new ErrorRecovery(
      employeeWorkSessionId,
      employeeWorkSessionManager,
      stateManager
    )
    this.progressTracker = new ProgressTracker(
      employeeWorkSessionId,
      memoryManager,
      employeeWorkSessionManager,
      stateManager
    )
    this.replyTracker = new ReplyTracker(
      employeeWorkSessionId,
      (messageClient as any).service,
      memoryManager,
      employeeWorkSessionManager,
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
      `[${this.employeeWorkSessionId}] Starting event loop for project ${this.projectPath} with role ${this.roleName}`
    )

    // 启动时检查是否有立即可用的事件，决定初始状态
    logger.debug(
      `[${this.employeeWorkSessionId}] Checking for immediate events`
    )
    const hasImmediate = await this.hasImmediateEvent()
    logger.debug(
      `[${this.employeeWorkSessionId}] Has immediate event: ${hasImmediate}`
    )
    await this.employeeWorkSessionManager.updateStatus(
      this.employeeWorkSessionId,
      hasImmediate ? "busy" : "idle"
    )
    logger.debug(
      `[${this.employeeWorkSessionId}] Initial status set to: ${hasImmediate ? "busy" : "idle"}`
    )

    // 启动时确保 session 存在并检查是否需要总结
    // 这样可以在恢复已有 session 时立即触发总结（如果已超过阈值）
    logger.debug(`[${this.employeeId}] Ensuring session exists`)
    try {
      await this.sessionManager.ensureSession()
      logger.debug(`[${this.employeeId}] Session ensured`)
      logger.debug(`[${this.employeeId}] Checking if summary needed`)
      await this.sessionManager.summarizeIfNeeded()
    } catch (error) {
      console.error(
        `[${this.employeeId}] Error during startup session check:`,
        error
      )
    }

    logger.debug(`[${this.employeeId}] Entering main event loop`)
    while (this.running) {
      try {
        // 1. 检查是否有立即可用的事件
        const hasImmediate = await this.hasImmediateEvent()
        logger.debug(`[${this.employeeId}] hasImmediate=${hasImmediate}`)

        // 2. 只有在没有立即可用事件时，才设置为 idle
        if (!hasImmediate) {
          await this.employeeWorkSessionManager.updateStatus(
            this.employeeWorkSessionId,
            "idle"
          )
          logger.debug(`[${this.employeeWorkSessionId}] Status updated to idle`)
        }

        // 3. 等待事件
        logger.debug(`[${this.employeeId}] Waiting for event...`)
        const event = await this.waitForEvent()
        logger.info(`[${this.employeeId}] Received event:`, event.type)
        if (event.type === "message") {
          logger.debug(
            `[${this.employeeId}] Message from ${event.details.from}: ${event.details.content}`
          )
        }

        // 4. 更新状态为 busy（处理事件）
        await this.employeeWorkSessionManager.updateStatus(
          this.employeeWorkSessionId,
          "busy"
        )
        logger.debug(`[${this.employeeWorkSessionId}] Status updated to busy`)

        // 5. 处理事件
        logger.debug(
          `[${this.employeeId}] Starting to handle event: ${event.type}`
        )
        await this.handleEvent(event)
        logger.debug(
          `[${this.employeeId}] Finished handling event: ${event.type}`
        )

        // 6. 检查是否需要总结
        logger.debug(`[${this.employeeId}] Checking if summary needed`)
        await this.sessionManager.summarizeIfNeeded()
        logger.debug(`[${this.employeeId}] Summary check completed`)

        // 成功：重置错误追踪
        this.errorRecovery.resetErrorTracking()
      } catch (error) {
        logger.debug(
          `[${this.employeeId}] [ERROR] Caught error in event loop: `,
          error
        )

        if ((error as any).message === "HALT_REQUESTED") {
          logger.warn(
            `[${this.employeeId}] EventLoop exiting due to halt request`
          )
          return
        }

        // 处理错误（分类和恢复）
        const shouldStop = await this.errorRecovery.handleError(error, () => {
          this.running = false
        })

        if (shouldStop) {
          logger.debug(
            `[${this.employeeId}] Stopping event loop due to error recovery decision`
          )
          await this.cleanup()
          return
        }
      }
    }
  }

  /**
   * 注入启动恢复事件
   */
  enqueuePromptRecovery(event: InternalPromptRecoveryEvent): void {
    this.recoveryQueue.push(event)
  }

  /**
   * 等待事件
   * 按优先级顺序检查：急停 > 恢复 > 消息 > 可执行任务 > in_progress任务 > 待回复消息
   */
  private async waitForEvent(): Promise<RuntimeEvent> {
    const haltEvent = haltRegistry.getHaltEvent(this.employeeWorkSessionId)
    if (haltEvent) {
      const runtimeHaltEvent: RuntimeHaltEvent = {
        projectId: "",
        type: "halt_requested",
        timestamp: haltEvent.timestamp,
        details: {
          reason: haltEvent.reason,
          triggeredBy: haltEvent.triggeredBy,
        },
      }
      return runtimeHaltEvent
    }

    // 0.5 启动恢复事件优先于普通工作事件
    const recoveryEvent = this.recoveryQueue.shift()
    if (recoveryEvent) {
      const runtimeRecoveryEvent: RuntimePromptRecoveryEvent = {
        projectId: "",
        type: "prompt_recovery",
        timestamp: recoveryEvent.timestamp,
        details: {
          sessionId: recoveryEvent.sessionId,
          startedAt: recoveryEvent.startedAt,
          triggerEventType: recoveryEvent.triggerEventType,
          version: recoveryEvent.version,
        },
      }
      return runtimeRecoveryEvent
    }

    // 1. 非阻塞检查未读消息
    const messageService = (this.messageClient as any).service
    const unreadQueue = messageService.getUnreadQueue(
      this.employeeWorkSessionId
    )
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
          ...(msg.urgent !== undefined && { urgent: msg.urgent }),
          ...(msg.fromRole && { fromRole: msg.fromRole }),
        },
      }
    }

    // 2. 获取当前 EWS 状态
    const employeeWorkSession =
      await this.employeeWorkSessionManager.getEmployeeWorkSession(
        this.employeeWorkSessionId
      )
    const isAbnormal = employeeWorkSession?.status === "abnormal"

    // 异常状态下仅响应消息和急停，避免继续推进任务
    if (!isAbnormal) {
      // 3. 检查可执行任务
      const executableTasks = await this.memoryManager.getExecutableTasks(
        this.employeeWorkSessionId
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

      // 4. 检查 in_progress 任务
      const inProgressTasks = await this.memoryManager.getInProgressTasks(
        this.employeeWorkSessionId
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

      // 5. 检查未回复的 expect_reply=true 消息
      const unrepliedSenders = await this.replyTracker.getUnrepliedSenders()
      if (unrepliedSenders.length > 0) {
        return {
          projectId: "",
          type: "reply_reminder",
          timestamp: new Date().toISOString(),
          details: {
            senders: unrepliedSenders,
          },
        }
      }
    }

    // 6. 以上都没有，阻塞等待消息
    return this.waitForMessage()
  }

  /**
   * 检查是否有立即可用的事件
   * 用于避免不必要的 idle 状态切换
   */
  private async hasImmediateEvent(): Promise<boolean> {
    if (haltRegistry.hasHaltEvent(this.employeeWorkSessionId)) {
      return true
    }

    // 0.5 检查恢复事件
    if (this.recoveryQueue.length > 0) {
      return true
    }

    // 1. 检查未读消息
    const messageService = (this.messageClient as any).service
    const unreadQueue = messageService.getUnreadQueue(
      this.employeeWorkSessionId
    )
    if (unreadQueue.length > 0) return true

    // 2. 检查可执行任务
    const executableTasks = await this.memoryManager.getExecutableTasks(
      this.employeeWorkSessionId
    )
    if (executableTasks.length > 0) return true

    // 3. 检查 in_progress 任务
    const inProgressTasks = await this.memoryManager.getInProgressTasks(
      this.employeeWorkSessionId
    )
    if (inProgressTasks.length > 0) return true

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
        ...(msg.urgent !== undefined && { urgent: msg.urgent }),
        ...(msg.fromRole && { fromRole: msg.fromRole }),
      },
    }
  }

  /**
   * 处理事件
   */
  private async handleEvent(event: RuntimeEvent): Promise<void> {
    logger.info(`[${this.employeeWorkSessionId}] Received event:`, event.type)

    // 1. 处理急停请求事件
    if (event.type === "halt_requested") {
      await this.employeeWorkSessionManager.updateStatus(
        this.employeeWorkSessionId,
        "offline"
      )
      throw new Error("HALT_REQUESTED")
    }

    // 2. 如果是消息或恢复事件，清空快照并恢复正常状态
    if (event.type === "message" || event.type === "prompt_recovery") {
      this.progressTracker.clearProgressTracking()
      // 只有当员工发送消息时才清空回复跟踪
      if (
        event.type === "message" &&
        event.details.from === this.employeeWorkSessionId
      ) {
        this.replyTracker.clearReplyTracking()
      }
      const employeeWorkSession =
        await this.employeeWorkSessionManager.getEmployeeWorkSession(
          this.employeeWorkSessionId
        )
      if (employeeWorkSession?.status === "abnormal") {
        await this.employeeWorkSessionManager.updateStatus(
          this.employeeWorkSessionId,
          "busy"
        )
        logger.info(
          `[${this.employeeWorkSessionId}] Recovered from abnormal status due to ${event.type} event`
        )
      }
    }

    // 3. 确保 session 存在
    const session = await this.sessionManager.ensureSession()
    logger.info(
      `[${this.employeeWorkSessionId}] Handling event in session: ${session.id}`
    )
    logger.debug(
      `[${this.employeeWorkSessionId}] Set active session to ${session.id} before calling AI`
    )

    const messageService = (this.messageClient as any).service
    const hasPendingUrgentInterruption =
      typeof messageService?.hasPendingUrgentInterruption === "function" &&
      messageService.hasPendingUrgentInterruption(this.employeeWorkSessionId)
    const isUrgentMessageEvent =
      event.type === "message" && event.details?.urgent === true

    if (hasPendingUrgentInterruption && !isUrgentMessageEvent) {
      logger.info(
        `[${this.employeeWorkSessionId}] Deferring ${event.type} because an urgent message arrived before prompt start`
      )
      return
    }

    if (isUrgentMessageEvent) {
      messageService?.clearPendingUrgentInterruption?.(
        this.employeeWorkSessionId
      )
    }

    // 5. 读取当前记忆
    const memory = await this.memoryManager.read(this.employeeWorkSessionId)

    // 6. 构建事件消息
    const eventMessage = buildEventMessage(event)

    // 7. 使用缓存的系统提示词（每次都传递）
    const systemPrompt = session.systemPrompt

    // 8. 记录 session prompt 开始事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_prompt_started",
      timestamp: new Date().toISOString(),
      employeeWorkSessionId: this.employeeWorkSessionId,
      employeeId: this.employeeId,
      details: {
        sessionId: session.id,
        eventType: event.type,
        messageCount: session.messageCount,
      },
    })

    await this.employeeWorkSessionManager.setPromptRecovery(
      this.employeeWorkSessionId,
      {
        version: 1,
        sessionId: session.id,
        startedAt: new Date().toISOString(),
        triggerEventType: event.type,
      }
    )

    // 9. 查询模型配置
    const role = this.roleManager.getRole(this.roleName)
    const modelType = role?.model_type || "default"
    const modelConfig = this.modelConfigManager.resolve(modelType)

    // 10. 发送给 AI
    logger.debug(`[${this.employeeWorkSessionId}] Calling AI (session.prompt)`)
    const promptInput = {
      path: { id: session.id },
      body: {
        agent: "cclover-empty-agent", // 使用空 agent 避免预设提示词污染
        system: systemPrompt,
        parts: [{ type: "text" as const, text: eventMessage }],
        tools: {
          send_message: true,
          edit_tasks: true,
          show_tasks: true,
        },
        ...(modelConfig && { model: modelConfig }),
      },
      headers: {
        "x-opencode-directory": this.projectPath,
      },
    }
    let result
    try {
      result = await this.opcodeClient.session.prompt(promptInput)
    } catch (error) {
      logger.error(
        `[${this.employeeWorkSessionId}] session.prompt failed with input: ${JSON.stringify(promptInput, null, 2)}`
      )
      throw error
    }
    logger.debug(
      `[${this.employeeWorkSessionId}] AI call completed, received result`
    )

    // 12. 检查是否被紧急消息中断
    if (result.data?.info.error?.name === "MessageAbortedError") {
      logger.info(
        `[${this.employeeWorkSessionId}] Session aborted by urgent message, continuing to next event`
      )
      return
    }

    await this.employeeWorkSessionManager.clearPromptRecovery(
      this.employeeWorkSessionId
    )

    // 12. 更新 session 信息
    this.sessionManager.incrementMessageCount()

    // 13. 记录 session prompt 完成事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_prompt_completed",
      timestamp: new Date().toISOString(),
      employeeWorkSessionId: this.employeeWorkSessionId,
      employeeId: this.employeeId,
      details: {
        sessionId: session.id,
        messageCount: session.messageCount,
      },
    })

    // 14. 如果是任务事件，检测进展
    if (event.type === "task_available" || event.type === "task_reminder") {
      await this.progressTracker.checkProgress()
    }

    // 15. 如果是回复提醒事件，检测进展
    if (event.type === "reply_reminder") {
      await this.replyTracker.checkProgress()
    }

    logger.info(`[${this.employeeWorkSessionId}] Event handled`)
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
    logger.info(`[${this.employeeId}] Cleaning up resources`)

    // 关闭 session
    await this.sessionManager.closeSession()

    // 其他清理工作...
  }

  /**
   * 优雅停止事件循环
   */
  async stop(): Promise<void> {
    logger.info(`[${this.employeeId}] Stopping event loop`)
    this.running = false
    await this.cleanup()
  }
}
