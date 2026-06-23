import type { MessageService } from "../MessageService"
import type { MemoryManager, Task } from "../MemoryManager"
import type { StateManager } from "../../state/StateManager"
import type { BossId, EmployeeWorkSessionId, Event } from "../../types"
import type { EmployeeWorkSessionManager } from "../EmployeeWorkSessionManager"
import { logger } from "../../lib/logger"

/**
 * 回复快照
 * 用于检测员工是否在回复提醒事件中无限循环
 */
export interface ReplySnapshot {
  unrepliedCount: number
  tasksHash: string
}

/**
 * 回复追踪器
 * 负责检测未回复的 expect_reply=true 消息，并实现三次提醒机制
 */
export class ReplyTracker {
  private replySnapshot: ReplySnapshot | null = null
  private noProgressCount = 0
  private readonly NO_PROGRESS_THRESHOLD = 3 // 无进展阈值

  constructor(
    private employeeWorkSessionId: EmployeeWorkSessionId,
    private messageService: MessageService,
    private memoryManager: MemoryManager,
    private employeeWorkSessionManager: EmployeeWorkSessionManager,
    private stateManager?: StateManager
  ) {}

  /**
   * 检查是否有未回复的 expect_reply=true 消息
   * @returns 未回复消息的发送者列表
   */
  async getUnrepliedSenders(): Promise<string[]> {
    // 1. 获取所有对话对象
    const peers = await this.messageService.getPeers(this.employeeWorkSessionId)

    const unrepliedSenders: string[] = []

    // 2. 遍历每个对话对象，检查是否有未回复的 expect_reply=true 消息
    for (const peer of peers) {
      const hasUnreplied = await this.hasUnrepliedMessage(
        peer as EmployeeWorkSessionId | BossId
      )
      if (hasUnreplied) {
        unrepliedSenders.push(peer)
      }
    }

    return unrepliedSenders
  }

  /**
   * 检查与特定对话对象是否有未回复的 expect_reply=true 消息
   */
  private async hasUnrepliedMessage(
    peer: EmployeeWorkSessionId | BossId
  ): Promise<boolean> {
    // 1. 获取与该对话对象的消息历史
    const client = this.messageService.getClient(this.employeeWorkSessionId)
    const messages = await client.history(peer)
    const replyAttemptEvents = await this.getReplyAttemptEvents()

    // 2. 遍历消息，找到所有 expect_reply=true 的消息，检查是否有后续回复
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]

      // 只关注对方发送的 expect_reply=true 消息
      if (msg.from === peer && msg.expect_reply === true) {
        // 检查后续是否有我发送给对方的消息
        let hasReply = false
        for (let j = i + 1; j < messages.length; j++) {
          if (
            messages[j].from === this.employeeWorkSessionId &&
            messages[j].to === peer
          ) {
            hasReply = true
            break
          }
        }

        const hasReplyAttempt = replyAttemptEvents.some(
          (event) =>
            event.details.to === peer &&
            typeof event.timestamp === "string" &&
            event.timestamp > msg.timestamp
        )

        // 如果没有回复，说明有未回复的消息
        if (!hasReply && !hasReplyAttempt) {
          return true
        }
      }
    }

    // 所有 expect_reply=true 的消息都已回复
    return false
  }

  private async getReplyAttemptEvents(): Promise<Event[]> {
    if (!this.stateManager) {
      return []
    }

    const events = await this.stateManager
      .getEventLogger()
      .getEvents(this.employeeWorkSessionId, 200)

    return events.filter((event) => event.type === "reply_attempted")
  }

  /**
   * 检查进展
   */
  async checkProgress(): Promise<void> {
    // 1. 获取当前快照
    const currentSnapshot = await this.getCurrentSnapshot()

    // 2. 如果没有历史快照，记录当前快照
    if (!this.replySnapshot) {
      this.replySnapshot = currentSnapshot
      this.noProgressCount = 1
      logger.info(
        `[${this.employeeWorkSessionId}] First reply_reminder event, recording snapshot (count: 1)`
      )
      return
    }

    // 3. 比较快照
    const hasProgress =
      currentSnapshot.unrepliedCount !== this.replySnapshot.unrepliedCount ||
      currentSnapshot.tasksHash !== this.replySnapshot.tasksHash

    if (hasProgress) {
      // 有进展，重置计数器
      this.replySnapshot = currentSnapshot
      this.noProgressCount = 1
      logger.info(
        `[${this.employeeWorkSessionId}] Progress detected, resetting counter`
      )
    } else {
      // 无进展，增加计数器
      this.noProgressCount++
      logger.info(
        `[${this.employeeWorkSessionId}] No progress detected (count: ${this.noProgressCount})`
      )

      // 4. 检查是否达到阈值
      if (this.noProgressCount >= this.NO_PROGRESS_THRESHOLD) {
        await this.markAsAbnormal()
      }
    }
  }

  /**
   * 获取当前快照
   */
  async getCurrentSnapshot(): Promise<ReplySnapshot> {
    // 1. 获取未回复消息数量
    const unrepliedSenders = await this.getUnrepliedSenders()
    const unrepliedCount = unrepliedSenders.length

    // 2. 获取任务列表并计算哈希
    const memory = await this.memoryManager.read(this.employeeWorkSessionId)
    const tasksHash = this.hashTasks(memory.tasks)

    return { unrepliedCount, tasksHash }
  }

  /**
   * 清空回复追踪
   */
  clearReplyTracking(): void {
    this.replySnapshot = null
    this.noProgressCount = 0
  }

  /**
   * 标记为异常
   */
  async markAsAbnormal(): Promise<void> {
    logger.warn(
      `[${this.employeeWorkSessionId}] No progress for ${this.NO_PROGRESS_THRESHOLD} times, marking as abnormal`
    )

    // 1. 更新状态
    await this.employeeWorkSessionManager.updateStatus(
      this.employeeWorkSessionId,
      "abnormal"
    )

    // 2. 记录事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "employee_work_session_status_changed",
      timestamp: new Date().toISOString(),
      employeeWorkSessionId: this.employeeWorkSessionId,
      details: {
        oldStatus: "busy",
        newStatus: "abnormal",
        reason: "no_progress_in_reply_reminder_events",
        noProgressCount: this.noProgressCount,
      },
    })

    logger.warn(
      `[${this.employeeWorkSessionId}] Marked as abnormal. EWS will no longer receive reply_reminder events until status is manually changed.`
    )
  }

  /**
   * 计算任务哈希
   */
  hashTasks(tasks: Task[]): string {
    // 序列化任务列表（只包含关键字段）
    const serialized = tasks
      .map((t) => `${t.name}:${t.status}:${t.dependencies.join(",")}`)
      .sort()
      .join("|")

    // 简单哈希（使用字符串长度 + 前10字符 + 后10字符）
    // 对于我们的用途足够了，不需要复杂的哈希算法
    return `${serialized.length}-${serialized.slice(0, 10)}-${serialized.slice(-10)}`
  }
}
