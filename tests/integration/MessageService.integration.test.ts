import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { StateManager } from "../../src/state/StateManager"
import { createTestEmployee } from "../helpers/employeeFactory"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../fixtures/integration-workspace"
)

describe("MessageService Integration", () => {
  let service: MessageService
  let stateManager: StateManager

  beforeEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 创建 StateManager 并注册测试员工
    stateManager = new StateManager("test-project", TEST_WORKSPACE)
    await stateManager.registerEmployee(
      createTestEmployee({ employeeId: "emp_test_role", name: "test-role" })
    )
    await stateManager.registerEmployee(
      createTestEmployee({ employeeId: "emp_bayecao", name: "bayecao" })
    )
    await stateManager.registerEmployee(
      createTestEmployee({ employeeId: "emp_bob", name: "bob" })
    )
    await stateManager.registerEmployee(
      createTestEmployee({ employeeId: "emp_alice", name: "alice" })
    )
    await stateManager.registerEmployee(
      createTestEmployee({ employeeId: "emp_charlie", name: "charlie" })
    )

    service = new MessageService(TEST_WORKSPACE, stateManager)
  })

  afterEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  test("should create correct directory structure", async () => {
    const testRole = service.getClient("ews_test_role")
    const bayecao = service.getClient("ews_bayecao")

    // 发送消息
    await bayecao.send("ews_test_role", "计算 1+1")
    await testRole?.send("ews_bayecao", "结果是 2")

    // 验证目录结构
    const testRoleDir = path.join(
      TEST_WORKSPACE,
      "ews/ews_test_role/messages/ews_bayecao"
    )
    const bayecaoDir = path.join(
      TEST_WORKSPACE,
      "ews/ews_bayecao/messages/ews_test_role"
    )

    const testRoleDirExists = await fs
      .access(testRoleDir)
      .then(() => true)
      .catch(() => false)
    const bayecaoDirExists = await fs
      .access(bayecaoDir)
      .then(() => true)
      .catch(() => false)

    expect(testRoleDirExists).toBe(true)
    expect(bayecaoDirExists).toBe(true)
  })

  test("should maintain synchronized message files", async () => {
    const testRole = service.getClient("ews_test_role")
    const bayecao = service.getClient("ews_bayecao")

    // 双向对话
    await bayecao.send("ews_test_role", "计算 1+1")
    await testRole?.recv()
    await testRole?.send("ews_bayecao", "结果是 2")
    await bayecao.recv()

    // 读取双方的消息文件
    const testRoleFilePath = service.getMessageFilePath(
      "ews_test_role",
      "ews_bayecao"
    )
    const bayecaoFilePath = service.getMessageFilePath(
      "ews_bayecao",
      "ews_test_role"
    )

    const testRoleContent = await fs.readFile(testRoleFilePath, "utf-8")
    const bayecaoContent = await fs.readFile(bayecaoFilePath, "utf-8")

    const testRoleMessages = yaml.parse(testRoleContent)
    const bayecaoMessages = yaml.parse(bayecaoContent)

    // 验证消息数量
    expect(testRoleMessages.length).toBe(2)
    expect(bayecaoMessages.length).toBe(2)

    // 验证 test-role 的视角
    expect(testRoleMessages[0].direction).toBe("receive")
    expect(testRoleMessages[0].content).toBe("计算 1+1")
    expect(testRoleMessages[1].direction).toBe("send")
    expect(testRoleMessages[1].content).toBe("结果是 2")

    // 验证 bayecao 的视角
    expect(bayecaoMessages[0].direction).toBe("send")
    expect(bayecaoMessages[0].content).toBe("计算 1+1")
    expect(bayecaoMessages[1].direction).toBe("receive")
    expect(bayecaoMessages[1].content).toBe("结果是 2")
  })

  test("should handle long conversation", async () => {
    const alice = service.getClient("ews_alice")
    const bob = service.getClient("ews_bob")

    // 发送 20 条消息
    for (let i = 1; i <= 20; i++) {
      if (i % 2 === 1) {
        await alice.send("ews_bob", `Message ${i}`)
        await bob.recv()
      } else {
        await bob.send("ews_alice", `Message ${i}`)
        await alice.recv()
      }
    }

    // 验证历史记录
    const aliceHistory = await alice.history("ews_bob")
    expect(aliceHistory.length).toBe(20)

    // 验证最近 5 条
    const recentHistory = await alice.history("ews_bob", 5)
    expect(recentHistory.length).toBe(5)
    expect(recentHistory[0].content).toBe("Message 16")
    expect(recentHistory[4].content).toBe("Message 20")
  })

  test("should handle multiple concurrent conversations", async () => {
    const alice = service.getClient("ews_alice")
    const bob = service.getClient("ews_bob")
    const charlie = service.getClient("ews_charlie")

    // Alice 同时和 Bob、Charlie 对话
    await alice.send("ews_bob", "Hi Bob")
    await alice.send("ews_charlie", "Hi Charlie")

    // Bob 和 Charlie 分别回复
    await bob.recv()
    await bob.send("ews_alice", "Hi Alice from Bob")

    await charlie.recv()
    await charlie.send("ews_alice", "Hi Alice from Charlie")

    // 验证 Alice 的两个对话历史
    const aliceBobHistory = await alice.history("ews_bob")
    const aliceCharlieHistory = await alice.history("ews_charlie")

    expect(aliceBobHistory.length).toBe(2)
    expect(aliceCharlieHistory.length).toBe(2)

    expect(aliceBobHistory[1].content).toBe("Hi Alice from Bob")
    expect(aliceCharlieHistory[1].content).toBe("Hi Alice from Charlie")
  })

  test("should handle reference_docs in concurrent sends", async () => {
    const alice = service.getClient("ews_alice")
    const bob = service.getClient("ews_bob")

    const sends = [
      alice.send("ews_bob", "消息1", ["/file1.ts"]),
      alice.send("ews_bob", "消息2", ["/file2.ts"]),
      alice.send("ews_bob", "消息3"), // 无 reference_docs
    ]

    await Promise.all(sends)

    const history = await bob.history("ews_alice")

    expect(history).toHaveLength(3)

    // 验证包含所有预期的 reference_docs（不依赖顺序）
    const docsInHistory = history.map((h) => h.reference_docs)
    expect(docsInHistory).toContainEqual(["/file1.ts"])
    expect(docsInHistory).toContainEqual(["/file2.ts"])
    expect(docsInHistory).toContain(undefined)
  })
})
