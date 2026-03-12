import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import * as lockfile from "proper-lockfile"
import { ConfigManager } from "../config/ConfigManager"
import type { CcloverConfig } from "../config/ConfigManager"
import { logger } from "../lib/logger"
import type { BossId, EmployeeId } from "../types/index"
import { formatBossId, isBossId } from "../types/index"

/**
 * Boss 管理器
 * 负责管理全局 boss 列表和 Boss 身份识别
 */
export class BossManager {
  private bosses: Set<string> = new Set()
  private workspaceRoot?: string

  constructor(config?: CcloverConfig, workspaceRoot?: string) {
    this.workspaceRoot = workspaceRoot
    if (config) {
      this.loadFromConfig(config)
    }
  }

  /**
   * 从配置加载 boss 列表
   */
  private loadFromConfig(config: CcloverConfig): void {
    this.bosses.clear()
    if (config.bosses) {
      for (const boss of config.bosses) {
        this.bosses.add(boss)
      }
      logger.info(`Loaded ${this.bosses.size} bosses from config`)
    }
  }

  /**
   * 检查是否是 boss
   */
  isBoss(name: string): boolean {
    return this.bosses.has(name)
  }

  /**
   * 从 BossId 获取 Boss 名称
   * @param bossId Boss ID (格式: "0-{bossName}")
   * @returns Boss 名称，如果不是有效的 BossId 则返回 null
   */
  getBossName(bossId: BossId): string | null {
    if (!isBossId(bossId)) {
      return null
    }
    const name = bossId.substring(2) // Remove "0-" prefix
    return this.bosses.has(name) ? name : null
  }

  /**
   * 获取所有 boss 名称
   */
  getBosses(): string[] {
    return Array.from(this.bosses)
  }

  /**
   * 重新加载配置
   */
  async reload(): Promise<void> {
    const config = await ConfigManager.load()
    this.loadFromConfig(config)
  }

  /**
   * 添加 boss
   */
  addBoss(name: string): void {
    this.bosses.add(name)
  }

  /**
   * 移除 boss
   */
  removeBoss(name: string): void {
    this.bosses.delete(name)
  }

  /**
   * 记录 boss 与员工的 session 映射
   * @param bossName Boss 名称
   * @param employeeId 员工 ID
   * @param sessionId OpenCode session ID
   */
  async recordSession(
    bossName: string,
    employeeId: EmployeeId,
    sessionId: string
  ): Promise<void> {
    if (!this.workspaceRoot) {
      logger.warn(`[BossManager] Cannot record session: workspaceRoot not set`)
      return
    }

    const sessions = await this.readSessions(bossName)
    sessions[employeeId] = sessionId
    await this.writeSessions(bossName, sessions)
    logger.debug(
      `[BossManager] Recorded session for ${bossName} → ${employeeId}: ${sessionId}`
    )
  }

  /**
   * 获取 boss 与员工的 session ID
   * @param bossName Boss 名称
   * @param employeeId 员工 ID
   * @returns Session ID 或 undefined
   */
  async getSession(
    bossName: string,
    employeeId: EmployeeId
  ): Promise<string | undefined> {
    if (!this.workspaceRoot) {
      return undefined
    }

    const sessions = await this.readSessions(bossName)
    return sessions[employeeId]
  }

  /**
   * 清除 boss 与员工的 session 映射
   * @param bossName Boss 名称
   * @param employeeId 员工 ID
   */
  async clearSession(bossName: string, employeeId: EmployeeId): Promise<void> {
    if (!this.workspaceRoot) {
      return
    }

    const sessions = await this.readSessions(bossName)
    delete sessions[employeeId]
    await this.writeSessions(bossName, sessions)
    logger.debug(
      `[BossManager] Cleared session for ${bossName} → ${employeeId}`
    )
  }

  /**
   * 获取 sessions 文件路径
   */
  private getSessionsFilePath(bossName: string): string {
    return path.join(this.workspaceRoot!, "bosses", bossName, "sessions.yaml")
  }

  /**
   * 从文件读取 sessions
   */
  private async readSessions(
    bossName: string
  ): Promise<Record<string, string>> {
    const filePath = this.getSessionsFilePath(bossName)

    try {
      const content = await fs.readFile(filePath, "utf-8")
      return (yaml.parse(content) as Record<string, string>) || {}
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return {}
      }
      throw error
    }
  }

  /**
   * 写入 sessions 到文件（带文件锁）
   */
  private async writeSessions(
    bossName: string,
    sessions: Record<string, string>
  ): Promise<void> {
    const filePath = this.getSessionsFilePath(bossName)

    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    // 确保文件存在（用于加锁）
    try {
      await fs.access(filePath)
    } catch {
      await fs.writeFile(filePath, yaml.stringify({}), "utf-8")
    }

    // 加锁写入
    let release: (() => Promise<void>) | undefined
    try {
      release = await lockfile.lock(filePath, {
        retries: {
          retries: 5,
          minTimeout: 100,
          maxTimeout: 1000,
        },
        stale: 5000,
      })

      await fs.writeFile(filePath, yaml.stringify(sessions), "utf-8")
    } catch (error) {
      logger.error(`[BossManager] Failed to write sessions: ${error}`)
      throw error
    } finally {
      if (release) {
        await release()
      }
    }
  }
}
