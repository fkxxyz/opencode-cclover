import type { OpencodeClient } from "@opencode-ai/sdk"
import type { MessageClient } from "../MessageService"
import type { Event, Message, EmployeeId } from "../../types"
import type { MemoryManager } from "../MemoryManager"
import type { RoleManager } from "../RoleManager"
import type { StateManager } from "../../state/StateManager"
import type { ModelConfigManager } from "../../config/ModelConfigManager"
import type { RuntimeEvent } from "../../utils/ContextBuilder"
import { SessionManager } from "./SessionManager"
import { SummaryService } from "./SummaryService"
import { ErrorRecovery } from "./ErrorRecovery"
import { ProgressTracker } from "./ProgressTracker"
import { ReplyTracker } from "./ReplyTracker"
import { buildEventMessage } from "../../utils/ContextBuilder"
import { agentRegistry } from "../../utils/AgentRegistry"
import { haltRegistry } from "../../utils/HaltRegistry"
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
    taskId: number
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
    private employeeId: EmployeeId,
    private roleName: string,
    private roleManager: RoleManager,
    private messageClient: MessageClient,
    private memoryManager: MemoryManager,
    private opcodeClient: OpencodeClient,
    private modelConfigManager: ModelConfigManager,
    private stateManager?: StateManager
  ) {
    // 初始化子模块
    this.sessionManager = new SessionManager(
      projectPath,
      employeeId,
      roleName,
      roleManager,
      memoryManager,
      opcodeClient,
      stateManager
    )
    this.summaryService = new SummaryService(
      projectPath,
      employeeId,
      roleName,
      roleManager,
      memoryManager,
      opcodeClient,
      stateManager
    )
    this.errorRecovery = new ErrorRecovery(employeeId, stateManager)
    this.progressTracker = new ProgressTracker(
      employeeId,
      memoryManager,
      stateManager
    )
    this.replyTracker = new ReplyTracker(
      employeeId,
      (messageClient as any).service,
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
      `[${this.employeeId}] Starting event loop for project ${this.projectPath} with role ${this.roleName}`
    )

    // 临时禁用子 agent：
    // OpenCode SSE event stream 在新版本会主动结束，导致 waitForAgentCompletion() 抛错并干扰主循环。
    // 子 agent 功能暂时关闭，避免员工事件循环被拖垮。
    // logger.debug(`[${this.employeeId}] Starting agent listener`)
    // this.waitForAgentCompletion().catch((error) => {
    //   const info = this.formatErrorForLog(error)
    //   logger.error(`[${this.employeeId}] Agent listener error`, info)
    // })

    // 启动时检查是否有立即可用的事件，决定初始状态
    logger.debug(`[${this.employeeId}] Checking for immediate events`)
    const hasImmediate = await this.hasImmediateEvent()
    logger.debug(`[${this.employeeId}] Has immediate event: ${hasImmediate}`)
    await this.stateManager?.updateEmployeeStatus(
      this.employeeId,
      hasImmediate ? "busy" : "idle"
    )
    logger.debug(
      `[${this.employeeId}] Initial status set to: ${hasImmediate ? "busy" : "idle"}`
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
          await this.stateManager?.updateEmployeeStatus(this.employeeId, "idle")
          logger.debug(`[${this.employeeId}] Status updated to idle`)
        }

        // 3. 等待事件
        logger.debug(`[${this.employeeId}] Waiting for event...`)
        const event = await this.waitForEvent()
        logger.info(`[${this.employeeId}] Received event:`, event.type)
        if (event.type === "message") {
          logger.debug(
            `[${this.employeeId}] Message from ${event.details.from}: ${event.details.content}`
          )
        } else if (event.type === "agent_completed") {
          logger.debug(
            `[${this.employeeId}] Agent completed: ${event.details.taskName}`
          )
        }

        // 4. 更新状态为 busy（处理事件）
        await this.stateManager?.updateEmployeeStatus(this.employeeId, "busy")
        logger.debug(`[${this.employeeId}] Status updated to busy`)

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

        // 检查是否是假期请求导致的退出
        if ((error as any).message === "VACATION_REQUESTED") {
          logger.info(
            `[${this.employeeId}] EventLoop exiting due to vacation request`
          )
          return // 正常退出，不记录错误
        }

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
   * 按优先级顺序检查：假期通知 > 消息 > Agent完成 > 可执行任务 > in_progress任务
   */
  private async waitForEvent(): Promise<RuntimeEvent> {
    const haltEvent = haltRegistry.getHaltEvent(this.employeeId)
    if (haltEvent) {
      const runtimeHaltEvent: RuntimeHaltEvent = {
        projectId: "",
        type: "halt_requested",
        timestamp: haltEvent.timestamp,
        details: {
          taskId: haltEvent.taskId,
          reason: haltEvent.reason,
          triggeredBy: haltEvent.triggeredBy,
        },
      }
      return runtimeHaltEvent
    }

    // 0. HIGHEST PRIORITY: Check vacation notification
    const vacationEvent = vacationRegistry.getVacationEvent(this.employeeId)
    if (vacationEvent) {
      return {
        projectId: "",
        type: "vacation_requested",
        timestamp: vacationEvent.timestamp,
        details: {},
      }
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
    const unreadQueue = messageService.getUnreadQueue(this.employeeId)
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

    // 2. 子 agent 功能暂时禁用：不再消费 agentRegistry 完成队列
    // const completedAgent = agentRegistry.getCompletedEvent(this.employeeId)
    // if (completedAgent) {
    //   this.progressTracker.clearProgressTracking()
    //   return {
    //     projectId: "",
    //     type: "agent_completed",
    //     timestamp: completedAgent.timestamp,
    //     details: {
    //       agentId: completedAgent.agentId,
    //       taskName: completedAgent.taskName,
    //       result: completedAgent.result,
    //     },
    //   }
    // }

    // 3. 子 agent 功能暂时禁用：不再根据 agentRegistry 判断运行中 agent
    const hasRunningAgent = false

    // 4. 获取当前员工状态
    const employee = await this.stateManager?.getEmployee(this.employeeId)
    const isAbnormal = employee?.status === "abnormal"

    // 只有在没有运行中的 Agent 且不是异常状态时才检查任务
    if (!hasRunningAgent && !isAbnormal) {
      // 5. 检查可执行任务
      const executableTasks = await this.memoryManager.getExecutableTasks(
        this.employeeId
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
        this.employeeId
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

      // 7. 检查未回复的 expect_reply=true 消息
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

      // 8. 检查未回复的调查问卷
      const surveyReminder = await this.checkSurveyReminders()
      if (surveyReminder) {
        return surveyReminder
      }
    }

    // 9. 以上都没有，阻塞等待
    // 子 agent 功能暂时禁用：不再阻塞等待 SSE 事件流
    return this.waitForMessage()
  }

  /**
   * 检查是否有立即可用的事件
   * 用于避免不必要的 idle 状态切换
   */
  private async hasImmediateEvent(): Promise<boolean> {
    if (haltRegistry.hasHaltEvent(this.employeeId)) {
      return true
    }

    // 0. 检查假期通知
    if (vacationRegistry.hasVacationEvent(this.employeeId)) {
      return true
    }

    // 0.5 检查恢复事件
    if (this.recoveryQueue.length > 0) {
      return true
    }

    // 1. 检查未读消息
    const messageService = (this.messageClient as any).service
    const unreadQueue = messageService.getUnreadQueue(this.employeeId)
    if (unreadQueue.length > 0) return true

    // 2. 子 agent 功能暂时禁用：不检查 agentRegistry 完成队列
    // const completedAgent = agentRegistry.getCompletedEvent(this.employeeId)
    // if (completedAgent) {
    //   agentRegistry.addCompletedEvent(this.employeeId, completedAgent)
    //   return true
    // }

    // 3. 子 agent 功能暂时禁用：不检查运行中的 agent
    const hasRunningAgent = false

    // 只有在没有运行中的 Agent 时才检查任务
    if (!hasRunningAgent) {
      // 4. 检查可执行任务
      const executableTasks = await this.memoryManager.getExecutableTasks(
        this.employeeId
      )
      if (executableTasks.length > 0) return true

      // 5. 检查 in_progress 任务
      const inProgressTasks = await this.memoryManager.getInProgressTasks(
        this.employeeId
      )
      if (inProgressTasks.length > 0) return true
    }

    return false
  }

  /**
   * 检查调查问卷提醒
   * 读取 events.jsonl，查找未回复的调查问卷，发送提醒或标记为异常
   */
  private async checkSurveyReminders(): Promise<RuntimeEvent | null> {
    if (!this.stateManager) {
      return null
    }

    try {
      // 读取最近的事件（足够找到 survey_sent 和相关 reminders）
      const eventLogger = (this.stateManager as any).eventLogger
      const events = await eventLogger.getEvents(this.employeeId, 200)

      // 查找最近的 survey_sent 事件
      const surveySent = events.find((e: Event) => e.type === "survey_sent")
      if (!surveySent) {
        return null // 没有调查问卷
      }

      // 检查是否已经回复
      const feedbackReceived = events.find(
        (e: Event) => e.type === "feedback_received"
      )
      if (feedbackReceived) {
        return null // 已经回复
      }

      // 获取调查发送时间
      const sentAt = new Date(surveySent.details.sentAt)
      const hoursSince = (Date.now() - sentAt.getTime()) / 3600000

      // 统计调查相关的提醒次数（通过 surveyId 过滤）
      const surveyId = surveySent.details.sentAt
      const reminderCount = events.filter(
        (e: Event) =>
          e.type === "reply_reminder" &&
          e.details.surveyId === surveyId &&
          e.details.reason === "survey_pending"
      ).length

      // 检查是否需要发送提醒（每 24 小时一次，最多 3 次）
      if (hoursSince > (reminderCount + 1) * 24 && reminderCount < 3) {
        // 记录 reply_reminder 事件
        await this.stateManager.addEvent({
          projectId: this.stateManager.getProjectId(),
          type: "reply_reminder",
          timestamp: new Date().toISOString(),
          employeeId: this.employeeId,
          details: {
            reminderCount: reminderCount + 1,
            surveyId,
            reason: "survey_pending",
          },
        })

        return {
          projectId: "",
          type: "reply_reminder",
          timestamp: new Date().toISOString(),
          details: {
            reminderCount: reminderCount + 1,
            surveyId,
            reason: "survey_pending",
          },
        }
      } else if (reminderCount >= 3) {
        // 3 次提醒后标记为异常
        await this.stateManager.updateEmployeeStatus(
          this.employeeId,
          "abnormal"
        )
        return null
      }

      return null
    } catch (error: any) {
      logger.error(
        `[EventLoop] Failed to check survey reminders for ${this.employeeId}: ${error.message}`
      )
      return null
    }
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
   * 等待 Agent 完成
   * 订阅 OpenCode 事件流，监听 session 状态变化
   * 将完成的 agent 放入队列，而不是直接返回
   */
  private async waitForAgentCompletion(): Promise<Event> {
    // 子 agent 功能暂时禁用：
    // OpenCode SSE event stream 在新版本可能会频繁/定期结束，当前实现会将其视为异常并影响主循环。
    throw new Error("waitForAgentCompletion is temporarily disabled")
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
      console.error(`[${this.employeeId}] Failed to get agent result:`, error)
      return "获取 Agent 结果失败"
    }
  }

  /**
   * 处理事件
   */
  private async handleEvent(event: RuntimeEvent): Promise<void> {
    logger.info(`[${this.employeeId}] Received event:`, event.type)

    // 1. 处理急停请求事件
    if (event.type === "halt_requested") {
      await this.stateManager?.updateEmployeeStatus(this.employeeId, "offline")
      await this.stateManager?.addEvent({
        projectId: "",
        type: "employee_halted",
        timestamp: new Date().toISOString(),
        employeeId: this.employeeId,
        details: {
          taskId: event.details.taskId,
          reason: event.details.reason,
          triggeredBy: event.details.triggeredBy,
        },
      })
      throw new Error("HALT_REQUESTED")
    }

    // 2. 处理假期请求事件
    if (event.type === "vacation_requested") {
      // 更新状态为 offline
      await this.stateManager?.updateEmployeeStatus(this.employeeId, "offline")

      // 记录状态变更事件
      await this.stateManager?.addEvent({
        projectId: "",
        type: "employee_status_changed",
        timestamp: new Date().toISOString(),
        employeeId: this.employeeId,
        details: {
          oldStatus: "busy", // or get from stateManager
          newStatus: "offline",
          reason: "vacation_requested",
        },
      })

      // 抛出特定错误以触发 EventLoop 退出
      throw new Error("VACATION_REQUESTED")
    }

    // 2. 如果是消息、agent 或恢复事件，清空快照并恢复正常状态
    if (
      event.type === "message" ||
      event.type === "agent_completed" ||
      event.type === "prompt_recovery"
    ) {
      this.progressTracker.clearProgressTracking()
      // 只有当员工发送消息时才清空回复跟踪
      if (event.type === "message" && event.details.from === this.employeeId) {
        this.replyTracker.clearReplyTracking()
      }
      const employee = await this.stateManager?.getEmployee(this.employeeId)
      if (employee?.status === "abnormal") {
        await this.stateManager?.updateEmployeeStatus(this.employeeId, "busy")
        logger.info(
          `[${this.employeeId}] Recovered from abnormal status due to ${event.type} event`
        )
      }
    }

    // 3. 确保 session 存在
    const session = await this.sessionManager.ensureSession()
    logger.info(`[${this.employeeId}] Handling event in session: ${session.id}`)

    // 4. 更新 activeSessionId
    await this.stateManager?.updateActiveSessionId(this.employeeId, session.id)
    logger.debug(
      `[${this.employeeId}] Set activeSessionId to ${session.id} before calling AI`
    )

    const messageService = (this.messageClient as any).service
    const hasPendingUrgentInterruption =
      typeof messageService?.hasPendingUrgentInterruption === "function" &&
      messageService.hasPendingUrgentInterruption(this.employeeId)
    const isUrgentMessageEvent =
      event.type === "message" && event.details?.urgent === true

    if (hasPendingUrgentInterruption && !isUrgentMessageEvent) {
      logger.info(
        `[${this.employeeId}] Deferring ${event.type} because an urgent message arrived before prompt start`
      )
      await this.stateManager?.updateActiveSessionId(this.employeeId, null)
      return
    }

    if (isUrgentMessageEvent) {
      messageService?.clearPendingUrgentInterruption?.(this.employeeId)
    }

    // 5. 读取当前记忆
    const memory = await this.memoryManager.read(this.employeeId)

    // 6. 构建事件消息
    const eventMessage = buildEventMessage(event)

    // 7. 使用缓存的系统提示词（每次都传递）
    const systemPrompt = session.systemPrompt

    // 8. 记录 session prompt 开始事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_prompt_started",
      timestamp: new Date().toISOString(),
      employeeId: this.employeeId,
      details: {
        sessionId: session.id,
        eventType: event.type,
        messageCount: session.messageCount,
      },
    })

    await this.stateManager?.setPromptRecovery(this.employeeId, {
      version: 1,
      sessionId: session.id,
      startedAt: new Date().toISOString(),
      triggerEventType: event.type,
    })

    // 9. 查询模型配置
    const role = this.roleManager.getRole(this.roleName)
    const modelType = role?.model_type || "default"
    const modelConfig = this.modelConfigManager.resolve(modelType)

    // 10. 发送给 AI
    logger.debug(`[${this.employeeId}] Calling AI (session.prompt)`)
    const promptInput = {
      path: { id: session.id },
      body: {
        agent: "cclover-empty-agent", // 使用空 agent 避免预设提示词污染
        system: systemPrompt,
        parts: [{ type: "text" as const, text: eventMessage }],
        tools: {
          send_message: true,
          edit_tasks: true,
          create_agent: true,
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
        `[${this.employeeId}] session.prompt failed with input: ${JSON.stringify(promptInput, null, 2)}`
      )
      throw error
    }
    logger.debug(`[${this.employeeId}] AI call completed, received result`)

    // 11. 清除 activeSessionId
    await this.stateManager?.updateActiveSessionId(this.employeeId, null)

    // 12. 检查是否被紧急消息中断
    if (result.data?.info.error?.name === "MessageAbortedError") {
      logger.info(
        `[${this.employeeId}] Session aborted by urgent message, continuing to next event`
      )
      return
    }

    await this.stateManager?.clearPromptRecovery(this.employeeId)

    // 12. 更新 session 信息
    this.sessionManager.incrementMessageCount()

    // 13. 记录 session prompt 完成事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_prompt_completed",
      timestamp: new Date().toISOString(),
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

    logger.info(`[${this.employeeId}] Event handled`)
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
