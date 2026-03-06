/**
 * edit_tasks 工具
 *
 * 批量编辑任务列表（添加、更新、删除任务）
 */
import { tool } from "@opencode-ai/plugin"
import type { MemoryManager } from "../core/MemoryManager"
import { sessionRegistry } from "../utils/SessionRegistry"

/**
 * 创建 edit_tasks 工具
 *
 * @param memoryManager 记忆管理器实例
 */
export function createEditTasksTool(memoryManager: MemoryManager) {
  return tool({
    description: "批量编辑任务列表（添加、更新、删除任务）",
    args: {
      operations: tool.schema
        .array(
          tool.schema.object({
            action: tool.schema
              .enum(["add", "update", "delete", "decompose"])
              .describe("操作类型"),
            name: tool.schema
              .string()
              .optional()
              .describe(
                "任务名称（add/update/delete/decompose 操作必需，作为任务的唯一标识）"
              ),
            description: tool.schema
              .string()
              .optional()
              .describe("任务描述（add 操作必需，update 操作可选）"),
            dependencies: tool.schema
              .array(tool.schema.string())
              .optional()
              .describe("依赖任务列表（add/update 操作可选）"),
            status: tool.schema
              .enum([
                "pending",
                "in_progress",
                "completed",
                "cancelled",
                "waiting_for_message",
              ])
              .optional()
              .describe("任务状态（update 操作可选）"),
            result: tool.schema
              .string()
              .optional()
              .describe("任务结果（update 操作可选）"),
            subtasks: tool.schema
              .array(
                tool.schema.object({
                  name: tool.schema.string().describe("子任务名称"),
                  description: tool.schema.string().describe("子任务描述"),
                  dependencies: tool.schema
                    .array(tool.schema.string())
                    .optional()
                    .describe("子任务额外依赖（可选）"),
                })
              )
              .optional()
              .describe("子任务列表（decompose 操作必需）"),
          })
        )
        .describe("操作列表"),
    },
    async execute(args, context) {
      // 1. 获取调用者信息
      const employeeName = sessionRegistry.getEmployeeName(context.sessionID)

      if (!employeeName) {
        return `错误: 无法识别调用者身份 (sessionID: ${context.sessionID})`
      }

      const results: string[] = []
      let hasSuccess = false

      // 2. 执行每个操作
      for (const op of args.operations) {
        try {
          if (op.action === "add") {
            // 添加任务
            if (!op.name || !op.description) {
              results.push(`错误: add 操作需要 name 和 description 字段`)
              continue
            }

            await memoryManager.addTask(employeeName, {
              name: op.name,
              status: "pending",
              description: op.description,
              dependencies: op.dependencies || [],
            })
            results.push(`✓ 已添加任务: ${op.name}`)
            hasSuccess = true
          } else if (op.action === "update") {
            // 更新任务
            if (!op.name) {
              results.push(`错误: update 操作需要 name 字段`)
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
            results.push(`✓ 已更新任务: ${op.name}`)
            hasSuccess = true
          } else if (op.action === "delete") {
            // 删除任务并清理依赖
            if (!op.name) {
              results.push(`错误: delete 操作需要 name 字段`)
              continue
            }

            const { affectedTasks } = await memoryManager.deleteTaskWithCleanup(
              employeeName,
              op.name
            )

            if (affectedTasks.length > 0) {
              results.push(
                `✓ 已删除任务: ${op.name} (自动清理了 ${affectedTasks.length} 个任务的依赖: ${affectedTasks.join(", ")})`
              )
            } else {
              results.push(`✓ 已删除任务: ${op.name}`)
            }
            hasSuccess = true
          } else if (op.action === "decompose") {
            // 分解任务
            if (!op.name) {
              results.push(`错误: decompose 操作需要 name 字段`)
              continue
            }

            if (!op.subtasks || op.subtasks.length === 0) {
              results.push(`错误: decompose 操作需要非空的 subtasks 列表`)
              continue
            }

            // 验证每个子任务
            let hasError = false
            for (const subtask of op.subtasks) {
              if (!subtask.name || !subtask.description) {
                results.push(`错误: 每个子任务都需要 name 和 description 字段`)
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
              `✓ 已分解任务: ${op.name} 为 ${op.subtasks.length} 个子任务`
            )
            hasSuccess = true
          }
        } catch (error) {
          results.push(
            `✗ 操作失败 (${op.action} ${op.name}): ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }

      // 3. 如果有成功的操作,返回当前任务状态
      if (hasSuccess) {
        try {
          const inProgressTasks =
            await memoryManager.getInProgressTasks(employeeName)
          const executableTasks =
            await memoryManager.getExecutableTasks(employeeName)

          results.push("")
          results.push(
            `正在进行的任务: ${inProgressTasks.length > 0 ? inProgressTasks.map((t) => t.name).join(", ") : "无"}`
          )
          results.push(
            `可执行的任务: ${executableTasks.length > 0 ? executableTasks.map((t) => t.name).join(", ") : "无"}`
          )
        } catch (error) {
          // 获取任务状态失败不影响主要操作结果
        }
      }

      return results.join("\n")
    },
  })
}
