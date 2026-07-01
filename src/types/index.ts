// 导出新的员工相关类型
import type { Employee as EmployeeBase, EmployeeId, BossId } from "./employee"
import type { EmployeeWorkSessionId } from "./employee"
export type {
  EmployeeId,
  EmployeeName,
  BossId,
  EmployeeWorkSessionId,
} from "./employee"
export type { Employee } from "./employee"
export {
  isValidEmployeeName,
  createEmployeeId,
  formatBossId,
  isBossId,
} from "./employee"
export type {
  CloseEmployeeWorkSessionInput,
  CreateEmployeeWorkSessionInput,
  EmployeeWorkSession,
  EmployeeWorkSessionFilters,
  EmployeeWorkSessionStatus,
  PromptRecovery,
} from "./employee-work-session"
export { createEmployeeWorkSessionId } from "./employee-work-session"

// 员工详细信息
export interface EmployeeDetail extends EmployeeBase {
  memory: Memory
  tasks: Task[]
}

// 员工雇佣关系树
export interface EmployeeHierarchy {
  employeeId?: string
  name: string
  role: string
  status?: string
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
  urgent?: boolean
  expect_reply?: boolean
}

// 对话对象（带最后消息信息）
export interface PeerWithLastMessage {
  name: string
  lastMessageTime?: string
  lastMessageContent?: string
}

// 消息路由
export type {
  MessageRouter,
  RecipientResolution,
  RecipientResolvedBy,
  RecipientTargetType,
} from "./message-routing"
export { RoutingRules } from "./message-routing"

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
  opencodeSessionId?: string
  sessionSnapshot?: {
    knowledge: string[]
    tasks: Task[]
    args: Record<string, any>
    timestamp: string
  }
}

// 事件类型
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
  | "employee_dismissed"
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

// 事件
export interface Event {
  projectId: string
  type: EventType
  timestamp: string
  employeeWorkSessionId?: EmployeeWorkSessionId
  employeeId?: EmployeeId
  details: Record<string, any>
}

export interface HaltDetails {
  reason?: string
  triggeredBy?: EmployeeWorkSessionId | BossId
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

// 角色相关类型
export type {
  RoleArgType,
  RoleMemoryFieldType,
  RoleRequiredArgSpec,
  RoleMemoryFieldSpec,
  RoleSource,
  RoleMetadata,
  Role,
  ResolvedRoleContext,
  ResolvedRoleContextDocument,
  WorkflowDefinition,
  PhaseDefinition,
  TaskDefinition,
  ActionDefinition,
  SpecificationDefinition,
} from "./role"

// Context registry 相关类型
export type {
  ContextSource,
  RawContextDefinition,
  ContextDefinition,
  ContextRegistry,
} from "./context"

// Timeline 项类型
export type TimelineItemType = "message" | "event"

// Timeline 项
export interface TimelineItem {
  type: TimelineItemType
  timestamp: string
  data: Message | Event
}
