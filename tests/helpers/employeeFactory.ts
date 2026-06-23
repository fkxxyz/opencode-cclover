import type { Employee } from "../../src/types"

export function createTestEmployee(
  overrides: Partial<Employee> = {}
): Employee {
  const now = new Date().toISOString()
  const name = overrides.name ?? "test-employee"

  return {
    employeeId:
      overrides.employeeId ?? `emp_${name.replace(/[^a-zA-Z0-9_]/g, "_")}`,
    name,
    roleId: overrides.roleId ?? "test",
    description: overrides.description ?? `${name} test employee`,
    contextPaths: overrides.contextPaths ?? [],
    hiredBy: overrides.hiredBy ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}
