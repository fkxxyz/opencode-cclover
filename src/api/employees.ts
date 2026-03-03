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
  const bosses: Employee[] = bossNames.map((name) => ({
    name,
    role: "Boss",
    status: "active" as const,
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
 * 获取雇佣关系树
 */
export function getHierarchy(
  stateManager: StateManager
): SuccessResponse<{ hierarchy: EmployeeHierarchy }> {
  const employees = stateManager.getEmployees()

  // 找到根节点（hiredBy 为 null 或 undefined）
  const rootEmployee = employees.find((e) => !e.hiredBy)

  if (!rootEmployee) {
    // 如果没有根节点，返回第一个员工作为根
    const firstEmployee = employees[0]
    return {
      success: true,
      data: {
        hierarchy: {
          name: firstEmployee.name,
          role: firstEmployee.role,
          status: firstEmployee.status,
          children: [],
        },
      },
    }
  }

  // 构建树状结构
  const buildTree = (employee: Employee): EmployeeHierarchy => {
    const children = employees
      .filter((e) => e.hiredBy === employee.name)
      .map((e) => buildTree(e))

    return {
      name: employee.name,
      role: employee.role,
      status: employee.status,
      children,
    }
  }

  const hierarchy = buildTree(rootEmployee)

  return {
    success: true,
    data: {
      hierarchy,
    },
  }
}
