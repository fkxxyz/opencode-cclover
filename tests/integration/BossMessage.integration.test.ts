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
      employeeId: "0-alice",
      name: "alice",
      taskId: 0,
      role: "test",
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })
    await stateManager.registerEmployee({
      employeeId: "0-bob",
      name: "bob",
      taskId: 0,
      role: "test",
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: null,
      paused: false,
      activeSessionId: null,
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
      const boss = messageService.getClient("0-bayecao")
      const employee = messageService.getClient("0-alice")

      await boss.send("0-alice", "Hello")

      // 检查 boss 目录结构
      const bossDir = path.join(
        TEST_WORKSPACE,
        "bosses/bayecao/messages/0-alice"
      )
      const bossFile = path.join(bossDir, "chat.yaml")
      const bossExists = await fs
        .access(bossFile)
        .then(() => true)
        .catch(() => false)
      expect(bossExists).toBe(true)

      // 检查 employee 目录结构
      const employeeDir = path.join(
        TEST_WORKSPACE,
        "employees/0-alice/messages/0-bayecao"
      )
      const employeeFile = path.join(employeeDir, "chat.yaml")
      const employeeExists = await fs
        .access(employeeFile)
        .then(() => true)
        .catch(() => false)
      expect(employeeExists).toBe(true)
    })

    test("should create employees directory for employee messages", async () => {
      const employee = messageService.getClient("0-alice")
      const boss = messageService.getClient("0-bayecao")

      await employee.send("0-bayecao", "Report")

      // 检查 employee 目录结构
      const employeeDir = path.join(
        TEST_WORKSPACE,
        "employees/0-alice/messages/0-bayecao"
      )
      const employeeFile = path.join(employeeDir, "chat.yaml")
      const employeeExists = await fs
        .access(employeeFile)
        .then(() => true)
        .catch(() => false)
      expect(employeeExists).toBe(true)

      // 检查 boss 目录结构
      const bossDir = path.join(
        TEST_WORKSPACE,
        "bosses/bayecao/messages/0-alice"
      )
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
      const boss = messageService.getClient("0-bayecao")
      const employee = messageService.getClient("0-alice")

      await boss.send("0-alice", "Task 1")
      await boss.send("0-alice", "Task 2")

      // Employee 接收消息
      const msg1 = await employee.recv()
      const msg2 = await employee.recv()

      expect(msg1.from).toBe("0-bayecao")
      expect(msg1.content).toBe("Task 1")
      expect(msg2.from).toBe("0-bayecao")
      expect(msg2.content).toBe("Task 2")

      // 检查历史记录
      const bossHistory = await boss.history("0-alice")
      const employeeHistory = await employee.history("0-bayecao")

      expect(bossHistory).toHaveLength(2)
      expect(employeeHistory).toHaveLength(2)
      expect(bossHistory[0].content).toBe("Task 1")
      expect(employeeHistory[0].content).toBe("Task 1")
    })

    test("should synchronize employee-to-boss messages", async () => {
      const boss = messageService.getClient("0-bayecao")
      const employee = messageService.getClient("0-alice")

      await employee.send("0-bayecao", "Report 1")
      await employee.send("0-bayecao", "Report 2")

      // Boss 接收消息
      const msg1 = await boss.recv()
      const msg2 = await boss.recv()

      expect(msg1.from).toBe("0-alice")
      expect(msg1.content).toBe("Report 1")
      expect(msg2.from).toBe("0-alice")
      expect(msg2.content).toBe("Report 2")

      // 检查历史记录
      const bossHistory = await boss.history("0-alice")
      const employeeHistory = await employee.history("0-bayecao")

      expect(bossHistory).toHaveLength(2)
      expect(employeeHistory).toHaveLength(2)
    })

    test("should handle bidirectional communication", async () => {
      const boss = messageService.getClient("0-bayecao")
      const employee = messageService.getClient("0-alice")

      // 双向通信
      await boss.send("0-alice", "Do task A")
      await employee.send("0-bayecao", "Task A done")
      await boss.send("0-alice", "Do task B")
      await employee.send("0-bayecao", "Task B done")

      // 检查历史记录
      const bossHistory = await boss.history("0-alice")
      const employeeHistory = await employee.history("0-bayecao")

      expect(bossHistory).toHaveLength(4)
      expect(employeeHistory).toHaveLength(4)

      // 验证消息顺序
      expect(bossHistory[0].from).toBe("0-bayecao")
      expect(bossHistory[1].from).toBe("0-alice")
      expect(bossHistory[2].from).toBe("0-bayecao")
      expect(bossHistory[3].from).toBe("0-alice")
    })
  })

  describe("Multiple bosses", () => {
    test("should handle messages from different bosses", async () => {
      const boss1 = messageService.getClient("0-bayecao")
      const boss2 = messageService.getClient("0-admin")
      const employee = messageService.getClient("0-alice")

      await boss1.send("0-alice", "From bayecao")
      await boss2.send("0-alice", "From admin")

      const msg1 = await employee.recv()
      const msg2 = await employee.recv()

      const messages = [msg1, msg2].sort((a, b) => a.from.localeCompare(b.from))
      expect(messages[0].from).toBe("0-admin")
      expect(messages[1].from).toBe("0-bayecao")
    })

    test("should isolate messages between different bosses", async () => {
      const boss1 = messageService.getClient("0-bayecao")
      const boss2 = messageService.getClient("0-admin")
      const employee = messageService.getClient("0-alice")

      await boss1.send("0-alice", "From bayecao")
      await boss2.send("0-alice", "From admin")

      // 检查各自的历史记录
      const boss1History = await boss1.history("0-alice")
      const boss2History = await boss2.history("0-alice")

      expect(boss1History).toHaveLength(1)
      expect(boss2History).toHaveLength(1)
      expect(boss1History[0].content).toBe("From bayecao")
      expect(boss2History[0].content).toBe("From admin")
    })
  })

  describe("Employee-to-employee messages", () => {
    test("should not affect employee-to-employee communication", async () => {
      const alice = messageService.getClient("0-alice")
      const bob = messageService.getClient("0-bob")

      await alice.send("0-bob", "Hello Bob")

      const message = await bob.recv()
      expect(message.from).toBe("0-alice")
      expect(message.content).toBe("Hello Bob")

      // 检查文件路径（应该在 employees 目录下）
      const alicePath = messageService.getMessageFilePath("0-alice", "0-bob")
      expect(alicePath).toContain("employees/0-alice/messages/0-bob")

      const bobPath = messageService.getMessageFilePath("0-bob", "0-alice")
      expect(bobPath).toContain("employees/0-bob/messages/0-alice")
    })
  })

  describe("Edge cases", () => {
    test("should handle boss name same as employee name", async () => {
      // 这种情况不应该发生，但测试系统的健壮性
      const client = messageService.getClient("0-bayecao")

      // bayecao 作为 boss 发送消息给 alice
      await client.send("0-alice", "As boss")

      // 检查路径
      const path = messageService.getMessageFilePath("0-bayecao", "0-alice")
      expect(path).toContain("bosses/bayecao/messages/0-alice")
    })

    test("should handle empty message content", async () => {
      const boss = messageService.getClient("0-bayecao")
      const employee = messageService.getClient("0-alice")

      await boss.send("0-alice", "")

      const message = await employee.recv()
      expect(message.content).toBe("")
    })

    test("should handle special characters in message", async () => {
      const boss = messageService.getClient("0-bayecao")
      const employee = messageService.getClient("0-alice")

      const specialContent = "Hello\nWorld\t测试\r\n特殊字符: @#$%^&*()"
      await boss.send("0-alice", specialContent)

      const message = await employee.recv()
      expect(message.content).toBe(specialContent)
    })
  })
})
