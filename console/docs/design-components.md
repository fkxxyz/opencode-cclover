# Component Layer Design

## Overview

This document describes the component layer organization, including pages, feature components, and UI primitives.

## Architecture Reference

Implements the Component Layer described in [Architecture - Frontend Modules](./architecture.md#frontend-modules).

## Page Components

**Location**: [`src/pages/`](../src/pages/)

### Overview Page

**File**: [`Overview.tsx`](../src/pages/Overview.tsx)

Dashboard with global statistics, employee list, and real-time event stream.

**Features**:

- Global statistics cards (total employees, active employees, pending tasks, today's messages)
- Employee list with status indicators
- Real-time event stream with filtering

**Hooks Used**: `useEmployees`, `useStats`, `useEvents`

### EmployeeDetail Page

**File**: [`EmployeeDetail.tsx`](../src/pages/EmployeeDetail.tsx)

Detailed view of a single employee with tabs for different data views.

**Features**:

- Employee header with status and metadata
- Tabs: Messages, Tasks, Agents, Memory
- Employee-specific event timeline

**Hooks Used**: `useEmployees`, `useMessages`, `useTasks`, `useEvents`

### ProjectManagement Page

**File**: [`ProjectManagement.tsx`](../src/pages/ProjectManagement.tsx)

Project management interface for adding, configuring, and removing projects.

**Features**:

- Project list with enable/disable toggles
- Add project from candidate list
- Delete project with confirmation
- Project settings editor

**Hooks Used**: `useProjectContext`, custom project management hooks

## Layout Components

**Location**: [`src/components/layout/`](../src/components/layout/)

### Layout

**File**: [`Layout.tsx`](../src/components/layout/Layout.tsx)

Main application layout with sidebar and content area.

**Features**:

- Responsive design (mobile/desktop)
- Sidebar navigation
- Content area with routing

### Sidebar

**File**: [`Sidebar.tsx`](../src/components/layout/Sidebar.tsx)

Navigation sidebar with project selector.

**Features**:

- Navigation menu with active route highlighting
- Project selector dropdown
- Collapsible on mobile

## Feature Components

**Location**: [`src/components/`](../src/components/)

### Dashboard Components

**Location**: [`dashboard/`](../src/components/dashboard/)

**GlobalStats.tsx**: Statistics cards displaying:

- Total employees count
- Active employees count
- Pending tasks count
- Today's messages count

**EventStream.tsx**: Real-time event list with:

- Event type filtering
- Timestamp display
- Employee name linking
- Auto-scroll to latest

### Employee Components

**Location**: [`employee/`](../src/components/employee/)

**EmployeeCard.tsx**: Employee summary card with:

- Employee name and role
- Status badge (active/idle/busy)
- Last active timestamp
- Click to navigate to detail page

**MessageList.tsx**: Message history display with:

- Sender/receiver indicators
- Message content
- Timestamp
- Pagination for long histories

**TaskList.tsx**: Task list with:

- Task name and description
- Status badges (pending/in_progress/waiting_for_message/completed/cancelled)
- Dependency visualization
- Executable task highlighting

**AgentList.tsx**: Agent execution records with:

- Agent ID and creation time
- Status (running/completed/failed)
- Result display
- Error messages

**MemoryView.tsx**: Employee memory display with:

- Knowledge list (key-value pairs)
- Custom data JSON viewer
- Edit capabilities (future)

**EventTimeline.tsx**: Employee-specific event timeline with:

- Chronological event list
- Event type icons
- Event details expansion
- Filtering by event type

### Visualization Components

**Location**: [`visualizations/`](../src/components/visualizations/)

**HierarchyTree.tsx**: Employee hierarchy visualization using Mermaid:

- Tree structure showing parent-child relationships
- Interactive node clicking
- Zoom and pan controls

**TaskDAG.tsx**: Task dependency graph using Mermaid:

- Directed acyclic graph of task dependencies
- Executable tasks highlighted
- Completed tasks grayed out

## UI Components

**Location**: [`src/components/ui/`](../src/components/ui/)

Reusable UI primitives from shadcn/ui:

- `button.tsx`: Button component with variants (default, destructive, outline, ghost)
- `card.tsx`: Card container with header, content, and footer sections
- `table.tsx`: Table with sorting and pagination support
- `tabs.tsx`: Tab navigation component
- `badge.tsx`: Status badges with color variants
- `input.tsx`: Form input component
- `label.tsx`: Form label component
- `select.tsx`: Dropdown select component
- `dialog.tsx`: Modal dialog component
- `alert.tsx`: Alert/notification component

---

**Version**: 1.0  
**Last Updated**: 2026-03-02  
**Status**: Living Document
