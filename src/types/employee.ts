/**
 * Employee status type
 */
export type EmployeeStatus =
  | "busy"
  | "idle"
  | "error"
  | "offline"
  | "abnormal"
  | "waiting_for_message"

export type EmployeeId = string

export type EmployeeName = string

export type BossId = string

export interface PromptRecovery {
  version?: number
  sessionId: string
  startedAt: string
  triggerEventType: string
}

/**
 * 员工是角色的稳定实例，身份不再编码任务归属。
 */
export interface Employee {
  employeeId: EmployeeId
  name: EmployeeName
  roleId: string
  handbookPath?: string
  hiredBy: EmployeeId | BossId | null
  status: EmployeeStatus
  paused: boolean
  createdAt: string
  lastActiveAt: string
  activeSessionId: string | null
  promptRecovery?: PromptRecovery
}

/**
 * Validation functions
 */
export function isValidEmployeeName(name: string): boolean {
  return !/^[0-9]+-/.test(name)
}

export function createEmployeeId(): EmployeeId {
  const randomPart = crypto.randomUUID().replace(/-/g, "")
  return `emp_${randomPart}`
}

export function formatBossId(bossName: string): BossId {
  return `0-${bossName}`
}

export function isBossId(id: string): boolean {
  return id.startsWith("0-")
}
