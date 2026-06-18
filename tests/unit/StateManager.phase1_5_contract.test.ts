import { describe, it, expect, beforeEach } from "bun:test"
import { StateManager } from "../../src/state/StateManager"
import type { Employee, Event } from "../../src/types/index"

function createEmployee(
  employeeId: string,
  overrides: Partial<Employee> = {}
): Employee {
  return {
    employeeId,
    name: employeeId,
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

describe("StateManager Phase 1.5 state and event contracts", () => {
  let stateManager: StateManager

  beforeEach(() => {
    stateManager = new StateManager("phase1_5_project")
  })

  it("supports root task and work item event metadata with combined filters", async () => {
    const events: Event[] = [
      {
        projectId: "phase1_5_project",
        type: "root_task_created",
        timestamp: "2026-06-19T00:00:01.000Z",
        employeeId: "emp-exec",
        rootTaskId: "rt-alpha",
        details: { summary: "Alpha" },
      },
      {
        projectId: "phase1_5_project",
        type: "work_item_created",
        timestamp: "2026-06-19T00:00:02.000Z",
        employeeId: "emp-worker",
        rootTaskId: "rt-alpha",
        workItemId: "wi-alpha-1",
        details: { description: "Implement alpha" },
      },
      {
        projectId: "phase1_5_project",
        type: "work_item_updated",
        timestamp: "2026-06-19T00:00:03.000Z",
        employeeId: "emp-worker",
        rootTaskId: "rt-beta",
        workItemId: "wi-beta-1",
        details: { description: "Implement beta" },
      },
    ]

    for (const event of events) {
      await stateManager.addEvent(event)
    }

    expect(
      stateManager
        .getEvents({ rootTaskId: "rt-alpha", limit: 10 })
        .map((event) => event.type)
    ).toEqual(["work_item_created", "root_task_created"])

    expect(
      stateManager
        .getEvents({
          employeeId: "emp-worker",
          rootTaskId: "rt-alpha",
          workItemId: "wi-alpha-1",
          type: "work_item_created",
          limit: 10,
        })
        .map((event) => event.workItemId)
    ).toEqual(["wi-alpha-1"])
  })

  it("records halt details with root task and work item context instead of taskId", async () => {
    const employee = createEmployee("emp-worker", { status: "busy" })
    await stateManager.registerEmployee(employee)

    await stateManager.forcePauseEmployeeForHalt(employee.employeeId, {
      rootTaskId: "rt-alpha",
      workItemId: "wi-alpha-1",
      reason: "runaway-loop",
      triggeredBy: "emp-exec",
    })

    const [haltEvent] = stateManager.getEvents({
      employeeId: employee.employeeId,
      type: "employee_halted",
      limit: 1,
    })

    expect(haltEvent.rootTaskId).toBe("rt-alpha")
    expect(haltEvent.workItemId).toBe("wi-alpha-1")
    expect(haltEvent.details).toEqual({
      rootTaskId: "rt-alpha",
      workItemId: "wi-alpha-1",
      reason: "runaway-loop",
      triggeredBy: "emp-exec",
    })
    expect("taskId" in haltEvent.details).toBe(false)
  })

  it("queries employees by name, roleId, hiredBy, status, and paused state", async () => {
    await stateManager.registerEmployee(
      createEmployee("emp-api-1", {
        name: "api-maintainer",
        roleId: "developer",
        hiredBy: "emp-exec",
        status: "busy",
        paused: false,
      })
    )
    await stateManager.registerEmployee(
      createEmployee("emp-api-2", {
        name: "api-maintainer",
        roleId: "reviewer",
        hiredBy: "emp-exec",
        status: "idle",
        paused: true,
      })
    )
    await stateManager.registerEmployee(
      createEmployee("emp-docs-1", {
        name: "docs-maintainer",
        roleId: "developer",
        hiredBy: null,
        status: "offline",
        paused: false,
      })
    )

    expect(stateManager.listEmployeesByName("api-maintainer")).toHaveLength(2)
    expect(
      stateManager.listEmployeesByRoleId("developer").map((e) => e.employeeId)
    ).toEqual(["emp-api-1", "emp-docs-1"])
    expect(stateManager.listEmployeesByHiredBy("emp-exec")).toHaveLength(2)
    expect(
      stateManager.listEmployeesByStatus("busy").map((e) => e.employeeId)
    ).toEqual(["emp-api-1"])
    expect(stateManager.listPausedEmployees().map((e) => e.employeeId)).toEqual(
      ["emp-api-2"]
    )
    expect(
      stateManager.listRunningEmployees().map((e) => e.employeeId)
    ).toEqual(["emp-api-1", "emp-docs-1"])
  })

  it("does not expose legacy employeeName event filtering", () => {
    // @ts-expect-error Phase 1.5 removes employeeName from event filtering.
    stateManager.getEvents({ employeeName: "api-maintainer" })
  })

  it("does not expose taskId-based employee grouping as a state contract", () => {
    expect("listEmployeesByTaskId" in stateManager).toBe(false)
  })
})
