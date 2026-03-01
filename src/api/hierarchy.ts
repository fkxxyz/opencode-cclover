import type { StateManager } from "../state/StateManager"
import type {
  Employee,
  EmployeeHierarchy,
  SuccessResponse,
} from "../types/index"

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
