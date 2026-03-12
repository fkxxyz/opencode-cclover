import { describe, it, expect, beforeEach } from "bun:test"
import { EmployeeRegistry } from "../../src/state/EmployeeRegistry"
import type { Employee } from "../../src/types/index"

describe("EmployeeRegistry", () => {
  let registry: EmployeeRegistry

  beforeEach(() => {
    registry = new EmployeeRegistry()
  })

  describe("register", () => {
    it("should register a new employee", () => {
      const employee: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      registry.register(employee)
      const retrieved = registry.get("0-alice")

      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe("alice")
      expect(retrieved?.role).toBe("Calculator")
    })

    it("should throw error when registering duplicate employee", () => {
      const employee: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      registry.register(employee)
      expect(() => registry.register(employee)).toThrow()
    })

    it("should emit employee_registered event", () => {
      const employee: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      let emitted = false
      registry.on("employee_registered", (emp: Employee) => {
        emitted = true
        expect(emp.name).toBe("alice")
      })

      registry.register(employee)
      expect(emitted).toBe(true)
    })
  })

  describe("update", () => {
    it("should update employee information", () => {
      const employee: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      registry.register(employee)
      registry.update("0-alice", { status: "idle" })

      const updated = registry.get("0-alice")
      expect(updated?.status).toBe("idle")
    })

    it("should throw error when updating non-existent employee", () => {
      expect(() => registry.update("unknown", { status: "idle" })).toThrow()
    })

    it("should emit employee_updated event", () => {
      const employee: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      registry.register(employee)

      let emitted = false
      registry.on("employee_updated", (emp: Employee) => {
        emitted = true
        expect(emp.status).toBe("idle")
      })

      registry.update("0-alice", { status: "idle" })
      expect(emitted).toBe(true)
    })
  })

  describe("get", () => {
    it("should return employee by name", () => {
      const employee: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      registry.register(employee)
      const retrieved = registry.get("0-alice")

      expect(retrieved).toBeDefined()
      expect(retrieved?.name).toBe("alice")
    })

    it("should return undefined for non-existent employee", () => {
      const retrieved = registry.get("unknown")
      expect(retrieved).toBeUndefined()
    })

    it("should return a copy of employee data", () => {
      const employee: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      registry.register(employee)
      const retrieved = registry.get("0-alice")

      if (retrieved) {
        retrieved.status = "error"
      }

      const original = registry.get("0-alice")
      expect(original?.status).toBe("active")
    })
  })

  describe("getAll", () => {
    it("should return all employees", () => {
      const emp1: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      const emp2: Employee = {
        employeeId: "0-bob",
        name: "bob",
        taskId: null,
        role: "Coder",
        status: "idle",
        createdAt: "2026-03-01T10:01:00.000Z",
        lastActiveAt: "2026-03-01T10:01:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      registry.register(emp1)
      registry.register(emp2)

      const all = registry.getAll()
      expect(all.length).toBe(2)
      expect(all.some((e) => e.name === "alice")).toBe(true)
      expect(all.some((e) => e.name === "bob")).toBe(true)
    })

    it("should return empty array when no employees", () => {
      const all = registry.getAll()
      expect(all.length).toBe(0)
    })
  })

  describe("updateStatus", () => {
    it("should update employee status", () => {
      const employee: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      registry.register(employee)
      registry.updateStatus("0-alice", "idle")

      const updated = registry.get("0-alice")
      expect(updated?.status).toBe("idle")
    })

    it("should throw error when updating non-existent employee status", () => {
      expect(() => registry.updateStatus("unknown", "idle")).toThrow()
    })

    it("should emit status_changed event", () => {
      const employee: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      registry.register(employee)

      let emitted = false
      registry.on("status_changed", (data: any) => {
        emitted = true
        expect(data.employeeId).toBe("0-alice")
        expect(data.oldStatus).toBe("active")
        expect(data.newStatus).toBe("idle")
      })

      registry.updateStatus("0-alice", "idle")
      expect(emitted).toBe(true)
    })
  })

  describe("getByStatus", () => {
    it("should return employees by status", () => {
      const emp1: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      const emp2: Employee = {
        employeeId: "0-bob",
        name: "bob",
        taskId: null,
        role: "Coder",
        status: "idle",
        createdAt: "2026-03-01T10:01:00.000Z",
        lastActiveAt: "2026-03-01T10:01:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      const emp3: Employee = {
        employeeId: "0-charlie",
        name: "charlie",
        taskId: null,
        role: "Tester",
        status: "active",
        createdAt: "2026-03-01T10:02:00.000Z",
        lastActiveAt: "2026-03-01T10:02:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      registry.register(emp1)
      registry.register(emp2)
      registry.register(emp3)

      const active = registry.getByStatus("active")
      expect(active.length).toBe(2)
      expect(active.every((e) => e.status === "active")).toBe(true)

      const idle = registry.getByStatus("idle")
      expect(idle.length).toBe(1)
      expect(idle[0].name).toBe("bob")
    })

    it("should return empty array when no employees with status", () => {
      const active = registry.getByStatus("active")
      expect(active.length).toBe(0)
    })
  })

  describe("clear", () => {
    it("should clear all employees", () => {
      const employee: Employee = {
        employeeId: "0-alice",
        name: "alice",
        taskId: null,
        role: "Calculator",
        status: "active",
        createdAt: "2026-03-01T10:00:00.000Z",
        lastActiveAt: "2026-03-01T10:00:00.000Z",
        hiredBy: null,
        paused: false,
        activeSessionId: null,
      }

      registry.register(employee)
      expect(registry.getAll().length).toBe(1)

      registry.clear()
      expect(registry.getAll().length).toBe(0)
    })
  })
})
