/**
 * EventLoop 模块
 *
 * 将 EventLoop 拆分为多个专注的模块：
 * - EventLoop: 核心事件循环和协调
 * - SessionManager: Session 生命周期管理
 * - SummaryService: 总结请求和保存
 * - ErrorRecovery: 错误处理和恢复
 * - ProgressTracker: 进展追踪和异常检测
 */

// EventLoop 使用的最小角色上下文
export interface Role {
  name: string
  systemPrompt: string
}

export { EventLoop } from "./EventLoop"
export type {
  InternalAgentEvent,
  InternalPromptRecoveryEvent,
} from "./EventLoop"
export { SessionManager } from "./SessionManager"
export type { SessionInfo } from "./SessionManager"
export { SummaryService } from "./SummaryService"
export { ErrorRecovery } from "./ErrorRecovery"
export { ProgressTracker } from "./ProgressTracker"
export type { ProgressSnapshot } from "./ProgressTracker"
