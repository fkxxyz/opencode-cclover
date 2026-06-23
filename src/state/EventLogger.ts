import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as lockfile from "proper-lockfile"
import type {
  BossId,
  EmployeeId,
  EmployeeWorkSessionId,
  Event,
  TimelineItem,
} from "../types/index"

export type EventLogOwnerId = EmployeeId | EmployeeWorkSessionId | BossId

/**
 * 事件日志记录器
 * 负责将事件持久化到 JSONL 文件
 * 使用员工元数据 ID 或 EWS 运行时 ID 作为文件路径
 */
export class EventLogger {
  private workspaceRoot: string

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
  }

  /**
   * 记录事件到所有者的 events.jsonl 文件
   */
  async logEvent(ownerId: EventLogOwnerId, event: Event): Promise<void> {
    const filePath = this.getEventFilePath(ownerId)

    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // 将事件转换为 JSON 字符串（单行）
    const line = JSON.stringify(event) + "\n"

    // 使用文件锁确保并发写入安全
    let release: (() => Promise<void>) | null = null
    try {
      // 如果文件不存在，先创建空文件
      try {
        await fs.stat(filePath)
      } catch (error: any) {
        if (error.code === "ENOENT") {
          try {
            await fs.writeFile(filePath, "", "utf-8")
          } catch (writeError: any) {
            // 如果写入失败（可能目录被删除），忽略错误
            if (writeError.code === "ENOENT") {
              return
            }
            throw writeError
          }
        } else {
          throw error
        }
      }

      // 获取文件锁
      try {
        release = await lockfile.lock(filePath, { retries: 10 })
      } catch (lockError: any) {
        // 如果文件不存在（可能在测试清理时被删除），忽略错误
        if (lockError.code === "ENOENT") {
          return
        }
        throw lockError
      }

      // 追加事件到文件
      await fs.appendFile(filePath, line, "utf-8")
    } catch (error: any) {
      // 如果是文件不存在错误（测试清理时），忽略
      if (error.code === "ENOENT") {
        return
      }
      throw error
    } finally {
      // 释放文件锁
      if (release) {
        try {
          await release()
        } catch (releaseError: any) {
          // 忽略释放锁时的错误（文件可能已被删除）
          if (releaseError.code !== "ENOENT") {
            console.warn(
              `[EventLogger] Failed to release lock for ${filePath}:`,
              releaseError.message
            )
          }
        }
      }
    }
  }

  /**
   * 读取员工的事件历史
   * @param limit 返回最近的 N 条事件，默认 50
   * @param before 游标时间戳，返回此时间之前的事件
   */
  async getEvents(
    employeeId: string,
    limit: number = 50,
    before?: string
  ): Promise<Event[]> {
    const filePath = this.getEventFilePath(
      this.normalizeEventLogOwnerId(employeeId)
    )

    try {
      const content = await fs.readFile(filePath, "utf-8")
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)

      // 解析 JSON
      const events = lines.map((line) => JSON.parse(line))

      // 如果提供了游标，过滤出游标之前的事件
      const filtered = before
        ? events.filter((event) => event.timestamp < before)
        : events

      // 取最后 N 行
      return filtered.slice(-limit)
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []
      }
      throw error
    }
  }

  /**
   * 获取员工的时间线（消息 + 事件混合）
   * @param employeeId 员工ID
   * @param messageService 消息服务（用于获取消息）
   * @param limit 返回最近的 N 条，默认 50
   * @param before 游标时间戳，返回此时间之前的消息
   */
  async getTimeline(
    employeeId: string,
    messageService: any,
    limit: number = 50,
    before?: string
  ): Promise<TimelineItem[]> {
    // 加载 limit * 2 以确保合并后有足够的项
    // (因为消息和事件是分开加载的，需要一些缓冲)
    const loadLimit = limit * 2

    // 获取事件
    const events = await this.getEvents(employeeId, loadLimit, before)

    // 获取消息（从所有对话对象）
    const peers = await messageService.getPeers(employeeId)
    const allMessages = []

    // 创建 MessageClient 来获取历史消息
    const client = messageService.getClient(employeeId)

    for (const peer of peers) {
      const messages = await client.history(peer, loadLimit, before)
      allMessages.push(...messages)
    }

    // 合并消息和事件
    const timeline: TimelineItem[] = [
      ...allMessages.map((msg) => ({
        type: "message" as const,
        timestamp: msg.timestamp,
        data: msg,
      })),
      ...events.map((evt) => ({
        type: "event" as const,
        timestamp: evt.timestamp,
        data: evt,
      })),
    ]

    // 按时间戳排序（升序）
    timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    // 返回最后 N 条（最近的）
    return timeline.slice(-limit)
  }

  /**
   * 获取事件文件路径
   */
  private getEventFilePath(employeeId: EventLogOwnerId): string {
    if (employeeId.startsWith("ews_")) {
      return path.join(this.workspaceRoot, "ews", employeeId, "events.jsonl")
    }

    if (employeeId.startsWith("boss_")) {
      return path.join(this.workspaceRoot, "bosses", employeeId, "events.jsonl")
    }

    return path.join(
      this.workspaceRoot,
      "employees",
      employeeId,
      "events.jsonl"
    )
  }

  private normalizeEventLogOwnerId(ownerId: string): EventLogOwnerId {
    if (
      ownerId.startsWith("emp_") ||
      ownerId.startsWith("ews_") ||
      ownerId.startsWith("boss_")
    ) {
      return ownerId as EventLogOwnerId
    }

    return `emp_${ownerId}`
  }
}
