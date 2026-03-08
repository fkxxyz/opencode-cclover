/**
 * Agent Registry
 *
 * 维护 agentID 到任务信息的映射关系
 * 用于跟踪由员工创建的 Agent 及其关联任务
 */

import type { InternalAgentEvent } from "../core/eventloop"

export interface AgentInfo {
  employeeName: string // 创建该 Agent 的员工名称
  taskName: string // Agent 关联的任务名称
}

export class AgentRegistry {
  private agents = new Map<string, AgentInfo>()
  private completedQueues = new Map<string, InternalAgentEvent[]>() // 按员工分组的完成队列

  /**
   * 注册 Agent 信息
   */
  register(agentId: string, info: AgentInfo): void {
    this.agents.set(agentId, info)
  }

  /**
   * 获取 Agent 信息
   */
  getInfo(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId)
  }

  /**
   * 检查是否是我们创建的 Agent
   */
  isOurAgent(agentId: string): boolean {
    return this.agents.has(agentId)
  }

  /**
   * 取消注册
   */
  unregister(agentId: string): void {
    this.agents.delete(agentId)
  }

  /**
   * 获取某个员工创建的所有 Agent
   */
  getAgentsByEmployee(employeeName: string): string[] {
    const result: string[] = []
    for (const [agentId, info] of this.agents.entries()) {
      if (info.employeeName === employeeName) {
        result.push(agentId)
      }
    }
    return result
  }

  /**
   * 添加完成事件到队列
   */
  addCompletedEvent(employeeName: string, event: InternalAgentEvent): void {
    if (!this.completedQueues.has(employeeName)) {
      this.completedQueues.set(employeeName, [])
    }
    this.completedQueues.get(employeeName)!.push(event)
  }

  /**
   * 非阻塞取出完成事件
   * 返回 null 表示队列为空
   */
  getCompletedEvent(employeeName: string): InternalAgentEvent | null {
    const queue = this.completedQueues.get(employeeName)
    if (!queue || queue.length === 0) {
      return null
    }
    return queue.shift()!
  }

  /**
   * 清空某个员工的完成队列
   */
  clearCompletedQueue(employeeName: string): void {
    this.completedQueues.delete(employeeName)
  }

  /**
   * 清空所有注册（包括完成队列）
   */
  clear(): void {
    this.agents.clear()
    this.completedQueues.clear()
  }
}

export const agentRegistry = new AgentRegistry()
