// 员工状态类型
export type EmployeeStatus = "active" | "idle" | "error" | "inactive"

// 员工基本信息
export interface Employee {
  name: string
  role: string
  status: EmployeeStatus
  createdAt: string
  lastActiveAt: string
  hiredBy?: string
}

// 员工详细信息
export interface EmployeeDetail extends Employee {
  memory: Memory
  tasks: Task[]
  agents: AgentExecution[]
}

// 员工雇佣关系树
export interface EmployeeHierarchy {
  name: string
  role: string
  status: EmployeeStatus
  children: EmployeeHierarchy[]
}

// 消息方向类型
export type MessageDirection = "send" | "receive"

// 消息
export interface Message {
  timestamp: string
  from: string
  to: string
  content: string
  direction: MessageDirection
}

// 任务状态类型
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled"

// 任务
export interface Task {
  name: string
  status: TaskStatus
  description: string
  result?: string
  dependencies: string[]
  created: string
  completed?: string
}

// 任务响应
export interface TasksResponse {
  tasks: Task[]
  executableTasks: string[]
}

// 记忆
export interface Memory {
  knowledge: string[]
  custom: Record<string, any>
}

// Agent 状态类型
export type AgentStatus = "running" | "completed" | "failed"

// Agent 执行记录
export interface AgentExecution {
  agentId: string
  taskName: string
  status: AgentStatus
  createdAt: string
  completedAt?: string
  result?: string
}

// 事件类型
export type EventType =
  | "message"
  | "task_completed"
  | "task_failed"
  | "agent_completed"
  | "agent_failed"
  | "timer"
  | "employee_hired"
  | "employee_status_changed"

// 事件
export interface Event {
  type: EventType
  timestamp: string
  employeeName?: string
  details: Record<string, any>
}

// API 响应类型
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

// WebSocket 消息
export interface WebSocketMessage {
  type: "event"
  data: Event
}

// 连接状态
export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"
