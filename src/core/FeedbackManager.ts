import * as fs from "node:fs/promises"
import * as path from "node:path"
import { logger } from "../lib/logger"
import type { MessageService } from "./MessageService"
import type { StateManager } from "../state/StateManager"
import type { EmployeeWorkSessionId } from "../types"
import { formatBossId } from "../types"

/**
 * Feedback 管理器
 * 负责自动保存 EWS 对 boss_cclover 的反馈
 */
export class FeedbackManager {
  constructor(
    private workspaceRoot: string,
    private messageService: MessageService,
    private stateManager: StateManager
  ) {
    const ccloverBossId = formatBossId("cclover")
    // 订阅 boss_cclover 消息事件
    messageService.eventEmitter.on(`message:${ccloverBossId}`, async () => {
      await this.handleCcloverMessage()
    })
    logger.info(
      `[FeedbackManager] Initialized and subscribed to message:${ccloverBossId} events`
    )
  }

  /**
   * 处理 boss_cclover 收到的消息
   */
  private async handleCcloverMessage(): Promise<void> {
    try {
      const queue = this.messageService.getUnreadQueue(formatBossId("cclover"))
      if (queue.length > 0) {
        const message = queue.shift()!
        await this.saveFeedback(
          message.from as EmployeeWorkSessionId,
          message.content
        )
        await this.recordEvent(message.from as EmployeeWorkSessionId)
        logger.info(`[FeedbackManager] Saved feedback from ${message.from}`)
      }
    } catch (error: any) {
      logger.error(
        `[FeedbackManager] Failed to handle boss_cclover message: ${error.message}`
      )
    }
  }

  /**
   * 保存反馈到文件
   */
  private async saveFeedback(
    employeeId: EmployeeWorkSessionId,
    content: string
  ): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000)
    const filePath = path.join(
      this.workspaceRoot,
      "ews",
      employeeId,
      `feedback-${timestamp}.md`
    )

    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // 写入反馈内容（仅原始内容，无元数据）
    await fs.writeFile(filePath, content, "utf-8")
  }

  /**
   * 记录 feedback_received 事件
   */
  private async recordEvent(employeeId: EmployeeWorkSessionId): Promise<void> {
    await this.stateManager.addEvent({
      projectId: this.stateManager.getProjectId(),
      type: "feedback_received",
      timestamp: new Date().toISOString(),
      employeeWorkSessionId: employeeId,
      details: { receivedAt: new Date().toISOString() },
    })
  }
}
