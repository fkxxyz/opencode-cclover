/**
 * 服务器集成测试
 *
 * 测试 HTTP API 端点、WebSocket 连接和事件推送
 */
import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import { MessageService } from "../../src/core/MessageService"
import { MemoryManager } from "../../src/core/MemoryManager"
import { StateManager } from "../../src/state/StateManager"
import { BossManager } from "../../src/core/BossManager"
import { RoleManager } from "../../src/core/RoleManager"
import { ConsoleServer } from "../../src/server/index"
import { ProjectRegistry } from "../../src/server/ProjectRegistry"
import { AgentRegistry, agentRegistry } from "../../src/utils/AgentRegistry"
import { ModelConfigManager } from "../../src/config/ModelConfigManager"
import { MeetingModePromptInjector } from "../../src/meeting-mode/PromptInjector"
import type { Employee } from "../../src/types/index"
import {
  fetchApi,
  type HealthData,
  type EmployeeListData,
  type EmployeeDetailData,
  type MessageListData,
  type TaskListData,
  type HierarchyData,
  type EventListData,
  type StatsData,
  type TaskHaltData,
} from "../helpers/api-client"

const TEST_WORKSPACE = path.join(import.meta.dir, "../.test-workspace-server")
const TEST_PORT = 4098

describe("Console Server", () => {
  let projectRegistry: ProjectRegistry
  let server: ConsoleServer
  let stateManager: StateManager
  let abortMock: any

  beforeEach(async () => {
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })
    abortMock = async () => ({})
    stateManager = new StateManager(
      "test-project",
      TEST_WORKSPACE,
      TEST_WORKSPACE
    )
    const messageService = new MessageService(
      TEST_WORKSPACE,
      stateManager,
      "test-project",
      undefined,
      {
        session: {
          abort: (...args: any[]) => abortMock(...args),
        },
      } as any
    )
    const memoryManager = new MemoryManager(TEST_WORKSPACE)
    const bossManager = new BossManager(undefined, TEST_WORKSPACE)
    const roleManager = new RoleManager(TEST_WORKSPACE)
    const testAgentRegistry = new AgentRegistry()
    const modelConfigManager = new ModelConfigManager(
      { bosses: [], projects: [] },
      {}
    )
    const meetingModePromptInjector = new MeetingModePromptInjector(
      "test-project",
      "Test Project"
    )
    const testEmployee: Employee = {
      employeeId: "0-test-role",
      name: "test-role",
      taskId: 0,
      role: "TestRole",
      status: "idle",
      paused: false,
      hiredBy: "boss1",
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }
    stateManager.registerEmployee(testEmployee)
    await stateManager.registerEmployee({
      employeeId: "1-worker-001",
      name: "worker-001",
      taskId: 1,
      role: "Developer",
      status: "busy",
      paused: false,
      hiredBy: "0-test-role",
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
    await stateManager.registerEmployee({
      employeeId: "1-worker-002",
      name: "worker-002",
      taskId: 1,
      role: "Reviewer",
      status: "idle",
      paused: false,
      hiredBy: "1-worker-001",
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
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
      modelConfigManager,
      meetingModePromptInjector,
      feedbackManager: {} as any,
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
      const { response, json } = await fetchApi<HealthData>(
        `http://localhost:${TEST_PORT}/api/health`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(json.data.status).toBe("ok")
        expect(json.data.timestamp).toBeDefined()
        expect(json.data.version).toBeDefined()
      }
    })

    test("GET /api/projects/test-project/employees - 获取员工列表", async () => {
      const { response, json } = await fetchApi<EmployeeListData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(Array.isArray(json.data.employees)).toBe(true)
        expect(json.data.employees.length).toBeGreaterThan(0)
        expect(json.data.employees[0].name).toBe("test-role")
      }
    })

    test("GET /api/projects/test-project/employees/:name - 获取员工详情", async () => {
      const { response, json } = await fetchApi<EmployeeDetailData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/test-role`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(json.data.name).toBe("test-role")
        expect(json.data.role).toBe("TestRole")
        expect(json.data.memory).toBeDefined()
        expect(json.data.tasks).toBeDefined()
        expect(json.data.agents).toBeDefined()
      }
    })

    test("GET /api/projects/test-project/employees/:name - 员工不存在返回 404", async () => {
      const { response, json } = await fetchApi<never>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/unknown`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(false)
      if (!json.success) {
        expect(json.error.code).toBe("EMPLOYEE_NOT_FOUND")
      }
    })

    test("GET /api/projects/test-project/employees/:name/messages - 获取消息历史", async () => {
      const { response, json } = await fetchApi<MessageListData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/test-role/messages`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(Array.isArray(json.data.messages)).toBe(true)
      }
    })

    test("GET /api/projects/test-project/employees/:name/tasks - 获取任务列表", async () => {
      const { response, json } = await fetchApi<TaskListData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/test-role/tasks`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(Array.isArray(json.data.tasks)).toBe(true)
        expect(Array.isArray(json.data.executableTasks)).toBe(true)
      }
    })

    test("GET /api/projects/test-project/employees/hierarchy - 获取雇佣关系树", async () => {
      const { response, json } = await fetchApi<HierarchyData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/hierarchy`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(Array.isArray(json.data.hierarchy)).toBe(true)
        expect(json.data.hierarchy.length).toBeGreaterThan(0)
      }
    })

    test("GET /api/projects/test-project/events - 获取事件历史", async () => {
      const { response, json } = await fetchApi<EventListData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/events`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(Array.isArray(json.data.events)).toBe(true)
      }
    })

    test("GET /api/projects/test-project/stats - 获取全局统计", async () => {
      const { response, json } = await fetchApi<StatsData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/stats`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(json.data.totalEmployees).toBeGreaterThan(0)
        expect(json.data.activeEmployees).toBeDefined()
        expect(json.data.pendingTasks).toBeDefined()
        expect(json.data.todayMessages).toBeDefined()
      }
    })

    test("POST /api/projects/test-project/tasks/:taskId/halt - 急停任务下所有员工", async () => {
      const { response, json } = await fetchApi<TaskHaltData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/tasks/1/halt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: "runaway nested employees",
          }),
        }
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(json.data.taskId).toBe(1)
        expect(json.data.employeeIds).toContain("1-worker-001")
        expect(json.data.employeeIds).toContain("1-worker-002")

        const employeesYamlPath = path.join(
          TEST_WORKSPACE,
          ".cclover",
          "employees.yaml"
        )
        const persistedRaw = await fs.readFile(employeesYamlPath, "utf-8")
        const persisted = yaml.parse(persistedRaw)
        const haltedEmployees = persisted.employees.filter((employee: any) =>
          json.data.employeeIds.includes(employee.employeeId)
        )

        expect(haltedEmployees).toHaveLength(2)
        expect(
          haltedEmployees.every((employee: any) => employee.paused === true)
        ).toBe(true)
      }
    })

    test("GET /api/unknown - 400 错误 (无效路径)", async () => {
      const { response, json } = await fetchApi<never>(
        `http://localhost:${TEST_PORT}/api/unknown`
      )
      expect(response.status).toBe(400)
      expect(json.success).toBe(false)
      if (!json.success) {
        expect(json.error.code).toBe("INVALID_PATH")
      }
    })
    test("GET /api/projects/test-project/unknown - 404 错误", async () => {
      const { response, json } = await fetchApi<never>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/unknown`
      )
      expect(response.status).toBe(404)
      expect(json.success).toBe(false)
      if (!json.success) {
        expect(json.error.code).toBe("NOT_FOUND")
      }
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
            projectId: "test-project",
            timestamp: new Date().toISOString(),
            employeeId: "0-test-role",
            details: {
              from: "alice",
              to: "test-role",
              content: "test message",
            },
          } as any)
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
      expect(message.data.employeeId).toBe("0-test-role")

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
      const { response, json } = await fetchApi<EventListData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/events?limit=10`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(Array.isArray(json.data.events)).toBe(true)
      }
    })

    test("GET /api/projects/test-project/employees/:name/messages?limit=5 - 限制消息数量", async () => {
      const { response, json } = await fetchApi<MessageListData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/test-role/messages?limit=5`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(Array.isArray(json.data.messages)).toBe(true)
      }
    })
  })
})
