import type { OpencodeClient } from "@opencode-ai/sdk"
import type { MemoryManager, Memory } from "../MemoryManager"
import type { RoleManager } from "../RoleManager"
import type { StateManager } from "../../state/StateManager"
import type { EmployeeId } from "../../types"
import { buildSystemPrompt } from "../../utils/ContextBuilder"
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
  private readonly TOKEN_THRESHOLD = 100000 // 10万 token
  private readonly MESSAGE_THRESHOLD = 10000 // 消息轮数限制（实际由 token 限制控制）

  constructor(
    private projectPath: string,
    private employeeId: EmployeeId,
    private roleName: string,
    private roleManager: RoleManager,
    private memoryManager: MemoryManager,
    private opcodeClient: OpencodeClient,
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
    return role?.soul === false ? 80000 : 100000
  }

  /**
   * 设置 SummaryService（避免循环依赖）
   */
  setSummaryService(summaryService: any): void {
    this.summaryService = summaryService
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
    let memory = await this.memoryManager.read(this.employeeId)
    if (memory.sessionId) {
      try {
        // 验证 session 是否有效
        const session = await this.opcodeClient.session.get({
          path: { id: memory.sessionId },
        })

        if (session.data?.id) {
          // Session 有效，恢复
          logger.debug(
            `[${this.employeeId}] Restored session: ${memory.sessionId}`
          )

          // 获取消息数量
          const messages = await this.opcodeClient.session.messages({
            path: { id: memory.sessionId },
          })
          const messageCount = (messages.data ?? []).length

          // 注册 session
          sessionRegistry.register(memory.sessionId, this.employeeId)

          // 从快照重建系统提示词
          // 查询主管信息
          const employee = this.stateManager?.getEmployee(this.employeeId)
          let supervisor: { name: string; role: string } | undefined
          if (employee?.hiredBy) {
            const supervisorEmployee = this.stateManager?.getEmployee(
              employee.hiredBy
            )
            if (supervisorEmployee) {
              supervisor = {
                name: supervisorEmployee.name,
                role: supervisorEmployee.role,
              }
            }
          }

          const systemPrompt = memory.sessionSnapshot
            ? buildSystemPrompt(
                role.systemPrompt,
                memory.sessionSnapshot,
                this.employeeId,
                ".cclover/workspace",
                undefined, // TODO: Pass role metadata when RoleManager is updated
                supervisor
              )
            : buildSystemPrompt(
                role.systemPrompt,
                memory,
                this.employeeId,
                ".cclover/workspace",
                undefined, // TODO: Pass role metadata when RoleManager is updated
                supervisor
              ) // 降级：使用当前状态

          this.currentSession = {
            id: memory.sessionId,
            messageCount,
            tokenCount: 0,
            systemPrompt,
          }

          return this.currentSession
        }
      } catch (error) {
        // Session 无效，继续创建新的
        console.log(
          `[${this.employeeId}] Failed to restore session ${memory.sessionId}, creating new one`
        )
      }
    }

    // 创建新 session
    const response = await this.opcodeClient.session.create({
      body: {
        title: `${this.employeeId} - ${new Date().toISOString()}`,
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
    sessionRegistry.register(sessionId, this.employeeId)

    // 重新读取当前记忆（如果之前恢复失败，memory 可能是旧的）
    memory = await this.memoryManager.read(this.employeeId)

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
    memory.sessionId = sessionId
    await this.memoryManager.write(this.employeeId, memory)

    // 构建系统提示词（使用快照）
    // 查询主管信息
    const employee = this.stateManager?.getEmployee(this.employeeId)
    let supervisor: { name: string; role: string } | undefined
    if (employee?.hiredBy) {
      const supervisorEmployee = this.stateManager?.getEmployee(
        employee.hiredBy
      )
      if (supervisorEmployee) {
        supervisor = {
          name: supervisorEmployee.name,
          role: supervisorEmployee.role,
        }
      }
    }

    const systemPrompt = buildSystemPrompt(
      role.systemPrompt,
      memory.sessionSnapshot || {
        knowledge: memory.knowledge,
        tasks: memory.tasks,
        args: memory.args,
        timestamp: new Date().toISOString(),
      },
      this.employeeId,
      ".cclover/workspace",
      undefined, // TODO: Pass role metadata when RoleManager is updated
      supervisor
    )

    this.currentSession = {
      id: sessionId,
      messageCount: 0,
      tokenCount: 0,
      systemPrompt,
    }

    console.log(`[${this.employeeId}] Created session: ${sessionId}`)

    // 记录 session 创建事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_created",
      timestamp: new Date().toISOString(),
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

    console.log(
      `[${this.employeeId}] Closing session: ${this.currentSession.id}`
    )

    // 清除 memory 中的 sessionId 和快照
    const memory = await this.memoryManager.read(this.employeeId)
    memory.sessionId = undefined
    memory.sessionSnapshot = undefined
    await this.memoryManager.write(this.employeeId, memory)

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
        `[${this.employeeId}] No active session, skipping system prompt refresh`
      )
      return
    }

    // 获取最新的角色定义（验证角色是否存在）
    const role = this.roleManager.getRole(this.roleName)
    if (!role) {
      logger.error(
        `[${this.employeeId}] Role '${this.roleName}' not found during refresh`
      )
      return
    }

    // 读取当前记忆
    const memory = await this.memoryManager.read(this.employeeId)

    // 重新构建系统提示词（使用 sessionSnapshot 或当前状态）
    // 查询主管信息
    const employee = this.stateManager?.getEmployee(this.employeeId)
    let supervisor: { name: string; role: string } | undefined
    if (employee?.hiredBy) {
      const supervisorEmployee = this.stateManager?.getEmployee(
        employee.hiredBy
      )
      if (supervisorEmployee) {
        supervisor = {
          name: supervisorEmployee.name,
          role: supervisorEmployee.role,
        }
      }
    }

    const systemPrompt = memory.sessionSnapshot
      ? buildSystemPrompt(
          role.systemPrompt,
          memory.sessionSnapshot,
          this.employeeId,
          ".cclover/workspace",
          undefined, // TODO: Pass role metadata when RoleManager is updated
          supervisor
        )
      : buildSystemPrompt(
          role.systemPrompt,
          memory,
          this.employeeId,
          ".cclover/workspace",
          undefined, // TODO: Pass role metadata when RoleManager is updated
          supervisor
        )

    // 更新缓存的系统提示词
    this.currentSession.systemPrompt = systemPrompt

    logger.info(
      `[${this.employeeId}] System prompt refreshed for session ${this.currentSession.id} (preserved conversation history)`
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
      console.log(
        `[${this.employeeId}] Threshold reached (tokens: ${tokenCount}, messages: ${messageCount}), summarizing...`
      )

      // 1. 记录 session 总结开始事件
      await this.stateManager?.addEvent({
        projectId: "",
        type: "session_summary_started",
        timestamp: new Date().toISOString(),
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
        employeeId: this.employeeId,
        details: {
          sessionId,
          messageCount,
          tokenCount,
        },
      })

      // 6. 关闭当前 session
      await this.closeSession()

      console.log(`[${this.employeeId}] Summary completed`)
    }
  }
}
