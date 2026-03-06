/**
 * send_message tool
 *
 * Send message to other employees
 */

import { tool } from "@opencode-ai/plugin"
import type { MessageService } from "../core/MessageService"
import type { BossManager } from "../core/BossManager"
import { sessionRegistry } from "../utils/SessionRegistry"

/**
 * Create send_message tool
 *
 * @param messageService Message service instance
 * @param bossManager Boss manager instance (optional)
 */
export function createSendMessageTool(
  messageService: MessageService,
  bossManager?: BossManager
) {
  return tool({
    description: "Send message to other employees",
    args: {
      to: tool.schema.string().describe("Recipient name"),
      content: tool.schema.string().describe("Message content"),
      reference_docs: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe("Reference document path list (optional)"),
    },
    async execute(args, context) {
      // 1. Get caller information
      let from: string | undefined
      // 2. First try to get from SessionRegistry (employee)
      from = sessionRegistry.getEmployeeName(context.sessionID)
      // 3. If not in SessionRegistry, try to get from context.agent (might be boss)
      if (!from && context.agent) {
        const agentName = context.agent
        // Check if it's a boss
        if (bossManager?.isBoss(agentName)) {
          from = agentName
        }
      }
      if (!from) {
        throw new Error(
          `Unable to identify caller (sessionID: ${context.sessionID}, agent: ${context.agent || "unknown"})`
        )
      }

      // 2. Call message service (let exceptions propagate naturally)
      await messageService.send(
        from,
        args.to,
        args.content,
        args.reference_docs
      )
      return `Message sent to ${args.to}`
    },
  })
}
