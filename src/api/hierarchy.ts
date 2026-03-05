import type { StateManager } from "../state/StateManager"
import type { BossManager } from "../core/BossManager"
import type { EmployeeHierarchy, SuccessResponse } from "../types/index"

/**
 * 获取雇佣关系树（多根节点）
 *
 * 返回所有 boss 和根员工的树结构数组：
 * 1. 所有 boss 作为根节点（包括配置中的和员工 hiredBy 中提到的）
 * 2. hiredBy 为 null/undefined 的员工作为根节点
 */
export function getHierarchy(
  stateManager: StateManager,
  bossManager: BossManager
): SuccessResponse<{ hierarchy: EmployeeHierarchy[] }> {
  const employees = stateManager.getEmployees()
  const configuredBosses = bossManager.getBosses()

  const allBosses = new Set<string>(configuredBosses)
  employees.forEach((emp) => {
    if (emp.hiredBy && !employees.some((e) => e.name === emp.hiredBy)) {
      allBosses.add(emp.hiredBy)
    }
  })

  const buildTree = (parentName: string): EmployeeHierarchy[] => {
    return employees
      .filter((e) => e.hiredBy === parentName)
      .map((e) => ({
        name: e.name,
        role: e.role,
        status: e.status,
        children: buildTree(e.name),
      }))
  }

  const roots: EmployeeHierarchy[] = []

  for (const bossName of allBosses) {
    roots.push({
      name: bossName,
      role: "Boss",
      status: "busy",
      children: buildTree(bossName),
    })
  }

  const rootEmployees = employees.filter((e) => !e.hiredBy)
  for (const emp of rootEmployees) {
    roots.push({
      name: emp.name,
      role: emp.role,
      status: emp.status,
      children: buildTree(emp.name),
    })
  }

  return {
    success: true,
    data: {
      hierarchy: roots,
    },
  }
}
