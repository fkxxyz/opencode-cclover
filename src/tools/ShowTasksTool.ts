/**
 * show_tasks 工具
 *
 * 展示当前员工的所有任务及其依赖关系
 */
import { tool } from "@opencode-ai/plugin"
import type { MemoryManager } from "../core/MemoryManager"
import { sessionRegistry } from "../utils/SessionRegistry"
import { generateMermaid } from "../utils/MermaidGenerator"

/**
 * 创建 show_tasks 工具
 *
 * @param memoryManager 记忆管理器实例
 */
export function createShowTasksTool(memoryManager: MemoryManager) {
  return tool({
    description: "Display all tasks with dependency graph visualization",
    args: {},
    async execute(args, context) {
      // 1. 获取调用者信息
      const employeeName = sessionRegistry.getEmployeeName(context.sessionID)

      if (!employeeName) {
        return `错误: 无法识别调用者身份 (sessionID: ${context.sessionID})`
      }

      // 2. 读取员工记忆
      const memory = await memoryManager.read(employeeName)

      if (!memory || !memory.tasks || memory.tasks.length === 0) {
        return "当前没有任何任务"
      }

      const sections: string[] = []

      // 3. 第一部分：Task Dependency Graph
      sections.push("## Task Dependency Graph")
      sections.push("")
      sections.push(generateMermaid(memory.tasks))
      sections.push("")

      // 4. 第二部分：Executable Tasks
      const executableTasks =
        await memoryManager.getExecutableTasks(employeeName)
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

      // 5. 第三部分：Tasks In Progress
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

      return sections.join("\n")
    },
  })
}
