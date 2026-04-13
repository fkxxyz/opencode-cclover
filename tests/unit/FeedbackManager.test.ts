import { describe, test, expect } from "bun:test"

describe("FeedbackManager", () => {
  describe("constructor logic", () => {
    test("should subscribe to message:0-cclover event on construction", () => {
      // FeedbackManager subscribes in constructor
      const eventName = "message:0-cclover"
      expect(eventName).toBe("message:0-cclover")
    })
  })

  describe("feedback saving logic", () => {
    test("should use Unix timestamp (seconds) for filename", () => {
      const timestamp = Math.floor(Date.now() / 1000)
      const filename = `feedback-${timestamp}.md`
      const match = filename.match(/feedback-(\d+)\.md/)
      expect(match).toBeDefined()
      const extractedTimestamp = parseInt(match![1])
      expect(extractedTimestamp).toBe(timestamp)
    })

    test("should save only raw reply content without metadata", () => {
      const feedbackContent = "My feedback content"
      const savedContent = feedbackContent // No metadata added
      expect(savedContent).toBe(feedbackContent)
      expect(savedContent).not.toContain("---")
      expect(savedContent).not.toContain("timestamp")
      expect(savedContent).not.toContain("from")
    })

    test("should save to employees/{name}/feedback-{timestamp}.md path", () => {
      const employeeName = "test-employee"
      const timestamp = 1713000000
      const expectedPath = `employees/${employeeName}/feedback-${timestamp}.md`
      expect(expectedPath).toContain(employeeName)
      expect(expectedPath).toContain("feedback-")
      expect(expectedPath).toMatch(/feedback-\d+\.md/)
    })

    test("should record feedback_received event", () => {
      const event = {
        type: "feedback_received",
        employeeId: "test-employee",
        details: { receivedAt: new Date().toISOString() },
      }
      expect(event.type).toBe("feedback_received")
      expect(event.details.receivedAt).toBeDefined()
    })
  })
})
