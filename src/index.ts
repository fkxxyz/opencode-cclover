import { Plugin } from "@opencode-ai/plugin"
import path from "node:path"
import * as fs from "node:fs/promises"
import { MessageService } from "./core/MessageService"
import { MemoryManager } from "./core/MemoryManager"
import { EventLoop } from "./core/EventLoop"
import { createTools } from "./tools"
import { CalculatorRole } from "./roles"
import { logger } from "./lib/logger"
import { StateManager } from "./state/StateManager"
import { createAndStartServer } from "./server/index"
import { agentRegistry } from "./utils/AgentRegistry"
/**
 * 确保 .gitignore 包含 .cclover
 */
async function ensureGitignore(projectRoot: string): Promise<void> {
  const gitignorePath = path.join(projectRoot, ".gitignore")

  try {
    // 读取现有 .gitignore
    let content = ""
    try {
      content = await fs.readFile(gitignorePath, "utf-8")
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error
      // 文件不存在，创建新的
    }

    // 检查是否已包含 .cclover
    if (!content.includes(".cclover")) {
      content += "\n# Cclover workspace\n.cclover/\n"
      await fs.writeFile(gitignorePath, content, "utf-8")
      logger.info("Added .cclover to .gitignore")
    }
  } catch (error) {
    logger.error("Failed to update .gitignore:", error)
  }
}

/**
 * 启动员工
 */
async function startEmployees(
  messageService: MessageService,
  memoryManager: MemoryManager,
  stateManager: StateManager,
  opcodeClient: any
): Promise<void> {
  const employees = [{ name: "calculator", role: CalculatorRole }]

  // 并行启动所有员工
  Promise.all(
    employees.map(async ({ name, role }) => {
      try {
        const messageClient = messageService.getClient(name)
        const eventLoop = new EventLoop(
          name,
          role,
          messageClient,
          memoryManager,
          opcodeClient,
          stateManager
        )

        // 启动事件循环（不等待，让它在后台运行）
        eventLoop.run().catch((error) => {
          logger.error(`[${name}] EventLoop crashed:`, error)
        })

        logger.info(`Started employee: ${name}`)
      } catch (error) {
        logger.error(`Failed to start employee ${name}:`, error)
      }
    })
  ).catch((error) => {
    logger.error("Error in employee startup:", error)
  })

  logger.info(`Started ${employees.length} employee(s)`)
}

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

  // 2. 确保 .gitignore
  await ensureGitignore(ctx.directory)

  // 3. 初始化消息服务
  const messageService = new MessageService(workspaceRoot)
  logger.info("MessageService initialized")

  // 4. 初始化记忆管理
  const memoryManager = new MemoryManager(workspaceRoot)
  logger.info("MemoryManager initialized")

  // 5. 初始化状态管理器
  const stateManager = new StateManager()
  logger.info("StateManager initialized")

  // 6. 将 StateManager 传递给服务
  const messageServiceWithState = new MessageService(
    workspaceRoot,
    stateManager
  )
  const memoryManagerWithState = new MemoryManager(workspaceRoot, stateManager)

  // 7. 注册初始员工到 StateManager
  stateManager.registerEmployee({
    name: "calculator",
    role: "calculator",
    status: "inactive",
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  })

  // 8. 创建工具
  const tools = createTools({
    messageService: messageServiceWithState,
    memoryManager: memoryManagerWithState,
    opcodeClient: ctx.client,
  })
  logger.info("Tools created")

  // 9. 启动员工（后台运行）
  startEmployees(
    messageServiceWithState,
    memoryManagerWithState,
    stateManager,
    ctx.client
  )

  // 10. 启动 HTTP/WebSocket 服务器
  try {
    await createAndStartServer(
      { port: 4097, workspaceRoot },
      {
        stateManager,
        memoryManager: memoryManagerWithState,
        messageService: messageServiceWithState,
        agentRegistry,
        workspaceRoot,
      }
    )
    logger.info("Console server started on port 4097")
  } catch (error) {
    logger.error("Failed to start console server:", error)
  }

  logger.info("Plugin initialized successfully")
  // 11. 返回工具
  return {
    tool: tools,
  }
}
// Default export
export default CcloverPlugin
