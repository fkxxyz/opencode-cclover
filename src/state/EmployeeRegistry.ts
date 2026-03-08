import EventEmitter from "eventemitter3"
import type { Employee, EmployeeStatus } from "../types/index"

/**
 * 员工状态注册表
 * 管理所有员工的状态信息,支持事件发射
 */
export class EmployeeRegistry {
  private employees: Map<string, Employee>
  private emitter: EventEmitter

  constructor() {
    this.employees = new Map()
    this.emitter = new EventEmitter()
  }

  /**
   * 注册员工
   */
  register(employee: Employee): void {
    // 检查员工是否已存在
    if (this.employees.has(employee.name)) {
      throw new Error(`员工 '${employee.name}' 已存在`)
    }

    this.employees.set(employee.name, { ...employee })
    this.emitter.emit("employee_registered", employee)
  }

  /**
   * 更新员工信息
   */
  update(name: string, updates: Partial<Employee>): void {
    const employee = this.employees.get(name)
    if (!employee) {
      throw new Error(`员工 '${name}' 不存在`)
    }

    const updated = { ...employee, ...updates }
    this.employees.set(name, updated)
    this.emitter.emit("employee_updated", updated)
  }

  /**
   * 获取员工
   */
  get(name: string): Employee | undefined {
    const employee = this.employees.get(name)
    return employee ? { ...employee } : undefined
  }

  /**
   * 获取所有员工
   */
  getAll(): Employee[] {
    return Array.from(this.employees.values()).map((e) => ({ ...e }))
  }

  /**
   * 更新员工状态
   */
  updateStatus(name: string, status: EmployeeStatus): void {
    const employee = this.employees.get(name)
    if (!employee) {
      throw new Error(`员工 '${name}' 不存在`)
    }

    const oldStatus = employee.status
    const updated = { ...employee, status }
    this.employees.set(name, updated)
    this.emitter.emit("status_changed", { name, oldStatus, newStatus: status })
  }

  /**
   * 按状态筛选员工
   */
  getByStatus(status: EmployeeStatus): Employee[] {
    return Array.from(this.employees.values())
      .filter((e) => e.status === status)
      .map((e) => ({ ...e }))
  }

  /**
   * 更新员工 paused 配置
   */
  updatePaused(name: string, paused: boolean): void {
    const employee = this.employees.get(name)
    if (!employee) {
      throw new Error(`员工 '${name}' 不存在`)
    }

    const updated = { ...employee, paused }
    this.employees.set(name, updated)
    this.emitter.emit("employee_updated", updated)
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
   * 清空所有员工
   */
  clear(): void {
    this.employees.clear()
  }
}
