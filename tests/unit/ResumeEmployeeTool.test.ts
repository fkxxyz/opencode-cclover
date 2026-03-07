import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { BossManager } from "../../src/core/BossManager"
import { StateManager } from "../../src/state/StateManager"
import { createResumeEmployeeTool } from "../../src/tools/ResumeEmployeeTool"
import type { CcloverConfig } from "../../src/config/ConfigManager"
import type { ProjectInstance } from "../../src/server/ProjectRegistry"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../fixtures/resume-employee-tool-test"
)

describe("ResumeEmployeeTool", () => {
  let bossManager: BossManager
  let messageService: MessageService
  let stateManager: StateManager
  let resumeEmployeeTool: any
  let project: ProjectInstance

  beforeEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 创建配置
    const config: CcloverConfig = {
      bosses: ["boss1"],
      projects: [],
    }

    // 初始化服务
    const projectId = "test-project"
    bossManager = new BossManager(config, TEST_WORKSPACE)
    stateManager = new StateManager(projectId, TEST_WORKSPACE, TEST_WORKSPACE)
    messageService = new MessageService(
      TEST_WORKSPACE,
      stateManager,
      projectId,
      bossManager,
      null as any
    )

    // 创建 project 实例
    project = {
      projectId,
      projectName: "test-project",
      directory: TEST_WORKSPACE,
      workspaceRoot: TEST_WORKSPACE,
      stateManager,
      messageService,
      memoryManager: null as any,
      agentRegistry: null as any,
      bossManager,
      roleManager: null as any,
      eventLoopStarted: false,
      eventLoops: new Map(),
    }

    // 创建工具
    resumeEmployeeTool = createResumeEmployeeTool(
      stateManager,
      bossManager,
      project
    )

    // 注册测试员工
    await stateManager.registerEmployee({
      name: "employee1",
      role: "developer",
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "supervisor1",
    })

    await stateManager.registerEmployee({
      name: "employee2",
      role: "developer",
      status: "idle",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: "supervisor1",
    })

    await stateManager.registerEmployee({
      name: "supervisor1",
      role: "manager",
      status: "idle",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
  })

  afterEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  test("should resume employee when called by Boss", async () => {
    // 注册 session
    sessionRegistry.register("session-boss", "boss1")

    const result = await resumeEmployeeTool.execute(
      { employeeName: "employee1" },
      { sessionID: "session-boss", agent: "boss1" }
    )

    expect(result).toContain("has been resumed")
    expect(result).toContain("EventLoop is starting")

    // 验证状态已更新
    const employee = stateManager.getEmployee("employee1")
    expect(employee?.status).toBe("idle")
  })

  test("should resume employee when called by direct supervisor", async () => {
    // 注册 session
    sessionRegistry.register("session-supervisor", "supervisor1")

    const result = await resumeEmployeeTool.execute(
      { employeeName: "employee1" },
      { sessionID: "session-supervisor", agent: "supervisor1" }
    )

    expect(result).toContain("has been resumed")
    expect(result).toContain("EventLoop is starting")

    // 验证状态已更新
    const employee = stateManager.getEmployee("employee1")
    expect(employee?.status).toBe("idle")
  })

  test("should reject when called by non-authorized user", async () => {
    // 注册另一个员工
    await stateManager.registerEmployee({
      name: "other-employee",
      role: "developer",
      status: "idle",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    sessionRegistry.register("session-other", "other-employee")

    const result = await resumeEmployeeTool.execute(
      { employeeName: "employee1" },
      { sessionID: "session-other", agent: "other-employee" }
    )

    expect(result).toContain("Permission denied")
    expect(result).toContain("Only Boss or direct supervisor")

    // 验证状态未更新
    const employee = stateManager.getEmployee("employee1")
    expect(employee?.status).toBe("offline")
  })

  test("should reject when employee not found", async () => {
    sessionRegistry.register("session-boss", "boss1")

    const result = await resumeEmployeeTool.execute(
      { employeeName: "nonexistent" },
      { sessionID: "session-boss", agent: "boss1" }
    )

    expect(result).toContain("not found")
  })

  test("should reject when employee is not offline", async () => {
    sessionRegistry.register("session-boss", "boss1")

    const result = await resumeEmployeeTool.execute(
      { employeeName: "employee2" },
      { sessionID: "session-boss", agent: "boss1" }
    )

    expect(result).toContain("is not on vacation")
    expect(result).toContain("current status: idle")
  })

  test("should handle operator identification failure", async () => {
    const result = await resumeEmployeeTool.execute(
      { employeeName: "employee1" },
      { sessionID: "unknown-session", agent: undefined }
    )

    expect(result).toContain("Unable to identify operator")
  })

  test("should work with Boss identified from context.agent", async () => {
    // 不注册 session，只通过 context.agent 识别
    const result = await resumeEmployeeTool.execute(
      { employeeName: "employee1" },
      { sessionID: "unknown-session", agent: "boss1" }
    )

    expect(result).toContain("has been resumed")

    // 验证状态已更新
    const employee = stateManager.getEmployee("employee1")
    expect(employee?.status).toBe("idle")
  })
})
