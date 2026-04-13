import { describe, test, expect } from "bun:test"
import { BossManager } from "../../src/core/BossManager"
import type { CcloverConfig } from "../../src/config/ConfigManager"

describe("BossManager - Feedback System (SYSTEM_BOSSES)", () => {
  describe("SYSTEM_BOSSES", () => {
    test("should include 'cclover' as system boss without config", () => {
      const manager = new BossManager()
      expect(manager.isBoss("cclover")).toBe(true)
    })

    test("should include 'cclover' in getBosses() without config", () => {
      const manager = new BossManager()
      const bosses = manager.getBosses()
      expect(bosses).toContain("cclover")
      expect(bosses).toHaveLength(1)
    })

    test("should include 'cclover' with config bosses", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao", "alice"],
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.isBoss("cclover")).toBe(true)
      expect(manager.getBosses()).toContain("cclover")
      expect(manager.getBosses()).toHaveLength(3)
    })

    test("should prioritize system boss check before config bosses", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao"],
        projects: [],
      }
      const manager = new BossManager(config)
      expect(manager.isBoss("cclover")).toBe(true)
    })

    test("should not allow removing system boss", () => {
      const manager = new BossManager()
      expect(manager.isBoss("cclover")).toBe(true)
      manager.removeBoss("cclover")
      expect(manager.isBoss("cclover")).toBe(true)
      expect(manager.getBosses()).toContain("cclover")
    })

    test("should list system bosses first in getBosses()", () => {
      const config: CcloverConfig = {
        bosses: ["bayecao", "alice"],
        projects: [],
      }
      const manager = new BossManager(config)
      const bosses = manager.getBosses()
      expect(bosses[0]).toBe("cclover")
    })

    test("should allow adding system boss to config list (creates duplicate)", () => {
      const manager = new BossManager()
      manager.addBoss("cclover")
      const bosses = manager.getBosses()
      // Implementation allows duplicates: SYSTEM_BOSSES + config bosses
      expect(bosses.filter((b) => b === "cclover")).toHaveLength(2)
    })
  })
})
