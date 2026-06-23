import EventEmitter from "eventemitter3"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { EmployeePersistence } from "./EmployeePersistence"
import { EmployeeRegistry } from "./EmployeeRegistry"
import { EventHistory } from "./EventHistory"
import { EventLogger, type EventLogOwnerId } from "./EventLogger"
import { logger } from "../lib/logger"
import type {
  BossId,
  Employee,
  EmployeeId,
  EmployeeName,
  EmployeeWorkSessionId,
  Event,
  EventType,
} from "../types/index"
import { isValidEmployeeName } from "../types/index"

/**
 * 统一状态管理器；员工只保存稳定元数据，运行时状态由 EWS 管理。
 */
export class StateManager {
  private projectId: string
  private projectPath: string | undefined
  private employeeRegistry: EmployeeRegistry
  private employeePersistence: EmployeePersistence | null
  private eventHistory: EventHistory
  private eventLogger: EventLogger
  private emitter: EventEmitter

  constructor(
    projectId: string = "default",
    workspaceRoot?: string,
    projectPath?: string
  ) {
    this.projectId = projectId
    this.projectPath = projectPath
    this.employeeRegistry = new EmployeeRegistry()
    this.employeePersistence = projectPath
      ? new EmployeePersistence(projectPath)
      : null
    this.eventHistory = new EventHistory()
    this.eventLogger = new EventLogger(workspaceRoot || "")
    this.emitter = new EventEmitter()
  }

  getEmployees(): Employee[] {
    return this.employeeRegistry.getAll()
  }

  getEmployee(employeeId: EmployeeId): Employee | undefined {
    return this.employeeRegistry.get(employeeId)
  }

  getProjectId(): string {
    return this.projectId
  }

  async registerEmployee(employee: Employee): Promise<void> {
    await this.validateEmployeeMetadata(employee)
    if (this.employeeRegistry.get(employee.employeeId)) {
      throw new Error(`员工 ID '${employee.employeeId}' 已存在`)
    }

    this.employeeRegistry.register(employee)
    await this.persistEmployees()
  }

  async updateEmployee(
    employeeId: EmployeeId,
    updates: Pick<Employee, "name" | "description" | "contextPaths">
  ): Promise<Employee> {
    const employee = this.employeeRegistry.get(employeeId)
    if (!employee) {
      throw new Error(`员工 '${employeeId}' 不存在`)
    }

    const updated: Employee = {
      ...employee,
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    await this.validateEmployeeMetadata(updated)
    this.employeeRegistry.update(employeeId, updated)
    await this.persistEmployees()

    const event: Event = {
      projectId: this.projectId,
      type: "employee_updated",
      timestamp: updated.updatedAt,
      employeeId,
      details: { employee: updated },
    }
    await this.addEvent(event)
    return updated
  }

  async addEvent(event: Event): Promise<void> {
    if (!event.projectId) {
      event.projectId = this.projectId
    }
    this.eventHistory.add(event)

    if (event.employeeWorkSessionId) {
      await this.eventLogger.logEvent(event.employeeWorkSessionId, event)
    } else if (event.employeeId) {
      await this.eventLogger.logEvent(event.employeeId, event)
    }

    if (event.type === "message" && event.details) {
      const from = event.details.from as string
      const to = event.details.to as string
      if (to && to !== from) {
        await this.logEventForResolvedOwner(to, event)
      }
    }

    this.emit("event", event)
  }

  getEvents(options?: {
    limit?: number
    employeeId?: EmployeeId
    employeeWorkSessionId?: EmployeeWorkSessionId
    type?: EventType
  }): Event[] {
    const limit = options?.limit || 50

    return this.eventHistory
      .getAll()
      .filter(
        (event) =>
          !options?.employeeId || event.employeeId === options.employeeId
      )
      .filter(
        (event) =>
          !options?.employeeWorkSessionId ||
          event.employeeWorkSessionId === options.employeeWorkSessionId
      )
      .filter((event) => !options?.type || event.type === options.type)
      .slice(0, limit)
  }

  listEmployeesByName(name: EmployeeName): Employee[] {
    return this.employeeRegistry.getByName(name)
  }

  listEmployeesByRoleId(roleId: string): Employee[] {
    return this.employeeRegistry.getByRoleId(roleId)
  }

  listEmployeesByHiredBy(hiredBy: EmployeeWorkSessionId | BossId): Employee[] {
    return this.employeeRegistry.getByHiredBy(hiredBy)
  }

  getStats(): {
    totalEmployees: number
    activeEmployees: number
    pendingTasks: number
    todayMessages: number
  } {
    const employees = this.employeeRegistry.getAll()
    const now = new Date()
    const todayStart = new Date(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
    const todayMessages = this.eventHistory.getAll().filter((event) => {
      const eventTime = new Date(event.timestamp)
      return event.type === "message" && eventTime >= todayStart
    }).length

    return {
      totalEmployees: employees.length,
      activeEmployees: 0,
      pendingTasks: 0,
      todayMessages,
    }
  }

  onEmployeeEvent(event: string, listener: (...args: any[]) => void): void {
    this.employeeRegistry.on(event, listener)
  }

  offEmployeeEvent(event: string, listener: (...args: any[]) => void): void {
    this.employeeRegistry.off(event, listener)
  }

  clear(): void {
    this.employeeRegistry.clear()
    this.eventHistory.clear()
  }

  getEventLogger(): EventLogger {
    return this.eventLogger
  }

  async loadHistoricalEvents(): Promise<void> {
    const employees = this.employeeRegistry.getAll()

    for (const employee of employees) {
      try {
        const events = await this.eventLogger.getEvents(
          employee.employeeId,
          1000
        )
        for (const event of events) {
          this.eventHistory.add(event)
        }
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          console.warn(
            `Failed to load events for employee ${employee.employeeId}:`,
            error.message
          )
        }
      }
    }
  }

  on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener)
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener)
  }

  emit(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args)
  }

  async loadEmployees(): Promise<void> {
    if (!this.employeePersistence) {
      return
    }
    const employees = await this.employeePersistence.load()
    logger.debug(
      `[StateManager] loadEmployees: loaded ${employees.length} employees from persistence`
    )
    for (const employee of employees) {
      if (!this.employeeRegistry.get(employee.employeeId)) {
        this.employeeRegistry.register(employee)
      }
    }
  }

  private async validateEmployeeMetadata(employee: Employee): Promise<void> {
    if (!isValidEmployeeName(employee.name)) {
      throw new Error(`员工名称 '${employee.name}' 格式无效，不能以数字-开头`)
    }
    if (employee.description.trim().length === 0) {
      throw new Error("Employee description must be non-empty")
    }
    await this.validateContextPaths(employee.contextPaths)
  }

  private async validateContextPaths(contextPaths: string[]): Promise<void> {
    if (!this.projectPath) {
      return
    }

    for (const contextPath of contextPaths) {
      if (path.isAbsolute(contextPath)) {
        throw new Error(
          `Context path '${contextPath}' must be project-relative`
        )
      }
      if (/[\*\?\[\]\{\}]/.test(contextPath)) {
        throw new Error(
          `Context path '${contextPath}' must not contain glob patterns`
        )
      }

      const resolved = path.resolve(this.projectPath, contextPath)
      const relative = path.relative(this.projectPath, resolved)
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(
          `Context path '${contextPath}' must stay inside project root`
        )
      }

      let stat
      try {
        stat = await fs.stat(resolved)
      } catch (error: any) {
        if (error.code === "ENOENT") {
          throw new Error(
            `Context path '${contextPath}' must exist and be readable`
          )
        }
        throw error
      }
      if (!stat.isFile()) {
        throw new Error(
          `Context path '${contextPath}' must be a readable file, not a directory`
        )
      }
      try {
        await fs.access(resolved, fs.constants.R_OK)
      } catch {
        throw new Error(
          `Context path '${contextPath}' must exist and be readable`
        )
      }
    }
  }

  private async persistEmployees(): Promise<void> {
    if (this.employeePersistence) {
      await this.employeePersistence.save(this.employeeRegistry.getAll())
    }
  }

  private async logEventForResolvedOwner(
    ownerId: string,
    event: Event
  ): Promise<void> {
    if (this.isEventLogOwnerId(ownerId)) {
      await this.eventLogger.logEvent(ownerId, event)
    }
  }

  private isEventLogOwnerId(ownerId: string): ownerId is EventLogOwnerId {
    return (
      ownerId.startsWith("emp_") ||
      ownerId.startsWith("ews_") ||
      ownerId.startsWith("boss_")
    )
  }
}
