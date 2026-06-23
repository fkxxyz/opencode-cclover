import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { BossManager } from "../../src/core/BossManager"
import { StateManager } from "../../src/state/StateManager"
import { createTestEmployee } from "../helpers/employeeFactory"
import {
  getTestProjectPaths,
  resetTestWorkspace,
} from "../helpers/testWorkspace"
import type { CcloverConfig } from "../../src/config/ConfigManager"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const { suiteRoot, projectPath, workspaceRoot } = getTestProjectPaths(
  "boss-message-integration"
)

describe("Boss Message Integration", () => {
  let bossManager: BossManager
  let messageService: MessageService
  let stateManager: StateManager

  beforeEach(async () => {
    // 清理测试工作空间
    await resetTestWorkspace(suiteRoot)
    await fs.mkdir(workspaceRoot, { recursive: true })

    // 创建 BossManager
    const config: CcloverConfig = {
      bosses: ["bayecao", "admin"],
      projects: [],
    }
    bossManager = new BossManager(config)

    // 创建 StateManager 并注册测试员工
    stateManager = new StateManager("test-project", workspaceRoot, projectPath)
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_alice",
        name: "alice",
        hiredBy: "boss_bayecao" as any,
      })
    )
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_bob",
        name: "bob",
        hiredBy: "boss_bayecao" as any,
      })
    )

    // 创建 MessageService
    messageService = new MessageService(
      workspaceRoot,
      stateManager,
      "test-project",
      bossManager
    )
  })

  afterEach(async () => {
    // 清理测试工作空间
    await fs.rm(suiteRoot, { recursive: true, force: true })
  })

  describe("File structure", () => {
    test("should create bosses directory for boss messages", async () => {
      const boss = messageService.getClient("boss_bayecao")

      await boss.send("ews_alice", "Hello")

      // 检查 boss 目录结构
      const bossDir = path.join(
        workspaceRoot,
        "bosses/bayecao/messages/ews_alice"
      )
      const bossFile = path.join(bossDir, "chat.yaml")
      const bossExists = await fs
        .access(bossFile)
        .then(() => true)
        .catch(() => false)
      expect(bossExists).toBe(true)

      // 检查 employee 目录结构
      const employeeDir = path.join(
        workspaceRoot,
        "ews/ews_alice/messages/boss_bayecao"
      )
      const employeeFile = path.join(employeeDir, "chat.yaml")
      const employeeExists = await fs
        .access(employeeFile)
        .then(() => true)
        .catch(() => false)
      expect(employeeExists).toBe(true)
    })

    test("should create employees directory for employee messages", async () => {
      const employee = messageService.getClient("ews_alice")

      await employee.send("boss_bayecao", "Report")

      // 检查 employee 目录结构
      const employeeDir = path.join(
        workspaceRoot,
        "ews/ews_alice/messages/boss_bayecao"
      )
      const employeeFile = path.join(employeeDir, "chat.yaml")
      const employeeExists = await fs
        .access(employeeFile)
        .then(() => true)
        .catch(() => false)
      expect(employeeExists).toBe(true)

      // 检查 boss 目录结构
      const bossDir = path.join(
        workspaceRoot,
        "bosses/bayecao/messages/ews_alice"
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
      const boss = messageService.getClient("boss_bayecao")
      const employee = messageService.getClient("ews_alice")

      await boss.send("ews_alice", "Task 1")
      await boss.send("ews_alice", "Task 2")

      // Employee 接收消息
      const msg1 = await employee.recv()
      const msg2 = await employee.recv()

      expect(msg1.from).toBe("boss_bayecao")
      expect(msg1.content).toBe("Task 1")
      expect(msg2.from).toBe("boss_bayecao")
      expect(msg2.content).toBe("Task 2")

      // 检查历史记录
      const bossHistory = await boss.history("ews_alice")
      const employeeHistory = await employee.history("boss_bayecao")

      expect(bossHistory).toHaveLength(2)
      expect(employeeHistory).toHaveLength(2)
      expect(bossHistory[0].content).toBe("Task 1")
      expect(employeeHistory[0].content).toBe("Task 1")
    })

    test("should synchronize employee-to-boss messages", async () => {
      const boss = messageService.getClient("boss_bayecao")
      const employee = messageService.getClient("ews_alice")

      await employee.send("boss_bayecao", "Report 1")
      await employee.send("boss_bayecao", "Report 2")

      // Boss 接收消息
      const msg1 = await boss.recv()
      const msg2 = await boss.recv()

      expect(msg1.from).toBe("ews_alice")
      expect(msg1.content).toBe("Report 1")
      expect(msg2.from).toBe("ews_alice")
      expect(msg2.content).toBe("Report 2")

      // 检查历史记录
      const bossHistory = await boss.history("ews_alice")
      const employeeHistory = await employee.history("boss_bayecao")

      expect(bossHistory).toHaveLength(2)
      expect(employeeHistory).toHaveLength(2)
    })

    test("should handle bidirectional communication", async () => {
      const boss = messageService.getClient("boss_bayecao")
      const employee = messageService.getClient("ews_alice")

      // 双向通信
      await boss.send("ews_alice", "Do task A")
      await employee.send("boss_bayecao", "Task A done")
      await boss.send("ews_alice", "Do task B")
      await employee.send("boss_bayecao", "Task B done")

      // 检查历史记录
      const bossHistory = await boss.history("ews_alice")
      const employeeHistory = await employee.history("boss_bayecao")

      expect(bossHistory).toHaveLength(4)
      expect(employeeHistory).toHaveLength(4)

      // 验证消息顺序
      expect(bossHistory[0].from).toBe("boss_bayecao")
      expect(bossHistory[1].from).toBe("ews_alice")
      expect(bossHistory[2].from).toBe("boss_bayecao")
      expect(bossHistory[3].from).toBe("ews_alice")
    })
  })

  describe("Multiple bosses", () => {
    test("should handle messages from different bosses", async () => {
      const boss1 = messageService.getClient("boss_bayecao")
      const boss2 = messageService.getClient("boss_admin")
      const employee = messageService.getClient("ews_alice")

      await boss1.send("ews_alice", "From bayecao")
      await boss2.send("ews_alice", "From admin")

      const msg1 = await employee.recv()
      const msg2 = await employee.recv()

      const messages = [msg1, msg2].sort((a, b) => a.from.localeCompare(b.from))
      expect(messages[0].from).toBe("boss_admin")
      expect(messages[1].from).toBe("boss_bayecao")
    })

    test("should isolate messages between different bosses", async () => {
      const boss1 = messageService.getClient("boss_bayecao")
      const boss2 = messageService.getClient("boss_admin")

      await boss1.send("ews_alice", "From bayecao")
      await boss2.send("ews_alice", "From admin")

      // 检查各自的历史记录
      const boss1History = await boss1.history("ews_alice")
      const boss2History = await boss2.history("ews_alice")

      expect(boss1History).toHaveLength(1)
      expect(boss2History).toHaveLength(1)
      expect(boss1History[0].content).toBe("From bayecao")
      expect(boss2History[0].content).toBe("From admin")
    })
  })

  describe("Employee-to-employee messages", () => {
    test("should not affect employee-to-employee communication", async () => {
      const alice = messageService.getClient("ews_alice")
      const bob = messageService.getClient("ews_bob")

      await alice.send("ews_bob", "Hello Bob")

      const message = await bob.recv()
      expect(message.from).toBe("ews_alice")
      expect(message.content).toBe("Hello Bob")

      // 检查文件路径（应该在 employees 目录下）
      const alicePath = messageService.getMessageFilePath(
        "ews_alice",
        "ews_bob"
      )
      expect(alicePath).toContain("ews/ews_alice/messages/ews_bob")

      const bobPath = messageService.getMessageFilePath("ews_bob", "ews_alice")
      expect(bobPath).toContain("ews/ews_bob/messages/ews_alice")
    })
  })

  describe("Edge cases", () => {
    test("should handle boss name same as employee name", async () => {
      // 这种情况不应该发生，但测试系统的健壮性
      const client = messageService.getClient("boss_bayecao")

      // bayecao 作为 boss 发送消息给 alice
      await client.send("ews_alice", "As boss")

      // 检查路径
      const path = messageService.getMessageFilePath(
        "boss_bayecao",
        "ews_alice"
      )
      expect(path).toContain("bosses/bayecao/messages/ews_alice")
    })

    test("should handle empty message content", async () => {
      const boss = messageService.getClient("boss_bayecao")
      const employee = messageService.getClient("ews_alice")

      await boss.send("ews_alice", "")

      const message = await employee.recv()
      expect(message.content).toBe("")
    })

    test("should handle special characters in message", async () => {
      const boss = messageService.getClient("boss_bayecao")
      const employee = messageService.getClient("ews_alice")

      const specialContent = "Hello\nWorld\t测试\r\n特殊字符: @#$%^&*()"
      await boss.send("ews_alice", specialContent)

      const message = await employee.recv()
      expect(message.content).toBe(specialContent)
    })
  })
})
