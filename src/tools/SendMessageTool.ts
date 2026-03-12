/**
 * send_message tool
 *
 * Send message to other employees
 */

import { tool } from "@opencode-ai/plugin"
import type { MessageService } from "../core/MessageService"
import type { BossManager } from "../core/BossManager"
import type { StateManager } from "../state/StateManager"
import { sessionRegistry } from "../utils/SessionRegistry"
import { formatBossId } from "../types"

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
  stateManager?: StateManager
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
      // 1. Get caller employeeId
      let from: string | undefined
      // 2. First try to get from SessionRegistry (employee)
      const employeeId = sessionRegistry.getEmployeeId(context.sessionID)
      if (employeeId) {
        from = employeeId
      }
      // 3. If not in SessionRegistry, try to get from context.agent (might be boss)
      if (!from && context.agent) {
        const agentName = context.agent
        // Check if it's a boss
        if (bossManager?.isBoss(agentName)) {
          from = formatBossId(agentName)
        }
      }
      if (!from) {
        throw new Error(
          `Unable to identify caller (sessionID: ${context.sessionID}, agent: ${context.agent || "unknown"})`
        )
      }

      // 2. Check if recipient is offline (only for employees, not Boss)
      if (stateManager && !bossManager?.isBoss(args.to)) {
        // Try to find recipient by name or employeeId
        const allEmployees = stateManager.getEmployees()
        const recipient = allEmployees.find(
          (e) => e.name === args.to || e.employeeId === args.to
        )
        if (recipient?.status === "offline") {
          throw new Error(`Employee is on vacation!`)
        }
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

        // Look up recipient employeeId
        let recipientEmployeeId: string | undefined
        if (bossManager.isBoss(args.to)) {
          recipientEmployeeId = formatBossId(args.to)
        } else {
          const allEmployees = stateManager.getEmployees()
          const recipient = allEmployees.find(
            (e) => e.name === args.to || e.employeeId === args.to
          )
          if (recipient) {
            recipientEmployeeId = recipient.employeeId
          }
        }

        if (recipientEmployeeId) {
          await bossManager.recordSession(
            bossName,
            recipientEmployeeId,
            context.sessionID
          )
        }
      }

      // 4. Call message service (let exceptions propagate naturally)
      await messageService.send(
        from,
        args.to,
        args.content,
        args.reference_docs,
        args.urgent,
        args.expect_reply
      )

      return `Message sent to ${args.to}`
    },
  })
}
