import { MessageService } from "../../src/core/MessageService"
import * as path from "node:path"
import * as fs from "node:fs/promises"

const DEMO_WORKSPACE = path.join(import.meta.dir, "../workspace_test")

async function demo() {
  console.log("=== MessageService Demo ===\n")

  // 清理并创建工作空间
  await fs.rm(DEMO_WORKSPACE, { recursive: true, force: true })
  await fs.mkdir(DEMO_WORKSPACE, { recursive: true })

  // 创建服务
  const service = new MessageService(DEMO_WORKSPACE)

  // 创建客户端
  const testRole = service.getClient("test-role")
  const bayecao = service.getClient("bayecao")

  console.log("1. Bayecao 发送消息给 TestRole")
  await bayecao.send("test-role", "计算 1+1")

  console.log("2. TestRole 接收消息")
  const msg1 = await testRole?.recv()
  console.log(`   收到: "${msg1.content}" (from: ${msg1.from})`)

  console.log("3. TestRole 回复")
  await testRole?.send("bayecao", "结果是 2")

  console.log("4. Bayecao 接收回复")
  const msg2 = await bayecao.recv()
  console.log(`   收到: "${msg2.content}" (from: ${msg2.from})`)

  console.log("\n5. 查看历史记录")
  const history = await testRole?.history("bayecao")
  console.log(`   共 ${history.length} 条消息:`)
  history.forEach((msg, i) => {
    console.log(`   [${i + 1}] ${msg.from}: ${msg.content}`)
  })

  console.log("\n6. 文件结构:")
  const testRoleFile = service.getMessageFilePath("test-role", "bayecao")
  const bayecaoFile = service.getMessageFilePath("bayecao", "test-role")

  console.log(
    `   TestRole 的消息文件: ${path.relative(DEMO_WORKSPACE, testRoleFile)}`
  )
  console.log(
    `   Bayecao 的消息文件: ${path.relative(DEMO_WORKSPACE, bayecaoFile)}`
  )

  console.log("\n7. TestRole 的消息文件内容:")
  const testRoleContent = await fs.readFile(testRoleFile, "utf-8")
  console.log(testRoleContent)

  console.log("8. Bayecao 的消息文件内容:")
  const bayecaoContent = await fs.readFile(bayecaoFile, "utf-8")
  console.log(bayecaoContent)

  console.log("=== Demo Complete ===")
}

demo().catch(console.error)
