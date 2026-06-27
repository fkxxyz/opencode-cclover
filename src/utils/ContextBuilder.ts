/**
 * 上下文构建器
 *
 * 负责构建发送给 AI 的上下文信息
 */

import type { Task, Memory } from "../core/MemoryManager"
import type {
  Employee,
  EmployeeWorkSession,
  EmployeeWorkSessionId,
  RoleMetadata,
  RoleRequiredArgSpec,
} from "../types"
import type { RoleManager } from "../core/RoleManager"
import { generateMermaid } from "./MermaidGenerator"

export interface Event {
  type: string
  [key: string]: any
}

export interface PromptRecoveryEvent {
  type: "prompt_recovery"
  timestamp: string
  details: {
    sessionId: string
    startedAt: string
    triggerEventType: string
    version?: number
  }
}

export interface HaltRequestedEvent {
  type: "halt_requested"
  timestamp: string
  details: {
    reason?: string
    triggeredBy?: string
  }
}

export type RuntimeEvent = Event | PromptRecoveryEvent | HaltRequestedEvent

interface MissingArg {
  name: string
  type: string
  description: string
}

const EWS_RUNTIME_CONTEXT = `# Runtime Context

You are running inside a Cclover Employee Work Session (EWS).

## Runtime Model

Cclover separates role identity from runtime execution:

Role -> Employee -> Employee Work Session -> OpenCode Session

- Role: defines your stable responsibility and behavioral identity.
- Employee: a named worker created from a role.
- Employee Work Session: a concrete runtime instance where you handle events and perform work.
- OpenCode Session: the underlying model/tool session that executes this EWS.

The role prompt above defines who you are. This section defines how this runtime works.

## Independent Work and Private Output

You work independently in this system.

Your thoughts and outputs are private — only you can see them. Treat ordinary assistant output as your internal monologue, thinking process, or personal notes.

When you want to communicate with others, including employees or bosses, you must use the \`send_message\` tool. Do not assume that another employee, boss, or human can see your ordinary assistant output.

Do not use ordinary assistant output to report completion, ask questions, request review, or hand off work. Use tools for observable actions.

## Event-Driven Execution

You are event-driven.

The system sends you events that trigger your actions, such as:
- message events;
- employee or agent completion events;
- task reminder events;
- system recovery or lifecycle events.

Your input is your perception. Your output is your thinking. Tools are your actions.

You have autonomy: decide how to respond to each event according to your role, the current event, durable state, available context, and system constraints.`

export interface EmployeeContextFile {
  path: string
  content: string
}

export interface RuntimeIdentityContext {
  employee: Employee
  employeeWorkSession: EmployeeWorkSession
  supervisor?: {
    employeeWorkSessionId: EmployeeWorkSessionId
    employeeId: string
    name: string
    role: string
  }
}

function isRuntimeIdentityContext(
  value: unknown
): value is RuntimeIdentityContext {
  return (
    typeof value === "object" &&
    value !== null &&
    "employee" in value &&
    "employeeWorkSession" in value
  )
}

/**
 * 将参数格式化为 Markdown 列表
 *
 * @param args 参数对象
 * @param indent 缩进级别
 * @returns Markdown 行数组
 */
function formatArgsAsMarkdown(
  args: Record<string, any>,
  indent: number = 0
): string[] {
  const lines: string[] = []
  const prefix = "  ".repeat(indent)

  for (const [key, value] of Object.entries(args)) {
    if (value === null || value === undefined) {
      lines.push(`${prefix}- **${key}**: (not set)`)
    } else if (typeof value === "object" && !Array.isArray(value)) {
      // 嵌套对象
      lines.push(`${prefix}- **${key}**:`)
      lines.push(...formatArgsAsMarkdown(value, indent + 1))
    } else if (Array.isArray(value)) {
      // 数组
      lines.push(`${prefix}- **${key}**: ${JSON.stringify(value)}`)
    } else {
      // 简单值
      lines.push(`${prefix}- **${key}**: ${value}`)
    }
  }

  return lines
}

/**
 * 检查缺失的必需参数
 *
 * @param requiredArgs 必需参数定义
 * @param currentArgs 当前参数值
 * @returns 缺失的参数列表
 */
function checkMissingArgs(
  requiredArgs: Record<string, RoleRequiredArgSpec>,
  currentArgs: Record<string, any>
): MissingArg[] {
  const missing: MissingArg[] = []

  for (const [name, spec] of Object.entries(requiredArgs)) {
    if (
      !(name in currentArgs) ||
      currentArgs[name] === undefined ||
      currentArgs[name] === null
    ) {
      missing.push({
        name,
        type: spec.type,
        description: spec.description,
      })
    }
  }

  return missing
}

/**
 * 注入角色上下文到 sections 数组
 *
 * @param sections 要注入的 sections 数组
 * @param roleMetadata 角色元数据（可选）
 */
function injectRoleContexts(
  sections: string[],
  roleMetadata?: RoleMetadata
): void {
  if (
    roleMetadata?.resolvedContexts &&
    roleMetadata.resolvedContexts.length > 0
  ) {
    sections.push("# Role Context Materials")
    sections.push("")

    for (const context of roleMetadata.resolvedContexts) {
      sections.push(`## Context: ${context.id}`)
      sections.push("")

      if (context.description) {
        sections.push(context.description)
        sections.push("")
      }

      for (const document of context.documents) {
        sections.push(`### Document: ${document.path}`)
        sections.push("")
        sections.push(document.content)
        sections.push("")
      }
    }
  }
}

/**
 * 构建系统提示词
 *
 * @param rolePrompt 角色的系统提示词
 * @param memory 员工的记忆
 * @param employeeId 员工 ID
 * @param workspaceRoot 工作区根目录
 * @param roleMetadata 角色元数据（可选）
 * @param supervisor 主管信息（可选）
 * @param roleManager 角色管理器（可选，用于解析 canHire）
 * @returns 完整的系统提示词
 */
export function buildSystemPrompt(
  rolePrompt: string,
  memory: Memory,
  runtimeIdentityOrEmployeeId: RuntimeIdentityContext | string,
  workspaceRoot: string,
  roleMetadata?: RoleMetadata,
  supervisorOrRoleManager?: { name: string; role: string } | RoleManager,
  roleManagerOrEmployeeContextFiles?: RoleManager | EmployeeContextFile[],
  employeeContextFilesInput?: EmployeeContextFile[]
): string {
  const sections: string[] = []
  const runtimeIdentity = isRuntimeIdentityContext(runtimeIdentityOrEmployeeId)
    ? runtimeIdentityOrEmployeeId
    : undefined
  const employeeId = runtimeIdentity
    ? runtimeIdentity.employeeWorkSession.employeeWorkSessionId
    : runtimeIdentityOrEmployeeId
  const supervisor = runtimeIdentity
    ? runtimeIdentity.supervisor
    : (supervisorOrRoleManager as { name: string; role: string } | undefined)
  const roleManager = runtimeIdentity
    ? (supervisorOrRoleManager as RoleManager | undefined)
    : (roleManagerOrEmployeeContextFiles as RoleManager | undefined)
  const employeeContextFiles = runtimeIdentity
    ? Array.isArray(roleManagerOrEmployeeContextFiles)
      ? roleManagerOrEmployeeContextFiles
      : employeeContextFilesInput
    : undefined

  // 1. 角色定义
  sections.push("# Role Definition")
  sections.push(rolePrompt)
  sections.push("")

  // 1.1 EWS 运行时模型说明
  sections.push(EWS_RUNTIME_CONTEXT)
  sections.push("")

  // 1.5 雇佣参考（如果角色可以雇佣其他角色）
  if (roleMetadata?.canHire && roleMetadata.canHire.length > 0 && roleManager) {
    const hireableRoles = roleManager.resolveCanHire(roleMetadata.canHire)
    if (hireableRoles.length > 0) {
      sections.push("## Hiring Reference")
      sections.push("")
      sections.push(
        "When using `create_employee_work_session`, required parameters for the target role must be passed via `args`. The EWS description is task/context text only. It does not satisfy requiredArgs."
      )
      sections.push("")
      sections.push("You can hire these roles:")
      sections.push("")
      for (const roleName of hireableRoles) {
        const role = roleManager.getRole(roleName)
        if (role) {
          sections.push(`**${roleName}**`)
          if (role.requiredArgs && Object.keys(role.requiredArgs).length > 0) {
            sections.push("- Required parameters:")
            for (const [argName, argSpec] of Object.entries(
              role.requiredArgs
            )) {
              sections.push(
                `  - **${argName}** (${argSpec.type}): ${argSpec.description}`
              )
            }
          } else {
            sections.push("- No required parameters")
          }
          sections.push("")
        }
      }
    }
  }

  if (runtimeIdentity) {
    sections.push("# Employee Metadata")
    sections.push("")
    sections.push(`- Employee ID: ${runtimeIdentity.employee.employeeId}`)
    sections.push(`- Name: ${runtimeIdentity.employee.name}`)
    sections.push(`- Role ID: ${runtimeIdentity.employee.roleId}`)
    sections.push(`- Description: ${runtimeIdentity.employee.description}`)
    sections.push("")

    if (employeeContextFiles && employeeContextFiles.length > 0) {
      sections.push("# Employee Context Files")
      sections.push("")
      for (const contextFile of employeeContextFiles) {
        sections.push(`--- Begin employee context: ${contextFile.path} ---`)
        sections.push(contextFile.content)
        sections.push(`--- End employee context: ${contextFile.path} ---`)
        sections.push("")
      }
    }

    sections.push("# Employee Work Session")
    sections.push("")
    sections.push(
      `- Employee Work Session ID: ${runtimeIdentity.employeeWorkSession.employeeWorkSessionId}`
    )
    sections.push(
      `- Parent EWS ID: ${runtimeIdentity.employeeWorkSession.parentEmployeeWorkSessionId ?? "None"}`
    )
    sections.push(`- Status: ${runtimeIdentity.employeeWorkSession.status}`)
    sections.push(
      `- OpenCode Session ID: ${runtimeIdentity.employeeWorkSession.opencodeSessionId ?? memory.opencodeSessionId ?? "None"}`
    )
    sections.push(
      `- Description: ${runtimeIdentity.employeeWorkSession.description}`
    )
    sections.push(
      `- Worktree Ref: ${runtimeIdentity.employeeWorkSession.worktreeRef ?? "None"}`
    )
    sections.push("")
  }

  // 2. 当前记忆
  sections.push("# Current Memory")
  sections.push("")

  // 2.1 角色参数（优先显示）
  const args = memory.args || {}
  if (Object.keys(args).length > 0) {
    sections.push("## Role Arguments")
    sections.push("")
    sections.push(...formatArgsAsMarkdown(args))
    sections.push("")
  }

  // 2.2 角色上下文
  injectRoleContexts(sections, roleMetadata)

  // 2.3 角色数据
  const roleData = memory.roleData || {}
  if (Object.keys(roleData).length > 0) {
    sections.push("## Role Data")
    sections.push("")
    sections.push(...formatArgsAsMarkdown(roleData))
    sections.push("")
  }

  // 2.4 经验知识
  if (memory.knowledge.length > 0) {
    sections.push("## Knowledge")
    for (const item of memory.knowledge) {
      sections.push(`- ${item}`)
    }
    sections.push("")
  }

  // 3. 工作区文件
  sections.push("# Workspace Files")
  sections.push("")
  sections.push("Your workspace is located at:")
  sections.push(`\`${workspaceRoot}/ews/${employeeId}/\``)
  sections.push("")
  sections.push("**Messages**: `messages/{peer}/chat.yaml`")
  sections.push("- Conversation history with each employee (one file per peer)")
  sections.push(
    "- ⚠️ May be very large! Use Bash with tail to read recent messages"
  )
  sections.push(
    `- Example: \`bash("tail -n 50 ${workspaceRoot}/ews/${employeeId}/messages/{peer}/chat.yaml")\``
  )
  sections.push(
    '- Or use Grep to search historical keywords: `grep(pattern="keyword", path="...")`'
  )
  sections.push(
    "- Note: Current message content is already in the event below, no need to read again"
  )
  sections.push("")
  sections.push("**Events**: `events.jsonl`")
  sections.push("- Your complete event history (one JSON object per line)")
  sections.push(
    "- ⚠️ May be very large! Use Bash with tail to read recent events"
  )
  sections.push(
    `- Example: \`bash("tail -n 100 ${workspaceRoot}/ews/${employeeId}/events.jsonl")\``
  )
  sections.push(
    '- Or use Grep to search specific event types: `grep(pattern="task_available", ...)`'
  )
  sections.push("")
  sections.push("**Memory**: `memory.yaml`")
  sections.push(
    "- Your knowledge, tasks, and custom data (already loaded in the sections above)"
  )
  sections.push(
    "- ⚠️ No need to read this file - the content is already in your system prompt"
  )
  sections.push("")

  // 4. 主管信息
  if (supervisor) {
    sections.push("# Your Supervisor")
    sections.push("")
    sections.push(
      `You were hired by: ${supervisor.name} (Role: ${supervisor.role})`
    )
    sections.push("")
    sections.push(
      "If you have any questions or difficulties, please send a message to your supervisor for help."
    )
    sections.push("")
  }

  // 5. 任务管理
  if (memory.tasks.length > 0) {
    sections.push("# Task Management")
    sections.push("")

    // 5.1 任务管理指南
    sections.push("## Task Management Guide")
    sections.push("")
    sections.push("Task status definitions:")
    sections.push("- pending: Tasks waiting to be started")
    sections.push(
      "- in_progress: Tasks currently being worked on (set when you start working)"
    )
    sections.push(
      "- completed: Tasks that are finished (set when done, fill in result field)"
    )
    sections.push(
      "- waiting_for_message: Tasks waiting for messages from other employees (e.g., clarification, review, guidance)"
    )
    sections.push("- cancelled: Tasks that are cancelled")
    sections.push("")
    sections.push("Available tools:")
    sections.push("- edit_tasks: Update task status")
    sections.push(
      "- create_employee_work_session: Create a new EWS to execute delegated work"
    )
    sections.push("- send_message: Communicate with other employees")
    sections.push("")

    // 5.2 所有任务
    sections.push("## All Tasks")
    sections.push("")
    for (const task of memory.tasks) {
      sections.push(`**Task: ${task.name}**`)
      sections.push(`- Status: ${task.status}`)
      sections.push(`- Description: ${task.description}`)
      sections.push(
        `- Dependencies: ${task.dependencies.length > 0 ? task.dependencies.join(", ") : "None"}`
      )
      if (task.result) {
        sections.push(`- Current Progress: ${task.result}`)
      }
      sections.push("")
    }

    // 5.3 任务依赖图
    sections.push("## Task Dependency Graph")
    sections.push("")
    sections.push(generateMermaid(memory.tasks))
    sections.push("")

    // 5.4 可执行的任务
    const executableTasks = getExecutableTasks(memory.tasks)
    sections.push("## Executable Tasks")
    sections.push("")
    if (executableTasks.length > 0) {
      sections.push("The following tasks can be started:")
      for (const task of executableTasks) {
        sections.push(`- ${task.name}`)
      }
    } else {
      sections.push(
        "Currently no tasks are immediately executable (all pending tasks have incomplete dependencies)."
      )
    }
    sections.push("")
    sections.push(
      "You can start these tasks based on actual situation. If a task depends on other tasks and cannot start, please add the dependencies."
    )
    sections.push("")

    // 5.5 正在进行的任务
    const inProgressTasks = memory.tasks.filter(
      (t) => t.status === "in_progress"
    )
    if (inProgressTasks.length > 0) {
      const taskNames = inProgressTasks.map((t) => t.name).join(", ")
      sections.push("## Tasks In Progress")
      sections.push("")
      sections.push(
        `You currently have ${inProgressTasks.length} tasks in progress: ${taskNames}`
      )
      sections.push("")
      sections.push(
        "Please continue working on these tasks. If a task depends on external messages to proceed, please set the task status to waiting_for_message."
      )
      sections.push("")
    }
  }

  return sections.join("\n")
}

/**
 * 构建会议模式系统提示词
 *
 * 会议模式是轻量级的，只注入角色上下文，不包含记忆、任务、工作区等员工基础设施
 *
 * @param rolePrompt 角色的系统提示词
 * @param meetingModeAugmentation 会议模式增强文本
 * @param roleMetadata 角色元数据（可选，用于注入上下文）
 * @returns 完整的会议模式系统提示词
 */
export function buildMeetingModeSystemPrompt(
  rolePrompt: string,
  meetingModeAugmentation: string,
  roleMetadata?: RoleMetadata
): string {
  const sections: string[] = []

  // 1. 角色定义
  sections.push(rolePrompt.trim())
  sections.push("")

  // 2. 角色上下文（如果有）
  injectRoleContexts(sections, roleMetadata)

  // 3. 会议模式增强
  sections.push(meetingModeAugmentation)

  return sections.join("\n")
}

/**
 * 构建事件消息
 *
 * @param event 事件对象
 * @returns 格式化的事件消息
 */
export function buildEventMessage(event: RuntimeEvent): string {
  const sections: string[] = []

  sections.push("# Current Event")
  sections.push(`Type: ${event.type}`)

  // 根据事件类型添加特定字段
  if (event.type === "message") {
    sections.push(`From: ${event.details.from}`)
    if (event.details.fromRole) {
      sections.push(`Role: ${event.details.fromRole}`)
    }
    sections.push(`Content: ${event.details.content}`)
    sections.push(`Time: ${event.timestamp}`)
  } else if (event.type === "task_available") {
    sections.push("The following tasks can be executed:")
    sections.push("")
    for (const task of event.details.tasks) {
      sections.push(`**Task: ${task.name}**`)
      sections.push(`- Status: ${task.status}`)
      sections.push(`- Description: ${task.description}`)
      if (task.result) {
        sections.push(`- Current Progress: ${task.result}`)
      }
      sections.push("")
    }
    sections.push("---")
    sections.push("")
    sections.push(
      "**Reminder**: You have tasks that haven't been started yet. Please plan and start them appropriately. If a task depends on other incomplete tasks and cannot start, please use edit_tasks to set the correct dependencies. If a task is waiting for messages from other employees to start (e.g., clarification, requirements, guidance), please use edit_tasks to set the task status to waiting_for_message with an explanation, otherwise you will keep receiving this event reminder."
    )
    sections.push(`Time: ${event.timestamp}`)
  } else if (event.type === "task_reminder") {
    sections.push("You have the following tasks in progress:")
    sections.push("")
    for (const task of event.details.tasks) {
      sections.push(`**Task: ${task.name}**`)
      sections.push(`- Status: ${task.status}`)
      sections.push(`- Description: ${task.description}`)
      if (task.result) {
        sections.push(`- Current Progress: ${task.result}`)
      }
      sections.push("")
    }
    sections.push("---")
    sections.push("")
    sections.push(
      "**Reminder**: You have unfinished tasks. Please continue working on them. If a task is waiting for messages from other employees to proceed, please use edit_tasks to set the task status to waiting_for_message with an explanation, otherwise you will keep receiving this event reminder."
    )
    sections.push(`Time: ${event.timestamp}`)
  } else if (event.type === "reply_reminder") {
    // 区分两种 reply_reminder 类型
    if (event.details?.reason === "survey_pending") {
      // 调查问卷提醒
      sections.push("You have a pending feedback survey to complete.")
      sections.push("")
      sections.push("---")
      sections.push("")
      sections.push(
        `**Reminder**: You received a feedback survey but haven't responded yet. This is reminder #${event.details.reminderCount}. Please complete the survey when you have time.`
      )
      sections.push(`Time: ${event.timestamp}`)
    } else if (event.details?.senders) {
      // 消息回复提醒
      sections.push("You have unreplied messages from the following senders:")
      sections.push("")
      for (const sender of event.details.senders) {
        sections.push(`- ${sender}`)
      }
      sections.push("")
      sections.push("---")
      sections.push("")
      sections.push(
        "**Reminder**: The above senders sent you messages with expect_reply=true, but you haven't replied yet. When you see this event, it means you may have directly output a reply without using send_message tool. Please use send_message to reply to them, otherwise you will keep receiving this event reminder."
      )
      sections.push(`Time: ${event.timestamp}`)
    } else {
      // 未知的 reply_reminder 类型，记录警告
      sections.push(
        `**Warning**: Received reply_reminder event with unknown details structure: ${JSON.stringify(event.details)}`
      )
      sections.push(`Time: ${event.timestamp}`)
    }
  } else if (event.type === "prompt_recovery") {
    sections.push(
      "System recovery notice: your previous `session.prompt` call was interrupted after work had been dispatched to the model, but before the system recorded successful completion. Resume from the current durable state in memory, tasks, and messages. The prior attempt may or may not have already produced side effects, so avoid assuming the previous reply was lost, and continue with the next best action carefully."
    )
    if (event.details.sessionId) {
      sections.push(`Previous Session ID: ${event.details.sessionId}`)
    }
    if (event.details.triggerEventType) {
      sections.push(`Interrupted Event Type: ${event.details.triggerEventType}`)
    }
    if (event.details.startedAt) {
      sections.push(`Interrupted At: ${event.details.startedAt}`)
    }
    sections.push(`Time: ${event.timestamp}`)
  } else {
    // 通用处理：输出所有字段
    for (const [key, value] of Object.entries(event.details)) {
      sections.push(`${key}: ${JSON.stringify(value)}`)
    }
  }

  sections.push("")
  sections.push(
    "💡 System Tip: What you output here is private - only the system sees it. Feel free to show your step-by-step reasoning in your response as you work through the event - it helps you make better decisions."
  )
  sections.push("")
  sections.push(
    "When you're ready to communicate with other employees, use send_message to send your message. That's how you actually talk to them and they can see and respond to you."
  )

  return sections.join("\n")
}

/**
 * 计算可执行的任务
 *
 * @param tasks 任务列表
 * @returns 依赖已满足的任务列表
 */
export function getExecutableTasks(tasks: Task[]): Task[] {
  const completedTasks = new Set(
    tasks.filter((t) => t.status === "completed").map((t) => t.name)
  )

  return tasks.filter((task) => {
    // 只考虑 pending 状态的任务
    if (task.status !== "pending") {
      return false
    }

    // 检查所有依赖是否都已完成
    return task.dependencies.every((dep) => completedTasks.has(dep))
  })
}

/**
 * 构建完整的上下文（系统提示词 + 事件消息）
 *
 * @param rolePrompt 角色提示词
 * @param memory 记忆
 * @param employeeId 员工 ID
 * @param workspaceRoot 工作区根目录
 * @param event 事件
 * @param roleMetadata 角色元数据（可选）
 * @param supervisor 主管信息（可选）
 * @param roleManager 角色管理器（可选）
 * @returns 完整上下文
 */
export function buildFullContext(
  rolePrompt: string,
  memory: Memory,
  employeeId: string,
  workspaceRoot: string,
  event: RuntimeEvent,
  roleMetadata?: RoleMetadata,
  supervisor?: { name: string; role: string },
  roleManager?: RoleManager
): { systemPrompt: string; eventMessage: string } {
  return {
    systemPrompt: buildSystemPrompt(
      rolePrompt,
      memory,
      employeeId,
      workspaceRoot,
      roleMetadata,
      supervisor,
      roleManager
    ),
    eventMessage: buildEventMessage(event),
  }
}
