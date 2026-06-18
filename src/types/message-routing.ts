import type { BossId, EmployeeId } from "./employee"

/**
 * 收件人目标类型
 */
export type RecipientTargetType = "employee" | "boss" | "meeting-role"

/**
 * 收件人解析方式
 */
export type RecipientResolvedBy =
  | "employee_id"
  | "unique_name"
  | "boss_id"
  | "meeting_role"

/**
 * 收件人解析结果
 */
export interface RecipientResolution {
  targetId: EmployeeId | BossId
  targetType: RecipientTargetType
  resolvedBy: RecipientResolvedBy
}

/**
 * 消息路由接口
 */
export interface MessageRouter {
  /**
   * 解析收件人到稳定员工、Boss 或会议角色目标。
   *
   * @param sender - 发送者的 employeeId 或 BossId
   * @param recipient - 收件人字符串
   * @returns 解析结果
   */
  resolveRecipient(
    sender: EmployeeId | BossId,
    recipient: string
  ): RecipientResolution
}

/**
 * 路由规则
 */
export const RoutingRules = {
  /**
   * 检查值是否为新的稳定员工 ID，不从 ID 中推断任务归属。
   */
  isEmployeeId(value: string): boolean {
    return value.startsWith("emp_")
  },

  /**
   * 检查值是否为 Boss ID。MVP 保留现有 0-{name} 消息标识格式。
   */
  isBossId(value: string): boolean {
    return value.startsWith("0-")
  },

  /**
   * 从 "0-{name}" 格式提取名称。
   */
  extractNameFromBossId(bossId: BossId): string {
    return bossId.substring(2)
  },
}
