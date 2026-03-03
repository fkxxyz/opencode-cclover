import { ConfigManager } from "../config/ConfigManager"
import type { CcloverConfig } from "../config/ConfigManager"
import { logger } from "../lib/logger"

/**
 * Boss 管理器
 * 负责管理全局 boss 列表
 */
export class BossManager {
  private bosses: Set<string> = new Set()

  constructor(config?: CcloverConfig) {
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
}
