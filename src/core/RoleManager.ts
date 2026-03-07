/**
 * Role 管理器
 *
 * 负责从多个位置加载 role 定义：
 * 1. 预设角色：src/roles/*.md（代码仓库）
 * 2. 全局自定义角色：~/.config/opencode-cclover/roles/*.md
 * 3. 项目自定义角色：<project>/.cclover/roles/*.md
 *
 * 优先级：项目 > 全局 > 预设
 */

import * as fs from "node:fs/promises"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import * as yaml from "yaml"
import { logger } from "../lib/logger"
import type { Role, RoleMetadata } from "../types"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class RoleManager {
  private roles: Map<string, Role> = new Map()
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
  getRole(name: string): Role | undefined {
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
  getAllRoles(): Role[] {
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
        if (!file.endsWith(".md")) {
          continue
        }

        const filePath = path.join(dir, file)

        try {
          const content = await fs.readFile(filePath, "utf-8")

          // 尝试解析 YAML frontmatter
          const frontmatterMatch = content.match(
            /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
          )

          if (frontmatterMatch) {
            // 新格式：YAML frontmatter + markdown
            const metadata = yaml.parse(frontmatterMatch[1]) as RoleMetadata
            const systemPrompt = frontmatterMatch[2].trim()

            this.roles.set(metadata.name, {
              ...metadata,
              systemPrompt,
              source,
            })

            logger.debug(
              `[RoleManager] Loaded role "${metadata.name}" from ${source} (${filePath}) with metadata`
            )
          } else {
            // 旧格式：纯 markdown（向后兼容）
            const roleName = path.basename(file, ".md")
            this.roles.set(roleName, {
              name: roleName,
              description: "",
              systemPrompt: content.trim(),
              source,
              requiredArgs: {},
              canHire: [],
              groups: [],
            })

            logger.debug(
              `[RoleManager] Loaded role "${roleName}" from ${source} (${filePath}) without metadata`
            )
          }
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

  /**
   * 解析组引用为角色名称列表
   * @param groupRef 格式: "group:groupname"
   * @returns 该组中的所有角色名称
   */
  resolveGroup(groupRef: string): string[] {
    if (!groupRef.startsWith("group:")) {
      return []
    }

    const groupName = groupRef.slice(6)
    const roles: string[] = []

    for (const role of this.roles.values()) {
      if (role.groups?.includes(groupName)) {
        roles.push(role.name)
      }
    }

    return roles
  }

  /**
   * 解析 canHire 模式为实际角色名称
   * @param canHire 模式/组/精确名称数组
   * @returns 解析后的角色名称数组
   */
  resolveCanHire(canHire: string[]): string[] {
    const resolved = new Set<string>()

    for (const pattern of canHire) {
      if (pattern.startsWith("group:")) {
        // 组引用
        for (const name of this.resolveGroup(pattern)) {
          resolved.add(name)
        }
      } else if (pattern.includes("*")) {
        // Glob 模式
        for (const role of this.roles.values()) {
          if (matchGlob(pattern, role.name)) {
            resolved.add(role.name)
          }
        }
      } else {
        // 精确名称
        if (this.roles.has(pattern)) {
          resolved.add(pattern)
        }
      }
    }

    return Array.from(resolved)
  }

  /**
   * 检查角色 A 是否可以雇佣角色 B
   * @param roleA 雇佣方角色名称
   * @param roleB 被雇佣方角色名称
   * @returns 是否可以雇佣
   */
  canHire(roleA: string, roleB: string): boolean {
    const role = this.roles.get(roleA)
    if (!role || !role.canHire || role.canHire.length === 0) {
      return false
    }

    const allowedRoles = this.resolveCanHire(role.canHire)
    return allowedRoles.includes(roleB)
  }
}

/**
 * 匹配角色名称与 glob 模式
 * 支持: *, *suffix, prefix*, *middle*
 */
function matchGlob(pattern: string, name: string): boolean {
  if (pattern === "*") return true

  if (pattern.startsWith("*") && pattern.endsWith("*")) {
    const middle = pattern.slice(1, -1)
    return name.includes(middle)
  }

  if (pattern.startsWith("*")) {
    const suffix = pattern.slice(1)
    return name.endsWith(suffix)
  }

  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1)
    return name.startsWith(prefix)
  }

  return pattern === name
}
