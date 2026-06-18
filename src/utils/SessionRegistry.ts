import type { EmployeeId } from "../types/employee"

/**
 * Session Registry
 *
 * 维护 sessionID 到员工 ID 的映射关系
 * 用于工具调用时识别调用者身份
 */

class SessionRegistry {
  private sessionToEmployeeId = new Map<string, EmployeeId>()

  /**
   * 注册 session 和员工 ID 的映射关系
   */
  register(sessionId: string, employeeId: EmployeeId): void {
    this.sessionToEmployeeId.set(sessionId, employeeId)
  }

  /**
   * 根据 sessionID 获取员工 ID
   */
  getEmployeeId(sessionId: string): EmployeeId | undefined {
    return this.sessionToEmployeeId.get(sessionId)
  }

  /**
   * 取消注册
   */
  unregister(sessionId: string): void {
    this.sessionToEmployeeId.delete(sessionId)
  }

  /**
   * 检查 session 是否已注册
   */
  has(sessionId: string): boolean {
    return this.sessionToEmployeeId.has(sessionId)
  }

  /**
   * 获取所有注册的 session
   */
  getAllSessions(): string[] {
    return Array.from(this.sessionToEmployeeId.keys())
  }

  /**
   * 清空所有注册
   */
  clear(): void {
    this.sessionToEmployeeId.clear()
  }
}

export const sessionRegistry = new SessionRegistry()
