/**
 * IntegrateTool 单元测试
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { createIntegrateTool } from "../../src/tools/IntegrateTool"
import { StateManager } from "../../src/state/StateManager"
import { MemoryManager } from "../../src/core/MemoryManager"
import { RoleManager } from "../../src/core/RoleManager"
import { sessionRegistry } from "../../src/utils/SessionRegistry"

describe("IntegrateTool", () => {
  let stateManager: StateManager
  let memoryManager: MemoryManager
  let roleManager: RoleManager
  let testDir: string

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = path.join(
      process.cwd(),
      "tests",
      "fixtures",
      `integrate-tool-${Date.now()}`
    )
    await fs.mkdir(testDir, { recursive: true })

    // 初始化管理器
    stateManager = new StateManager("test-project", testDir, testDir)
    memoryManager = new MemoryManager(testDir)
    roleManager = new RoleManager(testDir)

    // 清空注册表
    sessionRegistry.clear()

    // 创建测试角色文件
    const rolesDir = path.join(testDir, ".cclover", "roles")
    await fs.mkdir(rolesDir, { recursive: true })

    // 创建 soulless 角色
    await fs.writeFile(
      path.join(rolesDir, "soulless-dev.md"),
      `---
name: "soulless-dev"
id: "soulless-dev"
description: "Soulless developer"
soul: false
---

Soulless developer role.
`
    )

    // 创建 soulful 角色
    await fs.writeFile(
      path.join(rolesDir, "soulful-dev.md"),
      `---
name: "soulful-dev"
id: "soulful-dev"
description: "Soulful developer"
soul: true
---

Soulful developer role.
`
    )

    // 刷新角色
    await roleManager.refresh()
  })

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true })
    } catch (error: any) {
      // 忽略清理错误
    }
  })

  test("should return message when no soulless employees found", async () => {
    // 创建工具
    const tool = createIntegrateTool(stateManager, roleManager, memoryManager)

    // 执行工具
    const result = await tool.execute({}, {} as any)

    // 验证结果
    expect(result).toBe("No soulless employees with active sessions found")
  })

  test("should skip soulless employee without active session", async () => {
    // 注册 soulless 员工
    await stateManager.registerEmployee({
      employeeId: "0-dev-1",
      name: "dev-1",
      roleId: "soulless-dev",
      status: "idle",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 初始化员工记忆（无 sessionId）
    await memoryManager.write("0-dev-1", {
      knowledge: ["some knowledge"],
      tasks: [],
      args: { projectName: "test-project" },
      roleData: { customData: "value" },
    })

    // 创建工具
    const tool = createIntegrateTool(stateManager, roleManager, memoryManager)

    // 执行工具
    const result = await tool.execute({}, {} as any)

    // 验证结果
    expect(result).toBe("No soulless employees with active sessions found")

    // 验证记忆未被修改
    const memory = await memoryManager.read("0-dev-1")
    expect(memory.knowledge).toEqual(["some knowledge"])
    expect(memory.args).toEqual({ projectName: "test-project" })
    expect(memory.roleData).toEqual({ customData: "value" })
  })

  test("should reset soulless employee with active session", async () => {
    // 注册 soulless 员工
    await stateManager.registerEmployee({
      employeeId: "0-dev-1",
      name: "dev-1",
      roleId: "soulless-dev",
      status: "busy",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 初始化员工记忆（有 sessionId）
    await memoryManager.write("0-dev-1", {
      knowledge: ["some knowledge"],
      tasks: [],
      args: { projectName: "test-project" },
      roleData: { customData: "value" },
      sessionId: "session-1",
      sessionSnapshot: {
        knowledge: [],
        tasks: [],
        args: {},
        timestamp: new Date().toISOString(),
      },
    })

    // 注册 session
    sessionRegistry.register("session-1", "0-dev-1")

    // 创建工具
    const tool = createIntegrateTool(stateManager, roleManager, memoryManager)

    // 执行工具
    const result = await tool.execute({}, {} as any)

    // 验证结果
    expect(result).toBe("Reset 1 soulless employee: dev-1")

    // 验证记忆已被重置
    const memory = await memoryManager.read("0-dev-1")
    expect(memory.sessionId).toBeUndefined()
    expect(memory.sessionSnapshot).toBeUndefined()

    // 验证 args 和 roleData 被保留
    expect(memory.args).toEqual({ projectName: "test-project" })
    expect(memory.roleData).toEqual({ customData: "value" })
    expect(memory.knowledge).toEqual(["some knowledge"])

    // 验证 sessionRegistry 已注销
    expect(sessionRegistry.has("session-1")).toBe(false)
  })

  test("should reset multiple soulless employees with active sessions", async () => {
    // 注册多个 soulless 员工
    await stateManager.registerEmployee({
      employeeId: "0-dev-1",
      name: "dev-1",
      roleId: "soulless-dev",
      status: "busy",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    await stateManager.registerEmployee({
      employeeId: "0-dev-2",
      name: "dev-2",
      roleId: "soulless-dev",
      status: "busy",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 初始化员工记忆
    await memoryManager.write("0-dev-1", {
      knowledge: [],
      tasks: [],
      args: { projectName: "project-1" },
      sessionId: "session-1",
      sessionSnapshot: {
        knowledge: [],
        tasks: [],
        args: {},
        timestamp: new Date().toISOString(),
      },
    })

    await memoryManager.write("0-dev-2", {
      knowledge: [],
      tasks: [],
      args: { projectName: "project-2" },
      sessionId: "session-2",
      sessionSnapshot: {
        knowledge: [],
        tasks: [],
        args: {},
        timestamp: new Date().toISOString(),
      },
    })

    // 注册 sessions
    sessionRegistry.register("session-1", "0-dev-1")
    sessionRegistry.register("session-2", "0-dev-2")

    // 创建工具
    const tool = createIntegrateTool(stateManager, roleManager, memoryManager)

    // 执行工具
    const result = await tool.execute({}, {} as any)

    // 验证结果
    expect(result).toBe("Reset 2 soulless employees: dev-1, dev-2")

    // 验证两个员工的记忆都被重置
    const memory1 = await memoryManager.read("0-dev-1")
    expect(memory1.sessionId).toBeUndefined()
    expect(memory1.sessionSnapshot).toBeUndefined()
    expect(memory1.args).toEqual({ projectName: "project-1" })

    const memory2 = await memoryManager.read("0-dev-2")
    expect(memory2.sessionId).toBeUndefined()
    expect(memory2.sessionSnapshot).toBeUndefined()
    expect(memory2.args).toEqual({ projectName: "project-2" })

    // 验证 sessionRegistry 都已注销
    expect(sessionRegistry.has("session-1")).toBe(false)
    expect(sessionRegistry.has("session-2")).toBe(false)
  })

  test("should only reset soulless employees, not soulful ones", async () => {
    // 注册 soulless 员工
    await stateManager.registerEmployee({
      employeeId: "0-soulless-1",
      name: "soulless-1",
      roleId: "soulless-dev",
      status: "busy",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 注册 soulful 员工
    await stateManager.registerEmployee({
      employeeId: "0-soulful-1",
      name: "soulful-1",
      roleId: "soulful-dev",
      status: "busy",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 初始化员工记忆
    await memoryManager.write("0-soulless-1", {
      knowledge: [],
      tasks: [],
      args: {},
      sessionId: "session-1",
      sessionSnapshot: {
        knowledge: [],
        tasks: [],
        args: {},
        timestamp: new Date().toISOString(),
      },
    })

    await memoryManager.write("0-soulful-1", {
      knowledge: [],
      tasks: [],
      args: {},
      sessionId: "session-2",
      sessionSnapshot: {
        knowledge: [],
        tasks: [],
        args: {},
        timestamp: new Date().toISOString(),
      },
    })

    // 注册 sessions
    sessionRegistry.register("session-1", "0-soulless-1")
    sessionRegistry.register("session-2", "0-soulful-1")

    // 创建工具
    const tool = createIntegrateTool(stateManager, roleManager, memoryManager)

    // 执行工具
    const result = await tool.execute({}, {} as any)

    // 验证结果
    expect(result).toBe("Reset 1 soulless employee: soulless-1")

    // 验证 soulless 员工被重置
    const soullessMemory = await memoryManager.read("0-soulless-1")
    expect(soullessMemory.sessionId).toBeUndefined()
    expect(soullessMemory.sessionSnapshot).toBeUndefined()

    // 验证 soulful 员工未被修改
    const soulfulMemory = await memoryManager.read("0-soulful-1")
    expect(soulfulMemory.sessionId).toBe("session-2")
    expect(soulfulMemory.sessionSnapshot).toBeDefined()

    // 验证 sessionRegistry
    expect(sessionRegistry.has("session-1")).toBe(false)
    expect(sessionRegistry.has("session-2")).toBe(true)
  })

  test("should preserve args and roleData when resetting", async () => {
    // 注册 soulless 员工
    await stateManager.registerEmployee({
      employeeId: "0-dev-1",
      name: "dev-1",
      roleId: "soulless-dev",
      status: "busy",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 初始化员工记忆（有复杂的 args 和 roleData）
    await memoryManager.write("0-dev-1", {
      knowledge: ["knowledge-1", "knowledge-2"],
      tasks: [
        {
          name: "task-1",
          description: "Test task",
          status: "completed",
          dependencies: [],
          created: new Date().toISOString(),
        },
      ],
      args: {
        projectName: "test-project",
        teamSize: 5,
        nested: { key: "value" },
      },
      roleData: {
        customField1: "value1",
        customField2: 123,
        customField3: { nested: "data" },
      },
      sessionId: "session-1",
      sessionSnapshot: {
        knowledge: [],
        tasks: [],
        args: {},
        timestamp: new Date().toISOString(),
      },
    })

    // 注册 session
    sessionRegistry.register("session-1", "0-dev-1")

    // 创建工具
    const tool = createIntegrateTool(stateManager, roleManager, memoryManager)

    // 执行工具
    await tool.execute({}, {} as any)

    // 验证记忆
    const memory = await memoryManager.read("0-dev-1")

    // sessionId 和 sessionSnapshot 被清除
    expect(memory.sessionId).toBeUndefined()
    expect(memory.sessionSnapshot).toBeUndefined()

    // args 和 roleData 完全保留
    expect(memory.args).toEqual({
      projectName: "test-project",
      teamSize: 5,
      nested: { key: "value" },
    })
    expect(memory.roleData).toEqual({
      customField1: "value1",
      customField2: 123,
      customField3: { nested: "data" },
    })

    // knowledge 和 tasks 也保留
    expect(memory.knowledge).toEqual(["knowledge-1", "knowledge-2"])
    expect(memory.tasks).toHaveLength(1)
    expect(memory.tasks[0].name).toBe("task-1")
  })

  test("should handle employee with role not found", async () => {
    // 注册员工（角色不存在）
    await stateManager.registerEmployee({
      employeeId: "0-dev-1",
      name: "dev-1",
      roleId: "unknown-role",
      hiredBy: null,
      status: "busy",
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 初始化员工记忆
    await memoryManager.write("0-dev-1", {
      knowledge: [],
      tasks: [],
      args: {},
      sessionId: "session-1",
      sessionSnapshot: {
        knowledge: [],
        tasks: [],
        args: {},
        timestamp: new Date().toISOString(),
      },
    })

    // 创建工具
    const tool = createIntegrateTool(stateManager, roleManager, memoryManager)

    // 执行工具
    const result = await tool.execute({}, {} as any)

    // 验证结果（角色不存在，被跳过）
    expect(result).toBe("No soulless employees with active sessions found")
  })
})
