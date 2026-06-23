import type { BossId, EmployeeWorkSessionId } from "./employee"

/**
 * 收件人目标类型
 */
export type RecipientTargetType = "employee-work-session" | "boss"

/**
 * 收件人解析方式
 */
export type RecipientResolvedBy = "employee_work_session_id" | "boss_id"

/**
 * 收件人解析结果
 */
export interface RecipientResolution {
  targetId: EmployeeWorkSessionId | BossId
  targetType: RecipientTargetType
  resolvedBy: RecipientResolvedBy
}

/**
 * 消息路由接口
 */
export interface MessageRouter {
  /**
   * 解析收件人到稳定 EWS 或 Boss 目标。
   *
   * @param sender - 发送者的 EWS ID 或 BossId
   * @param recipient - 收件人字符串
   * @returns 解析结果
   */
  resolveRecipient(
    sender: EmployeeWorkSessionId | BossId,
    recipient: string
  ): RecipientResolution
}

/**
 * 路由规则
 */
export const RoutingRules = {
  /**
   * 检查值是否为稳定 EWS ID。
   */
  isEmployeeWorkSessionId(value: string): boolean {
    return value.startsWith("ews_")
  },

  /**
   * 检查值是否为员工元数据 ID。
   */
  isEmployeeId(value: string): boolean {
    return value.startsWith("emp_")
  },

  /**
   * 检查值是否为 Boss ID。
   */
  isBossId(value: string): boolean {
    return value.startsWith("boss_")
  },

  /**
   * 从 "boss_{name}" 格式提取名称。
   */
  extractNameFromBossId(bossId: BossId): string {
    return bossId.substring("boss_".length)
  },
}
