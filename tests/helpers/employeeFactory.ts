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
    status: overrides.status ?? "offline",
    hiredBy: overrides.hiredBy ?? null,
    paused: overrides.paused ?? false,
    activeSessionId: overrides.activeSessionId ?? null,
    createdAt: overrides.createdAt ?? now,
    lastActiveAt: overrides.lastActiveAt ?? now,
    handbookPath: overrides.handbookPath,
    promptRecovery: overrides.promptRecovery,
  }
}
