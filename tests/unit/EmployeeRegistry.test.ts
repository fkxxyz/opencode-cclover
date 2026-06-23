import { describe, it, expect, beforeEach } from "bun:test"
import { EmployeeRegistry } from "../../src/state/EmployeeRegistry"
import type { Employee } from "../../src/types/index"
import { createTestEmployee } from "../helpers/employeeFactory"

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return createTestEmployee({
    employeeId: "emp_alice",
    name: "alice",
    roleId: "developer",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
    ...overrides,
  })
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
      retrieved.contextPaths.push("/mutated")
    }
    expect(registry.get("emp_alice")?.contextPaths).toEqual([])
  })

  it("throws when registering a duplicate employeeId", () => {
    const employee = createEmployee()
    registry.register(employee)

    expect(() => registry.register(employee)).toThrow("已存在")
  })

  it("emits register and update events", () => {
    const eventLog: string[] = []
    registry.on("employee_registered", (employee: Employee) => {
      eventLog.push(`registered:${employee.employeeId}`)
    })
    registry.on("employee_updated", (employee: Employee) => {
      eventLog.push(`updated:${employee.employeeId}:${employee.description}`)
    })

    registry.register(createEmployee())
    registry.update("emp_alice", { description: "updated description" })

    expect(eventLog).toEqual([
      "registered:emp_alice",
      "updated:emp_alice:updated description",
    ])
  })

  it("queries employees by name, roleId, and hiredBy", () => {
    registry.register(
      createEmployee({
        employeeId: "emp_api_1",
        name: "api-worker",
        roleId: "developer",
        hiredBy: "emp_creator",
      })
    )
    registry.register(
      createEmployee({
        employeeId: "emp_api_2",
        name: "api-worker",
        roleId: "reviewer",
        hiredBy: "emp_creator",
      })
    )
    registry.register(
      createEmployee({
        employeeId: "emp_docs_1",
        name: "docs-worker",
        roleId: "developer",
        hiredBy: null,
      })
    )

    expect(registry.getByName("api-worker")).toHaveLength(2)
    expect(registry.getByRoleId("developer").map((e) => e.employeeId)).toEqual([
      "emp_api_1",
      "emp_docs_1",
    ])
    expect(registry.getByHiredBy("emp_creator")).toHaveLength(2)
  })

  it("updates metadata and clears all employees", () => {
    registry.register(createEmployee())

    registry.update("emp_alice", { contextPaths: ["/project"] })
    expect(registry.get("emp_alice")?.contextPaths).toEqual(["/project"])

    registry.clear()
    expect(registry.getAll()).toEqual([])
  })
})
