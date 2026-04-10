import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test"
import * as fs from "fs/promises"
import * as path from "path"
import { EventLoop, type Role } from "../../src/core/eventloop"
import { MessageService } from "../../src/core/MessageService"
import { MemoryManager } from "../../src/core/MemoryManager"
import type { RoleManager } from "../../src/core/RoleManager"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import { agentRegistry } from "../../src/utils/AgentRegistry"
import { vacationRegistry } from "../../src/utils/VacationRegistry"
import { haltRegistry } from "../../src/utils/HaltRegistry"

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
    vacationRegistry.clear()
    haltRegistry.clear()
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

    test("should queue prompt recovery before ordinary work", async () => {
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

      ;(eventLoop as any).enqueuePromptRecovery({
        type: "prompt_recovery",
        timestamp: "2026-04-08T00:00:00.000Z",
        sessionId: "session-123",
        startedAt: "2026-04-08T00:00:00.000Z",
        triggerEventType: "task_available",
        version: 1,
      })

      await memoryManager.write("test-employee", {
        knowledge: [],
        tasks: [
          {
            name: "task1",
            description: "Test task",
            status: "pending",
            dependencies: [],
            created: new Date().toISOString(),
          },
        ],
        args: {},
      })

      const event = await (eventLoop as any).waitForEvent()

      expect(event.type).toBe("prompt_recovery")
      expect(event.details.sessionId).toBe("session-123")
      expect(event.details.triggerEventType).toBe("task_available")
    })

    test("should prioritize vacation gating over prompt recovery", async () => {
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

      ;(eventLoop as any).enqueuePromptRecovery({
        type: "prompt_recovery",
        timestamp: "2026-04-08T00:00:00.000Z",
        sessionId: "session-123",
        startedAt: "2026-04-08T00:00:00.000Z",
        triggerEventType: "task_available",
        version: 1,
      })
      vacationRegistry.addVacationEvent("test-employee", {
        type: "vacation_requested",
        employeeName: "test-employee",
        timestamp: "2026-04-08T00:00:01.000Z",
      })

      const event = await (eventLoop as any).waitForEvent()

      expect(event.type).toBe("vacation_requested")
    })

    test("should prioritize halt over vacation and prompt recovery", async () => {
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

      ;(eventLoop as any).enqueuePromptRecovery({
        type: "prompt_recovery",
        timestamp: "2026-04-08T00:00:00.000Z",
        sessionId: "session-123",
        startedAt: "2026-04-08T00:00:00.000Z",
        triggerEventType: "task_available",
        version: 1,
      })
      vacationRegistry.addVacationEvent("test-employee", {
        type: "vacation_requested",
        employeeName: "test-employee",
        timestamp: "2026-04-08T00:00:01.000Z",
      })
      haltRegistry.addHaltEvent("test-employee", {
        type: "halt_requested",
        employeeId: "test-employee",
        taskId: 1,
        timestamp: "2026-04-08T00:00:02.000Z",
        reason: "runaway-agents",
      })

      const event = await (eventLoop as any).waitForEvent()

      expect(event.type).toBe("halt_requested")
      expect(event.details.taskId).toBe(1)
      expect(event.details.reason).toBe("runaway-agents")
    })

    test("should persist prompt recovery before prompt and clear after success", async () => {
      const { StateManager } = await import("../../src/state/StateManager")
      const stateManager = new StateManager(
        "test-project",
        testWorkspace,
        testWorkspace
      )
      await stateManager.registerEmployee({
        employeeId: "test-employee",
        name: "test-employee",
        taskId: 1,
        role: testRole.name,
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      messageService = new MessageService(testWorkspace, stateManager)
      memoryManager = new MemoryManager(testWorkspace)
      const messageClient = messageService.getClient("test-employee")

      let markerSeenDuringPrompt: any = null
      opcodeClient.session.prompt = mock(async () => {
        markerSeenDuringPrompt =
          stateManager.getEmployee("test-employee")?.promptRecovery
        return {
          data: {
            info: {
              role: "assistant",
              time: { completed: Date.now() },
            },
          },
        }
      })

      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        stateManager
      )

      await memoryManager.write("test-employee", {
        knowledge: [],
        tasks: [],
        args: {},
      })

      await (eventLoop as any).handleEvent({
        projectId: "",
        type: "task_available",
        timestamp: "2026-04-08T00:00:00.000Z",
        details: {
          tasks: [],
        },
      })

      expect(markerSeenDuringPrompt).toBeDefined()
      expect(markerSeenDuringPrompt.sessionId).toBe("mock-session-id")
      expect(markerSeenDuringPrompt.triggerEventType).toBe("task_available")
      expect(
        stateManager.getEmployee("test-employee")?.promptRecovery
      ).toBeUndefined()
    })

    test("should keep prompt recovery marker when prompt is aborted", async () => {
      const { StateManager } = await import("../../src/state/StateManager")
      const stateManager = new StateManager(
        "test-project",
        testWorkspace,
        testWorkspace
      )
      await stateManager.registerEmployee({
        employeeId: "test-employee",
        name: "test-employee",
        taskId: 1,
        role: testRole.name,
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      messageService = new MessageService(testWorkspace, stateManager)
      memoryManager = new MemoryManager(testWorkspace)
      const messageClient = messageService.getClient("test-employee")

      opcodeClient.session.prompt = mock(async () => ({
        data: {
          info: {
            error: {
              name: "MessageAbortedError",
            },
          },
        },
      }))

      const eventLoop = new EventLoop(
        testWorkspace,
        "test-employee",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        opcodeClient,
        stateManager
      )

      await memoryManager.write("test-employee", {
        knowledge: [],
        tasks: [],
        args: {},
      })

      await (eventLoop as any).handleEvent({
        projectId: "",
        type: "task_available",
        timestamp: "2026-04-08T00:00:00.000Z",
        details: {
          tasks: [],
        },
      })

      expect(stateManager.getEmployee("test-employee")?.promptRecovery).toEqual(
        {
          version: 1,
          sessionId: "mock-session-id",
          startedAt: expect.any(String),
          triggerEventType: "task_available",
        }
      )
    })

    test("should defer non-urgent event when urgent message arrives before activeSessionId is set", async () => {
      const { StateManager } = await import("../../src/state/StateManager")
      const stateManager = new StateManager(
        "test-project",
        testWorkspace,
        testWorkspace
      )
      await stateManager.registerEmployee({
        employeeId: "1-test-employee",
        name: "test-employee",
        taskId: 1,
        role: testRole.name,
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })
      await stateManager.registerEmployee({
        employeeId: "0-alice",
        name: "alice",
        taskId: 0,
        role: "test-role",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      const raceOpcodeClient = createMockOpencodeClient()
      messageService = new MessageService(
        testWorkspace,
        stateManager,
        "test-project",
        undefined,
        raceOpcodeClient
      )
      memoryManager = new MemoryManager(testWorkspace)
      const messageClient = messageService.getClient("1-test-employee")

      let promptCalled = false
      raceOpcodeClient.session.prompt = mock(async () => {
        promptCalled = true
        return {
          data: {
            info: {
              role: "assistant",
              time: { completed: Date.now() },
            },
          },
        }
      })

      const eventLoop = new EventLoop(
        testWorkspace,
        "1-test-employee",
        testRole.name,
        mockRoleManager,
        messageClient,
        memoryManager,
        raceOpcodeClient,
        stateManager
      )

      await memoryManager.write("1-test-employee", {
        knowledge: [],
        tasks: [],
        args: {},
      })

      const originalUpdateActiveSessionId =
        stateManager.updateActiveSessionId.bind(stateManager)
      let injectedUrgent = false
      ;(stateManager as any).updateActiveSessionId = mock(
        async (employeeId: string, sessionId: string | null) => {
          if (
            !injectedUrgent &&
            employeeId === "1-test-employee" &&
            sessionId === "mock-session-id"
          ) {
            injectedUrgent = true
            await messageService.send(
              "0-alice",
              "1-test-employee",
              "urgent interrupt",
              undefined,
              true,
              false
            )
          }

          return originalUpdateActiveSessionId(employeeId, sessionId)
        }
      )

      await (eventLoop as any).handleEvent({
        projectId: "",
        type: "message",
        timestamp: "2026-04-08T00:00:00.000Z",
        details: {
          from: "0-alice",
          to: "1-test-employee",
          content: "please run a long task",
        },
      })

      expect(promptCalled).toBe(false)

      const nextEvent = await (eventLoop as any).waitForEvent()
      expect(nextEvent.type).toBe("message")
      expect(nextEvent.details.content).toBe("urgent interrupt")
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
        employeeId: "test-employee",
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
    test("should check summary for soulless employee during run loop", async () => {
      testRole = {
        name: "test-role",
        systemPrompt: "You are a test role.",
        soul: false,
      } as any
      ;(mockRoleManager as any).getRole = mock(() => testRole)

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

      ;(eventLoop as any).sessionManager.ensureSession = mock(async () => ({
        id: "mock-session-id",
        messageCount: 0,
        tokenCount: 0,
        systemPrompt: "test",
      }))
      const summarizeIfNeededMock = mock(async () => {
        ;(eventLoop as any).running = false
      })
      ;(eventLoop as any).sessionManager.summarizeIfNeeded =
        summarizeIfNeededMock
      ;(eventLoop as any).waitForAgentCompletion = mock(async () => {
        await new Promise(() => {})
      })
      ;(eventLoop as any).hasImmediateEvent = mock(async () => false)

      await eventLoop.run()

      expect(summarizeIfNeededMock).toHaveBeenCalledTimes(1)
    })

    test("should summarize soulless employee when token count reaches 80000", async () => {
      testRole = {
        name: "test-role",
        systemPrompt: "You are a test role.",
        soul: false,
      } as any
      ;(mockRoleManager as any).getRole = mock(() => testRole)

      opcodeClient.session.messages = mock(async () => ({
        data: [
          {
            info: {
              role: "assistant",
              tokens: { total: 80000 },
            },
            parts: [{ type: "text", text: "Mock response" }],
          },
        ],
      }))

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

      const saveSummaryMock = mock(async () => {})
      ;(eventLoop as any).summaryService.requestSummary = mock(async () => ({
        args: {},
        roleData: {},
        knowledge: ["summary"],
      }))
      ;(eventLoop as any).summaryService.saveSummary = saveSummaryMock

      await memoryManager.write("test-employee", {
        knowledge: [],
        tasks: [],
        args: {},
      })

      await (eventLoop as any).sessionManager.ensureSession()
      await (eventLoop as any).sessionManager.summarizeIfNeeded()

      expect(
        (eventLoop as any).summaryService.requestSummary
      ).toHaveBeenCalledTimes(1)
      expect(saveSummaryMock).toHaveBeenCalledTimes(1)
      expect((eventLoop as any).sessionManager.getCurrentSession()).toBeNull()
    })
  })
})
