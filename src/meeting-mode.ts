import type { BossManager } from "./core/BossManager"
import type { RoleManager } from "./core/RoleManager"
import type { Role } from "./types"
import { formatBossId } from "./types"
import type { StateManager } from "./state/StateManager"
import { sessionRegistry } from "./utils/SessionRegistry"
import { buildMeetingModeSystemPrompt } from "./utils/ContextBuilder"

export interface MeetingModePrimaryAgentDefinition {
  prompt: string
  mode: "primary"
  description: string
}

export interface ResolvedToolActor {
  actorName: string
  actorEmployeeId: string
  actorType: "boss" | "meeting-role" | "employee"
  isBoss: boolean
  hasBossAuthority: boolean
  projectedRoleName?: string
}

const MEETING_MODE_AUGMENTATION = `## Meeting Context

The boss is personally talking with you.

This is a direct working meeting with the boss.

- discuss matters collaboratively and frankly
- preserve your role specialization and perspective
- you have full authority to organize work during this interaction
- normal hiring restrictions are lifted for this interaction
- if required staff are missing, hire them immediately and proceed`

export function composeMeetingModePrompt(systemPrompt: string): string {
  return `${systemPrompt.trim()}\n\n${MEETING_MODE_AUGMENTATION}`
}

export function buildMeetingModePrimaryAgents(
  roleManager: RoleManager
): Record<string, MeetingModePrimaryAgentDefinition> {
  const agents: Record<string, MeetingModePrimaryAgentDefinition> = {}

  for (const role of roleManager.getAllRoles()) {
    agents[role.name] = {
      prompt: buildMeetingModeSystemPrompt(
        role.systemPrompt,
        MEETING_MODE_AUGMENTATION,
        role
      ),
      mode: "primary",
      description: getMeetingModeAgentDescription(role),
    }
  }

  return agents
}

export function isMeetingModeProjectedAgent(
  roleManager: RoleManager | undefined,
  agentName: string | undefined,
  bossManager?: BossManager
): boolean {
  if (!roleManager || !agentName) {
    return false
  }

  if (bossManager?.isBoss(agentName)) {
    return false
  }

  return roleManager.getRole(agentName) !== undefined
}

export function resolveToolActor(
  context: { sessionID: string; agent?: string },
  stateManager?: StateManager,
  bossManager?: BossManager,
  roleManager?: RoleManager
): ResolvedToolActor | undefined {
  const employeeId = sessionRegistry.getEmployeeId(context.sessionID)
  if (employeeId) {
    if (!stateManager) {
      return {
        actorName: employeeId,
        actorEmployeeId: employeeId,
        actorType: "employee",
        isBoss: false,
        hasBossAuthority: false,
      }
    }

    const employee = stateManager.getEmployee(employeeId)
    if (!employee) {
      return undefined
    }

    return {
      actorName: employee.name,
      actorEmployeeId: employee.employeeId,
      actorType: bossManager?.isBoss(employee.name) ? "boss" : "employee",
      isBoss: bossManager?.isBoss(employee.name) || false,
      hasBossAuthority: bossManager?.isBoss(employee.name) || false,
    }
  }

  if (context.agent && bossManager?.isBoss(context.agent)) {
    return {
      actorName: context.agent,
      actorEmployeeId: formatBossId(context.agent),
      actorType: "boss",
      isBoss: true,
      hasBossAuthority: true,
    }
  }

  if (
    context.agent &&
    isMeetingModeProjectedAgent(roleManager, context.agent, bossManager)
  ) {
    const sessionBoss = bossManager?.getBossBySession(context.sessionID)

    let bossId: string
    if (sessionBoss) {
      bossId = formatBossId(sessionBoss)
    } else if (bossManager) {
      // Fallback: 如果只有一个 Boss，使用这个 Boss
      const bosses = bossManager.getBosses()
      if (bosses.length === 1) {
        bossId = formatBossId(bosses[0])
      } else if (bosses.length === 0) {
        throw new Error(
          `Meeting mode role "${context.agent}" requires at least one Boss in configuration`
        )
      } else {
        throw new Error(
          `Meeting mode role "${context.agent}" cannot determine which Boss is using it. ` +
            `Multiple Bosses configured: ${bosses.join(", ")}. ` +
            `Please send a message as Boss first to establish session mapping.`
        )
      }
    } else {
      throw new Error(
        `Meeting mode role "${context.agent}" requires BossManager to be configured`
      )
    }

    return {
      actorName: context.agent,
      actorEmployeeId: bossId,
      actorType: "meeting-role",
      isBoss: false,
      hasBossAuthority: true,
      projectedRoleName: context.agent,
    }
  }

  return undefined
}

function getMeetingModeAgentDescription(role: Role): string {
  const description = role.description?.trim()

  if (description) {
    return description
  }

  const firstLine = role.systemPrompt
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0)

  return firstLine || `Role: ${role.name}`
}
