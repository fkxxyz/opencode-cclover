import * as fs from "fs/promises"
import * as path from "path"
import * as lockfile from "proper-lockfile"
import * as yaml from "yaml"
import type { StateManager } from "../state"
import type { CreateRootTaskInput, RootTask, RootTaskId } from "../types/work"
import type { WorkItemManager } from "./WorkItemManager"

interface RootTaskStore {
  rootTasks: RootTask[]
}

/**
 * Project-level manager contract for high-level root tasks.
 */
export class RootTaskManager {
  constructor(
    private readonly projectPath: string,
    private readonly stateManager?: StateManager,
    private readonly workItemManager?: WorkItemManager
  ) {}

  async createRootTask(input: CreateRootTaskInput): Promise<RootTask> {
    const rootTask: RootTask = {
      rootTaskId: this.createRootTaskId(),
      summary: input.summary,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    }

    await this.updateStore((store) => {
      store.rootTasks.push(rootTask)
      return store
    })

    await this.stateManager?.addEvent({
      projectId: this.getProjectId(),
      type: "root_task_created",
      timestamp: rootTask.createdAt,
      employeeId: input.createdBy,
      rootTaskId: rootTask.rootTaskId,
      details: {
        rootTaskId: rootTask.rootTaskId,
        summary: rootTask.summary,
        createdBy: rootTask.createdBy,
        createdAt: rootTask.createdAt,
      },
    })

    return rootTask
  }

  async getRootTask(rootTaskId: RootTaskId): Promise<RootTask | null> {
    const store = await this.readStore()
    return (
      store.rootTasks.find((task) => task.rootTaskId === rootTaskId) ?? null
    )
  }

  async listRootTasks(): Promise<RootTask[]> {
    const store = await this.readStore()
    return [...store.rootTasks]
  }

  async deleteRootTask(rootTaskId: RootTaskId): Promise<void> {
    const referencingWorkItems =
      (await this.workItemManager?.listWorkItems({ rootTaskId })) ?? []

    if (referencingWorkItems.length > 0) {
      throw new Error(
        `Cannot delete root task "${rootTaskId}" because work items reference it`
      )
    }

    let deletedRootTask: RootTask | undefined
    await this.updateStore((store) => {
      deletedRootTask = store.rootTasks.find(
        (task) => task.rootTaskId === rootTaskId
      )

      if (!deletedRootTask) {
        throw new Error(`Root task "${rootTaskId}" does not exist`)
      }

      return {
        rootTasks: store.rootTasks.filter(
          (task) => task.rootTaskId !== rootTaskId
        ),
      }
    })

    await this.stateManager?.addEvent({
      projectId: this.getProjectId(),
      type: "root_task_deleted",
      timestamp: new Date().toISOString(),
      employeeId: deletedRootTask?.createdBy,
      rootTaskId,
      details: {
        rootTaskId,
        deletedBy: deletedRootTask?.createdBy,
      },
    })
  }

  getProjectPath(): string {
    return this.projectPath
  }

  private getProjectId(): string {
    return this.stateManager?.getProjectId() ?? "default"
  }

  private getStorePath(): string {
    return path.join(this.projectPath, ".cclover", "root-tasks.yaml")
  }

  private async ensureStoreFile(storePath: string): Promise<void> {
    await fs.mkdir(path.dirname(storePath), { recursive: true })

    try {
      await fs.access(storePath)
    } catch (error: any) {
      if (error.code === "ENOENT") {
        await fs.writeFile(
          storePath,
          yaml.stringify({ rootTasks: [] }),
          "utf-8"
        )
        return
      }

      throw error
    }
  }

  private async readStore(): Promise<RootTaskStore> {
    try {
      const content = await fs.readFile(this.getStorePath(), "utf-8")
      const data = yaml.parse(content) as Partial<RootTaskStore> | null

      return {
        rootTasks: data?.rootTasks ?? [],
      }
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return { rootTasks: [] }
      }

      throw error
    }
  }

  private async updateStore(
    update: (store: RootTaskStore) => RootTaskStore
  ): Promise<void> {
    const storePath = this.getStorePath()
    await this.ensureStoreFile(storePath)

    let release: (() => Promise<void>) | undefined

    try {
      release = await lockfile.lock(storePath, {
        retries: {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 1000,
        },
        stale: 5000,
      })

      const store = await this.readStore()
      const updatedStore = update(store)
      await fs.writeFile(storePath, yaml.stringify(updatedStore), "utf-8")
    } finally {
      if (release) {
        await release()
      }
    }
  }

  private createRootTaskId(): RootTaskId {
    return `rt_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 10)}`
  }
}
