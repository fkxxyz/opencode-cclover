/**
 * create_agent 工具
 *
 * 创建 OpenCode agent 执行任务
 */
import { tool } from "@opencode-ai/plugin"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { StateManager } from "../state/StateManager"
import { sessionRegistry } from "../utils/SessionRegistry"
import { agentRegistry } from "../utils/AgentRegistry"
/**
 * 创建 create_agent 工具
 *
 * @param opcodeClient OpenCode SDK 客户端
 * @param stateManager 状态管理器
 */
export function createCreateAgentTool(
  opcodeClient: OpencodeClient,
  stateManager?: StateManager
) {
  return tool({
    description: "创建 OpenCode agent 执行任务",
    args: {
      task_name: tool.schema.string().describe("关联的任务名称"),
      prompt: tool.schema.string().describe("给 agent 的提示词"),
    },
    async execute(args, context) {
      // 1. 获取调用者信息
      const employeeName = sessionRegistry.getEmployeeName(context.sessionID)

      if (!employeeName) {
        return `错误: 无法识别调用者身份 (sessionID: ${context.sessionID})`
      }

      try {
        // 2. 创建 agent session
        const session = await opcodeClient.session.create({
          body: {
            title: `${employeeName} - ${args.task_name}`,
          },
        })

        const agentId = session.data?.id

        if (!agentId) {
          return `创建 Agent 失败: 无法获取 session ID`
        }

        // 3. 发送 prompt
        await opcodeClient.session.prompt({
          path: { id: agentId },
          body: {
            agent: "cclover-empty-agent", // 使用空 agent 避免预设提示词污染
            parts: [{ type: "text", text: args.prompt }],
          },
        })

        // 4. 记录 agent 信息（用于后续事件匹配）
        agentRegistry.register(agentId, {
          employeeName,
          taskName: args.task_name,
        })
        // 4. 记录 agent 创建事件
        await stateManager?.addEvent({
          projectId: "",
          type: "agent_created",
          timestamp: new Date().toISOString(),
          employeeName,
          details: {
            agentId,
            taskName: args.task_name,
          },
        })

        return `✓ 已创建 Agent: ${agentId}，正在执行任务: ${args.task_name}`
      } catch (error) {
        return `创建 Agent 失败: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
