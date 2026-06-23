import { tool } from "@opencode-ai/plugin"
import type { BossManager } from "../core/BossManager"
import type { RoleManager } from "../core/RoleManager"
import type { StateManager } from "../state/StateManager"
import type { Employee, EmployeeWorkSessionId } from "../types"
import { createEmployeeId } from "../types"
import { resolveToolActor } from "../meeting-mode"

export function createHireEmployeeTool(
  stateManager: StateManager,
  roleManager: RoleManager,
  project?: any,
  bossManager?: BossManager
) {
  return tool({
    description:
      "Create employee metadata only; use create_employee_work_session to start runtime work",
    args: {
      role_id: tool.schema.string().describe("Role ID/name for the employee"),
      name: tool.schema.string().describe("Employee name"),
      description: tool.schema
        .string()
        .describe("Employee metadata description"),
      context_paths: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe("Project-relative context paths"),
    },
    async execute(args, context) {
      const actor = resolveToolActor(
        context,
        stateManager,
        bossManager,
        roleManager
      )
      const hiredBy =
        actor?.actorEmployeeWorkSessionId ?? actor?.actorEmployeeId
      if (!hiredBy) {
        return `Error: Unable to identify caller (sessionID: ${context.sessionID}, agent: ${context.agent || "unknown"})`
      }
      const caller = actor!
      const role = roleManager.getRole(args.role_id)
      if (!role) {
        return `Error: Role '${args.role_id}' does not exist. Use show_hireable_roles tool to see available roles.`
      }
      if (typeof args.name !== "string") {
        return "Error: Employee name is required"
      }
      const name = args.name.trim()
      if (name.length === 0) {
        return "Error: Employee name cannot be empty or whitespace"
      }
      if (!caller.hasBossAuthority) {
        const hiringEmployee = await resolveHiringEmployee(
          caller,
          stateManager,
          project
        )
        if (
          !hiringEmployee ||
          !roleManager.canHire(hiringEmployee.roleId, args.role_id)
        ) {
          return `Error: You do not have permission to hire role '${args.role_id}'. Use show_hireable_roles tool to see roles you can hire.`
        }
      }
      if (args.description.trim().length === 0) {
        return "Error: Employee description cannot be empty or whitespace"
      }
      if (
        stateManager.getEmployees().some((employee) => employee.name === name)
      ) {
        return `Error: Employee name '${name}' already exists`
      }
      const employeeId = createEmployeeId()
      await stateManager.registerEmployee({
        employeeId,
        name,
        roleId: args.role_id,
        description: args.description.trim(),
        contextPaths: args.context_paths ?? [],
        hiredBy: hiredBy as EmployeeWorkSessionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      await stateManager.addEvent({
        projectId: stateManager.getProjectId(),
        type: "employee_hired",
        timestamp: new Date().toISOString(),
        employeeId,
        details: { hiredBy, roleId: args.role_id },
      })
      return `Successfully created employee metadata '${employeeId}' (name: ${name}), role: ${args.role_id}`
    },
  })
}

async function resolveHiringEmployee(
  actor: NonNullable<ReturnType<typeof resolveToolActor>>,
  stateManager: StateManager,
  project?: any
): Promise<Employee | null> {
  if (actor.actorEmployeeWorkSessionId?.startsWith("ews_")) {
    const employeeWorkSession =
      await project?.employeeWorkSessionManager?.getEmployeeWorkSession(
        actor.actorEmployeeWorkSessionId
      )
    if (employeeWorkSession) {
      return stateManager.getEmployee(employeeWorkSession.employeeId) ?? null
    }
  }

  return stateManager.getEmployee(actor.actorEmployeeId as any) ?? null
}
