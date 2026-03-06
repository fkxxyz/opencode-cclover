/**
 * edit_tasks tool
 *
 * Batch edit task list (add, update, delete tasks)
 */
import { tool } from "@opencode-ai/plugin"
import type { MemoryManager } from "../core/MemoryManager"
import { sessionRegistry } from "../utils/SessionRegistry"

/**
 * Create edit_tasks tool
 *
 * @param memoryManager Memory manager instance
 */
export function createEditTasksTool(memoryManager: MemoryManager) {
  return tool({
    description: "Batch edit task list (add, update, delete tasks)",
    args: {
      operations: tool.schema
        .array(
          tool.schema.object({
            action: tool.schema
              .enum(["add", "update", "delete", "decompose"])
              .describe("Operation type"),
            name: tool.schema
              .string()
              .optional()
              .describe(
                "Task name (required for add/update/delete/decompose operations, serves as unique identifier)"
              ),
            description: tool.schema
              .string()
              .optional()
              .describe(
                "Task description (required for add operation, optional for update operation)"
              ),
            dependencies: tool.schema
              .array(tool.schema.string())
              .optional()
              .describe(
                "Dependency task list (optional for add/update operations)"
              ),
            status: tool.schema
              .enum([
                "pending",
                "in_progress",
                "completed",
                "cancelled",
                "waiting_for_message",
              ])
              .optional()
              .describe("Task status (optional for update operation)"),
            result: tool.schema
              .string()
              .optional()
              .describe("Task result (optional for update operation)"),
            subtasks: tool.schema
              .array(
                tool.schema.object({
                  name: tool.schema.string().describe("Subtask name"),
                  description: tool.schema
                    .string()
                    .describe("Subtask description"),
                  dependencies: tool.schema
                    .array(tool.schema.string())
                    .optional()
                    .describe("Additional subtask dependencies (optional)"),
                })
              )
              .optional()
              .describe("Subtask list (required for decompose operation)"),
          })
        )
        .describe("Operation list"),
    },
    async execute(args, context) {
      // 1. Get caller information
      const employeeName = sessionRegistry.getEmployeeName(context.sessionID)

      if (!employeeName) {
        return `Error: Unable to identify caller (sessionID: ${context.sessionID})`
      }

      const results: string[] = []
      let hasSuccess = false

      // 2. Execute each operation
      for (const op of args.operations) {
        try {
          if (op.action === "add") {
            // Add task
            if (!op.name || !op.description) {
              results.push(
                `Error: add operation requires name and description fields`
              )
              continue
            }

            await memoryManager.addTask(employeeName, {
              name: op.name,
              status: "pending",
              description: op.description,
              dependencies: op.dependencies || [],
            })
            results.push(`✓ Added task: ${op.name} [pending]`)
            hasSuccess = true
          } else if (op.action === "update") {
            // Update task
            if (!op.name) {
              results.push(`Error: update operation requires name field`)
              continue
            }

            const updates: any = {}
            if (op.status) updates.status = op.status
            if (op.result !== undefined) updates.result = op.result
            if (op.description !== undefined)
              updates.description = op.description
            if (op.dependencies !== undefined)
              updates.dependencies = op.dependencies
            if (op.status === "completed" && !updates.completed) {
              updates.completed = new Date().toISOString()
            }

            await memoryManager.updateTask(employeeName, op.name, updates)

            // Get updated task to show current status
            const memory = await memoryManager.read(employeeName)
            const updatedTask = memory.tasks.find((t) => t.name === op.name)
            const status = updatedTask?.status || "unknown"
            results.push(`✓ Updated task: ${op.name} [${status}]`)
            hasSuccess = true
          } else if (op.action === "delete") {
            // Delete task and cleanup dependencies
            if (!op.name) {
              results.push(`Error: delete operation requires name field`)
              continue
            }

            const { affectedTasks } = await memoryManager.deleteTaskWithCleanup(
              employeeName,
              op.name
            )

            if (affectedTasks.length > 0) {
              results.push(
                `✓ Deleted task: ${op.name} (cleaned up dependencies in ${affectedTasks.length} tasks: ${affectedTasks.join(", ")})`
              )
            } else {
              results.push(`✓ Deleted task: ${op.name}`)
            }
            hasSuccess = true
          } else if (op.action === "decompose") {
            // Decompose task
            if (!op.name) {
              results.push(`Error: decompose operation requires name field`)
              continue
            }

            if (!op.subtasks || op.subtasks.length === 0) {
              results.push(
                `Error: decompose operation requires non-empty subtasks list`
              )
              continue
            }

            // Validate each subtask
            let hasError = false
            for (const subtask of op.subtasks) {
              if (!subtask.name || !subtask.description) {
                results.push(
                  `Error: each subtask requires name and description fields`
                )
                hasError = true
                break
              }
            }

            if (hasError) {
              continue
            }

            await memoryManager.decomposeTask(
              employeeName,
              op.name,
              op.subtasks
            )
            results.push(
              `✓ Decomposed task: ${op.name} into ${op.subtasks.length} subtasks [pending]`
            )
            hasSuccess = true
          }
        } catch (error) {
          results.push(
            `✗ Operation failed (${op.action} ${op.name}): ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }

      // 3. If there are successful operations, return current task status
      if (hasSuccess) {
        try {
          const inProgressTasks =
            await memoryManager.getInProgressTasks(employeeName)
          const executableTasks =
            await memoryManager.getExecutableTasks(employeeName)

          results.push("")
          results.push(
            `In progress tasks: ${inProgressTasks.length > 0 ? inProgressTasks.map((t) => t.name).join(", ") : "None"}`
          )
          results.push(
            `Executable tasks: ${executableTasks.length > 0 ? executableTasks.map((t) => t.name).join(", ") : "None"}`
          )
        } catch (error) {
          // Getting task status failure doesn't affect main operation result
        }
      }

      return results.join("\n")
    },
  })
}
