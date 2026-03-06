/**
 * refresh_roles tool
 *
 * Refresh role list, reload all role definitions
 */

import { tool } from "@opencode-ai/plugin"
import type { ProjectInstance } from "../server/ProjectRegistry"

/**
 * Create refresh_roles tool
 *
 * @param project Project instance
 */
export function createRefreshRolesTool(project: ProjectInstance) {
  return tool({
    description:
      "Refresh role list, reload all role definitions from preset, global, and project directories",
    args: {},
    async execute() {
      // 1. Call RoleManager's refresh method
      await project.roleManager.refresh()

      // 2. Refresh system prompts for all running employees
      const refreshPromises: Promise<void>[] = []
      for (const [employeeName, eventLoop] of project.eventLoops.entries()) {
        refreshPromises.push(eventLoop.refreshSystemPrompt())
      }
      await Promise.all(refreshPromises)

      const roleNames = project.roleManager.getRoleNames()
      return `Roles refreshed successfully. Available roles: ${roleNames.join(", ")}. Updated system prompts for ${project.eventLoops.size} running employee(s).`
    },
  })
}
