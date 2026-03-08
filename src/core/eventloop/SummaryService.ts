import type { OpencodeClient } from "@opencode-ai/sdk"
import type { MemoryManager, Memory } from "../MemoryManager"
import type { RoleManager } from "../RoleManager"
import type { StateManager } from "../../state/StateManager"
import { logger } from "../../lib/logger"

/**
 * 总结服务
 * 负责请求 AI 总结、保存总结、解析 JSON
 */
export class SummaryService {
  constructor(
    private projectPath: string,
    private employeeName: string,
    private roleName: string,
    private roleManager: RoleManager,
    private memoryManager: MemoryManager,
    private opcodeClient: OpencodeClient,
    private stateManager?: StateManager
  ) {}

  /**
   * 请求 AI 总结
   * 包含重试逻辑
   */
  async requestSummary(sessionId: string): Promise<{
    args: Record<string, any>
    roleData: Record<string, any>
    knowledge: string[]
  }> {
    // 获取角色元数据
    const role = this.roleManager.getRole(this.roleName)
    const roleMetadata = role ? (role as any).metadata : undefined

    const MAX_RETRIES = 3
    let lastError: string | null = null
    let lastResponseText: string | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // 构建字段说明
      let argsFieldsText = ""
      let roleDataFieldsText = ""

      if (roleMetadata?.requiredArgs) {
        const argsList = Object.entries(roleMetadata.requiredArgs)
          .map(
            ([key, spec]: [string, any]) =>
              `  - ${key}: ${spec.type} - ${spec.description}`
          )
          .join("\n")
        argsFieldsText = `\n\nYour role defines these REQUIRED args fields:\n${argsList}\n\nYou MUST include all these fields in the "args" object.`
      }

      if (roleMetadata?.memorySchema) {
        const schemaList = Object.entries(roleMetadata.memorySchema)
          .map(
            ([key, spec]: [string, any]) =>
              `  - ${key}: ${spec.type} - ${spec.description}`
          )
          .join("\n")
        roleDataFieldsText = `\n\nYour role defines these roleData fields:\n${schemaList}\n\nYou MUST include all these fields in the "roleData" object.`
      }

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
${argsFieldsText}${roleDataFieldsText}

Return JSON format with THREE sections (in this exact order):
1. args: object (role-specific parameters, e.g., projectName, teamSize)
2. roleData: object (role-specific working data, e.g., current configurations, temporary states)
3. knowledge: string array (each item should be complete and self-contained, general experience and learnings)`

      // 如果是重试,添加错误信息
      if (attempt > 1 && lastError) {
        promptText += `\n\nPrevious response parsing failed. Error: ${lastError}\nPlease ensure you return pure JSON or wrap it in a \`\`\`json code block.`
      }

      // 发送请求
      await this.opcodeClient.session.prompt({
        path: { id: sessionId },
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
        path: { id: sessionId },
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
          args: parseResult.data.args ?? {},
          roleData: parseResult.data.roleData ?? {},
          knowledge: parseResult.data.knowledge ?? [],
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
        sessionId,
        attempts: MAX_RETRIES,
        lastError,
        responseText: lastResponseText,
      },
    })

    console.error(
      `[${this.employeeName}] Failed to parse summary JSON after ${MAX_RETRIES} attempts`
    )
    return { args: {}, roleData: {}, knowledge: [] }
  }

  /**
   * 保存总结到记忆
   */
  async saveSummary(summary: {
    args: Record<string, any>
    roleData: Record<string, any>
    knowledge: string[]
  }): Promise<void> {
    // 读取当前记忆
    const memory = await this.memoryManager.read(this.employeeName)

    // 合并知识（去重）
    const knowledgeSet = new Set([...memory.knowledge, ...summary.knowledge])

    // 合并 args
    const args = { ...memory.args, ...summary.args }

    // 合并 roleData
    const roleData = { ...memory.roleData, ...summary.roleData }

    // 写入更新后的记忆
    await this.memoryManager.write(this.employeeName, {
      knowledge: Array.from(knowledgeSet),
      tasks: memory.tasks, // tasks 不需要总结，保持原样
      args, // 更新 args
      roleData, // 更新 roleData
    })
  }

  /**
   * 智能解析 JSON
   * 处理 AI 返回的各种格式
   */
  parseJSON(text: string): {
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
}
