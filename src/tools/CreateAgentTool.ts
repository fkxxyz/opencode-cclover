/**
 * create_agent tool
 *
 * Create OpenCode agent to execute task
 */
import { tool } from "@opencode-ai/plugin"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { BossManager } from "../core/BossManager"
import type { RoleManager } from "../core/RoleManager"
import type { StateManager } from "../state/StateManager"
import type { ModelConfigManager } from "../config/ModelConfigManager"
import type { WorkItemManager } from "../core/WorkItemManager"
import { agentRegistry } from "../utils/AgentRegistry"
import { resolveToolActor } from "../meeting-mode"
/**
 * Create create_agent tool
 *
 * @param opcodeClient OpenCode SDK client
 * @param stateManager State manager
 * @param bossManager Boss manager
 * @param roleManager Role manager
 * @param modelConfigManager Model config manager
 */
export function createCreateAgentTool(
  opcodeClient: OpencodeClient,
  stateManager?: StateManager,
  bossManager?: BossManager,
  roleManager?: RoleManager,
  modelConfigManager?: ModelConfigManager,
  _workItemManager?: WorkItemManager
) {
  return tool({
    description:
      "Create OpenCode agent to execute a work item or personal task",
    args: {
      work_item_id: tool.schema
        .string()
        .optional()
        .describe("Optional project-level work item ID"),
      task_name: tool.schema
        .string()
        .optional()
        .describe("Optional personal TODO task name"),
      prompt: tool.schema.string().describe("Prompt for the agent"),
    },
    async execute(args, context) {
      // 临时禁用子 agent 功能：
      // 1) OpenCode 全局 SSE event stream 在新版本可能会主动关闭/不再长连接
      // 2) 现有实现依赖 SSE 监听 message.updated 来判定 agent 完成，导致员工 EventLoop 被连带拖垮
      // 这里保留工具入口但直接抛异常，让上层尽早发现并回退到“单员工直接执行”模式。
      throw new Error(
        "create_agent is temporarily disabled: OpenCode event stream compatibility issue"
      )
    },
  })
}
