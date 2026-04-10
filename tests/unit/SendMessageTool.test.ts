import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { BossManager } from "../../src/core/BossManager"
import { StateManager } from "../../src/state/StateManager"
import { RoleManager } from "../../src/core/RoleManager"
import { MemoryManager } from "../../src/core/MemoryManager"
import { ReplyTracker } from "../../src/core/eventloop/ReplyTracker"
import { createSendMessageTool } from "../../src/tools/SendMessageTool"
import type { CcloverConfig } from "../../src/config/ConfigManager"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../fixtures/send-message-tool-test"
)

describe("SendMessageTool with Boss", () => {
  let bossManager: BossManager
  let messageService: MessageService
  let stateManager: StateManager
  let roleManager: RoleManager
  let sendMessageTool: any

  beforeEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 创建 BossManager
    const config: CcloverConfig = {
      bosses: ["bayecao"],
      projects: [],
    }
    bossManager = new BossManager(config, TEST_WORKSPACE)

    // 创建 StateManager 并注册测试员工
    stateManager = new StateManager("test-project", TEST_WORKSPACE)
    roleManager = new RoleManager(TEST_WORKSPACE)
    await roleManager.refresh()
    await stateManager.registerEmployee({
      employeeId: "0-alice",
      name: "alice",
      taskId: 0,
      hiredBy: null,
      role: "test",
      paused: false,
      status: "idle",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      activeSessionId: null,
    })
    await stateManager.registerEmployee({
      employeeId: "0-bob",
      name: "bob",
      taskId: 0,
      hiredBy: null,
      role: "test",
      paused: false,
      status: "idle",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      activeSessionId: null,
    })

    // 创建 MessageService
    messageService = new MessageService(
      TEST_WORKSPACE,
      stateManager,
      "test-project",
      bossManager
    )

    // 创建 SendMessageTool
    sendMessageTool = createSendMessageTool(
      messageService,
      bossManager,
      stateManager,
      roleManager
    )
  })

  afterEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  test("should recognize boss from context.agent", async () => {
    // 模拟 boss 调用工具
    const context = {
      sessionID: "test-session-boss",
      agent: "bayecao", // Boss 的名称
    }

    const result = await sendMessageTool.execute(
      {
        to: "0-alice",
        content: "Hello from boss",
        expect_reply: false,
      },
      context
    )

    expect(result).toBe("Message sent to 0-alice")

    // 验证消息已发送
    const employeeClient = messageService.getClient("0-alice")
    const message = await employeeClient.recv()
    expect(message.from).toBe("0-bayecao")
    expect(message.content).toBe("Hello from boss")
  })

  test("should reject non-boss agent", async () => {
    // 模拟非 boss 的 agent 调用工具
    const context = {
      sessionID: "test-session-unknown",
      agent: "unknown-agent", // 不是 boss
    }

    await expect(
      sendMessageTool.execute(
        {
          to: "0-alice",
          content: "Hello",
          expect_reply: false,
        },
        context
      )
    ).rejects.toThrow("Unable to identify caller")
  })

  test("should treat projected meeting agent as boss-compatible sender", async () => {
    await bossManager.recordSession(
      "bayecao",
      "0-alice",
      "test-session-meeting-agent"
    )

    const context = {
      sessionID: "test-session-meeting-agent",
      agent: "Calculator",
    }

    const result = await sendMessageTool.execute(
      {
        to: "0-alice",
        content: "Hello from meeting mode",
        expect_reply: false,
      },
      context
    )

    expect(result).toBe("Message sent to 0-alice")

    const employeeClient = messageService.getClient("0-alice")
    const message = await employeeClient.recv()
    expect(message.from).toBe("0-bayecao")
    expect(message.content).toBe("Hello from meeting mode")
  })

  test("should use the invoking boss session in multi-boss meeting mode", async () => {
    const multiBossManager = new BossManager(
      {
        bosses: ["alpha", "beta"],
        projects: [],
      },
      TEST_WORKSPACE
    )

    const multiBossMessageService = new MessageService(
      TEST_WORKSPACE,
      stateManager,
      "test-project",
      multiBossManager
    )

    const multiBossTool = createSendMessageTool(
      multiBossMessageService,
      multiBossManager,
      stateManager,
      roleManager
    )

    await multiBossManager.recordSession(
      "beta",
      "0-alice",
      "test-session-meeting-agent-beta"
    )

    const result = await multiBossTool.execute(
      {
        to: "0-alice",
        content: "Hello from beta meeting",
        expect_reply: false,
      },
      {
        sessionID: "test-session-meeting-agent-beta",
        messageID: "msg-meeting-agent-beta",
        agent: "Calculator",
        directory: TEST_WORKSPACE,
        worktree: TEST_WORKSPACE,
        abort: new AbortController().signal,
        metadata: () => {},
        ask: async () => {},
      }
    )

    expect(result).toBe("Message sent to 0-alice")

    const employeeClient = multiBossMessageService.getClient("0-alice")
    const message = await employeeClient.recv()
    expect(message.from).toBe("0-beta")
    expect(message.content).toBe("Hello from beta meeting")
  })

  test("should work with employee from SessionRegistry", async () => {
    // 注册员工到 SessionRegistry
    const { sessionRegistry } = await import("../../src/utils/SessionRegistry")
    sessionRegistry.register("test-session-employee", "0-alice")

    const context = {
      sessionID: "test-session-employee",
      agent: undefined,
    }

    const result = await sendMessageTool.execute(
      {
        to: "0-bob",
        content: "Hello from employee",
        expect_reply: false,
      },
      context
    )

    expect(result).toBe("Message sent to 0-bob")

    // 验证消息已发送
    const bobClient = messageService.getClient("0-bob")
    const message = await bobClient.recv()
    expect(message.from).toBe("0-alice")
    expect(message.content).toBe("Hello from employee")

    // 清理
    sessionRegistry.unregister("test-session-employee")
  })

  test("should prioritize SessionRegistry over context.agent", async () => {
    // 注册员工到 SessionRegistry
    const { sessionRegistry } = await import("../../src/utils/SessionRegistry")
    sessionRegistry.register("test-session-priority", "0-alice")

    const context = {
      sessionID: "test-session-priority",
      agent: "bayecao", // 即使 agent 是 boss，也应该使用 SessionRegistry 的值
    }

    const result = await sendMessageTool.execute(
      {
        to: "0-bob",
        content: "Hello",
        expect_reply: false,
      },
      context
    )

    expect(result).toBe("Message sent to 0-bob")

    // 验证消息来自 alice（SessionRegistry），不是 bayecao（agent）
    const bobClient = messageService.getClient("0-bob")
    const message = await bobClient.recv()
    expect(message.from).toBe("0-alice")

    // 清理
    sessionRegistry.unregister("test-session-priority")
  })

  test("should handle missing context.agent gracefully", async () => {
    const context = {
      sessionID: "test-session-no-agent",
      agent: undefined,
    }

    await expect(
      sendMessageTool.execute(
        {
          to: "0-alice",
          content: "Hello",
          expect_reply: false,
        },
        context
      )
    ).rejects.toThrow("Unable to identify caller")
  })

  test("should reject non-existent employee recipient by short name", async () => {
    const { sessionRegistry } = await import("../../src/utils/SessionRegistry")
    sessionRegistry.register("test-session-invalid-short-name", "0-alice")

    const context = {
      sessionID: "test-session-invalid-short-name",
      agent: undefined,
    }

    await expect(
      sendMessageTool.execute(
        {
          to: "nonexistent",
          content: "Hello ghost",
          expect_reply: false,
        },
        context
      )
    ).rejects.toThrow("Recipient does not exist")

    sessionRegistry.unregister("test-session-invalid-short-name")
  })

  test("should fail fast when stateManager is missing", async () => {
    const toolWithoutStateManager = createSendMessageTool(
      messageService,
      bossManager
    )

    await expect(
      toolWithoutStateManager.execute(
        {
          to: "0-bob",
          content: "Hello",
          expect_reply: false,
        },
        {
          sessionID: "test-session-boss-no-state-manager",
          messageID: "msg-no-state-manager",
          agent: "bayecao",
          directory: TEST_WORKSPACE,
          worktree: TEST_WORKSPACE,
          abort: new AbortController().signal,
          metadata: () => {},
          ask: async () => {},
        }
      )
    ).rejects.toThrow("stateManager is required")
  })

  test("should stop reply reminders after reply attempt even if send_message fails", async () => {
    const { sessionRegistry } = await import("../../src/utils/SessionRegistry")
    sessionRegistry.register("test-session-reply-attempt", "0-alice")

    await messageService.send(
      "0-bob",
      "0-alice",
      "Please reply to me",
      undefined,
      undefined,
      true
    )

    const originalSend = messageService.send.bind(messageService)
    messageService.send = async () => {
      throw new Error("simulated send failure")
    }

    await expect(
      sendMessageTool.execute(
        {
          to: "0-bob",
          content: "I am trying to reply",
          expect_reply: false,
        },
        {
          sessionID: "test-session-reply-attempt",
          agent: undefined,
        }
      )
    ).rejects.toThrow("simulated send failure")

    const memoryManager = new MemoryManager(TEST_WORKSPACE, stateManager)
    const replyTracker = new ReplyTracker(
      "0-alice",
      messageService,
      memoryManager,
      stateManager
    )

    const events = stateManager.getEvents({
      employeeName: "0-alice",
      limit: 20,
    })
    const replyAttemptEvent = events.find(
      (event) =>
        event.type === "reply_attempted" && event.details.to === "0-bob"
    )
    expect(replyAttemptEvent).toBeDefined()

    const unrepliedSenders = await replyTracker.getUnrepliedSenders()
    expect(unrepliedSenders).toEqual([])

    messageService.send = originalSend
    sessionRegistry.unregister("test-session-reply-attempt")
  })

  test("should stop reply reminders after reply attempt even if recipient does not exist", async () => {
    const { sessionRegistry } = await import("../../src/utils/SessionRegistry")
    sessionRegistry.register("test-session-missing-recipient-reply", "0-alice")

    await messageService.send(
      "0-bob",
      "0-alice",
      "Please reply to me",
      undefined,
      undefined,
      true
    )

    await expect(
      sendMessageTool.execute(
        {
          to: "nonexistent",
          content: "I am trying to reply but used a wrong recipient",
          expect_reply: false,
        },
        {
          sessionID: "test-session-missing-recipient-reply",
          agent: undefined,
        }
      )
    ).rejects.toThrow("Recipient does not exist")

    const memoryManager = new MemoryManager(TEST_WORKSPACE, stateManager)
    const replyTracker = new ReplyTracker(
      "0-alice",
      messageService,
      memoryManager,
      stateManager
    )

    const events = stateManager.getEvents({
      employeeName: "0-alice",
      limit: 20,
    })
    const replyAttemptEvent = events.find(
      (event) =>
        event.type === "reply_attempted" && event.details.to === "0-bob"
    )
    expect(replyAttemptEvent).toBeDefined()

    const unrepliedSenders = await replyTracker.getUnrepliedSenders()
    expect(unrepliedSenders).toEqual([])

    sessionRegistry.unregister("test-session-missing-recipient-reply")
  })

  describe("Message routing", () => {
    test("should route messages between employees in same task", async () => {
      // 注册 alice 到 SessionRegistry
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-same-task", "0-alice")

      const context = {
        sessionID: "test-session-same-task",
        agent: undefined,
      }

      // Alice (taskId=0) 发送消息给 Bob (taskId=0)
      const result = await sendMessageTool.execute(
        {
          to: "0-bob",
          content: "Same task message",
          expect_reply: false,
        },
        context
      )

      expect(result).toBe("Message sent to 0-bob")

      // 验证消息已发送
      const bobClient = messageService.getClient("0-bob")
      const message = await bobClient.recv()
      expect(message.from).toBe("0-alice")
      expect(message.content).toBe("Same task message")

      // 清理
      sessionRegistry.unregister("test-session-same-task")
    })

    test("should route messages between employees in different tasks", async () => {
      // 注册一个 taskId=1 的员工
      await stateManager.registerEmployee({
        employeeId: "1-dave",
        name: "dave",
        taskId: 1,
        hiredBy: "0-alice",
        role: "test",
        paused: false,
        status: "idle",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      // 注册 alice 到 SessionRegistry
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-cross-task", "0-alice")

      const context = {
        sessionID: "test-session-cross-task",
        agent: undefined,
      }

      // Alice (taskId=0) 发送消息给 Dave (taskId=1)
      const result = await sendMessageTool.execute(
        {
          to: "1-dave",
          content: "Cross-task message",
          expect_reply: false,
        },
        context
      )

      expect(result).toBe("Message sent to 1-dave")

      // 验证消息已发送
      const daveClient = messageService.getClient("1-dave")
      const message = await daveClient.recv()
      expect(message.from).toBe("0-alice")
      expect(message.content).toBe("Cross-task message")

      // 清理
      sessionRegistry.unregister("test-session-cross-task")
    })

    test("should route messages from boss to employee", async () => {
      const context = {
        sessionID: "test-session-boss-routing",
        agent: "bayecao", // Boss
      }

      // Boss 发送消息给员工
      const result = await sendMessageTool.execute(
        {
          to: "0-alice",
          content: "Boss routing message",
          expect_reply: false,
        },
        context
      )

      expect(result).toBe("Message sent to 0-alice")

      // 验证消息已发送
      const aliceClient = messageService.getClient("0-alice")
      const message = await aliceClient.recv()
      expect(message.from).toBe("0-bayecao")
      expect(message.content).toBe("Boss routing message")
    })

    test("should route messages from employee to boss", async () => {
      // 注册 alice 到 SessionRegistry
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-to-boss", "0-alice")

      const context = {
        sessionID: "test-session-to-boss",
        agent: undefined,
      }

      // Alice 发送消息给 Boss
      const result = await sendMessageTool.execute(
        {
          to: "0-bayecao",
          content: "Message to boss",
        },
        context
      )

      expect(result).toBe("Message sent to 0-bayecao")

      // 验证消息已发送
      const bossClient = messageService.getClient("0-bayecao")
      const message = await bossClient.recv()
      expect(message.from).toBe("0-alice")
      expect(message.content).toBe("Message to boss")

      // 清理
      sessionRegistry.unregister("test-session-to-boss")
    })
  })
})
