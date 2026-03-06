/**
 * hire_employee 工具
 *
 * 雇佣新员工
 */

import { tool } from "@opencode-ai/plugin"
import type { StateManager } from "../state/StateManager"
import type { RoleManager } from "../core/RoleManager"
import type { ProjectInstance } from "../server/ProjectRegistry"
import type { BossManager } from "../core/BossManager"
import { sessionRegistry } from "../utils/SessionRegistry"
import { logger } from "../lib/logger"

export function createHireEmployeeTool(
  stateManager: StateManager,
  roleManager: RoleManager,
  project: ProjectInstance,
  bossManager?: BossManager
) {
  return tool({
    description: "雇佣新员工",
    args: {
      name: tool.schema.string().describe("员工名称"),
      role: tool.schema.string().describe("角色类型"),
      initial_message: tool.schema
        .string()
        .optional()
        .describe("可选：招聘成功后立即发送给新员工的第一条消息"),
    },
    async execute(args, context) {
      try {
        // 1. 获取调用者身份
        let hiredBy: string | undefined
        // 2. 首先尝试从 SessionRegistry 获取（员工）
        hiredBy = sessionRegistry.getEmployeeName(context.sessionID)
        // 3. 如果 SessionRegistry 中没有，尝试从 context.agent 获取（可能是 boss）
        if (!hiredBy && context.agent) {
          const agentName = context.agent
          // 检查是否是 boss
          if (bossManager?.isBoss(agentName)) {
            hiredBy = agentName
          }
        }
        if (!hiredBy) {
          return `错误：无法识别调用者身份 (sessionID: ${context.sessionID}, agent: ${context.agent || "unknown"})`
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

        // 6. 如果提供了 initial_message，立即发送给新员工
        if (args.initial_message) {
          await project.messageService.send(
            hiredBy,
            args.name,
            args.initial_message
          )
          logger.info(
            `[HireEmployeeTool] Initial message sent to '${args.name}' from '${hiredBy}'`
          )
          return `成功雇佣员工 '${args.name}'，角色: ${args.role}，已发送初始消息`
        }

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
    role.name,
    project.roleManager,
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
