# File Structure

Console module file structure documentation.

## Directory Tree

console/

- docs/ - Documentation directory
  - structure.md - This file
  - requirements.md - Console requirements
  - architecture.md - Console architecture
  - design.md - Main design document (entry point)
  - design-services.md - Services layer design (API + WebSocket)
  - design-state-hooks.md - State management and custom hooks design
  - design-components.md - Component layer design
  - design-patterns.md - Integration patterns and optimization
  - design-testing.md - Testing strategy
- src/ - Frontend source code (implemented)
- server/ - Backend server (implemented via OpenCode plugin)
- package.json - Dependencies and scripts
- tsconfig.json - TypeScript configuration
- vite.config.ts - Vite configuration
- README.md - Console README

## Custom Folders

- docs/: Console documentation (requirements, architecture, design, testing)
- src/: Frontend source code (React + TypeScript + Vite)
- server/: Backend server (Bun + HTTP + WebSocket)

Note: Frontend (src/) is fully implemented. Backend is provided by the OpenCode plugin's GlobalServer.

## Implementation Status

### Frontend (src/)

✅ **Fully Implemented**

**Pages**:

- Overview.tsx - Main dashboard with global stats, hierarchy tree, employee list, and event stream
- EmployeeDetail.tsx - Detailed employee dashboard with tabs (messages, tasks, memory, agents, events)
- ProjectManagement.tsx - Project switching interface

**Components**:

- dashboard/ - GlobalStats, EventStream
- employee/ - EmployeeCard, MessageList, TaskList, MemoryView, AgentList, EventTimeline
- visualizations/ - HierarchyTree (D3.js), TaskDAG (D3.js)
- layout/ - Layout, Sidebar
- ui/ - Base UI components (shadcn/ui)

**Services**:

- api.ts - HTTP API client
- websocket.ts - WebSocket client for real-time updates

**Hooks**:

- useEmployees.ts - Employee data management
- useMessages.ts - Message history management
- useTasks.ts - Task management
- useStats.ts - Statistics management
- useEvents.ts - Event stream management
- useWebSocket.ts - WebSocket connection management
- useProjects.ts - Project list management

**Contexts**:

- ProjectContext.tsx - Multi-project support

### Backend

✅ **Implemented via OpenCode Plugin**

The backend is provided by the main OpenCode plugin's GlobalServer (port 4097):

- HTTP API endpoints for employees, messages, tasks, memory, etc.
- WebSocket server for real-time event streaming
- Multi-project workspace management

See main project README for backend details.

## How to Access Employee Dashboard

1. **Start the backend**: Run `./start-test-server.sh` from project root
2. **Start the frontend**: Run `bun run dev` from console/ directory
3. **Access Overview page**: Navigate to `http://localhost:5173/`
4. **View employee list**: Scroll down to see the "员工列表" (Employee List) section
5. **Click any employee card**: Opens the detailed employee dashboard at `/employee/:name`

**Alternative navigation**:

- Click nodes in the hierarchy tree visualization
- Direct URL: `http://localhost:5173/employee/{employee-name}`
