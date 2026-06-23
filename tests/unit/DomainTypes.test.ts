import { describe, expect, it } from "bun:test"
import {
  createEmployeeId,
  createEmployeeWorkSessionId,
  formatBossId,
  isBossId,
} from "../../src/types"
import type {
  BossId,
  Employee,
  EmployeeId,
  EmployeeWorkSession,
  EmployeeWorkSessionId,
} from "../../src/types"

describe("employee work session domain types", () => {
  it("defines metadata-only employee records", () => {
    const employee: Employee = {
      employeeId: "emp_designer" as EmployeeId,
      name: "designer-api",
      roleId: "designer",
      description: "Designs API boundaries",
      contextPaths: ["docs/handbooks/api-design.md"],
      hiredBy: "boss_alice" as BossId,
      createdAt: "2026-06-19T00:00:00.000Z",
      updatedAt: "2026-06-19T00:00:00.000Z",
    }

    expect(employee.employeeId).toBe("emp_designer")
    expect(employee.roleId).toBe("designer")
    expect(employee.description).toBe("Designs API boundaries")
    expect(employee.contextPaths).toEqual(["docs/handbooks/api-design.md"])
    expect("status" in employee).toBe(false)
    expect("activeSessionId" in employee).toBe(false)
  })

  it("creates stable employee ids with the emp prefix", () => {
    const employeeId = createEmployeeId()

    expect(employeeId).toMatch(/^emp_[0-9a-f]{32}$/)
    expect(employeeId).not.toContain("-")
  })

  it("creates employee work session ids with the ews prefix", () => {
    const employeeWorkSessionId = createEmployeeWorkSessionId()

    expect(employeeWorkSessionId).toMatch(/^ews_[0-9a-f]{32}$/)
    expect(employeeWorkSessionId).not.toContain("-")
  })

  it("formats boss ids with the boss prefix", () => {
    const bossId = formatBossId("alice")

    expect(bossId).toBe("boss_alice")
    expect(isBossId(bossId)).toBe(true)
    expect(isBossId("0-alice")).toBe(false)
  })

  it("defines employee work session records without work item fields", () => {
    const ewsId = "ews_types" as EmployeeWorkSessionId
    const employeeId = "emp_designer" as EmployeeId

    const employeeWorkSession: EmployeeWorkSession = {
      employeeWorkSessionId: ewsId,
      parentEmployeeWorkSessionId: null,
      employeeId,
      opencodeSessionId: null,
      description: "Define the TypeScript contracts",
      args: { worktree_path: ".worktrees/ews-taskplan" },
      contextPathsSnapshot: ["docs/architecture.md"],
      worktreeRef: ".worktrees/ews-taskplan",
      status: "offline",
      closedAt: null,
      closedBy: null,
      closeReason: null,
      createdAt: "2026-06-19T00:00:00.000Z",
      updatedAt: "2026-06-19T00:00:00.000Z",
    }

    expect(employeeWorkSession.employeeWorkSessionId).toBe(ewsId)
    expect(employeeWorkSession.employeeId).toBe(employeeId)
    expect("dependsOn" in employeeWorkSession).toBe(false)
    expect("result" in employeeWorkSession).toBe(false)
  })
})
