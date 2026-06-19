/**
 * PauseEmployeeTool 单元测试
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { createPauseEmployeeTool } from "../../src/tools/PauseEmployeeTool"
import { StateManager } from "../../src/state/StateManager"
import { MemoryManager } from "../../src/core/MemoryManager"
import { BossManager } from "../../src/core/BossManager"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import { vacationRegistry } from "../../src/utils/VacationRegistry"

describe("PauseEmployeeTool", () => {
  let stateManager: StateManager
  let memoryManager: MemoryManager
  let bossManager: BossManager
  let testDir: string

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = path.join(
      process.cwd(),
      "tests",
      "fixtures",
      `pause-employee-tool-${Date.now()}`
    )
    await fs.mkdir(testDir, { recursive: true })

    // 初始化管理器
    stateManager = new StateManager("test-project", testDir, testDir)
    memoryManager = new MemoryManager(testDir)
    bossManager = new BossManager({ bosses: ["boss1"], projects: [] })

    // 清空注册表
    sessionRegistry.clear()
    vacationRegistry.clear()
  })

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error: any) {
      // 忽略清理错误
    }
  })

  test("should pause employee successfully when called by boss", async () => {
    // 注册员工
    await stateManager.registerEmployee({
      employeeId: "emp_dev_1",
      name: "dev-1",
      roleId: "developer",
      status: "busy",
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-boss1",
    })

    // 初始化员工记忆（无活动任务）
    await memoryManager.write("emp_dev_1", {
      knowledge: [],
      tasks: [],
      args: {},
    })

    // 注册 session

    // 创建工具
    const tool = createPauseEmployeeTool(
      stateManager,
      memoryManager,
      bossManager
    )

    // 执行工具
    const result = await tool.execute({ employeeId: "emp_dev_1" }, {
      sessionID: "session-1",
      agent: "boss1",
    } as any)

    // 验证结果
    expect(result).toContain("has been paused")
    expect(result).toContain("dev-1")

    // 验证假期通知已发送
    expect(vacationRegistry.hasVacationEvent("dev-1")).toBe(true)
    const event = vacationRegistry.getVacationEvent("dev-1")
    expect(event).not.toBeNull()
    expect(event?.type).toBe("vacation_requested")
    expect(event?.employeeName).toBe("dev-1")

    // 验证员工状态已更新为离线
    const updatedEmployee = stateManager.getEmployee("emp_dev_1")
    expect(updatedEmployee?.status).toBe("offline")
  })

  test("should pause employee successfully when called by direct supervisor", async () => {
    // 注册员工
    await stateManager.registerEmployee({
      employeeId: "emp_dev_1",
      name: "dev-1",
      roleId: "developer",
      status: "busy",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "emp_manager_1",
      paused: false,
      activeSessionId: null,
    })

    // 注册 manager
    await stateManager.registerEmployee({
      employeeId: "emp_manager_1",
      name: "manager-1",
      roleId: "manager",
      status: "busy",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-boss1",
      paused: false,
      activeSessionId: null,
    })

    // 初始化员工记忆（无活动任务）
    await memoryManager.write("emp_dev_1", {
      knowledge: [],
      tasks: [],
      args: {},
    })

    // 注册 session
    sessionRegistry.register("session-1", "emp_manager_1")

    // 创建工具
    const tool = createPauseEmployeeTool(
      stateManager,
      memoryManager,
      bossManager
    )

    // 执行工具
    const result = await tool.execute({ employeeId: "emp_dev_1" }, {
      sessionID: "session-1",
      agent: "boss1",
    } as any)

    // 验证结果
    expect(result).toContain("has been paused")
    expect(vacationRegistry.hasVacationEvent("dev-1")).toBe(true)

    // 验证员工状态已更新为离线
    const updatedEmployee = stateManager.getEmployee("emp_dev_1")
    expect(updatedEmployee?.status).toBe("offline")
  })

  test("should throw error when operator cannot be identified", async () => {
    // 创建工具
    const tool = createPauseEmployeeTool(
      stateManager,
      memoryManager,
      bossManager
    )

    // 执行工具（未注册 session）
    await expect(
      tool.execute({ employeeId: "emp_dev_1" }, {
        sessionID: "unknown-session",
      } as any)
    ).rejects.toThrow("Cannot identify operator")
  })

  test("should throw error when employee not found", async () => {
    // 注册 session

    // 创建工具
    const tool = createPauseEmployeeTool(
      stateManager,
      memoryManager,
      bossManager
    )

    // 执行工具
    await expect(
      tool.execute({ employeeId: "emp_unknown_employee" }, {
        sessionID: "session-1",
        agent: "boss1",
      } as any)
    ).rejects.toThrow("Employee 'emp_unknown_employee' not found")
  })

  test("should throw error when operator is not boss or supervisor", async () => {
    // 注册员工
    await stateManager.registerEmployee({
      employeeId: "emp_dev_1",
      name: "dev-1",
      roleId: "developer",
      status: "busy",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "emp_manager_1",
      paused: false,
      activeSessionId: null,
    })

    // 注册另一个员工（非 boss，非 supervisor）
    await stateManager.registerEmployee({
      employeeId: "emp_dev_2",
      name: "dev-2",
      roleId: "developer",
      status: "busy",
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "emp_manager_1",
    })

    // 注册 session
    sessionRegistry.register("session-1", "emp_dev_2")

    // 创建工具
    const tool = createPauseEmployeeTool(
      stateManager,
      memoryManager,
      bossManager
    )

    // 执行工具
    await expect(
      tool.execute({ employeeId: "emp_dev_1" }, {
        sessionID: "session-1",
      } as any)
    ).rejects.toThrow("Permission denied")
  })

  test("should return message when employee already offline", async () => {
    // 注册员工（已离线）
    await stateManager.registerEmployee({
      employeeId: "emp_dev_1",
      name: "dev-1",
      roleId: "developer",
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-boss1",
      paused: false,
      activeSessionId: null,
    })

    // 注册 session

    // 创建工具
    const tool = createPauseEmployeeTool(
      stateManager,
      memoryManager,
      bossManager
    )

    // 执行工具
    const result = await tool.execute({ employeeId: "emp_dev_1" }, {
      sessionID: "session-1",
      agent: "boss1",
    } as any)

    // 验证结果
    expect(result).toContain("already on vacation")
    expect(result).toContain("dev-1")

    // 验证没有发送假期通知
    expect(vacationRegistry.hasVacationEvent("dev-1")).toBe(false)
  })

  test("should throw error when employee has pending tasks", async () => {
    // 注册员工
    await stateManager.registerEmployee({
      employeeId: "emp_dev_1",
      name: "dev-1",
      roleId: "developer",
      status: "busy",
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-boss1",
    })

    // 初始化员工记忆（有待处理任务）
    await memoryManager.write("emp_dev_1", {
      knowledge: [],
      tasks: [
        {
          name: "task-1",
          description: "Test task",
          status: "pending",
          dependencies: [],
          created: new Date().toISOString(),
        },
      ],
      args: {},
    })

    // 创建工具
    const tool = createPauseEmployeeTool(
      stateManager,
      memoryManager,
      bossManager
    )

    // 执行工具
    await expect(
      tool.execute({ employeeId: "emp_dev_1" }, {
        sessionID: "session-1",
        agent: "boss1",
      } as any)
    ).rejects.toThrow("Cannot pause employee with pending or in-progress tasks")
  })

  test("should throw error when employee has in-progress tasks", async () => {
    // 注册员工
    await stateManager.registerEmployee({
      employeeId: "emp_dev_1",
      name: "dev-1",
      roleId: "developer",
      status: "busy",
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-boss1",
    })

    // 初始化员工记忆（有进行中任务）
    await memoryManager.write("emp_dev_1", {
      knowledge: [],
      tasks: [
        {
          name: "task-1",
          description: "Test task",
          status: "in_progress",
          dependencies: [],
          created: new Date().toISOString(),
        },
      ],
      args: {},
    })

    // 创建工具
    const tool = createPauseEmployeeTool(
      stateManager,
      memoryManager,
      bossManager
    )

    // 执行工具
    await expect(
      tool.execute({ employeeId: "emp_dev_1" }, {
        sessionID: "session-1",
        agent: "boss1",
      } as any)
    ).rejects.toThrow("Cannot pause employee with pending or in-progress tasks")
  })

  test("should include active task names in error message", async () => {
    // 注册员工
    await stateManager.registerEmployee({
      employeeId: "emp_dev_1",
      name: "dev-1",
      roleId: "developer",
      status: "busy",
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-boss1",
    })

    // 初始化员工记忆（有多个活动任务）
    await memoryManager.write("emp_dev_1", {
      knowledge: [],
      tasks: [
        {
          name: "task-1",
          description: "Test task 1",
          status: "pending",
          dependencies: [],
          created: new Date().toISOString(),
        },
        {
          name: "task-2",
          description: "Test task 2",
          status: "in_progress",
          dependencies: [],
          created: new Date().toISOString(),
        },
        {
          name: "task-3",
          description: "Test task 3",
          status: "completed",
          dependencies: [],
          created: new Date().toISOString(),
        },
      ],
      args: {},
    })

    // 注册 session

    // 创建工具
    const tool = createPauseEmployeeTool(
      stateManager,
      memoryManager,
      bossManager
    )

    // 执行工具
    try {
      await tool.execute({ employeeId: "emp_dev_1" }, {
        sessionID: "session-1",
        agent: "boss1",
      } as any)
      throw new Error("Should have thrown")
    } catch (error: any) {
      expect(error.message).toContain("task-1")
      expect(error.message).toContain("task-2")
      expect(error.message).not.toContain("task-3") // completed task should not be included
    }
  })

  test("should allow pausing employee with only completed tasks", async () => {
    // 注册员工
    await stateManager.registerEmployee({
      employeeId: "emp_dev_1",
      name: "dev-1",
      roleId: "developer",
      status: "busy",
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "0-boss1",
      activeSessionId: null,
    })

    // 初始化员工记忆（只有已完成任务）
    await memoryManager.write("emp_dev_1", {
      knowledge: [],
      tasks: [
        {
          name: "task-1",
          description: "Test task",
          status: "completed",
          dependencies: [],
          created: new Date().toISOString(),
        },
      ],
      args: {},
    })

    // 注册 session

    // 创建工具
    const tool = createPauseEmployeeTool(
      stateManager,
      memoryManager,
      bossManager
    )

    // 执行工具
    const result = await tool.execute({ employeeId: "emp_dev_1" }, {
      sessionID: "session-1",
      agent: "boss1",
    } as any)

    // 验证结果
    expect(result).toContain("has been paused")
    expect(vacationRegistry.hasVacationEvent("dev-1")).toBe(true)

    // 验证员工状态已更新为离线
    const updatedEmployee = stateManager.getEmployee("emp_dev_1")
    expect(updatedEmployee?.status).toBe("offline")
  })
})
