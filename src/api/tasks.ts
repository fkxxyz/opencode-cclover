import type { MemoryManager } from "../core/MemoryManager"
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
