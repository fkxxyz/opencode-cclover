/**
 * TaskId type - incremental counter starting from 1
 * 0 is reserved for non-task employees
 */
export type TaskId = number

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

/**
 * EmployeeId format: "{taskId}-{name}" or "0-{name}"
 * Examples: "1-td-001", "2-dev-001", "0-mason"
 */
export type EmployeeId = string

/**
 * Employee name - cannot start with pattern "digit-hyphen"
 * Valid: "mason", "task-designer", "dev-001"
 * Invalid: "1-mason", "0-worker", "123-dev"
 */
export type EmployeeName = string

/**
 * Employee interface (replaces current Employee type)
 */
export interface Employee {
  // New fields for employeeId system
  employeeId: EmployeeId
  name: EmployeeName
  taskId: TaskId

  // Existing fields (keep)
  role: string
  hiredBy: EmployeeId | null // Updated to use employeeId, null for Boss-hired employees
  status: EmployeeStatus
  paused: boolean // Keep for vacation mechanism
  createdAt: string
  lastActiveAt: string // Keep for monitoring
  activeSessionId: string | null // Keep for session management
  promptRecovery?: {
    version?: number
    sessionId: string
    startedAt: string
    triggerEventType: string
  }
}

/**
 * Project state interface
 */
export interface ProjectState {
  nextTaskId: TaskId // Starts from 1
}

/**
 * Boss identifier for messaging
 * Format: "0-{bossName}" (used in to/from parameters only)
 */
export type BossId = string

/**
 * Validation functions
 */
export function isValidEmployeeName(name: string): boolean {
  return !/^[0-9]+-/.test(name)
}

export function parseEmployeeId(employeeId: EmployeeId): {
  taskId: TaskId
  name: EmployeeName
} {
  const match = employeeId.match(/^([0-9]+)-(.+)$/)
  if (!match) {
    throw new Error(`Invalid employeeId format: ${employeeId}`)
  }
  return {
    taskId: parseInt(match[1], 10),
    name: match[2],
  }
}

export function formatEmployeeId(
  taskId: TaskId,
  name: EmployeeName
): EmployeeId {
  return `${taskId}-${name}`
}

export function formatBossId(bossName: string): BossId {
  return `0-${bossName}`
}

export function isBossId(id: string): boolean {
  return id.startsWith("0-")
}
