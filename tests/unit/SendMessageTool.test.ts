import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { BossManager } from "../../src/core/BossManager"
import { StateManager } from "../../src/state/StateManager"
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
    bossManager = new BossManager(config)

    // 创建 StateManager 并注册测试员工
    stateManager = new StateManager("test-project", TEST_WORKSPACE)
    await stateManager.registerEmployee({
      employeeId: "0-alice",
      name: "alice",
      taskId: 0,
      hiredBy: null,
      role: "test",
      paused: false,
      status: "inactive",
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
      status: "inactive",
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
      stateManager
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
        },
        context
      )
    ).rejects.toThrow("Unable to identify caller")
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
        },
        context
      )
    ).rejects.toThrow("Unable to identify caller")
  })
})
