/**
 * 员工 ID 类型
 * 格式: {taskId}-{name}
 * 例如: "1-dev-001", "2-td-001"
 */
export type EmployeeId = string

/**
 * 任务 ID 类型
 * 格式: 数字字符串
 * 例如: "1", "2", "3"
 */
export type TaskId = string

/**
 * Boss ID 类型
 * 格式: 0-{bossName}
 * 例如: "0-mason"
 */
export type BossId = string

/**
 * 收件人解析结果
 */
export interface RecipientResolution {
  targetEmployeeId: EmployeeId | BossId
  isBoss: boolean
  isSameTask: boolean
  isCrossTask: boolean
}

/**
 * 消息路由接口
 */
export interface MessageRouter {
  /**
   * 解析收件人到目标 employeeId 或 BossId
   *
   * @param sender - 发送者的 employeeId (或 BossId 如果是 Boss)
   * @param recipient - 收件人字符串 (短名称或完整 employeeId)
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
   * 检查收件人是否为完整 employeeId (匹配 ^[0-9]+-)
   */
  isFullEmployeeId(recipient: string): boolean {
    return /^[0-9]+-/.test(recipient)
  },

  /**
   * 检查收件人是否为 Boss/非任务标识符 (以 "0-" 开头)
   */
  isBossOrNonTask(recipient: string): boolean {
    return recipient.startsWith("0-")
  },

  /**
   * 从 "0-{name}" 格式提取名称
   */
  extractNameFromBossId(bossId: string): string {
    return bossId.substring(2)
  },

  /**
   * 构建同任务 employeeId
   */
  buildSameTaskEmployeeId(
    senderTaskId: TaskId,
    recipientName: string
  ): EmployeeId {
    return `${senderTaskId}-${recipientName}`
  },
}
