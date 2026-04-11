import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import { logger } from "../lib/logger"
import type { CcloverConfig } from "./ConfigManager"

/**
 * Preset 配置
 */
export interface PresetConfig {
  modelTypes?: {
    [key: string]: string | { model: string }
  }
}

/**
 * 解析后的模型配置
 */
export interface ResolvedModelConfig {
  providerID: string
  modelID: string
}

/**
 * 加载 preset 配置
 */
export async function loadPresetConfig(): Promise<PresetConfig> {
  const presetPath = path.join(__dirname, "preset.yaml")
  try {
    const content = await fs.readFile(presetPath, "utf-8")
    const config = yaml.parse(content) as PresetConfig
    return config || {}
  } catch (error: any) {
    if (error.code === "ENOENT") {
      logger.warn("Preset config not found, using empty config")
      return {}
    }
    logger.error("Failed to load preset config:", error)
    return {}
  }
}

/**
 * 模型配置管理器
 * 负责加载、验证、解析模型类型配置
 */
export class ModelConfigManager {
  private globalModelTypes: Record<string, string | { model: string }>
  private presetModelTypes: Record<string, string | { model: string }>
  private cache: Map<string, ResolvedModelConfig | null>

  constructor(globalConfig: CcloverConfig, presetConfig: PresetConfig) {
    this.globalModelTypes = globalConfig.modelTypes || {}
    this.presetModelTypes = presetConfig.modelTypes || {}
    this.cache = new Map()
  }

  /**
   * 验证所有模型类型配置
   * 检查循环重定向和无效的模型格式
   * @throws {Error} 如果发现循环重定向或无效格式
   */
  validate(): void {
    // 验证 global 层的所有模型类型
    for (const [key, value] of Object.entries(this.globalModelTypes)) {
      this.validateModelType(key, value, "global")
    }

    // 验证 preset 层的所有模型类型
    for (const [key, value] of Object.entries(this.presetModelTypes)) {
      this.validateModelType(key, value, "preset")
    }
  }

  /**
   * 验证单个模型类型配置
   */
  private validateModelType(
    key: string,
    value: string | { model: string },
    layer: "global" | "preset"
  ): void {
    if (typeof value === "string") {
      // 重定向：检查循环
      this.detectCircularRedirection(key, layer)
    } else if (typeof value === "object" && value.model) {
      // 模型字符串：验证格式
      this.validateModelFormat(value.model, key, layer)
    } else {
      throw new Error(
        `Invalid model type config for "${key}" in ${layer} layer: must be string or {model: string}`
      )
    }
  }

  /**
   * 检测循环重定向
   */
  private detectCircularRedirection(
    startKey: string,
    layer: "global" | "preset"
  ): void {
    const visited = new Set<string>()
    let currentKey = startKey
    const modelTypes =
      layer === "global" ? this.globalModelTypes : this.presetModelTypes

    while (true) {
      if (visited.has(currentKey)) {
        throw new Error(
          `Circular redirection detected in ${layer} layer: ${Array.from(visited).join(" -> ")} -> ${currentKey}`
        )
      }

      visited.add(currentKey)

      const value = modelTypes[currentKey]
      if (!value) {
        // 重定向目标不存在，这是允许的（会回退到下一层）
        break
      }

      if (typeof value === "string") {
        // 继续跟踪重定向
        currentKey = value
      } else {
        // 到达实际模型配置
        this.validateModelFormat(value.model, currentKey, layer)
        break
      }
    }
  }

  /**
   * 验证模型字符串格式
   */
  private validateModelFormat(
    modelString: string,
    key: string,
    layer: "global" | "preset"
  ): void {
    const parts = modelString.split("/")
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(
        `Invalid model format for "${key}" in ${layer} layer: "${modelString}". Expected format: "providerID/modelID"`
      )
    }
  }

  /**
   * 解析模型类型到模型配置
   * @param modelType 模型类型名称
   * @returns 解析后的模型配置，如果未找到则返回 null（使用 OpenCode 默认）
   */
  resolve(modelType: string): ResolvedModelConfig | null {
    // 检查缓存
    if (this.cache.has(modelType)) {
      return this.cache.get(modelType)!
    }

    // 尝试从 global 层解析
    const globalResult = this.resolveInLayer(
      modelType,
      this.globalModelTypes,
      "global"
    )
    if (globalResult !== null) {
      this.cache.set(modelType, globalResult)
      return globalResult
    }

    // 回退到 preset 层
    const presetResult = this.resolveInLayer(
      modelType,
      this.presetModelTypes,
      "preset"
    )
    if (presetResult !== null) {
      this.cache.set(modelType, presetResult)
      return presetResult
    }

    // 未找到，返回 null（使用 OpenCode 默认）
    logger.debug(
      `Model type "${modelType}" not found in any layer, using OpenCode default`
    )
    this.cache.set(modelType, null)
    return null
  }

  /**
   * 在单个层中解析模型类型
   */
  private resolveInLayer(
    modelType: string,
    modelTypes: Record<string, string | { model: string }>,
    layer: "global" | "preset"
  ): ResolvedModelConfig | null {
    const visited = new Set<string>()
    let currentKey = modelType

    while (true) {
      const value = modelTypes[currentKey]
      if (!value) {
        // 在当前层未找到
        return null
      }

      if (typeof value === "string") {
        // 重定向
        if (visited.has(value)) {
          // 这不应该发生，因为 validate() 已经检查过
          logger.error(
            `Unexpected circular redirection in ${layer} layer: ${currentKey} -> ${value}`
          )
          return null
        }
        visited.add(currentKey)
        currentKey = value
      } else {
        // 找到实际模型配置
        const parts = value.model.split("/")
        return {
          providerID: parts[0],
          modelID: parts[1],
        }
      }
    }
  }
}
