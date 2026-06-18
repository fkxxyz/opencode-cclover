import type { StateManager } from "../state"
import type {
  CreateWorkItemInput,
  UpdateWorkItemInput,
  WorkItem,
  WorkItemFilters,
  WorkItemId,
} from "../types/work"

const WORK_ITEM_MANAGER_UNIMPLEMENTED =
  "WorkItemManager persistence is not implemented"

/**
 * Project-level manager contract for assigned work packages.
 *
 * Phase 1 freezes the public API only. Storage, employee existence checks,
 * parent validation, and dependency DAG validation are deferred to Phase 2.
 */
export class WorkItemManager {
  constructor(
    private readonly projectPath: string,
    private readonly stateManager: StateManager
  ) {}

  async createWorkItem(_input: CreateWorkItemInput): Promise<WorkItem> {
    throw new Error(WORK_ITEM_MANAGER_UNIMPLEMENTED)
  }

  async updateWorkItem(
    _workItemId: WorkItemId,
    _updates: UpdateWorkItemInput
  ): Promise<WorkItem> {
    throw new Error(WORK_ITEM_MANAGER_UNIMPLEMENTED)
  }

  async deleteWorkItem(_workItemId: WorkItemId): Promise<void> {
    throw new Error(WORK_ITEM_MANAGER_UNIMPLEMENTED)
  }

  async getWorkItem(_workItemId: WorkItemId): Promise<WorkItem | null> {
    throw new Error(WORK_ITEM_MANAGER_UNIMPLEMENTED)
  }

  async listWorkItems(_filters?: WorkItemFilters): Promise<WorkItem[]> {
    throw new Error(WORK_ITEM_MANAGER_UNIMPLEMENTED)
  }

  async validateDependencies(
    _workItemId: WorkItemId | null,
    _dependsOn: WorkItemId[]
  ): Promise<void> {
    throw new Error(WORK_ITEM_MANAGER_UNIMPLEMENTED)
  }

  getProjectPath(): string {
    return this.projectPath
  }

  getStateManager(): StateManager {
    return this.stateManager
  }
}
