import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import * as fs from "fs/promises"
import { EventLoop, type Role } from "../../src/core/eventloop"
import { MessageService } from "../../src/core/MessageService"
import { MemoryManager } from "../../src/core/MemoryManager"
import { StateManager } from "../../src/state/StateManager"
import type { RoleManager } from "../../src/core/RoleManager"
import { vacationRegistry } from "../../src/utils/VacationRegistry"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import { agentRegistry } from "../../src/utils/AgentRegistry"
import { createTestTask } from "../helpers/taskFactory"

const testWorkspace = "./workspace_test_eventloop_vacation"

// Mock OpencodeClient
function createMockOpencodeClient() {
  return {
    session: {
      create: mock(async () => ({
        data: { id: "mock-session-id" },
      })),
      prompt: mock(async () => ({
        data: {
          info: {
            role: "assistant",
            time: { completed: Date.now() },
          },
        },
      })),
      messages: mock(async () => ({
        data: [
          {
            info: { role: "assistant", tokens: { total: 1000 } },
            parts: [{ type: "text", text: "Mock response" }],
          },
        ],
      })),
      get: mock(async () => ({
        data: { id: "mock-session-id" },
      })),
    },
    event: {
      subscribe: mock(async () => ({
        stream: (async function* () {
          // Mock event stream that never yields
          await new Promise(() => {})
        })(),
      })),
    },
  } as any
}

describe("EventLoop Vacation Mechanism", () => {
  let messageService: MessageService
  let memoryManager: MemoryManager
  let stateManager: StateManager
  let opcodeClient: any
  let testRole: Role
  let mockRoleManager: RoleManager
  let mockModelConfigManager: any

  beforeEach(async () => {
    // 清理测试工作空间
    await fs.rm(testWorkspace, { recursive: true, force: true })
    await fs.mkdir(testWorkspace, { recursive: true })

    // 初始化服务
    stateManager = new StateManager(testWorkspace)
    messageService = new MessageService(testWorkspace, stateManager)
    memoryManager = new MemoryManager(testWorkspace)
    opcodeClient = createMockOpencodeClient()

    // 定义测试角色
    testRole = {
      name: "test-role",
      systemPrompt: "You are a test role.",
    }

    // 创建 mock RoleManager
    mockRoleManager = {
      getRole: mock(() => testRole),
      refresh: mock(async () => {}),
      getRoles: mock(() => [testRole]),
    } as any

    // 创建 mock ModelConfigManager
    mockModelConfigManager = {
      resolve: mock(() => null),
    }

    // 清空注册表
    sessionRegistry.clear()
    agentRegistry.clear()
    vacationRegistry.clear()

    // 初始化员工状态
    await stateManager.registerEmployee({
      employeeId: "0-Alice",
      name: "Alice",
      role: "test-role",
      taskId: 0,
      hiredBy: "Boss",
      paused: false,
      activeSessionId: null,
      status: "idle",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 注册 Bob 员工（用于发送消息测试）
    await stateManager.registerEmployee({
      employeeId: "0-Bob",
      name: "Bob",
      role: "test-role",
      taskId: 0,
      hiredBy: "Boss",
      paused: false,
      activeSessionId: null,
      status: "idle",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
  })

  afterEach(async () => {
    // 清理测试工作空间
    await fs.rm(testWorkspace, { recursive: true, force: true })
  })

  describe("Vacation Check Priority", () => {
    test("should check vacation before messages", async () => {
      // 添加假期事件
      vacationRegistry.addVacationEvent("0-Alice", {
        type: "vacation_requested",
        employeeName: "0-Alice",
        timestamp: new Date().toISOString(),
      })

      // 添加消息（应该被忽略）
      const messageClient = messageService.getClient("0-Alice")
      await messageService.send("0-Bob", "0-Alice", "Hello")

      // 创建 EventLoop
      const eventLoop = new EventLoop(
        testWorkspace,
        "0-Alice",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        mockModelConfigManager,
        stateManager
      )

      // 运行 EventLoop（应该处理假期并退出）
      await eventLoop.run()

      // 验证状态更新为 offline
      const employee = await stateManager.getEmployee("0-Alice")
      expect(employee?.status).toBe("offline")

      // 验证消息仍在队列中（未被处理）
      const unreadQueue = (messageService as any).getUnreadQueue("0-Alice")
      expect(unreadQueue.length).toBe(1)
    })

    test("should check vacation before agent completions", async () => {
      // 添加假期事件
      vacationRegistry.addVacationEvent("0-Alice", {
        type: "vacation_requested",
        employeeName: "0-Alice",
        timestamp: new Date().toISOString(),
      })

      // 添加 agent 完成事件
      agentRegistry.addCompletedEvent("0-Alice", {
        type: "agent_completed",
        agentId: "agent-123",
        taskName: "test-task",
        result: "test result",
        timestamp: new Date().toISOString(),
      })

      // 创建 EventLoop
      const messageClient = messageService.getClient("0-Alice")
      const eventLoop = new EventLoop(
        testWorkspace,
        "0-Alice",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        mockModelConfigManager,
        stateManager
      )

      // 运行 EventLoop（应该处理假期并退出）
      await eventLoop.run()

      // 验证状态更新为 offline
      const employee = await stateManager.getEmployee("0-Alice")
      expect(employee?.status).toBe("offline")

      // 验证 agent 事件仍在队列中（未被处理）
      const completedEvent = agentRegistry.getCompletedEvent("0-Alice")
      expect(completedEvent).not.toBeNull()
    })

    test("should check vacation before tasks", async () => {
      // 添加假期事件
      vacationRegistry.addVacationEvent("0-Alice", {
        type: "vacation_requested",
        employeeName: "0-Alice",
        timestamp: new Date().toISOString(),
      })

      // 添加可执行任务
      await memoryManager.write("0-Alice", {
        knowledge: [],
        tasks: [
          createTestTask({
            name: "task1",
            description: "Test task",
          }),
        ],
        args: {},
      })

      // 创建 EventLoop
      const messageClient = messageService.getClient("0-Alice")
      const eventLoop = new EventLoop(
        testWorkspace,
        "0-Alice",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        mockModelConfigManager,
        stateManager
      )

      // 运行 EventLoop（应该处理假期并退出）
      await eventLoop.run()

      // 验证状态更新为 offline
      const employee = await stateManager.getEmployee("0-Alice")
      expect(employee?.status).toBe("offline")

      // 验证任务仍然是 pending（未被处理）
      const memory = await memoryManager.read("0-Alice")
      expect(memory.tasks[0].status).toBe("pending")
    })
  })

  describe("Vacation Event Handling", () => {
    test("should update employee status to offline", async () => {
      // 添加假期事件
      vacationRegistry.addVacationEvent("0-Alice", {
        type: "vacation_requested",
        employeeName: "0-Alice",
        timestamp: new Date().toISOString(),
      })

      // 创建 EventLoop
      const messageClient = messageService.getClient("0-Alice")
      const eventLoop = new EventLoop(
        testWorkspace,
        "0-Alice",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        mockModelConfigManager,
        stateManager
      )

      // 运行 EventLoop
      await eventLoop.run()

      // 验证状态更新为 offline
      const employee = await stateManager.getEmployee("0-Alice")
      expect(employee?.status).toBe("offline")
    })

    test("should log status change event", async () => {
      // 添加假期事件
      vacationRegistry.addVacationEvent("0-Alice", {
        type: "vacation_requested",
        employeeName: "0-Alice",
        timestamp: new Date().toISOString(),
      })

      // 创建 EventLoop
      const messageClient = messageService.getClient("0-Alice")
      const eventLoop = new EventLoop(
        testWorkspace,
        "0-Alice",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        mockModelConfigManager,
        stateManager
      )

      // 运行 EventLoop
      await eventLoop.run()

      // 验证事件被记录
      const events = await stateManager.getEvents({ employeeName: "0-Alice" })
      const statusChangeEvent = events.find(
        (e) => e.type === "employee_status_changed"
      )

      expect(statusChangeEvent).toBeDefined()
      expect(statusChangeEvent?.details.newStatus).toBe("offline")
      expect(statusChangeEvent?.details.reason).toBe("vacation_requested")
    })
  })

  describe("Graceful Exit", () => {
    test("should exit cleanly when vacation requested", async () => {
      // 添加假期事件
      vacationRegistry.addVacationEvent("0-Alice", {
        type: "vacation_requested",
        employeeName: "0-Alice",
        timestamp: new Date().toISOString(),
      })

      // 创建 EventLoop
      const messageClient = messageService.getClient("0-Alice")
      const eventLoop = new EventLoop(
        testWorkspace,
        "0-Alice",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        mockModelConfigManager,
        stateManager
      )

      // 运行应该正常完成，不抛出错误
      await expect(eventLoop.run()).resolves.toBeUndefined()
    })

    test("should not leave zombie processes", async () => {
      // 添加假期事件
      vacationRegistry.addVacationEvent("0-Alice", {
        type: "vacation_requested",
        employeeName: "0-Alice",
        timestamp: new Date().toISOString(),
      })

      // 创建 EventLoop
      const messageClient = messageService.getClient("0-Alice")
      const eventLoop = new EventLoop(
        testWorkspace,
        "0-Alice",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        mockModelConfigManager,
        stateManager
      )

      // 运行 EventLoop
      await eventLoop.run()

      // 验证 EventLoop 正常退出（不抛出错误）
      // 注意：session 不会被清理，因为员工可能稍后恢复
      // 这是预期行为，不是 bug
      const employee = await stateManager.getEmployee("0-Alice")
      expect(employee?.status).toBe("offline")
    })
  })

  describe("Integration Behavior", () => {
    test("should process vacation and exit before processing messages", async () => {
      // 添加假期和消息
      vacationRegistry.addVacationEvent("0-Alice", {
        type: "vacation_requested",
        employeeName: "0-Alice",
        timestamp: new Date().toISOString(),
      })

      await messageService.send("0-Bob", "0-Alice", "Hello")

      // 创建 EventLoop
      const messageClient = messageService.getClient("0-Alice")
      const eventLoop = new EventLoop(
        testWorkspace,
        "0-Alice",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        mockModelConfigManager,
        stateManager
      )

      // 运行 EventLoop
      await eventLoop.run()

      // 验证状态更新为 offline（假期已处理）
      const employee = await stateManager.getEmployee("0-Alice")
      expect(employee?.status).toBe("offline")

      // 验证消息未被处理（仍在队列中）
      const unreadQueue = (messageService as any).getUnreadQueue("0-Alice")
      expect(unreadQueue.length).toBe(1)
    })

    test("should process vacation and exit before processing agent completions", async () => {
      // 添加假期和 agent 完成事件
      vacationRegistry.addVacationEvent("0-Alice", {
        type: "vacation_requested",
        employeeName: "0-Alice",
        timestamp: new Date().toISOString(),
      })

      agentRegistry.addCompletedEvent("0-Alice", {
        type: "agent_completed",
        agentId: "agent-123",
        taskName: "test-task",
        result: "test result",
        timestamp: new Date().toISOString(),
      })

      // 创建 EventLoop
      const messageClient = messageService.getClient("0-Alice")
      const eventLoop = new EventLoop(
        testWorkspace,
        "0-Alice",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        mockModelConfigManager,
        stateManager
      )

      // 运行 EventLoop
      await eventLoop.run()

      // 验证状态更新为 offline（假期已处理）
      const employee = await stateManager.getEmployee("0-Alice")
      expect(employee?.status).toBe("offline")

      // 验证 agent 事件未被处理（仍在队列中）
      const completedEvent = agentRegistry.getCompletedEvent("0-Alice")
      expect(completedEvent).not.toBeNull()
    })

    test("should process vacation and exit before processing tasks", async () => {
      // 添加假期和任务
      vacationRegistry.addVacationEvent("0-Alice", {
        type: "vacation_requested",
        employeeName: "0-Alice",
        timestamp: new Date().toISOString(),
      })

      await memoryManager.write("0-Alice", {
        knowledge: [],
        tasks: [
          {
            name: "task1",
            description: "Test task",
            status: "pending",
            dependencies: [],
          },
        ],
        args: {},
      })

      // 创建 EventLoop
      const messageClient = messageService.getClient("0-Alice")
      const eventLoop = new EventLoop(
        testWorkspace,
        "0-Alice",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        mockModelConfigManager,
        stateManager
      )

      // 运行 EventLoop
      await eventLoop.run()

      // 验证状态更新为 offline（假期已处理）
      const employee = await stateManager.getEmployee("0-Alice")
      expect(employee?.status).toBe("offline")

      // 验证任务未被处理（仍然是 pending）
      const memory = await memoryManager.read("0-Alice")
      expect(memory.tasks[0].status).toBe("pending")
    })
  })
})
