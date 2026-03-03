import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import * as lockfile from "proper-lockfile"
import type { StateManager } from "../state/StateManager"

/**
 * 任务状态
 */
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled"

/**
 * 任务对象
 */
export interface Task {
  name: string // 任务名称（唯一标识，AI 自己命名）
  status: TaskStatus // 任务状态
  description: string // 任务描述
  result?: string // 任务结果（完成时填写）
  dependencies: string[] // 依赖的任务名称列表
  created: string // 创建时间（ISO 8601）
  completed?: string // 完成时间（ISO 8601，可选）
}

/**
 * 记忆对象
 */
export interface Memory {
  knowledge: string[] // 经验知识
  tasks: Task[] // 任务列表
  custom: Record<string, any> // 自定义字段
}

/**
 * 记忆管理器
 * 负责维护员工的经验知识、任务状态和自定义数据
 */
export class MemoryManager {
  private projectId: string
  private workspaceRoot: string
  private stateManager?: StateManager
  constructor(
    workspaceRoot: string,
    stateManager?: StateManager,
    projectId?: string
  ) {
    this.workspaceRoot = workspaceRoot
    this.stateManager = stateManager
    this.projectId = projectId || "default"
  }

  /**
   * 获取员工记忆文件路径
   */
  private getMemoryPath(employeeName: string): string {
    return path.join(
      this.workspaceRoot,
      "employees",
      employeeName,
      "memory.yaml"
    )
  }

  /**
   * 确保目录存在
   */
  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      // 忽略已存在的错误
    }
  }

  /**
   * 读取员工记忆
   * 如果文件不存在，返回空记忆
   */
  async read(employeeName: string): Promise<Memory> {
    const memoryPath = this.getMemoryPath(employeeName)

    try {
      const content = await fs.readFile(memoryPath, "utf-8")
      const data = yaml.parse(content)

      // 确保数据结构完整
      return {
        knowledge: data?.knowledge ?? [],
        tasks: data?.tasks ?? [],
        custom: data?.custom ?? {},
      }
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // 文件不存在，返回空记忆
        return {
          knowledge: [],
          tasks: [],
          custom: {},
        }
      }
      throw error
    }
  }

  /**
   * 写入员工记忆
   */
  async write(employeeName: string, memory: Memory): Promise<void> {
    const memoryPath = this.getMemoryPath(employeeName)
    const dirPath = path.dirname(memoryPath)

    // 确保目录存在
    await this.ensureDir(dirPath)

    // 确保文件存在（用于加锁）
    try {
      await fs.access(memoryPath)
    } catch {
      await fs.writeFile(
        memoryPath,
        yaml.stringify({ knowledge: [], tasks: [], custom: {} }),
        "utf-8"
      )
    }

    // 加锁写入
    let release: (() => Promise<void>) | undefined
    try {
      // 获取文件锁（5秒超时）
      release = await lockfile.lock(memoryPath, {
        retries: {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 1000,
        },
        stale: 5000,
      })

      // 序列化为 YAML
      const content = yaml.stringify(memory)

      // 写入文件
      await fs.writeFile(memoryPath, content, "utf-8")
    } catch (error) {
      console.error(`[MemoryManager] Failed to write memory: ${error}`)
      throw error
    } finally {
      // 释放锁
      if (release) {
        await release()
      }
    }
  }

  /**
   * 添加任务
   */
  async addTask(
    employeeName: string,
    task: Omit<Task, "created">
  ): Promise<void> {
    const memory = await this.read(employeeName)

    // 检查任务名称是否已存在
    if (memory.tasks.some((t) => t.name === task.name)) {
      throw new Error(`Task "${task.name}" already exists`)
    }

    // 添加创建时间
    const newTask: Task = {
      ...task,
      created: new Date().toISOString(),
    }

    memory.tasks.push(newTask)
    await this.write(employeeName, memory)
    // 记录 task 创建事件
    await this.stateManager?.addEvent({
      projectId: this.projectId,
      type: "task_created",
      timestamp: newTask.created,
      employeeName,
      details: {
        taskName: newTask.name,
        description: newTask.description,
      },
    })
  }

  /**
   * 更新任务
   */
  async updateTask(
    employeeName: string,
    taskName: string,
    updates: Partial<Task>
  ): Promise<void> {
    const memory = await this.read(employeeName)

    const taskIndex = memory.tasks.findIndex((t) => t.name === taskName)
    if (taskIndex === -1) {
      throw new Error(`Task "${taskName}" not found`)
    }

    // 更新任务
    memory.tasks[taskIndex] = {
      ...memory.tasks[taskIndex],
      ...updates,
    }

    // 如果状态变为 completed，添加完成时间
    if (updates.status === "completed" && !memory.tasks[taskIndex].completed) {
      memory.tasks[taskIndex].completed = new Date().toISOString()
    }

    await this.write(employeeName, memory)

    // 发射事件到 StateManager
    const timestamp = new Date().toISOString()
    if (updates.status === "completed") {
      this.stateManager?.addEvent({
        projectId: this.projectId,
        type: "task_completed",
        timestamp,
        employeeName,
        details: {
          taskName,
          result: updates.result,
        },
      })
    } else if (updates.status === "cancelled") {
      this.stateManager?.addEvent({
        projectId: this.projectId,
        type: "task_failed",
        timestamp,
        employeeName,
        details: {
          taskName,
          reason: "cancelled",
        },
      })
    }
    // 记录 task 修改事件（除了 completed/cancelled 状态变化）
    if (updates.status !== "completed" && updates.status !== "cancelled") {
      await this.stateManager?.addEvent({
        projectId: this.projectId,
        type: "task_modified",
        timestamp,
        employeeName,
        details: {
          taskName,
          changes: updates,
        },
      })
    }
  }

  /**
   * 删除任务
   */
  async deleteTask(employeeName: string, taskName: string): Promise<void> {
    const memory = await this.read(employeeName)

    const taskIndex = memory.tasks.findIndex((t) => t.name === taskName)
    if (taskIndex === -1) {
      throw new Error(`Task "${taskName}" not found`)
    }

    memory.tasks.splice(taskIndex, 1)
    await this.write(employeeName, memory)
  }

  /**
   * 获取任务
   */
  async getTask(employeeName: string, taskName: string): Promise<Task | null> {
    const memory = await this.read(employeeName)
    return memory.tasks.find((t) => t.name === taskName) ?? null
  }

  /**
   * 获取可执行的任务
   * 返回所有依赖已满足的 pending 任务
   */
  async getExecutableTasks(employeeName: string): Promise<Task[]> {
    const memory = await this.read(employeeName)

    // 获取所有 completed 任务的名称
    const completedTasks = new Set(
      memory.tasks.filter((t) => t.status === "completed").map((t) => t.name)
    )

    // 找出所有依赖已满足的 pending 任务
    return memory.tasks.filter((task) => {
      if (task.status !== "pending") {
        return false
      }

      // 检查所有依赖是否都已完成
      return task.dependencies.every((dep) => completedTasks.has(dep))
    })
  }

  /**
   * 总结记忆
   * 更新 knowledge 和 custom，保留 tasks
   */
  async summarize(
    employeeName: string,
    summary: { knowledge: string[]; custom: Record<string, any> }
  ): Promise<void> {
    const memory = await this.read(employeeName)

    // 更新 knowledge 和 custom
    memory.knowledge = summary.knowledge
    memory.custom = summary.custom

    // tasks 保持不变
    await this.write(employeeName, memory)
  }

  /**
   * 检测循环依赖
   * 返回 true 如果存在循环依赖
   */
  async detectCycle(employeeName: string): Promise<boolean> {
    const memory = await this.read(employeeName)

    // 构建邻接表
    const graph = new Map<string, string[]>()
    for (const task of memory.tasks) {
      graph.set(task.name, task.dependencies)
    }

    // DFS 检测环
    const visited = new Set<string>()
    const recStack = new Set<string>()

    const hasCycle = (node: string): boolean => {
      if (!visited.has(node)) {
        visited.add(node)
        recStack.add(node)

        const neighbors = graph.get(node) ?? []
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor) && hasCycle(neighbor)) {
            return true
          } else if (recStack.has(neighbor)) {
            return true
          }
        }
      }

      recStack.delete(node)
      return false
    }

    for (const task of memory.tasks) {
      if (hasCycle(task.name)) {
        return true
      }
    }

    return false
  }
}
