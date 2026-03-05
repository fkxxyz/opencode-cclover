/**
 * 上下文构建器
 *
 * 负责构建发送给 AI 的上下文信息
 */

import type { Task, Memory } from "../core/MemoryManager"
import { generateMermaid } from "./MermaidGenerator"

export interface Event {
  type: string
  [key: string]: any
}

/**
 * 构建系统提示词
 *
 * @param rolePrompt 角色的系统提示词
 * @param memory 员工的记忆
 * @returns 完整的系统提示词
 */
export function buildSystemPrompt(rolePrompt: string, memory: Memory): string {
  const sections: string[] = []

  // 1. 角色定义
  sections.push("# Role Definition")
  sections.push(rolePrompt)
  sections.push("")

  // 2. 当前记忆
  sections.push("# Current Memory")
  sections.push("")

  // 2.1 经验知识
  if (memory.knowledge.length > 0) {
    sections.push("## Knowledge")
    for (const item of memory.knowledge) {
      sections.push(`- ${item}`)
    }
    sections.push("")
  }

  // 2.2 自定义字段
  if (Object.keys(memory.custom).length > 0) {
    sections.push("## Custom Data")
    sections.push("```json")
    sections.push(JSON.stringify(memory.custom, null, 2))
    sections.push("```")
    sections.push("")
  }

  // 3. 任务管理
  if (memory.tasks.length > 0) {
    sections.push("# Task Management")
    sections.push("")

    // 3.1 任务管理指南
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
    sections.push("- create_agent: Create an agent to execute tasks")
    sections.push("- send_message: Communicate with other employees")
    sections.push("")

    // 3.2 所有任务
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

    // 3.3 任务依赖图
    sections.push("## Task Dependency Graph")
    sections.push("")
    sections.push(generateMermaid(memory.tasks))
    sections.push("")

    // 3.4 可执行的任务
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

    // 3.5 正在进行的任务
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
 * 构建事件消息
 *
 * @param event 事件对象
 * @returns 格式化的事件消息
 */
export function buildEventMessage(event: Event): string {
  const sections: string[] = []

  sections.push("# Current Event")
  sections.push(`Type: ${event.type}`)

  // 根据事件类型添加特定字段
  if (event.type === "message") {
    sections.push(`From: ${event.from}`)
    sections.push(`Content: ${event.content}`)
    sections.push(`Time: ${event.timestamp}`)
  } else if (event.type === "agent_completed") {
    sections.push(`Agent ID: ${event.agentId}`)
    sections.push(`Related Task: ${event.taskName}`)
    sections.push(`Result: ${event.result}`)
    sections.push(`Time: ${event.timestamp}`)
  } else if (event.type === "task_available") {
    sections.push("The following tasks can be executed:")
    sections.push("")
    for (const task of event.tasks) {
      sections.push(`**Task: ${task.name}**`)
      sections.push(`- Description: ${task.description}`)
      if (task.result) {
        sections.push(`- Current Progress: ${task.result}`)
      }
      sections.push("")
    }
    sections.push("---")
    sections.push("")
    sections.push(
      "**Reminder**: You have tasks that haven't been started yet. Please plan and start them appropriately. If a task depends on other incomplete tasks and cannot start, please use edit_tasks to set the correct dependencies, otherwise you will keep receiving this event reminder."
    )
    sections.push(`Time: ${event.timestamp}`)
  } else if (event.type === "task_reminder") {
    sections.push("You have the following tasks in progress:")
    sections.push("")
    for (const task of event.tasks) {
      sections.push(`**Task: ${task.name}**`)
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
  } else {
    // 通用处理：输出所有字段
    for (const [key, value] of Object.entries(event)) {
      if (key !== "type") {
        sections.push(`${key}: ${JSON.stringify(value)}`)
      }
    }
  }

  sections.push("")
  sections.push("# Your Task")
  sections.push(
    "Based on the above information, decide your next action. You can:"
  )
  sections.push("- Call tools to perform operations")
  sections.push(
    '- Output text to indicate waiting (e.g., "Good, now I just need to wait for xxx")'
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
 * @param event 事件
 * @returns 完整上下文
 */
export function buildFullContext(
  rolePrompt: string,
  memory: Memory,
  event: Event
): { systemPrompt: string; eventMessage: string } {
  return {
    systemPrompt: buildSystemPrompt(rolePrompt, memory),
    eventMessage: buildEventMessage(event),
  }
}
