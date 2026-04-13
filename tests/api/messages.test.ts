import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { MessageService } from "../../src/core/MessageService"
import { getMessages } from "../../src/api/messages"

interface YamlMessage {
  timestamp: string
  direction: "send" | "receive"
  content: string
}

const testWorkspace = "./workspace_test_messages_api"

beforeEach(async () => {
  await fs.rm(testWorkspace, { recursive: true, force: true })
  await fs.mkdir(testWorkspace, { recursive: true })
})

afterEach(async () => {
  await fs.rm(testWorkspace, { recursive: true, force: true })
})

describe("Messages API", () => {
  it("should return error when employee name is empty", async () => {
    const messageService = new MessageService(testWorkspace)

    const response = await getMessages("", undefined, undefined, messageService)

    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("INVALID_PARAMETER")
    }
  })

  it("should return error when limit is out of range", async () => {
    const messageService = new MessageService(testWorkspace)

    const response = await getMessages(
      "testRole?",
      undefined,
      300,
      messageService
    )

    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("INVALID_PARAMETER")
    }
  })

  it("should return messages with peer filter", async () => {
    const messageService = new MessageService(testWorkspace)

    // 创建消息文件
    const employeeDir = path.join(testWorkspace, "employees", "testRole?")
    await fs.mkdir(employeeDir, { recursive: true })

    const messagesDir = path.join(employeeDir, "messages", "alice")
    await fs.mkdir(messagesDir, { recursive: true })
    const chatFile = path.join(messagesDir, "chat.yaml")
    const messages: YamlMessage[] = [
      {
        timestamp: "2026-03-01T10:00:00.000Z",
        direction: "receive",
        content: "计算 1+1",
      },
      {
        timestamp: "2026-03-01T10:00:05.000Z",
        direction: "send",
        content: "结果是 2",
      },
    ]

    await fs.writeFile(chatFile, yaml.stringify(messages), "utf-8")

    const response = await getMessages("testRole?", "alice", 10, messageService)

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.messages).toHaveLength(2)
      expect(response.data.messages[0].from).toBe("alice")
      expect(response.data.messages[0].content).toBe("计算 1+1")
      expect(response.data.messages[1].from).toBe("testRole?")
      expect(response.data.messages[1].content).toBe("结果是 2")
    }
  })

  it("should return error when message service is not provided", async () => {
    const response = await getMessages("testRole?", undefined, undefined)

    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("INTERNAL_ERROR")
    }
  })

  it("should return all messages from all peers when peer is not specified", async () => {
    const messageService = new MessageService(testWorkspace)

    // 创建与 alice 的对话
    const aliceDir = path.join(
      testWorkspace,
      "employees",
      "testRole?",
      "messages",
      "alice"
    )
    await fs.mkdir(aliceDir, { recursive: true })
    const aliceMessages: YamlMessage[] = [
      {
        timestamp: "2026-03-01T10:00:00.000Z",
        direction: "receive",
        content: "计算 1+1",
      },
      {
        timestamp: "2026-03-01T10:00:05.000Z",
        direction: "send",
        content: "结果是 2",
      },
    ]
    await fs.writeFile(
      path.join(aliceDir, "chat.yaml"),
      yaml.stringify(aliceMessages),
      "utf-8"
    )

    // 创建与 bob 的对话
    const bobDir = path.join(
      testWorkspace,
      "employees",
      "testRole?",
      "messages",
      "bob"
    )
    await fs.mkdir(bobDir, { recursive: true })
    const bobMessages: YamlMessage[] = [
      {
        timestamp: "2026-03-01T10:01:00.000Z",
        direction: "receive",
        content: "计算 2+2",
      },
      {
        timestamp: "2026-03-01T10:01:05.000Z",
        direction: "send",
        content: "结果是 4",
      },
    ]
    await fs.writeFile(
      path.join(bobDir, "chat.yaml"),
      yaml.stringify(bobMessages),
      "utf-8"
    )

    const response = await getMessages(
      "testRole?",
      undefined,
      undefined,
      messageService
    )

    expect(response.success).toBe(true)
    if (response.success) {
      // 应该返回所有 4 条消息
      expect(response.data.messages).toHaveLength(4)
      // 消息应该按时间戳排序
      expect(response.data.messages[0].content).toBe("计算 1+1")
      expect(response.data.messages[1].content).toBe("结果是 2")
      expect(response.data.messages[2].content).toBe("计算 2+2")
      expect(response.data.messages[3].content).toBe("结果是 4")
    }
  })

  it("should respect limit when getting all messages", async () => {
    const messageService = new MessageService(testWorkspace)

    // 创建与 alice 的对话（3 条消息）
    const aliceDir = path.join(
      testWorkspace,
      "employees",
      "testRole?",
      "messages",
      "alice"
    )
    await fs.mkdir(aliceDir, { recursive: true })
    const aliceMessages: YamlMessage[] = [
      {
        timestamp: "2026-03-01T10:00:00.000Z",
        direction: "receive",
        content: "消息 1",
      },
      {
        timestamp: "2026-03-01T10:00:05.000Z",
        direction: "send",
        content: "消息 2",
      },
      {
        timestamp: "2026-03-01T10:00:10.000Z",
        direction: "receive",
        content: "消息 3",
      },
    ]
    await fs.writeFile(
      path.join(aliceDir, "chat.yaml"),
      yaml.stringify(aliceMessages),
      "utf-8"
    )

    const response = await getMessages(
      "testRole?",
      undefined,
      2,
      messageService
    )

    expect(response.success).toBe(true)
    if (response.success) {
      // 应该只返回最近的 2 条消息
      expect(response.data.messages).toHaveLength(2)
      expect(response.data.messages[0].content).toBe("消息 2")
      expect(response.data.messages[1].content).toBe("消息 3")
    }
  })
})

describe("getPeers API", () => {
  it("should return error when employee name is empty", async () => {
    const messageService = new MessageService(testWorkspace)
    const { getPeers } = await import("../../src/api/messages")
    const response = await getPeers("", messageService)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("INVALID_PARAMETER")
    }
  })

  it("should return empty array when employee has no peers", async () => {
    const messageService = new MessageService(testWorkspace)
    const { getPeers } = await import("../../src/api/messages")
    const response = await getPeers("testRole?", messageService)
    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.peers).toEqual([])
    }
  })

  it("should return list of peers", async () => {
    const messageService = new MessageService(testWorkspace)
    const { getPeers } = await import("../../src/api/messages")
    // 创建与 alice 和 bob 的对话目录
    const employeeDir = path.join(
      testWorkspace,
      "employees",
      "testRole?",
      "messages"
    )
    await fs.mkdir(path.join(employeeDir, "alice"), { recursive: true })
    await fs.mkdir(path.join(employeeDir, "bob"), { recursive: true })
    const response = await getPeers("testRole?", messageService)
    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.peers).toHaveLength(2)
      expect(response.data.peers.map((p) => p.name)).toContain("alice")
      expect(response.data.peers.map((p) => p.name)).toContain("bob")
    }
  })

  it("should return error when message service is not provided", async () => {
    const { getPeers } = await import("../../src/api/messages")
    const response = await getPeers("testRole?", undefined)
    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("INTERNAL_ERROR")
    }
  })
})
