import { showError } from "./toast"

// 错误类型定义
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = "AppError"
  }
}

// 网络错误
export class NetworkError extends AppError {
  constructor(message: string) {
    super(message, "NETWORK_ERROR", "网络连接失败，请检查网络后重试", true)
  }
}

// API 错误
export class ApiError extends AppError {
  constructor(message: string, code: string) {
    super(message, code, "操作失败，请稍后重试", true)
  }
}

// 验证错误
export class ValidationError extends AppError {
  constructor(message: string, userMessage: string) {
    super(message, "VALIDATION_ERROR", userMessage, false)
  }
}

// 统一错误处理函数
export function handleError(error: unknown, context?: string): AppError {
  let appError: AppError

  if (error instanceof AppError) {
    appError = error
  } else if (error instanceof Error) {
    // 判断错误类型
    if (error.message.includes("fetch") || error.message.includes("network")) {
      appError = new NetworkError(error.message)
    } else {
      appError = new ApiError(error.message, "UNKNOWN_ERROR")
    }
  } else {
    appError = new ApiError("未知错误", "UNKNOWN_ERROR")
  }

  // 显示用户友好的错误消息
  const displayMessage = context
    ? `${context}: ${appError.userMessage}`
    : appError.userMessage

  showError(displayMessage, appError)

  // 记录错误日志（可以发送到服务器）
  logError(appError, context)

  return appError
}

// 错误日志记录
function logError(error: AppError, context?: string) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    code: error.code,
    message: error.message,
    userMessage: error.userMessage,
    context,
    stack: error.stack,
    userAgent: navigator.userAgent,
  }

  // 开发环境打印到控制台
  if (import.meta.env.DEV) {
    console.error("[Error Log]", errorLog)
  }

  // 生产环境可以发送到错误收集服务
  // sendToErrorTracking(errorLog)
}
