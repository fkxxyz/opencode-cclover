import * as fs from "node:fs/promises"
import path from "node:path"
import { ConfigManager } from "../config/ConfigManager"
import type { ProjectConfig } from "../config/ConfigManager"
import { ProjectRegistry } from "./ProjectRegistry"
import type { ProjectInstance } from "./ProjectRegistry"
import { ConsoleServer } from "./index"
import { StateManager } from "../state/StateManager"
import { MessageService } from "../core/MessageService"
import { MemoryManager } from "../core/MemoryManager"
import { BossManager } from "../core/BossManager"
import { RoleManager } from "../core/RoleManager"
import { AgentRegistry } from "../utils/AgentRegistry"
import { EventLoop } from "../core/EventLoop"
import { OpencodeClient } from "@opencode-ai/sdk"
import { logger } from "../lib/logger"

/**
 * 全局 Cclover 服务
 * 单例模式，管理所有 project 实例和 HTTP 服务
 */
export class GlobalCcloverService {
  private static instance: GlobalCcloverService | null = null
  private static initPromise: Promise<GlobalCcloverService> | null = null
  private static opcodeClient: OpencodeClient | null = null
  private projectRegistry: ProjectRegistry = new ProjectRegistry()
  private httpServer: ConsoleServer | null = null
  private bossManager: BossManager | null = null
  private constructor() {}

  /**
   * 静态注入 OpencodeClient
   * 必须在 getInstance() 之前调用
   */
  static setOpencodeClient(client: OpencodeClient): void {
    if (this.opcodeClient) {
      return
    }
    this.opcodeClient = client
    logger.info("OpencodeClient injected successfully")
  }

  /**
   * 获取单例
   * 注意：必须先调用 setOpencodeClient()
   */
  static async getInstance(): Promise<GlobalCcloverService> {
    if (!this.opcodeClient) {
      throw new Error(
        "OpencodeClient must be set before getInstance(). Call setOpencodeClient() first."
      )
    }

    // 如果已经初始化完成，直接返回
    if (this.instance) {
      return this.instance
    }

    // 如果正在初始化，等待初始化完成
    if (this.initPromise) {
      return this.initPromise
    }

    // 开始初始化（只有第一个调用者会执行这里）
    this.initPromise = (async () => {
      const instance = new GlobalCcloverService()
      await instance.initialize()
      this.instance = instance
      return instance
    })()

    return this.initPromise
  }

  /**
   * 获取 OpencodeClient
   */
  getOpencodeClient(): OpencodeClient {
    return GlobalCcloverService.opcodeClient!
  }

  /**
   * 初始化服务
   */
  private async initialize(): Promise<void> {
    logger.info("Initializing GlobalCcloverService...")
    // 1. 加载配置并初始化 BossManager
    const config = await ConfigManager.load()
    this.bossManager = new BossManager(config)
    // 2. 加载配置并初始化所有 project
    await this.loadProjects()
    // 3. 启动 HTTP 服务(单例)
    // 端口优先级: 环境变量 > 配置文件 > 默认值
    const envPort = parseInt(process.env.CCLOVER_PORT || "", 10)
    const port = !isNaN(envPort) && envPort > 0 ? envPort : config.port || 4097

    // 验证端口范围
    if (port < 1 || port > 65535) {
      throw new Error(
        `Invalid port ${port}: must be between 1 and 65535. Check CCLOVER_PORT environment variable or config file.`
      )
    }
    this.httpServer = new ConsoleServer(
      { port, workspaceRoot: "" }, // workspaceRoot 不再使用
      this.projectRegistry
    )
    await this.httpServer.start()
    logger.info("GlobalCcloverService initialized")
  }

  /**
   * 加载配置并初始化所有 project
   */
  private async loadProjects(): Promise<void> {
    const config = await ConfigManager.load()

    if (config.projects.length === 0) {
      logger.warn("No projects configured in config file")
      logger.warn(`Please add projects to ${ConfigManager.getConfigPath()}`)
    }

    for (const projectConfig of config.projects) {
      if (projectConfig.enabled) {
        await this.initializeProject(projectConfig)
      }
    }
  }

  /**
   * 初始化单个 project
   */
  private async initializeProject(config: ProjectConfig): Promise<void> {
    const workspaceRoot = path.join(config.path, ".cclover/workspace")

    // 异步触发一下 opencode 去打开 config.path，确保它会为这个 project 加载插件注入 tools
    const opcodeClient = this.getOpencodeClient()
    opcodeClient.session
      .status({ query: { directory: config.path } })
      .catch((error) => {
        logger.error("Failed to connect to OpenCode server:", error)
      })

    // 确保 .cclover/.gitignore 存在（按需创建）
    await this.ensureCcloverGitignore(config.path)

    // 创建服务实例
    const projectId = ProjectRegistry.hashPath(config.path)
    const stateManager = new StateManager(projectId, workspaceRoot, config.path)
    const messageService = new MessageService(
      workspaceRoot,
      stateManager,
      projectId,
      this.bossManager || undefined
    )
    const memoryManager = new MemoryManager(
      workspaceRoot,
      stateManager,
      projectId
    )
    const agentRegistry = new AgentRegistry()
    const roleManager = new RoleManager(config.path)

    // 初始化 roleManager（加载所有 role）
    await roleManager.refresh()

    // 注册到 registry
    const projectInstance: ProjectInstance = {
      projectId: ProjectRegistry.hashPath(config.path),
      projectName: config.name,
      directory: config.path,
      workspaceRoot,
      stateManager,
      messageService,
      memoryManager,
      agentRegistry,
      bossManager: this.bossManager!,
      roleManager,
      eventLoopStarted: false, // 初始化时不启动 EventLoop
      eventLoops: new Map(), // 初始化 EventLoop Map
    }

    this.projectRegistry.register(projectInstance)
    // 不在这里启动 EventLoop，等待 CcloverPlugin 调用时再启动
    // 这样可以确保 tools 已经注册到 OpenCode
    logger.info(`Project initialized: ${config.name} (${config.path})`)
  }

  /**
   * 启动 project 的员工 EventLoop
   * 由 CcloverPlugin 调用，确保 tools 已注册
   */
  async startEmployees(project: ProjectInstance): Promise<void> {
    // 防止重复启动
    if (project.eventLoopStarted) {
      return
    }

    // 1. 从持久化文件加载员工列表
    await project.stateManager.loadEmployees()

    // 2. 注册初始员工（如果不存在）
    if (!project.stateManager.getEmployee("calculator")) {
      await project.stateManager.registerEmployee({
        name: "calculator",
        role: "calculator",
        status: "offline",
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      })
    }

    // 3. 加载历史事件到内存
    try {
      await project.stateManager.loadHistoricalEvents()
      logger.info(
        `Loaded historical events for project: ${project.projectName}`
      )
    } catch (error: any) {
      logger.error(
        `Failed to load historical events for project ${project.projectName}:`,
        error
      )
    }

    // 4. 为所有员工启动 EventLoop
    const employees = project.stateManager.getEmployees()
    const opcodeClient = this.getOpencodeClient()
    let startedCount = 0

    for (const employee of employees) {
      // 验证角色存在
      const role = project.roleManager.getRole(employee.role)
      if (!role) {
        logger.error(
          `Role '${employee.role}' not found for employee '${employee.name}', skipping EventLoop startup`
        )
        continue
      }

      const messageClient = project.messageService.getClient(employee.name)

      const eventLoop = new EventLoop(
        project.directory,
        employee.name,
        employee.role,
        project.roleManager,
        messageClient,
        project.memoryManager,
        opcodeClient,
        project.stateManager
      )

      // 存储到 project.eventLoops
      project.eventLoops.set(employee.name, eventLoop)

      // 后台运行
      eventLoop.run().catch((error) => {
        logger.error(`[${employee.name}] EventLoop crashed:`, error)
      })

      logger.info(`EventLoop started for employee: ${employee.name}`)
      startedCount++
    }

    // 标记为已启动
    project.eventLoopStarted = true
    logger.info(
      `Started ${startedCount}/${employees.length} EventLoops for project: ${project.projectName}`
    )

    if (startedCount < employees.length) {
      logger.error(
        `Failed to start ${employees.length - startedCount} EventLoops due to missing roles`
      )
    }
  }

  /**
   * 获取 project
   */
  getProject(directory: string): ProjectInstance | undefined {
    return this.projectRegistry.getByPath(directory)
  }

  /**
   * 获取所有 project
   */
  getAllProjects(): ProjectInstance[] {
    return this.projectRegistry.getAll()
  }

  /**
   * 获取 project registry
   */
  getProjectRegistry(): ProjectRegistry {
    return this.projectRegistry
  }
  /**
   * 获取 BossManager
   */
  getBossManager(): BossManager | null {
    return this.bossManager
  }

  /**
   * 动态添加 project
   */
  async addProject(config: ProjectConfig): Promise<void> {
    // 检查是否已存在
    const existing = this.projectRegistry.getByPath(config.path)
    if (existing) {
      throw new Error(`Project already initialized: ${config.path}`)
    }

    // 初始化项目
    await this.initializeProject(config)
    logger.info(`Project added dynamically: ${config.name} (${config.path})`)
  }

  /**
   * 动态删除 project
   */
  async removeProject(directory: string): Promise<void> {
    const project = this.projectRegistry.getByPath(directory)
    if (!project) {
      throw new Error(`Project not found: ${directory}`)
    }

    // 注销项目
    this.projectRegistry.unregister(project.projectId)
    logger.info(`Project removed: ${project.projectName} (${directory})`)
  }

  /**
   * 确保 .cclover/.gitignore 存在
   * 只在第一次需要时创建
   */
  private async ensureCcloverGitignore(projectRoot: string): Promise<void> {
    const ccloverDir = path.join(projectRoot, ".cclover")
    const gitignorePath = path.join(ccloverDir, ".gitignore")
    try {
      // 检查 .gitignore 是否已存在
      await fs.access(gitignorePath)
    } catch {
      // .gitignore 不存在，创建它
      try {
        // 确保 .cclover 目录存在
        await fs.mkdir(ccloverDir, { recursive: true })
        // 创建 .gitignore 忽略整个目录
        await fs.writeFile(gitignorePath, "*\n", "utf-8")
        logger.info(`Created .cclover/.gitignore for project: ${projectRoot}`)
      } catch (error) {
        logger.error(`Failed to create .cclover/.gitignore: ${error}`)
      }
    }
  }
}
