import { describe, expect, it } from "bun:test"
import * as fs from "fs/promises"
import * as os from "os"
import * as path from "path"
import * as yaml from "yaml"
import { RootTaskManager } from "../../src/core/RootTaskManager"
import { WorkItemManager } from "../../src/core/WorkItemManager"
import type { StateManager } from "../../src/state"
import type { Event } from "../../src/types"

const stateManager = {} as StateManager

describe("RootTaskManager contract", () => {
  it("exposes the Phase 1.2 root task manager API", () => {
    const manager = new RootTaskManager("/tmp/project")

    expect(manager.createRootTask).toBeFunction()
    expect(manager.getRootTask).toBeFunction()
    expect(manager.listRootTasks).toBeFunction()
    expect(manager.deleteRootTask).toBeFunction()
  })

  it("creates, gets, lists, and deletes YAML-backed root tasks", async () => {
    const projectPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "cclover-root-task-manager-")
    )
    const manager = new RootTaskManager(projectPath)

    try {
      const rootTask = await manager.createRootTask({
        summary: "Coordinate the three-layer task model refactor",
        createdBy: "boss-fkxxyz",
      })

      expect(rootTask.rootTaskId).toStartWith("rt_")
      expect(rootTask.summary).toBe(
        "Coordinate the three-layer task model refactor"
      )
      expect(rootTask.createdBy).toBe("boss-fkxxyz")
      expect(rootTask.createdAt).toBeDefined()
      expect(await manager.getRootTask(rootTask.rootTaskId)).toEqual(rootTask)
      expect(await manager.listRootTasks()).toEqual([rootTask])

      const persisted = yaml.parse(
        await fs.readFile(
          path.join(projectPath, ".cclover", "root-tasks.yaml"),
          "utf-8"
        )
      )
      expect(persisted.rootTasks).toEqual([rootTask])

      await manager.deleteRootTask(rootTask.rootTaskId)
      expect(await manager.getRootTask(rootTask.rootTaskId)).toBeNull()
      expect(await manager.listRootTasks()).toEqual([])
    } finally {
      await fs.rm(projectPath, { recursive: true, force: true })
    }
  })

  it("loads an empty root task list when storage file is missing", async () => {
    const projectPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "cclover-root-task-manager-")
    )

    try {
      const manager = new RootTaskManager(projectPath)

      expect(await manager.listRootTasks()).toEqual([])
    } finally {
      await fs.rm(projectPath, { recursive: true, force: true })
    }
  })

  it("returns null for missing root task lookup and rejects missing deletion", async () => {
    const projectPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "cclover-root-task-manager-")
    )

    try {
      const manager = new RootTaskManager(projectPath)

      expect(await manager.getRootTask("rt_missing")).toBeNull()
      await expect(manager.deleteRootTask("rt_missing")).rejects.toThrow(
        'Root task "rt_missing" does not exist'
      )
    } finally {
      await fs.rm(projectPath, { recursive: true, force: true })
    }
  })

  it("records root task lifecycle events with metadata", async () => {
    const projectPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "cclover-root-task-manager-")
    )
    const events: Event[] = []
    const eventStateManager = {
      getProjectId: () => "root-task-project",
      addEvent: async (event: Event) => {
        events.push(event)
      },
    } as StateManager

    try {
      const manager = new RootTaskManager(projectPath, eventStateManager)
      const rootTask = await manager.createRootTask({
        summary: "Emit lifecycle metadata",
        createdBy: "66-phase2-manager",
      })
      await manager.deleteRootTask(rootTask.rootTaskId)

      expect(events).toHaveLength(2)
      expect(events[0]).toMatchObject({
        projectId: "root-task-project",
        type: "root_task_created",
        employeeId: "66-phase2-manager",
        rootTaskId: rootTask.rootTaskId,
        details: {
          rootTaskId: rootTask.rootTaskId,
          summary: "Emit lifecycle metadata",
          createdBy: "66-phase2-manager",
        },
      })
      expect(events[1]).toMatchObject({
        projectId: "root-task-project",
        type: "root_task_deleted",
        employeeId: "66-phase2-manager",
        rootTaskId: rootTask.rootTaskId,
        details: {
          rootTaskId: rootTask.rootTaskId,
          deletedBy: "66-phase2-manager",
        },
      })
    } finally {
      await fs.rm(projectPath, { recursive: true, force: true })
    }
  })

  it("rejects deleting a root task while work items reference it", async () => {
    const projectPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "cclover-root-task-manager-")
    )
    const workItemReader = {
      listWorkItems: async () => [
        {
          workItemId: "wi_existing",
          rootTaskId: "ignored-by-filter",
          parentWorkItemId: null,
          employeeId: "66-dev",
          description: "Existing work item",
          dependsOn: [],
          worktreeRef: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    }

    try {
      const manager = new RootTaskManager(
        projectPath,
        undefined,
        workItemReader as unknown as WorkItemManager
      )
      const rootTask = await manager.createRootTask({
        summary: "Root with referenced work items",
        createdBy: "boss-fkxxyz",
      })

      await expect(manager.deleteRootTask(rootTask.rootTaskId)).rejects.toThrow(
        `Cannot delete root task "${rootTask.rootTaskId}" because work items reference it`
      )
      expect(await manager.getRootTask(rootTask.rootTaskId)).toEqual(rootTask)
    } finally {
      await fs.rm(projectPath, { recursive: true, force: true })
    }
  })
})

describe("WorkItemManager contract", () => {
  it("exposes the Phase 1.2 work item manager API", () => {
    const manager = new WorkItemManager("/tmp/project", stateManager)

    expect(manager.createWorkItem).toBeFunction()
    expect(manager.updateWorkItem).toBeFunction()
    expect(manager.deleteWorkItem).toBeFunction()
    expect(manager.getWorkItem).toBeFunction()
    expect(manager.listWorkItems).toBeFunction()
    expect(manager.validateDependencies).toBeFunction()
  })

  it("validates Phase 2 work item storage prerequisites", async () => {
    const manager = new WorkItemManager("/tmp/project", stateManager)

    await expect(
      manager.createWorkItem({
        rootTaskId: "rt_three_layer_refactor",
        employeeId: "emp_architect",
        description: "Define manager contracts",
      })
    ).rejects.toThrow("Root task 'rt_three_layer_refactor' does not exist")
  })
})
