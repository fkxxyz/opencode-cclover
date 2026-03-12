import { describe, it, expect, beforeEach } from "bun:test"
import { EventHistory } from "../../src/state/EventHistory"
import type { Event } from "../../src/types/index"

describe("EventHistory", () => {
  let history: EventHistory

  beforeEach(() => {
    history = new EventHistory()
  })

  describe("add", () => {
    it("should add event to history", () => {
      const event: Event = {
        type: "message",
        timestamp: "2026-03-01T10:00:00.000Z",
        employeeId: "0-alice",
        details: {
          from: "alice",
          to: "bob",
          content: "hello",
        },
      }

      history.add(event)
      expect(history.count()).toBe(1)
    })

    it("should add events in reverse order (newest first)", () => {
      const event1: Event = {
        type: "message",
        timestamp: "2026-03-01T10:00:00.000Z",
        employeeId: "0-alice",
        details: { from: "alice", to: "bob", content: "first" },
      }

      const event2: Event = {
        type: "message",
        timestamp: "2026-03-01T10:00:01.000Z",
        employeeId: "0-bob",
        details: { from: "bob", to: "alice", content: "second" },
      }

      history.add(event1)
      history.add(event2)

      const recent = history.getRecent(2)
      expect(recent[0].details.content).toBe("second")
      expect(recent[1].details.content).toBe("first")
    })

    it("should maintain max 1000 events", () => {
      for (let i = 0; i < 1100; i++) {
        const event: Event = {
          type: "message",
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          employeeId: "0-alice",
          details: { from: "alice", to: "bob", content: `msg${i}` },
        }
        history.add(event)
      }

      expect(history.count()).toBe(1000)
    })
  })

  describe("getRecent", () => {
    it("should return recent events", () => {
      for (let i = 0; i < 10; i++) {
        const event: Event = {
          type: "message",
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          employeeId: "0-alice",
          details: { from: "alice", to: "bob", content: `msg${i}` },
        }
        history.add(event)
      }

      const recent = history.getRecent(5)
      expect(recent.length).toBe(5)
    })

    it("should return all events if limit exceeds count", () => {
      for (let i = 0; i < 3; i++) {
        const event: Event = {
          type: "message",
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          employeeId: "0-alice",
          details: { from: "alice", to: "bob", content: `msg${i}` },
        }
        history.add(event)
      }

      const recent = history.getRecent(10)
      expect(recent.length).toBe(3)
    })

    it("should return empty array when no events", () => {
      const recent = history.getRecent(5)
      expect(recent.length).toBe(0)
    })
  })

  describe("getByEmployee", () => {
    it("should filter events by employee name", () => {
      const event1: Event = {
        type: "message",
        timestamp: "2026-03-01T10:00:00.000Z",
        employeeId: "0-alice",
        details: { from: "alice", to: "bob", content: "msg1" },
      }

      const event2: Event = {
        type: "message",
        timestamp: "2026-03-01T10:00:01.000Z",
        employeeId: "0-bob",
        details: { from: "bob", to: "alice", content: "msg2" },
      }

      const event3: Event = {
        type: "message",
        timestamp: "2026-03-01T10:00:02.000Z",
        employeeId: "0-alice",
        details: { from: "alice", to: "bob", content: "msg3" },
      }

      history.add(event1)
      history.add(event2)
      history.add(event3)

      const aliceEvents = history.getByEmployee("0-alice")
      expect(aliceEvents.length).toBe(2)
      expect(aliceEvents.every((e) => e.employeeId === "0-alice")).toBe(true)
    })

    it("should respect limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        const event: Event = {
          type: "message",
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          employeeId: "0-alice",
          details: { from: "alice", to: "bob", content: `msg${i}` },
        }
        history.add(event)
      }

      const aliceEvents = history.getByEmployee("0-alice", 5)
      expect(aliceEvents.length).toBe(5)
    })

    it("should return empty array for non-existent employee", () => {
      const events = history.getByEmployee("unknown")
      expect(events.length).toBe(0)
    })
  })

  describe("getByType", () => {
    it("should filter events by type", () => {
      const event1: Event = {
        type: "message",
        timestamp: "2026-03-01T10:00:00.000Z",
        employeeId: "0-alice",
        details: { from: "alice", to: "bob", content: "msg" },
      }

      const event2: Event = {
        type: "task_completed",
        timestamp: "2026-03-01T10:00:01.000Z",
        employeeId: "0-alice",
        details: { taskName: "task1", result: "done" },
      }

      const event3: Event = {
        type: "message",
        timestamp: "2026-03-01T10:00:02.000Z",
        employeeId: "0-bob",
        details: { from: "bob", to: "alice", content: "msg2" },
      }

      history.add(event1)
      history.add(event2)
      history.add(event3)

      const messageEvents = history.getByType("message")
      expect(messageEvents.length).toBe(2)
      expect(messageEvents.every((e) => e.type === "message")).toBe(true)

      const taskEvents = history.getByType("task_completed")
      expect(taskEvents.length).toBe(1)
      expect(taskEvents[0].type).toBe("task_completed")
    })

    it("should respect limit parameter", () => {
      for (let i = 0; i < 10; i++) {
        const event: Event = {
          type: "message",
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          employeeId: "0-alice",
          details: { from: "alice", to: "bob", content: `msg${i}` },
        }
        history.add(event)
      }

      const messageEvents = history.getByType("message", 5)
      expect(messageEvents.length).toBe(5)
    })

    it("should return empty array for non-existent type", () => {
      const events = history.getByType("message")
      expect(events.length).toBe(0)
    })
  })

  describe("getAll", () => {
    it("should return all events", () => {
      for (let i = 0; i < 5; i++) {
        const event: Event = {
          type: "message",
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          employeeId: "0-alice",
          details: { from: "alice", to: "bob", content: `msg${i}` },
        }
        history.add(event)
      }

      const all = history.getAll()
      expect(all.length).toBe(5)
    })

    it("should return empty array when no events", () => {
      const all = history.getAll()
      expect(all.length).toBe(0)
    })
  })

  describe("clear", () => {
    it("should clear all events", () => {
      for (let i = 0; i < 5; i++) {
        const event: Event = {
          type: "message",
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          employeeId: "0-alice",
          details: { from: "alice", to: "bob", content: `msg${i}` },
        }
        history.add(event)
      }

      expect(history.count()).toBe(5)
      history.clear()
      expect(history.count()).toBe(0)
    })
  })

  describe("count", () => {
    it("should return correct event count", () => {
      expect(history.count()).toBe(0)

      for (let i = 0; i < 5; i++) {
        const event: Event = {
          type: "message",
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
          employeeId: "0-alice",
          details: { from: "alice", to: "bob", content: `msg${i}` },
        }
        history.add(event)
      }

      expect(history.count()).toBe(5)
    })
  })
})
