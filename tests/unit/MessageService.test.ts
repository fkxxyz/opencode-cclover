import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { StateManager } from "../../src/state/StateManager"
import { BossManager } from "../../src/core/BossManager"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { createTestEmployee } from "../helpers/employeeFactory"
import {
  getTestProjectPaths,
  resetTestWorkspace,
} from "../helpers/testWorkspace"

const { suiteRoot, projectPath, workspaceRoot } =
  getTestProjectPaths("message-service")

describe("MessageService", () => {
  let service: MessageService
  let stateManager: StateManager
  let bossManager: BossManager

  beforeEach(async () => {
    // 清理测试工作空间
    await resetTestWorkspace(suiteRoot)

    // 创建 StateManager 和 BossManager
    stateManager = new StateManager("test-project", workspaceRoot, projectPath)
    bossManager = new BossManager(undefined, workspaceRoot)

    // 注册测试员工
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_alice",
        name: "alice",
        hiredBy: null,
        roleId: "test-role",
      })
    )
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_bob",
        name: "bob",
        hiredBy: null,
        roleId: "test-role",
      })
    )
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_charlie",
        name: "charlie",
        hiredBy: null,
        roleId: "test-role",
      })
    )

    // 添加测试 boss
    bossManager.addBoss("bayecao")

    // 创建服务实例
    service = new MessageService(
      workspaceRoot,
      stateManager,
      undefined,
      bossManager
    )
  })

  afterEach(async () => {
    // 清理测试工作空间
    await fs.rm(suiteRoot, { recursive: true, force: true })
  })

  test("should send and receive message", async () => {
    const alice = service.getClient("ews_alice")
    const bob = service.getClient("ews_bob")

    // Alice 发送消息
    await alice.send("ews_bob", "Hello Bob")

    // Bob 接收消息
    const message = await bob.recv()
    expect(message.from).toBe("ews_alice")
    expect(message.content).toBe("Hello Bob")
    expect(message.timestamp).toBeDefined()
  })

  test("should handle multiple messages in order", async () => {
    const alice = service.getClient("ews_alice")
    const bob = service.getClient("ews_bob")

    // 发送多条消息
    await alice.send("ews_bob", "Message 1")
    await alice.send("ews_bob", "Message 2")
    await alice.send("ews_bob", "Message 3")

    // 按顺序接收
    const msg1 = await bob.recv()
    const msg2 = await bob.recv()
    const msg3 = await bob.recv()

    expect(msg1.content).toBe("Message 1")
    expect(msg2.content).toBe("Message 2")
    expect(msg3.content).toBe("Message 3")
  })

  test("should block recv() when no messages", async () => {
    const alice = service.getClient("ews_alice")
    const bob = service.getClient("ews_bob")

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
    await alice.send("ews_bob", "Hello")

    // Bob 应该收到消息
    const message = await recvPromise
    expect(received).toBe(true)
    expect(message.content).toBe("Hello")
  })

  test("should persist messages to YAML files", async () => {
    const alice = service.getClient("ews_alice")

    // 发送消息
    await alice.send("ews_bob", "Test message")

    // 检查文件是否存在
    const aliceFilePath = service.getMessageFilePath("ews_alice", "ews_bob")
    const bobFilePath = service.getMessageFilePath("ews_bob", "ews_alice")

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
    const alice = service.getClient("ews_alice")
    const bob = service.getClient("ews_bob")

    // 发送多条消息
    await alice.send("ews_bob", "Message 1")
    await bob.send("ews_alice", "Message 2")
    await alice.send("ews_bob", "Message 3")

    // 清空未读队列
    await bob.recv()
    await alice.recv()
    await bob.recv()

    // 查询历史
    const aliceHistory = await alice.history("ews_bob")
    expect(aliceHistory.length).toBe(3)
    expect(aliceHistory[0].content).toBe("Message 1")
    expect(aliceHistory[1].content).toBe("Message 2")
    expect(aliceHistory[2].content).toBe("Message 3")

    // 查询限制数量
    const limitedHistory = await alice.history("ews_bob", 2)
    expect(limitedHistory.length).toBe(2)
    expect(limitedHistory[0].content).toBe("Message 2")
    expect(limitedHistory[1].content).toBe("Message 3")
  })

  test("should return empty history for non-existent conversation", async () => {
    const alice = service.getClient("ews_alice")

    const history = await alice.history("ews_bob")
    expect(history.length).toBe(0)
  })

  test("should handle bidirectional conversation", async () => {
    const alice = service.getClient("ews_alice")
    const bob = service.getClient("ews_bob")

    // 双向对话
    await alice.send("ews_bob", "Hi Bob")
    const msg1 = await bob.recv()
    expect(msg1.content).toBe("Hi Bob")

    await bob.send("ews_alice", "Hi Alice")
    const msg2 = await alice.recv()
    expect(msg2.content).toBe("Hi Alice")

    // 检查历史记录
    const aliceHistory = await alice.history("ews_bob")
    expect(aliceHistory.length).toBe(2)
    expect(aliceHistory[0].from).toBe("ews_alice")
    expect(aliceHistory[1].from).toBe("ews_bob")

    const bobHistory = await bob.history("ews_alice")
    expect(bobHistory.length).toBe(2)
    expect(bobHistory[0].from).toBe("ews_alice")
    expect(bobHistory[1].from).toBe("ews_bob")
  })

  test("should handle multiple concurrent clients", async () => {
    const alice = service.getClient("ews_alice")
    const bob = service.getClient("ews_bob")
    const charlie = service.getClient("ews_charlie")

    // 多个客户端同时发送消息
    await Promise.all([
      alice.send("ews_bob", "From Alice"),
      charlie.send("ews_bob", "From Charlie"),
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
        getBossName: () => null,
        reload: async () => {},
        addBoss: () => {},
        removeBoss: () => {},
        recordSession: async () => {},
        getSession: async () => undefined,
        clearSession: async () => {},
      }
      const serviceWithBoss = new MessageService(
        workspaceRoot,
        undefined,
        "test-project",
        bossManager
      )
      // Boss 的消息路径
      const bossPath = serviceWithBoss.getMessageFilePath(
        "boss_bayecao",
        "ews_alice"
      )
      expect(bossPath).toContain("bosses/bayecao/messages/ews_alice")
      // Employee 的消息路径
      const employeePath = serviceWithBoss.getMessageFilePath(
        "ews_alice",
        "boss_bayecao"
      )
      // alice is an EWS (not a boss), so it uses ews directory
      expect(employeePath).toContain("ews/ews_alice/messages/boss_bayecao")
    })

    test("should send message from boss to employee", async () => {
      const testBossManager = {
        isBoss: (name: string) => name === "bayecao",
        getBosses: () => ["bayecao"],
        getBossName: () => null,
        reload: async () => {},
        addBoss: () => {},
        removeBoss: () => {},
        recordSession: async () => {},
        getSession: async () => undefined,
        clearSession: async () => {},
      }
      const serviceWithBoss = new MessageService(
        workspaceRoot,
        stateManager,
        "test-project",
        testBossManager
      )
      const boss = serviceWithBoss.getClient("boss_bayecao")
      const employee = serviceWithBoss.getClient("ews_alice")
      // Boss 发送消息
      await boss.send("ews_alice", "Hello from boss")
      // Employee 接收消息
      const message = await employee.recv()
      expect(message.from).toBe("boss_bayecao")
      expect(message.content).toBe("Hello from boss")
    })

    test("should send message from employee to boss", async () => {
      const testBossManager = {
        isBoss: (name: string) => name === "bayecao",
        getBosses: () => ["bayecao"],
        getBossName: () => null,
        reload: async () => {},
        addBoss: () => {},
        removeBoss: () => {},
        recordSession: async () => {},
        getSession: async () => undefined,
        clearSession: async () => {},
      }
      const serviceWithBoss = new MessageService(
        workspaceRoot,
        stateManager,
        "test-project",
        testBossManager
      )
      const boss = serviceWithBoss.getClient("boss_bayecao")
      const employee = serviceWithBoss.getClient("ews_alice")
      // Employee 发送消息
      await employee.send("boss_bayecao", "Report from employee")
      // Boss 接收消息
      const message = await boss.recv()
      expect(message.from).toBe("ews_alice")
      expect(message.content).toBe("Report from employee")
    })

    test("should query boss-employee message history", async () => {
      const testBossManager = {
        isBoss: (name: string) => name === "bayecao",
        getBosses: () => ["bayecao"],
        getBossName: () => null,
        reload: async () => {},
        addBoss: () => {},
        removeBoss: () => {},
        recordSession: async () => {},
        getSession: async () => undefined,
        clearSession: async () => {},
      }
      const serviceWithBoss = new MessageService(
        workspaceRoot,
        stateManager,
        "test-project",
        testBossManager
      )
      const boss = serviceWithBoss.getClient("boss_bayecao")
      const employee = serviceWithBoss.getClient("ews_alice")
      // 双向通信
      await boss.send("ews_alice", "Task 1")
      await employee.send("boss_bayecao", "Done")
      await boss.send("ews_alice", "Task 2")
      // 查询历史
      const bossHistory = await boss.history("ews_alice")
      expect(bossHistory).toHaveLength(3)
      expect(bossHistory[0].from).toBe("boss_bayecao")
      expect(bossHistory[1].from).toBe("ews_alice")
      expect(bossHistory[2].from).toBe("boss_bayecao")
      const employeeHistory = await employee.history("boss_bayecao")
      expect(employeeHistory).toHaveLength(3)
      expect(employeeHistory[0].from).toBe("boss_bayecao")
      expect(employeeHistory[1].from).toBe("ews_alice")
      expect(employeeHistory[2].from).toBe("boss_bayecao")
    })
  })

  describe("Message validation", () => {
    test("should throw error when sending to self", async () => {
      const alice = service.getClient("ews_alice")
      await expect(alice.send("ews_alice", "Hello myself")).rejects.toThrow(
        "不能向自己发送消息"
      )
    })

    test("should reject old meeting-mode 0-* target format", async () => {
      const alice = service.getClient("ews_alice")
      await expect(alice.send("0-nonexistent", "Hello")).rejects.toThrow(
        "Unsupported message target '0-nonexistent'. Use employee_work_session_id or boss_id."
      )
    })

    test("should allow sending to existing employee", async () => {
      const alice = service.getClient("ews_alice")
      await alice.send("ews_bob", "Hello Bob")
      // 如果没有抛出异常，测试通过
      const bob = service.getClient("ews_bob")
      const message = await bob.recv()
      expect(message.from).toBe("ews_alice")
    })

    test("should allow sending to boss", async () => {
      const alice = service.getClient("ews_alice")
      await alice.send("boss_bayecao", "Hello Boss")
      // 如果没有抛出异常，测试通过
      const boss = service.getClient("boss_bayecao")
      const message = await boss.recv()
      expect(message.from).toBe("ews_alice")
    })
  })

  describe("Message routing", () => {
    test("should route messages by stable employeeId", async () => {
      const alice = service.getClient("ews_alice")
      const bob = service.getClient("ews_bob")

      await alice.send("ews_bob", "Same task message")

      const message = await bob.recv()
      expect(message.from).toBe("ews_alice")
      expect(message.content).toBe("Same task message")

      // 验证文件路径格式
      const aliceFilePath = path.join(
        workspaceRoot,
        "ews",
        "ews_alice",
        "messages",
        "ews_bob",
        "chat.yaml"
      )
      const fileExists = await fs
        .access(aliceFilePath)
        .then(() => true)
        .catch(() => false)
      expect(fileExists).toBe(true)
    })

    test("should reject globally unique employee names", async () => {
      const alice = service.getClient("ews_alice")

      await expect(alice.send("bob", "Unique name message")).rejects.toThrow(
        "Unsupported message target 'bob'. Use employee_work_session_id or boss_id."
      )
    })

    test("should reject duplicate employee names instead of task-scoped expansion", async () => {
      await stateManager.registerEmployee(
        createTestEmployee({
          employeeId: "emp_second_bob",
          name: "bob",
          hiredBy: "ews_alice",
          roleId: "test-role",
        })
      )

      const alice = service.getClient("ews_alice")

      await expect(alice.send("bob", "Ambiguous name")).rejects.toThrow(
        "Unsupported message target 'bob'. Use employee_work_session_id or boss_id."
      )
    })

    test("should reject unknown short names without same-task expansion", async () => {
      const alice = service.getClient("ews_alice")

      await expect(alice.send("ghost", "Unknown name")).rejects.toThrow(
        "Unsupported message target 'ghost'. Use employee_work_session_id or boss_id."
      )
    })

    test("should record message event fromRole as sender roleId", async () => {
      const alice = service.getClient("ews_alice")

      await alice.send("ews_bob", "Role id event")

      const events = stateManager.getEvents({
        employeeWorkSessionId: "ews_alice",
        limit: 5,
      })
      const event = events.find(
        (event) =>
          event.type === "message" && event.details.content === "Role id event"
      )

      expect(event?.details.from).toBe("ews_alice")
      expect(event?.employeeWorkSessionId).toBe("ews_alice")
    })

    test("should route messages between stable employee IDs", async () => {
      // 注册另一个稳定 ID 员工
      await stateManager.registerEmployee(
        createTestEmployee({
          employeeId: "emp_dave",
          name: "dave",
          hiredBy: "ews_alice",
          roleId: "test-role",
        })
      )

      const alice = service.getClient("ews_alice")
      const dave = service.getClient("ews_dave")

      // Alice 发送消息给 Dave
      await alice.send("ews_dave", "Stable ID message")

      const message = await dave.recv()
      expect(message.from).toBe("ews_alice")
      expect(message.content).toBe("Stable ID message")

      // 验证文件路径格式使用稳定 employeeId
      const aliceFilePath = path.join(
        workspaceRoot,
        "ews",
        "ews_alice",
        "messages",
        "ews_dave",
        "chat.yaml"
      )
      const daveFilePath = path.join(
        workspaceRoot,
        "ews",
        "ews_dave",
        "messages",
        "ews_alice",
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
      const boss = service.getClient("boss_bayecao")
      const alice = service.getClient("ews_alice")

      await boss.send("ews_alice", "Boss message")

      const message = await alice.recv()
      expect(message.from).toBe("boss_bayecao")
      expect(message.content).toBe("Boss message")

      // 验证 boss 使用 bosses 目录
      const bossFilePath = path.join(
        workspaceRoot,
        "bosses",
        "bayecao",
        "messages",
        "ews_alice",
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
      const alice = service.getClient("ews_alice")
      const boss = service.getClient("boss_bayecao")

      await alice.send("boss_bayecao", "Message to boss")

      const message = await boss.recv()
      expect(message.from).toBe("ews_alice")
      expect(message.content).toBe("Message to boss")

      // 验证员工使用 employees 目录
      const aliceFilePath = path.join(
        workspaceRoot,
        "ews",
        "ews_alice",
        "messages",
        "boss_bayecao",
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
      const alice = service.getClient("ews_alice")
      const bob = service.getClient("ews_bob")
      const docs = ["/path/to/file1.ts", "/path/to/file2.md"]

      await alice.send("ews_bob", "请查看这些文件", docs)

      const message = await bob.recv()
      expect(message.reference_docs).toEqual(docs)
    })

    test("should work without reference_docs (backward compatibility)", async () => {
      const alice = service.getClient("ews_alice")
      const bob = service.getClient("ews_bob")

      await alice.send("ews_bob", "普通消息")

      const message = await bob.recv()
      expect(message.reference_docs).toBeUndefined()
    })

    test("should persist reference_docs in YAML", async () => {
      const alice = service.getClient("ews_alice")
      const bob = service.getClient("ews_bob")
      const docs = ["/path/to/file.ts"]

      await alice.send("ews_bob", "消息", docs)

      const history = await bob.history("ews_alice")
      expect(history[0].reference_docs).toEqual(docs)
    })
  })
})
