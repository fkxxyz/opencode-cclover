/**
 * send_message 工具
 * 
 * 发送消息给其他员工
 * 
 * 注意：这是占位符实现，完整实现在任务 2.1
 */

import { tool } from "@opencode-ai/plugin"

export const sendMessageTool = tool({
  description: "发送消息给其他员工",
  args: {
    to: tool.schema.string().describe("接收者名称"),
    content: tool.schema.string().describe("消息内容"),
  },
  async execute(args, context) {
    // TODO: 任务 2.1 实现
    return `[占位符] 消息已发送给 ${args.to}: ${args.content}`
  },
})
