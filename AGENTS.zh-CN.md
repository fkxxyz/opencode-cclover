# opencode-cclover - 开发指南

## 项目概述

一个 OpenCode 插件，实现了多 Agent 自主协作系统，其中 AI 员工通过消息进行通信，管理具有 DAG 依赖的任务，维护个人记忆，并生成后台 Agent 并行执行工作。

## 架构

**技术栈**:
- 运行时: Bun (TypeScript 执行和包管理)
- 语言: TypeScript 严格模式
- 插件 SDK: @opencode-ai/plugin
- 存储: 文件系统 (YAML 格式)
- 并发: eventemitter3 用于事件驱动消息传递，proper-lockfile 用于文件同步

**核心组件**:
- `MessageService`: 去中心化消息存储与中心化同步服务
- `MemoryManager`: 员工记忆管理 (知识、任务 DAG、自定义数据)
- `Tools`: send_message、edit_tasks、create_agent、hire_employee
- `Utils`: Mermaid 图生成、上下文构建、Session/Agent 注册表

**数据流**:
```
Employee A (Agent) → send_message tool → MessageService → YAML file
                                              ↓
                                         EventEmitter
                                              ↓
Employee B (Agent) ← recv() blocks ← MessageClient ← Event notification
```

## 项目结构

```
src/
├── index.ts              # 插件入口点，初始化服务和工具
├── core/                 # 核心基础设施
│   ├── MessageService.ts # 消息发送/接收/同步与事件驱动通知
│   └── MemoryManager.ts  # 记忆 CRUD 与任务 DAG 计算
├── tools/                # OpenCode 工具 (AI Agent 可调用)
│   ├── SendMessageTool.ts
│   ├── EditTasksTool.ts
│   ├── CreateAgentTool.ts
│   └── HireEmployeeTool.ts
├── utils/                # 工具支持模块
│   ├── MermaidGenerator.ts  # 生成任务 DAG 可视化
│   ├── ContextBuilder.ts    # 为 AI 提示构建上下文字符串
│   ├── SessionRegistry.ts   # 映射 sessionID ↔ employeeName
│   └── AgentRegistry.ts     # 跟踪后台 Agent 任务
└── lib/                  # 共享工具库
    ├── background.ts     # 后台任务管理
    └── logger.ts         # 日志工具

tests/
├── unit/                 # 单个模块的单元测试
├── integration/          # 模块交互的集成测试
└── fixtures/             # 测试数据和工作区快照

.cclover/workspace/       # 运行时工作区 (由插件创建)
└── employees/
    └── {name}/
        ├── messages/     # 消息 YAML 文件 (每个对等体一个)
        └── memory.yaml   # 员工记忆 (知识、任务、自定义)
```

## 开发规则

### 每次提交前

**强制检查** (提交前必须通过):

```bash
# 1. 类型检查 (必须零错误)
bun run build

# 2. 格式化所有 TypeScript 文件
bunx prettier --write "src/**/*.ts" "tests/**/*.ts"

# 3. 运行所有测试 (必须 100% 通过)
bun test
```

**工作流**:
```bash
# 进行更改后
bun run build          # 检查 TypeScript 错误
bunx prettier --write "src/**/*.ts" "tests/**/*.ts"
bun test               # 验证所有测试通过
git add .
git commit -m "feat: your feature description"
```

### 提交消息格式
**必需**: 所有提交消息必须使用英文并遵循 [Conventional Commits](https://www.conventionalcommits.org/) 格式。
**示例**:
```
feat: implement task dependency calculation in MemoryManager
fix: prevent race condition in MessageService file locking
refactor: extract Mermaid generation to separate utility
test: add integration tests for message synchronization
docs: update architecture diagram in README
chore: add prettier configuration
```

## 代码风格约定

**源自现有代码库** - 这些是项目特定的约定:

### TypeScript 风格

**引号和分号**:
```typescript
// ✅ 正确: 双引号，无分号
import { Plugin } from "@opencode-ai/plugin"
const message = "Hello"

// ❌ 错误: 单引号或分号
import { Plugin } from '@opencode-ai/plugin';
const message = 'Hello';
```

**导入组织**:
```typescript
// ✅ 正确: Node 内置优先，然后外部，然后内部
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as yaml from "yaml"
import EventEmitter from "eventemitter3"
import { MessageService } from "./core/MessageService"

// 对仅类型导入使用 'import type'
import type { MessageService } from "../core/MessageService"
```

**注释**:
```typescript
// ✅ 正确: 实现注释使用中文
// 1. 检查未读队列
const queue = this.service.getUnreadQueue(this.employeeName)

// ✅ 正确: 公共 API 文档使用 JSDoc
/**
 * 消息客户端
 * 员工通过客户端收发消息
 */
export class MessageClient {
```

**命名约定**:
```typescript
// ✅ 接口: PascalCase
export interface Message { }
export interface YamlMessage { }

// ✅ 类: PascalCase
export class MessageService { }

// ✅ 函数: camelCase，使用 'export function' (不是 'export const')
export function createSendMessageTool(messageService: MessageService) {
  return tool({ ... })
}

// ✅ 私有方法: camelCase 带 'private' 关键字
private getMessageFilePath(employeeName: string, peer: string): string {
```

**错误处理**:
```typescript
// ✅ 正确: 将错误类型为 'any'，检查 error.code 是否为 ENOENT
try {
  const content = await fs.readFile(filePath, "utf-8")
} catch (error: any) {
  if (error.code === "ENOENT") {
    return []
  }
  throw error
}
```

**异步/等待**:
```typescript
// ✅ 正确: 始终使用 async/await，从不使用 .then()
async execute(args, context) {
  const result = await messageService.send(from, args.to, args.content)
  return `消息已发送给 ${args.to}`
}
```

### 文件组织

**模块导出**:
```typescript
// ✅ 每个模块都有 index.ts 重新导出公共 API
// src/core/index.ts
export { MessageService, MessageClient } from "./MessageService"
export { MemoryManager } from "./MemoryManager"
export type { Message, Task, Memory } from "./MessageService"
```

**测试文件**:
```typescript
// ✅ 测试文件使用 .test.ts 后缀
// tests/unit/MessageService.test.ts
// tests/integration/MessageService.integration.test.ts
```

## 常见陷阱

### 文件锁定

**问题**: 对 YAML 文件的并发写入导致数据损坏。

**解决方案**: 写入时始终使用 `proper-lockfile`:
```typescript
import * as lockfile from "proper-lockfile"

const release = await lockfile.lock(filePath, { retries: 10 })
try {
  await fs.writeFile(filePath, content, "utf-8")
} finally {
  await release()
}
```

### 任务 DAG 循环

**问题**: 循环任务依赖导致无限循环。

**解决方案**: `MemoryManager.getExecutableTasks()` 自动检测循环并抛出错误。添加前始终验证任务依赖:
```typescript
// ✅ 正确: 让 MemoryManager 验证
await memoryManager.editTasks(employeeName, {
  add: [{ name: "task1", dependencies: ["task2"] }]
})
// 如果创建循环将抛出错误
```

### Session 注册表

**问题**: 工具需要映射 `sessionID` 到 `employeeName`，但 OpenCode 不提供此功能。

**解决方案**: 创建 Agent 时使用 `sessionRegistry` 注册映射:
```typescript
import { sessionRegistry } from "../utils/SessionRegistry"

// 创建 Agent 时
const sessionID = await opcodeClient.createAgent(...)
sessionRegistry.register(sessionID, employeeName)

// 在工具中
const employeeName = sessionRegistry.getEmployeeName(context.sessionID)
```

## 测试

### 测试结构

**单元测试**: 隔离测试单个模块
```bash
bun test tests/unit/MessageService.test.ts
```

**集成测试**: 测试模块交互与真实文件系统
```bash
bun test tests/integration/MessageService.integration.test.ts
```

### 插件测试

**手动测试**: 使用真实的 OpenCode 服务器测试插件

```bash
# 使用 OPENCODE_CONFIG_DIR 指向 workspace_test/.opencode 启动 OpenCode 服务器
OPENCODE_CONFIG_DIR="$(pwd)/workspace_test/.opencode" opencode serve --port 4099
```

参见 [workspace_test/README.md](workspace_test/README.md) 了解快速开始指南、测试场景和调试技巧。

### 覆盖率目标

在核心模块上争取高覆盖率:
- MessageService: 100%
- MemoryManager: 100%
- Tools: 80%+ (某些错误路径难以测试)

## 文档

**设计文档** (在 `docs/` 中):
- 实现功能前阅读这些文档以理解系统设计
- 进行架构更改时更新

**代码注释**:
- 实现细节使用中文
- 公共 API 文档使用 JSDoc
- 解释为什么，而不是什么 (代码显示什么)

**README.md**:
- 与实现状态保持同步
- 完成阶段时更新"当前进度"部分
