import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import {
  TaskManager,
  type ProjectStateManager,
} from "../../src/core/TaskManager"
import type { TaskId } from "../../src/types/index"

// Mock ProjectStateManager
class MockProjectStateManager implements ProjectStateManager {
  private nextTaskId: TaskId = 1

  async getNextTaskId(): Promise<TaskId> {
    const current = this.nextTaskId
    this.nextTaskId++
    return current
  }

  async getCurrentNextTaskId(): Promise<TaskId> {
    return this.nextTaskId
  }

  // 用于测试的辅助方法
  reset() {
    this.nextTaskId = 1
  }
}

describe("TaskManager", () => {
  const testRoot = path.join(__dirname, "../fixtures/task-manager-test")
  let taskManager: TaskManager
  let mockStateManager: MockProjectStateManager

  beforeEach(async () => {
    // 清理测试目录
    await fs.rm(testRoot, { recursive: true, force: true })
    await fs.mkdir(testRoot, { recursive: true })

    // 创建 mock 和 TaskManager
    mockStateManager = new MockProjectStateManager()
    taskManager = new TaskManager(testRoot, mockStateManager)
  })

  afterEach(async () => {
    // 清理测试目录
    await fs.rm(testRoot, { recursive: true, force: true })
  })

  describe("createTask", () => {
    it("should create task directory and return taskId", async () => {
      const taskId = await taskManager.createTask()

      expect(taskId).toBe(1)
      expect(await taskManager.taskExists(1)).toBe(true)

      const taskPath = taskManager.getTaskPath(1)
      const stat = await fs.stat(taskPath)
      expect(stat.isDirectory()).toBe(true)
    })

    it("should create multiple tasks with incremental taskIds", async () => {
      const taskId1 = await taskManager.createTask()
      const taskId2 = await taskManager.createTask()
      const taskId3 = await taskManager.createTask()

      expect(taskId1).toBe(1)
      expect(taskId2).toBe(2)
      expect(taskId3).toBe(3)

      expect(await taskManager.taskExists(1)).toBe(true)
      expect(await taskManager.taskExists(2)).toBe(true)
      expect(await taskManager.taskExists(3)).toBe(true)
    })

    it("should create nested directories if they don't exist", async () => {
      const taskId = await taskManager.createTask()

      const tasksDir = path.join(testRoot, ".cclover", "tasks")
      const stat = await fs.stat(tasksDir)
      expect(stat.isDirectory()).toBe(true)

      const taskPath = taskManager.getTaskPath(taskId)
      const taskStat = await fs.stat(taskPath)
      expect(taskStat.isDirectory()).toBe(true)
    })
  })

  describe("taskExists", () => {
    it("should return true for existing task", async () => {
      const taskId = await taskManager.createTask()
      expect(await taskManager.taskExists(taskId)).toBe(true)
    })

    it("should return false for non-existing task", async () => {
      expect(await taskManager.taskExists(999)).toBe(false)
    })

    it("should return false when tasks directory doesn't exist", async () => {
      expect(await taskManager.taskExists(1)).toBe(false)
    })
  })

  describe("listTasks", () => {
    it("should return empty array when no tasks exist", async () => {
      const tasks = await taskManager.listTasks()
      expect(tasks).toEqual([])
    })

    it("should return empty array when tasks directory doesn't exist", async () => {
      const tasks = await taskManager.listTasks()
      expect(tasks).toEqual([])
    })

    it("should list all task directories", async () => {
      await taskManager.createTask()
      await taskManager.createTask()
      await taskManager.createTask()

      const tasks = await taskManager.listTasks()
      expect(tasks).toEqual([1, 2, 3])
    })

    it("should return sorted task IDs", async () => {
      // 手动创建乱序的任务目录
      const tasksDir = path.join(testRoot, ".cclover", "tasks")
      await fs.mkdir(tasksDir, { recursive: true })
      await fs.mkdir(path.join(tasksDir, "3"))
      await fs.mkdir(path.join(tasksDir, "1"))
      await fs.mkdir(path.join(tasksDir, "2"))

      const tasks = await taskManager.listTasks()
      expect(tasks).toEqual([1, 2, 3])
    })

    it("should ignore non-numeric directories", async () => {
      const tasksDir = path.join(testRoot, ".cclover", "tasks")
      await fs.mkdir(tasksDir, { recursive: true })
      await fs.mkdir(path.join(tasksDir, "1"))
      await fs.mkdir(path.join(tasksDir, "2"))
      await fs.mkdir(path.join(tasksDir, "invalid"))
      await fs.mkdir(path.join(tasksDir, "test"))

      const tasks = await taskManager.listTasks()
      expect(tasks).toEqual([1, 2])
    })

    it("should ignore files in tasks directory", async () => {
      const tasksDir = path.join(testRoot, ".cclover", "tasks")
      await fs.mkdir(tasksDir, { recursive: true })
      await fs.mkdir(path.join(tasksDir, "1"))
      await fs.writeFile(path.join(tasksDir, "2"), "test")

      const tasks = await taskManager.listTasks()
      expect(tasks).toEqual([1])
    })

    it("should ignore taskId 0 (reserved for non-task employees)", async () => {
      const tasksDir = path.join(testRoot, ".cclover", "tasks")
      await fs.mkdir(tasksDir, { recursive: true })
      await fs.mkdir(path.join(tasksDir, "0"))
      await fs.mkdir(path.join(tasksDir, "1"))
      await fs.mkdir(path.join(tasksDir, "2"))

      const tasks = await taskManager.listTasks()
      expect(tasks).toEqual([1, 2])
    })
  })

  describe("getTaskPath", () => {
    it("should return correct task path", () => {
      const taskPath = taskManager.getTaskPath(1)
      expect(taskPath).toBe(path.join(testRoot, ".cclover", "tasks", "1"))
    })

    it("should return correct path for different taskIds", () => {
      expect(taskManager.getTaskPath(1)).toBe(
        path.join(testRoot, ".cclover", "tasks", "1")
      )
      expect(taskManager.getTaskPath(42)).toBe(
        path.join(testRoot, ".cclover", "tasks", "42")
      )
      expect(taskManager.getTaskPath(999)).toBe(
        path.join(testRoot, ".cclover", "tasks", "999")
      )
    })
  })
})
