/**
 * send_message 工具
 *
 * 发送消息给其他员工
 */

import { tool } from "@opencode-ai/plugin"
import type { MessageService } from "../core/MessageService"
import { sessionRegistry } from "../utils/SessionRegistry"

/**
 * 创建 send_message 工具
 *
 * @param messageService 消息服务实例
 */
export function createSendMessageTool(messageService: MessageService) {
  return tool({
    description: "发送消息给其他员工",
    args: {
      to: tool.schema.string().describe("接收者名称"),
      content: tool.schema.string().describe("消息内容"),
    },
    async execute(args, context) {
      // 1. 获取调用者信息
      const from = sessionRegistry.getEmployeeName(context.sessionID)

      if (!from) {
        return `错误: 无法识别调用者身份 (sessionID: ${context.sessionID})`
      }

      // 2. 调用消息服务
      try {
        await messageService.send(from, args.to, args.content)
        return `消息已发送给 ${args.to}`
      } catch (error) {
        return `发送消息失败: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
