import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import { MemoryManager } from "../../src/core/MemoryManager"
import { getTasks, haltTask } from "../../src/api/tasks"
import { StateManager } from "../../src/state/StateManager"
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

    const response = await getTasks("testRole?", memoryManager)

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.tasks).toEqual([])
      expect(response.data.executableTasks).toEqual([])
    }
  })

  it("should return all tasks with executable tasks", async () => {
    const memoryManager = new MemoryManager(testWorkspace)

    // 创建员工目录和记忆文件
    const employeeDir = path.join(testWorkspace, "employees", "testRole?")
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

    const response = await getTasks("testRole?", memoryManager)

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
    const employeeDir = path.join(testWorkspace, "employees", "testRole?")
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

    const response = await getTasks("testRole?", memoryManager)

    expect(response.success).toBe(true)
    if (response.success) {
      expect(response.data.tasks).toHaveLength(3)
      expect(response.data.executableTasks).toHaveLength(0)
    }
  })

  it("should reuse message service interruption path when halting a task", async () => {
    const stateManager = new StateManager(
      "test-project",
      testWorkspace,
      testWorkspace
    )
    const messageService = {
      abortActiveSession: mock(async () => {}),
    } as any

    const employee1: Employee = {
      employeeId: "13-worker-001",
      name: "worker-001",
      taskId: 13,
      role: "Developer",
      status: "busy",
      paused: false,
      hiredBy: null,
      activeSessionId: "session-1",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }

    const employee2: Employee = {
      employeeId: "13-worker-002",
      name: "worker-002",
      taskId: 13,
      role: "Reviewer",
      status: "idle",
      paused: false,
      hiredBy: "13-worker-001",
      activeSessionId: null,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    }

    await stateManager.registerEmployee(employee1)
    await stateManager.registerEmployee(employee2)

    const response = await haltTask(
      13,
      stateManager,
      "runaway nested employees",
      "test",
      messageService
    )

    expect(response.success).toBe(true)
    expect(messageService.abortActiveSession).toHaveBeenCalledTimes(2)
    expect(messageService.abortActiveSession).toHaveBeenCalledWith(
      "13-worker-001"
    )
    expect(messageService.abortActiveSession).toHaveBeenCalledWith(
      "13-worker-002"
    )
  })
})
