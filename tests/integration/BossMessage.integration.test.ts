import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { BossManager } from "../../src/core/BossManager"
import { StateManager } from "../../src/state/StateManager"
import type { CcloverConfig } from "../../src/config/ConfigManager"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../fixtures/boss-message-test"
)

describe("Boss Message Integration", () => {
  let bossManager: BossManager
  let messageService: MessageService
  let stateManager: StateManager

  beforeEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 创建 BossManager
    const config: CcloverConfig = {
      bosses: ["bayecao", "admin"],
      projects: [],
    }
    bossManager = new BossManager(config)

    // 创建 StateManager 并注册测试员工
    stateManager = new StateManager("test-project", TEST_WORKSPACE)
    await stateManager.registerEmployee({
      name: "alice",
      role: "test",
      status: "inactive",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
    await stateManager.registerEmployee({
      name: "bob",
      role: "test",
      status: "inactive",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 创建 MessageService
    messageService = new MessageService(
      TEST_WORKSPACE,
      stateManager,
      "test-project",
      bossManager
    )
  })

  afterEach(async () => {
    // 清理测试工作空间
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  describe("File structure", () => {
    test("should create bosses directory for boss messages", async () => {
      const boss = messageService.getClient("bayecao")
      const employee = messageService.getClient("alice")

      await boss.send("alice", "Hello")

      // 检查 boss 目录结构
      const bossDir = path.join(TEST_WORKSPACE, "bosses/bayecao/messages/alice")
      const bossFile = path.join(bossDir, "chat.yaml")
      const bossExists = await fs
        .access(bossFile)
        .then(() => true)
        .catch(() => false)
      expect(bossExists).toBe(true)

      // 检查 employee 目录结构
      const employeeDir = path.join(
        TEST_WORKSPACE,
        "employees/alice/messages/bayecao"
      )
      const employeeFile = path.join(employeeDir, "chat.yaml")
      const employeeExists = await fs
        .access(employeeFile)
        .then(() => true)
        .catch(() => false)
      expect(employeeExists).toBe(true)
    })

    test("should create employees directory for employee messages", async () => {
      const employee = messageService.getClient("alice")
      const boss = messageService.getClient("bayecao")

      await employee.send("bayecao", "Report")

      // 检查 employee 目录结构
      const employeeDir = path.join(
        TEST_WORKSPACE,
        "employees/alice/messages/bayecao"
      )
      const employeeFile = path.join(employeeDir, "chat.yaml")
      const employeeExists = await fs
        .access(employeeFile)
        .then(() => true)
        .catch(() => false)
      expect(employeeExists).toBe(true)

      // 检查 boss 目录结构
      const bossDir = path.join(TEST_WORKSPACE, "bosses/bayecao/messages/alice")
      const bossFile = path.join(bossDir, "chat.yaml")
      const bossExists = await fs
        .access(bossFile)
        .then(() => true)
        .catch(() => false)
      expect(bossExists).toBe(true)
    })
  })

  describe("Message synchronization", () => {
    test("should synchronize boss-to-employee messages", async () => {
      const boss = messageService.getClient("bayecao")
      const employee = messageService.getClient("alice")

      await boss.send("alice", "Task 1")
      await boss.send("alice", "Task 2")

      // Employee 接收消息
      const msg1 = await employee.recv()
      const msg2 = await employee.recv()

      expect(msg1.from).toBe("bayecao")
      expect(msg1.content).toBe("Task 1")
      expect(msg2.from).toBe("bayecao")
      expect(msg2.content).toBe("Task 2")

      // 检查历史记录
      const bossHistory = await boss.history("alice")
      const employeeHistory = await employee.history("bayecao")

      expect(bossHistory).toHaveLength(2)
      expect(employeeHistory).toHaveLength(2)
      expect(bossHistory[0].content).toBe("Task 1")
      expect(employeeHistory[0].content).toBe("Task 1")
    })

    test("should synchronize employee-to-boss messages", async () => {
      const boss = messageService.getClient("bayecao")
      const employee = messageService.getClient("alice")

      await employee.send("bayecao", "Report 1")
      await employee.send("bayecao", "Report 2")

      // Boss 接收消息
      const msg1 = await boss.recv()
      const msg2 = await boss.recv()

      expect(msg1.from).toBe("alice")
      expect(msg1.content).toBe("Report 1")
      expect(msg2.from).toBe("alice")
      expect(msg2.content).toBe("Report 2")

      // 检查历史记录
      const bossHistory = await boss.history("alice")
      const employeeHistory = await employee.history("bayecao")

      expect(bossHistory).toHaveLength(2)
      expect(employeeHistory).toHaveLength(2)
    })

    test("should handle bidirectional communication", async () => {
      const boss = messageService.getClient("bayecao")
      const employee = messageService.getClient("alice")

      // 双向通信
      await boss.send("alice", "Do task A")
      await employee.send("bayecao", "Task A done")
      await boss.send("alice", "Do task B")
      await employee.send("bayecao", "Task B done")

      // 检查历史记录
      const bossHistory = await boss.history("alice")
      const employeeHistory = await employee.history("bayecao")

      expect(bossHistory).toHaveLength(4)
      expect(employeeHistory).toHaveLength(4)

      // 验证消息顺序
      expect(bossHistory[0].from).toBe("bayecao")
      expect(bossHistory[1].from).toBe("alice")
      expect(bossHistory[2].from).toBe("bayecao")
      expect(bossHistory[3].from).toBe("alice")
    })
  })

  describe("Multiple bosses", () => {
    test("should handle messages from different bosses", async () => {
      const boss1 = messageService.getClient("bayecao")
      const boss2 = messageService.getClient("admin")
      const employee = messageService.getClient("alice")

      await boss1.send("alice", "From bayecao")
      await boss2.send("alice", "From admin")

      const msg1 = await employee.recv()
      const msg2 = await employee.recv()

      const messages = [msg1, msg2].sort((a, b) => a.from.localeCompare(b.from))
      expect(messages[0].from).toBe("admin")
      expect(messages[1].from).toBe("bayecao")
    })

    test("should isolate messages between different bosses", async () => {
      const boss1 = messageService.getClient("bayecao")
      const boss2 = messageService.getClient("admin")
      const employee = messageService.getClient("alice")

      await boss1.send("alice", "From bayecao")
      await boss2.send("alice", "From admin")

      // 检查各自的历史记录
      const boss1History = await boss1.history("alice")
      const boss2History = await boss2.history("alice")

      expect(boss1History).toHaveLength(1)
      expect(boss2History).toHaveLength(1)
      expect(boss1History[0].content).toBe("From bayecao")
      expect(boss2History[0].content).toBe("From admin")
    })
  })

  describe("Employee-to-employee messages", () => {
    test("should not affect employee-to-employee communication", async () => {
      const alice = messageService.getClient("alice")
      const bob = messageService.getClient("bob")

      await alice.send("bob", "Hello Bob")

      const message = await bob.recv()
      expect(message.from).toBe("alice")
      expect(message.content).toBe("Hello Bob")

      // 检查文件路径（应该在 employees 目录下）
      const alicePath = messageService.getMessageFilePath("alice", "bob")
      expect(alicePath).toContain("employees/alice/messages/bob")

      const bobPath = messageService.getMessageFilePath("bob", "alice")
      expect(bobPath).toContain("employees/bob/messages/alice")
    })
  })

  describe("Edge cases", () => {
    test("should handle boss name same as employee name", async () => {
      // 这种情况不应该发生，但测试系统的健壮性
      const client = messageService.getClient("bayecao")

      // bayecao 作为 boss 发送消息给 alice
      await client.send("alice", "As boss")

      // 检查路径
      const path = messageService.getMessageFilePath("bayecao", "alice")
      expect(path).toContain("bosses/bayecao/messages/alice")
    })

    test("should handle empty message content", async () => {
      const boss = messageService.getClient("bayecao")
      const employee = messageService.getClient("alice")

      await boss.send("alice", "")

      const message = await employee.recv()
      expect(message.content).toBe("")
    })

    test("should handle special characters in message", async () => {
      const boss = messageService.getClient("bayecao")
      const employee = messageService.getClient("alice")

      const specialContent = "Hello\nWorld\t测试\r\n特殊字符: @#$%^&*()"
      await boss.send("alice", specialContent)

      const message = await employee.recv()
      expect(message.content).toBe(specialContent)
    })
  })
})
