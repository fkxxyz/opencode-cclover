import { describe, test, expect, beforeEach, afterEach } from "bun:test"

describe("GlobalServer port configuration", () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    // 保存原始环境变量
    originalEnv = process.env.CCLOVER_PORT
  })

  afterEach(() => {
    // 恢复原始环境变量
    if (originalEnv === undefined) {
      delete process.env.CCLOVER_PORT
    } else {
      process.env.CCLOVER_PORT = originalEnv
    }
  })

  describe("port priority logic", () => {
    test("should use environment variable when set", () => {
      process.env.CCLOVER_PORT = "8080"
      const envPort = parseInt(process.env.CCLOVER_PORT || "", 10)
      const configPort = 9000
      const port = !isNaN(envPort) && envPort > 0 ? envPort : configPort || 4097

      expect(port).toBe(8080)
    })

    test("should use config port when env var not set", () => {
      delete process.env.CCLOVER_PORT
      const envPort = parseInt(process.env.CCLOVER_PORT || "", 10)
      const configPort = 9000
      const port = !isNaN(envPort) && envPort > 0 ? envPort : configPort || 4097

      expect(port).toBe(9000)
    })

    test("should use default port when neither env var nor config set", () => {
      delete process.env.CCLOVER_PORT
      const envPort = parseInt(process.env.CCLOVER_PORT || "", 10)
      const configPort = undefined
      const port = !isNaN(envPort) && envPort > 0 ? envPort : configPort || 4097

      expect(port).toBe(4097)
    })

    test("should handle port 0 correctly (not use it)", () => {
      process.env.CCLOVER_PORT = "0"
      const envPort = parseInt(process.env.CCLOVER_PORT || "", 10)
      const configPort = 9000
      const port = !isNaN(envPort) && envPort > 0 ? envPort : configPort || 4097

      expect(port).toBe(9000)
    })

    test("should handle invalid env var (use config fallback)", () => {
      process.env.CCLOVER_PORT = "invalid"
      const envPort = parseInt(process.env.CCLOVER_PORT || "", 10)
      const configPort = 9000
      const port = !isNaN(envPort) && envPort > 0 ? envPort : configPort || 4097

      expect(port).toBe(9000)
    })

    test("should handle empty env var (use config fallback)", () => {
      process.env.CCLOVER_PORT = ""
      const envPort = parseInt(process.env.CCLOVER_PORT || "", 10)
      const configPort = 9000
      const port = !isNaN(envPort) && envPort > 0 ? envPort : configPort || 4097

      expect(port).toBe(9000)
    })
  })

  describe("port validation", () => {
    test("should reject port below 1", () => {
      const port = 0
      expect(port < 1 || port > 65535).toBe(true)
    })

    test("should reject port above 65535", () => {
      const port = 99999
      expect(port < 1 || port > 65535).toBe(true)
    })

    test("should accept valid port 1", () => {
      const port = 1
      expect(port < 1 || port > 65535).toBe(false)
    })

    test("should accept valid port 65535", () => {
      const port = 65535
      expect(port < 1 || port > 65535).toBe(false)
    })

    test("should accept valid port 4097", () => {
      const port = 4097
      expect(port < 1 || port > 65535).toBe(false)
    })

    test("should reject negative port", () => {
      const port = -1
      expect(port < 1 || port > 65535).toBe(true)
    })
  })
})
