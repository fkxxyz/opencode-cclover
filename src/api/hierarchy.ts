import type { StateManager } from "../state/StateManager"
import type { BossManager } from "../core/BossManager"
import type { EmployeeHierarchy, SuccessResponse } from "../types/index"
import { formatBossId } from "../types/employee"

/**
 * 获取雇佣关系树（多根节点）
 *
 * 返回所有配置 boss 和根员工的树结构数组：
 * 1. 配置中的 boss 作为根节点
 * 2. hiredBy 精确等于父级 employeeId 的员工作为子节点
 * 3. hiredBy 为空或无法按 employeeId 解析到父级的员工作为独立根节点显示在顶层
 */
export function getHierarchy(
  stateManager: StateManager,
  bossManager: BossManager
): SuccessResponse<{ hierarchy: EmployeeHierarchy[] }> {
  const employees = stateManager.getEmployees()
  const configuredBosses = bossManager.getBosses()

  const allBossNames = new Set<string>(configuredBosses)
  const employeeIds = new Set(employees.map((e) => e.employeeId))
  const bossEmployeeIds = new Set(
    Array.from(allBossNames).map((bossName) => formatBossId(bossName))
  )

  // 仅按稳定 employeeId 建立边，避免把展示名称误用为身份
  const buildTree = (parentEmployeeId: string): EmployeeHierarchy[] => {
    return employees
      .filter((e) => e.hiredBy === parentEmployeeId)
      .map((e) => {
        return {
          employeeId: e.employeeId,
          name: e.name,
          role: e.roleId,
          status: e.status,
          children: buildTree(e.employeeId),
        }
      })
  }

  const roots: EmployeeHierarchy[] = []

  // 为每个 boss 创建根节点
  for (const bossName of allBossNames) {
    const bossEmployeeId = formatBossId(bossName)
    roots.push({
      name: bossName,
      role: "Boss",
      status: "busy",
      children: buildTree(bossEmployeeId),
    })
  }

  const rootEmployees = employees.filter(
    (employee) =>
      !employee.hiredBy ||
      (!employeeIds.has(employee.hiredBy) &&
        !bossEmployeeIds.has(employee.hiredBy))
  )

  for (const employee of rootEmployees) {
    roots.push({
      employeeId: employee.employeeId,
      name: employee.name,
      role: employee.roleId,
      status: employee.status,
      children: buildTree(employee.employeeId),
    })
  }

  return {
    success: true,
    data: {
      hierarchy: roots,
    },
  }
}
