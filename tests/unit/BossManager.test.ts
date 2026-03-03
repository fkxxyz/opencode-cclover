import { describe, test, expect, beforeEach } from "bun:test"
import { BossManager } from "../../src/core/BossManager"
import type { CcloverConfig } from "../../src/config/ConfigManager"

describe("BossManager", () => {
  describe("constructor", () => {
    test("should create empty boss manager without config", () => {
      const manager = new BossManager()
      expect(manager.getBosses()).toEqual([])
    })

    test("should load bosses from config", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao", "alice"],
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.getBosses()).toHaveLength(2)
      expect(manager.getBosses()).toContain("bayecao")
      expect(manager.getBosses()).toContain("alice")
    })

    test("should handle config without bosses field", () => {
      const config: CcloverConfig = {
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.getBosses()).toEqual([])
    })

    test("should handle empty bosses array", () => {
      const config: CcloverConfig = {
        bosses: [],
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.getBosses()).toEqual([])
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

    test("should return false when no bosses configured", () => {
      const manager = new BossManager()
      expect(manager.isBoss("anyone")).toBe(false)
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
      expect(bosses).toHaveLength(3)
      expect(bosses).toContain("bayecao")
      expect(bosses).toContain("alice")
      expect(bosses).toContain("bob")
    })

    test("should return empty array when no bosses", () => {
      const manager = new BossManager()
      expect(manager.getBosses()).toEqual([])
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
      expect(manager.getBosses()).toHaveLength(1)
    })

    test("should add multiple bosses", () => {
      const manager = new BossManager()
      manager.addBoss("alice")
      manager.addBoss("bob")
      manager.addBoss("charlie")
      expect(manager.getBosses()).toHaveLength(3)
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
      expect(manager.getBosses()).toHaveLength(1)
    })

    test("should do nothing when removing non-existing boss", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao"],
        projects: [],
      }
      const manager = new BossManager(config)
      manager.removeBoss("alice")
      expect(manager.getBosses()).toHaveLength(1)
    })

    test("should handle removing from empty manager", () => {
      const manager = new BossManager()
      manager.removeBoss("anyone")
      expect(manager.getBosses()).toEqual([])
    })
  })
})
