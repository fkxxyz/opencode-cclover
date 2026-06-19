import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { StateManager } from "../../src/state/StateManager"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"

describe("MessageService - Duplicate Message Fix", () => {
  let workspaceRoot: string
  let messageService: MessageService
  let stateManager: StateManager

  beforeEach(async () => {
    // 创建临时工作目录
    workspaceRoot = path.join(
      os.tmpdir(),
      `cclover-test-${Date.now()}-${Math.random()}`
    )
    await fs.mkdir(workspaceRoot, { recursive: true })

    // 创建 StateManager 并注册测试员工
    stateManager = new StateManager("test-project", workspaceRoot)
    await stateManager.registerEmployee({
      employeeId: "0-alice",
      name: "alice",
      roleId: "test",
      status: "offline",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
    await stateManager.registerEmployee({
      employeeId: "0-bob",
      name: "bob",
      roleId: "test",
      status: "offline",
      hiredBy: null,
      paused: false,
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 创建 MessageService 实例
    messageService = new MessageService(workspaceRoot, stateManager)
  })

  afterEach(async () => {
    // 清理临时目录
    await fs.rm(workspaceRoot, { recursive: true, force: true })
  })

  test("should not receive duplicate messages when using event notification", async () => {
    const alice = messageService.getClient("0-alice")
    const bob = messageService.getClient("0-bob")

    // Bob 开始等待消息（模拟 EventLoop 的行为）
    const recvPromise = bob.recv()

    // 等待一小段时间确保 bob.recv() 已经注册了事件监听器
    await new Promise((resolve) => setTimeout(resolve, 10))

    // Alice 发送消息
    await alice.send("bob", "Hello Bob!")

    // Bob 第一次接收消息（通过事件通知）
    const msg1 = await recvPromise
    expect(msg1.from).toBe("0-alice")
    expect(msg1.content).toBe("Hello Bob!")

    // Alice 发送第二条消息
    await alice.send("bob", "How are you?")

    // Bob 第二次接收消息（应该是第二条消息，不是重复的第一条）
    const msg2 = await bob.recv()
    expect(msg2.from).toBe("0-alice")
    expect(msg2.content).toBe("How are you?")

    // 验证：不应该再有消息了
    const queue = messageService.getUnreadQueue("bob")
    expect(queue.length).toBe(0)
  })

  test("should handle multiple messages in queue correctly", async () => {
    const alice = messageService.getClient("0-alice")
    const bob = messageService.getClient("0-bob")

    // Alice 连续发送三条消息
    await alice.send("bob", "Message 1")
    await alice.send("bob", "Message 2")
    await alice.send("bob", "Message 3")

    // Bob 依次接收三条消息
    const msg1 = await bob.recv()
    expect(msg1.content).toBe("Message 1")

    const msg2 = await bob.recv()
    expect(msg2.content).toBe("Message 2")

    const msg3 = await bob.recv()
    expect(msg3.content).toBe("Message 3")

    // 验证：队列应该为空
    const queue = messageService.getUnreadQueue("bob")
    expect(queue.length).toBe(0)
  })

  test("should not duplicate messages when alternating between queue and event", async () => {
    const alice = messageService.getClient("0-alice")
    const bob = messageService.getClient("0-bob")

    // 场景1：先发送消息（进入队列），再接收（从队列取）
    await alice.send("bob", "Queued message")
    const msg1 = await bob.recv()
    expect(msg1.content).toBe("Queued message")

    // 场景2：先等待（注册事件），再发送（通过事件通知）
    const recvPromise = bob.recv()
    await new Promise((resolve) => setTimeout(resolve, 10))
    await alice.send("bob", "Event message")
    const msg2 = await recvPromise
    expect(msg2.content).toBe("Event message")

    // 场景3：再次从队列接收（应该没有重复消息）
    await alice.send("bob", "Final message")
    const msg3 = await bob.recv()
    expect(msg3.content).toBe("Final message")

    // 验证：队列应该为空
    const queue = messageService.getUnreadQueue("bob")
    expect(queue.length).toBe(0)
  })
})
