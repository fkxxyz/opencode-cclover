/**
 * Role 管理器
 *
 * 负责从多个位置加载 role 定义：
 * 1. 预设角色：src/roles/*.txt（代码仓库）
 * 2. 全局自定义角色：~/.config/opencode-cclover/roles/*.txt
 * 3. 项目自定义角色：<project>/.cclover/roles/*.txt
 *
 * 优先级：项目 > 全局 > 预设
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { logger } from "../lib/logger"
import type { Role } from "./EventLoop"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface RoleWithSource extends Role {
  source: "preset" | "global" | "project"
}

export class RoleManager {
  private roles: Map<string, RoleWithSource> = new Map()
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  /**
   * 刷新 role 列表
   * 扫描三个位置并按优先级加载
   */
  async refresh(): Promise<void> {
    this.roles.clear()

    // 1. 加载预设角色（优先级最低）
    await this.loadPresetRoles()

    // 2. 加载全局自定义角色（优先级中等）
    await this.loadGlobalRoles()

    // 3. 加载项目自定义角色（优先级最高）
    await this.loadProjectRoles()

    logger.info(
      `[RoleManager] Loaded ${this.roles.size} roles for project ${this.projectPath}`
    )
  }

  /**
   * 获取指定名称的 role
   */
  getRole(name: string): RoleWithSource | undefined {
    return this.roles.get(name)
  }

  /**
   * 获取所有 role 名称
   */
  getRoleNames(): string[] {
    return Array.from(this.roles.keys())
  }

  /**
   * 获取所有 role
   */
  getAllRoles(): RoleWithSource[] {
    return Array.from(this.roles.values())
  }

  /**
   * 加载预设角色
   */
  private async loadPresetRoles(): Promise<void> {
    const presetDir = path.join(__dirname, "../roles")
    await this.loadRolesFromDir(presetDir, "preset")
  }

  /**
   * 加载全局自定义角色
   */
  private async loadGlobalRoles(): Promise<void> {
    const homeDir = process.env.HOME || process.env.USERPROFILE
    if (!homeDir) {
      logger.warn("[RoleManager] Cannot determine home directory")
      return
    }

    const globalDir = path.join(homeDir, ".config/opencode-cclover/roles")
    await this.loadRolesFromDir(globalDir, "global")
  }

  /**
   * 加载项目自定义角色
   */
  private async loadProjectRoles(): Promise<void> {
    const projectDir = path.join(this.projectPath, ".cclover/roles")
    await this.loadRolesFromDir(projectDir, "project")
  }

  /**
   * 从指定目录加载 role
   */
  private async loadRolesFromDir(
    dir: string,
    source: "preset" | "global" | "project"
  ): Promise<void> {
    try {
      const files = await fs.readdir(dir)

      for (const file of files) {
        if (!file.endsWith(".txt")) {
          continue
        }

        const roleName = path.basename(file, ".txt")
        const filePath = path.join(dir, file)

        try {
          const systemPrompt = await fs.readFile(filePath, "utf-8")

          // 按优先级覆盖（项目 > 全局 > 预设）
          this.roles.set(roleName, {
            name: roleName,
            systemPrompt: systemPrompt.trim(),
            source,
          })

          logger.debug(
            `[RoleManager] Loaded role "${roleName}" from ${source} (${filePath})`
          )
        } catch (error: any) {
          logger.error(
            `[RoleManager] Failed to load role from ${filePath}: ${error.message}`
          )
        }
      }
    } catch (error: any) {
      if (error.code === "ENOENT") {
        logger.debug(`[RoleManager] Directory not found: ${dir}`)
      } else {
        logger.error(
          `[RoleManager] Failed to read directory ${dir}: ${error.message}`
        )
      }
    }
  }
}
