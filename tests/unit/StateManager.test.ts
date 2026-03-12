import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { StateManager } from "../../src/state/StateManager"
import type { Employee, EmployeeId, TaskId } from "../../src/types/index"
import { formatEmployeeId, formatBossId } from "../../src/types/index"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../fixtures/state-manager-test"
)

describe("StateManager - EmployeeId System", () => {
  let stateManager: StateManager

  beforeEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 创建 StateManager
    stateManager = new StateManager(TEST_WORKSPACE)
  })

  afterEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  describe("registerEmployee", () => {
    it("should register employee with valid employeeId", async () => {
      const employee: Employee = {
        employeeId: formatEmployeeId(1, "dev-001"),
        name: "dev-001",
        taskId: 1,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      await stateManager.registerEmployee(employee)

      const retrieved = stateManager.getEmployee(employee.employeeId)
      expect(retrieved).toBeDefined()
      expect(retrieved?.employeeId).toBe("1-dev-001")
      expect(retrieved?.name).toBe("dev-001")
      expect(retrieved?.taskId).toBe(1)
    })

    it("should reject duplicate employeeId", async () => {
      const employee1: Employee = {
        employeeId: formatEmployeeId(1, "dev-001"),
        name: "dev-001",
        taskId: 1,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      await stateManager.registerEmployee(employee1)

      // 尝试注册相同的 employeeId
      const employee2: Employee = {
        ...employee1,
        name: "different-name",
      }

      await expect(stateManager.registerEmployee(employee2)).rejects.toThrow(
        "员工 ID '1-dev-001' 已存在"
      )
    })

    it("should reject invalid employee name format (starts with digit-hyphen)", async () => {
      const employee: Employee = {
        employeeId: formatEmployeeId(1, "1-invalid"),
        name: "1-invalid",
        taskId: 1,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      await expect(stateManager.registerEmployee(employee)).rejects.toThrow(
        "员工名称 '1-invalid' 格式无效，不能以数字-开头"
      )
    })

    it("should allow same name in different tasks", async () => {
      const employee1: Employee = {
        employeeId: formatEmployeeId(1, "dev-001"),
        name: "dev-001",
        taskId: 1,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      const employee2: Employee = {
        employeeId: formatEmployeeId(2, "dev-001"),
        name: "dev-001",
        taskId: 2,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      await stateManager.registerEmployee(employee1)
      await stateManager.registerEmployee(employee2)

      const retrieved1 = stateManager.getEmployee("1-dev-001")
      const retrieved2 = stateManager.getEmployee("2-dev-001")

      expect(retrieved1).toBeDefined()
      expect(retrieved2).toBeDefined()
      expect(retrieved1?.name).toBe("dev-001")
      expect(retrieved2?.name).toBe("dev-001")
      expect(retrieved1?.taskId).toBe(1)
      expect(retrieved2?.taskId).toBe(2)
    })

    it("should allow Boss name to coexist with employee name", async () => {
      // Boss 使用 taskId 0
      const boss: Employee = {
        employeeId: formatBossId("mason"),
        name: "mason",
        taskId: 0,
        role: "boss",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      // 员工使用相同名称但不同 taskId
      const employee: Employee = {
        employeeId: formatEmployeeId(1, "mason"),
        name: "mason",
        taskId: 1,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      await stateManager.registerEmployee(boss)
      await stateManager.registerEmployee(employee)

      const retrievedBoss = stateManager.getEmployee("0-mason")
      const retrievedEmployee = stateManager.getEmployee("1-mason")

      expect(retrievedBoss).toBeDefined()
      expect(retrievedEmployee).toBeDefined()
      expect(retrievedBoss?.taskId).toBe(0)
      expect(retrievedEmployee?.taskId).toBe(1)
    })
  })

  describe("getEmployee", () => {
    it("should return employee by employeeId", async () => {
      const employee: Employee = {
        employeeId: formatEmployeeId(1, "dev-001"),
        name: "dev-001",
        taskId: 1,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      await stateManager.registerEmployee(employee)

      const retrieved = stateManager.getEmployee("1-dev-001")
      expect(retrieved).toBeDefined()
      expect(retrieved?.employeeId).toBe("1-dev-001")
    })

    it("should return undefined for non-existent employeeId", () => {
      const retrieved = stateManager.getEmployee("999-nonexistent")
      expect(retrieved).toBeUndefined()
    })
  })

  describe("listEmployeesByTaskId", () => {
    it("should return all employees in a task", async () => {
      const employee1: Employee = {
        employeeId: formatEmployeeId(1, "dev-001"),
        name: "dev-001",
        taskId: 1,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      const employee2: Employee = {
        employeeId: formatEmployeeId(1, "dev-002"),
        name: "dev-002",
        taskId: 1,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      const employee3: Employee = {
        employeeId: formatEmployeeId(2, "dev-003"),
        name: "dev-003",
        taskId: 2,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      await stateManager.registerEmployee(employee1)
      await stateManager.registerEmployee(employee2)
      await stateManager.registerEmployee(employee3)

      const task1Employees = stateManager.listEmployeesByTaskId(1)
      expect(task1Employees).toHaveLength(2)
      expect(task1Employees.map((e) => e.employeeId)).toContain("1-dev-001")
      expect(task1Employees.map((e) => e.employeeId)).toContain("1-dev-002")

      const task2Employees = stateManager.listEmployeesByTaskId(2)
      expect(task2Employees).toHaveLength(1)
      expect(task2Employees[0].employeeId).toBe("2-dev-003")
    })

    it("should return empty array for non-existent task", () => {
      const employees = stateManager.listEmployeesByTaskId(999)
      expect(employees).toEqual([])
    })
  })

  describe("getEmployees", () => {
    it("should return all registered employees", async () => {
      const employee1: Employee = {
        employeeId: formatEmployeeId(1, "dev-001"),
        name: "dev-001",
        taskId: 1,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      const employee2: Employee = {
        employeeId: formatEmployeeId(2, "dev-002"),
        name: "dev-002",
        taskId: 2,
        role: "developer",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      }

      await stateManager.registerEmployee(employee1)
      await stateManager.registerEmployee(employee2)

      const allEmployees = stateManager.getEmployees()
      expect(allEmployees).toHaveLength(2)
      expect(allEmployees.map((e) => e.employeeId)).toContain("1-dev-001")
      expect(allEmployees.map((e) => e.employeeId)).toContain("2-dev-002")
    })

    it("should return empty array when no employees registered", () => {
      const allEmployees = stateManager.getEmployees()
      expect(allEmployees).toEqual([])
    })
  })

  describe("EmployeeId Format Validation", () => {
    it("should accept valid employeeId format", async () => {
      const validIds = [
        formatEmployeeId(1, "dev-001"),
        formatEmployeeId(2, "task-designer"),
        formatEmployeeId(100, "worker"),
        formatBossId("mason"),
      ]

      for (const employeeId of validIds) {
        const employee: Employee = {
          employeeId,
          name: employeeId.split("-").slice(1).join("-"),
          taskId: parseInt(employeeId.split("-")[0]),
          role: "developer",
          hiredBy: null,
          status: "idle",
          paused: false,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          activeSessionId: null,
        }

        await stateManager.registerEmployee(employee)
        const retrieved = stateManager.getEmployee(employeeId)
        expect(retrieved).toBeDefined()
        expect(retrieved?.employeeId).toBe(employeeId)
      }
    })

    it("should reject invalid name formats", async () => {
      const invalidNames = ["1-invalid", "0-worker", "123-dev"]

      for (const name of invalidNames) {
        const employee: Employee = {
          employeeId: formatEmployeeId(1, name),
          name,
          taskId: 1,
          role: "developer",
          hiredBy: null,
          status: "idle",
          paused: false,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          activeSessionId: null,
        }

        await expect(stateManager.registerEmployee(employee)).rejects.toThrow(
          "格式无效"
        )
      }
    })
  })
})
