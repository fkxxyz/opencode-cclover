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
import { EmployeeWorkSessionManager } from "../../src/core/EmployeeWorkSessionManager"
import { ConsoleServer } from "../../src/server/index"
import { ProjectRegistry } from "../../src/server/ProjectRegistry"
import { ModelConfigManager } from "../../src/config/ModelConfigManager"
import { MeetingModePromptInjector } from "../../src/meeting-mode/PromptInjector"
import { createTestEmployee } from "../helpers/employeeFactory"
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
  type EmployeeWorkSessionHaltData,
} from "../helpers/api-client"

const TEST_WORKSPACE = path.join(import.meta.dir, "../.test-workspace-server")
const TEST_PORT = 4098
const STATIC_TEST_PORT = 4108

describe("Console Server", () => {
  let projectRegistry: ProjectRegistry
  let server: ConsoleServer
  let stateManager: StateManager
  let abortMock: any
  let staticDir: string | undefined

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
    const employeeWorkSessionManager = new EmployeeWorkSessionManager(
      TEST_WORKSPACE,
      stateManager,
      roleManager
    )
    const modelConfigManager = new ModelConfigManager(
      { bosses: [], projects: [] },
      {}
    )
    const meetingModePromptInjector = new MeetingModePromptInjector(
      "test-project",
      "Test Project"
    )
    const testEmployee = createTestEmployee({
      employeeId: "emp_test_role",
      name: "test-role",
      roleId: "TestRole",
      status: "idle",
      hiredBy: "boss1",
    })
    stateManager.registerEmployee(testEmployee)
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_worker_001",
        name: "worker-001",
        roleId: "Developer",
        status: "busy",
        hiredBy: "emp_test_role",
      })
    )
    await stateManager.registerEmployee(
      createTestEmployee({
        employeeId: "emp_worker_002",
        name: "worker-002",
        roleId: "Reviewer",
        status: "idle",
        hiredBy: "emp_worker_001",
      })
    )
    await fs.mkdir(path.join(TEST_WORKSPACE, ".cclover"), { recursive: true })
    await fs.writeFile(
      path.join(TEST_WORKSPACE, ".cclover", "employee-work-sessions.yaml"),
      yaml.stringify({
        employeeWorkSessions: [
          {
            employeeWorkSessionId: "ews_test_role",
            parentEmployeeWorkSessionId: null,
            employeeId: "emp_test_role",
            opencodeSessionId: null,
            description: "test role session",
            args: {},
            contextPathsSnapshot: [],
            worktreeRef: null,
            status: "idle",
            closedAt: null,
            closedBy: null,
            closeReason: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            employeeWorkSessionId: "ews_worker_001",
            parentEmployeeWorkSessionId: "ews_test_role",
            employeeId: "emp_worker_001",
            opencodeSessionId: null,
            description: "worker session",
            args: {},
            contextPathsSnapshot: [],
            worktreeRef: null,
            status: "busy",
            closedAt: null,
            closedBy: null,
            closeReason: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })
    )
    projectRegistry = new ProjectRegistry()
    projectRegistry.register({
      projectId: "test-project",
      projectName: "Test Project",
      directory: TEST_WORKSPACE,
      workspaceRoot: TEST_WORKSPACE,
      stateManager,
      messageService,
      memoryManager,
      employeeWorkSessionManager,
      bossManager,
      roleManager,
      modelConfigManager,
      meetingModePromptInjector,
      feedbackManager: {} as any,
      eventLoopStarted: false,
      eventLoopStarting: null,
      eventLoops: new Map(),
    })
    server = new ConsoleServer(
      {
        port: TEST_PORT,
        workspaceRoot: TEST_WORKSPACE,
        staticDir,
      } as any,
      projectRegistry
    )
    await server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))
    staticDir = undefined
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

    test("GET /api/projects/test-project/employees/:employeeId - 获取员工详情", async () => {
      const { response, json } = await fetchApi<EmployeeDetailData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/emp_test_role`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(json.data.name).toBe("test-role")
        expect(json.data.roleId).toBe("TestRole")
        expect(json.data.memory).toBeDefined()
        expect(json.data.tasks).toBeDefined()
      }
    })

    test("GET /api/projects/test-project/employees/:name - display name 不作为员工详情资源键", async () => {
      const { response, json } = await fetchApi<never>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/test-role`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(false)
      if (!json.success) {
        expect(json.error.code).toBe("EMPLOYEE_NOT_FOUND")
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

    test("GET /api/projects/test-project/employee-work-sessions/:employeeWorkSessionId/messages - 获取消息历史", async () => {
      const { response, json } = await fetchApi<MessageListData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employee-work-sessions/ews_test_role/messages`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(Array.isArray(json.data.messages)).toBe(true)
      }
    })

    test("GET /api/projects/test-project/employee-work-sessions/:employeeWorkSessionId/tasks - 获取任务列表", async () => {
      const { response, json } = await fetchApi<TaskListData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employee-work-sessions/ews_test_role/tasks`
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

    test("POST /api/projects/test-project/employee-work-sessions/:employeeWorkSessionId/halt - 急停指定员工工作会话", async () => {
      const { response, json } = await fetchApi<EmployeeWorkSessionHaltData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employee-work-sessions/ews_worker_001/halt`,
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
        expect(json.data.employeeWorkSessionId).toBe("ews_worker_001")
        expect(json.data.halted).toBe(true)

        const employeeWorkSessionsYamlPath = path.join(
          TEST_WORKSPACE,
          ".cclover",
          "employee-work-sessions.yaml"
        )
        const persistedRaw = await fs.readFile(
          employeeWorkSessionsYamlPath,
          "utf-8"
        )
        const persisted = yaml.parse(persistedRaw)
        const haltedSessions = persisted.employeeWorkSessions.filter(
          (session: any) =>
            session.employeeWorkSessionId === json.data.employeeWorkSessionId
        )

        expect(haltedSessions).toHaveLength(1)
        expect(
          haltedSessions.every((session: any) => session.status === "abnormal")
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

    test("GET / - 未配置静态目录时返回 404", async () => {
      const response = await fetch(`http://localhost:${TEST_PORT}/`)

      expect(response.status).toBe(404)
    })
  })

  describe("静态资源托管", () => {
    beforeEach(async () => {
      await server.stop()

      staticDir = path.join(TEST_WORKSPACE, "console-dist")
      await fs.mkdir(path.join(staticDir, "assets"), { recursive: true })
      await fs.writeFile(
        path.join(staticDir, "index.html"),
        '<html><body><div id="root">console</div></body></html>'
      )
      await fs.writeFile(
        path.join(staticDir, "assets", "app.js"),
        'console.log("hello")'
      )

      server = new ConsoleServer(
        {
          port: STATIC_TEST_PORT,
          workspaceRoot: TEST_WORKSPACE,
          staticDir,
        } as any,
        projectRegistry
      )
      await server.start()
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    test("GET / - 返回静态 index.html", async () => {
      const response = await fetch(`http://localhost:${STATIC_TEST_PORT}/`)
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toContain("text/html")
      expect(text).toContain('<div id="root">console</div>')
    })

    test("GET /employees/test-role - SPA 路由 fallback 到 index.html", async () => {
      const response = await fetch(
        `http://localhost:${STATIC_TEST_PORT}/employees/test-role`
      )
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toContain("text/html")
      expect(text).toContain('<div id="root">console</div>')
    })

    test("GET /assets/app.js - 返回真实静态资源", async () => {
      const response = await fetch(
        `http://localhost:${STATIC_TEST_PORT}/assets/app.js`
      )
      const text = await response.text()

      expect(response.status).toBe(200)
      expect(text).toContain('console.log("hello")')
    })

    test("GET /assets/missing.js - 不存在的静态资源返回 404", async () => {
      const response = await fetch(
        `http://localhost:${STATIC_TEST_PORT}/assets/missing.js`
      )

      expect(response.status).toBe(404)
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
            employeeId: "emp_test_role",
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
      expect(message.data.employeeId).toBe("emp_test_role")

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

    test("GET /api/projects/test-project/employee-work-sessions/:employeeWorkSessionId/messages?limit=5 - 限制消息数量", async () => {
      const { response, json } = await fetchApi<MessageListData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employee-work-sessions/ews_test_role/messages?limit=5`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(Array.isArray(json.data.messages)).toBe(true)
      }
    })
  })
})
