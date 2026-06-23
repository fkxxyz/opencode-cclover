import type { OpencodeClient } from "@opencode-ai/sdk"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { MemoryManager, Memory } from "../MemoryManager"
import type { RoleManager } from "../RoleManager"
import type { StateManager } from "../../state/StateManager"
import type { EmployeeId, EmployeeWorkSessionId } from "../../types"
import type { EmployeeWorkSessionManager } from "../EmployeeWorkSessionManager"
import {
  buildSystemPrompt,
  type EmployeeContextFile,
} from "../../utils/ContextBuilder"
import { sessionRegistry } from "../../utils/SessionRegistry"
import { logger } from "../../lib/logger"

/**
 * Session 信息
 */
export interface SessionInfo {
  id: string
  messageCount: number
  tokenCount: number
  systemPrompt: string // 缓存的系统提示词
}

/**
 * Session 管理器
 * 负责 session 的创建、关闭、刷新系统提示词、总结触发
 */
export class SessionManager {
  private currentSession: SessionInfo | null = null
  private readonly TOKEN_THRESHOLD = 100000 // 10万 token（有灵魂角色默认阈值）
  private readonly MESSAGE_THRESHOLD = 10000 // 消息轮数限制（实际由 token 限制控制）

  constructor(
    private projectPath: string,
    private employeeWorkSessionId: EmployeeWorkSessionId,
    private employeeId: EmployeeId,
    private roleName: string,
    private roleManager: RoleManager,
    private memoryManager: MemoryManager,
    private opcodeClient: OpencodeClient,
    private employeeWorkSessionManager: EmployeeWorkSessionManager,
    private stateManager?: StateManager
  ) {}

  /**
   * 获取当前 session
   */
  getCurrentSession(): SessionInfo | null {
    return this.currentSession
  }

  /**
   * 增加消息计数
   */
  incrementMessageCount(): void {
    if (this.currentSession) {
      this.currentSession.messageCount++
    }
  }

  private summaryService: any | null = null

  private getTokenThreshold(): number {
    const role = this.roleManager.getRole(this.roleName)
    return role?.soul === false ? 160000 : 100000
  }

  /**
   * 设置 SummaryService（避免循环依赖）
   */
  setSummaryService(summaryService: any): void {
    this.summaryService = summaryService
  }

  private async buildPrompt(memory: Memory): Promise<string> {
    const role = this.roleManager.getRole(this.roleName)
    if (!role) {
      throw new Error(`Role '${this.roleName}' not found`)
    }
    const employee = this.stateManager?.getEmployee(this.employeeId)
    if (!employee) {
      throw new Error(`Employee '${this.employeeId}' not found`)
    }
    const employeeWorkSession =
      await this.employeeWorkSessionManager.getEmployeeWorkSession(
        this.employeeWorkSessionId
      )
    if (!employeeWorkSession) {
      throw new Error(
        `Employee work session '${this.employeeWorkSessionId}' not found`
      )
    }

    const employeeContextFiles: EmployeeContextFile[] = []
    for (const contextPath of employeeWorkSession.contextPathsSnapshot) {
      employeeContextFiles.push({
        path: contextPath,
        content: await fs.readFile(
          path.join(this.projectPath, contextPath),
          "utf-8"
        ),
      })
    }

    return buildSystemPrompt(
      role.systemPrompt,
      memory,
      { employee, employeeWorkSession },
      ".cclover/workspace",
      role,
      this.roleManager,
      employeeContextFiles
    )
  }

  /**
   * 确保 session 存在
   * 如果没有 session，创建新的；如果有，复用
   */
  async ensureSession(): Promise<SessionInfo> {
    // 动态获取最新的角色定义
    const role = this.roleManager.getRole(this.roleName)
    if (!role) {
      throw new Error(`Role '${this.roleName}' not found`)
    }

    if (this.currentSession) {
      return this.currentSession
    }

    // 尝试从 memory 恢复 session
    let memory = await this.memoryManager.read(this.employeeWorkSessionId)
    const storedSessionId = memory.opencodeSessionId ?? memory.sessionId
    if (storedSessionId) {
      try {
        // 验证 session 是否有效
        const session = await this.opcodeClient.session.get({
          path: { id: storedSessionId },
        })

        if (session.data?.id) {
          // Session 有效，恢复
          logger.debug(
            `[${this.employeeWorkSessionId}] Restored session: ${storedSessionId}`
          )

          // 获取消息数量
          const messages = await this.opcodeClient.session.messages({
            path: { id: storedSessionId },
          })
          const messageCount = (messages.data ?? []).length

          // 注册 session
          sessionRegistry.register(storedSessionId, this.employeeWorkSessionId)

          const systemPrompt = memory.sessionSnapshot
            ? await this.buildPrompt(memory.sessionSnapshot)
            : await this.buildPrompt(memory) // 降级：使用当前状态

          this.currentSession = {
            id: storedSessionId,
            messageCount,
            tokenCount: 0,
            systemPrompt,
          }

          return this.currentSession
        }
      } catch (error) {
        // Session 无效，继续创建新的
        logger.info(
          `[${this.employeeWorkSessionId}] Failed to restore session ${storedSessionId}, creating new one`
        )
      }
    }

    // 创建新 session
    const response = await this.opcodeClient.session.create({
      body: {
        title: `${this.employeeWorkSessionId} - ${new Date().toISOString()}`,
      },
      query: {
        directory: this.projectPath,
      },
    })

    const sessionId = response.data?.id

    if (!sessionId) {
      throw new Error("Failed to create session")
    }

    // 注册 session
    sessionRegistry.register(sessionId, this.employeeWorkSessionId)
    await this.employeeWorkSessionManager.updateOpenCodeSessionId(
      this.employeeWorkSessionId,
      sessionId
    )

    // 重新读取当前记忆（如果之前恢复失败，memory 可能是旧的）
    memory = await this.memoryManager.read(this.employeeWorkSessionId)

    // 保存快照（深拷贝）
    memory.sessionSnapshot = {
      knowledge: [...memory.knowledge],
      tasks: memory.tasks.map((t) => ({
        ...t,
        dependencies: [...t.dependencies],
      })),
      args: JSON.parse(JSON.stringify(memory.args)),
      timestamp: new Date().toISOString(),
    }
    memory.opencodeSessionId = sessionId
    await this.memoryManager.write(this.employeeWorkSessionId, memory)

    const systemPrompt = await this.buildPrompt(
      memory.sessionSnapshot ?? {
        knowledge: memory.knowledge,
        tasks: memory.tasks,
        args: memory.args,
        timestamp: new Date().toISOString(),
      }
    )

    this.currentSession = {
      id: sessionId,
      messageCount: 0,
      tokenCount: 0,
      systemPrompt,
    }

    logger.info(`[${this.employeeWorkSessionId}] Created session: ${sessionId}`)

    // 记录 session 创建事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_created",
      timestamp: new Date().toISOString(),
      employeeWorkSessionId: this.employeeWorkSessionId,
      employeeId: this.employeeId,
      details: {
        sessionId,
      },
    })

    return this.currentSession
  }

  /**
   * 关闭当前 session
   */
  async closeSession(): Promise<void> {
    if (!this.currentSession) return

    logger.info(
      `[${this.employeeWorkSessionId}] Closing session: ${this.currentSession.id}`
    )

    // 取消注册
    sessionRegistry.unregister(this.currentSession.id)

    this.currentSession = null
  }

  /**
   * 刷新系统提示词
   */
  async refreshSystemPrompt(): Promise<void> {
    // 如果没有活跃的 session，无需刷新
    if (!this.currentSession) {
      logger.debug(
        `[${this.employeeWorkSessionId}] No active session, skipping system prompt refresh`
      )
      return
    }

    // 获取最新的角色定义（验证角色是否存在）
    const role = this.roleManager.getRole(this.roleName)
    if (!role) {
      logger.error(
        `[${this.employeeWorkSessionId}] Role '${this.roleName}' not found during refresh`
      )
      return
    }

    // 读取当前记忆
    const memory = await this.memoryManager.read(this.employeeWorkSessionId)

    const systemPrompt = memory.sessionSnapshot
      ? await this.buildPrompt(memory.sessionSnapshot)
      : await this.buildPrompt(memory)

    // 更新缓存的系统提示词
    this.currentSession.systemPrompt = systemPrompt

    logger.info(
      `[${this.employeeWorkSessionId}] System prompt refreshed for session ${this.currentSession.id} (preserved conversation history)`
    )
  }

  /**
   * 检查是否需要总结
   * 达到 token 阈值或消息数阈值时触发总结
   */
  async summarizeIfNeeded(): Promise<void> {
    if (!this.currentSession) return

    // 获取所有消息以计算 token 数
    const messages = await this.opcodeClient.session.messages({
      path: { id: this.currentSession.id },
    })

    // 从最后一条 assistant 消息获取累计 token 数
    // 每条 assistant 消息的 tokens.total 是到那个时刻为止的累计值
    const assistantMessages = (messages.data ?? []).filter(
      (msg) => msg.info.role === "assistant"
    )
    const tokenCount =
      assistantMessages.length > 0
        ? ((assistantMessages[assistantMessages.length - 1].info as any).tokens
            ?.total ?? 0)
        : 0

    const messageCount = this.currentSession.messageCount

    // 检查是否达到阈值
    const tokenThreshold = this.getTokenThreshold()
    if (
      tokenCount >= tokenThreshold ||
      messageCount >= this.MESSAGE_THRESHOLD
    ) {
      logger.info(
        `[${this.employeeWorkSessionId}] Threshold reached (tokens: ${tokenCount}, messages: ${messageCount}), summarizing...`
      )

      // 1. 记录 session 总结开始事件
      await this.stateManager?.addEvent({
        projectId: "",
        type: "session_summary_started",
        timestamp: new Date().toISOString(),
        employeeWorkSessionId: this.employeeWorkSessionId,
        employeeId: this.employeeId,
        details: {
          sessionId: this.currentSession.id,
          messageCount,
          tokenCount,
        },
      })

      // 2. 请求 AI 总结
      if (!this.summaryService) {
        throw new Error("SummaryService not set")
      }
      const summary = await this.summaryService.requestSummary(
        this.currentSession.id
      )

      // 3. 保存总结
      await this.summaryService.saveSummary(summary)

      // 4. 保存 sessionId（closeSession 会把 currentSession 设为 null）
      const sessionId = this.currentSession.id

      // 5. 记录 session 总结完成事件
      await this.stateManager?.addEvent({
        projectId: "",
        type: "session_summary_completed",
        timestamp: new Date().toISOString(),
        employeeWorkSessionId: this.employeeWorkSessionId,
        employeeId: this.employeeId,
        details: {
          sessionId,
          messageCount,
          tokenCount,
        },
      })

      // 6. 关闭当前 session
      await this.closeSession()

      logger.info(`[${this.employeeWorkSessionId}] Summary completed`)
    }
  }
}
