import type { MessageService } from "../core/MessageService"
import type { Message as ServiceMessage } from "../core/MessageService"
import type {
  Message,
  PeerWithLastMessage,
  SuccessResponse,
  ErrorResponse,
} from "../types/index"

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
        to: msg.from === employeeName ? peer : employeeName,
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

/**
 * 获取员工的对话对象列表（包括所有员工和 boss，按最后聊天时间排序）
 */
export async function getPeers(
  employeeName: string,
  messageService?: MessageService,
  stateManager?: any,
  bossManager?: any
): Promise<SuccessResponse<{ peers: PeerWithLastMessage[] }> | ErrorResponse> {
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

    // 1. 收集所有可能的联系人
    const allPossiblePeers = new Set<string>()

    // 添加有消息记录的对话对象
    const peersWithMessages = await messageService.getPeers(employeeName)
    peersWithMessages.forEach((peer: string) => allPossiblePeers.add(peer))

    // 添加所有员工（排除自己）
    if (stateManager) {
      const employees = stateManager.getEmployees()
      employees.forEach((emp: any) => {
        if (emp.name !== employeeName) {
          allPossiblePeers.add(emp.name)
        }
      })
    }

    // 添加所有 boss（排除自己）
    if (bossManager) {
      const bosses = bossManager.getBosses()
      bosses.forEach((boss: string) => {
        if (boss !== employeeName) {
          allPossiblePeers.add(boss)
        }
      })
    }

    // 2. 获取每个 peer 的最后消息时间
    const client = messageService.getClient(employeeName)
    const peersWithTime: PeerWithLastMessage[] = []

    for (const peer of allPossiblePeers) {
      try {
        // 获取与该 peer 的最后一条消息
        const messages = await client.history(peer, 1)

        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1]
          peersWithTime.push({
            name: peer,
            lastMessageTime: lastMessage.timestamp,
            lastMessageContent: lastMessage.content.substring(0, 50), // 预览前 50 个字符
          })
        } else {
          // 没有消息记录的联系人
          peersWithTime.push({
            name: peer,
            lastMessageTime: undefined,
            lastMessageContent: undefined,
          })
        }
      } catch (error) {
        // 读取失败，视为没有消息
        peersWithTime.push({
          name: peer,
          lastMessageTime: undefined,
          lastMessageContent: undefined,
        })
      }
    }

    // 3. 排序：有消息的按时间降序，没有消息的按名称字母顺序排在最后
    peersWithTime.sort((a, b) => {
      // 如果都有消息，按时间降序
      if (a.lastMessageTime && b.lastMessageTime) {
        return (
          new Date(b.lastMessageTime).getTime() -
          new Date(a.lastMessageTime).getTime()
        )
      }

      // 如果只有 a 有消息，a 排在前面
      if (a.lastMessageTime && !b.lastMessageTime) {
        return -1
      }

      // 如果只有 b 有消息，b 排在前面
      if (!a.lastMessageTime && b.lastMessageTime) {
        return 1
      }

      // 如果都没有消息，按名称字母顺序
      return a.name.localeCompare(b.name)
    })

    return {
      success: true,
      data: {
        peers: peersWithTime,
      },
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: "FILE_READ_ERROR",
        message: `读取对话列表失败: ${error.message}`,
      },
    }
  }
}

/**
 * 发送消息
 */
export async function sendMessage(
  employeeName: string,
  to: string,
  content: string,
  messageService?: MessageService,
  stateManager?: any,
  projectId?: string
): Promise<SuccessResponse<{ message: string }> | ErrorResponse> {
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

    if (!to || to.trim() === "") {
      return {
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "接收者名称不能为空",
        },
      }
    }

    if (!content || content.trim() === "") {
      return {
        success: false,
        error: {
          code: "INVALID_PARAMETER",
          message: "消息内容不能为空",
        },
      }
    }

    // 发送消息
    const client = messageService.getClient(employeeName)
    await client.send(to, content)

    // 广播消息发送事件
    if (stateManager && projectId) {
      const event = {
        projectId,
        type: "message_sent",
        timestamp: new Date().toISOString(),
        employeeName,
        details: {
          from: employeeName,
          to,
          content,
        },
      }
      console.log("[messages.sendMessage] Broadcasting event:", event)
      stateManager.emit("event", event)
    } else {
      console.warn(
        "[messages.sendMessage] Cannot broadcast event - missing stateManager or projectId"
      )
    }

    return {
      success: true,
      data: {
        message: "消息发送成功",
      },
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        code: "MESSAGE_SEND_ERROR",
        message: `发送消息失败: ${error.message}`,
      },
    }
  }
}
