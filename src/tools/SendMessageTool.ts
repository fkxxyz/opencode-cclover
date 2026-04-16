/**
 * send_message tool
 *
 * Send message to other employees
 */

import { tool } from "@opencode-ai/plugin"
import type { MessageService } from "../core/MessageService"
import type { BossManager } from "../core/BossManager"
import type { RoleManager } from "../core/RoleManager"
import type { StateManager } from "../state/StateManager"
import { resolveToolActor } from "../meeting-mode"
import { formatBossId } from "../types"
import { logger } from "../lib/logger"

function resolveRecipientId(
  recipient: string,
  bossManager: BossManager | undefined,
  stateManager: StateManager,
  roleManager: RoleManager | undefined
): string {
  logger.debug(
    `[SendMessageTool] resolveRecipientId: recipient="${recipient}", roleManager=${roleManager ? "present" : "undefined"}`
  )

  // 1. Check if recipient is a BossId format (0-{id})
  if (recipient.startsWith("0-")) {
    const bossId = recipient.substring(2)
    logger.debug(`[SendMessageTool] Checking BossId format: bossId="${bossId}"`)

    if (bossManager?.isBoss(bossId)) {
      logger.debug(`[SendMessageTool] Resolved as configured boss: ${bossId}`)
      return formatBossId(bossId)
    }

    // Check if it's a meeting-mode role
    if (roleManager) {
      // RoleManager stores roles by name, but we need to look up by id
      const allRoles = roleManager.getAllRoles()
      const role = allRoles.find((r) => r.id === bossId)
      if (role) {
        logger.debug(
          `[SendMessageTool] Resolved as meeting-mode role: ${bossId} (role.name="${role.name}")`
        )
        return formatBossId(bossId)
      } else {
        const roleIds = allRoles.map((r) => r.id).join(", ")
        logger.debug(
          `[SendMessageTool] Role "${bossId}" not found. Available roles: ${roleIds}`
        )
      }
    } else {
      logger.warn(
        `[SendMessageTool] roleManager is undefined, cannot check meeting-mode roles`
      )
    }

    logger.debug(
      `[SendMessageTool] BossId "${bossId}" not found in boss list or role list`
    )
  }

  // 2. Find employee (supports name or employeeId)
  const allEmployees = stateManager.getEmployees()
  logger.debug(
    `[SendMessageTool] Searching in ${allEmployees.length} employees`
  )

  const matchedEmployee = allEmployees.find(
    (employee) =>
      employee.name === recipient || employee.employeeId === recipient
  )

  if (!matchedEmployee) {
    logger.debug(
      `[SendMessageTool] Recipient not found: "${recipient}" (checked boss list, role list, and ${allEmployees.length} employees)`
    )
    throw new Error(`Recipient does not exist: ${recipient}`)
  }

  logger.debug(
    `[SendMessageTool] Resolved as employee: ${matchedEmployee.employeeId}`
  )
  return matchedEmployee.employeeId
}

async function findPendingReplyPeer(
  messageService: MessageService,
  from: string
): Promise<string | null> {
  const peers = await messageService.getPeers(from)
  const client = messageService.getClient(from)

  for (const peer of peers) {
    const messages = await client.history(peer)

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      if (msg.from === peer && msg.expect_reply === true) {
        let hasReply = false
        for (let j = i + 1; j < messages.length; j++) {
          if (messages[j].from === from && messages[j].to === peer) {
            hasReply = true
            break
          }
        }

        if (!hasReply) {
          return peer
        }
      }
    }
  }

  return null
}

/**
 * Create send_message tool
 *
 * @param messageService Message service instance
 * @param bossManager Boss manager instance (optional)
 * @param stateManager State manager instance (optional)
 */
export function createSendMessageTool(
  messageService: MessageService,
  bossManager?: BossManager,
  stateManager?: StateManager,
  roleManager?: RoleManager
) {
  logger.info(
    `[SendMessageTool] *** FIXED VERSION LOADED *** Tool created with roleManager=${roleManager ? "present" : "undefined"}`
  )

  return tool({
    description:
      "Send message to other employees. If any tasks depend on receiving a reply to this message, update those tasks to 'waiting_for_message' status using edit_tasks.",
    args: {
      to: tool.schema.string().describe("Recipient name"),
      content: tool.schema.string().describe("Message content"),
      reference_docs: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe("Reference document path list (optional)"),
      urgent: tool.schema
        .boolean()
        .optional()
        .describe(
          "Whether this is an urgent message that should interrupt the recipient's current session (default: false)"
        ),
      expect_reply: tool.schema
        .boolean()
        .describe(
          "Whether you need a reply from the recipient. The system will remind them if they forget to respond."
        ),
    },
    async execute(args, context) {
      logger.debug(
        `[SendMessageTool] execute: to="${args.to}", from sessionID=${context.sessionID}, agent=${context.agent}, roleManager=${roleManager ? "present" : "undefined"}`
      )

      if (!stateManager) {
        throw new Error("SendMessageTool stateManager is required")
      }

      const actor = resolveToolActor(
        context,
        stateManager,
        bossManager,
        roleManager
      )

      if (!actor) {
        throw new Error(
          `Unable to identify caller (sessionID: ${context.sessionID}, agent: ${context.agent || "unknown"})`
        )
      }

      const from = actor.actorEmployeeId
      logger.debug(
        `[SendMessageTool] Resolved actor: from="${from}", actorType=${actor.actorType}`
      )

      const pendingReplyPeer = await findPendingReplyPeer(messageService, from)
      if (pendingReplyPeer) {
        await stateManager.addEvent({
          projectId: "",
          type: "reply_attempted",
          timestamp: new Date().toISOString(),
          employeeId: from,
          details: {
            from,
            to: pendingReplyPeer,
            content: args.content,
            attemptedRecipient: args.to,
          },
        })
      }

      const recipientId = resolveRecipientId(
        args.to,
        bossManager,
        stateManager,
        roleManager
      )

      // 2. Check if recipient is offline (only for employees, not Boss or meeting-mode role)
      const recipientBossId = recipientId.startsWith("0-")
        ? recipientId.substring(2)
        : null
      const isRecipientBoss =
        recipientBossId !== null && bossManager?.isBoss(recipientBossId)
      const isRecipientMeetingRole =
        recipientBossId !== null && roleManager?.getRole(recipientBossId)

      if (!isRecipientBoss && !isRecipientMeetingRole) {
        const recipient = stateManager.getEmployee(recipientId)
        if (recipient?.paused) {
          throw new Error(`Employee is on vacation!`)
        }
      }

      // 3. Record session if sender is Boss (BEFORE sending)
      // recordSession tracks which session a Boss is using to communicate with employees
      const senderBossId = from.startsWith("0-") ? from.substring(2) : null
      const isSenderBoss =
        senderBossId !== null && bossManager?.isBoss(senderBossId)

      if (isSenderBoss && bossManager && context.sessionID && recipientId) {
        await bossManager.recordSession(
          senderBossId!,
          recipientId,
          context.sessionID
        )
      }

      // 4. Call message service (let exceptions propagate naturally)
      await messageService.send(
        from,
        recipientId,
        args.content,
        args.reference_docs,
        args.urgent,
        args.expect_reply
      )

      return `Message sent to ${recipientId}`
    },
  })
}
