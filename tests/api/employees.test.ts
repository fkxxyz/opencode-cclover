import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { StateManager } from "../../src/state/StateManager"
import { MemoryManager } from "../../src/core/MemoryManager"
import { agentRegistry } from "../../src/utils/AgentRegistry"
import { getEmployees, getEmployeeDetail } from "../../src/api/employees"
import { getHierarchy } from "../../src/api/hierarchy"
import { BossManager } from "../../src/core/BossManager"
import type { Employee, Memory } from "../../src/types/index"

const testWorkspace = "./workspace_test_api"

beforeEach(async () => {
  await fs.rm(testWorkspace, { recursive: true, force: true })
  await fs.mkdir(testWorkspace, { recursive: true })
})

afterEach(async () => {
  await fs.rm(testWorkspace, { recursive: true, force: true })
})

describe("Employees API", () => {
  it("should return empty employee list when no employees exist", () => {
    const stateManager = new StateManager()
    const response = getEmployees(stateManager)

    expect(response.success).toBe(true)
    expect(response.data.employees).toEqual([])
  })

  it("should return all employees", () => {
    const stateManager = new StateManager()

    const employee1: Employee = {
      name: "calculator",
      role: "Calculator",
      status: "idle",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    }

    const employee2: Employee = {
      name: "coder",
      role: "Coder",
      status: "active",
      createdAt: "2026-03-01T10:02:00.000Z",
      lastActiveAt: "2026-03-01T10:06:00.000Z",
      hiredBy: "calculator",
    }

    stateManager.registerEmployee(employee1)
    stateManager.registerEmployee(employee2)

    const response = getEmployees(stateManager)

    expect(response.success).toBe(true)
    expect(response.data.employees).toHaveLength(2)
    expect(response.data.employees[0].name).toBe("calculator")
    expect(response.data.employees[1].name).toBe("coder")
  })

  it("should return employee detail with memory and tasks", async () => {
    const stateManager = new StateManager()
    const memoryManager = new MemoryManager(testWorkspace)

    const employee: Employee = {
      name: "calculator",
      role: "Calculator",
      status: "idle",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    }

    stateManager.registerEmployee(employee)

    // 创建员工目录和记忆文件
    const employeeDir = path.join(testWorkspace, "employees", "calculator")
    await fs.mkdir(employeeDir, { recursive: true })

    const memory: Memory = {
      knowledge: ["alice 经常问我数学计算问题"],
      tasks: [
        {
          name: "计算1+1",
          status: "completed",
          description: "为 alice 计算 1+1",
          result: "2",
          dependencies: [],
          created: "2026-03-01T10:00:00.000Z",
          completed: "2026-03-01T10:00:05.000Z",
        },
      ],
      custom: {},
    }

    const memoryPath = path.join(employeeDir, "memory.yaml")
    await fs.writeFile(memoryPath, yaml.stringify(memory), "utf-8")

    const response = await getEmployeeDetail(
      "calculator",
      stateManager,
      memoryManager,
      agentRegistry,
      testWorkspace
    )

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.name).toBe("calculator")
      expect(response.data.memory.knowledge).toHaveLength(1)
      expect(response.data.tasks).toHaveLength(1)
      expect(response.data.tasks[0].name).toBe("计算1+1")
    }
  })

  it("should return error for non-existent employee", async () => {
    const stateManager = new StateManager()
    const memoryManager = new MemoryManager(testWorkspace)

    const response = await getEmployeeDetail(
      "unknown",
      stateManager,
      memoryManager,
      agentRegistry,
      testWorkspace
    )

    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("EMPLOYEE_NOT_FOUND")
    }
  })

  it("should return hierarchy with single root employee", () => {
    const stateManager = new StateManager()
    const bossManager = new BossManager(testWorkspace)

    const employee: Employee = {
      name: "calculator",
      role: "Calculator",
      status: "idle",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    }

    stateManager.registerEmployee(employee)

    const response = getHierarchy(stateManager, bossManager)

    expect(response.success).toBe(true)
    expect(response.data.hierarchy).toHaveLength(1)
    expect(response.data.hierarchy[0].name).toBe("calculator")
    expect(response.data.hierarchy[0].children).toHaveLength(0)
  })

  it("should return hierarchy with multiple levels", () => {
    const stateManager = new StateManager()
    const bossManager = new BossManager(testWorkspace)

    const root: Employee = {
      name: "calculator",
      role: "Calculator",
      status: "idle",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    }

    const child: Employee = {
      name: "coder",
      role: "Coder",
      status: "active",
      createdAt: "2026-03-01T10:02:00.000Z",
      lastActiveAt: "2026-03-01T10:06:00.000Z",
      hiredBy: "calculator",
    }

    const grandchild: Employee = {
      name: "tester",
      role: "Tester",
      status: "idle",
      createdAt: "2026-03-01T10:03:00.000Z",
      lastActiveAt: "2026-03-01T10:07:00.000Z",
      hiredBy: "coder",
    }

    stateManager.registerEmployee(root)
    stateManager.registerEmployee(child)
    stateManager.registerEmployee(grandchild)

    const response = getHierarchy(stateManager, bossManager)

    expect(response.success).toBe(true)
    expect(response.data.hierarchy).toHaveLength(1)
    expect(response.data.hierarchy[0].name).toBe("calculator")
    expect(response.data.hierarchy[0].children).toHaveLength(1)
    expect(response.data.hierarchy[0].children[0].name).toBe("coder")
    expect(response.data.hierarchy[0].children[0].children).toHaveLength(1)
    expect(response.data.hierarchy[0].children[0].children[0].name).toBe(
      "tester"
    )
  })
})
