import type { StateManager } from "../state/StateManager"
import type { MemoryManager } from "../core/MemoryManager"
import type { SuccessResponse } from "../types/index"
import type { EmployeeWorkSessionManager } from "../core/EmployeeWorkSessionManager"

/**
 * 获取全局统计数据
 */
export async function getStats(
  stateManager: StateManager,
  _memoryManager: MemoryManager,
  employeeWorkSessionManager?: EmployeeWorkSessionManager
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

    const sessions = employeeWorkSessionManager
      ? await employeeWorkSessionManager.listEmployeeWorkSessions()
      : []
    const activeEmployees = sessions.filter(
      (session) => session.status === "busy"
    ).length

    // 计算待处理任务数
    let pendingTasks = 0
    for (const session of sessions) {
      const memory = await _memoryManager.read(session.employeeWorkSessionId)
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
