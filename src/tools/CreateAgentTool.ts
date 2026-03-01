/**
 * create_agent 工具
 * 
 * 创建 OpenCode agent 执行任务
 * 
 * 注意：这是占位符实现，完整实现在任务 2.1
 */

import { tool } from "@opencode-ai/plugin"

export const createAgentTool = tool({
  description: "创建 OpenCode agent 执行任务",
  args: {
    task_name: tool.schema.string().describe("关联的任务名称"),
    prompt: tool.schema.string().describe("给 agent 的提示词"),
  },
  async execute(args, context) {
    // TODO: 任务 2.1 实现
    return `[占位符] 已创建 Agent 执行任务: ${args.task_name}`
  },
})
