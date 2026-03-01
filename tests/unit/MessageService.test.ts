import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const TEST_WORKSPACE = path.join(import.meta.dir, "../fixtures/test-workspace")

describe("MessageService", () => {
  let service: MessageService

  beforeEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 创建服务实例
    service = new MessageService(TEST_WORKSPACE)
  })

  afterEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  test("should send and receive message", async () => {
    const alice = service.getClient("alice")
    const bob = service.getClient("bob")

    // Alice 发送消息
    await alice.send("bob", "Hello Bob")

    // Bob 接收消息
    const message = await bob.recv()
    expect(message.from).toBe("alice")
    expect(message.content).toBe("Hello Bob")
    expect(message.timestamp).toBeDefined()
  })

  test("should handle multiple messages in order", async () => {
    const alice = service.getClient("alice")
    const bob = service.getClient("bob")

    // 发送多条消息
    await alice.send("bob", "Message 1")
    await alice.send("bob", "Message 2")
    await alice.send("bob", "Message 3")

    // 按顺序接收
    const msg1 = await bob.recv()
    const msg2 = await bob.recv()
    const msg3 = await bob.recv()

    expect(msg1.content).toBe("Message 1")
    expect(msg2.content).toBe("Message 2")
    expect(msg3.content).toBe("Message 3")
  })

  test("should block recv() when no messages", async () => {
    const alice = service.getClient("alice")
    const bob = service.getClient("bob")

    let received = false

    // Bob 开始等待消息（异步）
    const recvPromise = bob.recv().then((msg) => {
      received = true
      return msg
    })

    // 等待一小段时间，确认 recv 还在等待
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(received).toBe(false)

    // Alice 发送消息
    await alice.send("bob", "Hello")

    // Bob 应该收到消息
    const message = await recvPromise
    expect(received).toBe(true)
    expect(message.content).toBe("Hello")
  })

  test("should persist messages to YAML files", async () => {
    const alice = service.getClient("alice")
    const bob = service.getClient("bob")

    // 发送消息
    await alice.send("bob", "Test message")

    // 检查文件是否存在
    const aliceFilePath = service.getMessageFilePath("alice", "bob")
    const bobFilePath = service.getMessageFilePath("bob", "alice")

    const aliceFileExists = await fs
      .access(aliceFilePath)
      .then(() => true)
      .catch(() => false)
    const bobFileExists = await fs
      .access(bobFilePath)
      .then(() => true)
      .catch(() => false)

    expect(aliceFileExists).toBe(true)
    expect(bobFileExists).toBe(true)

    // 检查文件内容
    const aliceContent = await fs.readFile(aliceFilePath, "utf-8")
    const bobContent = await fs.readFile(bobFilePath, "utf-8")

    expect(aliceContent).toContain("direction: send")
    expect(aliceContent).toContain("Test message")

    expect(bobContent).toContain("direction: receive")
    expect(bobContent).toContain("Test message")
  })

  test("should query message history", async () => {
    const alice = service.getClient("alice")
    const bob = service.getClient("bob")

    // 发送多条消息
    await alice.send("bob", "Message 1")
    await bob.send("alice", "Message 2")
    await alice.send("bob", "Message 3")

    // 清空未读队列
    await bob.recv()
    await alice.recv()
    await bob.recv()

    // 查询历史
    const aliceHistory = await alice.history("bob")
    expect(aliceHistory.length).toBe(3)
    expect(aliceHistory[0].content).toBe("Message 1")
    expect(aliceHistory[1].content).toBe("Message 2")
    expect(aliceHistory[2].content).toBe("Message 3")

    // 查询限制数量
    const limitedHistory = await alice.history("bob", 2)
    expect(limitedHistory.length).toBe(2)
    expect(limitedHistory[0].content).toBe("Message 2")
    expect(limitedHistory[1].content).toBe("Message 3")
  })

  test("should return empty history for non-existent conversation", async () => {
    const alice = service.getClient("alice")

    const history = await alice.history("bob")
    expect(history.length).toBe(0)
  })

  test("should handle bidirectional conversation", async () => {
    const alice = service.getClient("alice")
    const bob = service.getClient("bob")

    // 双向对话
    await alice.send("bob", "Hi Bob")
    const msg1 = await bob.recv()
    expect(msg1.content).toBe("Hi Bob")

    await bob.send("alice", "Hi Alice")
    const msg2 = await alice.recv()
    expect(msg2.content).toBe("Hi Alice")

    // 检查历史记录
    const aliceHistory = await alice.history("bob")
    expect(aliceHistory.length).toBe(2)
    expect(aliceHistory[0].from).toBe("alice")
    expect(aliceHistory[1].from).toBe("bob")

    const bobHistory = await bob.history("alice")
    expect(bobHistory.length).toBe(2)
    expect(bobHistory[0].from).toBe("alice")
    expect(bobHistory[1].from).toBe("bob")
  })

  test("should handle multiple concurrent clients", async () => {
    const alice = service.getClient("alice")
    const bob = service.getClient("bob")
    const charlie = service.getClient("charlie")

    // 多个客户端同时发送消息
    await Promise.all([
      alice.send("bob", "From Alice"),
      charlie.send("bob", "From Charlie"),
    ])

    // Bob 接收两条消息
    const msg1 = await bob.recv()
    const msg2 = await bob.recv()

    const contents = [msg1.content, msg2.content].sort()
    expect(contents).toEqual(["From Alice", "From Charlie"])
  })
})
