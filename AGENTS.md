# opencode-cclover - Development Guidelines

## What This Project Does

An OpenCode plugin implementing a multi-agent autonomous collaboration system where AI employees communicate via messages, manage tasks with DAG dependencies, maintain individual memory, and spawn background agents to execute work in parallel.

## Architecture

**Tech Stack**:
- Runtime: Bun (TypeScript execution and package management)
- Language: TypeScript with strict mode
- Plugin SDK: @opencode-ai/plugin
- Storage: File system (YAML format)
- Concurrency: eventemitter3 for event-driven messaging, proper-lockfile for file synchronization

**Core Components**:
- `MessageService`: Decentralized message storage with centralized synchronization service
- `MemoryManager`: Employee memory management (knowledge, tasks DAG, custom data)
- `Tools`: send_message, edit_tasks, create_agent, hire_employee
- `Utils`: Mermaid diagram generation, context building, session/agent registries

**Data Flow**:
```
Employee A (Agent) → send_message tool → MessageService → YAML file
                                              ↓
                                         EventEmitter
                                              ↓
Employee B (Agent) ← recv() blocks ← MessageClient ← Event notification
```

## Project Structure

```
src/
├── index.ts              # Plugin entry point, initializes services and tools
├── core/                 # Core infrastructure
│   ├── MessageService.ts # Message send/recv/sync with event-driven notification
│   └── MemoryManager.ts  # Memory CRUD with task DAG calculation
├── tools/                # OpenCode tools (callable by AI agents)
│   ├── SendMessageTool.ts
│   ├── EditTasksTool.ts
│   ├── CreateAgentTool.ts
│   └── HireEmployeeTool.ts
├── utils/                # Tool support modules
│   ├── MermaidGenerator.ts  # Generate task DAG visualizations
│   ├── ContextBuilder.ts    # Build context strings for AI prompts
│   ├── SessionRegistry.ts   # Map sessionID ↔ employeeName
│   └── AgentRegistry.ts     # Track background agent tasks
└── lib/                  # Shared utilities
    ├── background.ts     # Background task management
    └── logger.ts         # Logging utility

tests/
├── unit/                 # Unit tests for individual modules
├── integration/          # Integration tests for module interactions
└── fixtures/             # Test data and workspace snapshots

console/                  # Web 管理控制台 (已实现)
├── src/                  # 前端源码 (React + MUI)
│   ├── components/       # UI 组件
│   ├── pages/            # 页面 (Overview, EmployeeDetail, ProjectManagement)
│   ├── hooks/            # 自定义 Hooks
│   ├── services/         # API 和 WebSocket 客户端
│   └── types/            # TypeScript 类型
├── docs/                 # Console 文档
└── DEVELOPMENT.md        # 前端开发规范
src/server/               # 后端服务器 (已实现)
├── GlobalServer.ts       # 全局服务器 (单例, 端口 4097)
├── ProjectRegistry.ts    # 项目注册表
├── routes.ts             # API 路由定义表 (集中管理所有 API, 详细注释)
├── router.ts             # 路由分发器 (Map 查找优化)
├── websocket.ts          # WebSocket 服务
└── index.ts              # ConsoleServer 主类


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