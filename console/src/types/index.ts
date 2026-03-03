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

// Employee types
export type EmployeeStatus = "active" | "idle" | "error" | "inactive"

export interface Employee {
  name: string
  role: string
  status: EmployeeStatus
  createdAt: string
  lastActiveAt: string
  hiredBy?: string
}

export interface EmployeeDetail extends Employee {
  memory: Memory
  tasks: Task[]
  agents: AgentExecution[]
}

export interface EmployeeHierarchy {
  name: string
  role: string
  status: EmployeeStatus
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
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled"

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
  custom: Record<string, unknown>
}

// Agent execution types
export type AgentStatus = "running" | "completed" | "failed"

export interface AgentExecution {
  agentId: string
  taskName: string
  status: AgentStatus
  createdAt: string
  completedAt?: string
  result?: string
}

// Event types
export type EventType =
  | "message"
  | "task_completed"
  | "task_failed"
  | "agent_completed"
  | "agent_failed"
  | "timer"
  | "employee_hired"
  | "employee_status_changed"
  | "message_sent"
  | "message_received"
  | "task_updated"
  | "agent_updated"
  | "*" // Wildcard for subscribing to all events

export interface Event {
  projectId: string
  type: EventType
  timestamp: string
  employeeName?: string
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
