import type { MemoryManager, Task } from "../MemoryManager"
import type { StateManager } from "../../state/StateManager"
import type { EmployeeId } from "../../types"
import { agentRegistry } from "../../utils/AgentRegistry"
import { logger } from "../../lib/logger"
import * as crypto from "node:crypto"

/**
 * 进展快照
 * 用于检测员工是否在任务事件中无限循环
 */
export interface ProgressSnapshot {
  agentCount: number
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
    private employeeId: EmployeeId,
    private memoryManager: MemoryManager,
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
        `[${this.employeeId}] First task event, recording snapshot (count: 1)`
      )
      return
    }

    // 3. 比较快照
    const hasProgress =
      currentSnapshot.agentCount !== this.progressSnapshot.agentCount ||
      currentSnapshot.tasksHash !== this.progressSnapshot.tasksHash

    if (hasProgress) {
      // 有进展，重置计数器
      this.progressSnapshot = currentSnapshot
      this.noProgressCount = 1
      logger.info(`[${this.employeeId}] Progress detected, resetting counter`)
    } else {
      // 无进展，增加计数器
      this.noProgressCount++
      logger.info(
        `[${this.employeeId}] No progress detected (count: ${this.noProgressCount})`
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
    // 1. 获取 agent 数量
    const runningAgents = agentRegistry.getAgentsByEmployee(this.employeeId)
    const agentCount = runningAgents.length

    // 2. 获取任务列表并计算哈希
    const memory = await this.memoryManager.read(this.employeeId)
    const tasksHash = this.hashTasks(memory.tasks)

    return { agentCount, tasksHash }
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
      `[${this.employeeId}] No progress for ${this.NO_PROGRESS_THRESHOLD} times, marking as abnormal`
    )

    // 1. 更新状态
    await this.stateManager?.updateEmployeeStatus(this.employeeId, "abnormal")

    // 2. 记录事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "employee_status_changed",
      timestamp: new Date().toISOString(),
      employeeId: this.employeeId,
      details: {
        oldStatus: "busy",
        newStatus: "abnormal",
        reason: "no_progress_in_task_events",
        noProgressCount: this.noProgressCount,
      },
    })

    logger.warn(
      `[${this.employeeId}] Marked as abnormal. Employee will no longer receive task events until status is manually changed.`
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
