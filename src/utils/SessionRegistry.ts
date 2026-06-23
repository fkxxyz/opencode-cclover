import type { EmployeeWorkSessionId } from "../types/employee"

/**
 * Session Registry
 *
 * 维护 sessionID 到 EWS ID 的映射关系
 * 用于工具调用时识别调用者身份
 */

class SessionRegistry {
  private sessionToEmployeeWorkSessionId = new Map<
    string,
    EmployeeWorkSessionId
  >()

  /**
   * 注册 session 和 EWS ID 的映射关系
   */
  register(
    sessionId: string,
    employeeWorkSessionId: EmployeeWorkSessionId
  ): void {
    this.sessionToEmployeeWorkSessionId.set(sessionId, employeeWorkSessionId)
  }

  /**
   * 根据 sessionID 获取 EWS ID
   */
  getEmployeeWorkSessionId(
    sessionId: string
  ): EmployeeWorkSessionId | undefined {
    return this.sessionToEmployeeWorkSessionId.get(sessionId)
  }

  /**
   * @deprecated EWS refactor removed employee-level runtime identity.
   */
  getEmployeeId(sessionId: string): EmployeeWorkSessionId | undefined {
    return this.getEmployeeWorkSessionId(sessionId)
  }

  /**
   * 取消注册
   */
  unregister(sessionId: string): void {
    this.sessionToEmployeeWorkSessionId.delete(sessionId)
  }

  /**
   * 检查 session 是否已注册
   */
  has(sessionId: string): boolean {
    return this.sessionToEmployeeWorkSessionId.has(sessionId)
  }

  /**
   * 获取所有注册的 session
   */
  getAllSessions(): string[] {
    return Array.from(this.sessionToEmployeeWorkSessionId.keys())
  }

  /**
   * 清空所有注册
   */
  clear(): void {
    this.sessionToEmployeeWorkSessionId.clear()
  }
}

export const sessionRegistry = new SessionRegistry()
