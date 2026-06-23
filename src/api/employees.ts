import * as fs from "fs/promises"
import * as path from "path"
import type { StateManager } from "../state/StateManager"
import type { MemoryManager } from "../core/MemoryManager"
import type {
  Employee,
  EmployeeDetail,
  SuccessResponse,
  ErrorResponse,
} from "../types/index"
import { formatBossId } from "../types/employee"
import type { BossManager } from "../core/BossManager"
import type { RoleManager } from "../core/RoleManager"

/**
 * Boss information for HTTP API
 */
export interface BossInfo {
  /** Display name (for configured bosses, same as id; for meeting-mode, role.name) */
  name: string
  /** Stable identity ID */
  id: string
  /** Boss type */
  type: "configured" | "meeting-mode"
}

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
  bossManager: BossManager,
  roleManager?: RoleManager
): SuccessResponse<{ bosses: BossInfo[] }> {
  const bossIds = bossManager.getBosses()
  const bosses: BossInfo[] = []

  // Build a map of role.id -> role.name for meeting-mode roles
  const roleIdToName = new Map<string, string>()
  if (roleManager) {
    for (const role of roleManager.getAllRoles()) {
      roleIdToName.set(role.id, role.name)
    }
  }

  for (const id of bossIds) {
    if (roleIdToName.has(id)) {
      // Meeting-mode Boss (role)
      bosses.push({
        name: roleIdToName.get(id)!,
        id,
        type: "meeting-mode",
      })
    } else {
      // Configured Boss
      bosses.push({
        name: id,
        id,
        type: "configured",
      })
    }
  }

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
  employeeId: string,
  stateManager: StateManager,
  _memoryManager: MemoryManager
): Promise<SuccessResponse<EmployeeDetail> | ErrorResponse> {
  // employeeId 是员工资源键，name 只作为展示字段
  const employees = stateManager.getEmployees()
  const employee = employees.find((e) => e.employeeId === employeeId)

  if (!employee) {
    return {
      success: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: `员工 '${employeeId}' 不存在`,
      },
    }
  }

  try {
    // 员工已是元数据实体，详情接口不再从员工 ID 读取运行时记忆。
    const memory = { knowledge: [], tasks: [], args: {} }

    // 获取员工的任务
    const tasks = memory.tasks || []

    const detail: EmployeeDetail = {
      ...employee,
      memory,
      tasks,
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
        message: `读取员工 '${employeeId}' 的数据失败: ${error.message}`,
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

    const detail = {
      employeeId: formatBossId(name),
      name,
      roleId: "Boss",
      hiredBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: "Configured boss identity",
      contextPaths: [],
      memory,
      tasks: memory.tasks || [],
    } as unknown as EmployeeDetail

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
