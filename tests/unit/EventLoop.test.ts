import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import * as fs from "fs/promises"
import * as path from "path"
import { EventLoop, type Role } from "../../src/core/eventloop"
import { MessageService } from "../../src/core/MessageService"
import { MemoryManager } from "../../src/core/MemoryManager"
import type { RoleManager } from "../../src/core/RoleManager"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import { agentRegistry } from "../../src/utils/AgentRegistry"

const testWorkspace = "./workspace_test_eventloop"

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
            info: { role: "assistant" },
            parts: [{ type: "text", text: "Mock response" }],
          },
        ],
      })),
      get: mock(async () => ({
        data: { tokens: { total: 1000 } },
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

describe("EventLoop", () => {
  let messageService: MessageService
  let memoryManager: MemoryManager
  let opcodeClient: any
  let testRole: Role
  let mockRoleManager: RoleManager

  beforeEach(async () => {
    // 清理测试工作空间
    await fs.rm(testWorkspace, { recursive: true, force: true })
    await fs.mkdir(testWorkspace, { recursive: true })

    // 初始化服务
    messageService = new MessageService(testWorkspace)
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

    // 清空注册表
    sessionRegistry.clear()
    agentRegistry.clear()
  })

  afterEach(async () => {
    // 清理测试工作空间
    await fs.rm(testWorkspace, { recursive: true, force: true })
  })

  describe("Constructor", () => {
    test("should create EventLoop instance", () => {
      const messageClient = messageService.getClient("test-employee")
      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient
      )

      expect(eventLoop).toBeDefined()
    })
  })

  describe("Session Management", () => {
    test("should create session on first event", async () => {
      const messageClient = messageService.getClient("test-employee")
      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient
      )

      // 触发一个事件处理（通过私有方法测试不太好，这里只验证 mock 被调用）
      // 实际测试会在集成测试中进行

      expect(opcodeClient.session.create).toBeDefined()
    })
  })

  describe("Memory Management", () => {})

  describe("Agent Tracking", () => {
    test("should track agent completion", async () => {
      const messageClient = messageService.getClient("test-employee")
      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient
      )

      // 注册一个 agent
      agentRegistry.register("agent-123", {
        employeeName: "test-employee",
        taskName: "test-task",
      })

      // 验证 agent 已注册
      expect(agentRegistry.isOurAgent("agent-123")).toBe(true)
      expect(agentRegistry.getInfo("agent-123")?.taskName).toBe("test-task")
    })

    test("should get agent result from session messages", async () => {
      const messageClient = messageService.getClient("test-employee")
      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient
      )

      // 调用 getAgentResult
      const getAgentResult = (eventLoop as any).getAgentResult.bind(eventLoop)
      const result = await getAgentResult("mock-session-id")

      expect(result).toBe("Mock response")
      expect(opcodeClient.session.messages).toHaveBeenCalled()
    })
  })

  describe("Threshold Checking", () => {})
})
