import * as fs from "node:fs/promises"
import * as path from "node:path"
import { logger } from "../lib/logger"
import type { MessageService } from "./MessageService"
import type { StateManager } from "../state/StateManager"

/**
 * Feedback 管理器
 * 负责自动保存员工对 0-cclover 的反馈
 */
export class FeedbackManager {
  constructor(
    private workspaceRoot: string,
    private messageService: MessageService,
    private stateManager: StateManager
  ) {
    // 订阅 0-cclover 消息事件
    messageService.eventEmitter.on("message:0-cclover", async () => {
      await this.handleCcloverMessage()
    })
    logger.info(
      "[FeedbackManager] Initialized and subscribed to message:0-cclover events"
    )
  }

  /**
   * 处理 0-cclover 收到的消息
   */
  private async handleCcloverMessage(): Promise<void> {
    try {
      const queue = this.messageService.getUnreadQueue("0-cclover")
      if (queue.length > 0) {
        const message = queue.shift()!
        await this.saveFeedback(message.from, message.content)
        await this.recordEvent(message.from)
        logger.info(`[FeedbackManager] Saved feedback from ${message.from}`)
      }
    } catch (error: any) {
      logger.error(
        `[FeedbackManager] Failed to handle 0-cclover message: ${error.message}`
      )
    }
  }

  /**
   * 保存反馈到文件
   */
  private async saveFeedback(
    employeeName: string,
    content: string
  ): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000)
    const filePath = path.join(
      this.workspaceRoot,
      "employees",
      employeeName,
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
  private async recordEvent(employeeName: string): Promise<void> {
    await this.stateManager.addEvent({
      projectId: this.stateManager.getProjectId(),
      type: "feedback_received",
      timestamp: new Date().toISOString(),
      employeeId: employeeName,
      details: { receivedAt: new Date().toISOString() },
    })
  }
}
