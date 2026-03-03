import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as lockfile from "proper-lockfile"
import type { Event, TimelineItem } from "../types/index"

/**
 * 事件日志记录器
 * 负责将事件持久化到 JSONL 文件
 */
export class EventLogger {
  private workspaceRoot: string

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot
  }

  /**
   * 记录事件到员工的 events.jsonl 文件
   */
  async logEvent(employeeName: string, event: Event): Promise<void> {
    const filePath = this.getEventFilePath(employeeName)

    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // 将事件转换为 JSON 字符串（单行）
    const line = JSON.stringify(event) + "\n"

    // 使用文件锁确保并发写入安全
    let release: (() => Promise<void>) | null = null
    try {
      // 如果文件不存在，先创建空文件
      try {
        await fs.access(filePath)
      } catch (error: any) {
        if (error.code === "ENOENT") {
          await fs.writeFile(filePath, "", "utf-8")
        }
      }

      // 获取文件锁
      release = await lockfile.lock(filePath, { retries: 10 })

      // 追加事件到文件
      await fs.appendFile(filePath, line, "utf-8")
    } finally {
      // 释放文件锁
      if (release) {
        await release()
      }
    }
  }

  /**
   * 读取员工的事件历史
   * @param limit 返回最近的 N 条事件，默认 50
   */
  async getEvents(employeeName: string, limit: number = 50): Promise<Event[]> {
    const filePath = this.getEventFilePath(employeeName)

    try {
      const content = await fs.readFile(filePath, "utf-8")
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)

      // 取最后 N 行
      const recentLines = lines.slice(-limit)

      // 解析 JSON
      return recentLines.map((line) => JSON.parse(line))
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []
      }
      throw error
    }
  }

  /**
   * 获取员工的时间线（消息 + 事件混合）
   * @param employeeName 员工名称
   * @param messageService 消息服务（用于获取消息）
   * @param limit 返回最近的 N 条，默认 50
   */
  async getTimeline(
    employeeName: string,
    messageService: any,
    limit: number = 50
  ): Promise<TimelineItem[]> {
    // 获取事件
    const events = await this.getEvents(employeeName, limit * 2)

    // 获取消息（从所有对话对象）
    const peers = await messageService.getPeers(employeeName)
    const allMessages = []
    for (const peer of peers) {
      const messages = await messageService.getMessages(
        employeeName,
        peer,
        limit * 2
      )
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

    // 按时间戳排序
    timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    // 取最后 N 条
    return timeline.slice(-limit)
  }

  /**
   * 获取事件文件路径
   */
  private getEventFilePath(employeeName: string): string {
    return path.join(
      this.workspaceRoot,
      "employees",
      employeeName,
      "events.jsonl"
    )
  }
}
