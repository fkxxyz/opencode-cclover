// 导出新的员工相关类型
import type {
  Employee as EmployeeBase,
  EmployeeStatus,
  EmployeeId,
  BossId,
} from "./employee"
import type { RootTaskId, WorkItemId } from "./work"
export type {
  EmployeeId,
  EmployeeName,
  BossId,
  PromptRecovery,
  EmployeeStatus,
} from "./employee"
export type { Employee } from "./employee"
export {
  isValidEmployeeName,
  createEmployeeId,
  formatBossId,
  isBossId,
} from "./employee"
export type {
  RootTaskId,
  WorkItemId,
  WorktreeRef,
  RootTask,
  WorkItem,
  CreateRootTaskInput,
  CreateWorkItemInput,
  UpdateWorkItemInput,
  WorkItemFilters,
} from "./work"
export { createRootTaskId, createWorkItemId } from "./work"

// 员工详细信息
export interface EmployeeDetail extends EmployeeBase {
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
  | "reply_attempted"
  | "task_completed"
  | "task_cancelled"
  | "task_waiting_for_message"
  | "task_deleted"
  | "task_decomposed"
  | "task_available"
  | "task_reminder"
  | "reply_reminder"
  | "agent_completed"
  | "agent_failed"
  | "timer"
  | "employee_hired"
  | "employee_status_changed"
  | "employee_paused"
  | "employee_resumed"
  | "employee_halted"
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
  | "major_task_completed"
  | "survey_sent"
  | "feedback_received"
  | "root_task_created"
  | "root_task_deleted"
  | "work_item_created"
  | "work_item_updated"
  | "work_item_deleted"

// 事件
export interface Event {
  projectId: string
  type: EventType
  timestamp: string
  employeeId?: EmployeeId
  rootTaskId?: RootTaskId
  workItemId?: WorkItemId
  details: Record<string, any>
}

export interface HaltDetails {
  rootTaskId?: RootTaskId
  workItemId?: WorkItemId
  reason?: string
  triggeredBy?: EmployeeId | BossId
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

// 归档和恢复系统类型
export type {
  ArchiveValidation,
  RestoreValidation,
  ArchiveManager,
} from "./archive"
export { ArchiveErrors } from "./archive"
