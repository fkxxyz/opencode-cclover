import * as fs from "node:fs/promises"
import path from "node:path"
import { ConfigManager } from "../config/ConfigManager"
import type { ProjectConfig } from "../config/ConfigManager"
import {
  ModelConfigManager,
  loadPresetConfig,
} from "../config/ModelConfigManager"
import { ProjectRegistry } from "./ProjectRegistry"
import type { ProjectInstance } from "./ProjectRegistry"
import { ConsoleServer } from "./index"
import { StateManager } from "../state/StateManager"
import { MessageService } from "../core/MessageService"
import { MemoryManager } from "../core/MemoryManager"
import { BossManager } from "../core/BossManager"
import { RoleManager } from "../core/RoleManager"
import { FeedbackManager } from "../core/FeedbackManager"
import { EmployeeWorkSessionManager } from "../core/EmployeeWorkSessionManager"
import { EventLoop } from "../core/eventloop"
import { OpencodeClient } from "@opencode-ai/sdk"
import { logger } from "../lib/logger"
import type { InternalPromptRecoveryEvent } from "../core/eventloop/EventLoop"
import { MeetingModePromptInjector } from "../meeting-mode/PromptInjector"
import type { EmployeeWorkSession, EmployeeWorkSessionId } from "../types"

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
    // 1. 加载配置
    const config = await ConfigManager.load()
    // 注意：BossManager 在这里不传 workspaceRoot，因为它是全局的
    // 每个 project 会有自己的 workspaceRoot
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
    // 为每个 project 创建独立的 BossManager 实例（带 workspaceRoot）
    const projectBossManager = new BossManager(
      await ConfigManager.load(),
      workspaceRoot
    )
    const roleManager = new RoleManager(config.path)
    const employeeWorkSessionManager = new EmployeeWorkSessionManager(
      config.path,
      stateManager,
      roleManager
    )
    const messageService = new MessageService(
      workspaceRoot,
      stateManager,
      projectId,
      projectBossManager,
      opcodeClient,
      employeeWorkSessionManager
    )
    const memoryManager = new MemoryManager(
      workspaceRoot,
      stateManager,
      projectId
    )
    const meetingModePromptInjector = new MeetingModePromptInjector(
      projectId,
      config.name
    )

    // 创建 ModelConfigManager
    const globalConfig = await ConfigManager.load()
    const presetConfig = await loadPresetConfig()
    const modelConfigManager = new ModelConfigManager(
      globalConfig,
      presetConfig
    )

    // 验证模型配置
    try {
      modelConfigManager.validate()
    } catch (error) {
      logger.error("Model config validation failed:", error)
      throw error
    }

    // 初始化 roleManager（加载所有 role）
    await roleManager.refresh()

    // 创建 FeedbackManager
    const feedbackManager = new FeedbackManager(
      workspaceRoot,
      messageService,
      stateManager
    )

    // 注册到 registry
    const projectInstance: ProjectInstance = {
      projectId: ProjectRegistry.hashPath(config.path),
      projectName: config.name,
      directory: config.path,
      workspaceRoot,
      stateManager,
      messageService,
      memoryManager,
      employeeWorkSessionManager,
      bossManager: projectBossManager,
      roleManager,
      modelConfigManager,
      meetingModePromptInjector,
      feedbackManager,
      eventLoopStarted: false, // 初始化时不启动 EventLoop
      eventLoopStarting: null,
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
    logger.debug(
      `[GlobalServer] startEmployees called for project: ${project.projectName}`
    )

    // 1) 如果已经启动完成，直接返回
    if (project.eventLoopStarted) {
      logger.debug(
        `[GlobalServer] EventLoop already started for project: ${project.projectName}`
      )
      return
    }

    // 2) 并发安全防重：如果启动进行中，复用同一个 Promise
    if (project.eventLoopStarting) {
      logger.debug(
        `[GlobalServer] EventLoop startup already in progress for project: ${project.projectName}`
      )
      await project.eventLoopStarting
      return
    }

    // 3) 建立一次性启动锁
    project.eventLoopStarting = (async () => {
      try {
        // 1. 从持久化文件加载员工列表
        logger.debug(
          `[GlobalServer] Loading employees for project: ${project.projectName}`
        )
        await project.stateManager.loadEmployees()
        logger.debug(
          `[GlobalServer] Employees loaded for project: ${project.projectName}`
        )

        // 2. 加载历史事件到内存
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

        // 3. 为所有未关闭的 EmployeeWorkSession 启动 EventLoop
        const employeeWorkSessions = (
          await project.employeeWorkSessionManager.listEmployeeWorkSessions()
        ).filter((session) => session.status !== "closed")
        const promptRecoveries = new Map<
          EmployeeWorkSessionId,
          InternalPromptRecoveryEvent
        >()
        for (const session of employeeWorkSessions) {
          if (!session.promptRecovery) {
            continue
          }
          promptRecoveries.set(session.employeeWorkSessionId, {
            type: "prompt_recovery",
            timestamp: new Date().toISOString(),
            sessionId: session.promptRecovery.sessionId,
            startedAt: session.promptRecovery.startedAt,
            triggerEventType: session.promptRecovery.triggerEventType,
            version: session.promptRecovery.version,
          })
        }
        logger.debug(
          `[GlobalServer] Found ${employeeWorkSessions.length} active employee work sessions for project: ${project.projectName}`
        )
        logger.debug(
          `[GlobalServer] Employee work session list: ${employeeWorkSessions.map((s) => s.employeeWorkSessionId).join(", ")}`
        )
        const opcodeClient = this.getOpencodeClient()
        let startedCount = 0
        let missingRoleCount = 0
        let startErrorCount = 0

        for (const employeeWorkSession of employeeWorkSessions) {
          const employee = project.stateManager.getEmployee(
            employeeWorkSession.employeeId
          )
          try {
            if (!employee) {
              startErrorCount++
              logger.error(
                `[GlobalServer] Employee '${employeeWorkSession.employeeId}' not found for employee work session '${employeeWorkSession.employeeWorkSessionId}', skipping EventLoop startup`
              )
              continue
            }

            logger.debug(
              `[GlobalServer] Processing employee work session: ${employeeWorkSession.employeeWorkSessionId} (employee: ${employee.name}, role: ${employee.roleId})`
            )

            // 验证角色存在
            const role = project.roleManager.getRole(employee.roleId)
            if (!role) {
              missingRoleCount++
              logger.error(
                `Role '${employee.roleId}' not found for employee '${employee.name}', skipping EventLoop startup`
              )
              continue
            }

            // 未关闭的工作会话恢复为可运行状态
            await project.employeeWorkSessionManager.updateStatus(
              employeeWorkSession.employeeWorkSessionId,
              "idle"
            )

            const messageClient = project.messageService.getClient(
              employeeWorkSession.employeeWorkSessionId
            )

            logger.debug(
              `[GlobalServer] Creating EventLoop for employee work session: ${employeeWorkSession.employeeWorkSessionId}`
            )
            const eventLoop = new EventLoop(
              project.directory,
              employeeWorkSession.employeeWorkSessionId,
              employee.employeeId,
              employee.roleId,
              project.roleManager,
              messageClient,
              project.memoryManager,
              opcodeClient,
              project.modelConfigManager,
              project.employeeWorkSessionManager,
              project.stateManager
            )

            const promptRecovery = promptRecoveries.get(
              employeeWorkSession.employeeWorkSessionId
            )
            if (promptRecovery) {
              eventLoop.enqueuePromptRecovery(promptRecovery)
            }

            // 存储到 project.eventLoops
            project.eventLoops.set(
              employeeWorkSession.employeeWorkSessionId,
              eventLoop
            )

            // 后台运行
            logger.debug(
              `[GlobalServer] Starting EventLoop.run() for employee: ${employee.name}`
            )
            eventLoop.run().catch((error: any) => {
              logger.error(
                `[${employeeWorkSession.employeeWorkSessionId}] EventLoop crashed:`,
                error
              )
            })

            logger.debug(
              `EventLoop started for employee work session: ${employeeWorkSession.employeeWorkSessionId}`
            )
            startedCount++
          } catch (error: any) {
            startErrorCount++
            logger.error(
              `[GlobalServer] Failed to start EventLoop for employee work session '${employeeWorkSession.employeeWorkSessionId}':`,
              error
            )
            // 继续处理下一个员工
          }
        }

        // 标记为已启动
        project.eventLoopStarted = true
        logger.info(
          `Started ${startedCount}/${employeeWorkSessions.length} EventLoops for project: ${project.projectName}`
        )

        if (missingRoleCount > 0) {
          logger.error(
            `Failed to start ${missingRoleCount} EventLoops due to missing roles`
          )
        }
        if (startErrorCount > 0) {
          logger.error(
            `Failed to start ${startErrorCount} EventLoops due to startup errors`
          )
        }
      } finally {
        // 无论成功失败都要清理启动锁；失败时允许后续重试
        project.eventLoopStarting = null
      }
    })()

    await project.eventLoopStarting
    return
  }

  /**
   * 启动单个 EmployeeWorkSession 的 EventLoop
   * @param projectId 项目 ID
   * @param employeeWorkSessionId 员工工作会话 ID
   */
  async startEmployeeWorkSessionEventLoop(
    projectId: string,
    employeeWorkSessionId: EmployeeWorkSessionId
  ): Promise<void> {
    // 1. 获取项目实例
    const project = this.projectRegistry.get(projectId)
    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    // 2. 验证员工工作会话和员工存在
    const employeeWorkSession =
      await project.employeeWorkSessionManager.getEmployeeWorkSession(
        employeeWorkSessionId
      )
    if (!employeeWorkSession) {
      throw new Error(
        `Employee work session not found: ${employeeWorkSessionId}`
      )
    }
    if (employeeWorkSession.status === "closed") {
      throw new Error(
        `Employee work session is closed: ${employeeWorkSessionId}`
      )
    }

    const employee = project.stateManager.getEmployee(
      employeeWorkSession.employeeId
    )
    if (!employee) {
      throw new Error(`Employee not found: ${employeeWorkSession.employeeId}`)
    }

    // 3. 检查 EventLoop 是否已运行
    if (project.eventLoops.has(employeeWorkSessionId)) {
      logger.warn(
        `[${projectId}] EventLoop already running for employee work session: ${employeeWorkSessionId}`
      )
      return
    }

    // 4. 验证角色存在
    const role = project.roleManager.getRole(employee.roleId)
    if (!role) {
      throw new Error(
        `Role '${employee.roleId}' not found for employee '${employee.employeeId}'`
      )
    }

    // 5. 获取 messageClient
    const messageClient = project.messageService.getClient(
      employeeWorkSessionId
    )

    // 6. 创建 EventLoop（参考 startEmployees() 的实现）
    const opcodeClient = this.getOpencodeClient()
    const eventLoop = new EventLoop(
      project.directory,
      employeeWorkSessionId,
      employee.employeeId,
      employee.roleId,
      project.roleManager,
      messageClient,
      project.memoryManager,
      opcodeClient,
      project.modelConfigManager,
      project.employeeWorkSessionManager,
      project.stateManager
    )

    // 7. 存储到 Map（使用 employeeWorkSessionId 作为 key）
    project.eventLoops.set(employeeWorkSessionId, eventLoop)

    // 8. 启动 EventLoop
    eventLoop.run().catch((error: any) => {
      logger.error(`[${employeeWorkSessionId}] EventLoop crashed:`, error)
    })

    logger.info(
      `[${projectId}] Started EventLoop for employee work session: ${employeeWorkSessionId} (employee: ${employee.name})`
    )
  }

  /**
   * 关闭 EmployeeWorkSession 并停止对应 EventLoop
   */
  async closeEmployeeWorkSession(
    projectId: string,
    employeeWorkSessionId: EmployeeWorkSessionId,
    closedBy: NonNullable<EmployeeWorkSession["closedBy"]>,
    reason?: string
  ): Promise<EmployeeWorkSession> {
    const project = this.projectRegistry.get(projectId)
    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    const eventLoop = project.eventLoops.get(employeeWorkSessionId)
    if (eventLoop) {
      await eventLoop.stop()
      project.eventLoops.delete(employeeWorkSessionId)
    }

    return await project.employeeWorkSessionManager.closeEmployeeWorkSession({
      employeeWorkSessionId,
      closedBy,
      reason,
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
