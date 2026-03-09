import type { StateManager } from "../state/StateManager"
import type { TimelineItem } from "../types/index"

/**
 * 获取员工的时间线（消息 + 事件混合）
 */
export async function getTimeline(
  employeeName: string,
  messageService: any,
  stateManager: StateManager,
  limit: number = 50,
  before?: string
): Promise<{ success: true; data: { timeline: TimelineItem[] } }> {
  if (!employeeName) {
    throw new Error("INVALID_PARAMETER: employeeName is required")
  }

  if (!messageService) {
    throw new Error("INTERNAL_ERROR: messageService not initialized")
  }

  if (!stateManager) {
    throw new Error("INTERNAL_ERROR: stateManager not initialized")
  }

  // 获取 EventLogger
  const eventLogger = stateManager.getEventLogger()

  // 获取时间线
  const timeline = await eventLogger.getTimeline(
    employeeName,
    messageService,
    limit,
    before
  )

  return {
    success: true,
    data: { timeline },
  }
}
