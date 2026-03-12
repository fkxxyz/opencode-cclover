import * as fs from "fs/promises"
import * as path from "path"
import type { StateManager } from "../state/StateManager"
import type { MemoryManager } from "../core/MemoryManager"
import { agentRegistry } from "../utils/AgentRegistry"
import type {
  Employee,
  EmployeeDetail,
  EmployeeHierarchy,
  SuccessResponse,
  ErrorResponse,
} from "../types/index"
import type { BossManager } from "../core/BossManager"

/**
 * 获取所有员工列表
 */
export function getEmployees(
  stateManager: StateManager
): SuccessResponse<{ employees: Employee[] }> {
  const employees = stateManager.getEmployees()
  return {
    success: true,
    data: {
      employees,
    },
  }
}

/**
 * 获取所有 boss 列表
 */
export function getBosses(
  bossManager: BossManager
): SuccessResponse<{ bosses: Employee[] }> {
  const bossNames = bossManager.getBosses()

  // 为每个 boss 构造 Employee 对象
  // @ts-expect-error - Will be fixed in Task 6.1 (Phase 6)
  // TODO: Update API to use employeeId
  const bosses: Employee[] = bossNames.map((name) => ({
    name,
    role: "Boss",
    status: "busy" as const,
    paused: false,
    createdAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
  }))

  return {
    success: true,
    data: {
      bosses,
    },
  }
}

/**
 * 获取员工详情
 */
export async function getEmployeeDetail(
  name: string,
  stateManager: StateManager,
  memoryManager: MemoryManager,
  agentRegistry: any,
  workspaceRoot: string
): Promise<SuccessResponse<EmployeeDetail> | ErrorResponse> {
  const employee = stateManager.getEmployee(name)

  if (!employee) {
    return {
      success: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: `员工 '${name}' 不存在`,
      },
    }
  }

  try {
    // 读取员工记忆
    const memory = await memoryManager.read(name)

    // 获取员工的任务
    const tasks = memory.tasks || []

    // 获取员工创建的 Agent 执行记录
    const agentIds = agentRegistry.getAgentsByEmployee(name)
    const agents = agentIds.map((agentId: string) => {
      const info = agentRegistry.getInfo(agentId)
      return {
        agentId,
        taskName: info?.taskName || "",
        status: "running" as const,
        createdAt: new Date().toISOString(),
      }
    })

    const detail: EmployeeDetail = {
      ...employee,
      memory,
      tasks,
      agents,
    }

    return {
      success: true,
      data: detail,
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: "FILE_READ_ERROR",
        message: `读取员工 '${name}' 的数据失败: ${error.message}`,
      },
    }
  }
}

/**
 * 获取 boss 详情
 */
export async function getBossDetail(
  name: string,
  bossManager: BossManager,
  agentRegistry: any,
  workspaceRoot: string
): Promise<SuccessResponse<EmployeeDetail> | ErrorResponse> {
  // 验证 boss 是否存在
  const bossNames = bossManager.getBosses()
  if (!bossNames.includes(name)) {
    return {
      success: false,
      error: {
        code: "BOSS_NOT_FOUND",
        message: `Boss '${name}' 不存在`,
      },
    }
  }

  try {
    // 读取 boss 记忆文件
    const memoryPath = path.join(workspaceRoot, "bosses", name, "memory.yaml")
    let memory: any = { knowledge: [], tasks: [], args: {} }

    try {
      const content = await fs.readFile(memoryPath, "utf-8")
      const yaml = await import("yaml")
      const data = yaml.parse(content)
      memory = {
        knowledge: data?.knowledge ?? [],
        tasks: data?.tasks ?? [],
        args: data?.args ?? {},
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") {
        throw error
      }
      // 文件不存在，使用空记忆
    }

    // 获取 boss 创建的 Agent 执行记录
    const agentIds = agentRegistry.getAgentsByEmployee(name)
    const agents = agentIds.map((agentId: string) => {
      const info = agentRegistry.getInfo(agentId)
      return {
        agentId,
        taskName: info?.taskName || "",
        status: "running" as const,
        createdAt: new Date().toISOString(),
      }
    })

    // @ts-expect-error - Will be fixed in Task 6.1 (Phase 6)
    // TODO: Update API to use employeeId
    const detail: EmployeeDetail = {
      name,
      role: "Boss",
      status: "busy" as const,
      paused: false,
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      memory,
      tasks: memory.tasks || [],
      agents,
    }

    return {
      success: true,
      data: detail,
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: "FILE_READ_ERROR",
        message: `读取 boss '${name}' 的数据失败: ${error.message}`,
      },
    }
  }
}
