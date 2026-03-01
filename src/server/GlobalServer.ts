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
import { AgentRegistry } from "../utils/AgentRegistry"
import { EventLoop } from "../core/EventLoop"
import { CalculatorRole } from "../roles"
import { createOpencodeClient } from "@opencode-ai/sdk"
import { logger } from "../lib/logger"

/**
 * 全局 Cclover 服务
 * 单例模式，管理所有 project 实例和 HTTP 服务
 */
export class GlobalCcloverService {
  private static instance: GlobalCcloverService | null = null
  private projectRegistry: ProjectRegistry = new ProjectRegistry()
  private httpServer: ConsoleServer | null = null
  private initialized: boolean = false

  private constructor() {}

  /**
   * 获取单例
   */
  static async getInstance(): Promise<GlobalCcloverService> {
    if (!this.instance) {
      this.instance = new GlobalCcloverService()
      await this.instance.initialize()
    }
    return this.instance
  }

  /**
   * 初始化服务
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info("Initializing GlobalCcloverService...")

    // 1. 加载配置并初始化所有 project
    await this.loadProjects()

    // 2. 启动 HTTP 服务(单例)
    this.httpServer = new ConsoleServer(
      { port: 4097, workspaceRoot: "" }, // workspaceRoot 不再使用
      this.projectRegistry
    )
    await this.httpServer.start()

    this.initialized = true
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

    // 确保 .cclover/.gitignore 存在（按需创建）
    await this.ensureCcloverGitignore(config.path)

    // 创建服务实例
    const projectId = ProjectRegistry.hashPath(config.path)
    const stateManager = new StateManager(projectId)
    const messageService = new MessageService(
      workspaceRoot,
      stateManager,
      projectId
    )
    const memoryManager = new MemoryManager(
      workspaceRoot,
      stateManager,
      projectId
    )
    const agentRegistry = new AgentRegistry()

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
    }

    this.projectRegistry.register(projectInstance)

    // 启动员工
    this.startEmployees(projectInstance)

    logger.info(`Project initialized: ${config.name} (${config.path})`)
  }

  /**
   * 启动 project 的员工
   */
  private startEmployees(project: ProjectInstance): void {
    // 注册初始员工
    project.stateManager.registerEmployee({
      name: "calculator",
      role: "calculator",
      status: "inactive",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })

    // 启动员工 EventLoop
    const messageClient = project.messageService.getClient("calculator")
    const opcodeClient = createOpencodeClient()

    const eventLoop = new EventLoop(
      "calculator",
      CalculatorRole,
      messageClient,
      project.memoryManager,
      opcodeClient,
      project.stateManager
    )

    // 后台运行
    eventLoop.run().catch((error) => {
      logger.error(`[calculator] EventLoop crashed:`, error)
    })
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
