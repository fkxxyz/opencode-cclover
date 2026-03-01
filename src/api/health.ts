import type { SuccessResponse } from "../types/index"

/**
 * 健康检查
 */
export function getHealth(): SuccessResponse<{
  status: "ok" | "degraded" | "down"
  timestamp: string
  version: string
}> {
  return {
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    },
  }
}
