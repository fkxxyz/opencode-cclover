import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { RootTaskManager } from "../../src/core/RootTaskManager"
import { WorkItemManager } from "../../src/core/WorkItemManager"
import { StateManager } from "../../src/state/StateManager"
import {
  DEFAULT_TOOL_PERMISSIONS,
  createTools,
  type ToolRegistry,
} from "../../src/tools"
import type { MemoryManager } from "../../src/core/MemoryManager"
import type { MessageService } from "../../src/core/MessageService"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { Employee, Event } from "../../src/types"
import { sessionRegistry } from "../../src/utils/SessionRegistry"

function createEmployee(employeeId: string, name = employeeId): Employee {
  return {
    employeeId,
    name,
    roleId: "developer",
    hiredBy: null,
    status: "idle",
    paused: false,
    createdAt: "2026-06-19T00:00:00.000Z",
    lastActiveAt: "2026-06-19T00:00:00.000Z",
    activeSessionId: null,
  }
}

function parseToolResult<T>(result: string): T {
  return JSON.parse(result) as T
}

describe("work item runtime tools", () => {
  let projectPath: string
  let stateManager: StateManager
  let rootTaskManager: RootTaskManager
  let workItemManager: WorkItemManager
  let tools: ToolRegistry

  beforeEach(async () => {
    projectPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "cclover-work-item-tools-")
    )
    stateManager = new StateManager(
      "work_item_tools_runtime_test",
      path.join(projectPath, ".cclover", "workspace"),
      projectPath
    )
    workItemManager = new WorkItemManager(projectPath, stateManager)
    rootTaskManager = new RootTaskManager(
      projectPath,
      stateManager,
      workItemManager
    )
    tools = createTools({
      messageService: {} as MessageService,
      memoryManager: {} as MemoryManager,
      rootTaskManager,
      workItemManager,
      opcodeClient: {} as OpencodeClient,
      stateManager,
    })
    await stateManager.registerEmployee(createEmployee("emp-caller", "caller"))
    await stateManager.registerEmployee(createEmployee("emp-worker", "worker"))
    sessionRegistry.register("work-item-tools-session", "emp-caller")
  })

  afterEach(async () => {
    sessionRegistry.unregister("work-item-tools-session")
    await fs.rm(projectPath, { recursive: true, force: true })
  })

  it("registers runtime tools with default permissions", () => {
    for (const toolName of [
      "create_root_task",
      "create_work_item",
      "update_work_item",
      "delete_work_item",
      "get_work_item",
      "list_work_items",
    ]) {
      expect(DEFAULT_TOOL_PERMISSIONS[toolName]).toBe(true)
      expect(tools[toolName]).toBeDefined()
    }
  })

  it("creates root tasks with resolved caller identity and records lifecycle events", async () => {
    const result = await tools.create_root_task.execute(
      { summary: "Coordinate Phase 3 runtime tools" },
      { sessionID: "work-item-tools-session" } as any
    )
    const rootTask = parseToolResult<any>(result)

    expect(rootTask.rootTaskId).toStartWith("rt_")
    expect(rootTask.summary).toBe("Coordinate Phase 3 runtime tools")
    expect(rootTask.createdBy).toBe("emp-caller")
    expect(await rootTaskManager.getRootTask(rootTask.rootTaskId)).toEqual(
      rootTask
    )
    expect(
      stateManager.getEvents({ type: "root_task_created" })[0]
    ).toMatchObject({
      employeeId: "emp-caller",
      rootTaskId: rootTask.rootTaskId,
      details: {
        summary: "Coordinate Phase 3 runtime tools",
        createdBy: "emp-caller",
      },
    })
  })

  it("executes create, get, list, update, and delete against real managers", async () => {
    const rootTask = parseToolResult<any>(
      await tools.create_root_task.execute(
        { summary: "Runtime work item flow" },
        { sessionID: "work-item-tools-session" } as any
      )
    )
    const created = parseToolResult<any>(
      await tools.create_work_item.execute(
        {
          root_task_id: rootTask.rootTaskId,
          employee_id: "emp-worker",
          description: "Implement runtime flow",
          depends_on: [],
          worktree_ref: "feature/runtime-flow",
        },
        { sessionID: "work-item-tools-session" } as any
      )
    )

    expect(created.rootTaskId).toBe(rootTask.rootTaskId)
    expect(created.employeeId).toBe("emp-worker")
    expect(created.parentWorkItemId).toBeNull()
    expect(created.dependsOn).toEqual([])
    expect(created.worktreeRef).toBe("feature/runtime-flow")

    expect(
      parseToolResult<any>(
        await tools.get_work_item.execute(
          { work_item_id: created.workItemId },
          { sessionID: "work-item-tools-session" } as any
        )
      )
    ).toEqual(created)
    expect(
      parseToolResult<any[]>(
        await tools.list_work_items.execute(
          { root_task_id: rootTask.rootTaskId },
          { sessionID: "work-item-tools-session" } as any
        )
      ).map((item) => item.workItemId)
    ).toEqual([created.workItemId])

    const updated = parseToolResult<any>(
      await tools.update_work_item.execute(
        {
          work_item_id: created.workItemId,
          description: "Implement updated runtime flow",
          worktree_ref: null,
        },
        { sessionID: "work-item-tools-session" } as any
      )
    )

    expect(updated.description).toBe("Implement updated runtime flow")
    expect(updated.worktreeRef).toBeNull()
    expect(updated.employeeId).toBe("emp-worker")

    const deleteResult = await tools.delete_work_item.execute(
      { work_item_id: created.workItemId },
      { sessionID: "work-item-tools-session" } as any
    )
    expect(deleteResult).toBe(`Deleted work item ${created.workItemId}`)
    expect(await workItemManager.getWorkItem(created.workItemId)).toBeNull()

    expect(
      stateManager
        .getEvents({ employeeId: "emp-worker" })
        .map((event: Event) => event.type)
        .sort()
    ).toEqual(["work_item_created", "work_item_deleted", "work_item_updated"])
  })

  it("maps snake_case arguments to manager fields and preserves omitted vs null semantics", async () => {
    const rootTask = parseToolResult<any>(
      await tools.create_root_task.execute(
        { summary: "Nullability runtime checks" },
        { sessionID: "work-item-tools-session" } as any
      )
    )
    const parent = parseToolResult<any>(
      await tools.create_work_item.execute(
        {
          root_task_id: rootTask.rootTaskId,
          employee_id: "emp-worker",
          description: "Parent",
          worktree_ref: "feature/parent",
        },
        { sessionID: "work-item-tools-session" } as any
      )
    )
    const dependency = parseToolResult<any>(
      await tools.create_work_item.execute(
        {
          root_task_id: rootTask.rootTaskId,
          employee_id: "emp-worker",
          description: "Dependency",
        },
        { sessionID: "work-item-tools-session" } as any
      )
    )
    const child = parseToolResult<any>(
      await tools.create_work_item.execute(
        {
          root_task_id: rootTask.rootTaskId,
          employee_id: "emp-worker",
          description: "Child",
          parent_work_item_id: parent.workItemId,
          depends_on: [dependency.workItemId],
          worktree_ref: "feature/child",
        },
        { sessionID: "work-item-tools-session" } as any
      )
    )

    const omittedUpdate = parseToolResult<any>(
      await tools.update_work_item.execute(
        {
          work_item_id: child.workItemId,
          description: "Child with preserved relations",
        },
        { sessionID: "work-item-tools-session" } as any
      )
    )
    expect(omittedUpdate.parentWorkItemId).toBe(parent.workItemId)
    expect(omittedUpdate.dependsOn).toEqual([dependency.workItemId])
    expect(omittedUpdate.worktreeRef).toBe("feature/child")

    expect(
      parseToolResult<any[]>(
        await tools.list_work_items.execute({}, {
          sessionID: "work-item-tools-session",
        } as any)
      ).map((item) => item.workItemId)
    ).toEqual([parent.workItemId, dependency.workItemId, child.workItemId])
    expect(
      parseToolResult<any[]>(
        await tools.list_work_items.execute({ parent_work_item_id: null }, {
          sessionID: "work-item-tools-session",
        } as any)
      ).map((item) => item.workItemId)
    ).toEqual([parent.workItemId, dependency.workItemId])

    const clearedUpdate = parseToolResult<any>(
      await tools.update_work_item.execute(
        {
          work_item_id: child.workItemId,
          parent_work_item_id: null,
          worktree_ref: null,
        },
        { sessionID: "work-item-tools-session" } as any
      )
    )
    expect(clearedUpdate.parentWorkItemId).toBeNull()
    expect(clearedUpdate.worktreeRef).toBeNull()
  })

  it("does not allow work item reassignment through tool arguments", async () => {
    const rootTask = parseToolResult<any>(
      await tools.create_root_task.execute({ summary: "Reassignment guard" }, {
        sessionID: "work-item-tools-session",
      } as any)
    )
    const workItem = parseToolResult<any>(
      await tools.create_work_item.execute(
        {
          root_task_id: rootTask.rootTaskId,
          employee_id: "emp-worker",
          description: "Stay assigned",
        },
        { sessionID: "work-item-tools-session" } as any
      )
    )

    expect(Object.keys(tools.update_work_item.args)).not.toContain(
      "employee_id"
    )
    const updated = parseToolResult<any>(
      await tools.update_work_item.execute(
        {
          work_item_id: workItem.workItemId,
          description: "Attempted reassignment ignored",
          employee_id: "emp-caller",
        } as any,
        { sessionID: "work-item-tools-session" } as any
      )
    )

    expect(updated.employeeId).toBe("emp-worker")
  })
})
