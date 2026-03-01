import { Plugin } from "@opencode-ai/plugin"
import path from "node:path"
import * as fs from "node:fs/promises"
import { createTools } from "./tools"
import { logger } from "./lib/logger"
import { GlobalCcloverService } from "./server/GlobalServer"
import { agentRegistry } from "./utils/AgentRegistry"
/**
 * 确保 .cclover 目录被 git 忽略
 */
async function ensureGitignore(projectRoot: string): Promise<void> {
  const ccloverDir = path.join(projectRoot, ".cclover")
  const gitignorePath = path.join(ccloverDir, ".gitignore")

  try {
    // 确保 .cclover 目录存在
    await fs.mkdir(ccloverDir, { recursive: true })

    // 创建 .gitignore 忽略整个目录
    await fs.writeFile(gitignorePath, "*\n", "utf-8")
    logger.info("Ensured .cclover/.gitignore exists")
  } catch (error) {
    logger.error("Failed to create .cclover/.gitignore:", error)
  }
}

/**
 * OpenCode Cclover Plugin
 *
 * 多 Agent 自主协作系统
 */
export const CcloverPlugin: Plugin = async (ctx) => {
  logger.info("Initializing opencode-cclover plugin...")

  // 1. 确保全局服务已启动(单例,只启动一次)
  const globalService = await GlobalCcloverService.getInstance()

  // 2. 确保 .gitignore
  await ensureGitignore(ctx.directory)

  // 3. 从全局服务获取当前 project 的服务实例
  const project = globalService.getProject(ctx.directory)

  if (!project) {
    logger.warn(`Project not found in config: ${ctx.directory}`)
    logger.warn(
      "Please add this project to ~/.config/opencode-cclover/config.yaml"
    )
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
