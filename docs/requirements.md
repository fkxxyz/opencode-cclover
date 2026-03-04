# Requirements

## Overview

Build a multi-agent autonomous collaboration system based on OpenCode SDK, simulating employee collaboration behavior. Employees can send/receive messages, manage tasks, create agents to execute work, and achieve autonomous decision-making and parallel execution.

### Implementation Approach

- Implemented as an OpenCode plugin
- Automatically runs when plugin starts, no additional deployment needed
- Uses OpenCode SDK to create and manage agents
- Supports multiple project instances with global service management

### Core Features

- **Event-Driven**: Employee actions triggered by events (messages, task completion, etc.)
- **Autonomous Decision-Making**: AI autonomously decides next actions based on context
- **Task Management**: Supports DAG task dependencies, automatically calculates parallelizable tasks
- **Memory System**: Employees maintain their own experience knowledge and work state
- **Parallel Execution**: Supports multiple agents working in parallel
- **Multi-Instance Support**: Single global service manages multiple projects, employees run continuously

## Functional Requirements

### Core Concepts

#### Role

- **Definition**: Role is a template for employees, defining system prompt and behavior patterns
- **Attributes**:
  - `name`: Role name
  - `systemPrompt`: System prompt defining role's responsibilities and behavior
- **Example Roles**:
  - Calculator: Only performs mathematical calculations
  - Coder: Writes code, fixes bugs
  - PM (Project Manager): Assigns tasks, coordinates work
  - Researcher: Collects information, analyzes data
  - Tester: Tests code, finds issues
  - Architect: Designs system architecture

#### Employee

- **Definition**: Employee is an instance of a role, with independent memory and task state
- **Attributes**:
  - `name`: Employee name (unique identifier)
  - `role`: Associated role
  - `memory`: Memory system (see Memory System section)
  - `messages`: Message history

#### Event

- **Definition**: Events that trigger employee actions
- **Event Types**:
  - `MessageEvent`: Received message
    ```typescript
    {
      type: "message",
      from: "alice",
      content: "Calculate 1+1",
      timestamp: "2026-03-01T10:00:00Z"
    }
    ```
  - `TaskEvent`: Task status change (completed, cancelled, etc.)
    ```typescript
    {
      type: "task_completed",
      taskName: "Calculate1+1",
      result: "2",
      timestamp: "2026-03-01T10:00:05Z"
    }
    ```
  - `AgentEvent`: Agent execution completed
    ```typescript
    {
      type: "agent_completed",
      agentId: "agent_001",
      taskName: "Calculate1+1",
      result: "...",
      timestamp: "2026-03-01T10:00:05Z"
    }
    ```
  - `TimerEvent`: Timer trigger (for scheduled tasks)
    ```typescript
    {
      type: "timer",
      timestamp: "2026-03-01T10:00:00Z"
    }
    ```

### Messaging System

See [Messaging System Requirements](./requirements-messaging.md) for detailed specifications.

**Summary**:
- Decentralized storage: Each employee stores their own messages locally
- Centralized service: Unified message service handles synchronization
- Read-only client: Employees can only read messages, cannot write directly
- Blocking receive: `recv()` blocks until new message arrives
- Atomic send: `send()` writes to both parties' message files atomically
- Boss communication: Supports global boss entities for human-employee interaction (see [Boss Message System](./requirements-boss.md))

### Memory System

See [Memory System Requirements](./requirements-memory.md) for detailed specifications.

**Summary**:
- **Knowledge**: Experience and insights (free text, AI-maintained)
- **Tasks**: Task list with DAG dependencies (tool-managed)
- **Custom**: Role-specific data (AI-maintained)
- Real-time task updates via `edit_tasks` tool
- Periodic summarization when context reaches threshold

### Task Management

See [Task Management Requirements](./requirements-tasks.md) for detailed specifications.

**Summary**:
- DAG (Directed Acyclic Graph) structure for task dependencies
- Task names as unique identifiers (AI-generated, semantic)
- Automatic calculation of executable tasks (dependencies satisfied)
- Mermaid visualization for AI context
- Batch operations: add, update, delete, decompose tasks
- Smart deletion: automatically cleans dependencies when deleting tasks
- Task decomposition: break complex tasks into subtasks with dependency inheritance

### Tool System

**Available Tools**:

1. **edit_tasks**: Batch edit task list (add, update, delete)
2. **send_message**: Send message to other employees
3. **create_agent**: Create OpenCode agent to execute task
4. **hire_employee**: Hire new employee

See [Tool System Requirements](./requirements-tools.md) for detailed specifications.

### Employee Runtime

**Event Loop**:
1. Wait for event (blocking)
2. Read current memory
3. Generate Mermaid task graph
4. Calculate executable tasks
5. Build context (role prompt + memory + tasks + event)
6. Send prompt to AI with tools
7. Process tool calls (multi-turn interaction)
8. Check context length, summarize if threshold reached
9. Continue loop

See [Employee Runtime Requirements](./requirements-runtime.md) for detailed specifications.

### Multi-Instance Architecture

**Requirements**:
- Single global HTTP service managing all projects
- Employees run continuously, independent of project open/close state
- Configuration-based project management (see [Project Management Requirements](./requirements-project-management.md))
- Console UI can switch between projects
- No port conflicts between multiple project instances

**Configuration**:
- Location: `~/.config/opencode-cclover/config.yaml`
- Format:
  ```yaml
  # Global boss list (optional)
  bosses:
    - bayecao
    - another-boss
  
  # Project configurations
  projects:
    - name: my-app
      path: /path/to/my-app
      enabled: true
    - name: blog
      path: /path/to/blog
      enabled: false
  ```

**Workspace Isolation**:
- Each project has independent workspace: `{projectRoot}/.cclover/workspace/`
- Each project has independent employees and memory
- Roles are globally shared (code-level templates)

See [Architecture](./architecture.md) for implementation details.

## Non-functional Requirements

### Performance

- Message send/receive operations should complete within 100ms
- Task DAG calculation should handle up to 1000 tasks
- Memory summarization should complete within 5 seconds

### Scalability

- Support multiple projects (10+) managed by single global service
- Support multiple employees (10+) per project
- Support multiple concurrent agents per employee

### Reliability

- File locking prevents concurrent write conflicts
- Atomic message writes ensure consistency
- Graceful error handling and recovery

### Maintainability

- Clear module boundaries with documented interfaces
- Comprehensive logging for debugging
- Type-safe implementation with TypeScript

## Constraints

- Must use OpenCode SDK for agent creation
- File system storage (YAML format) for simplicity
- Single global HTTP service on port 4097
- Configuration file required for project discovery

## Assumptions

- AI will avoid duplicate task names (semantic naming)
- Message volume per employee is manageable (no performance issues)
- Users will manually create configuration file
- Project paths remain stable (no frequent moves)

## Dependencies

- **Runtime**: Bun (TypeScript execution and package management)
- **SDK**: @opencode-ai/plugin, @opencode-ai/sdk
- **Storage**: File system (YAML format via `yaml` package)
- **Concurrency**: eventemitter3 for events, proper-lockfile for file sync
- **HTTP**: Bun's built-in HTTP server
- **WebSocket**: For real-time Console updates

## Future Extensions

### Multi-Role Support

- Implement Coder, PM, Researcher, Tester, Architect roles
- Test multi-role collaboration scenarios

### Hierarchical Management

- Implement superior-subordinate relationships
- PM can assign tasks to Coder
- Coder can report progress to PM

### Permission System

- Different roles have different permissions
- Example: Only PM can hire new employees

### Storage Optimization

- Use database instead of file system
- Improve query efficiency

### Boss System Deprecation

- Deprecate temporary boss message system
- Implement direct human-employee communication
- Migrate existing boss messages to new system
### Monitoring and Visualization

- Real-time employee status viewing
- Visualize task dependency graph
- View message history

## Terminology

| Term | Chinese | Description |
|------|---------|-------------|
| Role | 角色 | Employee template, defines system prompt |
| Employee | 员工 | Role instance, has independent memory and state |
| Event | 事件 | Event that triggers employee action |
| Memory | 记忆 | Employee's experience knowledge and task state |
| Task | 任务 | Work that employee needs to complete |
| Tool | 工具 | Function that AI can call |
| Agent | Agent | AI instance created by OpenCode |
| DAG | 有向无环图 | Directed Acyclic Graph, represents task dependencies |
| Project | 项目 | Independent workspace with its own employees |
| Global Service | 全局服务 | Singleton service managing all projects |
| Boss | 老板 | Global entity serving as human-employee bridge (temporary) |
