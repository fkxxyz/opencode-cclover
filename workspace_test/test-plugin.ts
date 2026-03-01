#!/usr/bin/env bun
/**
 * 测试脚本 - 连接到 OpenCode server 并测试 cclover 插件
 * 
 * 使用方法:
 * 1. 在另一个终端启动 OpenCode server:
 *    cd workspace_test && opencode serve --port 4099
 * 2. 运行此脚本:
 *    bun run workspace_test/test-plugin.ts
 */

import { createOpencodeClient } from "@opencode-ai/sdk"

async function main() {
  console.log("Connecting to OpenCode server at http://localhost:4099...")
  
  const client = createOpencodeClient({
    baseUrl: "http://localhost:4099",
  })

  // 测试连接
  try {
    const health = await client.global.health()
    console.log("✅ Connected to OpenCode server")
    console.log(`   Version: ${health.data.version}`)
    console.log(`   Healthy: ${health.data.healthy}`)
  } catch (error) {
    console.error("❌ Failed to connect to OpenCode server")
    console.error("   Make sure the server is running: opencode serve --port 4099")
    process.exit(1)
  }

  console.log("\n=== 测试场景 1: 简单计算 ===\n")

  // 创建 session
  const session = await client.session.create({
    body: {
      title: "Test Calculator - Simple Calculation",
    },
  })
  console.log(`Created session: ${session.data.id}`)

  // 发送消息给 calculator
  console.log("\n发送消息: 计算 1+1")
  
  await client.session.prompt({
    path: { id: session.data.id },
    body: {
      parts: [
        {
          type: "text",
          text: "使用 send_message 工具发送消息给 calculator: '计算 1+1'",
        },
      ],
    },
  })

  console.log("✅ 消息已发送")

  // 等待一段时间让 calculator 处理
  console.log("\n等待 calculator 处理...")
  await new Promise((resolve) => setTimeout(resolve, 5000))

  console.log("\n✅ 测试完成！")
  console.log("\n请检查:")
  console.log("1. OpenCode server 的日志输出")
  console.log("2. .cclover/workspace/employees/ 目录下的文件")
  console.log("3. calculator 是否正确回复了消息")
  console.log("\n查看结果:")
  console.log("  cat .cclover/workspace/employees/calculator/messages/bayecao/chat.yaml")
  console.log("  cat .cclover/workspace/employees/bayecao/messages/calculator/chat.yaml")
  console.log("  cat .cclover/workspace/employees/calculator/memory.yaml")
}

main().catch((error) => {
  console.error("Error:", error)
  process.exit(1)
})
