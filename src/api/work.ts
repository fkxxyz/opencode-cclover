import type { RootTaskManager } from "../core/RootTaskManager"
import type { WorkItemManager } from "../core/WorkItemManager"
import type {
  RootTask,
  SuccessResponse,
  WorkItem,
  WorkItemFilters,
} from "../types/index"

/**
 * 获取项目级 root tasks。
 */
export async function getRootTasks(
  rootTaskManager: RootTaskManager
): Promise<SuccessResponse<{ rootTasks: RootTask[] }>> {
  const rootTasks = await rootTaskManager.listRootTasks()
  return {
    success: true,
    data: { rootTasks },
  }
}

/**
 * 获取项目级 work items。
 */
export async function getWorkItems(
  workItemManager: WorkItemManager,
  filters?: WorkItemFilters
): Promise<SuccessResponse<{ workItems: WorkItem[] }>> {
  const workItems = await workItemManager.listWorkItems(filters)
  return {
    success: true,
    data: { workItems },
  }
}
