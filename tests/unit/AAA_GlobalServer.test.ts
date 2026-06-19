import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { GlobalCcloverService } from "../../src/server/GlobalServer"
import { ProjectRegistry } from "../../src/server/ProjectRegistry"
import type { ProjectInstance } from "../../src/server/ProjectRegistry"
import { StateManager } from "../../src/state/StateManager"
import { MessageService } from "../../src/core/MessageService"
import { MemoryManager } from "../../src/core/MemoryManager"
import { RoleManager } from "../../src/core/RoleManager"
import { BossManager } from "../../src/core/BossManager"
import { RootTaskManager } from "../../src/core/RootTaskManager"
import { WorkItemManager } from "../../src/core/WorkItemManager"
import { AgentRegistry } from "../../src/utils/AgentRegistry"
import { EventLoop } from "../../src/core/eventloop"
import { OpencodeClient } from "@opencode-ai/sdk"
import { ModelConfigManager } from "../../src/config/ModelConfigManager"
import { MeetingModePromptInjector } from "../../src/meeting-mode/PromptInjector"
import { createTestEmployee } from "../helpers/employeeFactory"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"

async function suppressExpectedWarnings<T>(
  callback: () => Promise<T>
): Promise<T> {
  const originalWarn = console.warn
  console.warn = () => {}

  try {
    return await callback()
  } finally {
    console.warn = originalWarn
  }
}

describe("GlobalCcloverService.startEmployeeEventLoop", () => {
  let testDir: string
  let projectPath: string
  let workspaceRoot: string
  let projectId: string
  let mockOpcodeClient: OpencodeClient
  let projectInstance: ProjectInstance
  let originalPort: string | undefined
  let testPort: number

  beforeEach(async () => {
    // Reset GlobalCcloverService singleton
    // @ts-ignore - accessing private static for testing
    GlobalCcloverService.instance = null
    // @ts-ignore - accessing private static for testing
    GlobalCcloverService.initPromise = null
    // @ts-ignore - accessing private static for testing
    GlobalCcloverService.opcodeClient = null

    // 保存原始端口环境变量
    originalPort = process.env.CCLOVER_PORT

    // 使用随机端口避免冲突
    testPort = 10000 + Math.floor(Math.random() * 10000)
    process.env.CCLOVER_PORT = testPort.toString()

    // 创建临时测试目录
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), "cclover-test-"))
    projectPath = path.join(testDir, "test-project")
    workspaceRoot = path.join(projectPath, ".cclover/workspace")
    await fs.mkdir(workspaceRoot, { recursive: true })

    // 创建 mock OpencodeClient
    mockOpcodeClient = {
      session: {
        create: mock(() => Promise.resolve({ data: { id: "test-session" } })),
        get: mock(() => Promise.resolve({ data: { id: "test-session" } })),
        messages: mock(() => Promise.resolve({ data: [] })),
        status: mock(() => Promise.resolve({})),
      },
      event: {
        subscribe: mock(async () => ({
          stream: (async function* () {
            // Mock event stream that waits indefinitely without throwing errors
            await new Promise(() => {})
          })(),
        })),
      },
    } as any

    // 注入 OpencodeClient
    GlobalCcloverService.setOpencodeClient(mockOpcodeClient)

    // 创建项目实例
    projectId = ProjectRegistry.hashPath(projectPath)
    const stateManager = new StateManager(projectId, workspaceRoot, projectPath)
    const bossManager = new BossManager(
      { bosses: [], projects: [] },
      workspaceRoot
    )
    const messageService = new MessageService(
      workspaceRoot,
      stateManager,
      projectId,
      bossManager,
      mockOpcodeClient
    )
    const memoryManager = new MemoryManager(
      workspaceRoot,
      stateManager,
      projectId
    )
    const workItemManager = new WorkItemManager(projectPath, stateManager)
    const rootTaskManager = new RootTaskManager(
      projectPath,
      stateManager,
      workItemManager
    )
    const agentRegistry = new AgentRegistry()
    const roleManager = new RoleManager(projectPath)

    // 创建测试角色文件
    const rolesDir = path.join(projectPath, ".cclover/roles")
    await fs.mkdir(rolesDir, { recursive: true })
    await fs.writeFile(
      path.join(rolesDir, "test-role.md"),
      `---
name: "test-role"
id: "test-role"
description: "Test role"
---

Test role system prompt`
    )
    await roleManager.refresh()

    // 创建 ModelConfigManager 和 MeetingModePromptInjector
    const modelConfigManager = new ModelConfigManager(
      { bosses: [], projects: [] },
      {}
    )
    const meetingModePromptInjector = new MeetingModePromptInjector(
      projectId,
      "test-project"
    )

    // 注册测试员工
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_test_employee",
        name: "test-employee",
        roleId: "test-role",
        status: "idle",
        paused: false,
        hiredBy: "boss1",
      })
    )

    projectInstance = {
      projectId,
      projectName: "test-project",
      directory: projectPath,
      workspaceRoot,
      stateManager,
      messageService,
      memoryManager,
      rootTaskManager,
      workItemManager,
      agentRegistry,
      bossManager,
      roleManager,
      modelConfigManager,
      meetingModePromptInjector,
      feedbackManager: {} as any,
      eventLoopStarted: false,
      eventLoopStarting: null,
      eventLoops: new Map(),
    }

    // 注册项目到 registry
    const service = await GlobalCcloverService.getInstance()
    const registry = service.getProjectRegistry()
    registry.register(projectInstance)
  })

  afterEach(async () => {
    // 清理后台 EventLoop，避免跨测试残留异步日志
    if (projectInstance) {
      for (const eventLoop of projectInstance.eventLoops.values()) {
        await eventLoop.stop()
      }
      projectInstance.eventLoops.clear()
    }

    // 恢复原始端口环境变量
    if (originalPort === undefined) {
      delete process.env.CCLOVER_PORT
    } else {
      process.env.CCLOVER_PORT = originalPort
    }

    // 清理测试目录
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true })
    }

    // Reset GlobalCcloverService singleton
    // @ts-ignore - accessing private static for testing
    GlobalCcloverService.instance = null
    // @ts-ignore - accessing private static for testing
    GlobalCcloverService.initPromise = null
    // @ts-ignore - accessing private static for testing
    GlobalCcloverService.opcodeClient = null
  })

  test("should start EventLoop for valid employee", async () => {
    const service = await GlobalCcloverService.getInstance()

    // 启动 EventLoop
    await service.startEmployeeEventLoop(projectId, "emp_test_employee")

    // 验证 EventLoop 已创建并存储
    expect(projectInstance.eventLoops.has("emp_test_employee")).toBe(true)
    const eventLoop = projectInstance.eventLoops.get("emp_test_employee")
    expect(eventLoop).toBeInstanceOf(EventLoop)
  })

  test("should throw error for invalid project", async () => {
    const service = await GlobalCcloverService.getInstance()

    // 尝试启动不存在的项目的 EventLoop
    await expect(
      service.startEmployeeEventLoop("invalid-project-id", "test-employee")
    ).rejects.toThrow("Project not found: invalid-project-id")
  })

  test("should throw error for invalid employee", async () => {
    const service = await GlobalCcloverService.getInstance()

    // 尝试启动不存在的员工的 EventLoop
    await expect(
      service.startEmployeeEventLoop(projectId, "non-existent-employee")
    ).rejects.toThrow("Employee not found: non-existent-employee")
  })

  test("should be idempotent (safe to call multiple times)", async () => {
    const service = await GlobalCcloverService.getInstance()

    // 第一次启动
    await service.startEmployeeEventLoop(projectId, "emp_test_employee")
    const firstEventLoop = projectInstance.eventLoops.get("emp_test_employee")

    // 第二次启动（应该返回而不是创建新的）
    await suppressExpectedWarnings(async () => {
      await service.startEmployeeEventLoop(projectId, "emp_test_employee")
    })
    const secondEventLoop = projectInstance.eventLoops.get("emp_test_employee")

    // 验证是同一个 EventLoop 实例
    expect(secondEventLoop).toBe(firstEventLoop)
    expect(projectInstance.eventLoops.size).toBe(1)
  })

  test("should throw error for employee with missing role", async () => {
    const service = await GlobalCcloverService.getInstance()

    // 注册一个角色不存在的员工
    await projectInstance.stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_employee_with_missing_role",
        name: "employee-with-missing-role",
        roleId: "non-existent-role",
        status: "idle",
        hiredBy: "boss1",
      })
    )

    // 尝试启动 EventLoop
    await expect(
      service.startEmployeeEventLoop(
        projectId,
        "emp_employee_with_missing_role"
      )
    ).rejects.toThrow(
      "Role 'non-existent-role' not found for employee 'emp_employee_with_missing_role'"
    )
  })

  test("should handle EventLoop runtime errors gracefully", async () => {
    const service = await GlobalCcloverService.getInstance()

    // 启动 EventLoop
    await service.startEmployeeEventLoop(projectId, "emp_test_employee")

    // 验证 EventLoop 已创建
    expect(projectInstance.eventLoops.has("emp_test_employee")).toBe(true)

    // 注意：EventLoop.run() 的错误处理是通过 .catch() 完成的
    // 这里我们只验证 EventLoop 被正确创建和存储
    // 实际的错误处理测试应该在 EventLoop.test.ts 中进行
  })

  test("should start multiple EventLoops for different employees", async () => {
    const service = await GlobalCcloverService.getInstance()

    // 注册第二个员工
    await projectInstance.stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_test_employee_2",
        name: "test-employee-2",
        roleId: "test-role",
        status: "idle",
        hiredBy: "boss1",
      })
    )

    // 启动两个 EventLoop
    await service.startEmployeeEventLoop(projectId, "emp_test_employee")
    await service.startEmployeeEventLoop(projectId, "emp_test_employee_2")

    // 验证两个 EventLoop 都已创建
    expect(projectInstance.eventLoops.size).toBe(2)
    expect(projectInstance.eventLoops.has("emp_test_employee")).toBe(true)
    expect(projectInstance.eventLoops.has("emp_test_employee_2")).toBe(true)
  })

  test("should inject startup prompt recovery event for active employee", async () => {
    await projectInstance.stateManager.setPromptRecovery("emp_test_employee", {
      version: 1,
      sessionId: "session-recover",
      startedAt: "2026-04-08T00:00:00.000Z",
      triggerEventType: "message",
    })

    const service = await GlobalCcloverService.getInstance()
    await service.startEmployees(projectInstance)

    const eventLoop = projectInstance.eventLoops.get("emp_test_employee") as any
    expect(eventLoop).toBeInstanceOf(EventLoop)
    expect(eventLoop.recoveryQueue).toHaveLength(1)
    expect(eventLoop.recoveryQueue[0]).toMatchObject({
      type: "prompt_recovery",
      sessionId: "session-recover",
      triggerEventType: "message",
    })
  })

  test("should not inject startup prompt recovery event for paused employee", async () => {
    await projectInstance.stateManager.setPromptRecovery("emp_test_employee", {
      version: 1,
      sessionId: "session-recover",
      startedAt: "2026-04-08T00:00:00.000Z",
      triggerEventType: "message",
    })
    await projectInstance.stateManager.pauseEmployee("emp_test_employee")

    const service = await GlobalCcloverService.getInstance()
    await service.startEmployees(projectInstance)

    expect(projectInstance.eventLoops.has("emp_test_employee")).toBe(false)
  })

  test("should not treat persisted runtime offline status as recovery gating", async () => {
    await projectInstance.stateManager.setPromptRecovery("emp_test_employee", {
      version: 1,
      sessionId: "session-recover",
      startedAt: "2026-04-08T00:00:00.000Z",
      triggerEventType: "message",
    })
    await projectInstance.stateManager.updateEmployeeStatus(
      "emp_test_employee",
      "offline"
    )

    const service = await GlobalCcloverService.getInstance()
    await service.startEmployees(projectInstance)

    const eventLoop = projectInstance.eventLoops.get("emp_test_employee") as any
    expect(eventLoop).toBeInstanceOf(EventLoop)
    expect(eventLoop.recoveryQueue).toHaveLength(1)
    expect(
      projectInstance.stateManager.getEmployee("emp_test_employee")?.status
    ).not.toBe("offline")
  })
})
