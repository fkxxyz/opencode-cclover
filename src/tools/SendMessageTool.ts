/**
 * send_message tool
 *
 * Send message to an employee work session or boss
 */

import { tool } from "@opencode-ai/plugin"
import type { MessageService } from "../core/MessageService"
import type { BossManager } from "../core/BossManager"
import type { RoleManager } from "../core/RoleManager"
import type { StateManager } from "../state/StateManager"
import { resolveToolActor } from "../meeting-mode"
import { formatBossId } from "../types"
import type { BossId, EmployeeWorkSessionId } from "../types"
import { logger } from "../lib/logger"

function resolveRecipientId(
  recipient: string,
  bossManager: BossManager | undefined,
  stateManager: StateManager,
  roleManager: RoleManager | undefined
): EmployeeWorkSessionId | BossId {
  logger.debug(
    `[SendMessageTool] resolveRecipientId: recipient="${recipient}", roleManager=${roleManager ? "present" : "undefined"}`
  )

  if (recipient.startsWith("ews_")) {
    return recipient as EmployeeWorkSessionId
  }

  // 1. Check if recipient is a BossId format (boss_{id})
  if (recipient.startsWith("boss_")) {
    const bossId = recipient.substring("boss_".length)
    logger.debug(`[SendMessageTool] Checking BossId format: bossId="${bossId}"`)

    if (bossManager?.isBoss(bossId)) {
      logger.debug(`[SendMessageTool] Resolved as configured boss: ${bossId}`)
      return formatBossId(bossId)
    }

    logger.debug(`[SendMessageTool] BossId "${bossId}" not found in boss list`)
  }

  throw new Error(
    `Unsupported message target '${recipient}'. Use employee_work_session_id or boss_id.`
  )
}

async function findPendingReplyPeer(
  messageService: MessageService,
  from: EmployeeWorkSessionId | BossId
): Promise<EmployeeWorkSessionId | BossId | null> {
  const peers = await messageService.getPeers(from)
  const client = messageService.getClient(from)

  for (const peer of peers as Array<EmployeeWorkSessionId | BossId>) {
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
          return peer as EmployeeWorkSessionId | BossId
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
  return tool({
    description:
      "Send message to an employee work session ID (ews_*) or configured boss ID (boss_*). Employee IDs, role IDs, and meeting-mode role IDs are unsupported. If any tasks depend on receiving a reply to this message, update those tasks to 'waiting_for_message' status using edit_tasks.",
    args: {
      to: tool.schema
        .string()
        .describe(
          "Recipient employee_work_session_id (ews_*) or configured boss_id (boss_*)"
        ),
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

      const from = (actor.actorEmployeeWorkSessionId ??
        actor.actorEmployeeId) as EmployeeWorkSessionId | BossId
      logger.debug(
        `[SendMessageTool] Resolved actor: from="${from}", actorType=${actor.actorType}`
      )

      const pendingReplyPeer = await findPendingReplyPeer(messageService, from)
      if (pendingReplyPeer) {
        await stateManager.addEvent({
          projectId: "",
          type: "reply_attempted",
          timestamp: new Date().toISOString(),
          employeeWorkSessionId: from.startsWith("ews_")
            ? (from as EmployeeWorkSessionId)
            : undefined,
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

      // 3. Record or clear session if sender is Boss (BEFORE sending)
      // Always check session_id: if present update, if absent remove old record
      const senderBossId = from.startsWith("boss_")
        ? from.substring("boss_".length)
        : null
      const isSenderBoss =
        senderBossId !== null && bossManager?.isBoss(senderBossId)

      if (isSenderBoss && bossManager && recipientId.startsWith("ews_")) {
        if (context.sessionID) {
          await bossManager.recordSession(
            senderBossId!,
            recipientId as any,
            context.sessionID
          )
        } else {
          await bossManager.clearSession(senderBossId!, recipientId as any)
        }
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
