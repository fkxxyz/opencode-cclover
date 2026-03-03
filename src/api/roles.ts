/**
 * Roles API
 *
 * 提供 role 管理相关的 API
 */

import type { RoleManager } from "../core/RoleManager"

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
 * 获取所有 role
 */
export async function getRoles(roleManager: RoleManager) {
  return {
    success: true,
    data: {
      roles: roleManager.getAllRoles().map((role) => ({
        name: role.name,
        source: role.source,
        systemPrompt: role.systemPrompt,
      })),
    },
  }
}

/**
 * 获取指定 role
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
    data: {
      role: {
        name: role.name,
        source: role.source,
        systemPrompt: role.systemPrompt,
      },
    },
  }
}
