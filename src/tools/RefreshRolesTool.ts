/**
 * refresh_roles tool
 *
 * Refresh role list, reload all role definitions
 */

import { tool } from "@opencode-ai/plugin"
import type { ProjectInstance } from "../server/ProjectRegistry"
// import { getPluginConfig } from "../index"
import { buildMeetingModePrimaryAgents } from "../meeting-mode"
import { logger } from "../lib/logger"

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

      // TODO 需要其它方式来实现
      // 3. Update meeting-mode agent registrations
      // const config = getPluginConfig()
      // if (config && config.agent) {
      //   // 保留非 meeting-mode agents (cclover-empty-agent 和 src/agents/*.md)
      //   const preservedAgents: Record<string, any> = {}
      //   for (const [agentName, definition] of Object.entries(
      //     config.agent as Record<string, any>
      //   )) {
      //     // 保留 cclover-empty-agent
      //     if (agentName === "cclover-empty-agent") {
      //       preservedAgents[agentName] = definition
      //       continue
      //     }
      //     // 保留 src/agents/*.md agents (mode: "primary" 但不在 roleManager 中)
      //     const agentDef = definition as any
      //     if (
      //       agentDef.mode === "primary" &&
      //       !project.roleManager.getRole(agentName)
      //     ) {
      //       preservedAgents[agentName] = definition
      //     }
      //   }

      //   // 重建 meeting-mode agents
      //   const meetingModeAgents = buildMeetingModePrimaryAgents(
      //     project.roleManager
      //   )

      //   // 合并保留的 agents 和新的 meeting-mode agents
      //   config.agent = {
      //     ...preservedAgents,
      //     ...meetingModeAgents,
      //   }

      //   logger.debug(
      //     `[Cclover] Updated meeting-mode agents: ${Object.keys(meetingModeAgents).join(", ")}`
      //   )
      // }

      const roleNames = project.roleManager.getRoleNames()
      return `Roles refreshed successfully. Available roles: ${roleNames.join(", ")}. Updated system prompts for ${project.eventLoops.size} running employee(s) and meeting-mode agent registrations.`
    },
  })
}
