/**
 * VacationRegistry 单元测试
 */

import { describe, test, expect, beforeEach } from "bun:test"
import {
  vacationRegistry,
  type VacationEvent,
} from "../../src/utils/VacationRegistry"

describe("VacationRegistry", () => {
  beforeEach(() => {
    // 每个测试前清空注册表
    vacationRegistry.clear()
  })

  test("should add and get vacation event (FIFO)", () => {
    const event: VacationEvent = {
      type: "vacation_requested",
      employeeName: "dev-1",
      timestamp: "2024-01-01T00:00:00Z",
    }

    vacationRegistry.addVacationEvent("dev-1", event)

    const retrieved = vacationRegistry.getVacationEvent("dev-1")
    expect(retrieved).toEqual(event)
  })

  test("should return null for empty queue", () => {
    const event = vacationRegistry.getVacationEvent("dev-1")
    expect(event).toBeNull()
  })

  test("should return null for non-existent employee", () => {
    const event = vacationRegistry.getVacationEvent("unknown")
    expect(event).toBeNull()
  })

  test("should maintain FIFO order for multiple events", () => {
    const event1: VacationEvent = {
      type: "vacation_requested",
      employeeName: "dev-1",
      timestamp: "2024-01-01T00:00:00Z",
    }
    const event2: VacationEvent = {
      type: "vacation_requested",
      employeeName: "dev-1",
      timestamp: "2024-01-02T00:00:00Z",
    }
    const event3: VacationEvent = {
      type: "vacation_requested",
      employeeName: "dev-1",
      timestamp: "2024-01-03T00:00:00Z",
    }

    vacationRegistry.addVacationEvent("dev-1", event1)
    vacationRegistry.addVacationEvent("dev-1", event2)
    vacationRegistry.addVacationEvent("dev-1", event3)

    // 应该按照添加顺序返回
    expect(vacationRegistry.getVacationEvent("dev-1")).toEqual(event1)
    expect(vacationRegistry.getVacationEvent("dev-1")).toEqual(event2)
    expect(vacationRegistry.getVacationEvent("dev-1")).toEqual(event3)
    expect(vacationRegistry.getVacationEvent("dev-1")).toBeNull()
  })

  test("should maintain separate queues for different employees", () => {
    const event1: VacationEvent = {
      type: "vacation_requested",
      employeeName: "dev-1",
      timestamp: "2024-01-01T00:00:00Z",
    }
    const event2: VacationEvent = {
      type: "vacation_requested",
      employeeName: "dev-2",
      timestamp: "2024-01-02T00:00:00Z",
    }

    vacationRegistry.addVacationEvent("dev-1", event1)
    vacationRegistry.addVacationEvent("dev-2", event2)

    // 每个员工的队列应该独立
    expect(vacationRegistry.getVacationEvent("dev-1")).toEqual(event1)
    expect(vacationRegistry.getVacationEvent("dev-2")).toEqual(event2)
    expect(vacationRegistry.getVacationEvent("dev-1")).toBeNull()
    expect(vacationRegistry.getVacationEvent("dev-2")).toBeNull()
  })

  test("should clear specific employee queue", () => {
    const event1: VacationEvent = {
      type: "vacation_requested",
      employeeName: "dev-1",
      timestamp: "2024-01-01T00:00:00Z",
    }
    const event2: VacationEvent = {
      type: "vacation_requested",
      employeeName: "dev-2",
      timestamp: "2024-01-02T00:00:00Z",
    }

    vacationRegistry.addVacationEvent("dev-1", event1)
    vacationRegistry.addVacationEvent("dev-2", event2)

    vacationRegistry.clearVacationQueue("dev-1")

    // dev-1 的队列应该被清空
    expect(vacationRegistry.getVacationEvent("dev-1")).toBeNull()
    // dev-2 的队列应该不受影响
    expect(vacationRegistry.getVacationEvent("dev-2")).toEqual(event2)
  })

  test("should clear all queues", () => {
    const event1: VacationEvent = {
      type: "vacation_requested",
      employeeName: "dev-1",
      timestamp: "2024-01-01T00:00:00Z",
    }
    const event2: VacationEvent = {
      type: "vacation_requested",
      employeeName: "dev-2",
      timestamp: "2024-01-02T00:00:00Z",
    }

    vacationRegistry.addVacationEvent("dev-1", event1)
    vacationRegistry.addVacationEvent("dev-2", event2)

    vacationRegistry.clear()

    // 所有队列应该被清空
    expect(vacationRegistry.getVacationEvent("dev-1")).toBeNull()
    expect(vacationRegistry.getVacationEvent("dev-2")).toBeNull()
  })

  test("should handle clearing non-existent employee queue", () => {
    // 不应该抛出错误
    expect(() => {
      vacationRegistry.clearVacationQueue("unknown")
    }).not.toThrow()
  })

  test("should return null after queue becomes empty", () => {
    const event: VacationEvent = {
      type: "vacation_requested",
      employeeName: "dev-1",
      timestamp: "2024-01-01T00:00:00Z",
    }

    vacationRegistry.addVacationEvent("dev-1", event)
    vacationRegistry.getVacationEvent("dev-1") // 取出唯一的事件

    // 队列应该为空
    expect(vacationRegistry.getVacationEvent("dev-1")).toBeNull()
  })
})
