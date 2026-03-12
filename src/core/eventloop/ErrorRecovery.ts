import type { StateManager } from "../../state/StateManager"
import type { EmployeeId } from "../../types"
import { logger } from "../../lib/logger"

/**
 * 错误恢复
 * 负责错误处理、降级模式、错误分类
 */
export class ErrorRecovery {
  private errorCount = 0
  private readonly MAX_CONSECUTIVE_ERRORS = 5
  private backoffDelay = 1000 // 1 秒
  private readonly MAX_BACKOFF = 30000 // 30 秒

  constructor(
    private employeeId: EmployeeId,
    private stateManager?: StateManager
  ) {}

  /**
   * 处理错误
   * 分类错误并决定恢复策略
   * 返回 true 表示应该停止运行，false 表示可以继续
   */
  async handleError(error: any, onStop: () => void): Promise<boolean> {
    // 1. 致命错误：立即退出
    if (this.isFatalError(error)) {
      logger.error(
        `[${this.employeeId}] Fatal error in event loop, exiting:`,
        error
      )
      await this.stateManager?.updateEmployeeStatus(this.employeeId, "error")
      await this.cleanup()
      onStop()
      return true // 停止运行
    }

    // 2. 增加错误计数器
    this.errorCount++

    // 3. 持久性错误或达到熔断阈值
    if (
      this.isPersistentError(error) ||
      this.errorCount >= this.MAX_CONSECUTIVE_ERRORS
    ) {
      logger.error(
        `[${this.employeeId}] Circuit breaker triggered ` +
          `(${this.errorCount}/${this.MAX_CONSECUTIVE_ERRORS} errors)`,
        error
      )

      await this.stateManager?.updateEmployeeStatus(
        this.employeeId,
        "abnormal"
      )

      // 进入降级模式
      await this.enterDegradedMode()

      // 重置计数器
      this.errorCount = 0
      this.backoffDelay = 1000
      return false // 继续运行
    }

    // 4. 瞬态错误：指数退避
    logger.warn(
      `[${this.employeeId}] Transient error ` +
        `(${this.errorCount}/${this.MAX_CONSECUTIVE_ERRORS}), ` +
        `retrying after ${this.backoffDelay}ms`,
      error
    )

    await this.stateManager?.updateEmployeeStatus(this.employeeId, "error")

    // 等待后重试
    await new Promise((resolve) => setTimeout(resolve, this.backoffDelay))

    // 指数退避
    this.backoffDelay = Math.min(this.backoffDelay * 2, this.MAX_BACKOFF)
    return false // 继续运行
  }

  /**
   * 进入降级模式
   */
  async enterDegradedMode(): Promise<void> {
    logger.warn(
      `[${this.employeeId}] Entering degraded mode, ` +
        `waiting 30 seconds before retry`
    )

    // 长时间等待以避免快速重试
    await new Promise((resolve) => setTimeout(resolve, 30000))

    logger.info(
      `[${this.employeeId}] Exiting degraded mode, resuming normal operation`
    )
  }

  /**
   * 判断是否是致命错误
   */
  isFatalError(error: any): boolean {
    // JavaScript 编程错误
    if (
      error instanceof TypeError ||
      error instanceof ReferenceError ||
      error instanceof SyntaxError
    ) {
      return true
    }

    // 检查错误消息
    const message = error.message?.toLowerCase() || ""
    if (
      message.includes("not a function") ||
      message.includes("undefined") ||
      message.includes("null") ||
      message.includes("cannot read property")
    ) {
      return true
    }

    // 系统级错误
    if (
      error.code === "EACCES" // 权限拒绝
    ) {
      return true
    }
    // 注意：ENOENT 不是致命错误，在本代码库中它表示"文件不存在，需要创建"

    return false
  }

  /**
   * 判断是否是持久性错误
   */
  isPersistentError(error: any): boolean {
    // HTTP 状态码
    const status = error.status || error.statusCode
    if (
      status === 401 || // 未授权
      status === 403 || // 禁止访问
      status === 404 || // 未找到
      status === 410 // 已删除
    ) {
      return true
    }

    // 检查错误消息
    const message = error.message?.toLowerCase() || ""
    if (
      message.includes("unauthorized") ||
      message.includes("forbidden") ||
      message.includes("permission denied") ||
      message.includes("invalid configuration") ||
      message.includes("missing required")
    ) {
      return true
    }

    return false
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    logger.info(`[${this.employeeId}] Cleaning up resources`)
    // 清理工作由 EventLoop 协调
  }

  /**
   * 重置错误追踪
   */
  resetErrorTracking(): void {
    this.errorCount = 0
    this.backoffDelay = 1000
  }

  /**
   * 获取当前退避延迟
   */
  getBackoffDelay(): number {
    return this.backoffDelay
  }
}
