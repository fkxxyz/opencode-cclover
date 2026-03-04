# OpenCode CClover Console - Requirements

## 1. Overview

### 1.1 Project Goal

Build a web-based management console for the OpenCode CClover multi-agent autonomous collaboration system. The console provides real-time monitoring of employee status, message communication, task execution, memory system, and event streams, with visualizations including hierarchical organization charts and detailed employee dashboards.

### 1.2 Project Positioning

- **Standalone Web Application**: Separated from the plugin, communicates via HTTP API and WebSocket
- **Real-time Monitoring System**: Displays real-time employee status and activities
- **Management Interface**: Supports debugging and operational features in future versions
- **Multi-Project Support**: Single console instance manages multiple projects through a global service

### 1.3 Core Features

- **Real-time Updates**: Receives event pushes via WebSocket, updates UI in real-time
- **Visualization**: Tree diagrams for hiring relationships, color-coded employee status
- **Comprehensive Monitoring**: Covers all employee dimensions (status, messages, tasks, memory, agents, events)
- **Responsive Design**: Adapts to different screen sizes
- **Project Management**: Sidebar for project switching, isolated workspaces per project

---

## 2. Technical Architecture

### 2.1 Technology Stack

**Frontend Framework**:

- React 18 + TypeScript
- Vite (build tool)
- Bun (package manager and runtime)

**UI Component Library**:

- shadcn/ui (based on Radix UI + Tailwind CSS)
- Tailwind CSS (styling framework)

**Visualization Library**:

- D3.js (tree diagrams and data visualization)

**Communication**:

- Fetch API (HTTP requests)
- WebSocket API (real-time event push)

### 2.2 Project Structure

```
console/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── dashboard/      # Dashbod components
│   │   ├── employee/       # Employee-related components
│   │   ├── visualizations/ # Visualization components (D3.js)
│   │   └── layout/         # Layout components (Sidebar, Layout)
│   ├── pages/              # Page components
│   │   ├── Overview.tsx    # Overview dashboard
│   │   └── EmployeeDetail.tsx  # Employee detail page
│   ├── contexts/           # React contexts
│   │   └── ProjectContext.tsx  # Project context for multi-project support
│   ├── hooks/              # Custom hooks
│   │   ├── useWebSocket.ts # WebSocket connection
│   │   ├── useEmployees.ts # Employee data management
│   │   ├── useProjects.ts  # Project list management
│   │   ├── useEvents.ts    # Event stream management
│   │   ├── useMessages.ts  # Message history management
│   │   ├── useStats.ts     # Statistics management
│   │   └── useTasks.ts     # Task management
│   ├── services/           # API services
│   │   ├── api.ts          # HTTP API wrapper
│   │   └── websocket.ts    # WebSocket client
│   ├── types/              # TypeScript type definitions
│   │   └── index.ts        # Shared types
│   ├── lib/                # Utility functions
│   │   └── utils.ts
│   ├── App.tsx             # Root component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
├── public/                 # Static assets
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── components.json         # shadcn/ui configuration
└── docs/
    └── requirements.md     # This document
```

### 2.3 Communication Architecture

```
┌─────────────────────────────────────────────────────────┐
│ GlobalServer (Singleton, Port 4097)                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ProjectRegistry                                     │ │
│ │ ├─ ProjectA: {stateManager, messageService, ...}   │ │
│ │ ├─ ProjectB: {stateManager, messageService, ...}   │ │
│ │ └─ ProjectC: {stateManager, messageService, ...}   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         ▲              ▲              ▲
         │              │              │
    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
    │ Plugin  │    │ Plugin  │    │ Plugin  │
    │Instance │    │Instance │    │Instance │
    │(ProjectA)│   │(ProjectB)│   │(ProjectC)│
    └─────────┘    └─────────┘    └─────────┘
         ▲              ▲              ▲
         │              │              │
         └──────────────┴──────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │  Web Console (React App)     │
         │  - HTTP API                  │
         │  - WebSocket (event stream)  │
         └──────────────────────────────┘
```

**HTTP API**:

- Get project list
- Get employee list (per project)
- Get employee details
- Get message history
- Get task list
- Get memory data
- Get agent execution records

**WebSocket**:

- Real-time push of employee status changes
- Real-time push of new messages
- Real-time push of task status changes
- Real-time push of event stream
- Events include `projectId` for filtering

---

## 3. Functional Requirements

### 3.1 Project Management

#### 3.1.1 Project Sidebar

**Description**:

- Display all registered projects in a sidebar
- Show project name and directory path
- Highlight currently selected project
- Click to switch between projects

**Visual Requirements**:

- **Sidebar Layout**:
  - Fixed width (e.g., 256px)
  - Scrollable if many projects
  - Header with "Projects" title
- **Project Item**:
  - Project name (bold)
  - Directory path (small, truncated)
  - Active state: blue background + left border
  - Hover state: light gray background
- **Interaction**:
  - Click to switch project
  - Smooth transition without page reload
  - All data updates automatically

#### 3.1.2 Project Context

**Description**:

- Global context managing current project state
- Automatically updates API client when project switches
- Filters WebSocket events by current project

**Implementation**:

- React Context API (`ProjectContext`)
- Custom hook (`useProjectContext`)
- Automatic dependency injection to all data hooks

### 3.2 Overview Dashboard

#### 3.2.1 Hiring Relationship Tree

**Description**:

- Use D3.js to render employee hiring relationship tree
- Nodes represent employees, edges represent hiring relationships
- Root node is the initial employee (e.g., Calculator)

**Visual Requirements**:

- **Node Style**:
  - Display employee name and role
  - Color-coded by employee status:
    - 🟢 Green: Active (processing tasks or messages)
    - 🟡 Yellow: Idle (waiting for events)
    - 🔴 Red: Error (execution failed or exception)
    - ⚪ Gray: Inactive
- **Interaction**:
  - Click node to navigate to employee detail page
  - Hover to show employee basic info (role, status, task count)
- **Layout**:
  - Auto-adjust tree layout to avoid node overlap
  - Support zoom and drag

#### 3.2.2 Global Statistics

**Display Content**:

- Total employees
- Active employees
- Pending tasks
- Today's message count

**Style**:

- Card-based display, clean and clear
- Large, prominent numbers with icons

#### 3.2.3 Real-time Event Stream

**Description**:

- Display recent system events (max 50)
- Event types: MessageEvent, TaskEvent, AgentEvent, TimerEvent
- Filtered by current project

**Display Content**:

- Event type
- Event time
- Related employee
- Event description

**Style**:

- List format, newest events at top
- Different colors for different event types

---

### 3.3 Employee Detail Page

#### 3.3.1 Employee Basic Info

**Display Content**:

- Employee name
- Role
- Current status (active/idle/error/inactive)
- Created time
- Last active time
- Hired by (if applicable)

**Style**:

- Top card display with status indicator

#### 3.3.2 Message Communication

**Description**:

- Display message history between this employee and others
- Support filtering by conversation partner

**Display Content**:

- Message time
- Sender/receiver
- Message content
- Message direction (sent/received)

**Style**:

- Chat interface style
- Sent messages align right, received messages align left
- Support scrolling to load historical messages

**Real-time Update**:

- Receive new messages via WebSocket and auto-append

#### 3.3.3 Task Management

**Description**:

- Display all tasks for this employee
- Visualize task dependencies (DAG)

**Display Content**:

- Task list:
  - Task name
  - Task status (pending/in_progress/completed/cancelled)
  - Task description
  - Created time
  - Completed time (if completed)
  - Dependencies
  - Task result (if completed)
- Task DAG diagram:
  - Rendered using D3.js or Mermaid
  - Nodes represent tasks, edges represent dependencies
  - Color-coded by task status

**Executable Task Highlight**:

- Mark tasks with satisfied dependencies that can be executed immediately

**Real-time Update**:

- Receive task status changes via WebSocket and update UI

#### 3.3.4 Memory System

**Description**:

- Display this employee's memory data

**Display Content**:

- **Knowledge**:
  - List format
  - One knowledge item per line
- **Custom Fields**:
  - JSON format
  - Support collapse/expand

**Style**:

- Code block or card display
- High readability

#### 3.3.5 Agent Execution

**Description**:

- Display agent execution records created by this employee

**Display Content**:

- Agent ID
- Associated task name
- Execution status (running/completed/failed)
- Created time
- Completed time (if completed)
- Execution result

**Style**:

- Table format
- Running agents with loading animation

**Real-time Update**:

- Receive agent status changes via WebSocket and update UI

#### 3.3.6 Event History

**Description**:

- Display all events related to this employee

**Display Content**:

- Event type
- Event time
- Event details

**Style**:

- Timeline format
- Support filtering by event type

---

## 4. Data Models

### 4.1 Project

```typescript
interface Project {
  projectId: string // Unique identifier (backend-generated)
  projectName: string // Project name (extracted from directory)
  directory: string // Project path
}
```

### 4.2 Employee

```typescript
interface Employee {
  name: string // Employee name (unique identifier)
  role: string // Role
  status: EmployeeStatus // Current status
  createdAt: string // Created time (ISO 8601)
  lastActiveAt: string // Last active time (ISO 8601)
  hiredBy?: string // Hired by (employee name)
}

type EmployeeStatus = "active" | "idle" | "error" | "inactive"
```

### 4.3 Message

```typescript
interface Message {
  timestamp: string // Message timestamp (ISO 8601)
  from: string // Sender name
  to: string // Receiver name
  content: string // Message content
  direction: "send" | "receive" // Message direction (relative to current employee)
}
```

### 4.4 Task

```typescript
interface Task {
  name: string // Task name (unique identifier)
  status: TaskStatus // Task status
  description: string // Task description
  result?: string // Task result (filled when completed)
  dependencies: string[] // Dependent task names
  created: string // Created time (ISO 8601)
  completed?: string // Completed time (ISO 8601)
}

type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled"
```

### 4.5 Memory

```typescript
interface Memory {
  knowledge: string[] // Experience knowledge
  custom: Record<string, any> // Custom fields
}
```

### 4.6 Agent Execution

```typescript
interface AgentExecution {
  agentId: string // Agent ID
  taskName: string // Associated task name
  status: "running" | "completed" | "failed"
  createdAt: string // Created time (ISO 8601)
  completedAt?: string // Completed time (ISO 8601)
  result?: string // Execution result
}
```

### 4.7 Event

```typescript
interface Event {
  projectId: string // Project identifier (for filtering)
  type: EventType // Event type
  timestamp: string // Event timestamp (ISO 8601)
  employeeName?: string // Related employee name
  details: Record<string, any> // Event details
}

type EventType =
  | "message" // Message event
  | "task_completed" // Task completed
  | "task_cancelled" // Task cancelled
  | "task_deleted" // Task deleted
  | "task_decomposed" // Task decomposed
  | "agent_completed" // Agent completed
  | "agent_failed" // Agent failed
  | "timer" // Timer event
  | "employee_hired" // Employee hired
  | "employee_status_changed" // Employee status changed
```

---

## 5. API Design

### 5.1 HTTP API

**Base URL**: `http://localhost:4097/api`

#### 5.1.1 Get Project List

```
GET /projects
```

**Response**:

```json
{
  "projects": [
    {
      "projectId": "proj_abc123",
      "projectName": "my-app",
      "directory": "/path/to/my-app"
    }
  ]
}
```

#### 5.1.2 Get Employee List

```
GET /projects/:projectId/employees
```

**Response**:

```json
{
  "employees": [
    {
      "name": "calculator",
      "role": "Calculator",
      "status": "idle",
      "createdAt": "2026-03-01T10:00:00Z",
      "lastActiveAt": "2026-03-01T10:05:00Z",
      "hiredBy": null
    }
  ]
}
```

#### 5.1.3 Get Employee Detail

```
GET /projects/:projectId/employees/:name
```

**Response**:

```json
{
  "name": "calculator",
  "role": "Calculator",
  "status": "idle",
  "createdAt": "2026-03-01T10:00:00Z",
  "lastActiveAt": "2026-03-01T10:05:00Z",
  "hiredBy": null,
  "memory": {
    "knowledge": ["alice often asks me math calculation questions"],
    "custom": {}
  },
  "tasks": [...],
  "agents": [...]
}
```

#### 5.1.4 Get Message History

```
GET /projects/:projectId/employees/:name/messages?peer=:peer&limit=:limit
```

**Parameters**:

- `peer` (optional): Conversation partner name
- `limit` (optional): Number of messages to return, default 50

**Response**:

```json
{
  "messages": [
    {
      "timestamp": "2026-03-01T10:00:00Z",
      "from": "alice",
      "to": "calculator",
      "content": "Calculate 1+1",
      "direction": "receive"
    }
  ]
}
```

#### 5.1.5 Get Task List

```
GET /projects/:projectId/employees/:name/tasks
```

**Response**:

```json
{
  "tasks": [
    {
      "name": "Calculate1+1",
      "status": "completed",
      "description": "Calculate 1+1 for alice",
      "result": "2",
      "dependencies": [],
      "created": "2026-03-01T10:00:00Z",
      "completed": "2026-03-01T10:00:05Z"
    }
  ],
  "executableTasks": ["Calculate3+4"]
}
```

#### 5.1.6 Get Event History

```
GET /projects/:projectId/events?limit=:limit&employeeName=:name
```

**Parameters**:

- `limit` (optional): Number of events to return, default 50
- `employeeName` (optional): Filter events for specific employee

**Response**:

```json
{
  "events": [
    {
      "projectId": "proj_abc123",
      "type": "message",
      "timestamp": "2026-03-01T10:00:00Z",
      "employeeName": "calculator",
      "details": {
        "from": "alice",
        "content": "Calculate 1+1"
      }
    }
  ]
}
```

#### 5.1.7 Get Hiring Hierarchy

```
GET /projects/:projectId/employees/hierarchy
```

**Response**:

```json
{
  "hierarchy": {
    "name": "calculator",
    "role": "Calculator",
    "status": "idle",
    "children": [
      {
        "name": "coder",
        "role": "Coder",
        "status": "active",
        "children": []
      }
    ]
  }
}
```

#### 5.1.8 Get Statistics

```
GET /projects/:projectId/stats
```

**Response**:

```json
{
  "totalEmployees": 5,
  "activeEmployees": 2,
  "pendingTasks": 8,
  "todayMessages": 42
}
```

### 5.2 WebSocket API

**Connection URL**: `ws://localhost:4097/ws`

#### 5.2.1 Connection

Client connects, server starts pushing events.

#### 5.2.2 Event Push

**Message Format**:

```json
{
  "type": "event",
  "data": {
    "projectId": "proj_abc123",
    "type": "message",
    "timestamp": "2026-03-01T10:00:00Z",
    "employeeName": "calculator",
    "details": {
      "from": "alice",
      "content": "Calculate 1+1"
    }
  }
}
```

**Event Types**:

- `employee_status_changed`: Employee status changed
- `message_received`: New message received
- `message_sent`: Message sent
- `task_updated`: Task status updated
- `agent_updated`: Agent status updated
- `employee_hired`: New employee hired

**Client-side Filtering**:

- Client filters events by `projectId` to show only current project's events
- WebSocket connection remains open when switching projects

---

## 6. Implementation Phases

### 6.1 Phase 1: Read-only Monitoring (Current)

**Goal**: Implement complete monitoring functionality without modification operations.

**Feature Checklist**:

- ✅ Overview Dashboard
  - ✅ Hiring relationship tree
  - ✅ Global statistics
  - ✅ Real-time event stream
- ✅ Employee Detail Page
  - ✅ Basic info
  - ✅ Message communication
  - ✅ Task management
  - ✅ Memory system
  - ✅ Agent execution
  - ✅ Event history
- ✅ Real-time updates (WebSocket)
- ✅ Responsive design
- ⏳ Multi-project support
  - ⏳ Project sidebar
  - ⏳ Project switching
  - ⏳ Project-scoped data

### 6.2 Phase 2: Modification and Debugging Support (Future)

**Goal**: Support operations on employee system through UI.

**Feature Checklist**:

- Send messages to employees
- Manually create/update/delete/decompose tasks
- Manually create agents
- Hire new employees
- Modify employee memory
- Pause/resume employees

---

## 7. Non-functional Requirements

### 7.1 Performance Requirements

- Page initial load time < 2 seconds
- WebSocket event processing latency < 100ms
- Tree diagram rendering time < 1 second (within 100 nodes)
- Support monitoring 50+ employees simultaneously
- Support 10+ projects simultaneously

### 7.2 Compatibility Requirements

- Support modern browsers (Chrome, Firefox, Safari, Edge)
- Minimum resolution: 1280x720

### 7.3 Maintainability Requirements

- Code follows TypeScript strict mode
- Component-based design, single responsibility
- Complete type definitions
- Clear directory structure

### 7.4 Scalability Requirements

- API design supports future feature extensions
- Component design supports theme switching
- Prepared for internationalization (i18n)

---

## 8. Development Standards

### 8.1 Code Style

- Use TypeScript strict mode
- Use double quotes, no semicolons (consistent with plugin project)
- Use Prettier for code formatting
- Use functional components + Hooks

### 8.2 Naming Conventions

- Components: PascalCase (e.g., `EmployeeDetail.tsx`)
- Functions/variables: camelCase (e.g., `fetchEmployees`)
- Types/interfaces: PascalCase (e.g., `Employee`, `Message`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)

### 8.3 Commit Conventions

Follow Conventional Commits format:

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Refactoring
- `style`: Style adjustments
- `docs`: Documentation updates
- `chore`: Build/tool configuration

---

## 9. Constraints

- Must communicate with plugin via HTTP API and WebSocket
- Single global HTTP service on port 4097
- Cannot modify plugin code directly
- Must handle multiple projects through ProjectRegistry

---

## 10. Assumptions

- Plugin provides complete HTTP API and WebSocket support
- Backend includes `projectId` in all Event objects
- Project list is available via `/api/projects` endpoint
- Users will manually configure projects in plugin configuration

---

## 11. Dependencies

- **Frontend Framework**: React 18, TypeScript
- **Build Tool**: Vite
- **Runtime**: Bun
- **UI Library**: shadcn/ui, Tailwind CSS
- **Visualization**: D3.js
- **Communication**: Fetch API, WebSocket API

---

## 12. References

- [Plugin Requirements](../../docs/requirements.md) - Plugin core functionality requirements
- [Plugin Architecture](../../docs/architecture.md) - Plugin architecture design
- [Multi-Project Migration](./Multi-Project-Migration.md) - Multi-project support migration guide
- [shadcn/ui Documentation](https://ui.shadcn.com/)
- [D3.js Documentation](https://d3js.org/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
