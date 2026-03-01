# 工具系统设计文档 (Tools)

## 1. 概述

工具系统为员工提供执行操作的能力，包括发送消息、管理任务、创建 Agent 等。

### 1.1 设计原则

- **全局注册**：工具通过插件全局注册
- **权限控制**：通过 session.prompt 的 tools 参数控制可用性
- **上下文感知**：工具可以获取调用者信息（sessionID, agent）

### 1.2 工具列表

1. `send_message` - 发送消息给其他员工
2. `edit_tasks` - 批量编辑任务
3. `create_agent` - 创建 OpenCode agent 执行任务
4. `hire_employee` - 雇佣新员工（未来扩展）

---

## 2. 工具定义

### 2.1 send_message

**功能**：发送消息给其他员工

**参数**：
```typescript
{
  to: string      // 接收者名称
  content: string // 消息内容
}
```

**实现**：
```typescript
import { tool } from "@opencode-ai/plugin"

export const sendMessageTool = tool({
  description: "发送消息给其他员工",
  args: {
    to: tool.schema.string().describe("接收者名称"),
    content: tool.schema.string().describe("消息内容")
  },
  async execute(args, context) {
    // 获取调用者信息
    const from = getEmployeeNameFromSession(context.sessionID)
    
    // 调用消息服务
    await messageService.send(from, args.to, args.content)
    
    return `消息已发送给 ${args.to}`
  }
})
```

### 2.2 edit_tasks

**功能**：批量编辑任务列表（添加、更新、删除任务）

**参数**：
```typescript
{
  operations: Array<{
    action: 'add' | 'update' | 'delete'
    
    // add 时必填
    name?: string
    description?: string
    dependencies?: string[]
    
    // update 时必填
    name?: string
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    result?: string
    
    // delete 时必填
    name?: string
  }>
}
```

**实现**：
```typescript
export const editTasksTool = tool({
  description: "批量编辑任务列表（添加、更新、删除任务）",
  args: {
    operations: tool.schema.array(
      tool.schema.object({
        action: tool.schema.enum(['add', 'update', 'delete']).describe("操作类型"),
        name: tool.schema.string().optional().describe("任务名称"),
        description: tool.schema.string().optional().describe("任务描述"),
        dependencies: tool.schema.array(tool.schema.string()).optional().describe("依赖任务列表"),
        status: tool.schema.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional().describe("任务状态"),
        result: tool.schema.string().optional().describe("任务结果")
      })
    ).describe("操作列表")
  },
  async execute(args, context) {
    const employeeName = getEmployeeNameFromSession(context.sessionID)
    const results: string[] = []
    
    for (const op of args.operations) {
      if (op.action === 'add') {
        await memoryManager.addTask(employeeName, {
          name: op.name!,
          status: 'pending',
          description: op.description!,
          dependencies: op.dependencies || []
        })
        results.push(`已添加任务: ${op.name}`)
      }
      else if (op.action === 'update') {
        await memoryManager.updateTask(employeeName, op.name!, {
          status: op.status,
          result: op.result
        })
        results.push(`已更新任务: ${op.name}`)
      }
      else if (op.action === 'delete') {
        await memoryManager.deleteTask(employeeName, op.name!)
        results.push(`已删除任务: ${op.name}`)
      }
    }
    
    return results.join('\n')
  }
})
```

### 2.3 create_agent

**功能**：创建 OpenCode agent 执行任务

**参数**：
```typescript
{
  task_name: string  // 关联的任务名称
  prompt: string     // 给 agent 的提示词
}
```

**实现**：
```typescript
export const createAgentTool = tool({
  description: "创建 OpenCode agent 执行任务",
  args: {
    task_name: tool.schema.string().describe("关联的任务名称"),
    prompt: tool.schema.string().describe("给 agent 的提示词")
  },
  async execute(args, context) {
    const employeeName = getEmployeeNameFromSession(context.sessionID)
    
    // 1. 创建 agent     const session = await opcodeClient.session.create({
      body: {
        title: `${employeeName} - ${args.task_name}`
      }
    })
    
    // 2. 发送 prompt
    await opcodeClient.session.prompt({
      path: { id: session.data.id },
      body: {
        parts: [
          { type: 'text', text: args.prompt }
        ]
      }
    })
    
    // 3. 记录 agent 信息（用于后续事件匹配）
    agentRegistry.register(session.data.id, {
      employeeName,
      taskName: args.task_name
    })
    
    return `已创建 Agent: ${session.data.id}，正在执行任务: ${args.task_name}`
  }
})
```

### 2.4 hire_employee

**功能**：雇佣新员工（未来扩展）

**参数**：
```typescript
{
  name: string  // 员工名称
  role: string  // 角色类型
}
```

**实现**：
```typescript
export const hireEmployeeTool = tool({
  description: "雇佣新员工",
  args: {
    name: tool.schema.string().describe("员工名称"),
    role: tool.schema.string().describe("角色类型")
  },
  async execute(args, context) {
    // 第一版暂不实现
    return `雇佣功能暂未实现`
  }
})
```

---

## 3. 工具注册

### 3.1 插件注册

```typescript
// src/index.ts
import { Plugin } from "@opencode-ai/plugin"
import { sendMessageTool, editTasksTool, createAgentTool, hireEmployeeTool } from "./tools"

export const CcloverPlugin: Plugin = async (ctx) => {
  return {
    tool: {
      send_message: sendMessageTool,
      edit_tasks: editTasksTool,
      create_agent: createAgentTool,
      hire_employee: hireEmployeeTool
    }
  }
}
```

### 3.2 权限控制

```typescript
// 在 EventLoop 中指定员工可用的工具
await this.opcodeClient.session.prompt({
  path: { id: session.id },
  body: {
    parts: [...],
    tools: {
      'send_message': true,
      'edit_tasks': true,
      'create_agent': true
      // 'hire_employee' 不包含，员工无法雇佣新员工
    }
  }
})
```

---

## 4. 辅助模块

### 4.1 Session 到员工名称映射

```typescript
// src/utils/SessionRegistry.ts
class SessionRegistry {
  private sessionToEmployee = new Map<string, string>()
  
  register(sessionId: string, employeeName: string): void {
    this.sessionToEmployee.set(sessionId, employeeName)
  }
  
  getEmployeeName(sessionId: string): string | undefined {
    return this.sessionToEmployee.get(sessionId)
  }
}

export const sessionRegistry = new SessionRegistry()
```

### 4.2 Agent 注册表

```typescript
// src/utils/AgentRegistry.ts
interface AgentInfo {
  employeeName: string
  taskName: string
}

class AgentRegistry {
  private agents = new Map<string, AgentInfo>()
  
  register(agentId: string, info: AgentInfo): void {
    this.agents.set(agentId, info)
  }
  
  getInfo(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId)
  }
  
  isOurAgent(agentId: string): boolean {
    return this.agents.has(agentId)
  }
}

export const agentRegistry = new AgentRegistry()
```

---

## 5. 使用示例

### 5.1 员工发送消息

AI 调用工具：
```json
{
  "tool": "send_message",
  "args": {
    "to": "bayecao",
    "content": "结果是 2"
  }
}
```

### 5.2 员工管理任务

AI 调用工具：
```json
{
  "tool": "edit_tasks",
  "args": {
    "operations": [
      {
        "action": "add",
        "name": "计算1+1",
        "description": "为 bayecao 计算 1+1",
        "dependencies": []
      },
      {
        "action": "update",
        "name": "计算1+1",
        "status": "completed",
        "result": "2"
      }
    ]
  }
}
```

### 5.3 员工创建 Agent

AI 调用工具：
```json
{
  "tool": "create_agent",
  "args": {
    "task_name": "计算复杂表达式",
    "prompt": "请计算 (123 + 456) * 789 的结果"
  }
}
```

---

## 6. 实现清单

- [ ] 工具定义
  - [ ] sendMessageTool
  - [ ] editTasksTool
  - [ ] createAgentTool
  - [ ] hireEmployeeTool
- [ ] 辅助模块
  - [ ] SessionRegistry
  - [ ] AgentRegistry
- [ ] 插件注册
  - [ ] 工具注册
  - [ ] 权限控制
