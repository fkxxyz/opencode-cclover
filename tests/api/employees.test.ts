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
      employeeId: "emp-test-role",
      name: "test-role",
      roleId: "TestRole",
      status: "idle",
      paused: false,
      hiredBy: "boss1",
      activeSessionId: null,
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    }

    const employee2: Employee = {
      employeeId: "emp-coder",
      name: "coder",
      roleId: "Coder",
      status: "idle",
      paused: false,
      hiredBy: "emp-test-role",
      activeSessionId: null,
      createdAt: "2026-03-01T10:02:00.000Z",
      lastActiveAt: "2026-03-01T10:06:00.000Z",
    }

    stateManager.registerEmployee(employee1)
    stateManager.registerEmployee(employee2)

    const response = getEmployees(stateManager)

    expect(response.success).toBe(true)
    expect(response.data.employees).toHaveLength(2)
    expect(response.data.employees[0]).toMatchObject({
      employeeId: "emp-test-role",
      name: "test-role",
      roleId: "TestRole",
    })
    expect(response.data.employees[1]).toMatchObject({
      employeeId: "emp-coder",
      name: "coder",
      roleId: "Coder",
    })
    expect("taskId" in response.data.employees[0]).toBe(false)
    expect("role" in response.data.employees[0]).toBe(false)
  })

  it("should return employee detail by employeeId with memory and tasks", async () => {
    const stateManager = new StateManager()
    const memoryManager = new MemoryManager(testWorkspace)

    const employee: Employee = {
      employeeId: "emp-test-role",
      name: "test-role",
      roleId: "TestRole",
      status: "idle",
      paused: false,
      hiredBy: "boss1",
      activeSessionId: null,
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    }

    stateManager.registerEmployee(employee)

    // 创建员工目录和记忆文件（使用 employeeId）
    const employeeDir = path.join(testWorkspace, "employees", "emp-test-role")
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
      args: {},
    }

    const memoryPath = path.join(employeeDir, "memory.yaml")
    await fs.writeFile(memoryPath, yaml.stringify(memory), "utf-8")

    const response = await getEmployeeDetail(
      "emp-test-role",
      stateManager,
      memoryManager,
      agentRegistry
    )

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.name).toBe("test-role")
      expect(response.data.employeeId).toBe("emp-test-role")
      expect(response.data.roleId).toBe("TestRole")
      expect("taskId" in response.data).toBe(false)
      expect(response.data.memory.knowledge).toHaveLength(1)
      expect(response.data.tasks).toHaveLength(1)
      expect(response.data.tasks[0].name).toBe("计算1+1")
    }
  })

  it("should not resolve employee detail by display name", async () => {
    const stateManager = new StateManager()
    const memoryManager = new MemoryManager(testWorkspace)

    stateManager.registerEmployee({
      employeeId: "emp-test-role",
      name: "test-role",
      roleId: "TestRole",
      status: "idle",
      paused: false,
      hiredBy: null,
      activeSessionId: null,
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    })

    const response = await getEmployeeDetail(
      "test-role",
      stateManager,
      memoryManager,
      agentRegistry
    )

    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("EMPLOYEE_NOT_FOUND")
    }
  })

  it("should return error for non-existent employee", async () => {
    const stateManager = new StateManager()
    const memoryManager = new MemoryManager(testWorkspace)

    const response = await getEmployeeDetail(
      "unknown",
      stateManager,
      memoryManager,
      agentRegistry
    )

    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("EMPLOYEE_NOT_FOUND")
    }
  })

  it("should return hierarchy with single root employee", () => {
    const stateManager = new StateManager()
    const bossManager = new BossManager()
    bossManager.addBoss("boss1")

    const employee: Employee = {
      employeeId: "emp-test-role",
      name: "test-role",
      roleId: "TestRole",
      status: "idle",
      paused: false,
      hiredBy: "0-boss1",
      activeSessionId: null,
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    }

    stateManager.registerEmployee(employee)

    const response = getHierarchy(stateManager, bossManager)

    expect(response.success).toBe(true)
    expect(
      response.data.hierarchy.some((node) => node.name === "cclover")
    ).toBe(true)

    const boss1Node = response.data.hierarchy.find(
      (node) => node.name === "boss1"
    )
    expect(boss1Node).toBeDefined()
    expect(boss1Node?.employeeId).toBeUndefined()
    expect(boss1Node?.children).toHaveLength(1)
    expect(boss1Node?.children[0].name).toBe("test-role")
    expect(boss1Node?.children[0].employeeId).toBe("emp-test-role")
  })

  it("should treat direct boss name hiredBy as orphan instead of legacy boss fallback", () => {
    const stateManager = new StateManager()
    const bossManager = new BossManager()

    stateManager.registerEmployee({
      employeeId: "emp-test-role",
      name: "test-role",
      roleId: "TestRole",
      status: "idle",
      paused: false,
      hiredBy: "boss1",
      activeSessionId: null,
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    })

    const response = getHierarchy(stateManager, bossManager)

    expect(response.success).toBe(true)
    expect(response.data.hierarchy.some((node) => node.name === "boss1")).toBe(
      false
    )
    expect(
      response.data.hierarchy.some((node) => node.name === "test-role")
    ).toBe(true)
    const orphanNode = response.data.hierarchy.find(
      (node) => node.name === "test-role"
    )
    expect(orphanNode?.employeeId).toBe("emp-test-role")
  })

  it("should nest orphan descendants without duplicating them as roots", () => {
    const stateManager = new StateManager()
    const bossManager = new BossManager()

    stateManager.registerEmployee({
      employeeId: "emp-orphan-root",
      name: "orphan-root",
      roleId: "RootRole",
      status: "idle",
      paused: false,
      hiredBy: "missing-parent",
      activeSessionId: null,
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    })
    stateManager.registerEmployee({
      employeeId: "emp-orphan-child",
      name: "orphan-child",
      roleId: "ChildRole",
      status: "idle",
      paused: false,
      hiredBy: "emp-orphan-root",
      activeSessionId: null,
      createdAt: "2026-03-01T10:01:00.000Z",
      lastActiveAt: "2026-03-01T10:06:00.000Z",
    })

    const response = getHierarchy(stateManager, bossManager)

    expect(response.success).toBe(true)
    const rootNodes = response.data.hierarchy.filter(
      (node) => node.name === "orphan-root"
    )
    const childRootNodes = response.data.hierarchy.filter(
      (node) => node.name === "orphan-child"
    )
    expect(rootNodes).toHaveLength(1)
    expect(childRootNodes).toHaveLength(0)
    expect(rootNodes[0].employeeId).toBe("emp-orphan-root")
    expect(rootNodes[0].children).toHaveLength(1)
    expect(rootNodes[0].children[0].name).toBe("orphan-child")
    expect(rootNodes[0].children[0].employeeId).toBe("emp-orphan-child")
  })

  it("should nest orphan descendants registered before their parent", () => {
    const stateManager = new StateManager()
    const bossManager = new BossManager()

    stateManager.registerEmployee({
      employeeId: "emp-orphan-child",
      name: "orphan-child",
      roleId: "ChildRole",
      status: "idle",
      paused: false,
      hiredBy: "emp-orphan-root",
      activeSessionId: null,
      createdAt: "2026-03-01T10:01:00.000Z",
      lastActiveAt: "2026-03-01T10:06:00.000Z",
    })
    stateManager.registerEmployee({
      employeeId: "emp-orphan-root",
      name: "orphan-root",
      roleId: "RootRole",
      status: "idle",
      paused: false,
      hiredBy: "missing-parent",
      activeSessionId: null,
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    })

    const response = getHierarchy(stateManager, bossManager)

    expect(response.success).toBe(true)
    const rootNodes = response.data.hierarchy.filter(
      (node) => node.name === "orphan-root"
    )
    const childRootNodes = response.data.hierarchy.filter(
      (node) => node.name === "orphan-child"
    )
    expect(rootNodes).toHaveLength(1)
    expect(childRootNodes).toHaveLength(0)
    expect(rootNodes[0].employeeId).toBe("emp-orphan-root")
    expect(rootNodes[0].children).toHaveLength(1)
    expect(rootNodes[0].children[0].name).toBe("orphan-child")
    expect(rootNodes[0].children[0].employeeId).toBe("emp-orphan-child")
  })

  it("should return hierarchy with multiple levels", () => {
    const stateManager = new StateManager()
    const bossManager = new BossManager()
    bossManager.addBoss("boss1")

    const root: Employee = {
      employeeId: "emp-test-role",
      name: "test-role",
      roleId: "TestRole",
      status: "idle",
      paused: false,
      hiredBy: "0-boss1",
      activeSessionId: null,
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:05:00.000Z",
    }

    const child: Employee = {
      employeeId: "emp-coder",
      name: "coder",
      roleId: "Coder",
      status: "idle",
      paused: false,
      hiredBy: "emp-test-role",
      activeSessionId: null,
      createdAt: "2026-03-01T10:02:00.000Z",
      lastActiveAt: "2026-03-01T10:06:00.000Z",
    }

    const grandchild: Employee = {
      employeeId: "emp-tester",
      name: "tester",
      roleId: "Tester",
      status: "idle",
      paused: false,
      hiredBy: "emp-coder",
      activeSessionId: null,
      createdAt: "2026-03-01T10:03:00.000Z",
      lastActiveAt: "2026-03-01T10:07:00.000Z",
    }

    stateManager.registerEmployee(root)
    stateManager.registerEmployee(child)
    stateManager.registerEmployee(grandchild)

    const response = getHierarchy(stateManager, bossManager)

    expect(response.success).toBe(true)
    expect(
      response.data.hierarchy.some((node) => node.name === "cclover")
    ).toBe(true)

    const boss1Node = response.data.hierarchy.find(
      (node) => node.name === "boss1"
    )
    expect(boss1Node).toBeDefined()
    expect(boss1Node?.employeeId).toBeUndefined()
    expect(boss1Node?.children).toHaveLength(1)
    expect(boss1Node?.children[0].name).toBe("test-role")
    expect(boss1Node?.children[0].employeeId).toBe("emp-test-role")
    expect(boss1Node?.children[0].children).toHaveLength(1)
    expect(boss1Node?.children[0].children[0].name).toBe("coder")
    expect(boss1Node?.children[0].children[0].employeeId).toBe("emp-coder")
    expect(boss1Node?.children[0].children[0].children).toHaveLength(1)
    expect(boss1Node?.children[0].children[0].children[0].name).toBe("tester")
    expect(boss1Node?.children[0].children[0].children[0].employeeId).toBe(
      "emp-tester"
    )
  })
})
