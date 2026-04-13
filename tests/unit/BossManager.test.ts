import { describe, test, expect, beforeEach } from "bun:test"
import { BossManager } from "../../src/core/BossManager"
import type { CcloverConfig } from "../../src/config/ConfigManager"

describe("BossManager", () => {
  describe("constructor", () => {
    test("should create boss manager with system boss without config", () => {
      const manager = new BossManager()
      expect(manager.getBosses()).toEqual(["cclover"])
    })

    test("should load bosses from config", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao", "alice"],
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.getBosses()).toHaveLength(3) // system boss + 2 config bosses
      expect(manager.getBosses()).toContain("cclover")
      expect(manager.getBosses()).toContain("bayecao")
      expect(manager.getBosses()).toContain("alice")
    })

    test("should handle config without bosses field", () => {
      const config: CcloverConfig = {
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.getBosses()).toEqual(["cclover"])
    })

    test("should handle empty bosses array", () => {
      const config: CcloverConfig = {
        bosses: [],
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.getBosses()).toEqual(["cclover"])
    })
  })

  describe("isBoss", () => {
    test("should return true for existing boss", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao", "alice"],
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.isBoss("bayecao")).toBe(true)
      expect(manager.isBoss("alice")).toBe(true)
    })

    test("should return false for non-existing boss", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao"],
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.isBoss("alice")).toBe(false)
      expect(manager.isBoss("bob")).toBe(false)
    })

    test("should return false when only system boss configured", () => {
      const manager = new BossManager()
      expect(manager.isBoss("anyone")).toBe(false)
      expect(manager.isBoss("cclover")).toBe(true) // system boss exists
    })

    test("should be case-sensitive", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao"],
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.isBoss("bayecao")).toBe(true)
      expect(manager.isBoss("Bayecao")).toBe(false)
      expect(manager.isBoss("BAYECAO")).toBe(false)
    })
  })

  describe("getBosses", () => {
    test("should return all boss names", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao", "alice", "bob"],
        projects: [],
      }
      const manager = new BossManager(config)
      const bosses = manager.getBosses()
      expect(bosses).toHaveLength(4) // system boss + 3 config bosses
      expect(bosses).toContain("cclover")
      expect(bosses).toContain("bayecao")
      expect(bosses).toContain("alice")
      expect(bosses).toContain("bob")
    })

    test("should return system boss when no config bosses", () => {
      const manager = new BossManager()
      expect(manager.getBosses()).toEqual(["cclover"])
    })

    test("should return copy of internal array", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao"],
        projects: [],
      }
      const manager = new BossManager(config)
      const bosses1 = manager.getBosses()
      const bosses2 = manager.getBosses()
      expect(bosses1).not.toBe(bosses2) // Different array instances
      expect(bosses1).toEqual(bosses2) // Same content
    })
  })

  describe("addBoss", () => {
    test("should add new boss", () => {
      const manager = new BossManager()
      expect(manager.isBoss("alice")).toBe(false)
      manager.addBoss("alice")
      expect(manager.isBoss("alice")).toBe(true)
      expect(manager.getBosses()).toContain("alice")
    })

    test("should not duplicate existing boss", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao"],
        projects: [],
      }
      const manager = new BossManager(config)
      manager.addBoss("bayecao")
      expect(manager.getBosses()).toHaveLength(2) // system boss + 1 config boss
    })

    test("should add multiple bosses", () => {
      const manager = new BossManager()
      manager.addBoss("alice")
      manager.addBoss("bob")
      manager.addBoss("charlie")
      expect(manager.getBosses()).toHaveLength(4) // system boss + 3 added bosses
    })
  })

  describe("removeBoss", () => {
    test("should remove existing boss", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao", "alice"],
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.isBoss("alice")).toBe(true)
      manager.removeBoss("alice")
      expect(manager.isBoss("alice")).toBe(false)
      expect(manager.getBosses()).toHaveLength(2) // system boss + 1 remaining config boss
    })

    test("should do nothing when removing non-existing boss", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao"],
        projects: [],
      }
      const manager = new BossManager(config)
      manager.removeBoss("alice")
      expect(manager.getBosses()).toHaveLength(2) // system boss + 1 config boss
    })

    test("should handle removing from manager with only system boss", () => {
      const manager = new BossManager()
      manager.removeBoss("anyone")
      expect(manager.getBosses()).toEqual(["cclover"])
    })

    test("should not allow removing system boss", () => {
      const manager = new BossManager()
      expect(manager.isBoss("cclover")).toBe(true)
      manager.removeBoss("cclover")
      expect(manager.isBoss("cclover")).toBe(true) // system boss cannot be removed
      expect(manager.getBosses()).toContain("cclover")
    })
  })
})
