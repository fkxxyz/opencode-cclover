import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { StateManager } from "../../src/state/StateManager"
import { BossManager } from "../../src/core/BossManager"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const TEST_WORKSPACE = path.join(import.meta.dir, "../fixtures/test-workspace")

describe("MessageService", () => {
  let service: MessageService
  let stateManager: StateManager
  let bossManager: BossManager

  beforeEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 创建 StateManager 和 BossManager
    stateManager = new StateManager("test-project", TEST_WORKSPACE)
    bossManager = new BossManager(undefined, TEST_WORKSPACE)

    // 注册测试员工
    await stateManager.registerEmployee({
      employeeId: "0-alice",
      name: "alice",
      taskId: 0,
      hiredBy: null,
      role: "test",
      paused: false,
      status: "offline",
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
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      activeSessionId: null,
    })
    await stateManager.registerEmployee({
      employeeId: "0-charlie",
      name: "charlie",
      taskId: 0,
      hiredBy: null,
      role: "test",
      paused: false,
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      activeSessionId: null,
    })

    // 添加测试 boss
    bossManager.addBoss("bayecao")

    // 创建服务实例
    service = new MessageService(
      TEST_WORKSPACE,
      stateManager,
      undefined,
      bossManager
    )
  })

  afterEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  test("should send and receive message", async () => {
    const alice = service.getClient("0-alice")
    const bob = service.getClient("0-bob")

    // Alice 发送消息
    await alice.send("0-bob", "Hello Bob")

    // Bob 接收消息
    const message = await bob.recv()
    expect(message.from).toBe("0-alice")
    expect(message.content).toBe("Hello Bob")
    expect(message.timestamp).toBeDefined()
  })

  test("should handle multiple messages in order", async () => {
    const alice = service.getClient("0-alice")
    const bob = service.getClient("0-bob")

    // 发送多条消息
    await alice.send("0-bob", "Message 1")
    await alice.send("0-bob", "Message 2")
    await alice.send("0-bob", "Message 3")

    // 按顺序接收
    const msg1 = await bob.recv()
    const msg2 = await bob.recv()
    const msg3 = await bob.recv()

    expect(msg1.content).toBe("Message 1")
    expect(msg2.content).toBe("Message 2")
    expect(msg3.content).toBe("Message 3")
  })

  test("should block recv() when no messages", async () => {
    const alice = service.getClient("0-alice")
    const bob = service.getClient("0-bob")

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
    await alice.send("0-bob", "Hello")

    // Bob 应该收到消息
    const message = await recvPromise
    expect(received).toBe(true)
    expect(message.content).toBe("Hello")
  })

  test("should persist messages to YAML files", async () => {
    const alice = service.getClient("0-alice")
    const bob = service.getClient("0-bob")

    // 发送消息
    await alice.send("0-bob", "Test message")

    // 检查文件是否存在
    const aliceFilePath = service.getMessageFilePath("0-alice", "0-bob")
    const bobFilePath = service.getMessageFilePath("0-bob", "0-alice")

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
    const alice = service.getClient("0-alice")
    const bob = service.getClient("0-bob")

    // 发送多条消息
    await alice.send("0-bob", "Message 1")
    await bob.send("0-alice", "Message 2")
    await alice.send("0-bob", "Message 3")

    // 清空未读队列
    await bob.recv()
    await alice.recv()
    await bob.recv()

    // 查询历史
    const aliceHistory = await alice.history("0-bob")
    expect(aliceHistory.length).toBe(3)
    expect(aliceHistory[0].content).toBe("Message 1")
    expect(aliceHistory[1].content).toBe("Message 2")
    expect(aliceHistory[2].content).toBe("Message 3")

    // 查询限制数量
    const limitedHistory = await alice.history("0-bob", 2)
    expect(limitedHistory.length).toBe(2)
    expect(limitedHistory[0].content).toBe("Message 2")
    expect(limitedHistory[1].content).toBe("Message 3")
  })

  test("should return empty history for non-existent conversation", async () => {
    const alice = service.getClient("0-alice")

    const history = await alice.history("0-bob")
    expect(history.length).toBe(0)
  })

  test("should handle bidirectional conversation", async () => {
    const alice = service.getClient("0-alice")
    const bob = service.getClient("0-bob")

    // 双向对话
    await alice.send("0-bob", "Hi Bob")
    const msg1 = await bob.recv()
    expect(msg1.content).toBe("Hi Bob")

    await bob.send("0-alice", "Hi Alice")
    const msg2 = await alice.recv()
    expect(msg2.content).toBe("Hi Alice")

    // 检查历史记录
    const aliceHistory = await alice.history("0-bob")
    expect(aliceHistory.length).toBe(2)
    expect(aliceHistory[0].from).toBe("0-alice")
    expect(aliceHistory[1].from).toBe("0-bob")

    const bobHistory = await bob.history("0-alice")
    expect(bobHistory.length).toBe(2)
    expect(bobHistory[0].from).toBe("0-alice")
    expect(bobHistory[1].from).toBe("0-bob")
  })

  test("should handle multiple concurrent clients", async () => {
    const alice = service.getClient("0-alice")
    const bob = service.getClient("0-bob")
    const charlie = service.getClient("0-charlie")

    // 多个客户端同时发送消息
    await Promise.all([
      alice.send("0-bob", "From Alice"),
      charlie.send("0-bob", "From Charlie"),
    ])

    // Bob 接收两条消息
    const msg1 = await bob.recv()
    const msg2 = await bob.recv()

    const contents = [msg1.content, msg2.content].sort()
    expect(contents).toEqual(["From Alice", "From Charlie"])
  })

  describe("Boss message system", () => {
    test("should use bosses directory for boss messages", () => {
      const bossManager = {
        isBoss: (name: string) => name === "bayecao",
        getBosses: () => ["bayecao"],
        reload: async () => {},
        addBoss: () => {},
        removeBoss: () => {},
      }
      const serviceWithBoss = new MessageService(
        TEST_WORKSPACE,
        undefined,
        "test-project",
        bossManager
      )
      // Boss 的消息路径
      const bossPath = serviceWithBoss.getMessageFilePath(
        "0-bayecao",
        "0-alice"
      )
      expect(bossPath).toContain("bosses/bayecao/messages/0-alice")
      // Employee 的消息路径
      const employeePath = serviceWithBoss.getMessageFilePath(
        "0-alice",
        "0-bayecao"
      )
      // alice is an employee (not a boss), so it uses employees directory
      expect(employeePath).toContain("employees/0-alice/messages/0-bayecao")
    })

    test("should send message from boss to employee", async () => {
      const testBossManager = {
        isBoss: (name: string) => name === "bayecao",
        getBosses: () => ["bayecao"],
        reload: async () => {},
        addBoss: () => {},
        removeBoss: () => {},
        recordSession: async () => {},
        getSession: async () => undefined,
        clearSession: async () => {},
      }
      const serviceWithBoss = new MessageService(
        TEST_WORKSPACE,
        stateManager,
        "test-project",
        testBossManager
      )
      const boss = serviceWithBoss.getClient("0-bayecao")
      const employee = serviceWithBoss.getClient("0-alice")
      // Boss 发送消息
      await boss.send("0-alice", "Hello from boss")
      // Employee 接收消息
      const message = await employee.recv()
      expect(message.from).toBe("0-bayecao")
      expect(message.content).toBe("Hello from boss")
    })

    test("should send message from employee to boss", async () => {
      const testBossManager = {
        isBoss: (name: string) => name === "bayecao",
        getBosses: () => ["bayecao"],
        reload: async () => {},
        addBoss: () => {},
        removeBoss: () => {},
        recordSession: async () => {},
        getSession: async () => undefined,
        clearSession: async () => {},
      }
      const serviceWithBoss = new MessageService(
        TEST_WORKSPACE,
        stateManager,
        "test-project",
        testBossManager
      )
      const boss = serviceWithBoss.getClient("0-bayecao")
      const employee = serviceWithBoss.getClient("0-alice")
      // Employee 发送消息
      await employee.send("0-bayecao", "Report from employee")
      // Boss 接收消息
      const message = await boss.recv()
      expect(message.from).toBe("0-alice")
      expect(message.content).toBe("Report from employee")
    })

    test("should query boss-employee message history", async () => {
      const testBossManager = {
        isBoss: (name: string) => name === "bayecao",
        getBosses: () => ["bayecao"],
        reload: async () => {},
        addBoss: () => {},
        removeBoss: () => {},
        recordSession: async () => {},
        getSession: async () => undefined,
        clearSession: async () => {},
      }
      const serviceWithBoss = new MessageService(
        TEST_WORKSPACE,
        stateManager,
        "test-project",
        testBossManager
      )
      const boss = serviceWithBoss.getClient("0-bayecao")
      const employee = serviceWithBoss.getClient("0-alice")
      // 双向通信
      await boss.send("0-alice", "Task 1")
      await employee.send("0-bayecao", "Done")
      await boss.send("0-alice", "Task 2")
      // 查询历史
      const bossHistory = await boss.history("0-alice")
      expect(bossHistory).toHaveLength(3)
      expect(bossHistory[0].from).toBe("0-bayecao")
      expect(bossHistory[1].from).toBe("0-alice")
      expect(bossHistory[2].from).toBe("0-bayecao")
      const employeeHistory = await employee.history("0-bayecao")
      expect(employeeHistory).toHaveLength(3)
      expect(employeeHistory[0].from).toBe("0-bayecao")
      expect(employeeHistory[1].from).toBe("0-alice")
      expect(employeeHistory[2].from).toBe("0-bayecao")
    })
  })

  describe("Message validation", () => {
    test("should throw error when sending to self", async () => {
      const alice = service.getClient("0-alice")
      await expect(alice.send("0-alice", "Hello myself")).rejects.toThrow(
        "不能向自己发送消息"
      )
    })

    test("should throw error when sending to non-existent employee", async () => {
      const alice = service.getClient("0-alice")
      await expect(alice.send("0-nonexistent", "Hello")).rejects.toThrow(
        "目标 '0-nonexistent' 不存在"
      )
    })

    test("should allow sending to existing employee", async () => {
      const alice = service.getClient("0-alice")
      await alice.send("0-bob", "Hello Bob")
      // 如果没有抛出异常，测试通过
      const bob = service.getClient("0-bob")
      const message = await bob.recv()
      expect(message.from).toBe("0-alice")
    })

    test("should allow sending to boss", async () => {
      const alice = service.getClient("0-alice")
      await alice.send("0-bayecao", "Hello Boss")
      // 如果没有抛出异常，测试通过
      const boss = service.getClient("0-bayecao")
      const message = await boss.recv()
      expect(message.from).toBe("0-alice")
    })
  })

  describe("Message routing", () => {
    test("should route messages between employees in same task", async () => {
      // alice 和 bob 都在 taskId=0
      const alice = service.getClient("0-alice")
      const bob = service.getClient("0-bob")

      await alice.send("0-bob", "Same task message")

      const message = await bob.recv()
      expect(message.from).toBe("0-alice")
      expect(message.content).toBe("Same task message")

      // 验证文件路径格式
      const aliceFilePath = path.join(
        TEST_WORKSPACE,
        "employees",
        "0-alice",
        "messages",
        "0-bob",
        "chat.yaml"
      )
      const fileExists = await fs
        .access(aliceFilePath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
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
        status: "offline",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        activeSessionId: null,
      })

      const alice = service.getClient("0-alice") // taskId=0
      const dave = service.getClient("1-dave") // taskId=1

      // Alice (task 0) 发送消息给 Dave (task 1)
      await alice.send("1-dave", "Cross-task message")

      const message = await dave.recv()
      expect(message.from).toBe("0-alice")
      expect(message.content).toBe("Cross-task message")

      // 验证文件路径格式 (employeeId 包含 taskId 前缀)
      const aliceFilePath = path.join(
        TEST_WORKSPACE,
        "employees",
        "0-alice",
        "messages",
        "1-dave",
        "chat.yaml"
      )
      const daveFilePath = path.join(
        TEST_WORKSPACE,
        "employees",
        "1-dave",
        "messages",
        "0-alice",
        "chat.yaml"
      )

      const aliceFileExists = await fs
        .access(aliceFilePath)
        .then(() => true)
        .catch(() => false)
      const daveFileExists = await fs
        .access(daveFilePath)
        .then(() => true)
        .catch(() => false)

      expect(aliceFileExists).toBe(true)
      expect(daveFileExists).toBe(true)
    })

    test("should route messages from boss to employee", async () => {
      // Boss 发送消息给员工
      const boss = service.getClient("0-bayecao")
      const alice = service.getClient("0-alice")

      await boss.send("0-alice", "Boss message")

      const message = await alice.recv()
      expect(message.from).toBe("0-bayecao")
      expect(message.content).toBe("Boss message")

      // 验证 boss 使用 bosses 目录
      const bossFilePath = path.join(
        TEST_WORKSPACE,
        "bosses",
        "bayecao",
        "messages",
        "0-alice",
        "chat.yaml"
      )
      const fileExists = await fs
        .access(bossFilePath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })

    test("should route messages from employee to boss", async () => {
      // 员工发送消息给 Boss
      const alice = service.getClient("0-alice")
      const boss = service.getClient("0-bayecao")

      await alice.send("0-bayecao", "Message to boss")

      const message = await boss.recv()
      expect(message.from).toBe("0-alice")
      expect(message.content).toBe("Message to boss")

      // 验证员工使用 employees 目录
      const aliceFilePath = path.join(
        TEST_WORKSPACE,
        "employees",
        "0-alice",
        "messages",
        "0-bayecao",
        "chat.yaml"
      )
      const fileExists = await fs
        .access(aliceFilePath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })
  })

  describe("reference_docs support", () => {
    test("should send message with reference_docs", async () => {
      const alice = service.getClient("0-alice")
      const bob = service.getClient("0-bob")
      const docs = ["/path/to/file1.ts", "/path/to/file2.md"]

      await alice.send("0-bob", "请查看这些文件", docs)

      const message = await bob.recv()
      expect(message.reference_docs).toEqual(docs)
    })

    test("should work without reference_docs (backward compatibility)", async () => {
      const alice = service.getClient("0-alice")
      const bob = service.getClient("0-bob")

      await alice.send("0-bob", "普通消息")

      const message = await bob.recv()
      expect(message.reference_docs).toBeUndefined()
    })

    test("should persist reference_docs in YAML", async () => {
      const alice = service.getClient("0-alice")
      const bob = service.getClient("0-bob")
      const docs = ["/path/to/file.ts"]

      await alice.send("0-bob", "消息", docs)

      const history = await bob.history("0-alice")
      expect(history[0].reference_docs).toEqual(docs)
    })
  })
})
