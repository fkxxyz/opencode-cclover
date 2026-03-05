import { describe, test, expect } from "bun:test"
import { ConfigManager } from "../../src/config/ConfigManager"
import type { CcloverConfig } from "../../src/config/ConfigManager"

describe("ConfigManager", () => {
  describe("validate", () => {
    test("should validate valid config without bosses", () => {
      const config: CcloverConfig = {
        projects: [
          {
            name: "test-project",
            path: "/path/to/project",
            enabled: true,
          },
        ],
      }
      expect(ConfigManager.validate(config)).toBe(true)
    })

    test("should validate valid config with bosses", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao", "admin"],
        projects: [
          {
            name: "test-project",
            path: "/path/to/project",
            enabled: true,
          },
        ],
      }
      expect(ConfigManager.validate(config)).toBe(true)
    })

    test("should validate config with port", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao"],
        port: 8080,
        projects: [
          {
            name: "test-project",
            path: "/path/to/project",
            enabled: true,
          },
        ],
      }
      expect(ConfigManager.validate(config)).toBe(true)
    })

    test("should validate config with empty bosses array", () => {
      const config: CcloverConfig = {
        bosses: [],
        projects: [],
      }
      expect(ConfigManager.validate(config)).toBe(true)
    })

    test("should reject config with invalid bosses type", () => {
      const config: any = {
        bosses: "not-an-array",
        projects: [],
      }
      expect(ConfigManager.validate(config)).toBe(false)
    })

    test("should reject config with non-string boss names", () => {
      const config: any = {
        bosses: ["valid", 123, "another-valid"],
        projects: [],
      }
      expect(ConfigManager.validate(config)).toBe(false)
    })

    test("should reject config without projects", () => {
      const config: any = {
        bosses: ["bayecao"],
      }
      expect(ConfigManager.validate(config)).toBe(false)
    })

    test("should reject config with invalid projects", () => {
      const config: any = {
        bosses: ["bayecao"],
        projects: [
          {
            name: "test",
            // missing path and enabled
          },
        ],
      }
      expect(ConfigManager.validate(config)).toBe(false)
    })

    test("should reject null config", () => {
      expect(ConfigManager.validate(null)).toBe(false)
    })

    test("should reject non-object config", () => {
      expect(ConfigManager.validate("not-an-object")).toBe(false)
      expect(ConfigManager.validate(123)).toBe(false)
      expect(ConfigManager.validate([])).toBe(false)
    })

    test("should validate config with multiple bosses and projects", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao", "admin", "manager"],
        projects: [
          {
            name: "project1",
            path: "/path/to/project1",
            enabled: true,
          },
          {
            name: "project2",
            path: "/path/to/project2",
            enabled: false,
          },
        ],
      }
      expect(ConfigManager.validate(config)).toBe(true)
    })

    test("should reject config with invalid port type", () => {
      const config: any = {
        bosses: ["bayecao"],
        port: "not-a-number",
        projects: [],
      }
      expect(ConfigManager.validate(config)).toBe(false)
    })
  })
})
