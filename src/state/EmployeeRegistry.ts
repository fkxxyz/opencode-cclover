import EventEmitter from "eventemitter3"
import type {
  BossId,
  Employee,
  EmployeeId,
  EmployeeName,
  EmployeeWorkSessionId,
} from "../types/index"

/**
 * 员工元数据注册表。
 */
export class EmployeeRegistry {
  private employees: Map<EmployeeId, Employee>
  private emitter: EventEmitter

  constructor() {
    this.employees = new Map()
    this.emitter = new EventEmitter()
  }

  register(employee: Employee): void {
    if (this.employees.has(employee.employeeId)) {
      throw new Error(`员工 '${employee.employeeId}' 已存在`)
    }

    this.employees.set(employee.employeeId, { ...employee })
    this.emitter.emit("employee_registered", employee)
  }

  update(employeeId: EmployeeId, updates: Partial<Employee>): void {
    const employee = this.employees.get(employeeId)
    if (!employee) {
      throw new Error(`员工 '${employeeId}' 不存在`)
    }

    const updated = { ...employee, ...updates }
    this.employees.set(employeeId, updated)
    this.emitter.emit("employee_updated", updated)
  }

  get(employeeId: EmployeeId): Employee | undefined {
    const employee = this.employees.get(employeeId)
    return employee
      ? { ...employee, contextPaths: [...employee.contextPaths] }
      : undefined
  }

  getAll(): Employee[] {
    return Array.from(this.employees.values()).map((employee) => ({
      ...employee,
      contextPaths: [...employee.contextPaths],
    }))
  }

  getByName(name: EmployeeName): Employee[] {
    return this.getAll().filter((employee) => employee.name === name)
  }

  getByRoleId(roleId: string): Employee[] {
    return this.getAll().filter((employee) => employee.roleId === roleId)
  }

  getByHiredBy(hiredBy: EmployeeWorkSessionId | BossId): Employee[] {
    return this.getAll().filter((employee) => employee.hiredBy === hiredBy)
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener)
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener)
  }

  clear(): void {
    this.employees.clear()
  }
}
