import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { MemoryManager } from "../../src/core/MemoryManager"
import { getTasks, haltTask } from "../../src/api/tasks"
import { StateManager } from "../../src/state/StateManager"
import { projectParamRoutes } from "../../src/server/routes"
import type { Employee, Memory } from "../../src/types/index"

const testWorkspace = "./workspace_test_tasks_api"

beforeEach(async () => {
  await fs.rm(testWorkspace, { recursive: true, force: true })
  await fs.mkdir(testWorkspace, { recursive: true })
})

afterEach(async () => {
  await fs.rm(testWorkspace, { recursive: true, force: true })
})

describe("Tasks API", () => {
  it("should return error when employee name is empty", async () => {
    const memoryManager = new MemoryManager(testWorkspace)

    const response = await getTasks("", memoryManager)

    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("INVALID_PARAMETER")
    }
  })

  it("should return empty tasks for new employee", async () => {
    const memoryManager = new MemoryManager(testWorkspace)

    const response = await getTasks("test-role", memoryManager)

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.tasks).toEqual([])
      expect(response.data.executableTasks).toEqual([])
    }
  })

  it("should return all tasks with executable tasks", async () => {
    const memoryManager = new MemoryManager(testWorkspace)

    // 创建员工目录和记忆文件
    const employeeDir = path.join(testWorkspace, "employees", "test-role")
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

    const response = await getTasks("test-role", memoryManager)

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.tasks).toHaveLength(3)
      expect(response.data.executableTasks).toHaveLength(2)
      expect(response.data.executableTasks).toContain("计算2+2")
      expect(response.data.executableTasks).toContain("计算3+3")
    }
  })

  it("should return only pending tasks as executable", async () => {
    const memoryManager = new MemoryManager(testWorkspace)

    // 创建员工目录和记忆文件
    const employeeDir = path.join(testWorkspace, "employees", "test-role")
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

    const response = await getTasks("test-role", memoryManager)

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.tasks).toHaveLength(3)
      expect(response.data.executableTasks).toHaveLength(0)
    }
  })

  it("routes personal TODO tasks by stable employeeId when name differs", async () => {
    const memoryManager = new MemoryManager(testWorkspace)
    const employeeDir = path.join(testWorkspace, "employees", "emp-worker")
    await fs.mkdir(employeeDir, { recursive: true })

    const memory: Memory = {
      knowledge: [],
      tasks: [
        {
          name: "检查API契约",
          status: "pending",
          description: "确保个人TODO按employeeId读取",
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

    const handler = projectParamRoutes.get("GET:/employees/:employeeId/tasks")
    expect(handler).toBeDefined()

    const response = await handler!(
      new Request(
        "http://localhost/api/projects/test-project/employees/emp-worker/tasks"
      ),
      { employeeId: "emp-worker", projectId: "test-project" },
      { memoryManager }
    )

    expect(response.success).toBe(true)
    expect(response.data.tasks).toHaveLength(1)
    expect(response.data.tasks[0].name).toBe("检查API契约")
  })

  it("should halt one employee by stable employeeId", async () => {
    const stateManager = new StateManager(
      "test-project",
      testWorkspace,
      testWorkspace
    )
    const messageService = {
      abortActiveSession: mock(async () => {}),
    } as any

    const employee1: Employee = {
      employeeId: "emp-worker-001",
      name: "worker-001",
      roleId: "Developer",
      status: "busy",
      paused: false,
      hiredBy: null,
      activeSessionId: "session-1",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }

    const employee2: Employee = {
      employeeId: "emp-worker-002",
      name: "worker-002",
      roleId: "Reviewer",
      status: "idle",
      paused: false,
      hiredBy: "emp-worker-001",
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }

    await stateManager.registerEmployee(employee1)
    await stateManager.registerEmployee(employee2)

    const response = await haltTask(
      "emp-worker-001",
      stateManager,
      "runaway nested employees",
      "test",
      messageService
    )

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data).toEqual({
        employeeId: "emp-worker-001",
        halted: true,
      })
    }
    expect(messageService.abortActiveSession).toHaveBeenCalledTimes(1)
    expect(messageService.abortActiveSession).toHaveBeenCalledWith(
      "emp-worker-001"
    )

    const events = stateManager.getEvents({ type: "employee_halted" })
    expect(events).toHaveLength(1)
    expect(events[0].employeeId).toBe("emp-worker-001")
    expect("taskId" in events[0].details).toBe(false)
  })

  it("should reject old numeric taskId halt behavior", async () => {
    const stateManager = new StateManager(
      "test-project",
      testWorkspace,
      testWorkspace
    )

    const response = await haltTask(13 as any, stateManager)

    expect(response.success).toBe(false)
    if (!response.success) {
      expect(response.error.code).toBe("INVALID_EMPLOYEE_ID")
    }
  })

  it("should not register old numeric taskId halt route", () => {
    expect(projectParamRoutes.has("POST:/tasks/:taskId/halt")).toBe(false)
    expect(projectParamRoutes.has("POST:/employees/:employeeId/halt")).toBe(
      true
    )
  })
})
