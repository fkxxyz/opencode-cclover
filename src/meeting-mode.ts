import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { BossManager } from "./core/BossManager"
import type { EmployeeWorkSessionManager } from "./core/EmployeeWorkSessionManager"
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

export interface MeetingModeAgentBuildOptions {
  useDynamicPromptInjection?: boolean
}

export interface ResolvedToolActor {
  actorName: string
  actorEmployeeId: string
  actorEmployeeWorkSessionId?: string
  actorType: "boss" | "meeting-role" | "employee"
  isBoss: boolean
  hasBossAuthority: boolean
  projectedRoleName?: string
}

let cachedMeetingModeAugmentation: string | null = null

async function loadMeetingModeAugmentation(): Promise<string> {
  if (cachedMeetingModeAugmentation !== null) {
    return cachedMeetingModeAugmentation
  }

  const specPath = path.join(__dirname, "meeting-mode", "specification.md")
  try {
    cachedMeetingModeAugmentation = await fs.readFile(specPath, "utf-8")
    return cachedMeetingModeAugmentation
  } catch (error: any) {
    // Fallback to legacy inline prompt if specification file is missing
    cachedMeetingModeAugmentation = `## Meeting Context

The boss is personally talking with you.

This is a direct working meeting with the boss.

- discuss matters collaboratively and frankly
- preserve your role specialization and perspective
- you have full authority to organize work during this interaction
- normal hiring restrictions are lifted for this interaction
- if required staff are missing, hire them immediately and proceed`
    return cachedMeetingModeAugmentation
  }
}

export async function getMeetingModeAugmentation(): Promise<string> {
  return loadMeetingModeAugmentation()
}

export function composeMeetingModePrompt(
  systemPrompt: string,
  augmentation: string
): string {
  return `${systemPrompt.trim()}\n\n${augmentation}`
}

export async function buildMeetingModePrimaryAgents(
  roleManager: RoleManager,
  options?: MeetingModeAgentBuildOptions
): Promise<Record<string, MeetingModePrimaryAgentDefinition>> {
  const agents: Record<string, MeetingModePrimaryAgentDefinition> = {}
  const useDynamicPromptInjection = options?.useDynamicPromptInjection ?? false
  const augmentation = await getMeetingModeAugmentation()

  for (const role of roleManager.getAllRoles()) {
    agents[role.name] = {
      prompt: useDynamicPromptInjection
        ? buildMeetingModePlaceholderPrompt(role.name)
        : buildMeetingModeSystemPrompt(role.systemPrompt, augmentation, role),
      mode: "primary",
      description: getMeetingModeAgentDescription(role),
    }
  }

  return agents
}

export function buildMeetingModePlaceholderPrompt(roleName: string): string {
  return [
    `# Meeting Mode Placeholder: ${roleName}`,
    "",
    "Meeting mode prompt is injected dynamically by experimental.chat.system.transform.",
    "If dynamic injection is unavailable, the plugin will degrade to static prompt registration after reload.",
  ].join("\n")
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
  roleManager?: RoleManager,
  employeeWorkSessionManager?: EmployeeWorkSessionManager
): ResolvedToolActor | undefined {
  // 1. Check if sessionID maps to an EWS
  const employeeWorkSessionId = sessionRegistry.getEmployeeWorkSessionId(
    context.sessionID
  )
  if (employeeWorkSessionId) {
    if (!stateManager) {
      return {
        actorName: employeeWorkSessionId,
        actorEmployeeId: employeeWorkSessionId,
        actorEmployeeWorkSessionId: employeeWorkSessionId,
        actorType: "employee",
        isBoss: false,
        hasBossAuthority: false,
      }
    }

    return {
      actorName: employeeWorkSessionId,
      actorEmployeeId: employeeWorkSessionId,
      actorEmployeeWorkSessionId: employeeWorkSessionId,
      actorType: "employee",
      isBoss: false,
      hasBossAuthority: false,
    }
  }

  // 2. Check if context.agent exactly matches a configured Boss ID
  if (context.agent && bossManager?.isBoss(context.agent)) {
    return {
      actorName: context.agent,
      actorEmployeeId: formatBossId(context.agent),
      actorType: "boss",
      isBoss: true,
      hasBossAuthority: true,
    }
  }

  // 3. Check if context.agent exactly matches a role display name (meeting-mode)
  if (context.agent && roleManager) {
    const role = roleManager.getRole(context.agent)
    if (role) {
      const bossId = formatBossId(role.id)
      return {
        actorName: context.agent,
        actorEmployeeId: bossId,
        actorType: "meeting-role",
        isBoss: false,
        hasBossAuthority: true,
        projectedRoleName: context.agent,
      }
    }
  }

  // 4. No valid actor found
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
