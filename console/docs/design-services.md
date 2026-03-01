# Services Layer Design

## Overview

The Services Layer handles all external communication with the backend, including HTTP API calls and WebSocket event streaming. This layer provides a clean abstraction for the rest of the application to interact with backend services.

## Architecture Reference

Implements the Services Layer described in [Architecture - Frontend Modules](./architecture.md#frontend-modules).

## API Client

**Interface**: [`src/services/api.ts`](../src/services/api.ts)

The `ApiClient` class provides a centralized HTTP client for all backend API interactions.

### Creating Instance

```typescript
import { ApiClient } from './services/api'

const apiClient = new ApiClient()
apiClient.setProject(projectId)
```

### Key Methods

- `setProject(projectId: string)`: Set current project scope
- `getProjects()`: Fetch all projects
- `getEmployees()`: Fetch employee list for current project
- `getEmployeeDetail(name: string)`: Fetch detailed employee information
- `getMessages(employeeName, peer?, limit?)`: Fetch message history
- `getTasks(employeeName)`: Fetch task list
- `getEvents(options?)`: Fetch event history
- `getHierarchy()`: Fetch employee hierarchy tree
- `getStats()`: Fetch global statistics
- `getCandidateProjects()`: Fetch candidate projects from workspace
- `addProject(name, path)`: Add new project
- `updateProject(path, updates)`: Update project settings
- `deleteProject(path)`: Delete project

### Internal Design

The API client uses two private methods for HTTP requests:

**GET requests** (`request<T>(endpoint)`):
- Constructs full URL from base URL and endpoint
- Parses JSON response
- Throws error if `success: false`
- Returns typed data

**POST requests** (`requestWithBody<T>(endpoint, method, body)`):
- Adds `Content-Type: application/json` header
- Serializes body to JSON
- Same error handling as GET

**Project Scoping**:

All employee/message/task/event endpoints require `currentProjectId`:
```typescript
if (!this.currentProjectId) {
  throw new Error("No project selected")
}
```

This ensures API calls are always scoped to the active project.

## WebSocket Client

**Interface**: [`src/services/websocket.ts`](../src/services/websocket.ts)

The `WebSocketClient` class manages real-time event streaming from the backend with automatic reconnection, heartbeat mechanism, and event filtering.

### Creating Instance

```typescript
import { WebSocketClient } from './services/websocket'

const wsClient = new WebSocketClient()
wsClient.setProject(projectId)
wsClient.connect()
```

### Key Methods

- `setProject(projectId: string)`: Set current project filter
- `connect()`: Establish WebSocket connection
- `disconnect()`: Close WebSocket connection
- `on(eventType, handler)`: Subscribe to event type
- `off(eventType, handler)`: Unsubscribe from event type

### Connection Information

- **WebSocket URL**: `ws://localhost:4097/ws`
- **Protocol**: WebSocket (RFC 6455)
- **Message Format**: JSON

### Connection Lifecycle

```
Client                                Server
  |                                     |
  |--- WebSocket Connection Request --->|
  |<-- Connection Established (101) ----|
  |                                     |
  |<-- Event Push (JSON message) -------|
  |<-- Event Push (JSON message) -------|
  |<-- Event Push (JSON message) -------|
  |                                     |
  |--- Ping (heartbeat) --------------->|
  |<-- Pong (heartbeat response) -------|
  |                                     |
  |--- Close (disconnect) -------------->|
  |<-- Close (confirm) -----------------|
```

### Internal Design

#### Connection Management

- Checks if already connected before creating new WebSocket
- Sets up event handlers: `onopen`, `onmessage`, `onerror`, `onclose`
- Starts heartbeat mechanism on connection
- Triggers reconnection on close

**Client Code Example**:
```typescript
const ws = new WebSocket("ws://localhost:4097/ws")

ws.onopen = () => {
  console.log("WebSocket connection established")
}

ws.onerror = (error) => {
  console.error("WebSocket error:", error)
}

ws.onclose = (event) => {
  console.log("WebSocket connection closed:", event.code, event.reason)
}
```

#### Heartbeat Mechanism

**Purpose**: Keep connection alive and detect disconnections

**Implementation**:
- Client sends Ping frame every 30 seconds
- Server responds with Pong frame immediately
- If no Pong received within 60 seconds, client considers connection dead and reconnects

**Client Code Example**:
```typescript
let pingInterval: NodeJS.Timeout

ws.onopen = () => {
  // Start heartbeat
  pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping()
    }
  }, 30000)
}

ws.onclose = () => {
  // Stop heartbeat
  clearInterval(pingInterval)
}
```

#### Reconnection Strategy

**Strategy**: Exponential backoff reconnection

**Implementation**:
- Exponential backoff: `delay = 1000 * 2^attempts`
- Maximum 10 reconnection attempts
- Resets attempt counter on successful connection

**Client Code Example**:
```typescript
let reconnectAttempts = 0
const maxReconnectAttempts = 10
const baseDelay = 1000 // 1 second

function connect() {
  const ws = new WebSocket("ws://localhost:4097/ws")
  
  ws.onopen = () => {
    reconnectAttempts = 0 // Reset reconnection counter
  }
  
  ws.onclose = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = baseDelay * Math.pow(2, reconnectAttempts)
      console.log(`Reconnecting in ${delay}ms...`)
      setTimeout(connect, delay)
      reconnectAttempts++
    } else {
      console.error("Max reconnection attempts reached, stopping reconnection")
    }
  }
}
```

#### Event Filtering

- All events include `projectId` field
- Client filters events to match `currentProjectId`
- Only matching events are dispatched to handlers

#### Event Handler Registry

- Uses `Map<EventType, Set<Handler>>` for O(1) lookup
- Supports multiple handlers per event type
- Handlers are called synchronously in registration order

### Message Format

#### Message Wrapper

All server-pushed messages follow a unified format:

```typescript
interface WebSocketMessage {
  type: "event"           // Message type (currently only event)
  data: Event             // Event data
}
```

#### Event Data Format

```typescript
interface Event {
  type: EventType             // Event type
  timestamp: string           // Event timestamp (ISO 8601)
  employeeName?: string       // Related employee name (optional)
  details: Record<string, any>  // Event details
}

type EventType = 
  | "message"                 // Message event
  | "task_completed"          // Task completed
  | "task_failed"             // Task failed
  | "agent_completed"         // Agent completed
  | "agent_failed"            // Agent failed
  | "timer"                   // Timer event
  | "employee_hired"          // Employee hired
  | "employee_status_changed" // Employee status changed
  | "message_sent"            // Message sent
  | "message_received"        // Message received
  | "task_updated"            // Task status updated
  | "agent_updated"           // Agent status updated
```

### Event Types

#### Message Event (`message`)

**Trigger**: When employee receives or sends a message

**Message Example**:
```json
{
  "type": "event",
  "data": {
    "type": "message",
    "timestamp": "2026-03-01T10:00:00.000Z",
    "employeeName": "calculator",
    "details": {
      "from": "alice",
      "to": "calculator",
      "content": "Calculate 1+1"
    }
  }
}
```

**details fields**:
- `from`: Sender name
- `to`: Receiver name
- `content`: Message content

#### Task Completed Event (`task_completed`)

**Trigger**: When employee completes a task

**Message Example**:
```json
{
  "type": "event",
  "data": {
    "type": "task_completed",
    "timestamp": "2026-03-01T10:00:05.000Z",
    "employeeName": "calculator",
    "details": {
      "taskName": "Calculate 1+1",
      "result": "2"
    }
  }
}
```

**details fields**:
- `taskName`: Task name
- `result`: Task result

#### Employee Status Changed Event (`employee_status_changed`)

**Trigger**: When employee status changes

**Message Example**:
```json
{
  "type": "event",
  "data": {
    "type": "employee_status_changed",
    "timestamp": "2026-03-01T10:00:00.000Z",
    "employeeName": "calculator",
    "details": {
      "oldStatus": "idle",
      "newStatus": "active"
    }
  }
}
```

**details fields**:
- `oldStatus`: Old status
- `newStatus`: New status

### Client Implementation Example

```typescript
class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private baseDelay = 1000
  private pingInterval: NodeJS.Timeout | null = null
  private eventHandlers: Map<EventType, (event: Event) => void> = new Map()

  connect() {
    this.ws = new WebSocket("ws://localhost:4097/ws")

    this.ws.onopen = () => {
      console.log("WebSocket connection established")
      this.reconnectAttempts = 0
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        if (message.type === "event") {
          this.handleEvent(message.data)
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error)
      }
    }

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error)
    }

    this.ws.onclose = () => {
      console.log("WebSocket connection closed")
      this.stopHeartbeat()
      this.reconnect()
    }
  }

  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping()
      }
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts)
      console.log(`Reconnecting in ${delay}ms...`)
      setTimeout(() => this.connect(), delay)
      this.reconnectAttempts++
    } else {
      console.error("Max reconnection attempts reached, stopping reconnection")
    }
  }

  private handleEvent(event: Event) {
    const handler = this.eventHandlers.get(event.type)
    if (handler) {
      handler(event)
    }
  }

  on(eventType: EventType, handler: (event: Event) => void) {
    this.eventHandlers.set(eventType, handler)
  }

  disconnect() {
    this.stopHeartbeat()
    this.ws?.close()
    this.ws = null
  }
}
```

### Server Implementation Notes

#### Bun.serve WebSocket Handling

```typescript
const clients = new Set<WebSocket>()

const server = Bun.serve({
  port: 4097,
  fetch(req, server) {
    const url = new URL(req.url)
    
    if (url.pathname === "/ws") {
      const success = server.upgrade(req)
      if (success) {
        return undefined
      }
      return new Response("WebSocket upgrade failed", { status: 500 })
    }
    
    return handleHttpRequest(req)
  },
  websocket: {
    open(ws) {
      console.log("WebSocket client connected")
      clients.add(ws)
    },
    message(ws, message) {
      console.log("Received message:", message)
    },
    close(ws) {
      console.log("WebSocket client disconnected")
      clients.delete(ws)
    },
  },
})

// Broadcast event to all clients
function broadcastEvent(event: Event) {
  const message: WebSocketMessage = {
    type: "event",
    data: event,
  }
  const json = JSON.stringify(message)
  
  for (const client of clients) {
    client.send(json)
  }
}
```

---

**Version**: 1.0  
**Last Updated**: 2026-03-02  
**Status**: Living Document
