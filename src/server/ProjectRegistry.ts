import type { StateManager } from "../state/StateManager"
import type { MessageService } from "../core/MessageService"
import type { MemoryManager } from "../core/MemoryManager"
import type { AgentRegistry } from "../utils/AgentRegistry"
import { createHash } from "node:crypto"

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
  agentRegistry: AgentRegistry
}

/**
 * Project 注册表
 * 管理所有 project 实例
 */
export class ProjectRegistry {
  private projects: Map<string, ProjectInstance> = new Map()

  /**
   * 注册 project
   */
  register(project: ProjectInstance): void {
    this.projects.set(project.projectId, project)
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
}
