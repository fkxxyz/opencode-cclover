import { tool } from "@opencode-ai/plugin"
import type { BossManager } from "../core/BossManager"
import type { RoleManager } from "../core/RoleManager"
import type { RootTaskManager } from "../core/RootTaskManager"
import type { WorkItemManager } from "../core/WorkItemManager"
import type { StateManager } from "../state/StateManager"
import { resolveToolActor } from "../meeting-mode"

function formatToolResult(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function setIfProvided<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined
): void {
  if (value !== undefined) {
    target[key] = value
  }
}

/**
 * Phase 1.3 contract tool for explicit root task creation.
 */
export function createCreateRootTaskTool(
  rootTaskManager: RootTaskManager,
  stateManager: StateManager,
  bossManager?: BossManager,
  roleManager?: RoleManager
) {
  return tool({
    description: "Create an explicit project-level root task",
    args: {
      summary: tool.schema
        .string()
        .describe("One-sentence high-level task summary"),
    },
    async execute(args, context) {
      const actor = resolveToolActor(
        context,
        stateManager,
        bossManager,
        roleManager
      )

      if (!actor) {
        throw new Error(
          `Unable to identify caller (sessionID: ${context.sessionID}, agent: ${context.agent || "unknown"})`
        )
      }

      const rootTask = await rootTaskManager.createRootTask({
        summary: args.summary,
        createdBy: actor.actorEmployeeId,
      })
      return formatToolResult(rootTask)
    },
  })
}

/**
 * Phase 1.3 contract tool for creating one assigned work item.
 */
export function createCreateWorkItemTool(
  workItemManager: WorkItemManager,
  _stateManager: StateManager,
  _bossManager?: BossManager,
  _roleManager?: RoleManager
) {
  return tool({
    description: "Create a project-level work item assigned to one employee",
    args: {
      root_task_id: tool.schema.string().describe("Root task ID"),
      employee_id: tool.schema.string().describe("Assigned employee ID"),
      description: tool.schema
        .string()
        .describe("One-sentence task package description"),
      parent_work_item_id: tool.schema
        .string()
        .optional()
        .describe("Optional parent work item ID"),
      depends_on: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe("Optional dependency work item IDs"),
      worktree_ref: tool.schema
        .string()
        .optional()
        .describe("Optional worktree reference"),
    },
    async execute(args) {
      const workItem = await workItemManager.createWorkItem({
        rootTaskId: args.root_task_id,
        employeeId: args.employee_id,
        description: args.description,
        parentWorkItemId: args.parent_work_item_id ?? null,
        dependsOn: args.depends_on ?? [],
        worktreeRef: args.worktree_ref ?? null,
      })
      return formatToolResult(workItem)
    },
  })
}

/**
 * Phase 1.3 contract tool for updating mutable work item fields.
 */
export function createUpdateWorkItemTool(
  workItemManager: WorkItemManager,
  _stateManager: StateManager,
  _bossManager?: BossManager,
  _roleManager?: RoleManager
) {
  return tool({
    description:
      "Update mutable work item fields; employee reassignment is not supported",
    args: {
      work_item_id: tool.schema.string().describe("Work item ID"),
      description: tool.schema
        .string()
        .optional()
        .describe("Updated task package description"),
      parent_work_item_id: tool.schema
        .string()
        .nullable()
        .optional()
        .describe("Updated parent work item ID; null clears parent"),
      depends_on: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe("Updated dependency work item IDs"),
      worktree_ref: tool.schema
        .string()
        .nullable()
        .optional()
        .describe("Updated worktree reference; null clears worktree"),
    },
    async execute(args) {
      const updates: Parameters<WorkItemManager["updateWorkItem"]>[1] = {}

      // undefined 代表省略字段；null 是显式清空，必须保留。
      setIfProvided(updates, "description", args.description)
      setIfProvided(updates, "parentWorkItemId", args.parent_work_item_id)
      setIfProvided(updates, "dependsOn", args.depends_on)
      setIfProvided(updates, "worktreeRef", args.worktree_ref)

      const workItem = await workItemManager.updateWorkItem(
        args.work_item_id,
        updates
      )
      return formatToolResult(workItem)
    },
  })
}

/**
 * Phase 1.3 contract tool for deleting a work item.
 */
export function createDeleteWorkItemTool(workItemManager: WorkItemManager) {
  return tool({
    description: "Delete a project-level work item",
    args: {
      work_item_id: tool.schema.string().describe("Work item ID"),
    },
    async execute(args) {
      await workItemManager.deleteWorkItem(args.work_item_id)
      return `Deleted work item ${args.work_item_id}`
    },
  })
}

/**
 * Phase 1.3 contract tool for reading one work item.
 */
export function createGetWorkItemTool(workItemManager: WorkItemManager) {
  return tool({
    description: "Get a project-level work item",
    args: {
      work_item_id: tool.schema.string().describe("Work item ID"),
    },
    async execute(args) {
      const workItem = await workItemManager.getWorkItem(args.work_item_id)
      return formatToolResult(workItem)
    },
  })
}

/**
 * Phase 1.3 contract tool for listing work items.
 */
export function createListWorkItemsTool(
  workItemManager: WorkItemManager,
  _stateManager: StateManager,
  _bossManager?: BossManager,
  _roleManager?: RoleManager
) {
  return tool({
    description: "List project-level work items with optional filters",
    args: {
      root_task_id: tool.schema.string().optional().describe("Root task ID"),
      employee_id: tool.schema.string().optional().describe("Employee ID"),
      parent_work_item_id: tool.schema
        .string()
        .nullable()
        .optional()
        .describe("Parent work item ID; null lists root-level work items"),
      depends_on: tool.schema
        .string()
        .optional()
        .describe("Dependency work item ID"),
    },
    async execute(args) {
      const filters: Parameters<WorkItemManager["listWorkItems"]>[0] = {}

      // 只传递调用方实际提供的过滤项，避免 undefined 被当作显式过滤值。
      setIfProvided(filters, "rootTaskId", args.root_task_id)
      setIfProvided(filters, "employeeId", args.employee_id)
      setIfProvided(filters, "parentWorkItemId", args.parent_work_item_id)
      setIfProvided(filters, "dependsOn", args.depends_on)

      const workItems = await workItemManager.listWorkItems(filters)
      return formatToolResult(workItems)
    },
  })
}
