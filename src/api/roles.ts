/**
 * Roles API
 *
 * 提供 role 管理相关的 API
 */

import type { RoleManager } from "../core/RoleManager"
import type { StateManager } from "../state/StateManager"

/**
 * 刷新 role 列表
 *
 * 扫描三个位置（预设、全局、项目）并重新加载所有 role
 */
export async function refreshRoles(roleManager: RoleManager) {
  await roleManager.refresh()

  return {
    success: true,
    data: {
      message: "Roles refreshed successfully",
      count: roleManager.getRoleNames().length,
      roles: roleManager.getAllRoles().map((role) => ({
        name: role.name,
        source: role.source,
      })),
    },
  }
}

/**
 * 获取所有 role（包含元数据）
 */
export async function getRoles(roleManager: RoleManager) {
  return {
    success: true,
    data: {
      roles: roleManager.getAllRoles(),
    },
  }
}

/**
 * 获取指定 role（包含元数据）
 */
export async function getRole(roleManager: RoleManager, name: string) {
  const role = roleManager.getRole(name)

  if (!role) {
    return {
      success: false,
      error: {
        code: "ROLE_NOT_FOUND",
        message: `Role "${name}" not found`,
      },
    }
  }

  return {
    success: true,
    data: role,
  }
}

/**
 * 获取员工的角色元数据
 */
export async function getEmployeeRole(
  employeeName: string,
  stateManager: StateManager,
  roleManager: RoleManager
) {
  // 获取员工状态
  const employee = await stateManager.getEmployee(employeeName)

  if (!employee) {
    return {
      success: false,
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: `Employee "${employeeName}" not found`,
      },
    }
  }

  // 获取角色信息
  const role = roleManager.getRole(employee.role)

  if (!role) {
    return {
      success: false,
      error: {
        code: "ROLE_NOT_FOUND",
        message: `Role "${employee.role}" not found`,
      },
    }
  }

  return {
    success: true,
    data: role,
  }
}
