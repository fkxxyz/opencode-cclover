/**
 * Halt Registry
 *
 * 管理员工的急停通知队列
 */

export interface HaltEvent {
  type: "halt_requested"
  employeeWorkSessionId: string
  reason?: string
  timestamp: string
  triggeredBy?: string
}

export class HaltRegistry {
  private haltQueues = new Map<string, HaltEvent[]>()

  addHaltEvent(employeeWorkSessionId: string, event: HaltEvent): void {
    if (!this.haltQueues.has(employeeWorkSessionId)) {
      this.haltQueues.set(employeeWorkSessionId, [])
    }
    this.haltQueues.get(employeeWorkSessionId)!.push(event)
  }

  hasHaltEvent(employeeWorkSessionId: string): boolean {
    const queue = this.haltQueues.get(employeeWorkSessionId)
    return queue !== undefined && queue.length > 0
  }

  getHaltEvent(employeeWorkSessionId: string): HaltEvent | null {
    const queue = this.haltQueues.get(employeeWorkSessionId)
    if (!queue || queue.length === 0) {
      return null
    }
    return queue.shift()!
  }

  clearHaltQueue(employeeWorkSessionId: string): void {
    this.haltQueues.delete(employeeWorkSessionId)
  }

  clear(): void {
    this.haltQueues.clear()
  }
}

export const haltRegistry = new HaltRegistry()
