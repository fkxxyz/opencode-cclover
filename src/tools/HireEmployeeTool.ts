/**
 * hire_employee 工具
 *
 * 雇佣新员工
 */

import { tool } from "@opencode-ai/plugin"
import type { StateManager } from "../state/StateManager"
import type { RoleManager } from "../core/RoleManager"
import type { ProjectInstance } from "../server/ProjectRegistry"
import { sessionRegistry } from "../utils/SessionRegistry"
import { logger } from "../lib/logger"

export function createHireEmployeeTool(
  stateManager: StateManager,
  roleManager: RoleManager,
  project: ProjectInstance
) {
  return tool({
    description: "雇佣新员工",
    args: {
      name: tool.schema.string().describe("员工名称"),
      role: tool.schema.string().describe("角色类型"),
    },
    async execute(args, context) {
      try {
        // 1. 获取调用者身份
        const hiredBy = sessionRegistry.getEmployeeName(context.sessionID)
        if (!hiredBy) {
          return "错误：无法识别调用者身份"
        }

        // 2. 验证角色是否存在
        const roleDefinition = roleManager.getRole(args.role)
        if (!roleDefinition) {
          return `错误：角色 '${args.role}' 不存在`
        }

        // 3. 检查员工是否已存在
        const existing = stateManager.getEmployee(args.name)
        if (existing) {
          return `错误：员工 '${args.name}' 已存在`
        }

        // 4. 注册员工（自动持久化）
        await stateManager.registerEmployee({
          name: args.name,
          role: args.role,
          status: "offline",
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          hiredBy,
        })

        // 5. 启动员工的 EventLoop
        await startEmployee(project, args.name, roleDefinition)

        logger.info(
          `[HireEmployeeTool] Employee '${args.name}' hired by '${hiredBy}' with role '${args.role}'`
        )

        return `成功雇佣员工 '${args.name}'，角色: ${args.role}`
      } catch (error: any) {
        logger.error(`[HireEmployeeTool] Failed to hire employee:`, error)
        return `雇佣失败: ${error.message}`
      }
    },
  })
}

/**
 * 启动员工的 EventLoop
 */
async function startEmployee(
  project: ProjectInstance,
  employeeName: string,
  role: { name: string; systemPrompt: string }
): Promise<void> {
  // 动态导入 EventLoop（避免循环依赖）
  const { EventLoop } = await import("../core/EventLoop")
  const { GlobalCcloverService } = await import("../server/GlobalServer")

  const messageClient = project.messageService.getClient(employeeName)
  const globalService = await GlobalCcloverService.getInstance()
  const opcodeClient = globalService.getOpencodeClient()

  const eventLoop = new EventLoop(
    project.directory,
    employeeName,
    role,
    messageClient,
    project.memoryManager,
    opcodeClient,
    project.stateManager
  )

  // 存储到 project.eventLoops
  project.eventLoops.set(employeeName, eventLoop)

  // 后台运行
  eventLoop.run().catch((error) => {
    logger.error(`[${employeeName}] EventLoop crashed:`, error)
  })

  logger.info(`[startEmployee] EventLoop started for employee: ${employeeName}`)
}
