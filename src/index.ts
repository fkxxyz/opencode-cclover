import { Plugin } from "@opencode-ai/plugin"
import path from "node:path"
import * as fs from "node:fs/promises"
import { createTools } from "./tools"
import { logger } from "./lib/logger"
import { GlobalCcloverService } from "./server/GlobalServer"
import { CandidateProjectsManager } from "./config/CandidateProjectsManager"
import { agentRegistry } from "./utils/AgentRegistry"

// 模块加载时立即打印，确认插件已被加载
console.log("[Cclover] Plugin module loaded")
/**
 * 模块加载时立即初始化全局服务
 * 这样 HTTP 服务器会在插件加载时启动，而不是等到打开项目时
 */
const globalServicePromise = GlobalCcloverService.getInstance().catch(
  (error) => {
    logger.error("Failed to initialize GlobalCcloverService:", error)
    throw error
  }
)

/**
 * OpenCode Cclover Plugin
 *
 * 多 Agent 自主协作系统
 */
export const CcloverPlugin: Plugin = async (ctx) => {
  // 1. 等待全局服务初始化完成（通常已经完成）
  const globalService = await globalServicePromise

  // 3. 从全局服务获取当前 project 的服务实例
  const project = globalService.getProject(ctx.directory)

  if (!project) {
    logger.warn(`Project not found in config: ${ctx.directory}`)
    logger.warn(
      "Please add this project to ~/.config/opencode-cclover/config.yaml"
    )
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
  })

  logger.info("Plugin initialized successfully")

  // 5. 返回工具(注册到 OpenCode)
  return {
    tool: tools,
  }
}
// Default export
export default CcloverPlugin
