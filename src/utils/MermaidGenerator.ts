/**
 * Mermaid 图生成器
 *
 * 根据任务列表生成 Mermaid 格式的 DAG 图
 */

import type { Task } from "../core/MemoryManager"

/**
 * 生成 Mermaid 任务依赖图
 *
 * @param tasks 任务列表
 * @returns Mermaid 格式的图定义
 */
export function generateMermaid(tasks: Task[]): string {
  if (tasks.length === 0) {
    return "```mermaid\ngraph TD\n    Empty[无任务]\n```"
  }

  const lines: string[] = ["```mermaid", "graph TD"]

  // 为每个任务生成节点
  for (const task of tasks) {
    const nodeId = sanitizeNodeId(task.name)
    const label = `${task.status}: ${task.name}`

    // 根据状态选择节点样式
    const style = getNodeStyle(task.status)
    lines.push(`    ${nodeId}["${escapeLabel(label)}"]${style}`)
  }

  // 生成依赖关系边
  for (const task of tasks) {
    const nodeId = sanitizeNodeId(task.name)
    for (const dep of task.dependencies) {
      const depId = sanitizeNodeId(dep)
      lines.push(`    ${depId} --> ${nodeId}`)
    }
  }

  lines.push("```")
  return lines.join("\n")
}

/**
 * 清理节点 ID，移除特殊字符
 */
function sanitizeNodeId(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, "_")
    .replace(/^(\d)/, "_$1") // 不能以数字开头
}

/**
 * 转义标签中的特殊字符
 */
function escapeLabel(label: string): string {
  return label.replace(/"/g, '\\"').replace(/\n/g, " ")
}

/**
 * 根据任务状态返回节点样式
 */
function getNodeStyle(status: Task["status"]): string {
  switch (status) {
    case "completed":
      return ":::completed"
    case "in_progress":
      return ":::inProgress"
    case "cancelled":
      return ":::cancelled"
    case "pending":
    default:
      return ":::pending"
  }
}

/**
 * 生成带样式定义的完整 Mermaid 图
 */
export function generateMermaidWithStyles(tasks: Task[]): string {
  const graph = generateMermaid(tasks)

  // 添加样式定义
  const styles = `
    classDef completed fill:#90EE90,stroke:#2E7D32,stroke-width:2px
    classDef inProgress fill:#FFD700,stroke:#F57C00,stroke-width:2px
    classDef pending fill:#E0E0E0,stroke:#757575,stroke-width:2px
    classDef cancelled fill:#FFCDD2,stroke:#C62828,stroke-width:2px
  `.trim()

  // 在 ``` 结束标记前插入样式
  return graph.replace("```", `\n${styles}\n\`\`\``)
}
