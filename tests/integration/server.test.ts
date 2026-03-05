/**
 * 服务器集成测试
 *
 * 测试 HTTP API 端点、WebSocket 连接和事件推送
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { MessageService } from "../../src/core/MessageService"
import { MemoryManager } from "../../src/core/MemoryManager"
import { StateManager } from "../../src/state/StateManager"
import { BossManager } from "../../src/core/BossManager"
import { RoleManager } from "../../src/core/RoleManager"
import { ConsoleServer } from "../../src/server/index"
import { ProjectRegistry } from "../../src/server/ProjectRegistry"
import { AgentRegistry, agentRegistry } from "../../src/utils/AgentRegistry"
import type { Employee } from "../../src/types/index"

const TEST_WORKSPACE = path.join(import.meta.dir, "../.test-workspace-server")
const TEST_PORT = 4098

describe("Console Server", () => {
  let projectRegistry: ProjectRegistry
  let server: ConsoleServer

  beforeEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })
    const messageService = new MessageService(TEST_WORKSPACE)
    const memoryManager = new MemoryManager(TEST_WORKSPACE)
    const stateManager = new StateManager()
    const bossManager = new BossManager(TEST_WORKSPACE)
    const roleManager = new RoleManager(TEST_WORKSPACE)
    const testAgentRegistry = new AgentRegistry()
    const testEmployee: Employee = {
      name: "calculator",
      role: "Calculator",
      status: "idle",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }
    stateManager.registerEmployee(testEmployee)
    projectRegistry = new ProjectRegistry()
    projectRegistry.register({
      projectId: "test-project",
      projectName: "Test Project",
      directory: TEST_WORKSPACE,
      workspaceRoot: TEST_WORKSPACE,
      stateManager,
      messageService,
      memoryManager,
      agentRegistry: testAgentRegistry,
      bossManager,
      roleManager,
      eventLoopStarted: false,
      eventLoops: new Map(),
    })
    server = new ConsoleServer(
      { port: TEST_PORT, workspaceRoot: TEST_WORKSPACE },
      projectRegistry
    )
    await server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))
    agentRegistry.clear()
  })

  afterEach(async () => {
    // 停止服务器
    await server.stop()

    // 清理测试目录
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  describe("HTTP API", () => {
    test("GET /api/health - 健康检查", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/api/health`)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.status).toBe("ok")
      expect(json.data.timestamp).toBeDefined()
      expect(json.data.version).toBeDefined()
    })

    test("GET /api/projects/test-project/employees - 获取员工列表", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees`
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(Array.isArray(json.data.employees)).toBe(true)
      expect(json.data.employees.length).toBeGreaterThan(0)
      expect(json.data.employees[0].name).toBe("calculator")
    })

    test("GET /api/projects/test-project/employees/:name - 获取员工详情", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/calculator`
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.name).toBe("calculator")
      expect(json.data.role).toBe("Calculator")
      expect(json.data.memory).toBeDefined()
      expect(json.data.tasks).toBeDefined()
      expect(json.data.agents).toBeDefined()
    })

    test("GET /api/projects/test-project/employees/:name - 员工不存在返回 404", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/unknown`
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe("EMPLOYEE_NOT_FOUND")
    })

    test("GET /api/projects/test-project/employees/:name/messages - 获取消息历史", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/calculator/messages`
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(Array.isArray(json.data.messages)).toBe(true)
    })

    test("GET /api/projects/test-project/employees/:name/tasks - 获取任务列表", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/calculator/tasks`
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(Array.isArray(json.data.tasks)).toBe(true)
      expect(Array.isArray(json.data.executableTasks)).toBe(true)
    })

    test("GET /api/projects/test-project/employees/hierarchy - 获取雇佣关系树", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/hierarchy`
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(Array.isArray(json.data.hierarchy)).toBe(true)
      expect(json.data.hierarchy.length).toBeGreaterThan(0)
    })

    test("GET /api/projects/test-project/events - 获取事件历史", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/events`
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(Array.isArray(json.data.events)).toBe(true)
    })

    test("GET /api/projects/test-project/stats - 获取全局统计", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/stats`
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.totalEmployees).toBeGreaterThan(0)
      expect(json.data.activeEmployees).toBeDefined()
      expect(json.data.pendingTasks).toBeDefined()
      expect(json.data.todayMessages).toBeDefined()
    })

    test("GET /api/unknown - 400 错误 (无效路径)", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/api/unknown`)
      const json = await response.json()
      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe("INVALID_PATH")
    })
    test("GET /api/projects/test-project/unknown - 404 错误", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/unknown`
      )
      const json = await response.json()
      expect(response.status).toBe(404)
      expect(json.success).toBe(false)
      expect(json.error.code).toBe("NOT_FOUND")
    })

    test("OPTIONS 请求 - CORS 预检", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees`,
        {
          method: "OPTIONS",
        }
      )

      expect(response.status).toBe(204)
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "GET"
      )
    })

    test("CORS 响应头", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/api/health`)

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "GET"
      )
      expect(response.headers.get("Content-Type")).toBe("application/json")
    })
  })

  describe("WebSocket", () => {
    test("WebSocket 连接建立", async () => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`)

      // 等待连接建立
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve()
        ws.onerror = (error) => reject(error)
        setTimeout(() => reject(new Error("WebSocket 连接超时")), 5000)
      })

      expect(ws.readyState).toBe(WebSocket.OPEN)
      ws.close()
    })

    test("WebSocket 接收事件", async () => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`)

      const eventPromise = new Promise<any>((resolve, reject) => {
        ws.onopen = () => {
          // 连接建立后广播事件
          server.broadcastEvent({
            type: "message",
            timestamp: new Date().toISOString(),
            employeeName: "calculator",
            details: {
              from: "alice",
              to: "calculator",
              content: "test message",
            },
          })
        }

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            resolve(message)
          } catch (error) {
            reject(error)
          }
        }

        ws.onerror = (error) => reject(error)
        setTimeout(() => reject(new Error("WebSocket 消息超时")), 5000)
      })

      const message = await eventPromise
      expect(message.type).toBe("event")
      expect(message.data.type).toBe("message")
      expect(message.data.employeeName).toBe("calculator")

      ws.close()
    })

    test("WebSocket 连接断开", async () => {
      const ws = new WebSocket(`ws://localhost:${TEST_PORT}/ws`)

      await new Promise<void>((resolve) => {
        ws.onopen = () => {
          ws.close()
        }
        ws.onclose = () => resolve()
      })

      expect(ws.readyState).toBe(WebSocket.CLOSED)
    })
  })

  describe("查询参数", () => {
    test("GET /api/projects/test-project/events?limit=10 - 限制事件数量", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/events?limit=10`
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(Array.isArray(json.data.events)).toBe(true)
    })

    test("GET /api/projects/test-project/employees/:name/messages?limit=5 - 限制消息数量", async () => {
      const response = await fetch(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/calculator/messages?limit=5`
      )
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      expect(Array.isArray(json.data.messages)).toBe(true)
    })
  })
})
