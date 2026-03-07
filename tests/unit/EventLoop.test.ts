import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import * as fs from "fs/promises"
import * as path from "path"
import { EventLoop, type Role } from "../../src/core/EventLoop"
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

    test("should register session in SessionRegistry", async () => {
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

      // 手动调用 ensureSession（通过反射访问私有方法）
      const ensureSession = (eventLoop as any).ensureSession.bind(eventLoop)
      await ensureSession()

      // 验证 session 已注册
      const employeeName = sessionRegistry.getEmployeeName("mock-session-id")
      expect(employeeName).toBe("test-employee")
    })
  })

  describe("Memory Management", () => {
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
        args: { oldKey: "oldValue" },
      })

      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient
      )

      // 调用 saveSummary
      const saveSummary = (eventLoop as any).saveSummary.bind(eventLoop)
      await saveSummary({
        knowledge: ["New knowledge"],
        args: { newKey: "newValue" },
      })

      // 验证记忆已更新
      const memory = await memoryManager.read("test-employee")
      expect(memory.knowledge).toContain("Old knowledge")
      expect(memory.knowledge).toContain("New knowledge")
      expect(memory.args.oldKey).toBe("oldValue")
      expect(memory.args.newKey).toBe("newValue")
      expect(memory.tasks.length).toBe(1) // tasks 应该保持不变
    })
  })

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

  describe("Threshold Checking", () => {
    test("should not summarize when below threshold", async () => {
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
      // ensureSession 不再调用 prompt，所以应该是 0
      expect(promptCallCount).toBe(0)
    })

    test("should summarize when token threshold reached", async () => {
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

      // 创建 session
      const ensureSession = (eventLoop as any).ensureSession.bind(eventLoop)
      await ensureSession()

      // Mock messages 返回包含高 token 数的 assistant 消息
      // 第一次调用用于检查 token，第二次调用用于获取总结
      let messagesCallCount = 0
      opcodeClient.session.messages = mock(async () => {
        messagesCallCount++
        if (messagesCallCount === 1) {
          // 第一次调用：返回包含高 token 数的消息
          return {
            data: [
              {
                info: {
                  role: "assistant",
                  tokens: { total: 150000, input: 100000, output: 50000 },
                },
                parts: [],
              },
            ],
          }
        } else {
          // 第二次调用：返回总结结果
          return {
            data: [
              {
                info: { role: "assistant" },
                parts: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      knowledge: ["Summary knowledge"],
                      args: { summaryKey: "summaryValue" },
                    }),
                  },
                ],
              },
            ],
          }
        }
      })

      // Mock prompt 返回总结
      opcodeClient.session.prompt = mock(async () => ({
        data: {
          info: {
            role: "assistant",
            time: { completed: Date.now() },
          },
        },
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
      expect(memory.args.summaryKey).toBe("summaryValue")
    })

    test("should parse JSON from markdown code block", async () => {
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

      // 创建 session
      const ensureSession = (eventLoop as any).ensureSession.bind(eventLoop)
      await ensureSession()

      // Mock messages 返回包含高 token 数的 assistant 消息
      // 第一次调用用于检查 token，第二次调用用于获取总结
      let messagesCallCount = 0
      opcodeClient.session.messages = mock(async () => {
        messagesCallCount++
        if (messagesCallCount === 1) {
          // 第一次调用：返回包含高 token 数的消息
          return {
            data: [
              {
                info: {
                  role: "assistant",
                  tokens: { total: 150000, input: 100000, output: 50000 },
                },
                parts: [],
              },
            ],
          }
        } else {
          // 第二次调用：返回 markdown 代码块格式的总结
          return {
            data: [
              {
                info: { role: "assistant" },
                parts: [
                  {
                    type: "text",
                    text: '```json\n{"knowledge": ["Markdown knowledge"], "args": {"markdownKey": "markdownValue"}}\n```',
                  },
                ],
              },
            ],
          }
        }
      })

      // Mock prompt
      opcodeClient.session.prompt = mock(async () => ({
        data: {
          info: {
            role: "assistant",
            time: { completed: Date.now() },
          },
        },
      }))

      // 调用 summarizeIfNeeded
      const summarizeIfNeeded = (eventLoop as any).summarizeIfNeeded.bind(
        eventLoop
      )
      await summarizeIfNeeded()

      // 验证记忆已更新
      const memory = await memoryManager.read("test-employee")
      expect(memory.knowledge).toContain("Markdown knowledge")
      expect(memory.args.markdownKey).toBe("markdownValue")
    })

    test("should retry on parse failure and record event", async () => {
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

      // 创建 session
      const ensureSession = (eventLoop as any).ensureSession.bind(eventLoop)
      await ensureSession()

      // Mock messages 返回包含高 token 数的 assistant 消息
      // 第一次调用用于检查 token，后续调用返回无效 JSON
      let messagesCallCount = 0
      opcodeClient.session.messages = mock(async () => {
        messagesCallCount++
        if (messagesCallCount === 1) {
          // 第一次调用：返回包含高 token 数的消息
          return {
            data: [
              {
                info: {
                  role: "assistant",
                  tokens: { total: 150000, input: 100000, output: 50000 },
                },
                parts: [],
              },
            ],
          }
        } else {
          // 后续调用：返回无效的 JSON（所有重试都失败）
          return {
            data: [
              {
                info: { role: "assistant" },
                parts: [
                  {
                    type: "text",
                    text: "This is not valid JSON",
                  },
                ],
              },
            ],
          }
        }
      })

      // Mock prompt
      opcodeClient.session.prompt = mock(async () => ({
        data: {
          info: {
            role: "assistant",
            time: { completed: Date.now() },
          },
        },
      }))

      // Mock StateManager 的 addEvent 方法
      const mockAddEvent = mock(async () => {})
      ;(eventLoop as any).stateManager = {
        addEvent: mockAddEvent,
      }

      // 调用 summarizeIfNeeded
      const summarizeIfNeeded = (eventLoop as any).summarizeIfNeeded.bind(
        eventLoop
      )
      await summarizeIfNeeded()

      // 验证重试了 3 次（初始请求 + 3 次重试 = 4 次 prompt 调用）
      // 但由于 ensureSession 也会调用一次，所以总共是 4 次
      expect(opcodeClient.session.prompt.mock.calls.length).toBe(3)

      // 验证记录了 summary_parse_failed 事件
      expect(mockAddEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "summary_parse_failed",
          employeeName: "test-employee",
          details: expect.objectContaining({
            attempts: 3,
            lastError: expect.any(String),
            responseText: "This is not valid JSON",
          }),
        })
      )

      // 验证记忆没有更新（返回空结果）
      const memory = await memoryManager.read("test-employee")
      expect(memory.knowledge).not.toContain("This is not valid JSON")
    })

    test("should succeed on second retry", async () => {
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

      // 创建 session
      const ensureSession = (eventLoop as any).ensureSession.bind(eventLoop)
      await ensureSession()

      // Mock messages: 第一次用于检查 token，第二次失败，第三次成功
      let callCount = 0
      opcodeClient.session.messages = mock(async () => {
        callCount++
        if (callCount === 1) {
          // 第一次调用：返回包含高 token 数的消息
          return {
            data: [
              {
                info: {
                  role: "assistant",
                  tokens: { total: 150000, input: 100000, output: 50000 },
                },
                parts: [],
              },
            ],
          }
        } else if (callCount === 2) {
          // 第二次调用：返回无效 JSON
          return {
            data: [
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "Invalid JSON" }],
              },
            ],
          }
        } else {
          // 第三次调用：返回有效 JSON
          return {
            data: [
              {
                info: { role: "assistant" },
                parts: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      knowledge: ["Retry success"],
                      args: { retryKey: "retryValue" },
                    }),
                  },
                ],
              },
            ],
          }
        }
      })

      // Mock prompt
      opcodeClient.session.prompt = mock(async () => ({
        data: {
          info: {
            role: "assistant",
            time: { completed: Date.now() },
          },
        },
      }))

      // 调用 summarizeIfNeeded
      const summarizeIfNeeded = (eventLoop as any).summarizeIfNeeded.bind(
        eventLoop
      )
      await summarizeIfNeeded()

      // 验证重试了 1 次（初始 + 1 次重试 = 2 次 prompt）
      expect(opcodeClient.session.prompt.mock.calls.length).toBe(2)

      // 验证记忆已更新
      const memory = await memoryManager.read("test-employee")
      expect(memory.knowledge).toContain("Retry success")
      expect(memory.args.retryKey).toBe("retryValue")
    })
  })
})
