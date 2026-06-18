import * as fs from "node:fs/promises"
import * as path from "node:path"

/**
 * @deprecated Legacy numeric task group identifier. Use RootTaskId/WorkItemId.
 */
export type LegacyTaskId = number

/**
 * ProjectStateManager 接口（来自 Task 2.1）
 * 用于依赖注入，实际实现由 Task 2.1 提供
 */
export interface ProjectStateManager {
  getNextTaskId(): Promise<LegacyTaskId>
  getCurrentNextTaskId(): Promise<LegacyTaskId>
}

/**
 * 任务管理器
 * 负责任务生命周期管理、目录创建和 TaskId 生成
 */
export class TaskManager {
  private projectRoot: string
  private projectStateManager: ProjectStateManager

  constructor(projectRoot: string, projectStateManager: ProjectStateManager) {
    this.projectRoot = projectRoot
    this.projectStateManager = projectStateManager
  }

  /**
   * 创建新任务（当 Boss 雇佣非灵魂员工时调用）
   * 返回 taskId
   */
  async createTask(): Promise<LegacyTaskId> {
    // 1. 获取下一个 TaskId
    const taskId = await this.projectStateManager.getNextTaskId()

    // 2. 创建任务目录
    const taskPath = this.getTaskPath(taskId)
    await fs.mkdir(taskPath, { recursive: true })

    return taskId
  }

  /**
   * 检查任务目录是否存在
   */
  async taskExists(taskId: LegacyTaskId): Promise<boolean> {
    const taskPath = this.getTaskPath(taskId)
    try {
      const stat = await fs.stat(taskPath)
      return stat.isDirectory()
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return false
      }
      throw error
    }
  }

  /**
   * 列出所有任务目录
   */
  async listTasks(): Promise<LegacyTaskId[]> {
    const tasksDir = path.join(this.projectRoot, ".cclover", "tasks")

    try {
      const entries = await fs.readdir(tasksDir, { withFileTypes: true })
      const taskIds: LegacyTaskId[] = []

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const taskId = parseInt(entry.name, 10)
          if (!isNaN(taskId) && taskId > 0) {
            taskIds.push(taskId)
          }
        }
      }

      return taskIds.sort((a, b) => a - b)
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []
      }
      throw error
    }
  }

  /**
   * 获取任务目录路径
   */
  getTaskPath(taskId: LegacyTaskId): string {
    return path.join(this.projectRoot, ".cclover", "tasks", taskId.toString())
  }
}
