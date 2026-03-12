/**
 * create_agent tool
 *
 * Create OpenCode agent to execute task
 */
import { tool } from "@opencode-ai/plugin"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type { StateManager } from "../state/StateManager"
import { sessionRegistry } from "../utils/SessionRegistry"
import { agentRegistry } from "../utils/AgentRegistry"
/**
 * Create create_agent tool
 *
 * @param opcodeClient OpenCode SDK client
 * @param stateManager State manager
 */
export function createCreateAgentTool(
  opcodeClient: OpencodeClient,
  stateManager?: StateManager
) {
  return tool({
    description: "Create OpenCode agent to execute task",
    args: {
      task_name: tool.schema.string().describe("Associated task name"),
      prompt: tool.schema.string().describe("Prompt for the agent"),
    },
    async execute(args, context) {
      // 1. Get caller information
      const employeeName = sessionRegistry.getEmployeeName(context.sessionID)

      if (!employeeName) {
        return `Error: Unable to identify caller (sessionID: ${context.sessionID})`
      }

      try {
        // 2. Create agent session
        const session = await opcodeClient.session.create({
          body: {
            title: `${employeeName} - ${args.task_name}`,
          },
        })

        const agentId = session.data?.id

        if (!agentId) {
          return `Failed to create agent: Unable to get session ID`
        }

        // 3. Send prompt
        await opcodeClient.session.prompt({
          path: { id: agentId },
          body: {
            agent: "cclover-empty-agent", // Use empty agent to avoid preset prompt pollution
            parts: [{ type: "text", text: args.prompt }],
          },
        })

        // 4. Record agent information (for subsequent event matching)
        agentRegistry.register(agentId, {
          employeeId: employeeName,
          taskName: args.task_name,
        })
        // 4. Record agent creation event
        await stateManager?.addEvent({
          projectId: "",
          type: "agent_created",
          timestamp: new Date().toISOString(),
          employeeId: employeeName,
          details: {
            agentId,
            taskName: args.task_name,
          },
        })

        return `✓ Created agent: ${agentId}, executing task: ${args.task_name}`
      } catch (error) {
        return `Failed to create agent: ${error instanceof Error ? error.message : String(error)}`
      }
    },
  })
}
