import type { Event, EventType } from "../types/index"

/**
 * 全局事件历史
 * 存储和查询所有系统事件
 */
export class EventHistory {
  private events: Event[]
  private readonly maxEvents = 1000

  constructor() {
    this.events = []
  }

  /**
   * 添加事件
   */
  add(event: Event): void {
    this.events.unshift(event)

    // 保持最多 1000 条事件
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents)
    }
  }

  /**
   * 获取最近的事件
   */
  getRecent(limit: number): Event[] {
    return this.events.slice(0, limit)
  }

  /**
   * 按员工筛选事件
   */
  getByEmployee(employeeName: string, limit?: number): Event[] {
    const filtered = this.events.filter((e) => e.employeeName === employeeName)
    return limit ? filtered.slice(0, limit) : filtered
  }

  /**
   * 按类型筛选事件
   */
  getByType(type: EventType, limit?: number): Event[] {
    const filtered = this.events.filter((e) => e.type === type)
    return limit ? filtered.slice(0, limit) : filtered
  }

  /**
   * 获取所有事件
   */
  getAll(): Event[] {
    return [...this.events]
  }

  /**
   * 清空所有事件
   */
  clear(): void {
    this.events = []
  }

  /**
   * 获取事件总数
   */
  count(): number {
    return this.events.length
  }
}
