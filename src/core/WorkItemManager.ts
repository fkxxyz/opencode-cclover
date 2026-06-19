import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as lockfile from "proper-lockfile"
import * as yaml from "yaml"
import type { StateManager } from "../state"
import type {
  CreateWorkItemInput,
  RootTask,
  UpdateWorkItemInput,
  WorkItem,
  WorkItemFilters,
  WorkItemId,
} from "../types/work"
import type { Event } from "../types/index"

interface WorkItemsFile {
  workItems: WorkItem[]
}

interface RootTasksFile {
  rootTasks: RootTask[]
}

/**
 * Project-level manager contract for assigned work packages.
 *
 * Phase 2 stores work items in project-local YAML and validates assignment DAGs.
 */
export class WorkItemManager {
  private readonly filePath: string
  private readonly rootTasksPath: string

  constructor(
    private readonly projectPath: string,
    private readonly stateManager: StateManager
  ) {
    this.filePath = path.join(projectPath, ".cclover", "work-items.yaml")
    this.rootTasksPath = path.join(projectPath, ".cclover", "root-tasks.yaml")
  }

  async createWorkItem(input: CreateWorkItemInput): Promise<WorkItem> {
    await this.ensureRootTaskExists(input.rootTaskId)
    this.ensureEmployeeExists(input.employeeId)

    const workItems = await this.loadWorkItems()
    const parentWorkItemId = input.parentWorkItemId ?? null
    const dependsOn = input.dependsOn ?? []

    this.validateParent(input.rootTaskId, null, parentWorkItemId, workItems)
    await this.validateDependenciesWithItems(null, dependsOn, workItems)

    const now = new Date().toISOString()
    const workItem: WorkItem = {
      workItemId: this.createWorkItemId(),
      rootTaskId: input.rootTaskId,
      parentWorkItemId,
      employeeId: input.employeeId,
      description: input.description,
      dependsOn,
      worktreeRef: input.worktreeRef ?? null,
      createdAt: now,
      updatedAt: now,
    }

    await this.saveWorkItems([...workItems, workItem])
    await this.addLifecycleEvent("work_item_created", workItem, {
      workItem,
    })
    return workItem
  }

  async updateWorkItem(
    workItemId: WorkItemId,
    updates: UpdateWorkItemInput
  ): Promise<WorkItem> {
    const workItems = await this.loadWorkItems()
    const index = workItems.findIndex((item) => item.workItemId === workItemId)
    if (index === -1) {
      throw new Error(`Work item '${workItemId}' does not exist`)
    }

    const existing = workItems[index]
    const parentWorkItemId = Object.hasOwn(updates, "parentWorkItemId")
      ? (updates.parentWorkItemId ?? null)
      : existing.parentWorkItemId
    const dependsOn = updates.dependsOn ?? existing.dependsOn

    this.validateParent(
      existing.rootTaskId,
      workItemId,
      parentWorkItemId,
      workItems
    )
    await this.validateDependenciesWithItems(workItemId, dependsOn, workItems)

    const updated: WorkItem = {
      ...existing,
      description: updates.description ?? existing.description,
      parentWorkItemId,
      dependsOn,
      worktreeRef: Object.hasOwn(updates, "worktreeRef")
        ? (updates.worktreeRef ?? null)
        : existing.worktreeRef,
      updatedAt: new Date().toISOString(),
    }

    const nextWorkItems = [...workItems]
    nextWorkItems[index] = updated
    await this.saveWorkItems(nextWorkItems)
    await this.addLifecycleEvent("work_item_updated", updated, {
      workItem: updated,
      changes: this.eventChanges(updates),
    })
    return updated
  }

  async deleteWorkItem(workItemId: WorkItemId): Promise<void> {
    const workItems = await this.loadWorkItems()
    const workItem = workItems.find((item) => item.workItemId === workItemId)
    if (!workItem) {
      throw new Error(`Work item '${workItemId}' does not exist`)
    }
    if (workItems.some((item) => item.parentWorkItemId === workItemId)) {
      throw new Error(`Work item '${workItemId}' has child work items`)
    }
    if (workItems.some((item) => item.dependsOn.includes(workItemId))) {
      throw new Error(
        `Work item '${workItemId}' is depended on by other work items`
      )
    }

    await this.saveWorkItems(
      workItems.filter((item) => item.workItemId !== workItemId)
    )
    await this.addLifecycleEvent("work_item_deleted", workItem, {
      workItem,
    })
  }

  async getWorkItem(workItemId: WorkItemId): Promise<WorkItem | null> {
    const workItems = await this.loadWorkItems()
    return workItems.find((item) => item.workItemId === workItemId) ?? null
  }

  async listWorkItems(filters?: WorkItemFilters): Promise<WorkItem[]> {
    const workItems = await this.loadWorkItems()
    if (!filters) {
      return workItems
    }

    return workItems
      .filter(
        (item) => !filters.rootTaskId || item.rootTaskId === filters.rootTaskId
      )
      .filter(
        (item) => !filters.employeeId || item.employeeId === filters.employeeId
      )
      .filter(
        (item) =>
          !Object.hasOwn(filters, "parentWorkItemId") ||
          item.parentWorkItemId === filters.parentWorkItemId
      )
      .filter(
        (item) =>
          !filters.dependsOn || item.dependsOn.includes(filters.dependsOn)
      )
  }

  async validateDependencies(
    workItemId: WorkItemId | null,
    dependsOn: WorkItemId[]
  ): Promise<void> {
    const workItems = await this.loadWorkItems()
    await this.validateDependenciesWithItems(workItemId, dependsOn, workItems)
  }

  getProjectPath(): string {
    return this.projectPath
  }

  getStateManager(): StateManager {
    return this.stateManager
  }

  private async loadWorkItems(): Promise<WorkItem[]> {
    try {
      const content = await fs.readFile(this.filePath, "utf-8")
      const data = yaml.parse(content) as WorkItemsFile | null
      return Array.isArray(data?.workItems) ? data.workItems : []
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []
      }
      throw error
    }
  }

  private async saveWorkItems(workItems: WorkItem[]): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      await fs.access(this.filePath)
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error
      }
      await fs.writeFile(
        this.filePath,
        yaml.stringify({ workItems: [] } satisfies WorkItemsFile),
        "utf-8"
      )
    }

    let release: (() => Promise<void>) | undefined
    try {
      release = await lockfile.lock(this.filePath, {
        retries: {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 1000,
        },
        stale: 5000,
      })
      await fs.writeFile(
        this.filePath,
        yaml.stringify({ workItems } satisfies WorkItemsFile),
        "utf-8"
      )
    } finally {
      if (release) {
        await release()
      }
    }
  }

  private async loadRootTasks(): Promise<RootTask[]> {
    try {
      const content = await fs.readFile(this.rootTasksPath, "utf-8")
      const data = yaml.parse(content) as RootTasksFile | null
      return Array.isArray(data?.rootTasks) ? data.rootTasks : []
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []
      }
      throw error
    }
  }

  private async ensureRootTaskExists(rootTaskId: string): Promise<void> {
    const rootTasks = await this.loadRootTasks()
    if (!rootTasks.some((rootTask) => rootTask.rootTaskId === rootTaskId)) {
      throw new Error(`Root task '${rootTaskId}' does not exist`)
    }
  }

  private ensureEmployeeExists(employeeId: string): void {
    if (!this.stateManager.getEmployee(employeeId)) {
      throw new Error(`Employee '${employeeId}' does not exist`)
    }
  }

  private validateParent(
    rootTaskId: string,
    workItemId: WorkItemId | null,
    parentWorkItemId: WorkItemId | null,
    workItems: WorkItem[]
  ): void {
    if (!parentWorkItemId) {
      return
    }
    if (workItemId && parentWorkItemId === workItemId) {
      throw new Error(`Work item '${workItemId}' cannot be its own parent`)
    }

    const parent = workItems.find(
      (item) => item.workItemId === parentWorkItemId
    )
    if (!parent) {
      throw new Error(`Parent work item '${parentWorkItemId}' does not exist`)
    }
    if (parent.rootTaskId !== rootTaskId) {
      throw new Error(
        `Parent work item '${parentWorkItemId}' must belong to the same root task`
      )
    }
  }

  private async validateDependenciesWithItems(
    workItemId: WorkItemId | null,
    dependsOn: WorkItemId[],
    workItems: WorkItem[]
  ): Promise<void> {
    for (const dependencyId of dependsOn) {
      if (workItemId && dependencyId === workItemId) {
        throw new Error(`Work item '${workItemId}' cannot depend on itself`)
      }
      if (!workItems.some((item) => item.workItemId === dependencyId)) {
        throw new Error(`Dependency work item '${dependencyId}' does not exist`)
      }
    }

    if (!workItemId) {
      return
    }

    const graph = new Map<WorkItemId, WorkItemId[]>()
    for (const item of workItems) {
      graph.set(item.workItemId, item.dependsOn)
    }
    graph.set(workItemId, dependsOn)

    if (this.hasPathTo(workItemId, workItemId, graph, new Set())) {
      throw new Error(
        `Dependency update for work item '${workItemId}' creates a cycle`
      )
    }
  }

  private hasPathTo(
    startId: WorkItemId,
    targetId: WorkItemId,
    graph: Map<WorkItemId, WorkItemId[]>,
    visited: Set<WorkItemId>
  ): boolean {
    if (visited.has(startId)) {
      return false
    }
    visited.add(startId)

    for (const dependencyId of graph.get(startId) ?? []) {
      if (dependencyId === targetId) {
        return true
      }
      if (this.hasPathTo(dependencyId, targetId, graph, visited)) {
        return true
      }
    }
    return false
  }

  private createWorkItemId(): WorkItemId {
    return `wi_${crypto.randomUUID().replace(/-/g, "")}`
  }

  private async addLifecycleEvent(
    type: "work_item_created" | "work_item_updated" | "work_item_deleted",
    workItem: WorkItem,
    details: Record<string, any>
  ): Promise<void> {
    const event: Event = {
      projectId: this.stateManager.getProjectId(),
      type,
      timestamp: new Date().toISOString(),
      employeeId: workItem.employeeId,
      rootTaskId: workItem.rootTaskId,
      workItemId: workItem.workItemId,
      details,
    }
    await this.stateManager.addEvent(event)
  }

  private eventChanges(updates: UpdateWorkItemInput): Record<string, any> {
    const changes: Record<string, any> = {}
    for (const key of [
      "description",
      "parentWorkItemId",
      "dependsOn",
      "worktreeRef",
    ] as const) {
      if (Object.hasOwn(updates, key)) {
        changes[key] = updates[key]
      }
    }
    return changes
  }
}
