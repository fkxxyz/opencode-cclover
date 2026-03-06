# opencode-cclover - Development Guidelines

## What This Project Does

An OpenCode plugin implementing a multi-agent autonomous collaboration system where AI employees communicate via messages, manage tasks with DAG dependencies, maintain individual memory, and spawn background agents to execute work in parallel.

## Architecture

**Tech Stack**:
- Runtime: Bun (TypeScript execution and package management)
- Language: TypeScript with strict mode
- Plugin SDK: @opencode-ai/plugin, @opencode-ai/sdk
- Storage: File system (YAML format)
- Concurrency: eventemitter3 for event-driven messaging, proper-lockfile for file synchronization

**Core Components**:
- `GlobalCcloverService`: Singleton managing all projects and HTTP server (configurable port, default 4097)
- `ConfigManager`: Loads project configuration from `~/.config/opencode-cclover/config.yaml`
- `MessageService`: Decentralized message storage with centralized synchronization service
- `MemoryManager`: Employee memory management (knowledge, tasks DAG, custom data)
- `StateManager`: Employee state and event persistence
- `RoleManager`: Role definition management
- `BossManager`: Boss employee management
- `EventLoop`: Employee event loop driving autonomous behavior
- `Tools`: send_message, edit_tasks, create_agent, hire_employee, refresh_roles

**Data Flow**:
```
1. Plugin loads → GlobalCcloverService.getInstance()
2. ConfigManager loads ~/.config/opencode-cclover/config.yaml
3. For each project in config:
   - Create ProjectInstance (MessageService, MemoryManager, StateManager, RoleManager)
   - Register to ProjectRegistry
4. When OpenCode opens project directory:
   - Plugin returns tools for that project
   - EventLoop starts for each employee
5. Employee receives event → EventLoop → AI decides action → Tool call → State update
```

**Configuration System**:
- Config file: `~/.config/opencode-cclover/config.yaml`
- Format:
  ```yaml
  bosses:
    - boss_name
  port: 4097  # Optional, HTTP server port (default: 4097)
  logLevel: info  # Optional, log level: error, warn, info, debug (default: info)
  projects:
    - name: project_name
      path: /absolute/path/to/project
      enabled: true
  ```
- Port priority: Environment variable `CCLOVER_PORT` > config file `port` > default 4097
- Log level priority: Environment variable `CCLOVER_LOG_LEVEL` > config file `logLevel` > default INFO
- Each project gets `.cclover/workspace/` directory for runtime data
- `.cclover/.gitignore` auto-created to ignore runtime data

## Project Structure

```
src/
├── index.ts              # Plugin entry point, initializes GlobalCcloverService
├── config/               # Configuration management
│   ├── ConfigManager.ts  # Load/save config from ~/.config/opencode-cclover/config.yaml
│   └── CandidateProjectsManager.ts  # Track candidate projects
├── server/               # HTTP API server (configurable port, default 4097)
│   ├── GlobalServer.ts   # Singleton service managing all projects
│   ├── ProjectRegistry.ts  # Project instance registry
│   ├── index.ts          # ConsoleServer (HTTP + WebSocket)
│   ├── router.ts         # Route dispatcher (Map-based)
│   ├── routes.ts         # Route definitions with JSDoc
│   └── websocket.ts      # WebSocket manager
├── core/                 # Core business logic
│   ├── MessageService.ts # Message send/recv/sync with event-driven notification
│   ├── MemoryManager.ts  # Memory CRUD with task DAG calculation
│   ├── EventLoop.ts      # Employee event loop
│   ├── BossManager.ts    # Boss employee management
│   └── RoleManager.ts    # Role definition management
├── state/                # State persistence
│   └── StateManager.ts   # Employee state and event history
├── tools/                # OpenCode tools (callable by AI agents)
│   ├── SendMessageTool.ts
│   ├── EditTasksTool.ts
│   ├── CreateAgentTool.ts
│   ├── HireEmployeeTool.ts
│   ├── RefreshRolesTool.ts
│   └── index.ts          # Tool registry
├── utils/                # Utilities
│   ├── MermaidGenerator.ts  # Generate task DAG visualizations
│   ├── ContextBuilder.ts    # Build context strings for AI prompts
│   ├── SessionRegistry.ts   # Map sessionID ↔ employeeName
│   └── AgentRegistry.ts     # Track background agent tasks
├── roles/                # Built-in role definitions
│   └── calculator.yaml   # Example role
├── agents/               # Agent prompts
│   └── role-creator.md   # Role creator agent prompt
├── types/                # TypeScript type definitions
└── lib/                  # Shared utilities
    ├── background.ts     # Background task management
    └── logger.ts         # Logging utility

tests/
├── unit/                 # Unit tests for individual modules
├── integration/          # Integration tests for module interactions
└── fixtures/             # Test data and workspace snapshots

console/                  # Web management console
├── src/                  # Frontend source (React + MUI)
│   ├── components/       # UI components
│   ├── pages/            # Pages (Overview, EmployeeDetail, ProjectManagement)
│   ├── hooks/            # Custom hooks
│   ├── services/         # API and WebSocket clients
│   └── types/            # TypeScript types
├── docs/                 # Console documentation
└── DEVELOPMENT.md        # Frontend development guide

workspace_test/           # Test workspace for plugin testing
├── .opencode/            # OpenCode config
│   └── plugin/
│       └── cclover.ts -> ../../../src/index.ts  # Symlink to plugin
└── README.md             # Testing guide
```

## Configuration

### Initial Setup

1. Create config file:
```bash
mkdir -p ~/.config/opencode-cclover
cat > ~/.config/opencode-cclover/config.yaml << 'EOF'
bosses:
  - your_name
projects:
  - name: my_project
    path: /absolute/path/to/project
    enabled: true
EOF
```

2. Enable plugin:
```bash
export CCLOVER_ENABLE=1
```

3. Start OpenCode server:
```bash
cd /absolute/path/to/project
opencode serve --port 4099
```

### Adding Projects

Edit `~/.config/opencode-cclover/config.yaml`:
```yaml
projects:
  - name: project1
    path: /path/to/project1
    enabled: true
  - name: project2
    path: /path/to/project2
    enabled: false  # Disabled
```

Restart OpenCode server to apply changes.

## HTTP API Routes
All HTTP API routes are defined in `src/server/routes.ts` with JSDoc documentation.
## Development Rules

### Before Every Commit

**MANDATORY checks** (must pass before commit):

```bash
# 1. Type check (must have zero errors)
bun run build

# 2. Format all TypeScript files
bunx prettier --write "src/**/*.ts" "tests/**/*.ts"

# 3. Run all tests (must pass 100%)
bun test
```

**Workflow**:
```bash
# After making changes
bun run build          # Check TypeScript errors
bunx prettier --write "src/**/*.ts" "tests/**/*.ts"
bun test               # Verify all tests pass
git add .
git commit -m "feat: your feature description"
```

### Commit Message Format
**REQUIRED**: All commit messages MUST be in English and follow [Conventional Commits](https://www.conventionalcommits.org/) format.
**Examples**:
```
feat: implement task dependency calculation in MemoryManager
fix: prevent race condition in MessageService file locking
refactor: extract Mermaid generation to separate utility
test: add integration tests for message synchronization
docs: update architecture diagram in README
chore: add prettier configuration
```

## Code Style Conventions

**Derived from existing codebase** - these are project-specific conventions:

### TypeScript Style

**Quotes and Semicolons**:
```typescript
// ✅ Correct: Double quotes, no semicolons
import { Plugin } from "@opencode-ai/plugin"
const message = "Hello"

// ❌ Wrong: Single quotes or semicolons
import { Plugin } from '@opencode-ai/plugin';
const message = 'Hello';
```

**Import Organization**:
```typescript
// ✅ Correct: Node built-ins first, then external, then internal
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import EventEmitter from "eventemitter3"
import { MessageService } from "./core/MessageService"

// Use 'import type' for type-only imports
import type { MessageService } from "../core/MessageService"
```

**Comments**:
```typescript
// ✅ Correct: Use Chinese for implementation comments
// 1. 检查未读队列
const queue = this.service.getUnreadQueue(this.employeeName)

// ✅ Correct: Use JSDoc for public API documentation
/**
 * 消息客户端
 * 员工通过客户端收发消息
 */
export class MessageClient {
```

**Naming Conventions**:
```typescript
// ✅ Interfaces: PascalCase
export interface Message { }
export interface YamlMessage { }

// ✅ Classes: PascalCase
export class MessageService { }

// ✅ Functions: camelCase, use 'export function' (not 'export const')
export function createSendMessageTool(messageService: MessageService) {
  return tool({ ... })
}

// ✅ Private methods: camelCase with 'private' keyword
private getMessageFilePath(employeeName: string, peer: string): string {
```

**Error Handling**:
```typescript
// ✅ Correct: Type error as 'any', check error.code for ENOENT
try {
  const content = await fs.readFile(filePath, "utf-8")
} catch (error: any) {
  if (error.code === "ENOENT") {
    return []
  }
  throw error
}
```

**Async/Await**:
```typescript
// ✅ Correct: Always use async/await, never use .then()
async execute(args, context) {
  const result = await messageService.send(from, args.to, args.content)
  return `消息已发送给 ${args.to}`
}
```

### File Organization

**Module Exports**:
```typescript
// ✅ Each module has index.ts that re-exports public API
// src/core/index.ts
export { MessageService, MessageClient } from "./MessageService"
export { MemoryManager } from "./MemoryManager"
export type { Message, Task, Memory } from "./MessageService"
```

**Test Files**:
```typescript
// ✅ Test files use .test.ts suffix
// tests/unit/MessageService.test.ts
// tests/integration/MessageService.integration.test.ts
```

## Common Pitfalls

### File Locking

**Problem**: Concurrent writes to YAML files cause data corruption.

**Solution**: Always use `proper-lockfile` when writing:
```typescript
import * as lockfile from "proper-lockfile"

const release = await lockfile.lock(filePath, { retries: 10 })
try {
  await fs.writeFile(filePath, content, "utf-8")
} finally {
  await release()
}
```

### Task DAG Cycles

**Problem**: Circular task dependencies cause infinite loops.

**Solution**: `MemoryManager.getExecutableTasks()` automatically detects cycles and throws error. Always validate task dependencies before adding:
```typescript
// ✅ Correct: Let MemoryManager validate
await memoryManager.editTasks(employeeName, {
  add: [{ name: "task1", dependencies: ["task2"] }]
})
// Will throw if creates cycle
```

### Session Registry

**Problem**: Tools need to map `sessionID` to `employeeName`, but OpenCode doesn't provide this.

**Solution**: Use `sessionRegistry` to register mapping when creating agents:
```typescript
import { sessionRegistry } from "../utils/SessionRegistry"

// When creating agent
const sessionID = await opcodeClient.createAgent(...)
sessionRegistry.register(sessionID, employeeName)

// In tool
const employeeName = sessionRegistry.getEmployeeName(context.sessionID)
```

## Testing

### Test Structure

**Unit Tests**: Test individual modules in isolation
```bash
bun test tests/unit/MessageService.test.ts
```

**Integration Tests**: Test module interactions with real file system
```bash
bun test tests/integration/MessageService.integration.test.ts
```

### Plugin Testing

**Manual Testing**: Test the plugin with real OpenCode server

```bash
# Quick start: Use the provided script
./start-test-server.sh
```
Or manually:
```bash
# Start OpenCode server with OPENCODE_CONFIG_DIR pointing to workspace_test/.opencode
OPENCODE_CONFIG_DIR="$(pwd)/workspace_test/.opencode" opencode serve --port 4099
```

See [workspace_test/README.md](workspace_test/README.md) for quick start guide, testing scenarios, and debugging tips.

### Coverage Target

Aim for high coverage on core modules:
- MessageService: 100%
- MemoryManager: 100%
- Tools: 80%+ (some error paths hard to test)

## Documentation

**Design Docs** (in `docs/` and `console/docs/`):
- Plugin core: Read `docs/` to understand system design before implementing features
- Console: Read `console/docs/` for frontend architecture and requirements
- Update when making architectural changes

**Code Comments**:
- Use Chinese for implementation details
- Use JSDoc for public API documentation
- Explain WHY, not WHAT (code shows what)

**README.md**:
- Keep synchronized with implementation status
- Update "Current Progress" section when completing phases