/**
 * Zod 参数描述提取器
 *
 * 从 Zod 内部表示中递归提取参数描述
 * 用于解决 OpenCode SDK 不传递 .describe() 到 AI 的问题
 */

/**
 * 从 Zod 内部表示中递归提取参数描述
 *
 * @param schema - Zod schema 对象（来自 tool.definition hook 的 output.parameters）
 * @param indent - 当前缩进级别（用于格式化输出）
 * @returns 格式化的参数说明文本行数组
 */
export function extractZodDescriptions(
  schema: any,
  indent: number = 0
): string[] {
  const lines: string[] = []
  const prefix = "  ".repeat(indent)

  // 处理不同的 Zod 类型
  if (!schema?.def) {
    return lines
  }

  const def = schema.def
  const type = def.type

  switch (type) {
    case "object":
      // 对象类型：递归处理每个字段
      if (def.shape) {
        for (const [key, value] of Object.entries(def.shape)) {
          const valueDef = (value as any).def

          // 获取描述：可能在 def.description 或 def.innerType.def.description (optional/nullable)
          let fieldDesc = valueDef?.description || ""
          if (
            !fieldDesc &&
            (valueDef?.type === "optional" || valueDef?.type === "nullable")
          ) {
            fieldDesc = valueDef?.innerType?.def?.description || ""
          }

          if (fieldDesc) {
            lines.push(`${prefix}- ${key}: ${fieldDesc}`)
          } else {
            lines.push(`${prefix}- ${key}:`)
          }
          // 递归处理嵌套字段
          lines.push(...extractZodDescriptions(value, indent + 1))
        }
      }
      break

    case "array":
      // 数组类型：处理元素类型
      if (def.element) {
        const elementDesc = def.element.def?.description
        if (elementDesc) {
          lines.push(`${prefix}  [元素]: ${elementDesc}`)
        }
        lines.push(...extractZodDescriptions(def.element, indent + 1))
      }
      break

    case "optional":
    case "nullable":
      // 可选/可空类型：递归处理内部类型
      if (def.innerType) {
        lines.push(...extractZodDescriptions(def.innerType, indent))
      }
      break

    case "enum":
      // 枚举类型：列出可选值
      if (def.values && Array.isArray(def.values)) {
        lines.push(`${prefix}  可选值: ${def.values.join(", ")}`)
      }
      break

    case "union":
      // 联合类型：处理每个选项
      if (def.options && Array.isArray(def.options)) {
        lines.push(`${prefix}  可选类型:`)
        def.options.forEach((option: any, index: number) => {
          lines.push(`${prefix}    选项 ${index + 1}:`)
          lines.push(...extractZodDescriptions(option, indent + 2))
        })
      }
      break

    // 基础类型（string, number, boolean 等）不需要额外处理
    default:
      break
  }

  return lines
}

/**
 * 从工具的 parameters 中提取所有参数描述并格式化
 *
 * @param parameters - tool.definition hook 的 output.parameters
 * @returns 格式化的参数说明文本，可直接追加到工具描述
 */
export function formatToolParameterDescriptions(parameters: any): string {
  if (!parameters?.def?.shape) {
    return ""
  }

  const lines: string[] = []
  const shape = parameters.def.shape

  for (const [paramName, paramSchema] of Object.entries(shape)) {
    const paramDef = (paramSchema as any).def

    // 获取描述：可能在 def.description 或 def.innerType.def.description (optional/nullable)
    let description = paramDef?.description || ""
    if (
      !description &&
      (paramDef?.type === "optional" || paramDef?.type === "nullable")
    ) {
      description = paramDef?.innerType?.def?.description || ""
    }

    // 顶层参数
    if (description) {
      lines.push(`  - ${paramName}: ${description}`)
    } else {
      lines.push(`  - ${paramName}:`)
    }

    // 递归提取嵌套描述
    const nested = extractZodDescriptions(paramSchema, 2)
    if (nested.length > 0) {
      lines.push(...nested)
    }
  }

  return lines.length > 0 ? `\n\n参数说明：\n${lines.join("\n")}` : ""
}
