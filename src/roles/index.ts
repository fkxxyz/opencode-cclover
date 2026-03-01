import type { Role } from "../core/EventLoop"
import { CalculatorRole } from "./Calculator"

/**
 * 角色注册表
 *
 * 所有可用的角色定义
 */
export const Roles: Record<string, Role> = {
  calculator: CalculatorRole,
}

/**
 * 根据名称获取角色
 */
export function getRole(name: string): Role | undefined {
  return Roles[name]
}

/**
 * 获取所有角色名称
 */
export function getRoleNames(): string[] {
  return Object.keys(Roles)
}

// 导出角色定义
export { CalculatorRole }
