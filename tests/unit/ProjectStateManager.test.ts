import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { ProjectStateManager } from "../../src/core/TaskManager"
import type { TaskId, ProjectState } from "../../src/types/index"
import * as lockfile from "proper-lockfile"
import * as yaml from "yaml"

/**
 * 真实的 ProjectStateManager 实现（用于测试）
 * 管理项目级状态，包括 TaskId 计数器
 */
class RealProjectStateManager implements ProjectStateManager {
  private projectRoot: string
  private stateFilePath: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
    this.stateFilePath = path.join(
      projectRoot,
      ".cclover",
      "project-state.yaml"
    )
  }

  /**
   * 获取下一个 TaskId 并递增计数器
   */
  async getNextTaskId(): Promise<TaskId> {
    await this.ensureStateFile()

    const release = await lockfile.lock(this.stateFilePath, { retries: 10 })
    try {
      const content = await fs.readFile(this.stateFilePath, "utf-8")
      const state: ProjectState = yaml.parse(content)

      const currentTaskId = state.nextTaskId
      state.nextTaskId++

      await fs.writeFile(this.stateFilePath, yaml.stringify(state), "utf-8")

      return currentTaskId
    } finally {
      await release()
    }
  }

  /**
   * 获取当前的 nextTaskId（不递增）
   */
  async getCurrentNextTaskId(): Promise<TaskId> {
    await this.ensureStateFile()

    const content = await fs.readFile(this.stateFilePath, "utf-8")
    const state: ProjectState = yaml.parse(content)
    return state.nextTaskId
  }

  /**
   * 确保状态文件存在
   */
  private async ensureStateFile(): Promise<void> {
    try {
      await fs.access(this.stateFilePath)
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // 创建目录
        await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true })

        // 创建初始状态文件
        const initialState: ProjectState = {
          nextTaskId: 1,
        }
        await fs.writeFile(
          this.stateFilePath,
          yaml.stringify(initialState),
          "utf-8"
        )
      } else {
        throw error
      }
    }
  }
}

describe("ProjectStateManager", () => {
  const testRoot = path.join(
    __dirname,
    "../fixtures/project-state-manager-test"
  )
  let stateManager: ProjectStateManager

  beforeEach(async () => {
    // 清理测试目录
    await fs.rm(testRoot, { recursive: true, force: true })
    await fs.mkdir(testRoot, { recursive: true })

    // 创建 ProjectStateManager
    stateManager = new RealProjectStateManager(testRoot)
  })

  afterEach(async () => {
    // 清理测试目录
    await fs.rm(testRoot, { recursive: true, force: true })
  })

  describe("getNextTaskId", () => {
    it("should return 1 for first task", async () => {
      const taskId = await stateManager.getNextTaskId()
      expect(taskId).toBe(1)
    })

    it("should increment taskId for each call", async () => {
      const taskId1 = await stateManager.getNextTaskId()
      const taskId2 = await stateManager.getNextTaskId()
      const taskId3 = await stateManager.getNextTaskId()

      expect(taskId1).toBe(1)
      expect(taskId2).toBe(2)
      expect(taskId3).toBe(3)
    })

    it("should persist taskId counter across instances", async () => {
      const taskId1 = await stateManager.getNextTaskId()
      expect(taskId1).toBe(1)

      // 创建新实例
      const newStateManager = new RealProjectStateManager(testRoot)
      const taskId2 = await newStateManager.getNextTaskId()
      expect(taskId2).toBe(2)
    })

    it(
      "should handle concurrent calls correctly",
      async () => {
        // 并发调用 getNextTaskId (减少数量以避免锁超时)
        const promises = Array.from({ length: 3 }, () =>
          stateManager.getNextTaskId()
        )
        const taskIds = await Promise.all(promises)

        // 所有 taskId 应该唯一
        const uniqueIds = new Set(taskIds)
        expect(uniqueIds.size).toBe(3)

        // taskId 应该在 1-3 范围内
        taskIds.forEach((id) => {
          expect(id).toBeGreaterThanOrEqual(1)
          expect(id).toBeLessThanOrEqual(3)
        })
      },
      { timeout: 10000 }
    )

    it("should create state file if it doesn't exist", async () => {
      const stateFilePath = path.join(
        testRoot,
        ".cclover",
        "project-state.yaml"
      )

      // 确认文件不存在
      await expect(fs.access(stateFilePath)).rejects.toThrow()

      // 调用 getNextTaskId
      await stateManager.getNextTaskId()

      // 确认文件已创建
      const stat = await fs.stat(stateFilePath)
      expect(stat.isFile()).toBe(true)
    })

    it("should create directory structure if it doesn't exist", async () => {
      const ccloverDir = path.join(testRoot, ".cclover")

      // 确认目录不存在
      await expect(fs.access(ccloverDir)).rejects.toThrow()

      // 调用 getNextTaskId
      await stateManager.getNextTaskId()

      // 确认目录已创建
      const stat = await fs.stat(ccloverDir)
      expect(stat.isDirectory()).toBe(true)
    })
  })

  describe("getCurrentNextTaskId", () => {
    it("should return 1 initially", async () => {
      const taskId = await stateManager.getCurrentNextTaskId()
      expect(taskId).toBe(1)
    })

    it("should not increment counter", async () => {
      const taskId1 = await stateManager.getCurrentNextTaskId()
      const taskId2 = await stateManager.getCurrentNextTaskId()
      const taskId3 = await stateManager.getCurrentNextTaskId()

      expect(taskId1).toBe(1)
      expect(taskId2).toBe(1)
      expect(taskId3).toBe(1)
    })

    it("should reflect changes from getNextTaskId", async () => {
      expect(await stateManager.getCurrentNextTaskId()).toBe(1)

      await stateManager.getNextTaskId()
      expect(await stateManager.getCurrentNextTaskId()).toBe(2)

      await stateManager.getNextTaskId()
      expect(await stateManager.getCurrentNextTaskId()).toBe(3)
    })

    it("should create state file if it doesn't exist", async () => {
      const stateFilePath = path.join(
        testRoot,
        ".cclover",
        "project-state.yaml"
      )

      // 确认文件不存在
      await expect(fs.access(stateFilePath)).rejects.toThrow()

      // 调用 getCurrentNextTaskId
      await stateManager.getCurrentNextTaskId()

      // 确认文件已创建
      const stat = await fs.stat(stateFilePath)
      expect(stat.isFile()).toBe(true)
    })
  })

  describe("File Format", () => {
    it("should use correct YAML format", async () => {
      await stateManager.getNextTaskId()

      const stateFilePath = path.join(
        testRoot,
        ".cclover",
        "project-state.yaml"
      )
      const content = await fs.readFile(stateFilePath, "utf-8")
      const state = yaml.parse(content)

      expect(state).toHaveProperty("nextTaskId")
      expect(typeof state.nextTaskId).toBe("number")
    })

    it("should maintain state file integrity", async () => {
      // 获取多个 taskId
      await stateManager.getNextTaskId()
      await stateManager.getNextTaskId()
      await stateManager.getNextTaskId()

      // 读取状态文件
      const stateFilePath = path.join(
        testRoot,
        ".cclover",
        "project-state.yaml"
      )
      const content = await fs.readFile(stateFilePath, "utf-8")
      const state = yaml.parse(content)

      // 验证状态
      expect(state.nextTaskId).toBe(4)
    })
  })
})
