import type { MemoryManager } from "../core/MemoryManager"
import type { MessageService } from "../core/MessageService"
import type { StateManager } from "../state/StateManager"
import { haltRegistry } from "../utils/HaltRegistry"
import type {
  TasksResponse,
  SuccessResponse,
  ErrorResponse,
} from "../types/index"

/**
 * 获取员工的任务列表
 */
export async function getTasks(
  employeeName: string,
  memoryManager: MemoryManager
): Promise<SuccessResponse<TasksResponse> | ErrorResponse> {
  try {
    // 验证参数
    if (!employeeName || employeeName.trim() === "") {
      return {
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "员工名称不能为空",
        },
      }
    }

    // 读取员工记忆
    const memory = await memoryManager.read(employeeName)

    // 获取可执行的任务
    const executableTasks = await memoryManager.getExecutableTasks(employeeName)
    const executableTaskNames = executableTasks.map((t) => t.name)

    return {
      success: true,
      data: {
        tasks: memory.tasks,
        executableTasks: executableTaskNames,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: "FILE_READ_ERROR",
        message: `读取任务失败: ${error.message}`,
      },
    }
  }
}

export async function haltTask(
  taskId: number,
  stateManager: StateManager,
  reason?: string,
  triggeredBy?: string,
  messageService?: Pick<MessageService, "abortActiveSession">
): Promise<
  | SuccessResponse<{ taskId: number; employeeIds: string[]; count: number }>
  | ErrorResponse
> {
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return {
      success: false,
      error: {
        code: "INVALID_TASK_ID",
        message: "taskId 必须是大于 0 的整数",
      },
    }
  }

  // 旧 haltTask API 暂时仍保留入参校验，但 taskId 分组不再是 StateManager 契约。
  const employees: ReturnType<StateManager["getEmployees"]> = []
  if (employees.length === 0) {
    return {
      success: false,
      error: {
        code: "TASK_NOT_FOUND",
        message: `Task '${taskId}' not found`,
      },
    }
  }

  const employeeIds = employees.map((employee) => employee.employeeId)

  await stateManager.addEvent({
    projectId: stateManager.getProjectId(),
    type: "task_halt_requested",
    timestamp: new Date().toISOString(),
    details: {
      taskId,
      employeeIds,
      reason,
      triggeredBy,
    },
  })

  for (const employee of employees) {
    await messageService?.abortActiveSession(employee.employeeId)

    haltRegistry.addHaltEvent(employee.employeeId, {
      type: "halt_requested",
      employeeId: employee.employeeId,
      timestamp: new Date().toISOString(),
      reason,
      triggeredBy,
    })

    await stateManager.forcePauseEmployeeForHalt(employee.employeeId, {
      reason,
      triggeredBy,
    })
  }

  return {
    success: true,
    data: {
      taskId,
      employeeIds,
      count: employeeIds.length,
    },
  }
}
