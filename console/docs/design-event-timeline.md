# Event Timeline Display Design

## Overview

This document describes the frontend design for displaying employee events in the Console. Events are embedded inline with chat messages in a unified timeline, similar to QQ group system messages.

**Module Purpose**: Provide visual representation of employee lifecycle events within the message timeline.

**Scope**: This design covers event display components, timeline merging logic, and styling.

## Requirements Summary

Based on backend event tracing design ([Backend Events Design](../../docs/design-events.md)):

1. **Display Location**: Embed events in employee detail page message timeline
2. **Visual Style**: Small gray text, center-aligned, similar to QQ group system messages
3. **Event Types**: Status changes, session lifecycle, agent lifecycle, task operations
4. **Data Source**: Merged timeline from `/api/projects/:projectId/employees/:employeeName/timeline`

## Visual Design

### Event Appearance

**Style Specifications**:

- Font size: 12px (smaller than messages)
- Color: #999 (gray)
- Alignment: Center
- Padding: 8px vertical
- Optional icon prefix
- Timestamp on hover

**Example**:

```
┌─────────────────────────────────────┐
│ [10:00:00] calculator → user        │
│ "Calculate 1+1"                     │
├─────────────────────────────────────┤
│     ⚡ Session created (ses_abc)    │  ← Event
├─────────────────────────────────────┤
│ [10:00:05] user → calculator        │
│ "Result: 2"                         │
└─────────────────────────────────────┘
```

### Event Icons

| Event Type              | Icon | Color  |
| ----------------------- | ---- | ------ |
| employee_status_changed | 🔄   | Gray   |
| session_created         | ⚡   | Blue   |
| session_summarized      | 📊   | Green  |
| employee_work_session_created           | 🤖   | Purple |
| employee_work_session_status_changed         | ✅   | Green  |
| task_created            | 📋   | Blue   |
| task_modified           | ✏️   | Orange |
| task_completed          | ✅   | Green  |
| task_waiting_for_message| 💬   | Blue   |
| task_cancelled          | ❌   | Red    |

### Event Descriptions

Concise, human-readable descriptions:

```typescript
const EVENT_DESCRIPTIONS = {
  employee_status_changed: (details) =>
    `Status: ${details.oldStatus} → ${details.newStatus}`,

  session_created: (details) =>
    `Session created (${details.sessionId.slice(0, 8)}...)`,

  session_summarized: (details) =>
    `Session summarized (${details.messageCount} messages, ${details.tokenCount} tokens)`,

  employee_work_session_created: (details) => `Agent created: ${details.taskName}`,

  employee_work_session_status_changed: (details) => `EmployeeWorkSession status changed: ${details.taskName}`,

  task_created: (details) => `Task created: ${details.taskName}`,

  task_modified: (details) => `Task modified: ${details.taskName}`,

  task_completed: (details) => `Task completed: ${details.taskName}`,

  task_waiting_for_message: (details) => `Task waiting for message: ${details.taskName} - ${details.reason}`,

  task_cancelled: (details) => `Task cancelled: ${details.taskName}`,
}
```

## Component Design

### TimelineItem Component

**Purpose**: Render a single timeline item (message or event)

**Location**: `src/components/employee/TimelineItem.tsx`

```typescript
interface TimelineItemProps {
  item: {
    type: 'message' | 'event'
    timestamp: string
    data: Message | Event
  }
}

export function TimelineItem({ item }: TimelineItemProps) {
  if (item.type === 'message') {
    return <MessageBubble message={item.data as Message} />
  }

  return <EventItem event={item.data as Event} />
}
```

### EventItem Component

**Purpose**: Render a single event in the timeline

**Location**: `src/components/employee/EventItem.tsx`

```typescript
interface EventItemProps {
  event: Event
}

export function EventItem({ event }: EventItemProps) {
  const icon = getEventIcon(eve  const description = getEventDescription(event)

  return (
    <div className="event-item">
      <Tooltip content={new Date(event.timestamp).toLocaleString()}>
        <div className="event-content">
          <span className="event-icon">{icon}</span>
          <span className="event-text">{description}</span>
        </div>
      </Tooltip>
    </div>
  )
}
```

**Styling** (`EventItem.module.css`):

```css
.event-item {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.event-content {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #999;
  cursor: default;n.event-icon {
  font-size: 14px;
}

.event-text {
  font-weight: 400;
}

.event-item:hover .event-content {
  color: #666;
}
```

### Timeline Component

**Purpose**: Display merged timeline of messages and events

**Location**: `src/components/employee/Timeline.tsx`

```typescript
interface TimelineProps {
  employeeName: string
}

export function Timeline({ employeeName }: TimelineProps) {
  const { timeline, loading, error } = useTimeline(employeeName)

  if (loading) return <Spinner />
  if (error) return <ErrorMessage error={error} />

  return (
    <div className="timeline">
      eline.map((item, index) =>
        <TimelineItem key={`${item.type}-${item.timestamp}-${index}`} item={item} />
      ))}
    </div>
  )
}
```

## Data Fetching

### useTimeline Hook

**Purpose**: Fetch and merge messages and events into unified timeline

**Location**: `src/hooks/useTimeline.ts`

```typescript
interface TimelineItem {
  type: "message" | "event"
  timestamp: string
  data: Message | Event
}

export function useTimeline(employeeName: string) {
  const { currentProject } = useProjectContext()
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Initial load
  useEffect(() => {
    if (!currentProject) return

    const fetchTimeline = async () => {
      try {
        setLoading(true)
        const response = await apiClient.getTimeline(
          currentProject.projectId,
          employeeName
        )
        setTimeline(response.items)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchTimeline()
  }, [currentProject, employeeName])

  // Real-time updates
  useWebSocket({
    onEvent: (event) => {
      if (event.employeeName === employeeName) {
        setTimeline((prev) =>
          [
            ...prev,
            {
              type: "event",
              timestamp: event.timestamp,
              data: event,
            },
          ].sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          )
        )
      }
    },
    onMessage: (message) => {
      if (message.from === employeeName || message.to === employeeName) {
        setTimeline((prev) =>
          [
            ...prev,
            {
              type: "message",
              timestamp: message.timestamp,
              data: message,
            },
          ].sort((a, b) =>
            new Date(a.timestamp).getTimee(b.timestamp).getTime()
          )
        )
      }
    },
  })

  return { timeline, loading, error }
}
```

### API Client Method

**Location**: `src/services/apiClient.ts`

```typescript
export class ApiClient {
  async getTimeline(
    projectId: string,
    employeeName: string
  ): Promise<{ items: TimelineItem[] }> {
    const response = await fetch(
      `${this.baseUrl}/api/projects/${projectId}/employees/${employeeName}/timeline`
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch timeline: ${response.statusText}`)
    }

    return response.json()
  }
}
```

## Backend API Endpoint

### Timeline Endpoint

**Endpoint**: `GET /api/projects/:projectId/employees/:employeeName/timeline`

**Query Parameters**:

- `limit` (optional): Maximum number of items to return (default: 100)
- `before` (optional): Return items before this timestamp (for pagination)

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

**Implementation** (`src/server/routes.ts`):

```typescript
{
  method: "GET",
  path: "/api/projects/:projectId/employees/:employeeName/timeline",
  handler: async (req, res, params) => {
    const { projectId, employeeName } = params
    const limit = parseInt(req.query.limit as string) || 100

    // Read messages
    const messages = await messageService.getHistory(employeeName)

    // Read events
    const events = await eventLogger.readRecent(employeeName, limit)

    // Merge and sort
    const timeline = [
      ...messages.map(msg => ({
        type: 'message' as const,
        timestamp: msg.timestamp,
        data: msg
      })),
      ...evet => ({
        type: 'event' as const,
        timestamp: evt.timestamp,
        data: evt
      }))
    ].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ).slice(-limit)

    res.json({ items: timeline })
  }
}
```

## Integration with Existing Components

### EmployeeDetail Page

**Location**: `src/pages/EmployeeDetail.tsx`

**Changes**:

- Replace `MessageList` with `Timeline` component
- Timeline includes both messages and events

**Before**:

```typescript
<EmployeeDetail>
  <MessageList employeeName={employeeName} />
</EmployeeDetail>
```

**After**:

```typescript
<EmployeeDetail>
  <Timeline employeeName={employeeName} />
</EmployeeDetail>
```

## Performance Considerations

### Virtual Scrolling

For timelines with 1000+ items, implement virtual scrolling:

```typescript
import { VirtualScroller } from '@/components/ui/VirtualScroller'

export function Timeline({ employeeName }: TimelineProps) {
  const { timeline } = useTimeline(employeeName)

  return (
    <VirtualScroller
      items={timeline}
      itemHeight={60} // Average height
      renderItem={(item) => <TimelineItem item={item} />}
    />
  )
}
```

###

For very large timelines, implement pagination:

```typescript
export function useTimeline(employeeName: string) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [hasMore, setHasMore] = useState(true)

  const loadMore = async () => {
    const oldestTimestamp = timeline[0]?.timestamp
    const response = await apiClient.getTimeline(projectId, employeeName, {
      before: oldestTimestamp,
    })

    setTimeline((prev) => [...response.items, ...prev])
    setHasMore(response.items.length > 0)
  }

  return { timeline, hasMore, loadMore }
}
```

## Testing Strategy

### Unit Tests

**Test File**: `tests/componentItem.test.tsx`

```typescript
describe('EventItem', () => {
  it('should render session_created event', () => {
    const event = {
      type: 'session_created',
      timestamp: '2026-03-03T10:00:00.000Z',
      employeeName: 'calculator',
      details: { sessionId: 'ses_abc123' }
    }

    render(<EventItem event={event} />)

    expect(screen.getByText(/Session created/)).toBeInTheDocument()
    expect(screen.getByText(/ses_abc/)).toBeInTheDocument()
  })

  it('should show timestamp on hover', async () => {
    // ... test tooltip
  })
})
```

### Integration Tests

**Test File**: `tests/integration/Timeline.test.tsx`

```typescript
describe("Timeline Integration", () => {
  it("should merge messages and events in chronological order", async () => {
    // Mock API response with mixed messages and events
    // Render Timeline
    // Verify items are in correct order
  })

  it("should update timeline on WebSocket event", async () => {
    // Render Timeline
    // Trigger WebSocket event
    // Verify new event appears in timeline
  })
})
```

## Future Enhancements

### Filtering

Allow users to filter timeline by type:

```typescript
<Timeline emploemployeeName}>
  <TimelineFilters
    showMessages={true}
    showEvents={true}
    eventTypes={['session_created', 'task_completed']}
  />
</Timeline>
```

### Event Details Modal

Click event to show detailed information:

```typescript
<EventItem
  event={event}
  onClick={() => setSelectedEvent(event)}
/>

<EventDetailsModal
  event={selectedEvent}
  onClose={() => setSelectedEvent(null)}
/>
```

### Export Timeline

Export timeline to JSON/CSV:

```typescript
<Timeline employeeName={employeeName}>
  <ExportButton
    format="json"
    onClick={() => exportTimeline(timeline)}
  />
</Timeline>
```

## References

- [Backend Events Design](../../docs/design-events.md)
- [Component Layer Design](./design-components.md)
- [State Management Design](./design-state-hooks.md)
- [API Client Design](./design-services.md)

---

**Version**: 1.0  
**Last Updated**: 2026-03-03  
**Status**: Design Document
