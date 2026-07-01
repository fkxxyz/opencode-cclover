export type EmployeeId = `emp_${string}`

export type EmployeeName = string

export type BossId = `boss_${string}`

export type EmployeeWorkSessionId = `ews_${string}`

/**
 * 员工是角色的稳定实例，身份不再编码任务归属。
 */
export interface Employee {
  employeeId: EmployeeId
  name: EmployeeName
  roleId: string
  description: string
  contextPaths: string[]
  hiredBy: EmployeeWorkSessionId | BossId | null
  dismissedAt?: string | null
  dismissedBy?: EmployeeWorkSessionId | BossId | null
  dismissReason?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Validation functions
 */
export function isValidEmployeeName(name: string): boolean {
  return name.trim().length > 0
}

export function createEmployeeId(): EmployeeId {
  const randomPart = crypto.randomUUID().replace(/-/g, "")
  return `emp_${randomPart}`
}

export function formatBossId(bossName: string): BossId {
  return `boss_${bossName}`
}

export function isBossId(id: string): boolean {
  return id.startsWith("boss_")
}
