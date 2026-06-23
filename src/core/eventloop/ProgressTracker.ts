import type { MemoryManager, Task } from "../MemoryManager"
import type { StateManager } from "../../state/StateManager"
import type { EmployeeWorkSessionId } from "../../types"
import type { EmployeeWorkSessionManager } from "../EmployeeWorkSessionManager"
import { logger } from "../../lib/logger"
import * as crypto from "node:crypto"

/**
 * 进展快照
 * 用于检测员工是否在任务事件中无限循环
 */
export interface ProgressSnapshot {
  tasksHash: string
}

/**
 * 进展追踪器
 * 负责检测员工是否在任务事件中无限循环
 */
export class ProgressTracker {
  private progressSnapshot: ProgressSnapshot | null = null
  private noProgressCount = 0
  private readonly NO_PROGRESS_THRESHOLD = 3 // 无进展阈值

  constructor(
    private employeeWorkSessionId: EmployeeWorkSessionId,
    private memoryManager: MemoryManager,
    private employeeWorkSessionManager: EmployeeWorkSessionManager,
    private stateManager?: StateManager
  ) {}

  /**
   * 检查进展
   */
  async checkProgress(): Promise<void> {
    // 1. 获取当前快照
    const currentSnapshot = await this.getCurrentSnapshot()

    // 2. 如果没有历史快照，记录当前快照
    if (!this.progressSnapshot) {
      this.progressSnapshot = currentSnapshot
      this.noProgressCount = 1
      logger.info(
        `[${this.employeeWorkSessionId}] First task event, recording snapshot (count: 1)`
      )
      return
    }

    // 3. 比较快照
    const hasProgress =
      currentSnapshot.tasksHash !== this.progressSnapshot.tasksHash

    if (hasProgress) {
      // 有进展，重置计数器
      this.progressSnapshot = currentSnapshot
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
  async getCurrentSnapshot(): Promise<ProgressSnapshot> {
    const memory = await this.memoryManager.read(this.employeeWorkSessionId)
    const tasksHash = this.hashTasks(memory.tasks)

    return { tasksHash }
  }

  /**
   * 清空进展追踪
   */
  clearProgressTracking(): void {
    this.progressSnapshot = null
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
        reason: "no_progress_in_task_events",
        noProgressCount: this.noProgressCount,
      },
    })

    logger.warn(
      `[${this.employeeWorkSessionId}] Marked as abnormal. EWS will no longer receive task events until status is manually changed.`
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

    // 简单哈希（使用字符串长度 + 首尾字符）
    // 对于我们的用途足够了，不需要复杂的哈希算法
    return `${serialized.length}-${serialized.slice(0, 10)}-${serialized.slice(-10)}`
  }
}
