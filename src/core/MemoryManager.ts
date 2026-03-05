import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "yaml"
import * as lockfile from "proper-lockfile"
import type { StateManager } from "../state/StateManager"

/**
 * 任务状态
 */
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "waiting_for_message"

/**
 * 任务对象
 */
export interface Task {
  name: string // 任务名称（唯一标识，AI 自己命名）
  status: TaskStatus // 任务状态
  description: string // 任务描述
  result?: string // 任务结果（只记录任务完成时的结果）
  statusReason?: string // 状态变更的原因（适用于所有状态）
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
  sessionId?: string // Session ID（可选）

  // Session 创建时的快照
  sessionSnapshot?: {
    knowledge: string[]
    tasks: Task[]
    custom: Record<string, any>
    timestamp: string
  }
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
        sessionId: data?.sessionId ?? undefined,
        sessionSnapshot: data?.sessionSnapshot ?? undefined,
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
        type: "task_cancelled",
        timestamp,
        employeeName,
        details: {
          taskName,
          reason: updates.statusReason || "cancelled by user",
        },
      })
    } else if (updates.status === "waiting_for_message") {
      // 新增：waiting_for_message 状态的事件
      this.stateManager?.addEvent({
        projectId: this.projectId,
        type: "task_waiting_for_message",
        timestamp,
        employeeName,
        details: {
          taskName,
          reason: updates.statusReason || "waiting_for_message",
        },
      })
    }
    // 记录 task 修改事件（除了 completed/cancelled/waiting_for_message 状态变化）
    if (
      updates.status !== "completed" &&
      updates.status !== "cancelled" &&
      updates.status !== "waiting_for_message"
    ) {
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
   * 删除任务并清理依赖
   * 自动从所有依赖该任务的任务中移除该依赖
   * @returns 受影响的任务名称列表
   */
  async deleteTaskWithCleanup(
    employeeName: string,
    taskName: string
  ): Promise<{ affectedTasks: string[] }> {
    const memory = await this.read(employeeName)

    // 1. 检查任务是否存在
    const taskIndex = memory.tasks.findIndex((t) => t.name === taskName)
    if (taskIndex === -1) {
      throw new Error(`Task "${taskName}" not found`)
    }

    // 2. 找出所有依赖该任务的任务
    const affectedTasks: string[] = []
    for (const task of memory.tasks) {
      if (task.dependencies.includes(taskName)) {
        affectedTasks.push(task.name)
        // 从依赖列表中移除该任务
        task.dependencies = task.dependencies.filter((dep) => dep !== taskName)
      }
    }

    // 3. 删除目标任务
    memory.tasks.splice(taskIndex, 1)

    // 4. 写入更新后的记忆
    await this.write(employeeName, memory)

    // 5. 记录 task_deleted 事件
    const timestamp = new Date().toISOString()
    await this.stateManager?.addEvent({
      projectId: this.projectId,
      type: "task_deleted",
      timestamp,
      employeeName,
      details: {
        taskName,
        affectedTasks,
        affectedCount: affectedTasks.length,
      },
    })

    return { affectedTasks }
  }

  /**
   * 分解任务为多个子任务
   * 原任务保留并依赖所有子任务,子任务继承原任务的依赖
   * @param employeeName 员工名称
   * @param taskName 要分解的任务名称
   * @param subtasks 子任务列表
   */
  async decomposeTask(
    employeeName: string,
    taskName: string,
    subtasks: Array<{
      name: string
      description: string
      dependencies?: string[]
    }>
  ): Promise<void> {
    const memory = await this.read(employeeName)

    // 1. 找到原任务
    const originalTask = memory.tasks.find((t) => t.name === taskName)
    if (!originalTask) {
      throw new Error(`Task "${taskName}" not found`)
    }

    // 2. 获取原任务的依赖
    const originalDeps = originalTask.dependencies

    // 3. 创建子任务
    const timestamp = new Date().toISOString()
    const subtaskNames: string[] = []

    for (const subtask of subtasks) {
      // 检查子任务名称是否已存在
      if (memory.tasks.some((t) => t.name === subtask.name)) {
        throw new Error(`Subtask name "${subtask.name}" already exists`)
      }

      // 合并依赖: 原任务依赖 + 子任务额外依赖
      const finalDeps = [
        ...originalDeps,
        ...(subtask.dependencies || []),
      ].filter((dep, index, self) => self.indexOf(dep) === index) // 去重

      // 创建子任务
      const newSubtask: Task = {
        name: subtask.name,
        description: subtask.description,
        status: "pending",
        dependencies: finalDeps,
        created: timestamp,
      }

      memory.tasks.push(newSubtask)
      subtaskNames.push(subtask.name)

      // 记录 task_created 事件
      await this.stateManager?.addEvent({
        projectId: this.projectId,
        type: "task_created",
        timestamp,
        employeeName,
        details: {
          taskName: subtask.name,
          description: subtask.description,
        },
      })
    }

    // 4. 更新原任务: 状态改为 pending, 依赖改为所有子任务
    originalTask.status = "pending"
    originalTask.dependencies = subtaskNames
    originalTask.completed = undefined // 清除完成时间

    // 5. 写入更新后的记忆
    await this.write(employeeName, memory)

    // 6. 记录 task_decomposed 事件
    await this.stateManager?.addEvent({
      projectId: this.projectId,
      type: "task_decomposed",
      timestamp,
      employeeName,
      details: {
        originalTask: taskName,
        subtasks: subtaskNames,
        subtaskCount: subtaskNames.length,
      },
    })
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

    // 获取所有 completed 或 cancelled 任务的名称
    // cancelled 任务也视为依赖已满足，避免阻塞依赖它的任务
    const satisfiedTasks = new Set(
      memory.tasks
        .filter((t) => t.status === "completed" || t.status === "cancelled")
        .map((t) => t.name)
    )

    // 找出所有依赖已满足的 pending 任务
    return memory.tasks.filter((task) => {
      if (task.status !== "pending") {
        return false
      }

      // 检查所有依赖是否都已完成或取消
      return task.dependencies.every((dep) => satisfiedTasks.has(dep))
    })
  }

  /**
   * 获取正在进行的任务
   * 返回所有状态为 in_progress 的任务
   */
  async getInProgressTasks(employeeName: string): Promise<Task[]> {
    const memory = await this.read(employeeName)
    return memory.tasks.filter((task) => task.status === "in_progress")
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
