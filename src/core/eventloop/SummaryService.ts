import type { OpencodeClient } from "@opencode-ai/sdk"
import type { MemoryManager, Memory } from "../MemoryManager"
import type { RoleManager } from "../RoleManager"
import type { StateManager } from "../../state/StateManager"
import type { EmployeeId } from "../../types"
import { logger } from "../../lib/logger"

/**
 * 总结服务
 * 负责请求 AI 总结、保存总结、解析 JSON
 */
export class SummaryService {
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
      let argsSection = ""
      let roleDataSection = ""
      let argsExample = "{}"
      let roleDataExample = "{}"

      if (roleMetadata?.requiredArgs) {
        const argsList = Object.entries(roleMetadata.requiredArgs)
          .map(
            ([key, spec]: [string, any]) =>
              `  - ${key}: ${spec.type} - ${spec.description}`
          )
          .join("\n")
        const exampleFields = Object.entries(roleMetadata.requiredArgs)
          .map(([key, spec]: [string, any]) => {
            const exampleValue =
              spec.type === "string"
                ? '"example"'
                : spec.type === "number"
                  ? "0"
                  : "null"
            return `"${key}": ${exampleValue}`
          })
          .join(", ")
        argsExample = `{ ${exampleFields} }`
        argsSection = `
## 1. args (Role Parameters)

⚠️ STRICT SCHEMA ENFORCEMENT ⚠️

Your role defines these REQUIRED fields:
${argsList}

RULES:
- You MUST include ALL fields listed above
- You MUST NOT add any custom fields
- ONLY use the exact field names defined above
- Do NOT put work context or learnings here (those go in "knowledge")

Example format:
\`\`\`json
${argsExample}
\`\`\``
      } else {
        argsSection = `
## 1. args (Role Parameters)

Your role has NO required args fields.
Return an empty object: {}

Do NOT add custom fields. This section is for role-defined parameters only.`
      }

      if (roleMetadata?.memorySchema) {
        const schemaList = Object.entries(roleMetadata.memorySchema)
          .map(
            ([key, spec]: [string, any]) =>
              `  - ${key}: ${spec.type} - ${spec.description}`
          )
          .join("\n")
        const exampleFields = Object.entries(roleMetadata.memorySchema)
          .map(([key, spec]: [string, any]) => {
            const exampleValue =
              spec.type === "string"
                ? '"example"'
                : spec.type === "number"
                  ? "0"
                  : spec.type === "object"
                    ? "{}"
                    : "null"
            return `"${key}": ${exampleValue}`
          })
          .join(", ")
        roleDataExample = `{ ${exampleFields} }`
        roleDataSection = `
## 2. roleData (Role-Specific Working Data)

⚠️ STRICT SCHEMA ENFORCEMENT ⚠️

Your role defines these fields:
${schemaList}

RULES:
- You MUST include ALL fields listed above
- You MUST NOT add any custom fields
- ONLY use the exact field names defined above
- Do NOT put work context or learnings here (those go in "knowledge")

Example format:
\`\`\`json
${roleDataExample}
\`\`\``
      } else {
        roleDataSection = `
## 2. roleData (Role-Specific Working Data)

Your role has NO roleData schema defined.
Return an empty object: {}

Do NOT add custom fields. This section is for role-defined data only.`
      }

      // 构建提示词
      let promptText = `⚠️ CRITICAL MEMORY CHECKPOINT ⚠️

This session is about to CLOSE. All conversation history will be PERMANENTLY DELETED.
Your summary is the ONLY information preserved for the next session.
The next "you" will see NOTHING except this summary - no chat history, no context.

MISSION: Ensure the next "you" can seamlessly continue work with ZERO information loss.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT: You MUST return a JSON object with THREE sections
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${argsSection}
${roleDataSection}

## 3. knowledge (Work Context & Learnings)

This is where ALL your work context goes. Think carefully: what information is CRITICAL for continuing work?

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

RULES:
- Each item should be complete and self-contained
- Use clear, descriptive sentences
- Include enough detail for the next "you" to understand immediately

Self-check before submitting:
✓ Can the next "me" continue immediately without confusion?
✓ Have I captured WHY behind decisions, not just WHAT?
✓ Are ongoing tasks and their status crystal clear?
✓ Have I documented what NOT to do (failed attempts)?
✓ Is there ANY context that would be painful to lose?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY a JSON object (or wrap it in a \`\`\`json code block):

{
  "args": ${argsExample},
  "roleData": ${roleDataExample},
  "knowledge": [
    "First important piece of information...",
    "Second important piece of information...",
    "..."
  ]
}

⚠️ CRITICAL: Do NOT add custom fields to "args" or "roleData". Only use the exact fields defined above.
⚠️ ALL work context, progress, decisions, and learnings go in "knowledge" array.`

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
        `[${this.employeeId}] Failed to parse summary JSON (attempt ${attempt}/${MAX_RETRIES}): ${lastError}`
      )
    }

    // 所有重试都失败,记录事件
    await this.stateManager?.addEvent({
      projectId: "",
      type: "summary_parse_failed",
      timestamp: new Date().toISOString(),
      employeeId: this.employeeId,
      details: {
        sessionId,
        attempts: MAX_RETRIES,
        lastError,
        responseText: lastResponseText,
      },
    })

    console.error(
      `[${this.employeeId}] Failed to parse summary JSON after ${MAX_RETRIES} attempts`
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
    const memory = await this.memoryManager.read(this.employeeId)

    // 合并知识（去重）
    const knowledgeSet = new Set([...memory.knowledge, ...summary.knowledge])

    // 合并 args
    const args = { ...memory.args, ...summary.args }

    // 合并 roleData
    const roleData = { ...memory.roleData, ...summary.roleData }

    // 写入更新后的记忆
    await this.memoryManager.write(this.employeeId, {
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
