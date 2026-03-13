import type { StateManager } from "../state/StateManager"
import type { MemoryManager } from "../core/MemoryManager"
import type { SuccessResponse } from "../types/index"

/**
 * 获取全局统计数据
 */
export async function getStats(
  stateManager: StateManager,
  memoryManager: MemoryManager
): Promise<
  SuccessResponse<{
    totalEmployees: number
    activeEmployees: number
    pendingTasks: number
    todayMessages: number
  }>
> {
  try {
    const employees = stateManager.getEmployees()

    // 计算活跃员工数
    const activeEmployees = employees.filter((e) => e.status === "busy").length

    // 计算待处理任务数
    let pendingTasks = 0
    for (const employee of employees) {
      const memory = await memoryManager.read(employee.employeeId)
      const employeePendingTasks = memory.tasks.filter(
        (t) => t.status === "pending" || t.status === "in_progress"
      ).length
      pendingTasks += employeePendingTasks
    }

    // 计算今日消息数
    const now = new Date()
    const todayStart = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
    const events = stateManager.getEvents({ limit: 10000 })
    const todayMessages = events.filter((e) => {
      const eventTime = new Date(e.timestamp)
      return e.type === "message" && eventTime >= todayStart
    }).length

    return {
      success: true,
      data: {
        totalEmployees: employees.length,
        activeEmployees,
        pendingTasks,
        todayMessages,
      },
    }
  } catch (error: any) {
    return {
      success: true,
      data: {
        totalEmployees: 0,
        activeEmployees: 0,
        pendingTasks: 0,
        todayMessages: 0,
      },
    }
  }
}
