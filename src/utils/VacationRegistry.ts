/**
 * Vacation Registry
 *
 * 管理员工的假期通知队列
 * 用于通知员工 EventLoop 进入假期状态
 * 参考 AgentRegistry 的实现模式
 */

/**
 * 假期事件
 * 用于通知员工 EventLoop 进入假期状态
 */
export interface VacationEvent {
  type: "vacation_requested"
  employeeId: string
  timestamp: string
}

/**
 * 假期注册表
 * 管理员工的假期通知队列
 */
export class VacationRegistry {
  private vacationQueues = new Map<string, VacationEvent[]>()

  /**
   * 添加假期事件到员工队列
   * @param employeeId 员工 ID
   * @param event 假期事件
   */
  addVacationEvent(employeeId: string, event: VacationEvent): void {
    if (!this.vacationQueues.has(employeeId)) {
      this.vacationQueues.set(employeeId, [])
    }
    this.vacationQueues.get(employeeId)!.push(event)
  }

  /**
   * 检查员工是否有假期事件（不移除）
   * @param employeeId 员工 ID
   * @returns 如果有假期事件返回 true，否则返回 false
   */
  hasVacationEvent(employeeId: string): boolean {
    const queue = this.vacationQueues.get(employeeId)
    return queue !== undefined && queue.length > 0
  }

  /**
   * 获取并移除员工队列中的第一个假期事件（FIFO）
   * @param employeeId 员工 ID
   * @returns 假期事件，如果队列为空则返回 null
   */
  getVacationEvent(employeeId: string): VacationEvent | null {
    const queue = this.vacationQueues.get(employeeId)
    if (!queue || queue.length === 0) {
      return null
    }
    return queue.shift()!
  }

  /**
   * 清空指定员工的假期队列
   * @param employeeId 员工 ID
   */
  clearVacationQueue(employeeId: string): void {
    this.vacationQueues.delete(employeeId)
  }

  /**
   * 清空所有员工的假期队列
   * 用于测试清理
   */
  clear(): void {
    this.vacationQueues.clear()
  }
}

/**
 * 全局假期注册表实例
 */
export const vacationRegistry = new VacationRegistry()
