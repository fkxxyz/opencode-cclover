/**
 * Session Registry
 *
 * 维护 sessionID 到员工名称的映射关系
 * 用于工具调用时识别调用者身份
 */

class SessionRegistry {
  private sessionToEmployee = new Map<string, string>()

  /**
   * 注册 session 和员工的映射关系
   */
  register(sessionId: string, employeeName: string): void {
    this.sessionToEmployee.set(sessionId, employeeName)
  }

  /**
   * 根据 sessionID 获取员工名称
   */
  getEmployeeName(sessionId: string): string | undefined {
    return this.sessionToEmployee.get(sessionId)
  }

  /**
   * 取消注册
   */
  unregister(sessionId: string): void {
    this.sessionToEmployee.delete(sessionId)
  }

  /**
   * 检查 session 是否已注册
   */
  has(sessionId: string): boolean {
    return this.sessionToEmployee.has(sessionId)
  }

  /**
   * 获取所有注册的 session
   */
  getAllSessions(): string[] {
    return Array.from(this.sessionToEmployee.keys())
  }

  /**
   * 清空所有注册
   */
  clear(): void {
    this.sessionToEmployee.clear()
  }
}

export const sessionRegistry = new SessionRegistry()
