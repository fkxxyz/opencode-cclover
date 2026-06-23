# Event Tracing System Design

## Overview

This document describes the design of the event tracing system for employee activity tracking. The system records all key events in an employee's lifecycle, enabling complete traceability of employee actions, session management, agent creation, and task operations.

**Module Purpose**: Provide comprehensive event logging for employee activities with persistent storage and timeline visualization.

**Scope**: This design covers event types, storage format, persistence mechanism, and integration with existing components.

## Requirements Summary

Based on brainstorming session (2026-03-03):

1. **Event Types**: Record key events including:
   - Employee status changes (idle → active → error)
   - Session lifecycle (create, summarize)
   - Agent lifecycle (create, complete)
   - Task operations (create, modify, complete)

2. **Storage Format**: JSONL (JSON Lines) format
   - Path: `employees/{name}/events.jsonl`
   - One JSON object per line
   - Supports `tail -n 5` for quick viewing

3. **Session Tracking**: Record session ID and timestamps
   - Session create: session ID + creation time
   - Session summarize: session ID + summarize time (equivalent to close)

4. **Console Display**: Embed events in chat timeline
   - Display as small gray text (like QQ group system messages)
   - Mixed with message history
   - Concise descriptions

## Event Types

Current backend event payloads use stable IDs:

```typescript
{
  projectId: "project-id",
  type: "employee_work_session_created",
  timestamp: "2026-03-03T10:00:00.000Z",
  employeeId: "emp_xxx",
  employeeWorkSessionId: "ews_xxx",
  details: {}
}
```

Event APIs support `employeeId`, `employeeWorkSessionId`, `type`, and `limit`. EWS TODO events use the `task_*` event names.

### 1. Employee Status Changed

Records employee status transitions.

```typescript
{
  type: "employee_status_changed",
  timestamp: "2026-03-03T10:00:00.000Z",
  employeeName: "calculator",
  details: {
    oldStatus: "idle",
    newStatus: "active"
  }
}
```

**Trigger**: When `EventLoop` updates employee status (idle/active/error)

### 2. Session Created

Records session creation.

```typescript
{
  type: "session_created",
  timestamp: "2026-03-03T10:00:00.000Z",
  employeeName: "calculator",
  details: {
    sessionId: "ses_abc123"
  }
}
```

**Trigger**: When `EventLoop.ensureSession()` creates new session

### 3. Session Summarized

Records session summarization (equivalent to close).

```typescript
{
  type: "session_summarized",
  timestamp: "2026-03-03T10:30:00.000Z",
  employeeName: "calculator",
  details: {
    sessionId: "ses_abc123",
    messageCount: 15,
    tokenCount: 85000
  }
}
```

**Trigger**: When `EventLoop.summarizeIfNeeded()` triggers summarization

### 4. EmployeeWorkSession Created

Records EmployeeWorkSession creation.

```typescript
{
  type: "employee_work_session_created",
  timestamp: "2026-03-03T10:05:00.000Z",
  employeeName: "calculator",
  details: {
    employeeWorkSessionId: "ews_def456",
    taskName: "ComplexCalculation"
  }
}
```

**Trigger**: When `create_employee_work_session` creates a new EmployeeWorkSession

### 5. EmployeeWorkSession Status Changed

Records EmployeeWorkSession status changes.

```typescript
{
  type: "employee_work_session_status_changed",
  timestamp: "2026-03-03T10:10:00.000Z",
  employeeName: "calculator",
  details: {
    employeeWorkSessionId: "ews_def456",
    taskName: "ComplexCalculation",
    result: "Calculation completed successfully"
  }
}
```

**Trigger**: When EmployeeWorkSession runtime status changes

### 6. Task Created

Records task creation.

```typescript
{
  type: "task_created",
  timestamp: "2026-03-03T10:00:00.000Z",
  employeeName: "calculator",
  details: {
    taskName: "Task1",
    description: "Calculate complex formula"
  }
}
```

**Trigger**: When `MemoryManager.addTask()` adds new task

### 7. Task Modified

Records task modifications.

```typescript
{
  type: "task_modified",
  timestamp: "2026-03-03T10:05:00.000Z",
  employeeName: "calculator",
  details: {
    taskName: "Task1",
    changes: {
      status: "in_progress",
      description: "Updated description"
    }
  }
}
```

**Trigger**: When `MemoryManager.updateTask()` modifies task (excluding status changes to completed/cancelled)

### 8. Task Completed

Records task completion.

```typescript
{
  type: "task_completed",
  timestamp: "2026-03-03T10:10:00.000Z",
  employeeName: "calculator",
  details: {
    taskName: "Task1",
    result: "Formula calculated: result = 42"
  }
}
```

**Trigger**: When `MemoryManager.updateTask()` changes status to "completed"

### 9. Task Cancelled

Records task cancellation.

```typescript
{
  type: "task_cancelled",
  timestamp: "2026-03-03T10:15:00.000Z",
  employeeName: "calculator",
  details: {
    taskName: "Task2",
    reason: "No longer needed"
  }
}
```

**Trigger**: When `MemoryManager.updateTask()` changes status to "cancelled"

### 10. Task Waiting for Message

Records task waiting for messages from other employees.

```typescript
{
  type: "task_waiting_for_message",
  timestamp: "2026-03-03T10:16:00.000Z",
  employeeName: "calculator",
  details: {
    taskName: "Task3",
    reason: "Waiting for user's decision on calculation method"
  }
}
```

**Trigger**: When `MemoryManager.updateTask()` changes status to "waiting_for_message"

### 11. Task Deleted

Records task deletion with dependency cleanup.

```typescript
{
  type: "task_deleted",
  timestamp: "2026-03-03T10:20:00.000Z",
  employeeName: "calculator",
  details: {
    taskName: "Task3",
    affectedTasks: ["Task4", "Task5"],
    affectedCount: 2
  }
}
```

**Trigger**: When `MemoryManager.deleteTaskWithCleanup()` deletes task

### 12. Task Decomposed

Records task decomposition into subtasks.

```typescript
{
  type: "task_decomposed",
  timestamp: "2026-03-03T10:25:00.000Z",
  employeeName: "calculator",
  details: {
    originalTask: "ComplexTask",
    subtasks: ["Subtask1", "Subtask2", "Subtask3"],
    subtaskCount: 3
  }
}
```

**Trigger**: When `MemoryManager.decomposeTask()` breaks down task

### 13. Major Task Completed

Records completion of major tasks that trigger feedback collection.

```typescript
{
  type: "major_task_completed",
  timestamp: "2026-03-03T10:30:00.000Z",
  employeeName: "developer",
  details: {
    taskName: "ImplementFeatureX",
    result: "Feature X implemented successfully"
  }
}
```

**Trigger**: When a major task is completed and feedback collection should be initiated

### 14. Survey Sent

Records when a feedback survey is sent to an employee.

```typescript
{
  type: "survey_sent",
  timestamp: "2026-03-03T10:35:00.000Z",
  employeeName: "developer",
  details: {
    surveyId: "survey_123",
    taskName: "ImplementFeatureX",
    questions: ["How satisfied are you with the task?", "Any suggestions?"]
  }
}
```

**Trigger**: When feedback system sends a survey to an employee after major task completion

### 15. Feedback Received

Records when feedback is received from an employee.

```typescript
{
  type: "feedback_received",
  timestamp: "2026-03-03T10:40:00.000Z",
  employeeName: "developer",
  details: {
    surveyId: "survey_123",
    taskName: "ImplementFeatureX",
    responses: {
      "satisfaction": 4,
      "suggestions": "Task was clear and well-defined"
    }
  }
}
```

**Trigger**: When an employee submits feedback responses

## Storage Design

### File Format

**Format**: JSONL (JSON Lines)

- Each line is a complete JSON object
- No commas between lines
- Easy to append, tail, grep

**File Path**: `{workspaceRoot}/employees/{employeeName}/events.jsonl`

**Example File**:

```jsonl
{"type":"employee_status_changed","timestamp":"2026-03-03T10:00:00.000Z","employeeName":"calculator","details":{"oldStatus":"idle","newStatus":"active"}}
{"type":"session_created","timestamp":"2026-03-03T10:00:01.000Z","employeeName":"calculator","d:{"sessionId":"ses_abc123"}}
{"type":"task_created","timestamp":"2026-03-03T10:00:05.000Z","employeeName":"calculator","details":{"taskName":"Task1","description":"Calculate formula"}}
{"type":"task_completed","timestamp":"2026-03-03T10:10:00.000Z","employeeName":"calculator","details":{"taskName":"Task1","result":"Result: 42"}}
{"type":"session_summarized","timestamp":"2026-03-03T10:30:00.000Z","employeeName":"calculator","details":{"sessionId":"ses_abc123","messageCount":15,"tokenCount":85000}}
```

### File OperAppend Operation\*\*:

```typescript
// Append single event
await fs.appendFile(eventFilePath, JSON.stringify(event) + "\n", "utf-8")
```

**Read Operations**:

```bash
# View last 5 events
tail -n 5 employees/calculator/events.jsonl

# View all events
cat employees/calculator/events.jsonl

# Filter by event type
grep '"type":"session_created"' employees/calculator/events.jsonl

# Count events
wc -l employees/calculator/events.jsonl
```

### File Locking

**Strategy**: Use `proper-lockfile` for concurrent write safety

```typescript
import * as lockfile from "proper-lockfile"

const release = await lock(eventFilePath, {
  retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
  stale: 5000,
})

try {
  await fs.appendFile(eventFilePath, JSON.stringify(event) + "\n", "utf-8")
} finally {
  await release()
}
```

## Implementation Design

### EventLogger Class

New class to handle event logging.

**Location**: `src/state/EventLogger.ts`

```typescript
export class EventLogger {
  constructor(
    private workspaceRoot: string,
    private employeeName: string
  ) {}

  /**
   * Log event to JSONL file
   */
  async log(event: Omit<Event, "employeeName">): Promise<void> {
    const fullEvent = {
      ...event,
      employeeName: this.employeeName,
    }

    const eventFilePath = this.getEventFilePath()

    // Ensure directory exists
    await fs.mkdir(path.dirname(eventFilePath), { recursive: true })

    // Acquire lock and append
    const release = await lockfile.lock(eventFilePath, {
      retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
      stale: 5000,
    })

    try {
      await fs.appendFile(
        eventFilePath,
        JSON.stringify(fullEvent) + "\n",
        "utf-8"
      )
    } finally {
      await release()
    }
  }

  /**
   * Read recent events
   */
  async readRecent(limit: number = 50): Promise<Event[]> {
    const eventFilePath = this.getEventFilePath()

    try {
      const content = await fs.readFile(eventFilePath, "utf-8")
      const lines = content.trim().split("\n")
      const events = lines.slice(-limit).map((line) => JSON.parse(line))
      return events
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return []
      }
      throw error
    }
  }

  private getEventFilePath(): string {
    return path.join(
      this.workspaceRoot,
      "employees",
      this.employeeName,
      "events.jsonl"
    )
  }
}
```

### Integration Points

#### 1. StateManager Integration

Add EventLogger to StateManager:

```typescript
export class StateManager {
  private eventLoggers: Map<string, EventLogger> = new Map()

  private getEventLogger(employeeName: string): EventLogger {
    if (!this.eventLoggers.has(employeeName)) {
      this.eventLoggers.set(
        employeeName,
        new EventLogger(this.workspaceRoot, employeeName)
      )
    }
    return this.eventLoggers.get(employeeName)!
  }

  async addEvent(event: Event): Promise<void> {
    // Existing in-memory logic
    this.eventHistory.add(event)

    // NEW: Persist to file
    if (event.employeeName) {
      const logger = this.getEventLogger(event.employeeName)
      await logger.log(event)
```

#### 2. EventLoop Integration

Add event logging for session lifecycle:

```typescript
// In ensureSession()
private async ensureSession(): Promise<SessionInfo> {
  if (this.currentSession) {
    return this.currentSession
  }

  const response = await this.opcodeClient.session.create({...})
  const sessionId = response.data?.id

  // NEW: Log session creation
  this.stateManager?.addEvent({
    projectId: this.projectId,
    type: "session_created",
    timestamp: new Date().toISOString(),
    employeeName: this.employeeName,
    details: { sessionId }
  })

  // ... rest of logic
}

// In marizeIfNeeded()
private async summarizeIfNeeded(): Promise<void> {
  // ... threshold check logic

  if (threshold reached) {
    // ... summarization logic

    // NEW: Log session summarization
    this.stateManager?.addEvent({
      projectId: this.projectId,
      type: "session_summarized",
      timestamp: new Date().toISOString(),
      employeeName: this.employeeName,
      details: {
        sessionId: this.currentSession.id,
        messageCount: this.currentSession.messageCount,
        tokenCount
      }
    })

    await this.closeSession()
  }
}
```

#### 3. EmployeeWorkSession Tool Integration

Add event logging for EmployeeWorkSession creation:

```typescript
// In create_employee_work_session execute()
async execute(args, context) {
  // ... create EmployeeWorkSession logic
  const sessionId = response.data?.id

  // NEW: Log EmployeeWorkSession creation
  this.stateManager?.addEvent({
    projectId: this.projectId,
    type: "employee_work_session_created",
    timestamp: new Date().toISOString(),
    employeeName: employeeName,
    details: {
      employeeWorkSessionId,
      taskName: args.task_name
    }
  })

  // ... rest of logic
}
```

#### 4. MemoryManager Integration

Add event logging for task operations:

```typescript
// In addTask()
async addTask(employeeName: string, task: Omit<Task, "created">): Promise<void> {
  // ... existing logic

  // NEW: Log task creation
  this.stateManager?.addEvent({
    projectId: this.projectId,
    type: "task_created",
    timestamp: new Date().toISOString(),
    employeeName,
    details: {
      taskName: task.name,
      description: task.description
    }
  })
}

// In updateTask()
async updateTask(employeeName: string, taskName: string, updates: Partial<Task>): Promise<void> {
  // ... existing logic

  // NEW: Log task modification (if not status change to completed/cancelled)
  if (updates.status !== "completed" && updates.status !== "cancelled") {
    this.stateManager?.addEvent({
      projectId: this.projectId,
      type: "task_modified",
      timestamp: new Date().toISOString(),
      employeeName,
      details: {
        taskName,
        changes: updates
      }
    })
  }

  // Existing task_completed/task_cancelled events remain unchanged
}
```

## Console Display Design

### Timeline Integration

Events are displayed inline with messages in the employee detail page.

**Visual Design**:

- Small gray text (12px, #999)
- Center-aligned
- Icon prefix (optional)
- Timestamp on hover

**Example Layout**:

```
┌─────────────────────────────────────┐
│ [10:00:00] calculator → user        │
│ "Calculate 1+1"                     │
├─────────────────────────────────────┤
│     ⚡ Session created (ses_abc)    │  ← Event (gray, small)
├─────────────────────────────────────┤
│ [10:00:05] user → calculator        │
│ "Result: 2"                         │
├─────────────────────────────────────┤
│     📋 Task created: Task1          │  ← Event (gray, small)
├─────────────────────────────────────┤
│ [10:10:00] calculator → user        │
│ "Task completed"                    │
├──────────────────────────┤
│     ✅ Task completed: Task1        │  ← Event (gray, small)
└─────────────────────────────────────┘
```

### Event Descriptions

Concise descriptions for each event type:

| Event Type              | Description Template                                                |
| ----------------------- | ------------------------------------------------------------------- |
| employee_status_changed | `Status: {oldStatus} → {newStatus}`                                 |
| session_created         | `Session created ({sessionId})`                                     |
| session_summarized      | `Session summarized ({messageCount} messages, {tokenCount} tokens)` |
| employee_work_session_created           | `EmployeeWorkSession created: {taskName}`                           |
| employee_work_session_status_changed         | `EmployeeWorkSession status changed: {taskName}`                    |
| task_created            | `Task created: {taskName}`                                          |
| task_modified           | `Task modified: {taskName}`                                         |
| task_completed          | `Task completed: {taskName}`                                        |
| task_cancelled          | `Task cancelled: {taskName}`                                        |
| task_waiting_for_message| `Task waiting for message: {taskName} - {reason}`                   |
| task_deleted            | `Task deleted: {taskName}`                                          |
| task_decomposed         | `Task decomposed: {originalTask} → {subtaskCount} subtasks`         |
| major_task_completed    | `Major task completed: {taskName}`                                  |
| survey_sent             | `Survey sent: {taskName}`                                           |
| feedback_received       | `Feedback received: {taskName}`                                     |

### API Endpoint

**Endpoint**: `GET /api/projects/:projectId/employees/:employeeName/timeline`

**Response**:

```typescript
{
  items: Array<{
    type: "message" | "event"
    timestamp: string
    data: Message | Event
  }>
}
```

**Implementation**: Merge messages and events, sort by timestamp

## Testing Strategy

### Unit Tests

**Test File**: `tests/unit/EventLogger.test.ts`

```typescript
describe('EventLogger', () => {
  it('should log event to JSONL file', async () => n    const logger = new EventLogger(workspaceRoot, 'calculator')
    await logger.log({
      type: 'session_created',
      timestamp: '2026-03-03T10:00:00.000Z',
      details: { sessionId: 'ses_abc' }
    })

    const content = await fs.readFile(eventFilePath, 'utf-8')
    expect(content).toContain('"type":"session_created"')
  })

  it('should read recent events', async () => {
    // ... test readRecent()
  })

  it('should handle concurrent writes', async () => {
    // ... test file locking
  })
})
```

### Integration Tests

**Test File**: `tests/integration/EventTracing.integration.test.ts`

```typescript
describe("Event Tracing Integration", () => {
  it("should log session lifecycle events", async () => {
    // Create EventLoop, trigger session creation
    // Verify session_created event logged
    // Trigger summarization
    // Verify session_summarized event logged
  })

  it("should log task lifecycle events", async () => {
    // Add task via MemoryManager
    // Verify task_created event logged
    // Update task
    // Verify task_modified event logged
    // Complete task
    // Verify task_completed event logged
  })
})
```

### Manual Testing

```bash
# Start test server
./start-test-server.sh

# Trigger employee actions
# ...

# View events
tail -n 20 workspace_test/.cclover/workspace/employees/calculator/events.jsonl

# Filter by type
grep '"type":"session_created"' workspace_test/.cclover/workspace/employees/calculator/events.jsonl
```

## Performance Considerations

### File Size Management

**Problem**: s grow indefinitely

**Solutions** (Future):

1. **Log Rotation**: Rotate files when size exceeds threshold (e.g., 10MB)
2. **Archiving**: Move old events to archive files
3. **Compression**: Compress archived files

### Concurrent Writes

**Problem**: Multiple events logged simultaneously

**Solution**: File locking with `proper-lockfile`

- Retry mechanism (5 retries, 100-1000ms timeout)
- Stale lock detection (5 seconds)

### Read Performance

**Problem**: Reading large JSONL files

**Solutions**:

1. **Tail Reading**: Only read last N lines for recent events
2. **Streaming**: Use streaming for large file processing
3. **Indexing**: Build index file for fast lookups (future)

## Implementation Checklist

- [ ] Create `EventLogger` class
- [ ] Add event types to `types/index.ts`
- [ ] Integrate with `StateManager`
- [ ] Add session events to `EventLoop`
- [ ] Add EmployeeWorkSession events to runtime tools
- [ ] Add task events to `MemoryManager`
- [ ] Create API endpoint for timeline
- [ ] Update Console to display events
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update documentation

## References

- [StateManager Design](./design-state-manager.md)
- [EventLoop Design](./design-event-loop.md)
- [MemoryManager Design](./design-memory-manager.md)
- [Tool System Design](./design-tools.md)
- [Console Design](../console/docs/design-event-timeline.md)

---

**Version**: 1.0  
**Last Updated**: 2026-03-03  
**Status**: Design Document
