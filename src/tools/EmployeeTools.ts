import type { OpencodeClient } from "@opencode-ai/sdk"
import { tool } from "@opencode-ai/plugin"
import type { BossManager } from "../core/BossManager"
import { EventLoop } from "../core/eventloop"
import type { EmployeeWorkSessionManager } from "../core/EmployeeWorkSessionManager"
import type { MemoryManager } from "../core/MemoryManager"
import type { RoleManager } from "../core/RoleManager"
import type { ProjectInstance } from "../server/ProjectRegistry"
import type { StateManager } from "../state/StateManager"
import type { Employee, EmployeeId, EmployeeWorkSessionId } from "../types"
import { resolveToolActor } from "../meeting-mode"

function getActorId(actor: ReturnType<typeof resolveToolActor>): string | null {
  return actor?.actorEmployeeWorkSessionId ?? actor?.actorEmployeeId ?? null
}

function isBossActor(actor: ReturnType<typeof resolveToolActor>): boolean {
  return actor?.hasBossAuthority === true
}

async function getActorEmployee(
  actor: ReturnType<typeof resolveToolActor>,
  stateManager: StateManager,
  employeeWorkSessionManager: EmployeeWorkSessionManager
): Promise<Employee | null> {
  const ewsId = actor?.actorEmployeeWorkSessionId
  if (!ewsId) {
    return null
  }
  const ews = await employeeWorkSessionManager.getEmployeeWorkSession(
    ewsId as EmployeeWorkSessionId
  )
  return ews ? (stateManager.getEmployee(ews.employeeId) ?? null) : null
}

async function getSupervisorEmployee(
  employee: Employee,
  stateManager: StateManager,
  employeeWorkSessionManager: EmployeeWorkSessionManager
): Promise<Employee | null> {
  if (!employee.hiredBy?.startsWith("ews_")) {
    return null
  }
  const supervisorEws = await employeeWorkSessionManager.getEmployeeWorkSession(
    employee.hiredBy as EmployeeWorkSessionId
  )
  return supervisorEws
    ? (stateManager.getEmployee(supervisorEws.employeeId) ?? null)
    : null
}

async function canAccessEmployee(
  employeeId: EmployeeId,
  actor: ReturnType<typeof resolveToolActor>,
  stateManager: StateManager,
  roleManager: RoleManager,
  employeeWorkSessionManager: EmployeeWorkSessionManager
): Promise<boolean> {
  if (isBossActor(actor)) {
    return true
  }
  const actorEmployee = await getActorEmployee(
    actor,
    stateManager,
    employeeWorkSessionManager
  )
  const targetEmployee = stateManager.getEmployee(employeeId)
  if (!actorEmployee || !targetEmployee) {
    return false
  }
  const supervisorEmployee = await getSupervisorEmployee(
    actorEmployee,
    stateManager,
    employeeWorkSessionManager
  )
  return (
    roleManager.canHire(actorEmployee.roleId, targetEmployee.roleId) ||
    supervisorEmployee?.employeeId === targetEmployee.employeeId
  )
}

async function visibleEmployees(
  actor: ReturnType<typeof resolveToolActor>,
  stateManager: StateManager,
  roleManager: RoleManager,
  employeeWorkSessionManager: EmployeeWorkSessionManager
): Promise<Employee[]> {
  const employees = stateManager.getEmployees()
  if (isBossActor(actor)) {
    return employees
  }
  const actorEmployee = await getActorEmployee(
    actor,
    stateManager,
    employeeWorkSessionManager
  )
  if (!actorEmployee) {
    return []
  }
  const supervisorEmployee = await getSupervisorEmployee(
    actorEmployee,
    stateManager,
    employeeWorkSessionManager
  )
  return employees.filter(
    (employee) =>
      roleManager.canHire(actorEmployee.roleId, employee.roleId) ||
      supervisorEmployee?.employeeId === employee.employeeId
  )
}

async function startEmployeeWorkSessionRuntime(
  project: ProjectInstance,
  employeeWorkSessionId: EmployeeWorkSessionId,
  employeeId: EmployeeId,
  roleName: string,
  memoryManager: MemoryManager,
  employeeWorkSessionManager: EmployeeWorkSessionManager,
  opcodeClient: OpencodeClient
): Promise<void> {
  if (project.eventLoops.has(employeeWorkSessionId)) {
    return
  }
  const messageClient = project.messageService.getClient(employeeWorkSessionId)
  const eventLoop = new EventLoop(
    project.directory,
    employeeWorkSessionId,
    employeeId,
    roleName,
    project.roleManager,
    messageClient,
    memoryManager,
    opcodeClient,
    project.modelConfigManager,
    employeeWorkSessionManager,
    project.stateManager
  )
  project.eventLoops.set(employeeWorkSessionId, eventLoop)
  eventLoop.run().catch((error: any) => {
    console.error(`[${employeeWorkSessionId}] EventLoop crashed:`, error)
  })
}

export function createUpdateEmployeeTool(
  stateManager: StateManager,
  roleManager: RoleManager,
  employeeWorkSessionManager: EmployeeWorkSessionManager,
  bossManager?: BossManager
) {
  return tool({
    description:
      "Update employee metadata fields: name, description, context_paths",
    args: {
      employee_id: tool.schema.string().describe("Employee metadata ID"),
      fields: tool.schema
        .object({
          name: tool.schema.string().optional().describe("Employee name"),
          description: tool.schema
            .string()
            .optional()
            .describe("Employee description"),
          context_paths: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("Project-relative context paths"),
        })
        .describe("Mutable employee metadata fields"),
    },
    async execute(args, context) {
      const actor = resolveToolActor(
        context,
        stateManager,
        bossManager,
        roleManager
      )
      const employeeId = args.employee_id as EmployeeId
      if (
        !(await canAccessEmployee(
          employeeId,
          actor,
          stateManager,
          roleManager,
          employeeWorkSessionManager
        ))
      ) {
        return `Error: You do not have permission to update employee '${employeeId}'`
      }
      const employee = stateManager.getEmployee(employeeId)
      if (!employee) {
        return `Error: Employee '${employeeId}' does not exist`
      }
      const updated = await stateManager.updateEmployee(employeeId, {
        name: args.fields.name ?? employee.name,
        description: args.fields.description ?? employee.description,
        contextPaths: args.fields.context_paths ?? employee.contextPaths,
      })
      return JSON.stringify(updated, null, 2)
    },
  })
}

export function createShowAvailableEmployeesTool(
  stateManager: StateManager,
  roleManager: RoleManager,
  employeeWorkSessionManager: EmployeeWorkSessionManager,
  bossManager?: BossManager
) {
  return tool({
    description:
      "Show employee metadata records available for creating employee work sessions",
    args: {},
    async execute(_args, context) {
      const actor = resolveToolActor(
        context,
        stateManager,
        bossManager,
        roleManager
      )
      const employees = await visibleEmployees(
        actor,
        stateManager,
        roleManager,
        employeeWorkSessionManager
      )
      return JSON.stringify(
        {
          available_employees: employees.map((employee) => ({
            employee_id: employee.employeeId,
            name: employee.name,
            role_id: employee.roleId,
            description: employee.description,
            context_paths: employee.contextPaths,
          })),
        },
        null,
        2
      )
    },
  })
}

export function createCreateEmployeeWorkSessionTool(
  project: ProjectInstance,
  roleManager: RoleManager,
  memoryManager: MemoryManager,
  employeeWorkSessionManager: EmployeeWorkSessionManager,
  opcodeClient: OpencodeClient
) {
  return tool({
    description:
      "Create and start an employee work session for an employee metadata record",
    args: {
      employee_id: tool.schema.string().describe("Employee metadata ID"),
      description: tool.schema.string().describe("Initial work description"),
      args: tool.schema
        .record(tool.schema.string(), tool.schema.any())
        .describe("Role arguments for this EWS"),
      parent_employee_work_session_id: tool.schema
        .string()
        .optional()
        .describe("Parent EWS ID"),
      worktree_ref: tool.schema
        .string()
        .optional()
        .describe("Worktree reference"),
    },
    async execute(args, context) {
      const actor = resolveToolActor(
        context,
        project.stateManager,
        project.bossManager,
        roleManager
      )
      const actorId = getActorId(actor)
      if (!actorId) {
        return `Error: Unable to identify caller (sessionID: ${context.sessionID})`
      }
      const employeeId = args.employee_id as EmployeeId
      if (
        !(await canAccessEmployee(
          employeeId,
          actor,
          project.stateManager,
          roleManager,
          employeeWorkSessionManager
        ))
      ) {
        return `Error: You do not have permission to create an employee work session for '${employeeId}'`
      }
      const ews = await employeeWorkSessionManager.createEmployeeWorkSession({
        employeeId,
        description: args.description,
        args: args.args,
        parentEmployeeWorkSessionId:
          (args.parent_employee_work_session_id as EmployeeWorkSessionId) ??
          null,
        worktreeRef: args.worktree_ref ?? null,
        createdBy: actorId as EmployeeWorkSessionId,
      })
      await memoryManager.write(ews.employeeWorkSessionId, {
        knowledge: [],
        tasks: [],
        args: args.args,
        roleData: {},
      })
      await startEmployeeWorkSessionRuntime(
        project,
        ews.employeeWorkSessionId,
        employeeId,
        project.stateManager.getEmployee(employeeId)!.roleId,
        memoryManager,
        employeeWorkSessionManager,
        opcodeClient
      )
      await project.messageService.send(
        actorId as EmployeeWorkSessionId,
        ews.employeeWorkSessionId,
        args.description,
        undefined,
        false,
        false
      )
      return `Created employee work session ${ews.employeeWorkSessionId}`
    },
  })
}

export function createShowEmployeeWorkSessionsTool(
  stateManager: StateManager,
  roleManager: RoleManager,
  employeeWorkSessionManager: EmployeeWorkSessionManager,
  bossManager?: BossManager
) {
  return tool({
    description: "Show visible employee work session records",
    args: {},
    async execute(_args, context) {
      const actor = resolveToolActor(
        context,
        stateManager,
        bossManager,
        roleManager
      )
      const employees = await visibleEmployees(
        actor,
        stateManager,
        roleManager,
        employeeWorkSessionManager
      )
      const visibleEmployeeIds = new Set(
        employees.map((employee) => employee.employeeId)
      )
      const sessions =
        await employeeWorkSessionManager.listEmployeeWorkSessions()
      return JSON.stringify(
        {
          employee_work_sessions: sessions.filter((session) =>
            visibleEmployeeIds.has(session.employeeId)
          ),
        },
        null,
        2
      )
    },
  })
}

export function createCloseEmployeeWorkSessionTool(
  project: ProjectInstance,
  roleManager: RoleManager,
  employeeWorkSessionManager: EmployeeWorkSessionManager
) {
  return tool({
    description:
      "Close an employee work session and stop its runtime if present",
    args: {
      employee_work_session_id: tool.schema
        .string()
        .describe("Employee work session ID"),
      reason: tool.schema.string().optional().describe("Close reason"),
    },
    async execute(args, context) {
      const actor = resolveToolActor(
        context,
        project.stateManager,
        project.bossManager,
        roleManager
      )
      const actorId = getActorId(actor)
      if (!actorId) {
        return `Error: Unable to identify caller (sessionID: ${context.sessionID})`
      }
      const employeeWorkSessionId =
        args.employee_work_session_id as EmployeeWorkSessionId
      const session = await employeeWorkSessionManager.getEmployeeWorkSession(
        employeeWorkSessionId
      )
      if (!session) {
        return `Error: Employee work session '${employeeWorkSessionId}' does not exist`
      }
      if (
        !(await canAccessEmployee(
          session.employeeId,
          actor,
          project.stateManager,
          roleManager,
          employeeWorkSessionManager
        ))
      ) {
        return `Error: You do not have permission to close '${employeeWorkSessionId}'`
      }
      const eventLoop = project.eventLoops.get(employeeWorkSessionId)
      eventLoop?.stop?.()
      project.eventLoops.delete(employeeWorkSessionId)
      const closed = await employeeWorkSessionManager.closeEmployeeWorkSession({
        employeeWorkSessionId,
        closedBy: actorId as EmployeeWorkSessionId,
        reason: args.reason,
      })
      return JSON.stringify(closed, null, 2)
    },
  })
}

export { canAccessEmployee }
