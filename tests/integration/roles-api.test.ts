/**
 * Roles API 集成测试
 *
 * 测试 role 相关的 HTTP API 端点
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
import type { ApiErrorResponse } from "../types/api-responses"
import { AgentRegistry } from "../../src/utils/AgentRegistry"
import type { Employee } from "../../src/types/index"
import { createTestProjectInstance } from "../helpers/createTestProjectInstance"
import {
  fetchApi,
  type RoleListData,
  type RoleDetailData,
} from "../helpers/api-client"

const TEST_WORKSPACE = path.join(
  import.meta.dir,
  "../.test-workspace-roles-api"
)
const TEST_PORT = 4100

describe("Roles API", () => {
  let projectRegistry: ProjectRegistry
  let server: ConsoleServer
  let roleManager: RoleManager

  beforeEach(async () => {
    // 清理并创建测试目录
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // 创建测试 role 文件
    const rolesDir = path.join(TEST_WORKSPACE, ".cclover/roles")
    await fs.mkdir(rolesDir, { recursive: true })

    // 创建一个测试 role（新格式：YAML frontmatter + markdown）
    const testRoleContent = `---
name: TestRole
id: test-role
description: A test role for integration testing
requiredArgs:
  apiKey:
    type: string
    description: API key for authentication
canHire:
  - test-role
  - coder
groups:
  - test-group
---

You are a test role. This is your system prompt.
`
    await fs.writeFile(path.join(rolesDir, "test-role.md"), testRoleContent)

    // 初始化服务
    const messageService = new MessageService(TEST_WORKSPACE)
    const memoryManager = new MemoryManager(TEST_WORKSPACE)
    const stateManager = new StateManager()
    roleManager = new RoleManager(TEST_WORKSPACE)
    await roleManager.refresh()
    const bossManager = new BossManager(
      { bosses: [], projects: [], modelTypes: {} },
      TEST_WORKSPACE,
      roleManager
    )

    const testAgentRegistry = new AgentRegistry()

    // 注册测试员工
    const testEmployee: Employee = {
      employeeId: "emp_test_employee",
      name: "test-employee",
      roleId: "TestRole",
      status: "idle",
      paused: false,
      hiredBy: "boss1",
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }
    stateManager.registerEmployee(testEmployee)

    // 启动服务器
    projectRegistry = new ProjectRegistry()
    const projectInstance = await createTestProjectInstance(TEST_WORKSPACE, {
      stateManager,
      messageService,
      memoryManager,
      agentRegistry: testAgentRegistry,
      bossManager,
      roleManager,
    })
    projectRegistry.register(projectInstance)

    server = new ConsoleServer(
      { port: TEST_PORT, workspaceRoot: TEST_WORKSPACE },
      projectRegistry
    )
    await server.start()
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  afterEach(async () => {
    await server.stop()
    await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
  })

  describe("GET /api/projects/:projectId/roles", () => {
    test("should return all roles with metadata", async () => {
      const { response, json } = await fetchApi<RoleListData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/roles`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(Array.isArray(json.data.roles)).toBe(true)
        expect(json.data.roles.length).toBeGreaterThanOrEqual(1)

        // 检查新格式 role（带元数据）
        const testRole = json.data.roles.find((r: any) => r.name === "TestRole")
        expect(testRole).toBeDefined()
        if (testRole) {
          expect(testRole.name).toBe("TestRole")
          expect(testRole.id).toBe("test-role")
          expect(testRole.description).toBe(
            "A test role for integration testing"
          )
          expect(testRole.systemPrompt).toContain("You are a test role")
          expect(testRole.source).toBe("project")
          expect(testRole.requiredArgs).toEqual({
            apiKey: {
              type: "string",
              description: "API key for authentication",
            },
          })
          expect(testRole.canHire).toEqual(["test-role", "coder"])
          expect(testRole.groups).toEqual(["test-group"])
        }
      }
    })

    test("should return 404 for non-existent project", async () => {
      const { response, json } = await fetchApi<never>(
        `http://localhost:${TEST_PORT}/api/projects/non-existent/roles`
      )

      expect(response.status).toBe(404)
      expect(json.success).toBe(false)
      if (!json.success) {
        expect(json.error.code).toBe("PROJECT_NOT_FOUND")
      }
    })
  })

  describe("GET /api/projects/:projectId/roles/:name", () => {
    test("should return specific role with metadata", async () => {
      const { response, json } = await fetchApi<RoleDetailData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/roles/TestRole`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(json.data).toBeDefined()
        expect(json.data.name).toBe("TestRole")
        expect(json.data.id).toBe("test-role")
        expect(json.data.description).toBe(
          "A test role for integration testing"
        )
        expect(json.data.systemPrompt).toContain("You are a test role")
        expect(json.data.source).toBe("project")
        expect(json.data.requiredArgs).toEqual({
          apiKey: {
            type: "string",
            description: "API key for authentication",
          },
        })
        expect(json.data.canHire).toEqual(["test-role", "coder"])
        expect(json.data.groups).toEqual(["test-group"])
      }
    })

    test("should return 404 for non-existent role", async () => {
      const { response, json } = await fetchApi<never>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/roles/non-existent`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(false)
      if (!json.success) {
        expect(json.error.code).toBe("ROLE_NOT_FOUND")
      }
    })

    test("should return 404 for non-existent project", async () => {
      const { response, json } = await fetchApi<never>(
        `http://localhost:${TEST_PORT}/api/projects/non-existent/roles/test-role`
      )

      expect(response.status).toBe(404)
      expect(json.success).toBe(false)
      if (!json.success) {
        expect(json.error.code).toBe("PROJECT_NOT_FOUND")
      }
    })
  })

  describe("GET /api/projects/:projectId/employees/:name/role", () => {
    test("should return employee's role with metadata", async () => {
      const { response, json } = await fetchApi<RoleDetailData>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/test-employee/role`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(true)
      if (json.success) {
        expect(json.data).toBeDefined()
        expect(json.data.name).toBe("TestRole")
        expect(json.data.id).toBe("test-role")
        expect(json.data.description).toBe(
          "A test role for integration testing"
        )
        expect(json.data.systemPrompt).toContain("You are a test role")
        expect(json.data.source).toBe("project")
        expect(json.data.requiredArgs).toEqual({
          apiKey: {
            type: "string",
            description: "API key for authentication",
          },
        })
        expect(json.data.canHire).toEqual(["test-role", "coder"])
        expect(json.data.groups).toEqual(["test-group"])
      }
    })

    test("should return 404 for non-existent employee", async () => {
      const { response, json } = await fetchApi<never>(
        `http://localhost:${TEST_PORT}/api/projects/test-project/employees/non-existent/role`
      )

      expect(response.status).toBe(200)
      expect(json.success).toBe(false)
      if (!json.success) {
        expect(json.error.code).toBe("EMPLOYEE_NOT_FOUND")
      }
    })

    test("should return 404 for non-existent project", async () => {
      const { response, json } = await fetchApi<never>(
        `http://localhost:${TEST_PORT}/api/projects/non-existent/employees/test-employee/role`
      )

      expect(response.status).toBe(404)
      expect(json.success).toBe(false)
      if (!json.success) {
        expect(json.error.code).toBe("PROJECT_NOT_FOUND")
      }
    })
  })
})
