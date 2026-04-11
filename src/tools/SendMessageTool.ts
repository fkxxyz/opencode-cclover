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
import { parseEmployeeId, formatEmployeeId } from "../types"

function resolveRecipientId(
  recipient: string,
  senderEmployeeId: string,
  stateManager: StateManager,
  bossManager: BossManager | undefined
): string {
  // 统一的recipient resolution规则（无例外）
  let resolvedRecipientId: string
  let wasAutoPrepended = false

  // 检查recipient是否已经有taskId前缀（匹配 ^[0-9]+- 模式）
  if (/^[0-9]+-/.test(recipient)) {
    // 已有taskId前缀，直接使用
    resolvedRecipientId = recipient
  } else {
    // 没有taskId前缀，提取sender的taskId并prepend
    const { taskId: senderTaskId } = parseEmployeeId(senderEmployeeId)
    resolvedRecipientId = formatEmployeeId(senderTaskId, recipient)
    wasAutoPrepended = true
  }

  // 验证recipient是否存在
  // Boss不在employee state系统中，需要单独检查
  const recipientEmployee = stateManager.getEmployee(resolvedRecipientId)
  const isBoss =
    resolvedRecipientId.startsWith("0-") &&
    bossManager?.isBoss(resolvedRecipientId.substring(2))

  if (!recipientEmployee && !isBoss) {
    // 透明的错误消息
    if (wasAutoPrepended) {
      throw new Error(
        `Recipient '${recipient}' (resolved to '${resolvedRecipientId}') does not exist`
      )
    } else {
      throw new Error(`Recipient does not exist: ${resolvedRecipientId}`)
    }
  }

  // 阻止self-messaging
  if (resolvedRecipientId === senderEmployeeId) {
    throw new Error("Cannot send message to yourself. Use memory for notes.")
  }

  return resolvedRecipientId
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
        from,
        stateManager,
        bossManager
      )

      // 2. Check if recipient is offline (simplified - Boss naturally skips check)
      const recipient = stateManager.getEmployee(recipientId)
      if (recipient?.status === "offline") {
        throw new Error(`Employee is on vacation!`)
      }

      // 3. Record session if sender is Boss (BEFORE sending)
      // recordSession tracks which session a Boss is using to communicate with employees
      if (
        bossManager &&
        stateManager &&
        context.sessionID &&
        from.startsWith("0-")
      ) {
        // Sender is Boss - extract boss name from BossId
        const bossName = from.substring(2) // Remove "0-" prefix

        if (recipientId) {
          await bossManager.recordSession(
            bossName,
            recipientId,
            context.sessionID
          )
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
