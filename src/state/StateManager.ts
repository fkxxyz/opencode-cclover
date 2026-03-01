import { EmployeeRegistry } from "./EmployeeRegistry"
import { EventHistory } from "./EventHistory"
import type { Employee, EmployeeStatus, Event, EventType } from "../types/index"

/**
 * 统一状态管理器
 * 整合员工注册表和事件历史,提供统一的状态查询接口
 */
export class StateManager {
  private employeeRegistry: EmployeeRegistry
  private eventHistory: EventHistory
  private taskCount: Map<string, number>
  private messageCount: Map<string, number>

  constructor() {
    this.employeeRegistry = new EmployeeRegistry()
    this.eventHistory = new EventHistory()
    this.taskCount = new Map()
    this.messageCount = new Map()
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
   * 注册员工
   */
  registerEmployee(employee: Employee): void {
    this.employeeRegistry.register(employee)
    this.taskCount.set(employee.name, 0)
    this.messageCount.set(employee.name, 0)
  }

  /**
   * 更新员工状态并记录事件
   */
  updateEmployeeStatus(name: string, status: EmployeeStatus): void {
    const employee = this.employeeRegistry.get(name)
    if (!employee) {
      throw new Error(`员工 '${name}' 不存在`)
    }

    const oldStatus = employee.status
    this.employeeRegistry.updateStatus(name, status)

    // 记录状态变化事件
    this.eventHistory.add({
      type: "employee_status_changed",
      timestamp: new Date().toISOString(),
      employeeName: name,
      details: {
        oldStatus,
        newStatus: status,
      },
    })
  }

  /**
   * 添加事件
   */
  addEvent(event: Event): void {
    this.eventHistory.add(event)

    // 更新统计数据
    if (event.type === "message" && event.employeeName) {
      const count = this.messageCount.get(event.employeeName) || 0
      this.messageCount.set(event.employeeName, count + 1)
    }

    if (
      (event.type === "task_completed" || event.type === "task_failed") &&
      event.employeeName
    ) {
      const count = this.taskCount.get(event.employeeName) || 0
      this.taskCount.set(event.employeeName, count + 1)
    }
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
    const activeEmployees = employees.filter(
      (e) => e.status === "active"
    ).length

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
}
