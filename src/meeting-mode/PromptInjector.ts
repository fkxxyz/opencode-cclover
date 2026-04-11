import type { RoleManager } from "../core/RoleManager"
import { logger } from "../lib/logger"
import { buildMeetingModeSystemPrompt } from "../utils/ContextBuilder"
import {
  isMeetingModeProjectedAgent,
  MEETING_MODE_AUGMENTATION,
} from "../meeting-mode"

const FAILURE_WINDOW_MS = 5 * 60 * 1000
const MAX_CONSECUTIVE_FAILURES = 3

interface HookExecutionRecord {
  timestamp: number
  success: boolean
}

/**
 * Meeting-mode dynamic prompt injector
 *
 * Experimental workaround: use experimental.chat.system.transform to override
 * meeting-mode system prompt per request so refresh_roles can take effect
 * immediately without restarting OpenCode.
 */
export class MeetingModePromptInjector {
  private readonly sessionAgents = new Map<string, string>()
  private readonly executionHistory: HookExecutionRecord[] = []
  private consecutiveFailures = 0
  private hookEnabled = true
  private disableReason?: string

  constructor(
    private readonly projectId: string,
    private readonly projectName: string
  ) {}

  isHookEnabled(): boolean {
    return this.hookEnabled
  }

  getDisableReason(): string | undefined {
    return this.disableReason
  }

  recordSession(
    sessionID: string | undefined,
    agentName: string | undefined
  ): void {
    if (!sessionID || !agentName) {
      logger.debug(
        `[MeetingMode] recordSession skipped: project=${this.projectName}, sessionID=${sessionID ?? "missing"}, agent=${agentName ?? "missing"}`
      )
      return
    }

    this.sessionAgents.set(sessionID, agentName)
    logger.debug(
      `[MeetingMode] recordSession: project=${this.projectName}, sessionID=${sessionID}, agent=${agentName}`
    )
  }

  getAgentName(sessionID: string | undefined): string | undefined {
    if (!sessionID) {
      return undefined
    }

    return this.sessionAgents.get(sessionID)
  }

  disableHook(reason: string): void {
    if (!this.hookEnabled) {
      return
    }

    this.hookEnabled = false
    this.disableReason = reason
    logger.warn(
      `[MeetingMode] Hook disabled: project=${this.projectName}, projectId=${this.projectId}, reason=${reason}`
    )
  }

  recordHookSuccess(): void {
    this.consecutiveFailures = 0

    const now = Date.now()
    this.executionHistory.push({
      timestamp: now,
      success: true,
    })
    this.pruneExecutions(now)
  }

  recordHookFailure(error: any): void {
    const now = Date.now()
    this.consecutiveFailures++
    this.executionHistory.push({
      timestamp: now,
      success: false,
    })
    this.pruneExecutions(now)

    const recentExecutions = this.getRecentExecutions()
    const recentFailures = recentExecutions.filter(
      (item) => !item.success
    ).length
    const failureRate =
      recentExecutions.length === 0
        ? 0
        : recentFailures / recentExecutions.length

    const errorMessage = error instanceof Error ? error.message : String(error)

    logger.error(
      `[MeetingMode] Hook failure: project=${this.projectName}, consecutive=${this.consecutiveFailures}, recentFailures=${recentFailures}, recentExecutions=${recentExecutions.length}, failureRate=${failureRate.toFixed(2)}, error=${errorMessage}`,
      error
    )

    if (this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this.disableHook(
        `${MAX_CONSECUTIVE_FAILURES} consecutive failures in system.transform`
      )
      return
    }

    if (failureRate > 0.5) {
      this.disableHook("failure rate exceeded 50% within 5 minutes")
    }
  }

  buildInjectedPrompt(
    sessionID: string | undefined,
    roleManager: RoleManager
  ): {
    agentName?: string
    prompt?: string
    injected: boolean
    reason?: string
  } {
    const agentName = this.getAgentName(sessionID)
    if (!sessionID || !agentName) {
      return {
        agentName,
        injected: false,
        reason: "session mapping not found",
      }
    }

    if (!this.hookEnabled) {
      return {
        agentName,
        injected: false,
        reason: this.disableReason || "hook disabled",
      }
    }

    if (!isMeetingModeProjectedAgent(roleManager, agentName)) {
      return {
        agentName,
        injected: false,
        reason: "agent is not meeting-mode projected role",
      }
    }

    const role = roleManager.getRole(agentName)
    if (!role) {
      return {
        agentName,
        injected: false,
        reason: "role definition not found",
      }
    }

    return {
      agentName,
      prompt: buildMeetingModeSystemPrompt(
        role.systemPrompt,
        MEETING_MODE_AUGMENTATION,
        role
      ),
      injected: true,
    }
  }

  private getRecentExecutions(): HookExecutionRecord[] {
    return this.executionHistory
  }

  private pruneExecutions(now: number): void {
    while (
      this.executionHistory.length > 0 &&
      now - this.executionHistory[0].timestamp > FAILURE_WINDOW_MS
    ) {
      this.executionHistory.shift()
    }
  }
}
