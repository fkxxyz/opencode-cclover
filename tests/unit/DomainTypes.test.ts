import { describe, expect, it } from "bun:test"
import {
  createEmployeeId,
  createRootTaskId,
  createWorkItemId,
} from "../../src/types"
import type {
  BossId,
  CreateRootTaskInput,
  CreateWorkItemInput,
  Employee,
  EmployeeId,
  RootTask,
  RootTaskId,
  UpdateWorkItemInput,
  WorkItem,
  WorkItemFilters,
  WorkItemId,
  WorktreeRef,
} from "../../src/types"

describe("three-layer domain types", () => {
  it("defines task-independent employee records", () => {
    const employee: Employee = {
      employeeId: "emp_designer" as EmployeeId,
      name: "designer-api",
      roleId: "designer",
      handbookPath: "docs/handbooks/api-design.md",
      hiredBy: "boss_alice" as BossId,
      status: "idle",
      paused: false,
      createdAt: "2026-06-19T00:00:00.000Z",
      lastActiveAt: "2026-06-19T00:00:00.000Z",
      activeSessionId: null,
    }

    expect(employee.employeeId).toBe("emp_designer")
    expect(employee.roleId).toBe("designer")
    expect("taskId" in employee).toBe(false)
  })

  it("creates stable employee ids with the emp prefix", () => {
    const employeeId = createEmployeeId()

    expect(employeeId).toMatch(/^emp_[0-9a-f]{32}$/)
    expect(employeeId).not.toContain("-")
  })

  it("creates root task ids with the rt prefix", () => {
    const rootTaskId = createRootTaskId()

    expect(rootTaskId).toMatch(/^rt_[0-9a-f]{32}$/)
    expect(rootTaskId).not.toContain("-")
  })

  it("creates work item ids with the wi prefix", () => {
    const workItemId = createWorkItemId()

    expect(workItemId).toMatch(/^wi_[0-9a-f]{32}$/)
    expect(workItemId).not.toContain("-")
  })

  it("defines root task and work item contracts", () => {
    const rootTaskId = "rt_refactor" as RootTaskId
    const workItemId = "wi_types" as WorkItemId
    const employeeId = "emp_designer" as EmployeeId
    const worktreeRef =
      ".worktrees/three-layer-task-model-phase1" as WorktreeRef

    const createRootTaskInput: CreateRootTaskInput = {
      summary: "Define core domain types",
      createdBy: "boss_alice" as BossId,
    }
    const rootTask: RootTask = {
      rootTaskId,
      summary: createRootTaskInput.summary,
      createdBy: createRootTaskInput.createdBy,
      createdAt: "2026-06-19T00:00:00.000Z",
    }
    const createWorkItemInput: CreateWorkItemInput = {
      rootTaskId,
      employeeId,
      description: "Define the TypeScript contracts",
      parentWorkItemId: null,
      dependsOn: [],
      worktreeRef,
    }
    const workItem: WorkItem = {
      workItemId,
      rootTaskId,
      parentWorkItemId: createWorkItemInput.parentWorkItemId ?? null,
      employeeId,
      description: createWorkItemInput.description,
      dependsOn: createWorkItemInput.dependsOn ?? [],
      worktreeRef: createWorkItemInput.worktreeRef ?? null,
      createdAt: "2026-06-19T00:00:00.000Z",
      updatedAt: "2026-06-19T00:00:00.000Z",
    }
    const updates: UpdateWorkItemInput = {
      description: "Refine the TypeScript contracts",
      parentWorkItemId: null,
      dependsOn: [workItemId],
      worktreeRef: null,
    }
    const filters: WorkItemFilters = {
      rootTaskId,
      employeeId,
      parentWorkItemId: null,
      dependsOn: workItemId,
    }

    expect(rootTask.rootTaskId).toBe(rootTaskId)
    expect(workItem.employeeId).toBe(employeeId)
    expect(updates.dependsOn).toEqual([workItemId])
    expect(filters.dependsOn).toBe(workItemId)
  })
})
