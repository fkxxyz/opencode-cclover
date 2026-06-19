import type { StateManager } from "../state/StateManager"
import type {
  Event,
  EventType,
  SuccessResponse,
  ErrorResponse,
} from "../types/index"

/**
 * 获取事件历史
 */
export function getEvents(
  options: {
    limit?: number
    employeeId?: string
    rootTaskId?: string
    workItemId?: string
    type?: EventType
  },
  stateManager: StateManager
): SuccessResponse<{ events: Event[] }> {
  try {
    // 验证参数
    const limit = options?.limit || 50
    if (limit < 1 || limit > 200) {
      return {
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "limit 必须在 1-200 之间",
        },
      } as any
    }

    // 获取事件
    const events = stateManager.getEvents({
      limit,
      employeeId: options?.employeeId,
      rootTaskId: options?.rootTaskId,
      workItemId: options?.workItemId,
      type: options?.type,
    })

    return {
      success: true,
      data: {
        events,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: `获取事件失败: ${error.message}`,
      },
    } as any
  }
}
