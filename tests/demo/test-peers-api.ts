#!/usr/bin/env bun

/**
 * 测试新的 getPeers API
 *
 * 使用方法：
 * 1. 启动 OpenCode 测试服务器：./start-test-server.sh
 * 2. 运行测试脚本：bun run tests/demo/test-peers-api.ts
 *
 * 测试内容：
 * - 获取员工的对话对象列表 (GET /api/projects/:projectId/employees/:name/peers)
 * - 验证返回的 peers 数据格式
 * - 测试与特定 peer 的消息获取
 */

const API_BASE = "http://localhost:4097/api"

async function testGetPeers() {
  console.log("🧪 测试 getPeers API\n")

  // 1. 获取项目列表
  console.log("1️⃣ 获取项目列表...")
  const projectsRes = await fetch(`${API_BASE}/projects`)
  const projectsData = await projectsRes.json()

  if (!projectsData.success || projectsData.data.projects.length === 0) {
    console.error("❌ 没有找到项目")
    return
  }

  const projectId = projectsData.data.projects[0].projectId
  console.log(`✅ 找到项目: ${projectId}\n`)

  // 2. 获取员工列表
  console.log("2️⃣ 获取员工列表...")
  const employeesRes = await fetch(
    `${API_BASE}/projects/${projectId}/employees`
  )
  const employeesData = await employeesRes.json()

  if (!employeesData.success || employeesData.data.employees.length === 0) {
    console.error("❌ 没有找到员工")
    return
  }

  const employeeName = employeesData.data.employees[0].name
  console.log(`✅ 找到员工: ${employeeName}\n`)

  // 3. 测试新的 getPeers API
  console.log("3️⃣ 测试 getPeers API...")
  const peersRes = await fetch(
    `${API_BASE}/projects/${projectId}/employees/${employeeName}/peers`
  )
  const peersData = await peersRes.json()

  if (!peersData.success) {
    console.error("❌ getPeers API 失败:", peersData.error)
    return
  }

  console.log(`✅ 成功获取对话对象列表:`)
  console.log(`   员工: ${employeeName}`)
  console.log(`   对话对象: ${peersData.data.peers.join(", ")}`)
  console.log(`   总数: ${peersData.data.peers.length}\n`)

  // 4. 测试获取特定对话的消息
  if (peersData.data.peers.length > 0) {
    const peer = peersData.data.peers[0]
    console.log(`4️⃣ 测试获取与 ${peer} 的对话...`)

    const messagesRes = await fetch(
      `${API_BASE}/projects/${projectId}/employees/${employeeName}/messages?peer=${peer}&limit=5`
    )
    const messagesData = await messagesRes.json()

    if (!messagesData.success) {
      console.error("❌ 获取消息失败:", messagesData.error)
      return
    }

    console.log(`✅ 成功获取消息:`)
    console.log(`   消息数量: ${messagesData.data.messages.length}`)
    if (messagesData.data.messages.length > 0) {
      console.log(
        `   最新消息: "${messagesData.data.messages[messagesData.data.messages.length - 1].content.substring(0, 50)}..."`
      )
    }
  }

  console.log("\n✨ 所有测试通过！")
}

testGetPeers().catch(console.error)
