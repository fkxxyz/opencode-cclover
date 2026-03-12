import type { StateManager } from "../state/StateManager"
import type { BossManager } from "../core/BossManager"
import type { EmployeeHierarchy, SuccessResponse } from "../types/index"

/**
 * 获取雇佣关系树（多根节点）
 *
 * 返回所有 boss 和根员工的树结构数组：
 * 1. 所有 boss 作为根节点（包括配置中的和员工 hiredBy 中提到的）
 * 2. hiredBy 为 boss 的员工作为 boss 的子节点
 */
export function getHierarchy(
  stateManager: StateManager,
  bossManager: BossManager
): SuccessResponse<{ hierarchy: EmployeeHierarchy[] }> {
  const employees = stateManager.getEmployees()
  const configuredBosses = bossManager.getBosses()

  // 收集所有 boss（配置中的 + 员工 hiredBy 中提到的）
  const allBosses = new Set<string>(configuredBosses)
  employees.forEach((emp) => {
    // 如果 hiredBy 不是 employeeId 格式（不包含 '-'），则认为是 boss
    if (emp.hiredBy && !emp.hiredBy.includes("-")) {
      allBosses.add(emp.hiredBy)
    }
  })

  // 构建以 employeeId 为 key 的 map
  const employeeMap = new Map(employees.map((e) => [e.employeeId, e]))

  const buildTree = (parentId: string): EmployeeHierarchy[] => {
    return employees
      .filter((e) => e.hiredBy === parentId)
      .map((e) => ({
        name: e.name,
        role: e.role,
        status: e.status,
        children: buildTree(e.employeeId),
      }))
  }

  const roots: EmployeeHierarchy[] = []

  // 为每个 boss 创建根节点
  for (const bossName of allBosses) {
    roots.push({
      name: bossName,
      role: "Boss",
      status: "busy",
      children: buildTree(bossName),
    })
  }

  return {
    success: true,
    data: {
      hierarchy: roots,
    },
  }
}
