import type { OpencodeClient } from "@opencode-ai/sdk"
import type { MessageClient } from "./MessageService"
import type { Message, Event, RoleMetadata } from "../types"
import type { MemoryManager, Memory, Task } from "./MemoryManager"
import type { RoleManager } from "./RoleManager"
import { buildSystemPrompt, buildEventMessage } from "../utils/ContextBuilder"
import { agentRegistry } from "../utils/AgentRegistry"
import { sessionRegistry } from "../utils/SessionRegistry"
import type { StateManager } from "../state/StateManager"
import { logger } from "../lib/logger"

/**
 * 角色定义
 */
export interface Role {
  name: string
  systemPrompt: string
}

/**
 * Internal agent event type (for agentRegistry queue)
 */
export interface InternalAgentEvent {
  type: "agent_completed"
  agentId: string
  taskName: string
  result: string
  timestamp: string
}

/**
 * Session 信息
 */
interface SessionInfo {
  id: string
  messageCount: number
  tokenCount: number
  systemPrompt: string // 缓存的系统提示词
}

/**
 * 进展快照
 * 用于检测员工是否在任务事件中无限循环
 */
interface ProgressSnapshot {
  agentCount: number
  tasksHash: string
}

/**
 * 事件循环
 * 员工的核心运行机制，负责等待事件、处理事件、调用 AI、管理 session 生命周期
 */
export class EventLoop {
  private currentSession: SessionInfo | null = null
  private readonly TOKEN_THRESHOLD = 100000 // 10万 token
  private readonly MESSAGE_THRESHOLD = 10000 // 消息轮数限制（实际由 token 限制控制）
  private readonly NO_PROGRESS_THRESHOLD = 3 // 无进展阈值
  private progressSnapshot: ProgressSnapshot | null = null
  private noProgressCount = 0
  constructor(
    private projectPath: string,
    private employeeName: string,
    private roleName: string,
    private roleManager: RoleManager,
    private messageClient: MessageClient,
    private memoryManager: MemoryManager,
    private opcodeClient: OpencodeClient,
    private stateManager?: StateManager
  ) {}

  /**
   * 主循环
   */
  async run(): Promise<void> {
    logger.debug(
      `[${this.employeeName}] Starting event loop for project ${this.projectPath} with role ${this.roleName}`
    )

    // 启动 Agent 监听器（后台运行，不阻塞）
    this.waitForAgentCompletion().catch((error) => {
      console.error(`[${this.employeeName}] Agent listener error:`, error)
    })

    // 启动时检查是否有立即可用的事件，决定初始状态
    const hasImmediate = await this.hasImmediateEvent()
    await this.stateManager?.updateEmployeeStatus(
      this.employeeName,
      hasImmediate ? "busy" : "idle"
    )

    // 启动时确保 session 存在并检查是否需要总结
    // 这样可以在恢复已有 session 时立即触发总结（如果已超过阈值）
    try {
      await this.ensureSession()
      await this.summarizeIfNeeded()
    } catch (error) {
      console.error(
        `[${this.employeeName}] Error during startup session check:`,
        error
      )
    }

    while (true) {
      try {
        // 1. 检查是否有立即可用的事件
        const hasImmediate = await this.hasImmediateEvent()

        // 2. 只有在没有立即可用事件时，才设置为 idle
        if (!hasImmediate) {
          await this.stateManager?.updateEmployeeStatus(
            this.employeeName,
            "idle"
          )
        }

        // 3. 等待事件
        const event = await this.waitForEvent()
        console.log(`[${this.employeeName}] Received event:`, event.type)
        if (event.type === "message") {
          console.log(
            `[${this.employeeName}] Message from ${event.details.from}: ${event.details.content}`
          )
        } else if (event.type === "agent_completed") {
          console.log(
            `[${this.employeeName}] Agent completed: ${event.details.taskName}, result: ${event.details.result}`
          )
        }

        // 4. 更新状态为 busy（处理事件）
        await this.stateManager?.updateEmployeeStatus(this.employeeName, "busy")

        // 5. 处理事件
        await this.handleEvent(event)

        // 6. 检查是否需要总结
        await this.summarizeIfNeeded()
      } catch (error) {
        console.error(`[${this.employeeName}] Error in event loop:`, error)
        // 更新状态为 error
        await this.stateManager?.updateEmployeeStatus(
          this.employeeName,
          "error"
        )
        // 继续循环，不退出
      }
    }
  }

  /**
   * 等待事件
   * 按优先级顺序检查：消息 > Agent完成 > 可执行任务 > in_progress任务
   */
  private async waitForEvent(): Promise<Event> {
    // 1. 非阻塞检查未读消息
    const messageService = (this.messageClient as any).service
    const unreadQueue = messageService.getUnreadQueue(this.employeeName)
    if (unreadQueue.length > 0) {
      const msg = unreadQueue.shift()!
      // 收到消息，清空快照和计数器
      this.clearProgressTracking()
      return {
        projectId: "",
        type: "message",
        timestamp: msg.timestamp,
        details: {
          from: msg.from,
          to: msg.to,
          content: msg.content,
          ...(msg.fromRole && { fromRole: msg.fromRole }),
        },
      }
    }

    // 2. 非阻塞检查 Agent 完成队列
    const completedAgent = agentRegistry.getCompletedEvent(this.employeeName)
    if (completedAgent) {
      // Agent 完成，清空快照和计数器
      this.clearProgressTracking()
      return {
        projectId: "",
        type: "agent_completed",
        timestamp: completedAgent.timestamp,
        details: {
          agentId: completedAgent.agentId,
          taskName: completedAgent.taskName,
          result: completedAgent.result,
        },
      }
    }

    // 3. 检查是否有运行中的 Agent
    const runningAgents = agentRegistry.getAgentsByEmployee(this.employeeName)
    const hasRunningAgent = runningAgents.length > 0

    // 4. 获取当前员工状态
    const employee = await this.stateManager?.getEmployee(this.employeeName)
    const isAbnormal = employee?.status === "abnormal"

    // 只有在没有运行中的 Agent 且不是异常状态时才检查任务
    if (!hasRunningAgent && !isAbnormal) {
      // 5. 检查可执行任务
      const executableTasks = await this.memoryManager.getExecutableTasks(
        this.employeeName
      )
      if (executableTasks.length > 0) {
        return {
          projectId: "",
          type: "task_available",
          timestamp: new Date().toISOString(),
          details: {
            tasks: executableTasks,
          },
        }
      }

      // 6. 检查 in_progress 任务
      const inProgressTasks = await this.memoryManager.getInProgressTasks(
        this.employeeName
      )
      if (inProgressTasks.length > 0) {
        return {
          projectId: "",
          type: "task_reminder",
          timestamp: new Date().toISOString(),
          details: {
            tasks: inProgressTasks,
          },
        }
      }
    }

    // 7. 以上都没有，阻塞等待
    return Promise.race([this.waitForMessage(), this.waitForAgentCompletion()])
  }

  /**
   * 检查是否有立即可用的事件
   * 用于避免不必要的 idle 状态切换
   */
  private async hasImmediateEvent(): Promise<boolean> {
    // 1. 检查未读消息
    const messageService = (this.messageClient as any).service
    const unreadQueue = messageService.getUnreadQueue(this.employeeName)
    if (unreadQueue.length > 0) return true

    // 2. 检查 Agent 完成队列
    const completedAgent = agentRegistry.getCompletedEvent(this.employeeName)
    if (completedAgent) {
      // 放回队列（因为只是检查，不是真正取出）
      agentRegistry.addCompletedEvent(this.employeeName, completedAgent)
      return true
    }

    // 3. 检查是否有运行中的 Agent
    const runningAgents = agentRegistry.getAgentsByEmployee(this.employeeName)
    const hasRunningAgent = runningAgents.length > 0

    // 只有在没有运行中的 Agent 时才检查任务
    if (!hasRunningAgent) {
      // 4. 检查可执行任务
      const executableTasks = await this.memoryManager.getExecutableTasks(
        this.employeeName
      )
      if (executableTasks.length > 0) return true

      // 5. 检查 in_progress 任务
      const inProgressTasks = await this.memoryManager.getInProgressTasks(
        this.employeeName
      )
      if (inProgressTasks.length > 0) return true
    }

    return false
  }

  /**
   * 等待新消息
   */
  private async waitForMessage(): Promise<Event> {
    const msg = await this.messageClient.recv()
    return {
      projectId: "",
      type: "message",
      timestamp: msg.timestamp,
      details: {
        from: msg.from,
        to: msg.to,
        content: msg.content,
        ...(msg.fromRole && { fromRole: msg.fromRole }),
      },
    }
  }

  /**
   * 等待 Agent 完成
   * 订阅 OpenCode 事件流，监听 session 状态变化
   * 将完成的 agent 放入队列，而不是直接返回
   */
  private async waitForAgentCompletion(): Promise<Event> {
    // 订阅 OpenCode 事件流
    const events = await this.opcodeClient.event.subscribe()

    for await (const event of events.stream) {
      // 监听 message.updated 事件（assistant 消息完成）
      if (event.type === "message.updated") {
        const msg = (event as any).properties.info
        if (msg.role === "assistant" && msg.time.completed) {
          const sessionId = msg.sessionID

          // 检查是否是我们创建的 agent
          const agentInfo = agentRegistry.getInfo(sessionId)
          if (agentInfo) {
            // 获取 agent 的最后一条消息作为结果
            const result = await this.getAgentResult(sessionId)

            // 取消注册
            agentRegistry.unregister(sessionId)

            // 创建事件对象
            const agentEvent: InternalAgentEvent = {
              type: "agent_completed",
              agentId: sessionId,
              taskName: agentInfo.taskName,
              result,
              timestamp: new Date().toISOString(),
            }

            // 记录 agent 完成事件
            await this.stateManager?.addEvent({
              projectId: "",
              type: "agent_completed",
              timestamp: agentEvent.timestamp,
              employeeName: this.employeeName,
              details: {
                agentId: sessionId,
                taskName: agentInfo.taskName,
                result,
              },
            })

            // 如果是当前员工的 agent，放入队列
            if (agentInfo.employeeName === this.employeeName) {
              agentRegistry.addCompletedEvent(this.employeeName, agentEvent)
            }

            // 继续监听（不返回，让 waitForEvent 从队列中取）
          }
        }
      }
    }

    // 永远不会到达这里（for await 会一直等待）
    throw new Error("Unexpected end of event stream")
  }

  /**
   * 获取 Agent 的执行结果
   */
  private async getAgentResult(sessionId: string): Promise<string> {
    try {
      // 获取 session 的消息列表
      const messages = await this.opcodeClient.session.messages({
        path: { id: sessionId },
      })

      // 找到最后一条 assistant 消息
      const assistantMessages = (messages.data ?? []).filter(
        (m) => m.info.role === "assistant"
      )

      if (assistantMessages.length === 0) {
        return "Agent 未返回任何结果"
      }

      const lastMessage = assistantMessages[assistantMessages.length - 1]

      // 提取文本内容
      const textParts = lastMessage.parts.filter((p) => p.type === "text")
      if (textParts.length === 0) {
        return "Agent 未返回文本结果"
      }

      return textParts.map((p) => (p as any).text).join("\n")
    } catch (error) {
      console.error(`[${this.employeeName}] Failed to get agent result:`, error)
      return "获取 Agent 结果失败"
    }
  }

  /**
   * 处理事件
   */
  private async handleEvent(event: Event): Promise<void> {
    console.log(`[${this.employeeName}] Received event:`, event.type)

    // 1. 如果是消息或 agent 事件，清空快照并恢复正常状态
    if (event.type === "message" || event.type === "agent_completed") {
      this.clearProgressTracking()
      const employee = await this.stateManager?.getEmployee(this.employeeName)
      if (employee?.status === "abnormal") {
        await this.stateManager?.updateEmployeeStatus(this.employeeName, "busy")
        logger.info(
          `[${this.employeeName}] Recovered from abnormal status due to ${event.type} event`
        )
      }
    }

    // 2. 确保 session 存在
    const session = await this.ensureSession()
    console.log(
      `[${this.employeeName}] Handling event in session: ${session.id}`
    )

    // 3. 读取当前记忆
    const memory = await this.memoryManager.read(this.employeeName)

    // 4. 构建事件消息
    const eventMessage = buildEventMessage(event)

    // 5. 使用缓存的系统提示词（每次都传递）
    const systemPrompt = this.currentSession!.systemPrompt

    // 6. 记录 session prompt 开始事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_prompt_started",
      timestamp: new Date().toISOString(),
      employeeName: this.employeeName,
      details: {
        sessionId: session.id,
        eventType: event.type,
        messageCount: session.messageCount,
      },
    })

    // 7. 发送给 AI
    await this.opcodeClient.session.prompt({
      path: { id: session.id },
      body: {
        agent: "cclover-empty-agent", // 使用空 agent 避免预设提示词污染
        system: systemPrompt,
        parts: [{ type: "text", text: eventMessage }],
        tools: {
          send_message: true,
          edit_tasks: true,
          create_agent: true,
        },
      },
      headers: {
        "x-opencode-directory": this.projectPath,
      },
    })

    // 8. 更新 session 信息
    this.currentSession!.messageCount++

    // 9. 记录 session prompt 完成事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_prompt_completed",
      timestamp: new Date().toISOString(),
      employeeName: this.employeeName,
      details: {
        sessionId: session.id,
        messageCount: session.messageCount,
      },
    })

    // 10. 如果是任务事件，检测进展
    if (event.type === "task_available" || event.type === "task_reminder") {
      await this.checkProgress()
    }

    console.log(`[${this.employeeName}] Event handled`)
  }

  /**
   * 确保 session 存在
   * 如果没有 session，创建新的；如果有，复用
   */
  private async ensureSession(): Promise<SessionInfo> {
    // 动态获取最新的角色定义
    const role = this.roleManager.getRole(this.roleName)
    if (!role) {
      throw new Error(`Role '${this.roleName}' not found`)
    }

    if (this.currentSession) {
      return this.currentSession
    }

    // 尝试从 memory 恢复 session
    let memory = await this.memoryManager.read(this.employeeName)
    if (memory.sessionId) {
      try {
        // 验证 session 是否有效
        const session = await this.opcodeClient.session.get({
          path: { id: memory.sessionId },
        })

        if (session.data?.id) {
          // Session 有效，恢复
          logger.debug(
            `[${this.employeeName}] Restored session: ${memory.sessionId}`
          )

          // 获取消息数量
          const messages = await this.opcodeClient.session.messages({
            path: { id: memory.sessionId },
          })
          const messageCount = (messages.data ?? []).length

          // 注册 session
          sessionRegistry.register(memory.sessionId, this.employeeName)

          // 从快照重建系统提示词
          // 查询主管信息
          const employee = this.stateManager?.getEmployee(this.employeeName)
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
                this.employeeName,
                ".cclover/workspace",
                undefined, // TODO: Pass role metadata when RoleManager is updated
                supervisor
              )
            : buildSystemPrompt(
                role.systemPrompt,
                memory,
                this.employeeName,
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
          `[${this.employeeName}] Failed to restore session ${memory.sessionId}, creating new one`
        )
      }
    }

    // 创建新 session
    const response = await this.opcodeClient.session.create({
      body: {
        title: `${this.employeeName} - ${new Date().toISOString()}`,
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
    sessionRegistry.register(sessionId, this.employeeName)

    // 重新读取当前记忆（如果之前恢复失败，memory 可能是旧的）
    memory = await this.memoryManager.read(this.employeeName)

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
    await this.memoryManager.write(this.employeeName, memory)

    // 构建系统提示词（使用快照）
    // 查询主管信息
    const employee = this.stateManager?.getEmployee(this.employeeName)
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
      this.employeeName,
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

    console.log(`[${this.employeeName}] Created session: ${sessionId}`)

    // 记录 session 创建事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "session_created",
      timestamp: new Date().toISOString(),
      employeeName: this.employeeName,
      details: {
        sessionId,
      },
    })

    return this.currentSession
  }

  /**
   * 关闭当前 session
   */
  private async closeSession(): Promise<void> {
    if (!this.currentSession) return

    console.log(
      `[${this.employeeName}] Closing session: ${this.currentSession.id}`
    )

    // 清除 memory 中的 sessionId 和快照
    const memory = await this.memoryManager.read(this.employeeName)
    memory.sessionId = undefined
    memory.sessionSnapshot = undefined
    await this.memoryManager.write(this.employeeName, memory)

    // 取消注册
    sessionRegistry.unregister(this.currentSession.id)

    this.currentSession = null
  }

  /**
   * 检查是否需要总结
   * 达到 token 阈值或消息数阈值时触发总结
   */
  private async summarizeIfNeeded(): Promise<void> {
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
    if (
      tokenCount >= this.TOKEN_THRESHOLD ||
      messageCount >= this.MESSAGE_THRESHOLD
    ) {
      console.log(
        `[${this.employeeName}] Threshold reached (tokens: ${tokenCount}, messages: ${messageCount}), summarizing...`
      )

      // 1. 记录 session 总结开始事件
      await this.stateManager?.addEvent({
        projectId: "",
        type: "session_summary_started",
        timestamp: new Date().toISOString(),
        employeeName: this.employeeName,
        details: {
          sessionId: this.currentSession.id,
          messageCount,
          tokenCount,
        },
      })

      // 2. 请求 AI 总结
      const summary = await this.requestSummary()

      // 3. 保存总结
      await this.saveSummary(summary)

      // 4. 保存 sessionId（closeSession 会把 currentSession 设为 null）
      const sessionId = this.currentSession.id

      // 5. 记录 session 总结完成事件
      await this.stateManager?.addEvent({
        projectId: "",
        type: "session_summary_completed",
        timestamp: new Date().toISOString(),
        employeeName: this.employeeName,
        details: {
          sessionId,
          messageCount,
          tokenCount,
        },
      })

      // 6. 关闭当前 session
      await this.closeSession()

      console.log(`[${this.employeeName}] Summary completed`)
    }
  }

  /**
   * 请求 AI 总结记忆
   * 使用 structured output 获取结构化的总结
   * 支持重试机制和智能 JSON 解析
   */
  private async requestSummary(): Promise<{
    knowledge: string[]
    args: Record<string, any>
  }> {
    if (!this.currentSession) {
      throw new Error("No active session")
    }

    const MAX_RETRIES = 3
    let lastError: string | null = null
    let lastResponseText: string | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // 构建提示词
      let promptText = `⚠️ CRITICAL MEMORY CHECKPOINT ⚠️

This session is about to CLOSE. All conversation history will be PERMANENTLY DELETED.
Your summary is the ONLY information preserved for the next session.
The next "you" will see NOTHING except this summary - no chat history, no context.

MISSION: Ensure the next "you" can seamlessly continue work with ZERO information loss.

Summarize EVERYTHING important from this session. Think carefully: what information is CRITICAL for continuing work?

Common categories to consider (but NOT limited to):
- Original task goals (complete description, do NOT simplify)
- Task supplements and requirement changes from messages
- Current progress and what has been accomplished
- Work in progress (what you're doing NOW, current step, immediate next steps)
- Technical decisions and detailed reasoning (why X over Y)
- Code exploration findings (architecture, design, file layout, key identifiers, line counts)
- Collaboration context (interactions with other employees, who's waiting for whom)
- Task assignments (who you assigned what, expected outcomes)
- Failed attempts and what didn't work (avoid repeating mistakes)
- Unresolved blockers and known issues
- Problems solved and their solutions
- Project-specific conventions, constraints, and special rules
- Environment and configuration details (if relevant to work)
- Trade-offs and temporary decisions that need revisiting

YOU decide what matters. Include anything that would cause work disruption if lost.

Self-check before submitting:
✓ Can the next "me" continue immediately without confusion?
✓ Have I captured WHY behind decisions, not just WHAT?
✓ Are ongoing tasks and their status crystal clear?
✓ Have I documented what NOT to do (failed attempts)?
✓ Is there ANY context that would be painful to lose?

Return JSON format with:
- knowledge: string array (each item should be complete and self-contained)
- args: object (leave empty for now)`

      // 如果是重试,添加错误信息
      if (attempt > 1 && lastError) {
        promptText += `\n\nPrevious response parsing failed. Error: ${lastError}\nPlease ensure you return pure JSON or wrap it in a \`\`\`json code block.`
      }

      // 发送请求
      await this.opcodeClient.session.prompt({
        path: { id: this.currentSession.id },
        body: {
          agent: "cclover-empty-agent", // 使用空 agent 避免预设提示词污染
          parts: [
            {
              type: "text",
              text: promptText,
            },
          ],
        },
        headers: {
          "x-opencode-directory": this.projectPath,
        },
      })

      // 提取文本响应
      const messages = await this.opcodeClient.session.messages({
        path: { id: this.currentSession.id },
      })
      const lastMessage = (messages.data ?? [])
        .filter((m) => m.info.role === "assistant")
        .pop()

      if (!lastMessage) {
        lastError = "No assistant message found"
        lastResponseText = ""
        continue
      }

      const textParts = lastMessage.parts.filter((p) => p.type === "text")
      const text = textParts.map((p) => (p as any).text).join("\n")
      lastResponseText = text

      // 尝试智能解析 JSON
      const parseResult = this.parseJSON(text)
      if (parseResult.success) {
        return {
          knowledge: parseResult.data.knowledge ?? [],
          args: parseResult.data.args ?? {},
        }
      }

      lastError = parseResult.error ?? "Unknown error"
      logger.warn(
        `[${this.employeeName}] Failed to parse summary JSON (attempt ${attempt}/${MAX_RETRIES}): ${lastError}`
      )
    }

    // 所有重试都失败,记录事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "summary_parse_failed",
      timestamp: new Date().toISOString(),
      employeeName: this.employeeName,
      details: {
        sessionId: this.currentSession.id,
        attempts: MAX_RETRIES,
        lastError,
        responseText: lastResponseText,
      },
    })

    console.error(
      `[${this.employeeName}] Failed to parse summary JSON after ${MAX_RETRIES} attempts`
    )
    return { knowledge: [], args: {} }
  }

  /**
   * 智能解析 JSON
   * 支持原始 JSON 和 markdown 代码块
   */
  private parseJSON(text: string): {
    success: boolean
    data?: any
    error?: string
  } {
    // 1. 尝试直接解析
    try {
      const parsed = JSON.parse(text)
      return { success: true, data: parsed }
    } catch (e) {
      // 继续尝试其他方法
    }

    // 2. 尝试提取 markdown JSON 代码块
    const jsonBlockMatch = text.match(/```json\s*\n([\s\S]*?)\n```/)
    if (jsonBlockMatch) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1])
        return { success: true, data: parsed }
      } catch (e) {
        return {
          success: false,
          error: `Found JSON code block but failed to parse: ${(e as Error).message}`,
        }
      }
    }

    // 3. 尝试提取普通代码块
    const codeBlockMatch = text.match(/```\s*\n([\s\S]*?)\n```/)
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1])
        return { success: true, data: parsed }
      } catch (e) {
        return {
          success: false,
          error: `Found code block but failed to parse: ${(e as Error).message}`,
        }
      }
    }

    // 4. 所有方法都失败
    return {
      success: false,
      error: "No valid JSON or JSON code block found in response",
    }
  }

  /**
   * 保存总结到记忆
   */
  private async saveSummary(summary: {
    knowledge: string[]
    args: Record<string, any>
  }): Promise<void> {
    // 读取当前记忆
    const memory = await this.memoryManager.read(this.employeeName)

    // 合并知识（去重）
    const knowledgeSet = new Set([...memory.knowledge, ...summary.knowledge])

    // 合并 args
    const args = { ...memory.args, ...summary.args }

    // 写入更新后的记忆
    await this.memoryManager.write(this.employeeName, {
      knowledge: Array.from(knowledgeSet),
      tasks: memory.tasks, // tasks 不需要总结，保持原样
      args, // 更新 args
    })
  }

  /**
   * 清空进展追踪
   * 在收到消息或 agent 事件时调用
   */
  private clearProgressTracking(): void {
    this.progressSnapshot = null
    this.noProgressCount = 0
  }

  /**
   * 检测进展
   * 在处理 task_available 或 task_reminder 事件后调用
   */
  private async checkProgress(): Promise<void> {
    // 1. 获取当前快照
    const currentSnapshot = await this.getCurrentSnapshot()

    // 2. 如果没有历史快照，记录当前快照
    if (!this.progressSnapshot) {
      this.progressSnapshot = currentSnapshot
      this.noProgressCount = 1
      logger.info(
        `[${this.employeeName}] First task event, recording snapshot (count: 1)`
      )
      return
    }

    // 3. 比较快照
    const hasProgress =
      currentSnapshot.agentCount !== this.progressSnapshot.agentCount ||
      currentSnapshot.tasksHash !== this.progressSnapshot.tasksHash

    if (hasProgress) {
      // 有进展，重置计数器
      this.progressSnapshot = currentSnapshot
      this.noProgressCount = 1
      logger.info(`[${this.employeeName}] Progress detected, resetting counter`)
    } else {
      // 无进展，增加计数器
      this.noProgressCount++
      logger.info(
        `[${this.employeeName}] No progress detected (count: ${this.noProgressCount})`
      )

      // 4. 检查是否达到阈值
      if (this.noProgressCount >= this.NO_PROGRESS_THRESHOLD) {
        await this.markAsAbnormal()
      }
    }
  }

  /**
   * 获取当前快照
   */
  private async getCurrentSnapshot(): Promise<ProgressSnapshot> {
    // 1. 获取 agent 数量
    const runningAgents = agentRegistry.getAgentsByEmployee(this.employeeName)
    const agentCount = runningAgents.length

    // 2. 获取任务列表并计算哈希
    const memory = await this.memoryManager.read(this.employeeName)
    const tasksHash = this.hashTasks(memory.tasks)

    return { agentCount, tasksHash }
  }

  /**
   * 计算任务列表的哈希
   * 使用简单的字符串序列化 + 哈希
   */
  private hashTasks(tasks: Task[]): string {
    // 序列化任务列表（只包含关键字段）
    const serialized = tasks
      .map((t) => `${t.name}:${t.status}:${t.dependencies.join(",")}`)
      .sort()
      .join("|")

    // 简单哈希（使用字符串长度 + 首尾字符）
    // 对于我们的用途足够了，不需要复杂的哈希算法
    return `${serialized.length}-${serialized.slice(0, 10)}-${serialized.slice(-10)}`
  }

  /**
   * 标记为异常状态
   */
  private async markAsAbnormal(): Promise<void> {
    logger.warn(
      `[${this.employeeName}] No progress for ${this.NO_PROGRESS_THRESHOLD} times, marking as abnormal`
    )

    // 1. 更新状态
    await this.stateManager?.updateEmployeeStatus(this.employeeName, "abnormal")

    // 2. 记录事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "employee_status_changed",
      timestamp: new Date().toISOString(),
      employeeName: this.employeeName,
      details: {
        oldStatus: "busy",
        newStatus: "abnormal",
        reason: "no_progress_in_task_events",
        noProgressCount: this.noProgressCount,
      },
    })

    // 3. 清空快照和计数器（避免重复触发）
    this.clearProgressTracking()
  }

  /**
   * 刷新系统提示词
   * 在角色定义更新后调用，更新当前 session 缓存的系统提示词
   *
   * 注意：由于 session.prompt() 每次都传递 system 参数，只需更新缓存即可，无需重新创建 session
   */
  async refreshSystemPrompt(): Promise<void> {
    // 如果没有活跃的 session，无需刷新
    if (!this.currentSession) {
      logger.debug(
        `[${this.employeeName}] No active session, skipping system prompt refresh`
      )
      return
    }

    // 获取最新的角色定义（验证角色是否存在）
    const role = this.roleManager.getRole(this.roleName)
    if (!role) {
      logger.error(
        `[${this.employeeName}] Role '${this.roleName}' not found during refresh`
      )
      return
    }

    // 读取当前记忆
    const memory = await this.memoryManager.read(this.employeeName)

    // 重新构建系统提示词（使用 sessionSnapshot 或当前状态）
    // 查询主管信息
    const employee = this.stateManager?.getEmployee(this.employeeName)
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
          this.employeeName,
          ".cclover/workspace",
          undefined, // TODO: Pass role metadata when RoleManager is updated
          supervisor
        )
      : buildSystemPrompt(
          role.systemPrompt,
          memory,
          this.employeeName,
          ".cclover/workspace",
          undefined, // TODO: Pass role metadata when RoleManager is updated
          supervisor
        )

    // 更新缓存的系统提示词
    this.currentSession.systemPrompt = systemPrompt

    logger.info(
      `[${this.employeeName}] System prompt refreshed for session ${this.currentSession.id} (preserved conversation history)`
    )
  }
}
