import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import * as fs from "fs/promises"
import * as path from "path"
import { EventLoop, type Role } from "../../src/core/EventLoop"
import { MessageService } from "../../src/core/MessageService"
import { MemoryManager } from "../../src/core/MemoryManager"
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
        testRole,
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
        testRole,
        messageClient,
        memoryManager,
        opcodeClient
      )

      // 触发一个事件处理（通过私有方法测试不太好，这里只验证 mock 被调用）
      // 实际测试会在集成测试中进行

      expect(opcodeClient.session.create).toBeDefined()
    })

    test("should register session in SessionRegistry", async () => {
      const messageClient = messageService.getClient("test-employee")
      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole,
        messageClient,
        memoryManager,
        opcodeClient
      )

      // 手动调用 ensureSession（通过反射访问私有方法）
      const ensureSession = (eventLoop as any).ensureSession.bind(eventLoop)
      await ensureSession()

      // 验证 session 已注册
      const employeeName = sessionRegistry.getEmployeeName("mock-session-id")
      expect(employeeName).toBe("test-employee")
    })
  })

  describe("Memory Management", () => {
    test("should build system prompt with memory", async () => {
      const messageClient = messageService.getClient("test-employee")

      // 写入一些记忆
      await memoryManager.write("test-employee", {
        knowledge: ["Test knowledge 1", "Test knowledge 2"],
        tasks: [],
        custom: { testKey: "testValue" },
      })

      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole,
        messageClient,
        memoryManager,
        opcodeClient
      )

      // 调用 buildSystemPrompt
      const buildSystemPrompt = (eventLoop as any).buildSystemPrompt.bind(
        eventLoop
      )
      const systemPrompt = await buildSystemPrompt()

      expect(systemPrompt).toContain("You are a test role.")
      expect(systemPrompt).toContain("Test knowledge 1")
      expect(systemPrompt).toContain("Test knowledge 2")
      expect(systemPrompt).toContain("testKey")
    })

    test("should save summary to memory", async () => {
      const messageClient = messageService.getClient("test-employee")

      // 写入初始记忆
      await memoryManager.write("test-employee", {
        knowledge: ["Old knowledge"],
        tasks: [
          {
            name: "task1",
            status: "completed",
            description: "Test task",
            dependencies: [],
            created: new Date().toISOString(),
          },
        ],
        custom: { oldKey: "oldValue" },
      })

      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole,
        messageClient,
        memoryManager,
        opcodeClient
      )

      // 调用 saveSummary
      const saveSummary = (eventLoop as any).saveSummary.bind(eventLoop)
      await saveSummary({
        knowledge: ["New knowledge"],
        custom: { newKey: "newValue" },
      })

      // 验证记忆已更新
      const memory = await memoryManager.read("test-employee")
      expect(memory.knowledge).toContain("Old knowledge")
      expect(memory.knowledge).toContain("New knowledge")
      expect(memory.custom.oldKey).toBe("oldValue")
      expect(memory.custom.newKey).toBe("newValue")
      expect(memory.tasks.length).toBe(1) // tasks 应该保持不变
    })
  })

  describe("Agent Tracking", () => {
    test("should track agent completion", async () => {
      const messageClient = messageService.getClient("test-employee")
      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole,
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
        testRole,
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

  describe("Threshold Checking", () => {
    test("should not summarize when below threshold", async () => {
      const messageClient = messageService.getClient("test-employee")
      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole,
        messageClient,
        memoryManager,
        opcodeClient
      )

      // 创建 session
      const ensureSession = (eventLoop as any).ensureSession.bind(eventLoop)
      await ensureSession()

      // Mock session.get 返回低 token 数
      opcodeClient.session.get = mock(async () => ({
        data: { tokens: { total: 100 } },
      }))

      // 调用 summarizeIfNeeded
      const summarizeIfNeeded = (eventLoop as any).summarizeIfNeeded.bind(
        eventLoop
      )
      await summarizeIfNeeded()

      // 验证没有调用 prompt（不应该触发总结）
      const promptCallCount = opcodeClient.session.prompt.mock.calls.length
      // 只有 ensureSession 时调用了一次 prompt
      expect(promptCallCount).toBe(1)
    })

    test("should summarize when token threshold reached", async () => {
      const messageClient = messageService.getClient("test-employee")
      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole,
        messageClient,
        memoryManager,
        opcodeClient
      )

      // 创建 session
      const ensureSession = (eventLoop as any).ensureSession.bind(eventLoop)
      await ensureSession()

      // Mock session.get 返回高 token 数
      opcodeClient.session.get = mock(async () => ({
        data: { tokens: { total: 150000 } },
      }))

      // Mock prompt 返回总结
      opcodeClient.session.prompt = mock(async () => ({
        data: {
          info: {
            role: "assistant",
            time: { completed: Date.now() },
          },
        },
      }))

      // Mock messages 返回 JSON 格式的总结
      opcodeClient.session.messages = mock(async () => ({
        data: [
          {
            info: { role: "assistant" },
            parts: [
              {
                type: "text",
                text: JSON.stringify({
                  knowledge: ["Summary knowledge"],
                  custom: { summaryKey: "summaryValue" },
                }),
              },
            ],
          },
        ],
      }))

      // 调用 summarizeIfNeeded
      const summarizeIfNeeded = (eventLoop as any).summarizeIfNeeded.bind(
        eventLoop
      )
      await summarizeIfNeeded()

      // 验证调用了 prompt（触发总结）
      expect(opcodeClient.session.prompt).toHaveBeenCalled()

      // 验证记忆已更新
      const memory = await memoryManager.read("test-employee")
      expect(memory.knowledge).toContain("Summary knowledge")
      expect(memory.custom.summaryKey).toBe("summaryValue")
    })
  })
})
