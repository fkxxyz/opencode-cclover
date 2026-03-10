import { EmployeeRegistry } from "./EmployeeRegistry"
import { EventHistory } from "./EventHistory"
import { EventLogger } from "./EventLogger"
import { EmployeePersistence } from "./EmployeePersistence"
import type { Employee, EmployeeStatus, Event, EventType } from "../types/index"
import EventEmitter from "eventemitter3"

/**
 * 统一状态管理器
 * 整合员工注册表和事件历史,提供统一的状态查询接口
 */
export class StateManager {
  private projectId: string
  private workspaceRoot: string
  private employeeRegistry: EmployeeRegistry
  private employeePersistence: EmployeePersistence | null
  private eventHistory: EventHistory
  private eventLogger: EventLogger
  private taskCount: Map<string, number>
  private messageCount: Map<string, number>
  private emitter: EventEmitter

  constructor(
    projectId: string = "default",
    workspaceRoot?: string,
    projectPath?: string
  ) {
    this.projectId = projectId
    this.workspaceRoot = workspaceRoot || ""
    this.employeeRegistry = new EmployeeRegistry()
    this.employeePersistence = projectPath
      ? new EmployeePersistence(projectPath)
      : null
    this.eventHistory = new EventHistory()
    this.eventLogger = new EventLogger(workspaceRoot || "")
    this.taskCount = new Map()
    this.messageCount = new Map()
    this.emitter = new EventEmitter()
  }

  /**
   * 获取所有员工
   */
  getEmployees(): Employee[] {
    return this.employeeRegistry.getAll()
  }

  /**
   * 获取单个员工
   */
  getEmployee(name: string): Employee | undefined {
    return this.employeeRegistry.get(name)
  }

  /**
   * 获取项目 ID
   */
  getProjectId(): string {
    return this.projectId
  }

  /**
   * 注册员工
   */
  async registerEmployee(employee: Employee): Promise<void> {
    // 确保 paused 字段存在
    const employeeWithDefaults = {
      ...employee,
      paused: employee.paused ?? false, // 默认不暂停
    }

    this.employeeRegistry.register(employeeWithDefaults)
    this.taskCount.set(employeeWithDefaults.name, 0)
    this.messageCount.set(employeeWithDefaults.name, 0)
    // 持久化到文件（如果有 persistence）
    if (this.employeePersistence) {
      await this.employeePersistence.save(this.employeeRegistry.getAll())
    }
  }

  /**
   * 更新员工状态并记录事件
   */
  async updateEmployeeStatus(
    name: string,
    status: EmployeeStatus
  ): Promise<void> {
    const employee = this.employeeRegistry.get(name)
    if (!employee) {
      throw new Error(`员工 '${name}' 不存在`)
    }
    const oldStatus = employee.status

    // 如果状态没有变化，直接返回，不触发事件
    if (oldStatus === status) {
      return
    }

    this.employeeRegistry.updateStatus(name, status)
    // 记录状态变化事件
    const event = {
      projectId: this.projectId,
      type: "employee_status_changed" as const,
      timestamp: new Date().toISOString(),
      employeeName: name,
      details: {
        oldStatus,
        newStatus: status,
      },
    }
    this.eventHistory.add(event)
    // 持久化事件到 JSONL 文件
    await this.eventLogger.logEvent(name, event)
    // 触发事件通知
    this.emit("event", event)
  }

  /**
   * 暂停员工（修改配置，持久化）
   */
  async pauseEmployee(name: string): Promise<void> {
    const employee = this.employeeRegistry.get(name)
    if (!employee) {
      throw new Error(`员工 '${name}' 不存在`)
    }

    // 1. 更新配置
    this.employeeRegistry.updatePaused(name, true)

    // 2. 持久化配置
    if (this.employeePersistence) {
      await this.employeePersistence.save(this.employeeRegistry.getAll())
    }

    // 3. 更新运行时状态（不持久化）
    this.employeeRegistry.updateStatus(name, "offline")

    // 4. 记录事件
    const event = {
      projectId: this.projectId,
      type: "employee_paused" as const,
      timestamp: new Date().toISOString(),
      employeeName: name,
      details: {},
    }
    this.eventHistory.add(event)
    await this.eventLogger.logEvent(name, event)
    this.emit("event", event)
  }

  /**
   * 恢复员工（修改配置，持久化）
   */
  async resumeEmployee(name: string): Promise<void> {
    const employee = this.employeeRegistry.get(name)
    if (!employee) {
      throw new Error(`员工 '${name}' 不存在`)
    }

    // 1. 更新配置
    this.employeeRegistry.updatePaused(name, false)

    // 2. 持久化配置
    if (this.employeePersistence) {
      await this.employeePersistence.save(this.employeeRegistry.getAll())
    }

    // 3. 更新运行时状态（不持久化）
    this.employeeRegistry.updateStatus(name, "idle")

    // 4. 记录事件
    const event = {
      projectId: this.projectId,
      type: "employee_resumed" as const,
      timestamp: new Date().toISOString(),
      employeeName: name,
      details: {},
    }
    this.eventHistory.add(event)
    await this.eventLogger.logEvent(name, event)
    this.emit("event", event)
  }

  /**
   * 更新员工的活跃 session ID
   */
  async updateActiveSessionId(
    name: string,
    sessionId: string | undefined
  ): Promise<void> {
    const employee = this.employeeRegistry.get(name)
    if (!employee) {
      throw new Error(`员工 '${name}' 不存在`)
    }

    // 更新 activeSessionId
    this.employeeRegistry.updateActiveSessionId(name, sessionId)

    // 持久化到文件（如果有 persistence）
    if (this.employeePersistence) {
      await this.employeePersistence.save(this.employeeRegistry.getAll())
    }
  }

  /**
   * 添加事件
   */
  async addEvent(event: Event): Promise<void> {
    // 确保事件包含 projectId
    if (!event.projectId) {
      event.projectId = this.projectId
    }
    this.eventHistory.add(event)

    // 持久化事件到 JSONL 文件
    if (event.employeeName) {
      await this.eventLogger.logEvent(event.employeeName, event)
    }

    // 对于消息事件，同时记录到接收方的 events.jsonl
    if (event.type === "message" && event.details) {
      const from = event.details.from as string
      const to = event.details.to as string
      // 如果接收方不是发送方（避免重复记录）
      if (to && to !== from) {
        await this.eventLogger.logEvent(to, event)
      }
    }

    // 更新统计数据
    if (event.type === "message" && event.employeeName) {
      const count = this.messageCount.get(event.employeeName) || 0
      this.messageCount.set(event.employeeName, count + 1)
    }

    if (
      (event.type === "task_completed" || event.type === "task_cancelled") &&
      event.employeeName
    ) {
      const count = this.taskCount.get(event.employeeName) || 0
      this.taskCount.set(event.employeeName, count + 1)
    }

    // 触发事件通知（让 ConsoleServer 能够广播到前端）
    this.emit("event", event)
  }

  /**
   * 查询事件
   */
  getEvents(options?: {
    limit?: number
    employeeName?: string
    type?: EventType
  }): Event[] {
    const limit = options?.limit || 50
    const employeeName = options?.employeeName
    const type = options?.type

    if (employeeName) {
      return this.eventHistory.getByEmployee(employeeName, limit)
    }

    if (type) {
      return this.eventHistory.getByType(type, limit)
    }

    return this.eventHistory.getRecent(limit)
  }

  /**
   * 获取统计数据
   */
  getStats(): {
    totalEmployees: number
    activeEmployees: number
    pendingTasks: number
    todayMessages: number
  } {
    const employees = this.employeeRegistry.getAll()
    const activeEmployees = employees.filter((e) => e.status === "busy").length

    // 计算今日消息数(UTC时区)
    const now = new Date()
    const todayStart = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
    const todayMessages = this.eventHistory.getAll().filter((e) => {
      const eventTime = new Date(e.timestamp)
      return e.type === "message" && eventTime >= todayStart
    }).length

    // 计算待处理任务数(这里简化处理,实际应该从任务系统获取)
    const pendingTasks = 0

    return {
      totalEmployees: employees.length,
      activeEmployees,
      pendingTasks,
      todayMessages,
    }
  }

  /**
   * 监听员工事件
   */
  onEmployeeEvent(event: string, listener: (...args: any[]) => void): void {
    this.employeeRegistry.on(event, listener)
  }

  /**
   * 取消监听员工事件
   */
  offEmployeeEvent(event: string, listener: (...args: any[]) => void): void {
    this.employeeRegistry.off(event, listener)
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    this.employeeRegistry.clear()
    this.eventHistory.clear()
    this.taskCount.clear()
    this.messageCount.clear()
  }

  /**
   * 获取 EventLogger 实例
   */
  getEventLogger(): EventLogger {
    return this.eventLogger
  }

  /**
   * 从持久化文件加载历史事件
   * 在 StateManager 初始化后调用，恢复所有员工的历史事件到内存
   */
  async loadHistoricalEvents(): Promise<void> {
    // 遍历所有已注册的员工
    const employees = this.employeeRegistry.getAll()

    for (const employee of employees) {
      try {
        // 从文件加载该员工的历史事件（最多 1000 条）
        // EventLogger.getEvents 返回的是按时间顺序（旧→新）
        const events = await this.eventLogger.getEvents(employee.name, 1000)

        // 按时间顺序（旧→新）添加到 EventHistory
        // EventHistory.add() 使用 unshift，所以最后添加的（最新的）会在数组开头
        for (const event of events) {
          this.eventHistory.add(event)

          // 同步更新统计数据
          if (event.type === "message" && event.employeeName) {
            const count = this.messageCount.get(event.employeeName) || 0
            this.messageCount.set(event.employeeName, count + 1)
          }

          if (
            (event.type === "task_completed" ||
              event.type === "task_cancelled") &&
            event.employeeName
          ) {
            const count = this.taskCount.get(event.employeeName) || 0
            this.taskCount.set(event.employeeName, count + 1)
          }
        }
      } catch (error: any) {
        // 如果某个员工的事件文件不存在或读取失败，跳过并继续
        // 这是正常情况（新员工还没有事件历史）
        if (error.code !== "ENOENT") {
          console.warn(
            `Failed to load events for employee ${employee.name}:`,
            error.message
          )
        }
      }
    }
  }

  /**
   * 监听事件
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener)
  }

  /**
   * 取消监听事件
   */
  off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener)
  }

  /**
   * 触发事件
   */
  emit(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args)
  }

  /**
   * 从持久化文件加载员工列表
   */
  async loadEmployees(): Promise<void> {
    if (!this.employeePersistence) {
      return
    }
    const employees = await this.employeePersistence.load()
    for (const employee of employees) {
      // 检查是否已经注册（避免重复）
      if (!this.employeeRegistry.get(employee.name)) {
        this.employeeRegistry.register(employee)
        this.taskCount.set(employee.name, 0)
        this.messageCount.set(employee.name, 0)
      }
    }
  }
}
