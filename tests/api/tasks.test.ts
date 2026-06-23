import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { EmployeeWorkSessionManager } from "../../src/core/EmployeeWorkSessionManager"
import { MemoryManager } from "../../src/core/MemoryManager"
import { RoleManager } from "../../src/core/RoleManager"
import { getTasks, haltTask } from "../../src/api/tasks"
import { StateManager } from "../../src/state/StateManager"
import { projectParamRoutes } from "../../src/server/routes"
import type { Employee, Memory } from "../../src/types/index"
import {
  getTestProjectPaths,
  resetTestWorkspace,
} from "../helpers/testWorkspace"

const { suiteRoot, projectPath, workspaceRoot } =
  getTestProjectPaths("tasks-api")
const employeeWorkSessionId = "ews_worker"

beforeEach(async () => {
  await resetTestWorkspace(suiteRoot)
})

afterEach(async () => {
  await fs.rm(suiteRoot, { recursive: true, force: true })
})

async function writeRole(name: string): Promise<void> {
  const rolesDir = path.join(projectPath, ".cclover", "roles")
  await fs.mkdir(rolesDir, { recursive: true })
  await fs.writeFile(
    path.join(rolesDir, `${name}.md`),
    `---\nname: ${name}\nid: ${name}\ndescription: ${name} role\nrequiredArgs: {}\n---\nRole body\n`,
    "utf-8"
  )
}

describe("Tasks API", () => {
  it("should return error when employee name is empty", async () => {
    const memoryManager = new MemoryManager(workspaceRoot)

    const response = await getTasks("", memoryManager)

    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("INVALID_PARAMETER")
    }
  })

  it("should return empty tasks for new employee", async () => {
    const memoryManager = new MemoryManager(workspaceRoot)

    const response = await getTasks(employeeWorkSessionId, memoryManager)

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.tasks).toEqual([])
      expect(response.data.executableTasks).toEqual([])
    }
  })

  it("should return all tasks with executable tasks", async () => {
    const memoryManager = new MemoryManager(workspaceRoot)

    // 创建 EWS 运行时记忆文件
    const employeeDir = path.join(workspaceRoot, "ews", employeeWorkSessionId)
    await fs.mkdir(employeeDir, { recursive: true })

    const memory: Memory = {
      knowledge: [],
      tasks: [
        {
          name: "计算1+1",
          status: "completed",
          description: "为 alice 计算 1+1",
          result: "2",
          dependencies: [],
          created: "2026-03-01T10:00:00.000Z",
          completed: "2026-03-01T10:00:05.000Z",
        },
        {
          name: "计算2+2",
          status: "pending",
          description: "为 bob 计算 2+2",
          dependencies: ["计算1+1"],
          created: "2026-03-01T10:01:00.000Z",
        },
        {
          name: "计算3+3",
          status: "pending",
          description: "为 alice 计算 3+3",
          dependencies: [],
          created: "2026-03-01T10:02:00.000Z",
        },
      ],
      args: {},
    }

    const memoryPath = path.join(employeeDir, "memory.yaml")
    await fs.writeFile(memoryPath, yaml.stringify(memory), "utf-8")

    const response = await getTasks(employeeWorkSessionId, memoryManager)

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.tasks).toHaveLength(3)
      expect(response.data.executableTasks).toHaveLength(2)
      expect(response.data.executableTasks).toContain("计算2+2")
      expect(response.data.executableTasks).toContain("计算3+3")
    }
  })

  it("should return only pending tasks as executable", async () => {
    const memoryManager = new MemoryManager(workspaceRoot)

    // 创建 EWS 运行时记忆文件
    const employeeDir = path.join(workspaceRoot, "ews", employeeWorkSessionId)
    await fs.mkdir(employeeDir, { recursive: true })

    const memory: Memory = {
      knowledge: [],
      tasks: [
        {
          name: "任务1",
          status: "completed",
          description: "已完成",
          result: "done",
          dependencies: [],
          created: "2026-03-01T10:00:00.000Z",
          completed: "2026-03-01T10:00:05.000Z",
        },
        {
          name: "任务2",
          status: "in_progress",
          description: "进行中",
          dependencies: [],
          created: "2026-03-01T10:01:00.000Z",
        },
        {
          name: "任务3",
          status: "cancelled",
          description: "已取消",
          dependencies: [],
          created: "2026-03-01T10:02:00.000Z",
        },
      ],
      args: {},
    }

    const memoryPath = path.join(employeeDir, "memory.yaml")
    await fs.writeFile(memoryPath, yaml.stringify(memory), "utf-8")

    const response = await getTasks(employeeWorkSessionId, memoryManager)

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.tasks).toHaveLength(3)
      expect(response.data.executableTasks).toHaveLength(0)
    }
  })

  it("routes TODO tasks by employee work session ID", async () => {
    const memoryManager = new MemoryManager(workspaceRoot)
    const employeeDir = path.join(workspaceRoot, "ews", employeeWorkSessionId)
    await fs.mkdir(employeeDir, { recursive: true })

    const memory: Memory = {
      knowledge: [],
      tasks: [
        {
          name: "检查API契约",
          status: "pending",
          description: "确保 TODO 按 employeeWorkSessionId 读取",
          dependencies: [],
          created: "2026-06-19T00:00:00.000Z",
        },
      ],
      args: {},
    }
    await fs.writeFile(
      path.join(employeeDir, "memory.yaml"),
      yaml.stringify(memory),
      "utf-8"
    )

    const handler = projectParamRoutes.get(
      "GET:/employee-work-sessions/:employeeWorkSessionId/tasks"
    )
    expect(handler).toBeDefined()

    const response = await handler!(
      new Request(
        `http://localhost/api/projects/test-project/employee-work-sessions/${employeeWorkSessionId}/tasks`
      ),
      { employeeWorkSessionId, projectId: "test-project" },
      { memoryManager }
    )

    expect(response.success).toBe(true)
    expect(response.data.tasks).toHaveLength(1)
    expect(response.data.tasks[0].name).toBe("检查API契约")
  })

  it("should halt one employee work session", async () => {
    const stateManager = new StateManager(
      "test-project",
      workspaceRoot,
      projectPath
    )
    const roleManager = new RoleManager(projectPath)
    const employeeWorkSessionManager = new EmployeeWorkSessionManager(
      projectPath,
      stateManager,
      roleManager
    )
    const messageService = {
      abortActiveSession: mock(async () => {}),
    } as any

    const employee1: Employee = {
      employeeId: "emp-worker-001",
      name: "worker-001",
      roleId: "developer",
      description: "Worker under test",
      contextPaths: [],
      hiredBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const employee2: Employee = {
      employeeId: "emp-worker-002",
      name: "worker-002",
      roleId: "Reviewer",
      description: "Reviewer under test",
      contextPaths: [],
      hiredBy: "emp-worker-001",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await writeRole("developer")
    await stateManager.registerEmployee(employee1)
    await stateManager.registerEmployee(employee2)
    const session = await employeeWorkSessionManager.createEmployeeWorkSession({
      employeeId: employee1.employeeId,
      description: "Run worker",
      args: {},
      createdBy: "boss_alice",
    })

    const response = await haltTask(
      session.employeeWorkSessionId,
      employeeWorkSessionManager,
      "runaway nested employees",
      "test",
      messageService
    )

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data).toEqual({
        employeeWorkSessionId: session.employeeWorkSessionId,
        halted: true,
      })
    }
    expect(messageService.abortActiveSession).toHaveBeenCalledTimes(1)
    expect(messageService.abortActiveSession).toHaveBeenCalledWith(
      session.employeeWorkSessionId
    )

    expect(
      (
        await employeeWorkSessionManager.getEmployeeWorkSession(
          session.employeeWorkSessionId
        )
      )?.status
    ).toBe("abnormal")
  })

  it("should reject old numeric taskId halt behavior", async () => {
    const stateManager = new StateManager(
      "test-project",
      workspaceRoot,
      projectPath
    )
    const employeeWorkSessionManager = new EmployeeWorkSessionManager(
      projectPath,
      stateManager,
      new RoleManager(projectPath)
    )

    const response = await haltTask(13 as any, employeeWorkSessionManager)

    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("INVALID_EMPLOYEE_WORK_SESSION_ID")
    }
  })

  it("should not register old numeric taskId halt route", () => {
    expect(projectParamRoutes.has("POST:/tasks/:taskId/halt")).toBe(false)
    expect(
      projectParamRoutes.has(
        "POST:/employee-work-sessions/:employeeWorkSessionId/halt"
      )
    ).toBe(true)
  })
})
