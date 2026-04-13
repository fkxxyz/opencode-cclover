/**
 * API Response Types
 *
 * 定义 HTTP API 响应的 TypeScript 类型
 */

export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse
