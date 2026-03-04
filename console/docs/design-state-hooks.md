# State Management and Custom Hooks Design

## Overview

This document describes the state management layer and custom hooks that manage data fetching, caching, and real-time updates in the Console frontend.

## Architecture Reference

Implements the State Management and Custom Hooks layers described in [Architecture - Frontend Modules](./architecture.md#frontend-modules).

## Project Context

**Interface**: [`src/contexts/ProjectContext.tsx`](../src/contexts/ProjectContext.tsx)

The `ProjectContext` manages global project selection state and synchronizes it with API and WebSocket clients.

### Creating Instance

```typescript
import { ProjectProvider } from './contexts/ProjectContext'

function App() {
  return (
    <ProjectProvider>
      {/* Your app */}
    </ProjectProvider>
  )
}
```

### Using Context

```typescript
import { useProjectContext } from "./contexts/ProjectContext"

function MyComponent() {
  const { projects, currentProject, setCurrentProject, loading, error } =
    useProjectContext()
  // ...
}
```

### Internal Design

**State Management**:

- `projects`: List of all projects (loaded on mount)
- `currentProject`: Currently selected project ID
- `loading`: Initial load state
- `error`: Error state for project loading

**Initialization Flow**:

1. Mount: Fetch projects from API
2. Auto-select first project if none selected
3. Update API and WebSocket clients with selected project

**Project Switching**:

- When `currentProject` changes, calls `apiClient.setProject()` and `wsClient.setProject()`
- This ensures all subsequent API calls and WebSocket events are scoped correctly

## Custom Hooks

### useWebSocket Hook

**Interface**: [`src/hooks/useWebSocket.ts`](../src/hooks/useWebSocket.ts)

Proviact-friendly interface to the WebSocket client.

**Usage**:

```typescript
import { useWebSocket } from "./hooks/useWebSocket"

function MyComponent() {
  const { isConnected, subscribe } = useWebSocket()

  useEffect(() => {
    const unsubscribe = subscribe("employee_status_changed", (event) => {
      console.log("Employee status changed:", event)
    })
    return unsubscribe
  }, [subscribe])
}
```

**Internal Design**:

**Connection Lifecycle**:

- Connects on mount
- Disconnects on unmount
- Tracks connection state in `isConnected`

**Subscription Pattern**:

- `subscribe(eventType, handler)` returns unsubscribe function
- Unsubscribe function removes handler from WebSocket client
- Memoized with `useCallback` to prevent unnecessary re-renders

### useEmployees Hook

**Interface**: [`src/hooks/useEmployees.ts`](../src/hooks/useEmployees.ts)

Manages employee list state with real-time updates.

**Usage**:

```typescript
import { useEmployees } from './hooks/useEmployees'

function EmployeeList() {
  const { employees, loading, error } = useEmployees()

  if (loading) return <Loading />
  if (error) return <Error error={error} />

  return <List items={employees} />
}
```

**Internal Design**:

**Data Loading**:

- Fetches employee list on mount
- Refetches when `currentProject` changes
- Sets `loading` state during fetch
- Captures errors in `error` state

**Real-time Updates**:

- Subscribes to `employee_status_changed` events
- Updates local state when event received
- Uses functional state update to avoid stale closures
- Unsubscribes on unmount

**State Update Logic**:

```typescript
setEmployees((prev) =>
  prev.map((emp) =>
    emp.name === employeeName
      ? { ...emp, status: newStatus, lastActiveAt: newTimestamp }
      : emp
  )
)
```

This pattern ensures:

- Immutable state updates
- Only affected employee is updated
- Other employees remain unchanged

### Similar Hooks

The following hooks follow the same pattern as `useEmployees`:

**useMessages** ([`src/hooks/useMessages.ts`](../src/hooks/useMessages.ts)):

- Fetches message history for an employee
- Subscribes to `message_sent` and `message_received` events
- Appends new messages to local state

**useTasks** ([`src/hooks/useTasks.ts`](../src/hooks/useTasks.ts)):

- Fetches task list for an employee
- Subscribes to `task_updated` events
- Updates task status and executable tasks

**useEvents** ([`src/hooks/useEvents.ts`](../src/hooks/useEvents.ts)):

- Fetches global event history
- Subscribes to all event types
- Prepends new events to local state (newest first)

**useStats** ([`src/hooks/useStats.ts`](../src/hooks/useStats.ts)):

- Fetches global statistics
- Polls every 5 seconds for updates
- No WebSocket subscription (statistics are computed on-demand)

---

**Version**: 1.0  
**Last Updated**: 2026-03-02  
**Status**: Living Document
