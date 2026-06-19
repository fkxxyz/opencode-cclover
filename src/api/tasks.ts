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
  employeeId: string,
  memoryManager: MemoryManager
): Promise<SuccessResponse<TasksResponse> | ErrorResponse> {
  try {
    // 验证参数
    if (!employeeId || employeeId.trim() === "") {
      return {
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "员工ID不能为空",
        },
      }
    }

    // 读取员工记忆
    const memory = await memoryManager.read(employeeId)

    // 获取可执行的任务
    const executableTasks = await memoryManager.getExecutableTasks(employeeId)
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
  employeeId: string,
  stateManager: StateManager,
  reason?: string,
  triggeredBy?: string,
  messageService?: Pick<MessageService, "abortActiveSession">
): Promise<
  SuccessResponse<{ employeeId: string; halted: true }> | ErrorResponse
> {
  if (typeof employeeId !== "string" || employeeId.trim() === "") {
    return {
      success: false,
      error: {
        code: "INVALID_EMPLOYEE_ID",
        message: "employeeId 不能为空",
      },
    }
  }

  const employee = stateManager.getEmployee(employeeId)
  if (!employee) {
    return {
      success: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: `Employee '${employeeId}' not found`,
      },
    }
  }

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

  return {
    success: true,
    data: {
      employeeId: employee.employeeId,
      halted: true,
    },
  }
}
