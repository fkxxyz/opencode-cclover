import type { MessageService } from "../core/MessageService"
import type { Message as ServiceMessage } from "../core/MessageService"
import type { Message, SuccessResponse, ErrorResponse } from "../types/index"

/**
 * 获取消息历史
 */
export async function getMessages(
  employeeName: string,
  peer?: string,
  limit?: number,
  messageService?: MessageService
): Promise<SuccessResponse<{ messages: Message[] }> | ErrorResponse> {
  if (!messageService) {
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "消息服务未初始化",
      },
    }
  }

  try {
    // 验证参数
    if (!employeeName || employeeName.trim() === "") {
      return {
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "员工名称不能为空",
        },
      }
    }

    // 设置默认值
    const msgLimit = limit || 50
    if (msgLimit < 1 || msgLimit > 200) {
      return {
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "limit 必须在 1-200 之间",
        },
      }
    }

    let messages: Message[] = []

    if (peer) {
      // 获取与特定对象的消息
      const client = messageService.getClient(employeeName)
      const serviceMessages = await client.history(peer, msgLimit)
      // 转换消息格式
      messages = serviceMessages.map((msg: ServiceMessage) => ({
        timestamp: msg.timestamp,
        from: msg.from,
        to: peer,
        content: msg.content,
        direction: msg.from === employeeName ? "send" : "receive",
      }))
    } else {
      // 获取所有消息（遍历所有对话）
      const peers = await messageService.getPeers(employeeName)
      const client = messageService.getClient(employeeName)

      // 收集所有对话的消息
      const allMessages: Message[] = []
      for (const peer of peers) {
        const serviceMessages = await client.history(peer)
        const peerMessages = serviceMessages.map((msg: ServiceMessage) => ({
          timestamp: msg.timestamp,
          from: msg.from,
          to: msg.from === employeeName ? peer : employeeName,
          content: msg.content,
          direction:
            msg.from === employeeName
              ? ("send" as const)
              : ("receive" as const),
        }))
        allMessages.push(...peerMessages)
      }

      // 按时间戳排序
      allMessages.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )

      // 限制数量（返回最近的 N 条）
      messages = msgLimit ? allMessages.slice(-msgLimit) : allMessages
    }

    return {
      success: true,
      data: {
        messages,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: "FILE_READ_ERROR",
        message: `读取消息失败: ${error.message}`,
      },
    }
  }
}
