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
              .enum(["add", "update", "delete"])
              .describe("操作类型"),
            name: tool.schema.string().optional().describe("任务名称"),
            description: tool.schema.string().optional().describe("任务描述"),
            dependencies: tool.schema
              .array(tool.schema.string())
              .optional()
              .describe("依赖任务列表"),
            status: tool.schema
              .enum(["pending", "in_progress", "completed", "cancelled"])
              .optional()
              .describe("任务状态"),
            result: tool.schema.string().optional().describe("任务结果"),
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
          } else if (op.action === "update") {
            // 更新任务
            if (!op.name) {
              results.push(`错误: update 操作需要 name 字段`)
              continue
            }

            const updates: any = {}
            if (op.status) updates.status = op.status
            if (op.result !== undefined) updates.result = op.result
            if (op.status === "completed" && !updates.completed) {
              updates.completed = new Date().toISOString()
            }

            await memoryManager.updateTask(employeeName, op.name, updates)
            results.push(`✓ 已更新任务: ${op.name}`)
          } else if (op.action === "delete") {
            // 删除任务
            if (!op.name) {
              results.push(`错误: delete 操作需要 name 字段`)
              continue
            }

            await memoryManager.deleteTask(employeeName, op.name)
            results.push(`✓ 已删除任务: ${op.name}`)
          }
        } catch (error) {
          results.push(
            `✗ 操作失败 (${op.action} ${op.name}): ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }

      return results.join("\n")
    },
  })
}
