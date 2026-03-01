import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { MessageService } from "../../src/core/MessageService"
import { getMessages } from "../../src/api/messages"

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
      "calculator",
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
    const employeeDir = path.join(testWorkspace, "employees", "calculator")
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

    const response = await getMessages(
      "calculator",
      "alice",
      10,
      messageService
    )

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.messages).toHaveLength(2)
      expect(response.data.messages[0].from).toBe("alice")
      expect(response.data.messages[0].content).toBe("计算 1+1")
      expect(response.data.messages[1].from).toBe("calculator")
      expect(response.data.messages[1].content).toBe("结果是 2")
    }
  })

  it("should return error when message service is not provided", async () => {
    const response = await getMessages("calculator", undefined, undefined)

    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("INTERNAL_ERROR")
    }
  })
})
