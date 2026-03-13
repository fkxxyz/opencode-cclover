import type { StateManager } from "../state/StateManager"
import type { BossManager } from "../core/BossManager"
import type { EmployeeHierarchy, SuccessResponse } from "../types/index"
import { formatBossId } from "../types/employee"

/**
 * 获取雇佣关系树（多根节点）
 *
 * 返回所有 boss 和根员工的树结构数组：
 * 1. 所有 boss 作为根节点（包括配置中的和员工 hiredBy 中提到的）
 * 2. hiredBy 为 boss employeeId 的员工作为 boss 的子节点
 */
export function getHierarchy(
  stateManager: StateManager,
  bossManager: BossManager
): SuccessResponse<{ hierarchy: EmployeeHierarchy[] }> {
  const employees = stateManager.getEmployees()
  const configuredBosses = bossManager.getBosses()

  // 收集所有 boss 名称
  // 1. 配置中的 boss
  // 2. 从员工 hiredBy 中提取的 boss
  const allBossNames = new Set<string>(configuredBosses)
  const employeeNames = new Set(employees.map((e) => e.name))

  employees.forEach((emp) => {
    if (emp.hiredBy) {
      let bossName: string | null = null

      // 情况 1: hiredBy 是 boss employeeId 格式（"0-{bossName}"）
      if (emp.hiredBy.startsWith("0-")) {
        bossName = emp.hiredBy.substring(2)
      }
      // 情况 2: hiredBy 是旧格式（直接是 boss name，不包含 "-"）
      else if (!emp.hiredBy.includes("-")) {
        bossName = emp.hiredBy
      }

      // 只有当这个名字不是普通员工时，才认为是 boss
      if (bossName && !employeeNames.has(bossName)) {
        allBossNames.add(bossName)
      }
    }
  })

  // 递归构建子树，同时支持新旧两种 hiredBy 格式
  const buildTree = (parentEmployeeId: string, parentName: string): EmployeeHierarchy[] => {
    return employees
      .filter((e) => e.hiredBy === parentEmployeeId || e.hiredBy === parentName)
      .map((e) => ({
        name: e.name,
        role: e.role,
        status: e.status,
        children: buildTree(e.employeeId, e.name),
      }))
  }

  const roots: EmployeeHierarchy[] = []

  // 为每个 boss 创建根节点
  for (const bossName of allBossNames) {
    const bossEmployeeId = formatBossId(bossName)
    roots.push({
      name: bossName,
      role: "Boss",
      status: "busy",
      children: buildTree(bossEmployeeId, bossName), // 同时传入 employeeId 和 name
    })
  }

  return {
    success: true,
    data: {
      hierarchy: roots,
    },
  }
}
