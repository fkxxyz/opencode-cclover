/**
 * Halt Registry
 *
 * 管理员工的急停通知队列
 */

export interface HaltEvent {
  type: "halt_requested"
  employeeId: string
  taskId: number
  reason?: string
  timestamp: string
  triggeredBy?: string
}

export class HaltRegistry {
  private haltQueues = new Map<string, HaltEvent[]>()

  addHaltEvent(employeeId: string, event: HaltEvent): void {
    if (!this.haltQueues.has(employeeId)) {
      this.haltQueues.set(employeeId, [])
    }
    this.haltQueues.get(employeeId)!.push(event)
  }

  hasHaltEvent(employeeId: string): boolean {
    const queue = this.haltQueues.get(employeeId)
    return queue !== undefined && queue.length > 0
  }

  getHaltEvent(employeeId: string): HaltEvent | null {
    const queue = this.haltQueues.get(employeeId)
    if (!queue || queue.length === 0) {
      return null
    }
    return queue.shift()!
  }

  clearHaltQueue(employeeId: string): void {
    this.haltQueues.delete(employeeId)
  }

  clear(): void {
    this.haltQueues.clear()
  }
}

export const haltRegistry = new HaltRegistry()
