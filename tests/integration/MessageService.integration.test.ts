import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { MessageService } from "../../src/core/MessageService"
import { StateManager } from "../../src/state/StateManager"
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
    await stateManager.registerEmployee({
      name: "calculator",
      role: "calculator",
      status: "inactive",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
    await stateManager.registerEmployee({
      name: "bayecao",
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
    await stateManager.registerEmployee({
      name: "alice",
      role: "test",
      status: "inactive",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
    await stateManager.registerEmployee({
      name: "charlie",
      role: "test",
      status: "inactive",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
    
    service = new MessageService(TEST_WORKSPACE, stateManager)
  })

  afterEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  test("should create correct directory structure", async () => {
    const calculator = service.getClient("calculator")
    const bayecao = service.getClient("bayecao")

    // 发送消息
    await bayecao.send("calculator", "计算 1+1")
    await calculator.send("bayecao", "结果是 2")

    // 验证目录结构
    const calculatorDir = path.join(
      TEST_WORKSPACE,
      "employees/calculator/messages/bayecao"
    )
    const bayecaoDir = path.join(
      TEST_WORKSPACE,
      "employees/bayecao/messages/calculator"
    )

    const calculatorDirExists = await fs
      .access(calculatorDir)
      .then(() => true)
      .catch(() => false)
    const bayecaoDirExists = await fs
      .access(bayecaoDir)
      .then(() => true)
      .catch(() => false)

    expect(calculatorDirExists).toBe(true)
    expect(bayecaoDirExists).toBe(true)
  })

  test("should maintain synchronized message files", async () => {
    const calculator = service.getClient("calculator")
    const bayecao = service.getClient("bayecao")

    // 双向对话
    await bayecao.send("calculator", "计算 1+1")
    await calculator.recv()
    await calculator.send("bayecao", "结果是 2")
    await bayecao.recv()

    // 读取双方的消息文件
    const calculatorFilePath = service.getMessageFilePath(
      "calculator",
      "bayecao"
    )
    const bayecaoFilePath = service.getMessageFilePath("bayecao", "calculator")

    const calculatorContent = await fs.readFile(calculatorFilePath, "utf-8")
    const bayecaoContent = await fs.readFile(bayecaoFilePath, "utf-8")

    const calculatorMessages = yaml.parse(calculatorContent)
    const bayecaoMessages = yaml.parse(bayecaoContent)

    // 验证消息数量
    expect(calculatorMessages.length).toBe(2)
    expect(bayecaoMessages.length).toBe(2)

    // 验证 calculator 的视角
    expect(calculatorMessages[0].direction).toBe("receive")
    expect(calculatorMessages[0].content).toBe("计算 1+1")
    expect(calculatorMessages[1].direction).toBe("send")
    expect(calculatorMessages[1].content).toBe("结果是 2")

    // 验证 bayecao 的视角
    expect(bayecaoMessages[0].direction).toBe("send")
    expect(bayecaoMessages[0].content).toBe("计算 1+1")
    expect(bayecaoMessages[1].direction).toBe("receive")
    expect(bayecaoMessages[1].content).toBe("结果是 2")
  })

  test("should handle long conversation", async () => {
    const alice = service.getClient("alice")
    const bob = service.getClient("bob")

    // 发送 20 条消息
    for (let i = 1; i <= 20; i++) {
      if (i % 2 === 1) {
        await alice.send("bob", `Message ${i}`)
        await bob.recv()
      } else {
        await bob.send("alice", `Message ${i}`)
        await alice.recv()
      }
    }

    // 验证历史记录
    const aliceHistory = await alice.history("bob")
    expect(aliceHistory.length).toBe(20)

    // 验证最近 5 条
    const recentHistory = await alice.history("bob", 5)
    expect(recentHistory.length).toBe(5)
    expect(recentHistory[0].content).toBe("Message 16")
    expect(recentHistory[4].content).toBe("Message 20")
  })

  test("should handle multiple concurrent conversations", async () => {
    const alice = service.getClient("alice")
    const bob = service.getClient("bob")
    const charlie = service.getClient("charlie")

    // Alice 同时和 Bob、Charlie 对话
    await alice.send("bob", "Hi Bob")
    await alice.send("charlie", "Hi Charlie")

    // Bob 和 Charlie 分别回复
    await bob.recv()
    await bob.send("alice", "Hi Alice from Bob")

    await charlie.recv()
    await charlie.send("alice", "Hi Alice from Charlie")

    // 验证 Alice 的两个对话历史
    const aliceBobHistory = await alice.history("bob")
    const aliceCharlieHistory = await alice.history("charlie")

    expect(aliceBobHistory.length).toBe(2)
    expect(aliceCharlieHistory.length).toBe(2)

    expect(aliceBobHistory[1].content).toBe("Hi Alice from Bob")
    expect(aliceCharlieHistory[1].content).toBe("Hi Alice from Charlie")
  })
})
