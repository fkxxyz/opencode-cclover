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
import type { Role, RoleMetadata, ResolvedRoleContext } from "../types"
import {
  formatRoleValidationIssue,
  validateRoleFrontmatter,
} from "./RoleFrontmatterValidator"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface RawContextDefinition {
  description?: string
  documents?: string[]
}

interface ContextDefinition extends RawContextDefinition {
  sourceFile: string
}

export class RoleManager {
  private roles: Map<string, Role> = new Map()
  private projectPath: string
  private contextDefinitions: Map<string, ContextDefinition> = new Map()
  private presetContextPath: string
  private presetRolesDir: string
  private presetRootDir: string

  constructor(
    projectPath: string,
    presetRolesDir?: string,
    presetRootDir?: string
  ) {
    this.projectPath = projectPath
    // 允许测试环境注入自定义的 preset roles 目录
    this.presetRolesDir = presetRolesDir || path.join(__dirname, "../roles")
    // preset 文档的根目录（用于解析相对路径）
    // 默认为项目根目录（__dirname/../..），测试环境可以自定义
    this.presetRootDir =
      presetRootDir || path.resolve(this.presetRolesDir, "../..")
    this.presetContextPath = path.join(this.presetRolesDir, "context.yml")
  }

  /**
   * 刷新 role 列表
   * 扫描三个位置并按优先级加载
   */
  async refresh(): Promise<void> {
    this.roles.clear()
    this.contextDefinitions = await this.loadContextDefinitions()

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
    await this.loadRolesFromDir(this.presetRolesDir, "preset")
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
            const frontmatterData = yaml.parse(frontmatterMatch[1])
            const systemPrompt = frontmatterMatch[2].trim()

            const validation = validateRoleFrontmatter(frontmatterData, {
              filePath,
              expectedRoleName: path.basename(filePath, ".md"),
            })

            for (const issue of validation.issues) {
              const logMessage = formatRoleValidationIssue(issue, filePath)
              if (issue.level === "warning") {
                logger.warn(logMessage)
              } else {
                logger.warn(logMessage)
              }
            }

            if (!validation.valid || !validation.normalized) {
              continue
            }

            if (systemPrompt.length === 0) {
              logger.warn(
                `[RoleManager] Role file ${filePath} has empty system prompt body, skipping`
              )
              continue
            }

            // 构建 metadata，补充解析后的上下文字段
            const metadata: RoleMetadata = {
              ...validation.normalized,
              resolvedContexts: await this.resolveRoleContexts(
                validation.normalized.contextIds
              ),
            }

            this.roles.set(metadata.name, {
              ...metadata,
              systemPrompt,
              source,
            })

            logger.debug(
              `[RoleManager] Loaded role "${metadata.name}" from ${source} (${filePath}) with metadata`
            )
          } else {
            // 没有 YAML frontmatter，拒绝加载
            logger.debug(
              `[RoleManager] Role file ${filePath} does not have YAML frontmatter, skipping`
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

  private async loadContextDefinitions(): Promise<
    Map<string, ContextDefinition>
  > {
    const definitions = new Map<string, ContextDefinition>()

    await this.mergeContextDefinitions(
      definitions,
      this.presetContextPath,
      "preset"
    )

    const homeDir = process.env.HOME || process.env.USERPROFILE
    if (homeDir) {
      await this.mergeContextDefinitions(
        definitions,
        path.join(homeDir, ".config/opencode-cclover/context.yml"),
        "global"
      )
    }

    await this.mergeContextDefinitions(
      definitions,
      path.join(this.projectPath, ".cclover/context.yml"),
      "project"
    )

    return definitions
  }

  private async mergeContextDefinitions(
    definitions: Map<string, ContextDefinition>,
    filePath: string,
    source: "preset" | "global" | "project"
  ): Promise<void> {
    let content: string

    try {
      content = await fs.readFile(filePath, "utf-8")
    } catch (error: any) {
      if (error.code === "ENOENT") {
        logger.debug(
          `[RoleManager] Optional context source not found for ${source}: ${filePath}`
        )
        return
      }

      logger.warn(
        `[RoleManager] Failed to read ${source} context source ${filePath}: ${error.message}`
      )
      return
    }

    let parsed: any
    try {
      parsed = yaml.parse(content)
    } catch (error: any) {
      logger.warn(
        `[RoleManager] Invalid YAML in ${source} context source ${filePath}: ${error.message}`
      )
      return
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      logger.warn(
        `[RoleManager] Invalid context source ${filePath}: expected object root`
      )
      return
    }

    const contexts = parsed.contexts
    if (!contexts || typeof contexts !== "object" || Array.isArray(contexts)) {
      logger.warn(
        `[RoleManager] Invalid context source ${filePath}: expected contexts mapping`
      )
      return
    }

    for (const [contextId, value] of Object.entries(contexts)) {
      if (typeof contextId !== "string" || contextId.trim().length === 0) {
        logger.warn(
          `[RoleManager] Invalid context id in ${filePath}: context ids must be non-empty strings`
        )
        continue
      }

      if (!value || typeof value !== "object" || Array.isArray(value)) {
        logger.warn(
          `[RoleManager] Invalid context entry '${contextId}' in ${filePath}: expected object`
        )
        continue
      }

      const description = (value as RawContextDefinition).description
      const documents = (value as RawContextDefinition).documents

      if (description !== undefined && typeof description !== "string") {
        logger.warn(
          `[RoleManager] Invalid description for context '${contextId}' in ${filePath}: expected string`
        )
        continue
      }

      if (
        documents !== undefined &&
        !(
          Array.isArray(documents) &&
          documents.every((doc) => typeof doc === "string")
        )
      ) {
        logger.warn(
          `[RoleManager] Invalid documents for context '${contextId}' in ${filePath}: expected string array`
        )
        continue
      }

      definitions.set(contextId, {
        description,
        documents,
        sourceFile: filePath,
      })
    }
  }

  private async resolveRoleContexts(
    contextIds?: string[]
  ): Promise<ResolvedRoleContext[] | undefined> {
    if (!contextIds || contextIds.length === 0) {
      return undefined
    }

    const resolved: ResolvedRoleContext[] = []

    for (const contextId of contextIds) {
      if (typeof contextId !== "string" || contextId.trim().length === 0) {
        logger.warn(
          `[RoleManager] Encountered empty context id while resolving role contexts, skipping`
        )
        continue
      }

      const definition = this.contextDefinitions.get(contextId)
      if (!definition) {
        logger.warn(
          `[RoleManager] Context '${contextId}' not found in layered context sources, skipping`
        )
        continue
      }

      resolved.push({
        id: contextId,
        description: definition.description,
        documents: [],
      })

      const context = resolved[resolved.length - 1]

      for (const documentPath of definition.documents ?? []) {
        let resolvedPath: string
        if (path.isAbsolute(documentPath)) {
          // 绝对路径直接使用
          resolvedPath = documentPath
        } else {
          // 相对路径根据来源解析
          // 预设 context.yml: 从仓库根目录解析
          // 其他 context.yml: 从项目根目录解析
          const isPreset =
            path.normalize(definition.sourceFile) ===
            path.normalize(this.presetContextPath)
          const baseDir = isPreset ? this.presetRootDir : this.projectPath
          resolvedPath = path.resolve(baseDir, documentPath)
        }

        try {
          const content = await fs.readFile(resolvedPath, "utf-8")
          context.documents.push({
            path: resolvedPath,
            content,
          })
        } catch (error: any) {
          logger.warn(
            `[RoleManager] Failed to read context document ${resolvedPath} for context '${contextId}': ${error.message}`
          )
        }
      }
    }

    return resolved
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
