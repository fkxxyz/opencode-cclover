import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import * as yaml from "yaml"
import { logger } from "../lib/logger"

/**
 * Project 配置
 */
export interface ProjectConfig {
  name: string
  path: string
  enabled: boolean
}

/**
 * Cclover 配置
 */
export interface CcloverConfig {
  bosses?: string[]
  port?: number
  projects: ProjectConfig[]
}

/**
 * 配置管理器
 * 负责读取、验证、保存配置文件
 */
export class ConfigManager {
  private static CONFIG_PATH = path.join(
    os.homedir(),
    ".config/opencode-cclover/config.yaml"
  )

  /**
   * 读取配置文件
   */
  static async load(): Promise<CcloverConfig> {
    try {
      const content = await fs.readFile(this.CONFIG_PATH, "utf-8")
      const config = yaml.parse(content) as CcloverConfig

      if (!this.validate(config)) {
        logger.warn("Invalid config file, using empty config")
        return { projects: [] }
      }

      return config
    } catch (error: any) {
      if (error.code === "ENOENT") {
        logger.info("Config file not found, using empty config")
        return { projects: [] }
      }
      logger.error("Failed to load config:", error)
      return { projects: [] }
    }
  }

  /**
   * 保存配置文件
   */
  static async save(config: CcloverConfig): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(this.CONFIG_PATH)
      await fs.mkdir(dir, { recursive: true })

      // 写入配置
      const content = yaml.stringify(config)
      await fs.writeFile(this.CONFIG_PATH, content, "utf-8")

      logger.info("Config saved successfully")
    } catch (error) {
      logger.error("Failed to save config:", error)
      throw error
    }
  }

  /**
   * 验证配置格式
   */
  static validate(config: any): boolean {
    if (!config || typeof config !== "object") {
      return false
    }

    if (!Array.isArray(config.projects)) {
      return false
    }

    // 验证 bosses 字段（可选）
    if (config.bosses !== undefined) {
      if (!Array.isArray(config.bosses)) {
        return false
      }
      for (const boss of config.bosses) {
        if (typeof boss !== "string") {
          return false
        }
      }
    }

    // 验证 port 字段（可选）
    if (config.port !== undefined) {
      if (typeof config.port !== "number") {
        return false
      }
    }

    for (const project of config.projects) {
      if (
        typeof project.name !== "string" ||
        typeof project.path !== "string" ||
        typeof project.enabled !== "boolean"
      ) {
        return false
      }
    }

    return true
  }

  /**
   * 获取配置文件路径
   */
  static getConfigPath(): string {
    return this.CONFIG_PATH
  }
}
