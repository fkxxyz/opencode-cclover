import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import * as yaml from "yaml"
import { logger } from "../lib/logger"

/**
 * 候选项目信息
 */
export interface CandidateProject {
  path: string
  firstSeenAt: string
  lastSeenAt: string
  seenCount: number
}

/**
 * 候选项目列表配置
 */
export interface CandidateProjectsConfig {
  candidates: CandidateProject[]
}

/**
 * 候选项目管理器
 * 记录所有输出 "Please add this project" 警告的项目
 */
export class CandidateProjectsManager {
  private static CANDIDATES_PATH = path.join(
    os.homedir(),
    ".config/opencode-cclover/candidate-projects.yaml"
  )

  /**
   * 读取候选项目列表
   */
  static async load(): Promise<CandidateProjectsConfig> {
    try {
      const content = await fs.readFile(this.CANDIDATES_PATH, "utf-8")
      const config = yaml.parse(content) as CandidateProjectsConfig

      if (!this.validate(config)) {
        logger.warn("Invalid candidate projects file, using empty list")
        return { candidates: [] }
      }

      return config
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return { candidates: [] }
      }
      logger.error("Failed to load candidate projects:", error)
      return { candidates: [] }
    }
  }

  /**
   * 保存候选项目列表
   */
  static async save(config: CandidateProjectsConfig): Promise<void> {
    try {
      // 确保目录存在
      const dir = path.dirname(this.CANDIDATES_PATH)
      await fs.mkdir(dir, { recursive: true })

      // 写入配置
      const content = yaml.stringify(config)
      await fs.writeFile(this.CANDIDATES_PATH, content, "utf-8")
    } catch (error) {
      logger.error("Failed to save candidate projects:", error)
      throw error
    }
  }

  /**
   * 添加候选项目
   */
  static async addCandidate(projectPath: string): Promise<void> {
    const config = await this.load()
    const now = new Date().toISOString()

    // 查找是否已存在
    const existing = config.candidates.find((c) => c.path === projectPath)

    if (existing) {
      // 更新已存在的候选项目
      existing.lastSeenAt = now
      existing.seenCount++
    } else {
      // 添加新候选项目
      config.candidates.push({
        path: projectPath,
        firstSeenAt: now,
        lastSeenAt: now,
        seenCount: 1,
      })
    }

    await this.save(config)
    logger.info(`Candidate project recorded: ${projectPath}`)
  }

  /**
   * 移除候选项目
   */
  static async removeCandidate(projectPath: string): Promise<void> {
    const config = await this.load()
    config.candidates = config.candidates.filter((c) => c.path !== projectPath)
    await this.save(config)
  }

  /**
   * 获取所有候选项目
   */
  static async getAll(): Promise<CandidateProject[]> {
    const config = await this.load()
    // 按最后出现时间倒序排序
    return config.candidates.sort(
      (a, b) =>
        new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
    )
  }

  /**
   * 验证配置格式
   */
  private static validate(config: any): boolean {
    if (!config || typeof config !== "object") {
      return false
    }

    if (!Array.isArray(config.candidates)) {
      return false
    }

    for (const candidate of config.candidates) {
      if (
        typeof candidate.path !== "string" ||
        typeof candidate.firstSeenAt !== "string" ||
        typeof candidate.lastSeenAt !== "string" ||
        typeof candidate.seenCount !== "number"
      ) {
        return false
      }
    }

    return true
  }

  /**
   * 获取候选项目文件路径
   */
  static getCandidatesPath(): string {
    return this.CANDIDATES_PATH
  }
}
