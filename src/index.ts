import { Plugin } from "@opencode-ai/plugin"
import { createTools } from "./tools"
import { logger } from "./lib/logger"
import { GlobalCcloverService } from "./server/GlobalServer"
import { CandidateProjectsManager } from "./config/CandidateProjectsManager"
import { formatToolParameterDescriptions } from "./utils/ZodDescriptionExtractor"
import { buildMeetingModePrimaryAgents } from "./meeting-mode"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * OpenCode Cclover Plugin
 *
 * 多 Agent 自主协作系统
 */
export const CcloverPlugin: Plugin = async (ctx) => {
  try {
    if (process.env.CCLOVER_ENABLE !== "1") {
      logger.info(
        "[Cclover] Plugin is not enabled, if you want to enable it, set CCLOVER_ENABLE=1"
      )
      return {}
    }

    // 1. 静态注入 OpencodeClient（必须在 getInstance 之前）
    GlobalCcloverService.setOpencodeClient(ctx.client)

    // 2. 获取全局服务实例（第一次调用时会启动 HTTP 服务）
    const globalService = await GlobalCcloverService.getInstance()

    // 3. 从全局服务获取当前 project 的服务实例
    const project = globalService.getProject(ctx.directory)
    if (!project) {
      // 记录到候选项目列表
      CandidateProjectsManager.addCandidate(ctx.directory).catch((error) => {
        logger.error("Failed to record candidate project:", error)
      })
      return {} // 返回空,不提供工具
    }

    // 4. 创建工具(使用 project 的服务实例)
    const tools = createTools({
      messageService: project.messageService,
      memoryManager: project.memoryManager,
      opcodeClient: ctx.client,
      bossManager: project.bossManager,
      stateManager: project.stateManager,
      project: project,
    })

    // 5. 启动 EventLoop (在 tools 注册之后)
    // 使用 setImmediate 确保 tools 已经返回给 OpenCode
    setImmediate(async () => {
      try {
        logger.debug(
          `[Cclover] setImmediate callback triggered for project: ${project.projectName}`
        )
        await globalService.startEmployees(project)
        logger.debug(
          `[Cclover] startEmployees completed for project: ${project.projectName}`
        )
      } catch (error: any) {
        logger.error(
          `[Cclover] Failed to start employees for project: ${project.projectName}`,
          error
        )
      }
    })

    // 6. 返回工具和 hooks(注册到 OpenCode)
    return {
      tool: tools,
      "tool.definition": async (input, output) => {
        try {
          // 自动提取参数描述（修复 OpenCode SDK 不传递 Zod .describe() 的问题）
          const paramDocs = formatToolParameterDescriptions(output.parameters)
          if (paramDocs) {
            output.description += paramDocs
          }
        } catch (error: any) {
          logger.error(
            `[Cclover] Failed to format tool parameter descriptions for ${output.description}:`,
            error
          )
        }
      },
      config: async (config) => {
        try {
          // 注册空 agent，用于员工 session（避免预设提示词污染）
          const agents = (config.agent ?? {}) as Record<string, any>
          agents["cclover-empty-agent"] = {
            prompt: "---\n", // 空提示词占位
            mode: "subagent",
            hidden: true, // 隐藏，不在 UI 中显示
            description: "Internal agent for Cclover employee sessions",
          }

          // 自动扫描并注册 src/agents/ 目录下的所有 agent
          try {
            const agentsDir = path.join(__dirname, "agents")
            const agentFiles = await fs.readdir(agentsDir)
            const mdFiles = agentFiles.filter((file) => file.endsWith(".md"))

            for (const file of mdFiles) {
              const agentName = path.basename(file, ".md")
              const agentPromptPath = path.join(agentsDir, file)
              try {
                const agentPrompt = await fs.readFile(agentPromptPath, "utf-8")
                agents[agentName] = {
                  prompt: agentPrompt,
                  mode: "primary",
                  description: `Agent: ${agentName}`,
                }
                logger.debug(`[Cclover] Registered agent: ${agentName}`)
              } catch (error: any) {
                logger.error(
                  `[Cclover] Failed to load ${agentName} agent prompt: ${error.message}`
                )
              }
            }
          } catch (error: any) {
            logger.error(
              `[Cclover] Failed to scan agents directory: ${error.message}`
            )
          }

          // 基于 RoleManager 的最终解析结果注册 Meeting Mode primary agents
          const meetingModeAgents = await buildMeetingModePrimaryAgents(
            project.roleManager,
            {
              useDynamicPromptInjection:
                project.meetingModePromptInjector.isHookEnabled(),
            }
          )
          for (const [agentName, definition] of Object.entries(
            meetingModeAgents
          )) {
            agents[agentName] = definition
            logger.debug(
              `[Cclover] Registered Meeting Mode agent: ${agentName}`
            )
          }

          config.agent = agents
        } catch (error: any) {
          logger.error("[Cclover] Failed to process config:", error)
        }
      },
      "chat.params": async (input) => {
        try {
          project.meetingModePromptInjector.recordSession(
            input.sessionID,
            input.agent
          )
        } catch (error: any) {
          logger.error("[MeetingMode] chat.params failed:", error)
        }
      },
      "chat.message": async (input) => {
        try {
          project.meetingModePromptInjector.recordSession(
            input.sessionID,
            input.agent
          )
        } catch (error: any) {
          logger.error("[MeetingMode] chat.message failed:", error)
        }
      },
      "experimental.chat.system.transform": async (input, output) => {
        const sessionID = input.sessionID
        let agentName: string | undefined

        try {
          const result =
            await project.meetingModePromptInjector.buildInjectedPrompt(
              sessionID,
              project.roleManager
            )
          agentName = result.agentName

          if (!result.injected || !result.prompt) {
            logger.debug(
              `[MeetingMode] system.transform: sessionID=${sessionID ?? "missing"}, agent=${agentName ?? "unknown"}, injected=false, reason=${result.reason ?? "unknown"}`
            )
            return
          }

          output.system.unshift(result.prompt)
          project.meetingModePromptInjector.recordHookSuccess()
          logger.debug(
            `[MeetingMode] system.transform: sessionID=${sessionID ?? "missing"}, agent=${agentName}, injected=true`
          )
        } catch (error: any) {
          project.meetingModePromptInjector.recordHookFailure(error)
          logger.error(
            `[MeetingMode] system.transform: sessionID=${sessionID ?? "missing"}, agent=${agentName ?? "unknown"}, injected=false, error=${error?.message ?? String(error)}`,
            error
          )
        }
      },
    }
  } catch (error: any) {
    logger.error("[Cclover] Plugin initialization failed:", error)
    return {} // 返回空对象，避免插件加载失败导致 OpenCode 崩溃
  }
}
// Default export
export default CcloverPlugin
