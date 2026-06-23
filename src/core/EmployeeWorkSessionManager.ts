import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as lockfile from "proper-lockfile"
import * as yaml from "yaml"
import { RoleManager } from "./RoleManager"
import type { StateManager } from "../state"
import type {
  CloseEmployeeWorkSessionInput,
  CreateEmployeeWorkSessionInput,
  EmployeeWorkSession,
  EmployeeWorkSessionFilters,
  EmployeeWorkSessionId,
  EmployeeWorkSessionStatus,
  Event,
  PromptRecovery,
} from "../types"
import { createEmployeeWorkSessionId } from "../types"

interface EmployeeWorkSessionsFile {
  employeeWorkSessions: EmployeeWorkSession[]
}

export class EmployeeWorkSessionManager {
  private readonly filePath: string
  private readonly roleManager: RoleManager
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly projectPath: string,
    private readonly stateManager: StateManager,
    roleManager?: RoleManager
  ) {
    this.filePath = path.join(
      projectPath,
      ".cclover",
      "employee-work-sessions.yaml"
    )
    this.roleManager = roleManager ?? new RoleManager(projectPath)
  }

  async createEmployeeWorkSession(
    input: CreateEmployeeWorkSessionInput
  ): Promise<EmployeeWorkSession> {
    const employee = this.stateManager.getEmployee(input.employeeId)
    if (!employee) {
      throw new Error(`Employee '${input.employeeId}' does not exist`)
    }

    await this.roleManager.refresh()
    const role = this.roleManager.getRole(employee.roleId)
    if (!role) {
      throw new Error(`Role '${employee.roleId}' does not exist`)
    }
    for (const requiredArgName of Object.keys(role.requiredArgs ?? {})) {
      if (!Object.hasOwn(input.args, requiredArgName)) {
        throw new Error(`Missing required arg '${requiredArgName}'`)
      }
    }

    await this.validateContextPaths(employee.contextPaths)

    const employeeWorkSession = await this.updateEmployeeWorkSessionsStore(
      (employeeWorkSessions) => {
        const parentEmployeeWorkSessionId =
          input.parentEmployeeWorkSessionId ?? null
        if (
          parentEmployeeWorkSessionId &&
          !employeeWorkSessions.some(
            (session) =>
              session.employeeWorkSessionId === parentEmployeeWorkSessionId
          )
        ) {
          throw new Error(
            `Parent employee work session '${parentEmployeeWorkSessionId}' does not exist`
          )
        }

        const now = new Date().toISOString()
        const employeeWorkSession: EmployeeWorkSession = {
          employeeWorkSessionId: createEmployeeWorkSessionId(),
          parentEmployeeWorkSessionId,
          employeeId: input.employeeId,
          opencodeSessionId: null,
          description: input.description,
          args: input.args,
          contextPathsSnapshot: [...employee.contextPaths],
          worktreeRef: input.worktreeRef ?? null,
          status: "offline",
          closedAt: null,
          closedBy: null,
          closeReason: null,
          createdAt: now,
          updatedAt: now,
        }

        return {
          employeeWorkSessions: [...employeeWorkSessions, employeeWorkSession],
          result: employeeWorkSession,
        }
      }
    )
    await this.addLifecycleEvent(
      "employee_work_session_created",
      employeeWorkSession,
      { employeeWorkSession }
    )
    return employeeWorkSession
  }

  async closeEmployeeWorkSession(
    input: CloseEmployeeWorkSessionInput
  ): Promise<EmployeeWorkSession> {
    return await this.updateEmployeeWorkSession(
      input.employeeWorkSessionId,
      (session) => ({
        ...session,
        status: "closed",
        closedAt: new Date().toISOString(),
        closedBy: input.closedBy,
        closeReason: input.reason ?? null,
        updatedAt: new Date().toISOString(),
      }),
      "employee_work_session_closed"
    )
  }

  async getEmployeeWorkSession(
    id: EmployeeWorkSessionId
  ): Promise<EmployeeWorkSession | null> {
    const employeeWorkSessions = await this.loadEmployeeWorkSessions()
    return (
      employeeWorkSessions.find(
        (session) => session.employeeWorkSessionId === id
      ) ?? null
    )
  }

  async listEmployeeWorkSessions(
    filters?: EmployeeWorkSessionFilters
  ): Promise<EmployeeWorkSession[]> {
    const employeeWorkSessions = await this.loadEmployeeWorkSessions()
    if (!filters) {
      return employeeWorkSessions
    }

    return employeeWorkSessions
      .filter(
        (session) =>
          !filters.employeeId || session.employeeId === filters.employeeId
      )
      .filter(
        (session) =>
          !Object.hasOwn(filters, "parentEmployeeWorkSessionId") ||
          session.parentEmployeeWorkSessionId ===
            filters.parentEmployeeWorkSessionId
      )
      .filter((session) => !filters.status || session.status === filters.status)
  }

  async updateStatus(
    id: EmployeeWorkSessionId,
    status: EmployeeWorkSessionStatus
  ): Promise<void> {
    await this.updateEmployeeWorkSession(
      id,
      (session) => ({
        ...session,
        status,
        updatedAt: new Date().toISOString(),
      }),
      "employee_work_session_status_changed"
    )
  }

  async updateOpenCodeSessionId(
    id: EmployeeWorkSessionId,
    opencodeSessionId: string | null
  ): Promise<void> {
    await this.updateEmployeeWorkSession(id, (session) => ({
      ...session,
      opencodeSessionId,
      updatedAt: new Date().toISOString(),
    }))
  }

  async setPromptRecovery(
    id: EmployeeWorkSessionId,
    promptRecovery: PromptRecovery
  ): Promise<void> {
    await this.updateEmployeeWorkSession(id, (session) => ({
      ...session,
      promptRecovery,
      updatedAt: new Date().toISOString(),
    }))
  }

  async clearPromptRecovery(id: EmployeeWorkSessionId): Promise<void> {
    await this.updateEmployeeWorkSession(id, (session) => {
      const { promptRecovery: _promptRecovery, ...rest } = session
      return {
        ...rest,
        updatedAt: new Date().toISOString(),
      }
    })
  }

  private async loadEmployeeWorkSessions(): Promise<EmployeeWorkSession[]> {
    try {
      const content = await fs.readFile(this.filePath, "utf-8")
      const data = yaml.parse(
        content
      ) as Partial<EmployeeWorkSessionsFile> | null
      return Array.isArray(data?.employeeWorkSessions)
        ? data.employeeWorkSessions
        : []
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []
      }
      throw error
    }
  }

  private async ensureStoreFile(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      await fs.access(this.filePath)
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error
      }
      await fs.writeFile(
        this.filePath,
        yaml.stringify({
          employeeWorkSessions: [],
        } satisfies EmployeeWorkSessionsFile),
        "utf-8"
      )
    }
  }

  private async readEmployeeWorkSessionsFromStore(): Promise<
    EmployeeWorkSession[]
  > {
    const content = await fs.readFile(this.filePath, "utf-8")
    const data = yaml.parse(content) as Partial<EmployeeWorkSessionsFile> | null
    return Array.isArray(data?.employeeWorkSessions)
      ? data.employeeWorkSessions
      : []
  }

  private async updateEmployeeWorkSessionsStore<T>(
    update: (employeeWorkSessions: EmployeeWorkSession[]) => {
      employeeWorkSessions: EmployeeWorkSession[]
      result: T
    }
  ): Promise<T> {
    return await this.enqueueStoreUpdate(async () => {
      return await this.updateEmployeeWorkSessionsStoreLocked(update)
    })
  }

  private async updateEmployeeWorkSessionsStoreLocked<T>(
    update: (employeeWorkSessions: EmployeeWorkSession[]) => {
      employeeWorkSessions: EmployeeWorkSession[]
      result: T
    }
  ): Promise<T> {
    await this.ensureStoreFile()

    let release: (() => Promise<void>) | undefined
    try {
      release = await lockfile.lock(this.filePath, {
        retries: {
          retries: 50,
          minTimeout: 100,
          maxTimeout: 2000,
        },
        stale: 5000,
      })
      const employeeWorkSessions =
        await this.readEmployeeWorkSessionsFromStore()
      const updated = update(employeeWorkSessions)
      await fs.writeFile(
        this.filePath,
        yaml.stringify({
          employeeWorkSessions: updated.employeeWorkSessions,
        } satisfies EmployeeWorkSessionsFile),
        "utf-8"
      )
      return updated.result
    } finally {
      if (release) {
        await release()
      }
    }
  }

  private async enqueueStoreUpdate<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.writeQueue
    let releaseQueue!: () => void
    this.writeQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve
    })

    await previous
    try {
      return await operation()
    } finally {
      releaseQueue()
    }
  }

  private async updateEmployeeWorkSession(
    id: EmployeeWorkSessionId,
    update: (session: EmployeeWorkSession) => EmployeeWorkSession,
    eventType?:
      | "employee_work_session_status_changed"
      | "employee_work_session_closed"
  ): Promise<EmployeeWorkSession> {
    const updated = await this.updateEmployeeWorkSessionsStore(
      (employeeWorkSessions) => {
        const index = employeeWorkSessions.findIndex(
          (session) => session.employeeWorkSessionId === id
        )
        if (index === -1) {
          throw new Error(`Employee work session '${id}' does not exist`)
        }

        const updated = update(employeeWorkSessions[index])
        const nextEmployeeWorkSessions = [...employeeWorkSessions]
        nextEmployeeWorkSessions[index] = updated
        return {
          employeeWorkSessions: nextEmployeeWorkSessions,
          result: updated,
        }
      }
    )

    if (eventType) {
      await this.addLifecycleEvent(eventType, updated, {
        employeeWorkSession: updated,
      })
    }
    return updated
  }

  private async validateContextPaths(contextPaths: string[]): Promise<void> {
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

  private async addLifecycleEvent(
    type:
      | "employee_work_session_created"
      | "employee_work_session_status_changed"
      | "employee_work_session_closed",
    employeeWorkSession: EmployeeWorkSession,
    details: Record<string, any>
  ): Promise<void> {
    const event: Event = {
      projectId: this.stateManager.getProjectId(),
      type,
      timestamp: new Date().toISOString(),
      employeeWorkSessionId: employeeWorkSession.employeeWorkSessionId,
      employeeId: employeeWorkSession.employeeId,
      details,
    }
    await this.stateManager.addEvent(event)
  }
}
