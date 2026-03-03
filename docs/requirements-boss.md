# Boss Message System Requirements

## Overview

This document describes the **Boss Message System**, a temporary feature designed to facilitate testing and debugging by allowing human operators to communicate with employees through special "boss" agents.

**Status**: Temporary feature, may be deprecated in the future when direct human-employee communication is implemented.

**Purpose**: Provide a convenient way for developers to send commands to employees without manually calling `send_message` tool.

## Core Concepts

### Boss

- **Definition**: Boss is a **global entity** (not an employee) with a name, serving as a bridge between humans and the employee system
- **Scope**: Bosses are defined globally and can interact with employees across all projects
- **Identity**: Bosses are identified by name (e.g., `bayecao`) and marked in the global configuration file
- **Nature**: Bosses are OpenCode agents with specific prompts, but they are **not** employees in the cclover system

### Key Differences: Boss vs Employee

| Aspect | Boss | Employee |
|--------|------|----------|
| Scope | Global (across all projects) | Project-specific |
| Definition | Configured in global config file | Created within project workspace |
| Workspace | Messages stored in target project's workspace | Messages stored in own project's workspace |
| Memory | No memory system | Has knowledge, tasks, custom memory |
| Event Loop | No event loop | Has event loop |
| Purpose | Human-to-employee bridge (temporary) | Autonomous work execution |

## Configuration

### Global Configuration File

**Location**: `~/.config/opencode-cclover/config.yaml`

**Format**:
```yaml
# Global boss list (not tied to any project)
bosses:
  - bayecao
  - another-boss

# Project configurations (unchanged)
projects:
  - name: my-app
    path: /path/to/my-app
    enabled: true
  - name: blog
    path: /path/to/blog
    enabled: false
```

**Key Points**:
- `bosses` is a top-level array, separate from `projects`
- Boss names are global identifiers
- A boss can send messages to employees in any project

## File Structure

### Workspace Layout

When boss `bayecao` communicates with employees in project `my-app`:

```
/path/to/my-app/.cclover/workspace/
  ├── employees/           # Employee directory (existing)
  │   ├── alice/
  │   │   └── messages/
  │   │       └── bayecao/
  │   │           └── chat.yaml
  │   └── bob/
  │       └── messages/
  │           └── bayecao/
  │               └── chat.yaml
  │
  └── bosses/              # Boss directory (NEW - parallel to employees/)
      └── bayecao/
          └── messages/
              ├── alice/
              │   └── chat.yaml
              └── bob/
                  └── chat.yaml
```

**Key Points**:
- `bosses/` directory is **parallel** to `employees/` directory
- Boss messages are stored in the **target employee's project workspace**
- If `bayecao` sends messages to employees in multiple projects, each project's workspace will have a `bosses/bayecao/` directory

### Message Format

Boss messages use the **same format** as employee messages (YAML with `direction` field):

```yaml
# bosses/bayecao/messages/alice/chat.yaml
- timestamp: 2026-03-01T10:00:00Z
  direction: send
  content: "请计算 1+1"

- timestamp: 2026-03-01T10:00:05Z
  direction: receive
  content: "结果是 2"
```

```yaml
# employees/alice/messages/bayecao/chat.yaml
- timestamp: 2026-03-01T10:00:00Z
  direction: receive
  content: "请计算 1+1"

- timestamp: 2026-03-01T10:00:05Z
  direction: send
  content: "结果是 2"
```

## Message Synchronization

### Symmetric Storage

Boss-employee communication is **fully symmetric** (same as employee-employee communication):

**Scenario**: Boss `bayecao` sends message to employee `alice` in project `my-app`

1. **Boss side** (in `my-app` workspace):
   - Path: `{projectRoot}/.cclover/workspace/bosses/bayecao/messages/alice/chat.yaml`
   - Direction: `send`

2. **Employee side** (in `my-app` workspace):
   - Path: `{projectRoot}/.cclover/workspace/employees/alice/messages/bayecao/chat.yaml`
   - Direction: `receive`

3. **When employee replies**:
   - Both files are updated atomically
   - Boss side adds entry with `direction: receive`
   - Employee side adds entry with `direction: send`

### Cross-Project Behavior

If boss `bayecao` sends messages to employees in different projects:

```
# Project A
/path/to/project-a/.cclover/workspace/bosses/bayecao/messages/alice/chat.yaml

# Project B
/path/to/project-b/.cclover/workspace/bosses/bayecao/messages/bob/chat.yaml
```

Each project's workspace contains only the boss messages relevant to that project's employees.

## Implementation Requirements

### 1. Configuration Management

**New Module**: `src/core/BossManager.ts` (or extend existing config management)

**Responsibilities**:
- Read global configuration file (`~/.config/opencode-cclover/config.yaml`)
- Maintain global boss list
- Provide `isBoss(name: string): boolean` method

**API**:
```typescript
class BossManager {
  constructor(configPath: string)
  
  // Check if a name is a boss
  isBoss(name: string): boolean
  
  // Get all boss names
  getBosses(): string[]
  
  // Reload configuration
  reload(): Promise<void>
}
```

### 2. MessageService Modifications

**Changes Required**:

1. **Inject BossManager**:
   ```typescript
   class MessageService {
     constructor(
       workspaceRoot: string,
       stateManager: StateManager,
       bossManager: BossManager  // NEW
     )
   }
   ```

2. **Modify `getMessageFilePath()` method**:
   ```typescript
   private getMessageFilePath(employeeName: string, peer: string): string {
     // Check if employeeName is a boss
     if (this.bossManager.isBoss(employeeName)) {
       return path.join(
         this.workspaceRoot,
         "bosses",           // NEW: use "bosses" instead of "employees"
         employeeName,
         "messages",
         peer,
         "chat.yaml"
       )
     }
     
     // Check if peer is a boss
     if (this.bossManager.isBoss(peer)) {
       return path.join(
         this.workspaceRoot,
         "employees",
         employeeName,
         "messages",
         peer,
         "chat.yaml"
       )
     }
     
     // Original logic for employee-to-employee
     return path.join(
       this.workspaceRoot,
       "employees",
       employeeName,
       "messages",
       peer,
       "chat.yaml"
     )
   }
   ```

3. **No changes needed for**:
   - `send()` method (uses `getMessageFilePath()` internally)
   - `recv()` method (works the same way)
   - File locking mechanism
   - Event notification system

### 3. Directory Creation

**Ensure directories are created**:
- When a boss sends a message, create `{workspaceRoot}/bosses/{bossName}/messages/{employeeName}/` if it doesn't exist
- Use the same directory creation logic as for employees

### 4. Testing

**Test Scenarios**:

1. **Boss sends message to employee**:
   - Verify message appears in both `bosses/{boss}/messages/{employee}/` and `employees/{employee}/messages/{boss}/`
   - Verify `direction` fields are correct

2. **Employee replies to boss**:
   - Verify both files are updated atomically
   - Verify message order is preserved

3. **Boss sends messages to employees in different projects**:
   - Verify messages are stored in correct project workspaces
   - Verify no cross-project contamination

4. **Configuration reload**:
   - Verify adding/removing bosses from config works correctly
   - Verify `isBoss()` reflects updated configuration

## Migration Path

### Phase 1: Implementation (Current)
- Implement boss message system as described
- Use for testing and debugging

### Phase 2: Future (When Direct Human Communication is Ready)
- Deprecate boss system
- Migrate to direct human-employee communication
- Archive or remove `bosses/` directories

### Backward Compatibility
- Boss messages are stored separately from employee messages
- Removing boss system will not affect employee-to-employee communication
- `bosses/` directories can be safely deleted when feature is deprecated

## Design Rationale

**Why global bosses?**
- Bosses represent human operators, who are not tied to specific projects
- Allows flexible testing across multiple projects
- Simplifies configuration management

**Why store in project workspace?**
- Keeps message data isolated by project
- Easy to clean up when project is deleted
- Consistent with existing employee message storage

**Why symmetric storage?**
- Reuses existing MessageService logic
- Maintains consistency with employee-to-employee communication
- Simplifies implementation and testing

**Why temporary?**
- Boss system is a workaround for testing
- Future direct human communication will be more flexible
- Keeps codebase clean by marking temporary features explicitly

## Terminology

| Term | Chinese | Description |
|------|---------|-------------|
| Boss | 老板 | Global entity serving as human-employee bridge |
| Boss Message | 老板消息 | Message sent by or to a boss |
| Global Configuration | 全局配置 | Configuration file at `~/.config/opencode-cclover/config.yaml` |
