// Project types
export interface Project {
  projectId: string
  projectName: string
  directory: string
}

export interface CandidateProject {
  path: string
  firstSeenAt: string
  lastSeenAt: string
  seenCount: number
}

export interface PromptRecovery {
  version?: number
  sessionId: string
  startedAt: string
  triggerEventType: string
}

export interface Employee {
  employeeId: string
  name: string
  roleId: string
  description: string
  contextPaths: string[]
  hiredBy: string | null
  createdAt: string
  updatedAt: string
}

export interface BossInfo {
  name: string
  id: string
  type: "configured" | "meeting-mode"
}

export interface EmployeeDetail extends Employee {
  memory: Memory
  tasks: Task[]
}

export interface EmployeeHierarchy {
  employeeId?: string
  name: string
  role: string
  status?: string
  children: EmployeeHierarchy[]
}

// Message types
export type MessageDirection = "send" | "receive"

export interface Message {
  timestamp: string
  from: string
  to: string
  content: string
  direction: MessageDirection
}

// 对话对象（带最后消息信息）
export interface PeerWithLastMessage {
  name: string
  lastMessageTime?: string
  lastMessageContent?: string
}

// Task types
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "waiting_for_message"

export interface Task {
  name: string
  status: TaskStatus
  description: string
  result?: string
  dependencies: string[]
  created: string
  completed?: string
}

export interface TasksResponse {
  tasks: Task[]
  executableTasks: string[]
}

// Memory types
export interface Memory {
  knowledge: string[]
  tasks: Task[]
  custom: Record<string, unknown> // Keep for backward compatibility
  args: Record<string, unknown> // New field for role arguments
  sessionId?: string
  sessionSnapshot?: {
    knowledge: string[]
    tasks: Task[]
    custom: Record<string, unknown>
    args: Record<string, unknown>
    timestamp: string
  }
}

// Event types
export type EventType =
  | "message"
  | "reply_attempted"
  | "task_completed"
  | "task_cancelled"
  | "task_waiting_for_message"
  | "task_deleted"
  | "task_decomposed"
  | "task_available"
  | "task_reminder"
  | "reply_reminder"
  | "timer"
  | "employee_hired"
  | "employee_updated"
  | "employee_work_session_created"
  | "employee_work_session_status_changed"
  | "employee_work_session_closed"
  | "session_created"
  | "session_prompt_started"
  | "session_prompt_completed"
  | "session_summary_started"
  | "session_summary_completed"
  | "summary_parse_failed"
  | "task_created"
  | "task_modified"
  | "feedback_received"
  | "*" // Wildcard for subscribing to all events

export interface Event {
  projectId: string
  type: EventType
  timestamp: string
  employeeWorkSessionId?: string
  employeeId?: string
  details: Record<string, unknown>
}

// API response types
export interface SuccessResponse<T> {
  success: true
  data: T
}

export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
  }
}

// WebSocket types
export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"

export interface WebSocketMessage {
  type: "event"
  data: Event
}

// Timeline types
export type TimelineItemType = "message" | "event"

export interface TimelineItem {
  type: TimelineItemType
  timestamp: string
  data: Message | Event
}

// Role types
export interface RoleMetadata {
  name: string
  description: string
  requiredArgs?: Record<
    string,
    {
      type: string
      description: string
    }
  >
  canHire?: string[]
  groups?: string[]
}

export interface Role extends RoleMetadata {
  systemPrompt: string
  source: "preset" | "global" | "project"
}

// Settings types
export type { ThemeMode, Settings } from "./settings"
export { DEFAULT_SETTINGS } from "./settings"
