import { describe, test, expect } from "bun:test"
import { ModelConfigManager } from "../../src/config/ModelConfigManager"
import type {
  PresetConfig,
  ResolvedModelConfig,
} from "../../src/config/ModelConfigManager"
import type { CcloverConfig } from "../../src/config/ConfigManager"

function suppressExpectedWarnings<T>(callback: () => T): T {
  const originalWarn = console.warn
  console.warn = () => {}

  try {
    return callback()
  } finally {
    console.warn = originalWarn
  }
}

describe("ModelConfigManager", () => {
  describe("validate", () => {
    test("should validate valid model configs", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
          fast: { model: "anthropic/claude-3-haiku-20240307" },
        },
      }
      const presetConfig: PresetConfig = {
        modelTypes: {
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      expect(() => manager.validate()).not.toThrow()
    })

    test("should detect circular redirection in global layer", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          fast: "default",
          default: "fast", // Circular: fast -> default -> fast
        },
      }
      const presetConfig: PresetConfig = {}

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      expect(() => manager.validate()).toThrow(/Circular redirection/)
    })

    test("should detect circular redirection in preset layer", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
      }
      const presetConfig: PresetConfig = {
        modelTypes: {
          a: "b",
          b: "c",
          c: "a", // Circular: a -> b -> c -> a
        },
      }

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      expect(() => manager.validate()).toThrow(/Circular redirection/)
    })

    test("should reject invalid modemat (no slash)", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          default: { model: "invalid-format" },
        },
      }
      const presetConfig: PresetConfig = {}

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      expect(() => manager.validate()).toThrow(/Invalid model format/)
    })

    test("should reject invalid model format (too many slashes)", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          default: { model: "provider/model/extra" },
        },
      }
      const presetConfig: PresetConfig = {}

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      expect(() => manager.validate()).toThrow(/Invalid model format/)
    })

    test("should reject invalid model format (empty parts)", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          default: { model: "/model" },
        },
      }
      const presetConfig: PresetConfig = {}

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      expect(() => manager.validate()).toThrow(/Invalid model format/)
    })

    test("should allow redirection to missing target (will fallback)", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          fast: "nonexistent",
        },
      }
      const presetConfig: PresetConfig = {}

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      suppressExpectedWarnings(() => {
        expect(() => manager.validate()).not.toThrow()
      })
    })
  })

  describe("resolve", () => {
    test("should resolve model from global layer", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }
      const presetConfig: PresetConfig = {}

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      manager.validate()

      const result = manager.resolve("default")
      expect(result).toEqual({
        providerID: "anthropic",
        modelID: "claude-3-5-sonnet-20241022",
      })
    })

    test("should resolve model from preset layer when not in global", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
      }
      const presetConfig: PresetConfig = {
        modelTypes: {
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      manager.validate()

      const result = manager.resolve("default")
      expect(result).toEqual({
        providerID: "anthropic",
        modelID: "claude-3-5-sonnet-20241022",
      })
    })

    test("should prefer global over preset", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          default: { model: "anthropic/claude-3-opus-20240229" },
        },
      }
      const presetConfig: PresetConfig = {
        modelTypes: {
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      manager.validate()

      const result = manager.resolve("default")
      expect(result).toEqual({
        providerID: "anthropic",
        modelID: "claude-3-opus-20240229",
      })
    })

    test("should return null for missing model type", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
      }
      const presetConfig: PresetConfig = {}

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      manager.validate()

      const result = manager.resolve("nonexistent")
      expect(result).toBeNull()
    })

    test("should resolve single-layer redirection in global", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          fast: "default",
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }
      const presetConfig: PresetConfig = {}

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      manager.validate()

      const result = manager.resolve("fast")
      expect(result).toEqual({
        providerID: "anthropic",
        modelID: "claude-3-5-sonnet-20241022",
      })
    })

    test("should NOT follow redirection across layers", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          fast: "default", // Redirects to "default" in global layer
        },
      }
      const presetConfig: PresetConfig = {
        modelTypes: {
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      suppressExpectedWarnings(() => {
        manager.validate()
      })

      // "fast" redirects to "default" in global, but "default" doesn't exist in global
      // So it should fallback to preset layer and resolve "fast" there (which doesn't exist)
      // Result: null
      const result = manager.resolve("fast")
      expect(result).toBeNull()
    })

    test("should cache resolved results", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }
      const presetConfig: PresetConfig = {}

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      manager.validate()

      const result1 = manager.resolve("default")
      const result2 = manager.resolve("default")

      expect(result1).toEqual(result2)
      expect(result1).toBe(result2) // Same object reference (cached)
    })

    test("should handle multi-step redirection within same layer", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          fast: "medium",
          medium: "default",
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }
      const presetConfig: PresetConfig = {}

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      manager.validate()

      const result = manager.resolve("fast")
      expect(result).toEqual({
        providerID: "anthropic",
        modelID: "claude-3-5-sonnet-20241022",
      })
    })

    test("should treat string value as redirection", () => {
      const globalConfig: CcloverConfig = {
        projects: [],
        modelTypes: {
          fast: "default", // String format is redirection
          default: { model: "anthropic/claude-3-5-sonnet-20241022" },
        },
      }
      const presetConfig: PresetConfig = {}

      const manager = new ModelConfigManager(globalConfig, presetConfig)
      expect(() => manager.validate()).not.toThrow()

      const result = manager.resolve("fast")
      expect(result).toEqual({
        providerID: "anthropic",
        modelID: "claude-3-5-sonnet-20241022",
      })
    })
  })
})
