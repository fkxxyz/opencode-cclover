import { Plugin } from "@opencode-ai/plugin"
import path from "node:path"
import { MessageService } from "./core/MessageService"
import { MemoryManager } from "./core/MemoryManager"
import { createTools } from "./tools"
import { logger } from "./lib/logger"
/**
 * OpenCode Cclover Plugin
 *
 * 多 Agent 自主协作系统
 */
export const CcloverPlugin: Plugin = async (ctx) => {
  logger.info("Initializing opencode-cclover plugin...")
  // 1. 初始化工作空间
  const workspaceRoot = path.join(ctx.directory, ".cclover/workspace")
  logger.info(`Workspace root: ${workspaceRoot}`)
  // 2. 初始化消息服务
  const messageService = new MessageService(workspaceRoot)
  logger.info("MessageService initialized")
  // 3. 初始化记忆管理
  const memoryManager = new MemoryManager(workspaceRoot)
  logger.info("MemoryManager initialized")
  // 4. 创建工具
  const tools = createTools({
    messageService,
    memoryManager,
    opcodeClient: ctx.client,
  })
  logger.info("Tools created")
  logger.info("Plugin initialized successfully")
  // 5. 返回工具
  return {
    tool: tools,
  }
}
// Default export
export default CcloverPlugin
