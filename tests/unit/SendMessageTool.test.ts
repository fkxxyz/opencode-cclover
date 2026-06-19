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
      employeeId: "emp_alice",
      name: "alice",
      hiredBy: null,
      roleId: "test-role",
      paused: false,
      status: "idle",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      activeSessionId: null,
    })
    await stateManager.registerEmployee({
      employeeId: "emp_bob",
      name: "bob",
      hiredBy: null,
      roleId: "test-role",
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
        to: "emp_alice",
        content: "Hello from boss",
        expect_reply: false,
      },
      context
    )

    expect(result).toBe("Message sent to emp_alice")

    // 验证消息已发送
    const employeeClient = messageService.getClient("emp_alice")
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
          to: "emp_alice",
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
      "emp_alice",
      "test-session-meeting-agent"
    )

    const context = {
      sessionID: "test-session-meeting-agent",
      agent: "TestRole",
    }

    const result = await sendMessageTool.execute(
      {
        to: "emp_alice",
        content: "Hello from meeting mode",
        expect_reply: false,
      },
      context
    )

    expect(result).toBe("Message sent to emp_alice")

    const employeeClient = messageService.getClient("emp_alice")
    const message = await employeeClient.recv()
    // Meeting-mode agent uses role.id as sender, not Boss from session
    expect(message.from).toBe("0-test-role")
    expect(message.content).toBe("Hello from meeting mode")
  })

  test("should use the invoking boss session in multi-boss meeting mode", async () => {
    const multiBossManager = new BossManager(
      {
        bosses: ["alpha", "beta"],
        projects: [],
      },
      TEST_WORKSPACE,
      roleManager
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
      "emp_alice",
      "test-session-meeting-agent-beta"
    )

    const result = await multiBossTool.execute(
      {
        to: "emp_alice",
        content: "Hello from beta meeting",
        expect_reply: false,
      },
      {
        sessionID: "test-session-meeting-agent-beta",
        messageID: "msg-meeting-agent-beta",
        agent: "TestRole",
        directory: TEST_WORKSPACE,
        worktree: TEST_WORKSPACE,
        abort: new AbortController().signal,
        metadata: () => {},
        ask: async () => {},
      }
    )

    expect(result).toBe("Message sent to emp_alice")

    const employeeClient = multiBossMessageService.getClient("emp_alice")
    const message = await employeeClient.recv()
    // Meeting-mode agent uses role.id as sender, not Boss from session
    expect(message.from).toBe("0-test-role")
    expect(message.content).toBe("Hello from beta meeting")
  })

  test("should work with employee from SessionRegistry", async () => {
    // 注册员工到 SessionRegistry
    const { sessionRegistry } = await import("../../src/utils/SessionRegistry")
    sessionRegistry.register("test-session-employee", "emp_alice")

    const context = {
      sessionID: "test-session-employee",
      agent: undefined,
    }

    const result = await sendMessageTool.execute(
      {
        to: "emp_bob",
        content: "Hello from employee",
        expect_reply: false,
      },
      context
    )

    expect(result).toBe("Message sent to emp_bob")

    // 验证消息已发送
    const bobClient = messageService.getClient("emp_bob")
    const message = await bobClient.recv()
    expect(message.from).toBe("emp_alice")
    expect(message.content).toBe("Hello from employee")

    // 清理
    sessionRegistry.unregister("test-session-employee")
  })

  test("should prioritize SessionRegistry over context.agent", async () => {
    // 注册员工到 SessionRegistry
    const { sessionRegistry } = await import("../../src/utils/SessionRegistry")
    sessionRegistry.register("test-session-priority", "emp_alice")

    const context = {
      sessionID: "test-session-priority",
      agent: "bayecao", // 即使 agent 是 boss，也应该使用 SessionRegistry 的值
    }

    const result = await sendMessageTool.execute(
      {
        to: "emp_bob",
        content: "Hello",
        expect_reply: false,
      },
      context
    )

    expect(result).toBe("Message sent to emp_bob")

    // 验证消息来自 alice（SessionRegistry），不是 bayecao（agent）
    const bobClient = messageService.getClient("emp_bob")
    const message = await bobClient.recv()
    expect(message.from).toBe("emp_alice")

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
          to: "emp_alice",
          content: "Hello",
          expect_reply: false,
        },
        context
      )
    ).rejects.toThrow("Unable to identify caller")
  })

  test("should reject unknown short-name recipient", async () => {
    const { sessionRegistry } = await import("../../src/utils/SessionRegistry")
    sessionRegistry.register("test-session-invalid-short-name", "emp_alice")

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
    ).rejects.toThrow("Recipient does not exist: nonexistent")

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
          to: "emp_bob",
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
    sessionRegistry.register("test-session-reply-attempt", "emp_alice")

    await messageService.send(
      "emp_bob",
      "emp_alice",
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
          to: "emp_bob",
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
      "emp_alice",
      messageService,
      memoryManager,
      stateManager
    )

    const events = stateManager.getEvents({
      employeeId: "emp_alice",
      limit: 20,
    })
    const replyAttemptEvent = events.find(
      (event) =>
        event.type === "reply_attempted" && event.details.to === "emp_bob"
    )
    expect(replyAttemptEvent).toBeDefined()

    const unrepliedSenders = await replyTracker.getUnrepliedSenders()
    expect(unrepliedSenders).toEqual([])

    messageService.send = originalSend
    sessionRegistry.unregister("test-session-reply-attempt")
  })

  test("should stop reply reminders after reply attempt even if recipient does not exist", async () => {
    const { sessionRegistry } = await import("../../src/utils/SessionRegistry")
    sessionRegistry.register(
      "test-session-missing-recipient-reply",
      "emp_alice"
    )

    await messageService.send(
      "emp_bob",
      "emp_alice",
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
    ).rejects.toThrow("Recipient does not exist: nonexistent")

    const memoryManager = new MemoryManager(TEST_WORKSPACE, stateManager)
    const replyTracker = new ReplyTracker(
      "emp_alice",
      messageService,
      memoryManager,
      stateManager
    )

    const events = stateManager.getEvents({
      employeeId: "emp_alice",
      limit: 20,
    })
    const replyAttemptEvent = events.find(
      (event) =>
        event.type === "reply_attempted" && event.details.to === "emp_bob"
    )
    expect(replyAttemptEvent).toBeDefined()

    const unrepliedSenders = await replyTracker.getUnrepliedSenders()
    expect(unrepliedSenders).toEqual([])

    sessionRegistry.unregister("test-session-missing-recipient-reply")
  })

  describe("Message routing", () => {
    test("should route messages by stable employeeId", async () => {
      // 注册 alice 到 SessionRegistry
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-same-task", "emp_alice")

      const context = {
        sessionID: "test-session-same-task",
        agent: undefined,
      }

      // Alice 发送消息给 Bob
      const result = await sendMessageTool.execute(
        {
          to: "emp_bob",
          content: "Same task message",
          expect_reply: false,
        },
        context
      )

      expect(result).toBe("Message sent to emp_bob")

      // 验证消息已发送
      const bobClient = messageService.getClient("emp_bob")
      const message = await bobClient.recv()
      expect(message.from).toBe("emp_alice")
      expect(message.content).toBe("Same task message")

      // 清理
      sessionRegistry.unregister("test-session-same-task")
    })

    test("should route messages between stable employee IDs", async () => {
      // 注册另一个稳定 ID 员工
      await stateManager.registerEmployee({
        employeeId: "emp_dave",
        name: "dave",
        hiredBy: "emp_alice",
        roleId: "test-role",
        paused: false,
        status: "idle",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      // 注册 alice 到 SessionRegistry
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-cross-task", "emp_alice")

      const context = {
        sessionID: "test-session-cross-task",
        agent: undefined,
      }

      // Alice 发送消息给 Dave
      const result = await sendMessageTool.execute(
        {
          to: "emp_dave",
          content: "Stable ID message",
          expect_reply: false,
        },
        context
      )

      expect(result).toBe("Message sent to emp_dave")

      // 验证消息已发送
      const daveClient = messageService.getClient("emp_dave")
      const message = await daveClient.recv()
      expect(message.from).toBe("emp_alice")
      expect(message.content).toBe("Stable ID message")

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
          to: "emp_alice",
          content: "Boss routing message",
          expect_reply: false,
        },
        context
      )

      expect(result).toBe("Message sent to emp_alice")

      // 验证消息已发送
      const aliceClient = messageService.getClient("emp_alice")
      const message = await aliceClient.recv()
      expect(message.from).toBe("0-bayecao")
      expect(message.content).toBe("Boss routing message")
    })

    test("should route messages from employee to boss", async () => {
      // 注册 alice 到 SessionRegistry
      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-to-boss", "emp_alice")

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
      expect(message.from).toBe("emp_alice")
      expect(message.content).toBe("Message to boss")

      // 清理
      sessionRegistry.unregister("test-session-to-boss")
    })
  })

  describe("Unified Recipient Resolution", () => {
    test("should route globally unique employee names without taskId expansion", async () => {
      await stateManager.registerEmployee({
        employeeId: "emp_tl_001",
        name: "TL-001",
        roleId: "technical-lead",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      await stateManager.registerEmployee({
        employeeId: "emp_ac_sendmsg_fix",
        name: "AC-sendmsg-fix",
        roleId: "architecture-consultant",
        hiredBy: "emp_tl_001",
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-unique-name", "emp_tl_001")

      const result = await sendMessageTool.execute(
        {
          to: "AC-sendmsg-fix",
          content: "Test unique-name routing",
          expect_reply: false,
        },
        {
          sessionID: "test-session-unique-name",
          agent: undefined,
        }
      )

      expect(result).toBe("Message sent to emp_ac_sendmsg_fix")

      // 验证消息已发送到正确的recipient
      const recipientClient = messageService.getClient("emp_ac_sendmsg_fix")
      const message = await recipientClient.recv()
      expect(message.from).toBe("emp_tl_001")
      expect(message.content).toBe("Test unique-name routing")

      sessionRegistry.unregister("test-session-unique-name")
    })

    test("should use explicit stable employeeId directly", async () => {
      await stateManager.registerEmployee({
        employeeId: "emp_tl_001",
        name: "TL-001",
        roleId: "technical-lead",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      await stateManager.registerEmployee({
        employeeId: "emp_architecture_consultant",
        name: "Architecture Consultant",
        roleId: "architecture-consultant",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-explicit-stable-id", "emp_tl_001")

      const result = await sendMessageTool.execute(
        {
          to: "emp_architecture_consultant",
          content: "Stable employeeId message",
          expect_reply: false,
        },
        {
          sessionID: "test-session-explicit-stable-id",
          agent: undefined,
        }
      )

      expect(result).toBe("Message sent to emp_architecture_consultant")

      // 验证消息已发送到正确的recipient
      const recipientClient = messageService.getClient(
        "emp_architecture_consultant"
      )
      const message = await recipientClient.recv()
      expect(message.from).toBe("emp_tl_001")
      expect(message.content).toBe("Stable employeeId message")

      sessionRegistry.unregister("test-session-explicit-stable-id")
    })

    test("should reject duplicate employee names", async () => {
      await stateManager.registerEmployee({
        employeeId: "emp_tl_001",
        name: "TL-001",
        roleId: "technical-lead",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      await stateManager.registerEmployee({
        employeeId: "emp_ac_primary",
        name: "AC-sendmsg-fix",
        roleId: "architecture-consultant",
        hiredBy: "emp_tl_001",
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      await stateManager.registerEmployee({
        employeeId: "emp_ac_duplicate",
        name: "AC-sendmsg-fix",
        roleId: "architecture-consultant",
        hiredBy: "emp_tl_001",
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-duplicate-name", "emp_tl_001")

      await expect(
        sendMessageTool.execute(
          {
            to: "AC-sendmsg-fix",
            content: "Ambiguous",
            expect_reply: false,
          },
          {
            sessionID: "test-session-duplicate-name",
            agent: undefined,
          }
        )
      ).rejects.toThrow("Recipient name is ambiguous")

      sessionRegistry.unregister("test-session-duplicate-name")
    })

    test("should reject self-messaging", async () => {
      await stateManager.registerEmployee({
        employeeId: "emp_tl_001",
        name: "TL-001",
        roleId: "technical-lead",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      const { sessionRegistry } =
        await import("../../src/utils/SessionRegistry")
      sessionRegistry.register("test-session-self-message", "emp_tl_001")

      await expect(
        sendMessageTool.execute(
          {
            to: "TL-001",
            content: "Message to myself",
            expect_reply: false,
          },
          {
            sessionID: "test-session-self-message",
            agent: undefined,
          }
        )
      ).rejects.toThrow("不能向自己发送消息")

      sessionRegistry.unregister("test-session-self-message")
    })

    test("Boss rejects unknown short names", async () => {
      await stateManager.registerEmployee({
        employeeId: "emp_mason",
        name: "mason",
        roleId: "test-role",
        hiredBy: null,
        status: "idle",
        paused: false,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      await expect(
        sendMessageTool.execute(
          {
            to: "ghost",
            content: "Boss to ghost",
            expect_reply: false,
          },
          {
            sessionID: "test-session-boss-unknown-short-name",
            agent: "bayecao",
          }
        )
      ).rejects.toThrow("Recipient does not exist: ghost")
    })
  })
})
