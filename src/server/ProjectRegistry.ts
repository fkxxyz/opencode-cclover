import type { StateManager } from "../state/StateManager"
import type { MessageService } from "../core/MessageService"
import type { MemoryManager } from "../core/MemoryManager"
import type { AgentRegistry } from "../utils/AgentRegistry"
import type { BossManager } from "../core/BossManager"
import type { RoleManager } from "../core/RoleManager"
import type { EventLoop } from "../core/eventloop"
import type { MeetingModePromptInjector } from "../meeting-mode/PromptInjector"
import type { ModelConfigManager } from "../config/ModelConfigManager"
import type { FeedbackManager } from "../core/FeedbackManager"
import type { RootTaskManager } from "../core/RootTaskManager"
import type { WorkItemManager } from "../core/WorkItemManager"
import { createHash } from "node:crypto"
import EventEmitter from "eventemitter3"

/**
 * Project 实例
 */
export interface ProjectInstance {
  projectId: string // 唯一标识(使用path的hash)
  projectName: string // 项目名称
  directory: string // 项目路径
  workspaceRoot: string // .cclover/workspace路径
  stateManager: StateManager
  messageService: MessageService
  memoryManager: MemoryManager
  rootTaskManager: RootTaskManager
  workItemManager: WorkItemManager
  agentRegistry: AgentRegistry
  bossManager: BossManager
  roleManager: RoleManager
  modelConfigManager: ModelConfigManager
  meetingModePromptInjector: MeetingModePromptInjector
  feedbackManager: FeedbackManager
  eventLoopStarted: boolean // EventLoop 是否已启动
  /**
   * EventLoop 启动中的一次性锁（用于防止并发/重复启动）
   * - null: 当前没有启动任务
   * - Promise: 启动进行中（后续调用应复用并 await）
   */
  eventLoopStarting: Promise<void> | null
  eventLoops: Map<string, EventLoop> // employeeId -> EventLoop 实例
}

/**
 * Project 注册表
 * 管理所有 project 实例
 */
export class ProjectRegistry {
  private projects: Map<string, ProjectInstance> = new Map()
  private emitter: EventEmitter = new EventEmitter()

  /**
   * 注册 project
   */
  register(project: ProjectInstance): void {
    this.projects.set(project.projectId, project)
    this.emitter.emit("project:registered", project)
  }

  /**
   * 注销 project
   */
  unregister(projectId: string): void {
    this.projects.delete(projectId)
  }

  /**
   * 获取 project
   */
  get(projectId: string): ProjectInstance | undefined {
    return this.projects.get(projectId)
  }

  /**
   * 通过路径获取 project
   */
  getByPath(directory: string): ProjectInstance | undefined {
    const projectId = this.hashPath(directory)
    return this.projects.get(projectId)
  }

  /**
   * 获取所有 project
   */
  getAll(): ProjectInstance[] {
    return Array.from(this.projects.values())
  }

  /**
   * 计算路径的 hash 作为 projectId
   */
  private hashPath(directory: string): string {
    return createHash("sha256").update(directory).digest("hex").substring(0, 16)
  }

  /**
   * 生成 projectId (公开方法，供外部使用)
   */
  static hashPath(directory: string): string {
    return createHash("sha256").update(directory).digest("hex").substring(0, 16)
  }

  /**
   * 监听事件
   */
  on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener)
  }

  /**
   * 取消监听事件
   */
  off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener)
  }
}
