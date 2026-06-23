import type { BossId, EmployeeId, EmployeeWorkSessionId } from "./employee"

export type EmployeeWorkSessionStatus =
  | "busy"
  | "idle"
  | "error"
  | "offline"
  | "abnormal"
  | "waiting_for_message"
  | "closed"

export interface PromptRecovery {
  version?: number
  sessionId: string
  startedAt: string
  triggerEventType: string
}

export interface EmployeeWorkSession {
  employeeWorkSessionId: EmployeeWorkSessionId
  parentEmployeeWorkSessionId: EmployeeWorkSessionId | null
  employeeId: EmployeeId
  opencodeSessionId: string | null
  description: string
  args: Record<string, any>
  contextPathsSnapshot: string[]
  worktreeRef: string | null
  status: EmployeeWorkSessionStatus
  closedAt: string | null
  closedBy: EmployeeWorkSessionId | BossId | null
  closeReason: string | null
  promptRecovery?: PromptRecovery
  createdAt: string
  updatedAt: string
}

export interface CreateEmployeeWorkSessionInput {
  employeeId: EmployeeId
  description: string
  args: Record<string, any>
  parentEmployeeWorkSessionId?: EmployeeWorkSessionId | null
  worktreeRef?: string | null
  createdBy: EmployeeWorkSessionId | BossId
}

export interface CloseEmployeeWorkSessionInput {
  employeeWorkSessionId: EmployeeWorkSessionId
  closedBy: EmployeeWorkSessionId | BossId
  reason?: string
}

export interface EmployeeWorkSessionFilters {
  employeeId?: EmployeeId
  parentEmployeeWorkSessionId?: EmployeeWorkSessionId | null
  status?: EmployeeWorkSessionStatus
}

export function createEmployeeWorkSessionId(): EmployeeWorkSessionId {
  const randomPart = crypto.randomUUID().replace(/-/g, "")
  return `ews_${randomPart}`
}
