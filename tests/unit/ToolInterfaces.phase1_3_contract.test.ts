import { describe, expect, it } from "bun:test"
import { RootTaskManager } from "../../src/core/RootTaskManager"
import { WorkItemManager } from "../../src/core/WorkItemManager"
import { StateManager } from "../../src/state/StateManager"
import {
  DEFAULT_TOOL_PERMISSIONS,
  createCreateRootTaskTool,
  createCreateWorkItemTool,
  createDeleteWorkItemTool,
  createGetWorkItemTool,
  createListWorkItemsTool,
  createTools,
  createUpdateWorkItemTool,
} from "../../src/tools"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import type { MemoryManager } from "../../src/core/MemoryManager"
import type { MessageService } from "../../src/core/MessageService"
import type { OpencodeClient } from "@opencode-ai/sdk"

const toolArgumentKeys = (toolDefinition: any): string[] =>
  Object.keys(toolDefinition.args ?? {})

const stateManager = new StateManager("phase1_3_project")
const rootTaskManager = new RootTaskManager("/tmp/project")
const workItemManager = new WorkItemManager("/tmp/project", stateManager)

describe("Phase 1.3 tool interface contracts", () => {
  it("enables root task and work item tools by default", () => {
    expect(DEFAULT_TOOL_PERMISSIONS.create_root_task).toBe(true)
    expect(DEFAULT_TOOL_PERMISSIONS.create_work_item).toBe(true)
    expect(DEFAULT_TOOL_PERMISSIONS.update_work_item).toBe(true)
    expect(DEFAULT_TOOL_PERMISSIONS.delete_work_item).toBe(true)
    expect(DEFAULT_TOOL_PERMISSIONS.get_work_item).toBe(true)
    expect(DEFAULT_TOOL_PERMISSIONS.list_work_items).toBe(true)
  })

  it("exports factories for the new root task and work item tools", () => {
    expect(createCreateRootTaskTool).toBeFunction()
    expect(createCreateWorkItemTool).toBeFunction()
    expect(createUpdateWorkItemTool).toBeFunction()
    expect(createDeleteWorkItemTool).toBeFunction()
    expect(createGetWorkItemTool).toBeFunction()
    expect(createListWorkItemsTool).toBeFunction()
  })

  it("freezes the new tool argument schemas", () => {
    expect(
      toolArgumentKeys(createCreateRootTaskTool(rootTaskManager, stateManager))
    ).toEqual(["summary"])

    expect(
      toolArgumentKeys(createCreateWorkItemTool(workItemManager, stateManager))
    ).toEqual([
      "root_task_id",
      "employee_id",
      "description",
      "parent_work_item_id",
      "depends_on",
      "worktree_ref",
    ])

    expect(
      toolArgumentKeys(createUpdateWorkItemTool(workItemManager, stateManager))
    ).toEqual([
      "work_item_id",
      "description",
      "parent_work_item_id",
      "depends_on",
      "worktree_ref",
    ])

    expect(toolArgumentKeys(createDeleteWorkItemTool(workItemManager))).toEqual(
      ["work_item_id"]
    )

    expect(toolArgumentKeys(createGetWorkItemTool(workItemManager))).toEqual([
      "work_item_id",
    ])

    expect(
      toolArgumentKeys(createListWorkItemsTool(workItemManager, stateManager))
    ).toEqual([
      "root_task_id",
      "employee_id",
      "parent_work_item_id",
      "depends_on",
    ])
  })

  it("registers the new tools through createTools dependencies", () => {
    const tools = createTools({
      messageService: {} as MessageService,
      memoryManager: {} as MemoryManager,
      rootTaskManager,
      workItemManager,
      opcodeClient: {} as OpencodeClient,
      stateManager,
    })

    expect(tools.create_root_task).toBeDefined()
    expect(tools.create_work_item).toBeDefined()
    expect(tools.update_work_item).toBeDefined()
    expect(tools.delete_work_item).toBeDefined()
    expect(tools.get_work_item).toBeDefined()
    expect(tools.list_work_items).toBeDefined()
  })

  it("freezes nullable semantics for mutable work item fields", () => {
    const updateTool = createUpdateWorkItemTool(workItemManager, stateManager)
    const listTool = createListWorkItemsTool(workItemManager, stateManager)

    expect(updateTool.args.parent_work_item_id.safeParse(null).success).toBe(
      true
    )
    expect(updateTool.args.worktree_ref.safeParse(null).success).toBe(true)
    expect(listTool.args.parent_work_item_id.safeParse(null).success).toBe(true)
  })

  it("passes explicit null values through to work item managers", async () => {
    let updateInput: any
    let listInput: any
    const capturingWorkItemManager = {
      updateWorkItem: async (_workItemId: string, input: any) => {
        updateInput = input
        return {
          workItemId: "wi-captured",
          rootTaskId: "rt-captured",
          parentWorkItemId: input.parentWorkItemId,
          employeeId: "emp-worker",
          description: input.description ?? "Captured work item",
          dependsOn: input.dependsOn ?? [],
          worktreeRef: input.worktreeRef,
          createdAt: "2026-06-19T00:00:00.000Z",
          updatedAt: "2026-06-19T00:00:00.000Z",
        }
      },
      listWorkItems: async (input: any) => {
        listInput = input
        return []
      },
    } as WorkItemManager

    await createUpdateWorkItemTool(
      capturingWorkItemManager,
      stateManager
    ).execute(
      {
        work_item_id: "wi-captured",
        parent_work_item_id: null,
        worktree_ref: null,
      } as any,
      { sessionID: "phase1-nullability-session" } as any
    )
    await createListWorkItemsTool(
      capturingWorkItemManager,
      stateManager
    ).execute(
      { parent_work_item_id: null } as any,
      { sessionID: "phase1-nullability-session" } as any
    )

    expect(updateInput.parentWorkItemId).toBeNull()
    expect(updateInput.worktreeRef).toBeNull()
    expect(listInput.parentWorkItemId).toBeNull()
  })

  it("creates root tasks with the resolved caller as creator", async () => {
    await stateManager.registerEmployee({
      employeeId: "emp-tool-caller",
      name: "tool-caller",
      roleId: "developer",
      hiredBy: null,
      status: "idle",
      paused: false,
      createdAt: "2026-06-19T00:00:00.000Z",
      lastActiveAt: "2026-06-19T00:00:00.000Z",
      activeSessionId: null,
    })
    sessionRegistry.register("phase1-root-task-session", "emp-tool-caller")

    let capturedInput: { summary: string; createdBy: string } | undefined
    const capturingRootTaskManager = {
      createRootTask: async (input: { summary: string; createdBy: string }) => {
        capturedInput = input
        return {
          rootTaskId: "rt-captured",
          summary: input.summary,
          createdBy: input.createdBy,
          createdAt: "2026-06-19T00:00:00.000Z",
        }
      },
    } as RootTaskManager

    try {
      const tool = createCreateRootTaskTool(
        capturingRootTaskManager,
        stateManager
      )
      await tool.execute({ summary: "Freeze the Phase 1 tool contract" }, {
        sessionID: "phase1-root-task-session",
      } as any)

      expect(capturedInput?.createdBy).toBe("emp-tool-caller")
    } finally {
      sessionRegistry.unregister("phase1-root-task-session")
    }
  })

  it("documents changed contracts for existing task-related tools", () => {
    const tools = createTools({
      messageService: {} as MessageService,
      memoryManager: {} as MemoryManager,
      rootTaskManager,
      workItemManager,
      opcodeClient: {} as OpencodeClient,
      stateManager,
    })

    expect(toolArgumentKeys(tools.hire_employee)).toEqual([
      "name",
      "role",
      "initial_message",
      "initial_args",
    ])
    expect(toolArgumentKeys(tools.create_agent)).toEqual([
      "work_item_id",
      "task_name",
      "prompt",
    ])
    expect(tools.show_tasks.description).toContain("personal TODO tasks")
    expect(toolArgumentKeys(tools.complete_major_task)).toEqual([
      "root_task_id",
    ])
  })
})
