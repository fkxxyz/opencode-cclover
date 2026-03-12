/**
 * show_tasks tool
 *
 * Display all tasks and their dependencies for the current employee
 */
import { tool } from "@opencode-ai/plugin"
import type { MemoryManager } from "../core/MemoryManager"
import type { StateManager } from "../state/StateManager"
import { sessionRegistry } from "../utils/SessionRegistry"
import { generateMermaid } from "../utils/MermaidGenerator"

/**
 * Create show_tasks tool
 *
 * @param memoryManager Memory manager instance
 * @param stateManager State manager instance
 */
export function createShowTasksTool(
  memoryManager: MemoryManager,
  stateManager: StateManager
) {
  return tool({
    description: "Display all tasks with dependency graph visualization",
    args: {},
    async execute(args, context) {
      // 1. Get caller information
      const employeeId = sessionRegistry.getEmployeeId(context.sessionID)

      if (!employeeId) {
        return `Error: Unable to identify caller (sessionID: ${context.sessionID})`
      }

      // 2. Look up employee to get name
      const employee = stateManager.getEmployee(employeeId)
      if (!employee) {
        return `Error: Employee not found (employeeId: ${employeeId})`
      }

      const employeeName = employee.name

      // 2. Read employee memory
      const memory = await memoryManager.read(employeeId)

      if (!memory || !memory.tasks || memory.tasks.length === 0) {
        return "Currently no tasks"
      }

      const sections: string[] = []

      // 3. Part 1: Task Dependency Graph
      sections.push("## Task Dependency Graph")
      sections.push("")
      sections.push(generateMermaid(memory.tasks))
      sections.push("")

      // 4. Part 2: Executable Tasks
      const executableTasks = await memoryManager.getExecutableTasks(employeeId)
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

      // 5. Part 3: Tasks In Progress
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
