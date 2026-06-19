/**
 * 工具集成测试
 *
 * 测试工具与 MessageService、MemoryManager 的集成
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { MessageService } from "../../src/core/MessageService"
import { MemoryManager } from "../../src/core/MemoryManager"
import { StateManager } from "../../src/state/StateManager"
import { createSendMessageTool } from "../../src/tools/SendMessageTool"
import { createEditTasksTool } from "../../src/tools/EditTasksTool"
import { createCreateAgentTool } from "../../src/tools/CreateAgentTool"
import { sessionRegistry } from "../../src/utils/SessionRegistry"
import { agentRegistry } from "../../src/utils/AgentRegistry"
import type { OpencodeClient } from "@opencode-ai/sdk"

const TEST_WORKSPACE = path.join(import.meta.dir, "../.test-workspace-tools")

describe("Tools Integration", () => {
  let messageService: MessageService
  let memoryManager: MemoryManager
  let stateManager: StateManager
  let mockOpcodeClient: OpencodeClient

  beforeEach(async () => {
    // 清理测试目录
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 初始化服务
    stateManager = new StateManager("test-project", TEST_WORKSPACE)

    // 注册测试员工
    await stateManager.registerEmployee({
      employeeId: "emp_alice",
      name: "alice",
      roleId: "test",
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })
    await stateManager.registerEmployee({
      employeeId: "emp_bob",
      name: "bob",
      roleId: "test",
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })
    await stateManager.registerEmployee({
      employeeId: "emp_test_role",
      name: "test-role",
      roleId: "TestRole",
      status: "offline",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      hiredBy: null,
      paused: false,
      activeSessionId: null,
    })

    messageService = new MessageService(TEST_WORKSPACE, stateManager)
    memoryManager = new MemoryManager(TEST_WORKSPACE)

    // Mock OpencodeClient
    mockOpcodeClient = {
      session: {
        create: async () => ({
          data: { id: "mock-session-id" },
        }),
        prompt: async () => ({
          data: { info: { role: "assistant" } },
        }),
      },
    } as any

    // 清空注册表
    sessionRegistry.clear()
    agentRegistry.clear()
  })

  afterEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  describe("send_message tool", () => {
    test("should send message successfully", async () => {
      const tool = createSendMessageTool(
        messageService,
        undefined,
        stateManager
      )
      const sessionId = "test-session-1"
      const employeeName = "emp_alice"

      // 注册 session
      sessionRegistry.register(sessionId, employeeName)

      // 创建接收方客户端
      const bobClient = messageService.getClient("emp_bob")

      // 执行工具
      const result = await tool.execute(
        { to: "emp_bob", content: "Hello Bob", expect_reply: false },
        {
          sessionID: sessionId,
          messageID: "msg-1",
          agent: "test",
          directory: TEST_WORKSPACE,
          worktree: TEST_WORKSPACE,
          abort: new AbortController().signal,
          metadata: () => {},
          ask: async () => {},
        }
      )

      expect(result).toBe("Message sent to emp_bob")

      // 验证消息已发送
      const message = await bobClient.recv()
      expect(message.from).toBe("emp_alice")
      expect(message.content).toBe("Hello Bob")
    })

    test("should throw error if session not registered", async () => {
      const tool = createSendMessageTool(
        messageService,
        undefined,
        stateManager
      )

      await expect(
        tool.execute(
          { to: "emp_bob", content: "Hello", expect_reply: false },
          {
            sessionID: "unknown-session",
            messageID: "msg-1",
            agent: "test",
            directory: TEST_WORKSPACE,
            worktree: TEST_WORKSPACE,
            abort: new AbortController().signal,
            metadata: () => {},
            ask: async () => {},
          }
        )
      ).rejects.toThrow("Unable to identify caller")
    })

    test("should reject non-existent recipient employee", async () => {
      const tool = createSendMessageTool(
        messageService,
        undefined,
        stateManager
      )
      const sessionId = "test-session-invalid-recipient"
      const employeeName = "emp_alice"

      sessionRegistry.register(sessionId, employeeName)

      await expect(
        tool.execute(
          { to: "emp_nonexistent", content: "Hello", expect_reply: false },
          {
            sessionID: sessionId,
            messageID: "msg-invalid-recipient",
            agent: "test",
            directory: TEST_WORKSPACE,
            worktree: TEST_WORKSPACE,
            abort: new AbortController().signal,
            metadata: () => {},
            ask: async () => {},
          }
        )
      ).rejects.toThrow("Recipient does not exist")
    })
  })

  describe("edit_tasks tool", () => {
    test("should add task successfully", async () => {
      const tool = createEditTasksTool(memoryManager)
      const sessionId = "test-session-2"
      const employeeName = "emp_test_role"

      sessionRegistry.register(sessionId, employeeName)

      const result = await tool.execute(
        {
          operations: [
            {
              action: "add",
              name: "计算1+1",
              description: "为用户计算 1+1",
              dependencies: [],
            },
          ],
        },
        {
          sessionID: sessionId,
          messageID: "msg-1",
          agent: "test",
          directory: TEST_WORKSPACE,
          worktree: TEST_WORKSPACE,
          abort: new AbortController().signal,
          metadata: () => {},
          ask: async () => {},
        }
      )

      expect(result).toContain("✓ Added task: 计算1+1 [pending]")

      // 验证任务已添加
      const task = await memoryManager.getTask(employeeName, "计算1+1")
      expect(task).not.toBeNull()
      expect(task?.name).toBe("计算1+1")
      expect(task?.status).toBe("pending")
    })

    test("should update task successfully", async () => {
      const tool = createEditTasksTool(memoryManager)
      const sessionId = "test-session-3"
      const employeeName = "emp_test_role"

      sessionRegistry.register(sessionId, employeeName)

      // 先添加任务
      await memoryManager.addTask(employeeName, {
        name: "计算1+1",
        status: "pending",
        description: "计算任务",
        dependencies: [],
      })

      // 更新任务
      const result = await tool.execute(
        {
          operations: [
            {
              action: "update",
              name: "计算1+1",
              status: "completed",
              result: "2",
            },
          ],
        },
        {
          sessionID: sessionId,
          messageID: "msg-1",
          agent: "test",
          directory: TEST_WORKSPACE,
          worktree: TEST_WORKSPACE,
          abort: new AbortController().signal,
          metadata: () => {},
          ask: async () => {},
        }
      )

      expect(result).toContain("✓ Updated task: 计算1+1 [completed]")

      // 验证任务已更新
      const task = await memoryManager.getTask(employeeName, "计算1+1")
      expect(task?.status).toBe("completed")
      expect(task?.result).toBe("2")
      expect(task?.completed).toBeDefined()
    })

    test("should delete task successfully", async () => {
      const tool = createEditTasksTool(memoryManager)
      const sessionId = "test-session-4"
      const employeeName = "emp_test_role"

      sessionRegistry.register(sessionId, employeeName)

      // 先添加任务
      await memoryManager.addTask(employeeName, {
        name: "计算1+1",
        status: "pending",
        description: "计算任务",
        dependencies: [],
      })

      // 删除任务
      const result = await tool.execute(
        {
          operations: [
            {
              action: "delete",
              name: "计算1+1",
            },
          ],
        },
        {
          sessionID: sessionId,
          messageID: "msg-1",
          agent: "test",
          directory: TEST_WORKSPACE,
          worktree: TEST_WORKSPACE,
          abort: new AbortController().signal,
          metadata: () => {},
          ask: async () => {},
        }
      )

      expect(result).toContain("✓ Deleted task: 计算1+1")

      // 验证任务已删除
      const task = await memoryManager.getTask(employeeName, "计算1+1")
      expect(task).toBeNull()
    })

    test("should handle multiple operations", async () => {
      const tool = createEditTasksTool(memoryManager)
      const sessionId = "test-session-5"
      const employeeName = "emp_test_role"

      sessionRegistry.register(sessionId, employeeName)

      const result = await tool.execute(
        {
          operations: [
            {
              action: "add",
              name: "任务1",
              description: "第一个任务",
              dependencies: [],
            },
            {
              action: "add",
              name: "任务2",
              description: "第二个任务",
              dependencies: ["任务1"],
            },
            {
              action: "update",
              name: "任务1",
              status: "completed",
              result: "完成",
            },
          ],
        },
        {
          sessionID: sessionId,
          messageID: "msg-1",
          agent: "test",
          directory: TEST_WORKSPACE,
          worktree: TEST_WORKSPACE,
          abort: new AbortController().signal,
          metadata: () => {},
          ask: async () => {},
        }
      )

      expect(result).toContain("✓ Added task: 任务1 [pending]")
      expect(result).toContain("✓ Added task: 任务2 [pending]")
      expect(result).toContain("✓ Updated task: 任务1 [completed]")

      // 验证任务状态
      const task1 = await memoryManager.getTask(employeeName, "任务1")
      const task2 = await memoryManager.getTask(employeeName, "任务2")

      expect(task1?.status).toBe("completed")
      expect(task2?.dependencies).toEqual(["任务1"])
    })

    test("should return error for invalid operations", async () => {
      const tool = createEditTasksTool(memoryManager)
      const sessionId = "test-session-6"
      const employeeName = "emp_test_role"

      sessionRegistry.register(sessionId, employeeName)

      const result = await tool.execute(
        {
          operations: [
            {
              action: "add",
              name: "任务1",
              // 缺少 description
            },
            {
              action: "update",
              // 缺少 name
              status: "completed",
            },
          ],
        },
        {
          sessionID: sessionId,
          messageID: "msg-1",
          agent: "test",
          directory: TEST_WORKSPACE,
          worktree: TEST_WORKSPACE,
          abort: new AbortController().signal,
          metadata: () => {},
          ask: async () => {},
        }
      )

      expect(result).toContain(
        "Error: add operation requires name and description fields"
      )
      expect(result).toContain("Error: update operation requires name field")
    })
  })

  describe("create_agent tool", () => {
    test("should be temporarily disabled", async () => {
      const tool = createCreateAgentTool(mockOpcodeClient, stateManager)
      const sessionId = "test-session-7"
      const employeeName = "emp_test_role"

      sessionRegistry.register(sessionId, employeeName)

      await expect(
        tool.execute(
          {
            task_name: "复杂计算",
            prompt: "请计算 (123+456)*789",
          },
          {
            sessionID: sessionId,
            messageID: "msg-1",
            agent: "test",
            directory: TEST_WORKSPACE,
            worktree: TEST_WORKSPACE,
            abort: new AbortController().signal,
            metadata: () => {},
            ask: async () => {},
          }
        )
      ).rejects.toThrow(/temporarily disabled/i)
    })

    test("should throw even if session not registered", async () => {
      const tool = createCreateAgentTool(mockOpcodeClient, stateManager)

      await expect(
        tool.execute(
          {
            task_name: "任务",
            prompt: "提示词",
          },
          {
            sessionID: "unknown-session",
            messageID: "msg-1",
            agent: "test",
            directory: TEST_WORKSPACE,
            worktree: TEST_WORKSPACE,
            abort: new AbortController().signal,
            metadata: () => {},
            ask: async () => {},
          }
        )
      ).rejects.toThrow(/temporarily disabled/i)
    })

    test("should throw before calling client", async () => {
      // Mock 失败的客户端
      const failingClient = {
        session: {
          create: async () => {
            throw new Error("Network error")
          },
        },
      } as any

      const tool = createCreateAgentTool(failingClient, stateManager)
      const sessionId = "test-session-8"
      const employeeName = "emp_test_role"

      sessionRegistry.register(sessionId, employeeName)

      await expect(
        tool.execute(
          {
            task_name: "任务",
            prompt: "提示词",
          },
          {
            sessionID: sessionId,
            messageID: "msg-1",
            agent: "test",
            directory: TEST_WORKSPACE,
            worktree: TEST_WORKSPACE,
            abort: new AbortController().signal,
            metadata: () => {},
            ask: async () => {},
          }
        )
      ).rejects.toThrow(/temporarily disabled/i)
    })
  })
})
