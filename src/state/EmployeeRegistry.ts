import EventEmitter from "eventemitter3"
import type {
  Employee,
  EmployeeStatus,
  EmployeeId,
  EmployeeName,
  BossId,
} from "../types/index"

/**
 * 员工状态注册表
 * 管理所有员工的状态信息,支持事件发射
 * 使用 employeeId 作为主键
 */
export class EmployeeRegistry {
  private employees: Map<EmployeeId, Employee>
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
    if (this.employees.has(employee.employeeId)) {
      throw new Error(`员工 '${employee.employeeId}' 已存在`)
    }

    this.employees.set(employee.employeeId, { ...employee })
    this.emitter.emit("employee_registered", employee)
  }

  /**
   * 更新员工信息
   */
  update(employeeId: EmployeeId, updates: Partial<Employee>): void {
    const employee = this.employees.get(employeeId)
    if (!employee) {
      throw new Error(`员工 '${employeeId}' 不存在`)
    }

    const updated = { ...employee, ...updates }
    this.employees.set(employeeId, updated)
    this.emitter.emit("employee_updated", updated)
  }

  /**
   * 获取员工
   */
  get(employeeId: EmployeeId): Employee | undefined {
    const employee = this.employees.get(employeeId)
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
  updateStatus(employeeId: EmployeeId, status: EmployeeStatus): void {
    const employee = this.employees.get(employeeId)
    if (!employee) {
      throw new Error(`员工 '${employeeId}' 不存在`)
    }

    const oldStatus = employee.status
    const updated = { ...employee, status }
    this.employees.set(employeeId, updated)
    this.emitter.emit("status_changed", {
      employeeId,
      oldStatus,
      newStatus: status,
    })
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
   * 按员工名称筛选员工
   */
  getByName(name: EmployeeName): Employee[] {
    return Array.from(this.employees.values())
      .filter((e) => e.name === name)
      .map((e) => ({ ...e }))
  }

  /**
   * 按角色 ID 筛选员工
   */
  getByRoleId(roleId: string): Employee[] {
    return Array.from(this.employees.values())
      .filter((e) => e.roleId === roleId)
      .map((e) => ({ ...e }))
  }

  /**
   * 按雇佣来源筛选员工
   */
  getByHiredBy(hiredBy: EmployeeId | BossId): Employee[] {
    return Array.from(this.employees.values())
      .filter((e) => e.hiredBy === hiredBy)
      .map((e) => ({ ...e }))
  }

  /**
   * 按暂停配置筛选员工
   */
  getByPaused(paused: boolean): Employee[] {
    return Array.from(this.employees.values())
      .filter((e) => e.paused === paused)
      .map((e) => ({ ...e }))
  }

  /**
   * 更新员工 paused 配置
   */
  updatePaused(employeeId: EmployeeId, paused: boolean): void {
    const employee = this.employees.get(employeeId)
    if (!employee) {
      throw new Error(`员工 '${employeeId}' 不存在`)
    }

    const updated = { ...employee, paused }
    this.employees.set(employeeId, updated)
    this.emitter.emit("employee_updated", updated)
  }

  /**
   * 更新员工 activeSessionId
   */
  updateActiveSessionId(
    employeeId: EmployeeId,
    sessionId: string | null
  ): void {
    const employee = this.employees.get(employeeId)
    if (!employee) {
      throw new Error(`员工 '${employeeId}' 不存在`)
    }

    const updated = { ...employee, activeSessionId: sessionId }
    this.employees.set(employeeId, updated)
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
