import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import { GlobalCcloverService } from "../../src/server/GlobalServer"
import { ProjectRegistry } from "../../src/server/ProjectRegistry"
import type { ProjectInstance } from "../../src/server/ProjectRegistry"
import { StateManager } from "../../src/state/StateManager"
import { MessageService } from "../../src/core/MessageService"
import { MemoryManager } from "../../src/core/MemoryManager"
import { RoleManager } from "../../src/core/RoleManager"
import { BossManager } from "../../src/core/BossManager"
import { AgentRegistry } from "../../src/utils/AgentRegistry"
import { EventLoop } from "../../src/core/eventloop"
import { OpencodeClient } from "@opencode-ai/sdk"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"

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
        create: mock(() => Promise.resolve({ id: "test-session" })),
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
    const agentRegistry = new AgentRegistry()
    const roleManager = new RoleManager(projectPath)

    // 创建测试角色文件
    const rolesDir = path.join(projectPath, ".cclover/roles")
    await fs.mkdir(rolesDir, { recursive: true })
    await fs.writeFile(
      path.join(rolesDir, "test-role.md"),
      `---
name: "test-role"
description: "Test role"
---

Test role system prompt`
    )
    await roleManager.refresh()

    // 注册测试员工
    await stateManager.registerEmployee({
      employeeId: "0-test-employee",
      name: "test-employee",
      taskId: 0,
      role: "test-role",
      status: "idle",
      paused: false,
      hiredBy: "boss1",
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    projectInstance = {
      projectId,
      projectName: "test-project",
      directory: projectPath,
      workspaceRoot,
      stateManager,
      messageService,
      memoryManager,
      agentRegistry,
      bossManager,
      roleManager,
      eventLoopStarted: false,
      eventLoops: new Map(),
    }

    // 注册项目到 registry
    const service = await GlobalCcloverService.getInstance()
    const registry = service.getProjectRegistry()
    registry.register(projectInstance)
  })

  afterEach(async () => {
    // 恢复原始端口环境变量
    if (originalPort === undefined) {
      delete process.env.CCLOVER_PORT
    } else {
      process.env.CCLOVER_PORT = originalPort
    }

    // 清理测试目录
    await fs.rm(testDir, { recursive: true, force: true })
  })

  test("should start EventLoop for valid employee", async () => {
    const service = await GlobalCcloverService.getInstance()

    // 启动 EventLoop
    await service.startEmployeeEventLoop(projectId, "0-test-employee")

    // 验证 EventLoop 已创建并存储
    expect(projectInstance.eventLoops.has("0-test-employee")).toBe(true)
    const eventLoop = projectInstance.eventLoops.get("0-test-employee")
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
    await service.startEmployeeEventLoop(projectId, "0-test-employee")
    const firstEventLoop = projectInstance.eventLoops.get("test-employee")

    // 第二次启动（应该返回而不是创建新的）
    await service.startEmployeeEventLoop(projectId, "0-test-employee")
    const secondEventLoop = projectInstance.eventLoops.get("test-employee")

    // 验证是同一个 EventLoop 实例
    expect(secondEventLoop).toBe(firstEventLoop)
    expect(projectInstance.eventLoops.size).toBe(1)
  })

  test("should throw error for employee with missing role", async () => {
    const service = await GlobalCcloverService.getInstance()

    // 注册一个角色不存在的员工
    await projectInstance.stateManager.registerEmployee({
      employeeId: "0-employee-with-missing-role",
      name: "employee-with-missing-role",
      taskId: 0,
      role: "non-existent-role",
      status: "idle",
      paused: false,
      hiredBy: "boss1",
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 尝试启动 EventLoop
    await expect(
      service.startEmployeeEventLoop(projectId, "0-employee-with-missing-role")
    ).rejects.toThrow(
      "Role 'non-existent-role' not found for employee '0-employee-with-missing-role'"
    )
  })

  test("should handle EventLoop runtime errors gracefully", async () => {
    const service = await GlobalCcloverService.getInstance()

    // 启动 EventLoop
    await service.startEmployeeEventLoop(projectId, "0-test-employee")

    // 验证 EventLoop 已创建
    expect(projectInstance.eventLoops.has("0-test-employee")).toBe(true)

    // 注意：EventLoop.run() 的错误处理是通过 .catch() 完成的
    // 这里我们只验证 EventLoop 被正确创建和存储
    // 实际的错误处理测试应该在 EventLoop.test.ts 中进行
  })

  test("should start multiple EventLoops for different employees", async () => {
    const service = await GlobalCcloverService.getInstance()

    // 注册第二个员工
    await projectInstance.stateManager.registerEmployee({
      employeeId: "0-test-employee-2",
      name: "test-employee-2",
      taskId: 0,
      role: "test-role",
      status: "idle",
      paused: false,
      hiredBy: "boss1",
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 启动两个 EventLoop
    await service.startEmployeeEventLoop(projectId, "0-test-employee")
    await service.startEmployeeEventLoop(projectId, "0-test-employee-2")

    // 验证两个 EventLoop 都已创建
    expect(projectInstance.eventLoops.size).toBe(2)
    expect(projectInstance.eventLoops.has("0-test-employee")).toBe(true)
    expect(projectInstance.eventLoops.has("0-test-employee-2")).toBe(true)
  })
})
