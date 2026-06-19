import { describe, it, expect, beforeEach } from "bun:test"
import { EmployeeRegistry } from "../../src/state/EmployeeRegistry"
import type { Employee } from "../../src/types/index"

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    employeeId: "emp_alice",
    name: "alice",
    roleId: "developer",
    status: "idle",
    createdAt: "2026-06-19T00:00:00.000Z",
    lastActiveAt: "2026-06-19T00:00:00.000Z",
    hiredBy: null,
    paused: false,
    activeSessionId: null,
    ...overrides,
  }
}

describe("EmployeeRegistry", () => {
  let registry: EmployeeRegistry

  beforeEach(() => {
    registry = new EmployeeRegistry()
  })

  it("registers, retrieves, and protects employee copies", () => {
    registry.register(createEmployee())

    const retrieved = registry.get("emp_alice")
    expect(retrieved).toMatchObject({
      employeeId: "emp_alice",
      name: "alice",
      roleId: "developer",
    })

    if (retrieved) {
      retrieved.status = "error"
    }
    expect(registry.get("emp_alice")?.status).toBe("idle")
  })

  it("throws when registering a duplicate employeeId", () => {
    const employee = createEmployee()
    registry.register(employee)

    expect(() => registry.register(employee)).toThrow("已存在")
  })

  it("emits register, update, and status change events", () => {
    const eventLog: string[] = []
    registry.on("employee_registered", (employee: Employee) => {
      eventLog.push(`registered:${employee.employeeId}`)
    })
    registry.on("employee_updated", (employee: Employee) => {
      eventLog.push(`updated:${employee.employeeId}:${employee.paused}`)
    })
    registry.on("status_changed", (event: any) => {
      eventLog.push(
        `status:${event.employeeId}:${event.oldStatus}->${event.newStatus}`
      )
    })

    registry.register(createEmployee())
    registry.updatePaused("emp_alice", true)
    registry.updateStatus("emp_alice", "busy")

    expect(eventLog).toEqual([
      "registered:emp_alice",
      "updated:emp_alice:true",
      "status:emp_alice:idle->busy",
    ])
  })

  it("queries employees by status, name, roleId, hiredBy, paused, and running state", () => {
    registry.register(
      createEmployee({
        employeeId: "emp_api_1",
        name: "api-worker",
        roleId: "developer",
        hiredBy: "emp_creator",
        status: "busy",
        paused: false,
      })
    )
    registry.register(
      createEmployee({
        employeeId: "emp_api_2",
        name: "api-worker",
        roleId: "reviewer",
        hiredBy: "emp_creator",
        status: "idle",
        paused: true,
      })
    )
    registry.register(
      createEmployee({
        employeeId: "emp_docs_1",
        name: "docs-worker",
        roleId: "developer",
        hiredBy: null,
        status: "offline",
        paused: false,
      })
    )

    expect(registry.getByStatus("busy").map((e) => e.employeeId)).toEqual([
      "emp_api_1",
    ])
    expect(registry.getByName("api-worker")).toHaveLength(2)
    expect(registry.getByRoleId("developer").map((e) => e.employeeId)).toEqual([
      "emp_api_1",
      "emp_docs_1",
    ])
    expect(registry.getByHiredBy("emp_creator")).toHaveLength(2)
    expect(registry.getByPaused(true).map((e) => e.employeeId)).toEqual([
      "emp_api_2",
    ])
    expect(registry.getByPaused(false).map((e) => e.employeeId)).toEqual([
      "emp_api_1",
      "emp_docs_1",
    ])
  })

  it("updates activeSessionId and clears all employees", () => {
    registry.register(createEmployee())

    registry.updateActiveSessionId("emp_alice", "session-1")
    expect(registry.get("emp_alice")?.activeSessionId).toBe("session-1")

    registry.clear()
    expect(registry.getAll()).toEqual([])
  })
})
