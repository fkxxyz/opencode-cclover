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
  sections.push("# 系统提示词（角色定义）")
  sections.push(rolePrompt)
  sections.push("")

  // 2. 经验知识
  if (memory.knowledge.length > 0) {
    sections.push("# 当前记忆")
    sections.push("## 经验知识")
    for (const item of memory.knowledge) {
      sections.push(`- ${item}`)
    }
    sections.push("")
  }

  // 3. 自定义字段
  if (Object.keys(memory.custom).length > 0) {
    sections.push("## 自定义数据")
    sections.push("```json")
    sections.push(JSON.stringify(memory.custom, null, 2))
    sections.push("```")
    sections.push("")
  }

  // 4. 任务状态（Mermaid 图）
  if (memory.tasks.length > 0) {
    sections.push("# 任务状态")
    sections.push(generateMermaid(memory.tasks))
    sections.push("")

    // 5. 可执行的任务
    const executableTasks = getExecutableTasks(memory.tasks)
    if (executableTasks.length > 0) {
      sections.push("# 可执行的任务")
      sections.push("以下任务的依赖已满足，可以立即执行：")
      for (const task of executableTasks) {
        sections.push(`- ${task.name}: ${task.description}`)
      }
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

  sections.push("# 当前事件")
  sections.push(`类型: ${event.type}`)

  // 根据事件类型添加特定字段
  if (event.type === "message") {
    sections.push(`发送者: ${event.from}`)
    sections.push(`内容: ${event.content}`)
    sections.push(`时间: ${event.timestamp}`)
  } else if (event.type === "agent_completed") {
    sections.push(`Agent ID: ${event.agentId}`)
    sections.push(`关联任务: ${event.taskName}`)
    sections.push(`执行结果: ${event.result}`)
    sections.push(`时间: ${event.timestamp}`)
  } else if (event.type === "task_available") {
    sections.push("目前没有未读消息，但有以下任务可以执行：")
    for (const task of event.tasks) {
      sections.push(`- ${task.name}: ${task.description}`)
    }
    sections.push(`时间: ${event.timestamp}`)
  } else {
    // 通用处理：输出所有字段
    for (const [key, value] of Object.entries(event)) {
      if (key !== "type") {
        sections.push(`${key}: ${JSON.stringify(value)}`)
      }
    }
  }

  sections.push("")
  sections.push("# 你的任务")
  sections.push("根据以上信息，决定下一步行动。你可以：")
  sections.push("- 调用工具执行操作")
  sections.push('- 输出文本表示等待（例如："很好，接下来只需要等待 xxx"）')

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
