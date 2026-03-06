/**
 * send_message 工具
 *
 * 发送消息给其他员工
 */

import { tool } from "@opencode-ai/plugin"
import type { MessageService } from "../core/MessageService"
import type { BossManager } from "../core/BossManager"
import { sessionRegistry } from "../utils/SessionRegistry"

/**
 * 创建 send_message 工具
 *
 * @param messageService 消息服务实例
 * @param bossManager Boss 管理器实例（可选）
 */
export function createSendMessageTool(
  messageService: MessageService,
  bossManager?: BossManager
) {
  return tool({
    description: "发送消息给其他员工",
    args: {
      to: tool.schema.string().describe("接收者名称"),
      content: tool.schema.string().describe("消息内容"),
      reference_docs: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe("参考文档路径列表（可选）"),
    },
    async execute(args, context) {
      // 1. 获取调用者信息
      let from: string | undefined
      // 2. 首先尝试从 SessionRegistry 获取（员工）
      from = sessionRegistry.getEmployeeName(context.sessionID)
      // 3. 如果 SessionRegistry 中没有，尝试从 context.agent 获取（可能是 boss）
      if (!from && context.agent) {
        const agentName = context.agent
        // 检查是否是 boss
        if (bossManager?.isBoss(agentName)) {
          from = agentName
        }
      }
      if (!from) {
        throw new Error(
          `无法识别调用者身份 (sessionID: ${context.sessionID}, agent: ${context.agent || "unknown"})`
        )
      }

      // 2. 调用消息服务（让异常自然抛出）
      await messageService.send(
        from,
        args.to,
        args.content,
        args.reference_docs
      )
      return `消息已发送给 ${args.to}`
    },
  })
}
