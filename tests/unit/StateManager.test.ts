import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import { StateManager } from "../../src/state/StateManager"
import type { Employee } from "../../src/types/index"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../fixtures/state-manager-test"
)

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    employeeId: "emp_worker",
    name: "worker",
    roleId: "developer",
    hiredBy: null,
    status: "idle",
    paused: false,
    createdAt: "2026-06-19T00:00:00.000Z",
    lastActiveAt: "2026-06-19T00:00:00.000Z",
    activeSessionId: null,
    ...overrides,
  }
}

describe("StateManager employee state contract", () => {
  let stateManager: StateManager

  beforeEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })
    stateManager = new StateManager(
      "test-project",
      TEST_WORKSPACE,
      TEST_WORKSPACE
    )
  })

  afterEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  it("registers and persists employees without taskId", async () => {
    const employee = createEmployee({ hiredBy: "0-boss" })

    await stateManager.registerEmployee(employee)

    expect(stateManager.getEmployee(employee.employeeId)).toEqual(employee)

    const persisted = yaml.parse(
      await fs.readFile(
        path.join(TEST_WORKSPACE, ".cclover", "employees.yaml"),
        "utf-8"
      )
    )
    expect(persisted.employees[0]).toEqual(employee)
    expect("taskId" in persisted.employees[0]).toBe(false)
  })

  it("rejects duplicate employeeId and invalid legacy-style names", async () => {
    const employee = createEmployee()

    await stateManager.registerEmployee(employee)

    await expect(stateManager.registerEmployee(employee)).rejects.toThrow(
      "已存在"
    )
    await expect(
      stateManager.registerEmployee(
        createEmployee({ employeeId: "emp_invalid", name: "1-invalid" })
      )
    ).rejects.toThrow("格式无效")
  })

  it("skips persisted employees missing employeeId or roleId", async () => {
    const validEmployee = createEmployee({ employeeId: "emp_valid" })

    await fs.mkdir(path.join(TEST_WORKSPACE, ".cclover"), { recursive: true })
    await fs.writeFile(
      path.join(TEST_WORKSPACE, ".cclover", "employees.yaml"),
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

  it("queries employees by name, roleId, hiredBy, status, paused, and running", async () => {
    await stateManager.registerEmployee(
      createEmployee({
        employeeId: "emp_api_1",
        name: "api-worker",
        roleId: "developer",
        hiredBy: "emp_creator",
        status: "busy",
        paused: false,
      })
    )
    await stateManager.registerEmployee(
      createEmployee({
        employeeId: "emp_api_2",
        name: "api-worker",
        roleId: "reviewer",
        hiredBy: "emp_creator",
        status: "idle",
        paused: true,
      })
    )
    await stateManager.registerEmployee(
      createEmployee({
        employeeId: "emp_docs_1",
        name: "docs-worker",
        roleId: "developer",
        hiredBy: null,
        status: "offline",
        paused: false,
      })
    )

    expect(stateManager.listEmployeesByName("api-worker")).toHaveLength(2)
    expect(
      stateManager.listEmployeesByRoleId("developer").map((e) => e.employeeId)
    ).toEqual(["emp_api_1", "emp_docs_1"])
    expect(stateManager.listEmployeesByHiredBy("emp_creator")).toHaveLength(2)
    expect(
      stateManager.listEmployeesByStatus("busy").map((e) => e.employeeId)
    ).toEqual(["emp_api_1"])
    expect(stateManager.listPausedEmployees().map((e) => e.employeeId)).toEqual(
      ["emp_api_2"]
    )
    expect(
      stateManager.listRunningEmployees().map((e) => e.employeeId)
    ).toEqual(["emp_api_1", "emp_docs_1"])
  })

  it("persists paused and prompt recovery metadata independent of task ownership", async () => {
    const employee = createEmployee({ status: "busy" })

    await stateManager.registerEmployee(employee)
    await stateManager.pauseEmployee(employee.employeeId)
    await stateManager.setPromptRecovery(employee.employeeId, {
      version: 1,
      sessionId: "session-recover",
      startedAt: "2026-06-19T00:01:00.000Z",
      triggerEventType: "message",
    })

    expect(stateManager.getEmployee(employee.employeeId)?.paused).toBe(true)
    expect(stateManager.getEmployee(employee.employeeId)?.status).toBe(
      "offline"
    )
    expect(stateManager.listEmployeesWithPromptRecovery()).toHaveLength(1)

    await stateManager.clearPromptRecovery(employee.employeeId)
    expect(stateManager.listEmployeesWithPromptRecovery()).toHaveLength(0)
  })

  it("does not expose taskId-based employee grouping as a state contract", () => {
    expect("listEmployeesByTaskId" in stateManager).toBe(false)
  })
})
