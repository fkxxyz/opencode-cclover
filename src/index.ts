import { Plugin } from "@opencode-ai/plugin"
import { createTools } from "./tools"
import { logger } from "./lib/logger"
import { GlobalCcloverService } from "./server/GlobalServer"
import { CandidateProjectsManager } from "./config/CandidateProjectsManager"

/**
 * OpenCode Cclover Plugin
 *
 * 多 Agent 自主协作系统
 */
export const CcloverPlugin: Plugin = async (ctx) => {
  if (!process.env.CCLOVER_ENABLE) {
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
    bossManager: globalService.getBossManager() || undefined,
    stateManager: project.stateManager,
  })

  // 5. 启动 EventLoop (在 tools 注册之后)
  // 使用 setImmediate 确保 tools 已经返回给 OpenCode
  setImmediate(async () => {
    await globalService.startEmployees(project)
  })

  // 6. 返回工具(注册到 OpenCode)
  return {
    tool: tools,
  }
}
// Default export
export default CcloverPlugin
