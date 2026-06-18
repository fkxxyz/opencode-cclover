import type { CreateRootTaskInput, RootTask, RootTaskId } from "../types/work"

const ROOT_TASK_MANAGER_UNIMPLEMENTED =
  "RootTaskManager persistence is not implemented"

/**
 * Project-level manager contract for high-level root tasks.
 *
 * Phase 1 freezes the public API only. Persistence and lifecycle behavior are
 * intentionally deferred to Phase 2.
 */
export class RootTaskManager {
  constructor(private readonly projectPath: string) {}

  async createRootTask(_input: CreateRootTaskInput): Promise<RootTask> {
    throw new Error(ROOT_TASK_MANAGER_UNIMPLEMENTED)
  }

  async getRootTask(_rootTaskId: RootTaskId): Promise<RootTask | null> {
    throw new Error(ROOT_TASK_MANAGER_UNIMPLEMENTED)
  }

  async listRootTasks(): Promise<RootTask[]> {
    throw new Error(ROOT_TASK_MANAGER_UNIMPLEMENTED)
  }

  async deleteRootTask(_rootTaskId: RootTaskId): Promise<void> {
    throw new Error(ROOT_TASK_MANAGER_UNIMPLEMENTED)
  }

  getProjectPath(): string {
    return this.projectPath
  }
}
