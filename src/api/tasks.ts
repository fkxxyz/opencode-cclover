import type { MemoryManager } from "../core/MemoryManager"
import type { MessageService } from "../core/MessageService"
import { haltRegistry } from "../utils/HaltRegistry"
import type {
  TasksResponse,
  SuccessResponse,
  ErrorResponse,
  EmployeeWorkSessionId,
} from "../types/index"
import type { EmployeeWorkSessionManager } from "../core/EmployeeWorkSessionManager"

/**
 * 获取员工的任务列表
 */
export async function getTasks(
  employeeWorkSessionId: string,
  memoryManager: MemoryManager
): Promise<SuccessResponse<TasksResponse> | ErrorResponse> {
  try {
    // 验证参数
    if (!employeeWorkSessionId || employeeWorkSessionId.trim() === "") {
      return {
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "员工工作会话ID不能为空",
        },
      }
    }

    // 读取员工记忆
    const memory = await memoryManager.read(
      employeeWorkSessionId as EmployeeWorkSessionId
    )

    // 获取可执行的任务
    const executableTasks = await memoryManager.getExecutableTasks(
      employeeWorkSessionId as EmployeeWorkSessionId
    )
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
  employeeWorkSessionId: string,
  employeeWorkSessionManager: EmployeeWorkSessionManager,
  reason?: string,
  triggeredBy?: string,
  messageService?: Pick<MessageService, "abortActiveSession">
): Promise<
  | SuccessResponse<{ employeeWorkSessionId: string; halted: true }>
  | ErrorResponse
> {
  if (
    typeof employeeWorkSessionId !== "string" ||
    employeeWorkSessionId.trim() === ""
  ) {
    return {
      success: false,
      error: {
        code: "INVALID_EMPLOYEE_WORK_SESSION_ID",
        message: "employeeWorkSessionId / 员工工作会话 ID 不能为空",
      },
    }
  }

  const session = await employeeWorkSessionManager.getEmployeeWorkSession(
    employeeWorkSessionId as EmployeeWorkSessionId
  )
  if (!session) {
    return {
      success: false,
      error: {
        code: "EMPLOYEE_WORK_SESSION_NOT_FOUND",
        message: `Employee work session '${employeeWorkSessionId}' not found`,
      },
    }
  }

  await messageService?.abortActiveSession(session.employeeWorkSessionId)

  haltRegistry.addHaltEvent(session.employeeWorkSessionId, {
    type: "halt_requested",
    employeeWorkSessionId: session.employeeWorkSessionId,
    timestamp: new Date().toISOString(),
    reason,
    triggeredBy,
  })

  await employeeWorkSessionManager.updateStatus(
    session.employeeWorkSessionId,
    "abnormal"
  )

  return {
    success: true,
    data: {
      employeeWorkSessionId: session.employeeWorkSessionId,
      halted: true,
    },
  }
}
