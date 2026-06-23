import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import { StateManager } from "../../src/state/StateManager"
import type { Employee } from "../../src/types/index"
import {
  getTestProjectPaths,
  resetTestWorkspace,
} from "../helpers/testWorkspace"

const { suiteRoot, projectPath, workspaceRoot } =
  getTestProjectPaths("state-manager")

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    employeeId: "emp_worker",
    name: "worker",
    roleId: "developer",
    hiredBy: null,
    description: "Worker employee",
    contextPaths: [],
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
    ...overrides,
  }
}

describe("StateManager employee state contract", () => {
  let stateManager: StateManager

  beforeEach(async () => {
    await resetTestWorkspace(suiteRoot)
    stateManager = new StateManager("test-project", workspaceRoot, projectPath)
  })

  afterEach(async () => {
    await fs.rm(suiteRoot, { recursive: true, force: true })
  })

  it("registers and persists employees without taskId", async () => {
    const employee = createEmployee({ hiredBy: "0-boss" })

    await stateManager.registerEmployee(employee)

    expect(stateManager.getEmployee(employee.employeeId)).toEqual(employee)

    const persisted = yaml.parse(
      await fs.readFile(
        path.join(projectPath, ".cclover", "employees.yaml"),
        "utf-8"
      )
    )
    expect(persisted.employees[0]).toEqual(employee)
    expect("taskId" in persisted.employees[0]).toBe(false)
    expect("status" in persisted.employees[0]).toBe(false)
    expect("paused" in persisted.employees[0]).toBe(false)
    expect("activeSessionId" in persisted.employees[0]).toBe(false)
    expect("lastActiveAt" in persisted.employees[0]).toBe(false)
  })

  it("rejects duplicate employeeId and blank names", async () => {
    const employee = createEmployee()

    await stateManager.registerEmployee(employee)

    await expect(stateManager.registerEmployee(employee)).rejects.toThrow(
      "已存在"
    )
    await expect(
      stateManager.registerEmployee(
        createEmployee({ employeeId: "emp_invalid", name: "   " })
      )
    ).rejects.toThrow("格式无效")
  })

  it("skips persisted employees missing employeeId or roleId", async () => {
    const validEmployee = createEmployee({ employeeId: "emp_valid" })

    await fs.mkdir(path.join(projectPath, ".cclover"), { recursive: true })
    await fs.writeFile(
      path.join(projectPath, ".cclover", "employees.yaml"),
      yaml.stringify({
        employees: [
          {
            name: "legacy-worker",
            taskId: 5,
            role: "legacy-role",
            hiredBy: "emp_creator",
            paused: false,
            status: "busy",
            activeSessionId: "old-session",
            createdAt: "2026-06-18T00:00:00.000Z",
            lastActiveAt: "2026-06-18T01:00:00.000Z",
          },
          {
            employeeId: "emp_missing_role",
            name: "missing-role-worker",
            hiredBy: "emp_creator",
            paused: false,
            status: "idle",
            activeSessionId: null,
            createdAt: "2026-06-18T00:00:00.000Z",
            lastActiveAt: "2026-06-18T01:00:00.000Z",
          },
          validEmployee,
        ],
      }),
      "utf-8"
    )

    await stateManager.loadEmployees()

    expect(stateManager.getEmployees()).toEqual([validEmployee])
    expect(
      stateManager
        .getEmployees()
        .some((employee) => "taskId" in employee || "role" in employee)
    ).toBe(false)
  })

  it("queries employees by stable metadata", async () => {
    await stateManager.registerEmployee(
      createEmployee({
        employeeId: "emp_api_1",
        name: "api-worker",
        roleId: "developer",
        hiredBy: "emp_creator",
      })
    )
    await stateManager.registerEmployee(
      createEmployee({
        employeeId: "emp_api_2",
        name: "api-worker",
        roleId: "reviewer",
        hiredBy: "emp_creator",
      })
    )
    await stateManager.registerEmployee(
      createEmployee({
        employeeId: "emp_docs_1",
        name: "docs-worker",
        roleId: "developer",
        hiredBy: null,
      })
    )

    expect(stateManager.listEmployeesByName("api-worker")).toHaveLength(2)
    expect(
      stateManager.listEmployeesByRoleId("developer").map((e) => e.employeeId)
    ).toEqual(["emp_api_1", "emp_docs_1"])
    expect(stateManager.listEmployeesByHiredBy("emp_creator")).toHaveLength(2)
  })

  it("does not expose old runtime-field employee APIs as a state contract", () => {
    expect("listEmployeesByTaskId" in stateManager).toBe(false)
    expect("listEmployeesByStatus" in stateManager).toBe(false)
    expect("listPausedEmployees" in stateManager).toBe(false)
    expect("listRunningEmployees" in stateManager).toBe(false)
    expect("pauseEmployee" in stateManager).toBe(false)
    expect("resumeEmployee" in stateManager).toBe(false)
    expect("setPromptRecovery" in stateManager).toBe(false)
    expect("clearPromptRecovery" in stateManager).toBe(false)
    expect("listEmployeesWithPromptRecovery" in stateManager).toBe(false)
  })
})
