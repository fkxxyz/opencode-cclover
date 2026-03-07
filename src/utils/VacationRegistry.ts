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
  employeeName: string
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
   * @param employeeName 员工名称
   * @param event 假期事件
   */
  addVacationEvent(employeeName: string, event: VacationEvent): void {
    if (!this.vacationQueues.has(employeeName)) {
      this.vacationQueues.set(employeeName, [])
    }
    this.vacationQueues.get(employeeName)!.push(event)
  }

  /**
   * 获取并移除员工队列中的第一个假期事件（FIFO）
   * @param employeeName 员工名称
   * @returns 假期事件，如果队列为空则返回 null
   */
  getVacationEvent(employeeName: string): VacationEvent | null {
    const queue = this.vacationQueues.get(employeeName)
    if (!queue || queue.length === 0) {
      return null
    }
    return queue.shift()!
  }

  /**
   * 清空指定员工的假期队列
   * @param employeeName 员工名称
   */
  clearVacationQueue(employeeName: string): void {
    this.vacationQueues.delete(employeeName)
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
