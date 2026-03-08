// 员工状态类型
export type EmployeeStatus = "busy" | "idle" | "error" | "offline" | "abnormal"

// 员工基本信息
export interface Employee {
  name: string
  role: string
  status: EmployeeStatus
  paused: boolean
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
  reference_docs?: string[]
  fromRole?: string
}

// 对话对象（带最后消息信息）
export interface PeerWithLastMessage {
  name: string
  lastMessageTime?: string
  lastMessageContent?: string
}

// 任务状态类型
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "waiting_for_message"

// 任务
export interface Task {
  name: string
  status: TaskStatus
  description: string
  result?: string
  statusReason?: string
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
  tasks: Task[]
  args: Record<string, any> // Role arguments

  // 角色特定数据
  roleData?: Record<string, any>

  sessionId?: string
  sessionSnapshot?: {
    knowledge: string[]
    tasks: Task[]
    args: Record<string, any>
    timestamp: string
  }
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
  | "task_cancelled"
  | "task_waiting_for_message"
  | "task_deleted"
  | "task_decomposed"
  | "task_available"
  | "task_reminder"
  | "agent_completed"
  | "agent_failed"
  | "timer"
  | "employee_hired"
  | "employee_status_changed"
  | "employee_paused"
  | "employee_resumed"
  | "session_created"
  | "session_prompt_started"
  | "session_prompt_completed"
  | "session_summary_started"
  | "session_summary_completed"
  | "summary_parse_failed"
  | "agent_created"
  | "task_created"
  | "task_modified"
  | "vacation_requested"

// 事件
export interface Event {
  projectId: string
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

// 角色元数据
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

  // 角色记忆模式定义
  memorySchema?: Record<
    string,
    {
      type: string // "string" | "string[]" | "object" | "array" | "number" | "boolean"
      description: string
      required?: boolean
    }
  >
}

// 角色（包含元数据和系统提示词）
export interface Role extends RoleMetadata {
  systemPrompt: string
  source: "preset" | "global" | "project"
}

// Timeline 项类型
export type TimelineItemType = "message" | "event"

// Timeline 项
export interface TimelineItem {
  type: TimelineItemType
  timestamp: string
  data: Message | Event
}
