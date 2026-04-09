/**
 * show_hireable_roles tool
 *
 * Display roles an employee can hire based on their role's canHire permissions
 */

import { tool } from "@opencode-ai/plugin"
import type { RoleManager } from "../core/RoleManager"
import type { BossManager } from "../core/BossManager"
import type { StateManager } from "../state/StateManager"
import { resolveToolActor } from "../meeting-mode"
import { logger } from "../lib/logger"

export function createShowHireableRolesTool(
  roleManager: RoleManager,
  stateManager: StateManager,
  bossManager?: BossManager
) {
  return tool({
    description:
      "Display roles an employee can hire based on their role's canHire permissions",
    args: {},
    async execute(args, context) {
      try {
        // 1. Get caller identity
        const actor = resolveToolActor(
          context,
          stateManager,
          bossManager,
          roleManager
        )
        const callerName = actor?.actorName
        if (!callerName) {
          return `Error: Unable to identify caller (sessionID: ${context.sessionID}, agent: ${context.agent || "unknown"})`
        }

        // 2. Check if caller is boss
        const isBoss = actor?.hasBossAuthority || false

        // 3. Get hireable roles
        let hireableRoles: string[]
        if (isBoss) {
          // Boss can see all roles
          hireableRoles = roleManager.getRoleNames()
          logger.debug(
            `[ShowHireableRolesTool] Boss '${callerName}' can hire all ${hireableRoles.length} roles`
          )
        } else {
          // Regular employee: get their role from StateManager
          const allEmployees = stateManager.getEmployees()
          const employee = allEmployees.find((e) => e.name === callerName)
          if (!employee) {
            return `Error: Employee '${callerName}' not found`
          }

          const callerRole = roleManager.getRole(employee.role)
          if (!callerRole) {
            return `Error: Cannot find role definition for role '${employee.role}'`
          }

          if (!callerRole.canHire || callerRole.canHire.length === 0) {
            return `You (role: ${callerRole.name}) cannot hire any employees. Your role has no canHire permissions.`
          }

          hireableRoles = roleManager.resolveCanHire(callerRole.canHire)
          logger.debug(
            `[ShowHireableRolesTool] Employee '${callerName}' (role: ${callerRole.name}) can hire ${hireableRoles.length} roles`
          )
        }

        // 4. Format output
        if (hireableRoles.length === 0) {
          return "No roles available to hire."
        }

        const roleDetails = hireableRoles
          .map((roleName) => {
            const role = roleManager.getRole(roleName)
            if (!role) {
              return `- ${roleName}: (role definition not found)`
            }

            let output = `- ${role.name}: ${role.description || "(no description)"}`

            // Add required arguments if any
            if (
              role.requiredArgs &&
              Object.keys(role.requiredArgs).length > 0
            ) {
              output += "\n  Required arguments:"
              for (const [argName, argSpec] of Object.entries(
                role.requiredArgs
              )) {
                output += `\n    - ${argName} (${argSpec.type}): ${argSpec.description}`
              }
            }

            return output
          })
          .join("\n\n")

        const header = isBoss
          ? `You are a boss and can hire any of the ${hireableRoles.length} available roles:\n\n`
          : `You can hire the following ${hireableRoles.length} roles:\n\n`

        return header + roleDetails
      } catch (error: any) {
        logger.error(
          `[ShowHireableRolesTool] Failed to show hireable roles:`,
          error
        )
        return `Failed to show hireable roles: ${error.message}`
      }
    },
  })
}
