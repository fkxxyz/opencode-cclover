# 插件入口设计文档 (Plugin Entry)

## 1. 概述

插件入口是整个系统的启动点，负责初始化各个模块并启动员工。

---

## 2. 插件结构

### 2.1 入口文件

```typescript
// src/index.ts
import { Plugin } from "@opencode-ai/plugin"
import path from "path"
import { MessageService } from "./core/MessageService"
import { MemoryManager } from "./core/MemoryManager"
import { EventLoop } from "./core/EventLoop"
import { CalculatorRole } from "./roles/Calculator"
import { sendMessageTool, editTasksTool, createAgentTool, hireEmployeeTool } from "./tools"
import { sessionRegistry } from "./utils/SessionRegistry"

export const CcloverPlugin: Plugin = async (ctx) => {
  console.log("[Cclover] Initializing plugin...")
  
  // 1. 初始化工作空间
  const workspaceRoot = path.join(ctx.directory, '.cclover/workspace')
  
  // 2. 初始化消息服务
  const messageService = new MessageService(workspaceRoot)
  
  // 3. 初始化记忆管理
  const memoryManager = new MemoryManager(workspaceRoot)
  
  // 4. 确保 .gitignore
  await ensureGitignore(ctx.directory)
  
  // 5. 启动员工
  startEmployees(ctx, messageService, memoryManager)
  
  console.log("[Cclover] Plugin initialized")
  
  // 6. 返回工具
  return {
    tool: {
      send_message: sendMessageTool,
      edit_tasks: editTasksTool,
      create_agent: createAgentTool,
      hire_employee: hireEmployeeTool
    }
  }
}

export default CcloverPlugin
```

---

## 3. 初始化流程

### 3.1 确保 .gitignore

```typescript
async function ensureGitignore(projectRoot: string): Promise<void> {
  const gitignorePath = path.join(projectRoot, '.gitignore')
  
  // 读取现有 .gitignore
  let content = ''
  if (await fs.exists(gitignorePath)) {
    content = await fs.readFile(gitignorePath, 'utf-8')
  }
  
  // 检查是否已包含 .cclover
  if (!content.includes('.cclover')) {
    content += '\n# Cclover workspace\n.cclover/\n'
    await fs.writeFile(gitignorePath, content, 'utf-8')
    console.log("[Cclover] Added .cclover to .gitignore")
  }
}
```

### 3.2 启动员工

```typescript
async function startEmployees(
  ctx: PluginInput,
  messageService: MessageService,
  memoryManager: MemoryManager
): Promise<void> {
  const employees = [
    { name: 'calculator', role: CalculatorRole }
  ]
  
  // 并行启动所有员工
  Promise.all(
    employees.map(async ({ name, role }) => {
      try {
        const messageClient = messageService.getClient(name)
        const eventLoop = new EventLoop(
          name,
          role,
          messageClient,
          memoryManager,
          ctx.client  // OpencodeClient
        )
        
        // 注册 session
        // (在 EventLoop 创建 session 时会调用 sessionRegistry.register)
        
        // 启动事件循环
        await eventLoop.run()
        
      } catch (error) {
        console.error(`[Cclover] Failed to start employee ${name}:`, error)
      }
    })
  ).catch(error => {
    console.error("[Cclover] Error in employee startup:", error)
  })
  
  console.log(`[Cclover] Started ${employees.length} employee(s)`)
}
```

---

## 4. 目录结构

### 4.1 最终项目结构

```
opencode-cclover/
├── src/
│   ├── index.ts                   # 插件入口
│   ├── core/
│   │   ├── MessageService.ts      # 消息服务
│   │   ├── MemoryManager.ts       # 记忆管理
│   │   └── EventLoop.ts           # 事件循环
│   ├── tools/
│   │   ├── SendMessageTool.ts     # send_message 工具
│   │   ├── EditTasksTool.ts       # edit_tasks 工具
│   │   ├── CreateAgentTool.ts     # create_agent 工具
│   │   └── HireEmployeeTool.ts    # hire_employee 工具
│   ├── roles/
│   │   ├── index.ts               # 角色注册表
│   │   └── Calculator.ts          # Calculator 角色
│   └── utils/
│       ├── SessionRegistry.ts     # Session 注册表
│       └── AgentRegistry.ts       # Agent 注册表
├── docs/
│   ├── 01-MessageService.md       # 消息服务设计文档
│   ├── 02-MemoryManager.md        # 记忆管理设计文档
│   ├── 03-EventLoop.md            # 事件循环设计文档
│   ├── 04-Tools.md                # 工具系统设计文档
│   ├── 05-Roles.md                # 角色定义设计文档
│   └── 06-PluginEntry.md          # 插件入口设计文档
├── package.json
├── tsconfig.json
├── README.md
└── REQUIREMENTS.md
```

---

## 5. 部署方式

### 5.1 本地开发

```bash
# 1. 安装依赖
bun install

# 2. 构建
bun run build

# 3. 在项目中使用
# 方式 1: 符号链接
mkdir -p .opencode/plugin
ln -s $(pwd)/src/index.ts .opencode/plugin/cclover.ts

# 方式 2: opencode.json
{
  "plugin": [
    "file:///absolute/path/to/opencode-cclover/src/index.ts"
  ]
}
```

### 5.2 npm 发布（未来）

```bash
# 发布到 npm
npm publish

# 在项目中使用
{
  "plugin": ["opencode-cclover"]
}
```

---

## 6. 测试流程

### 6.1 启动插件

1. OpenCode 启动时自动加载插件
2. 插件初始化各个模块
3. Calculator 员工开始运行，等待消息

### 6.2 测试场景

**场景 1：简单计算**

1. 用户（八叶草）调用 `send_message` 工具：
   ```json
   {
     "to": "calculator",
     "content": "计算 1+1"
   }
   ```

2. Calculator 收到消息事件
3. Calculator 直接计算并回复：
   ```json
   {
     "to": "bayecao",
     "content": "结果是 2"
   }
   ```

4. 用户收到回复

**场景 2：复杂计算**

1. 用户调用 `send_message`：
   ```json
   {
     "to": "calculator",
     "content": "计算 (123+456)*789"
   }
   ```

2. Calculator 收到消息事件
3. Calculator 创建 agent：
   ```json
   {
     "task_name": "计算复杂表达式",
     "prompt": "请计算 (123+456)*789"
   }
   ```

4. Calculator 等待 agent 完成事件
5. 收到结果后回复用户

---

## 7. 监控和调试

### 7.1 日志输出

```typescript
// 在关键位置添加日志
console.log("[Cclover] Plugin initialized")
console.log(`[${employeeName}] Starting event loop...`)
console.log(`[${employeeName}] Received event: ${event.type}`)
console.log(`[${employeeName}] Created session: ${sessionId}`)
```

### 7.2 错误处理

```typescript
try {
  // 操作
} catch (error) {
  console.error(`[${employeeName}] Error:`, error)
  // 继续运行，不退出
}
```

---

## 8. 实现清单

- [ ] 插件入口
  - [ ] CcloverPlugin 函数
  - [ ] 模块初始化
  - [ ] 工具注册
- [ ] 初始化流程
  - [ ] ensureGitignore() 函数
  - [ ] startEmployees() 函数
- [ ] 测试
  - [ ] 简单计算场景
  - [ ] 复杂计算场景
- [ ] 文档
  - [ ] README 更新
  - [ ] 使用说明
