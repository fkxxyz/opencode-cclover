/**
 * 验证前端是否完整处理了后端所有的事件类型
 */

import { describe, test, expect } from "bun:test"
import * as fs from "node:fs/promises"
import * as path from "node:path"

const BACKEND_TYPES_PATH = path.join(__dirname, "../../src/types/index.ts")
const FRONTEND_TYPES_PATH = path.join(__dirname, "../src/types/index.ts")
const EVENT_ITEM_PATH = path.join(
  __dirname,
  "../src/components/employee/EventItem.tsx"
)

// 从 TypeScript 文件中提取 EventType 联合类型
function extractEventTypes(content: string): Set<string> {
  const eventTypes = new Set<string>()

  // 匹配 export type EventType = ... 的定义
  const typeDefMatch = content.match(
    /export type EventType\s*=\s*([\s\S]*?)(?=\n\n|\/\/|export|$)/
  )

  if (!typeDefMatch) {
    throw new Error("Cannot find EventType definition")
  }

  const typeDef = typeDefMatch[1]

  // 提取所有字符串字面量类型
  const matches = typeDef.matchAll(/"([^"]+)"/g)
  for (const match of matches) {
    const eventType = match[1]
    // 排除通配符
    if (eventType !== "*") {
      eventTypes.add(eventType)
    }
  }

  return eventTypes
}

// 从 EventItem.tsx 中提取已处理的事件类型
function extractHandledEventTypes(content: string): Set<string> {
  const handledTypes = new Set<string>()

  // 提取 switch 语句中的 case
  const switchMatch = content.match(/switch\s*\(type\)\s*{([\s\S]*?)default:/)

  if (!switchMatch) {
    throw new Error("Cannot find switch statement in EventItem.tsx")
  }

  const switchBody = switchMatch[1]

  // 提取所有 case 语句
  const caseMatches = switchBody.matchAll(/case\s+"([^"]+)":/g)
  for (const match of caseMatches) {
    handledTypes.add(match[1])
  }

  return handledTypes
}

// 从 EventItem.tsx 中提取图标映射
function extractIconMappings(content: string): Set<string> {
  const iconTypes = new Set<string>()

  // 提取 EVENT_ICONS 对象
  const iconMatch = content.match(/const EVENT_ICONS[^{]*{([\s\S]*?)}/)

  if (!iconMatch) {
    throw new Error("Cannot find EVENT_ICONS in EventItem.tsx")
  }

  const iconBody = iconMatch[1]

  // 提取所有键
  const keyMatches = iconBody.matchAll(/(\w+):/g)
  for (const match of keyMatches) {
    iconTypes.add(match[1])
  }

  return iconTypes
}

describe("Event Type Coverage", () => {
  let backendTypes: Set<string>
  let frontendTypes: Set<string>
  let handledTypes: Set<string>
  let iconTypes: Set<string>

  // 在所有测试前读取文件
  test("setup: read and parse files", async () => {
    const backendContent = await fs.readFile(BACKEND_TYPES_PATH, "utf-8")
    const frontendContent = await fs.readFile(FRONTEND_TYPES_PATH, "utf-8")
    const eventItemContent = await fs.readFile(EVENT_ITEM_PATH, "utf-8")

    backendTypes = extractEventTypes(backendContent)
    frontendTypes = extractEventTypes(frontendContent)
    handledTypes = extractHandledEventTypes(eventItemContent)
    iconTypes = extractIconMappings(eventItemContent)

    expect(backendTypes.size).toBeGreaterThan(0)
    expect(frontendTypes.size).toBeGreaterThan(0)
    expect(handledTypes.size).toBeGreaterThan(0)
    expect(iconTypes.size).toBeGreaterThan(0)
  })

  test("frontend types should include all backend types", () => {
    const missingInFrontend = [...backendTypes].filter(
      (type) => !frontendTypes.has(type)
    )

    expect(missingInFrontend).toEqual([])
  })

  test("frontend should not have extra types not in backend", () => {
    const extraInFrontend = [...frontendTypes].filter(
      (type) => !backendTypes.has(type)
    )

    expect(extraInFrontend).toEqual([])
  })

  test("EventItem.tsx should handle all frontend types", () => {
    const unhandledTypes = [...frontendTypes].filter(
      (type) => !handledTypes.has(type)
    )

    expect(unhandledTypes).toEqual([])
  })

  test("all frontend types should have icon mappings", () => {
    const missingIcons = [...frontendTypes].filter(
      (type) => !iconTypes.has(type)
    )

    expect(missingIcons).toEqual([])
  })

  test("type counts should match", () => {
    expect(frontendTypes.size).toBe(backendTypes.size)
    expect(handledTypes.size).toBe(frontendTypes.size)
    expect(iconTypes.size).toBe(frontendTypes.size)
  })
})
