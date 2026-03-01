# 多 Agent 自主协作系统 - 需求文档

## 1. 项目概述

### 1.1 项目目标
构建一个基于 OpenCode SDK 的多 Agent 自主协作系统，模拟员工之间的协作行为。员工可以收发消息、管理任务、创建 Agent 执行工作，实现自主决策和并行工作。

### 1.2 实现方式
- 通过 OpenCode 插件实现
- 插件启动时自动运行，无需额外部署
- 使用 OpenCode SDK 创建和管理 Agent

### 1.3 核心特性
- **事件驱动**：通过消息、任务完成等事件触发员工行动
- **自主决策**：AI 根据上下文自主决定下一步行动
- **任务管理**：支持 DAG 任务依赖，自动计算可并行执行的任务
- **记忆系统**：员工维护自己的经验知识和工作状态
- **并行执行**：支持多个 Agent 并行工作

---

## 2. 核心概念

### 2.1 角色（Role）
- **定义**：角色是员工的模板，定义了系统提示词和行为模式
- **属性**：
  - `name`：角色名称
  - `systemPrompt`：系统提示词，定义角色的职责和行为
- **示例角色**：
  - Calculator（计算器）：只做数学计算
  - Coder（程序员）：写代码、修 bug
  - PM（项目经理）：分配任务、协调工作
  - Researcher（调研员）：搜集信息、分析数据
  - Tester（测试员）：测试代码、发现问题
  - Architect（架构师）：设计系统架构

### 2.2 员工（Employee）
- **定义**：员工是角色的实例，有独立的记忆和任务状态
- **属性**：
  - `name`：员工名称（唯一标识）
  - `role`：所属角色
  - `memory`：记忆系统（见 3.3）
  - `messages`：消息历史

### 2.3 事件（Event）
- **定义**：触发员工行动的事件
- **事件类型**：
  - `MessageEvent`：收到消息
    ```typescript
    {
      type: "message",
      from: "alice",
      content: "计算 1+1",
      timestamp: "2026-03-01T10:00:00Z"
    }
    ```
  - `TaskEvent`：任务状态变化（完成、失败等）
    ```typescript
    {
      type: "task_completed",
      taskName: "计算1+1",
      result: "2",
      timestamp: "2026-03-01T10:00:05Z"
    }
    ```
  - `AgentEvent`：Agent 执行完成
    ```typescript
    {
      type: "agent_completed",
      agentId: "agent_001",
      taskName: "计算1+1",
      result: "...",
      timestamp: "2026-03-01T10:00:05Z"
    }
    ```
  - `TimerEvent`：定时触发（用于定时任务）
    ```typescript
    {
      type: "timer",
      timestamp: "2026-03-01T10:00:00Z"
    }
    ```

---

## 3. 系统架构

### 3.1 消息框架

#### 3.1.1 设计原则
- **去中心化存储**：每个员工本地存储自己的消息
- **中心化服务**：统一的消息服务负责同步
- **只读客户端**：员工只能读取消息，不能直接写入

#### 3.1.2 文件结构
```
/workspace/employees/
  ├or/
  │   └── messages/
  │       ├── alice/
  │       │   └── chat.yaml      # calculator 和 alice 的聊天记录
  │       └── bob/
  │           └── chat.yaml      # calculator 和 bob 的聊天记录
  │
  └── alice/
      └── messages/
          └── calculator/
              └── chat.yaml      # alice 和 calculator 的聊天记录（同一份对话）
```

#### 3.1.3 消息格式（YAML）
```yaml
# calculator/messages/alice/chat.yaml
- timestamp: 2026-03-01T10:00:00Z
  direction: receive
  content: 计算 1+1

- timestamp: 2026-03-01T10:00:05Z
  direction: send
  content: 结果是 2

- timestamp: 2026-03-01T10:01:00Z
  direction: receive
  content: 计算 5*6

- timestamp: 2026-03-01T10:01:03Z
  direction: send
  content: 结果是 30
```

**字段说明**：
- `timestamp`：消息时间戳（ISO 8601 格式）
- `direction`：消息方向（`send` 或 `receive`）
- `content`：消息内容

#### 3.1.4 消息服务 API

**初始化客户端**：
```typescript
const client = new MessageClient("calculator")
```

**API 方法**：

1. **recv() - 接收消息（阻塞）**
   - 无参数
   - 返回一条未读消息
   - 阻塞等待直到有新消息
   - 返回格式：
     ```typescript
     {
       from: "alice",
       content: "计算 1+1",
       timestamp: "2026-03-01T10:00:00Z"
     }
     ```

2. **send(to, content) - 发送消息**
   - 参数：
     - `to`：接收者名称
     - `content`：消息内容
   - 中心化服务同时写入双方的消息文件
   - 写入完成后返回

3. **history(peer, limit) - 查询历史**
   - 参数：
     - `peer`：对方名称
     - `limit`：返回消息数量（可选）
   - 返回指定数量的历史消息
   - 用于防止上下文爆炸

#### 3.1.5 消息同步机制
- 发送方调用 `send()` API
- 中心化服务同时追加到双方的消息文件：
  - 发送方文件：`direction: send`
  - 接收方文件：`direction: receive`
- 写入完成后 API 返回
- 接收方的 `recv()` 解除阻塞，返回新消息

#### 3.1.6 未读消息管理
- 中心化服务维护每个员工的未读消息队列
- `recv()` 调用消费一条未读消息
- 消息按时间顺序返回

---

### 3.2 记忆系统

#### 3.2.1 记忆文件结构
```yaml
# calculator/memory.yaml

# 经验知识（自由文本，AI 自主维护）
knowledge:
  - alice 经常问我数学计算问题
  - 我擅长处理四则运算和简单代数
  - 复杂的微积分问题我处理不了

# 任务状态（DAG 结构）
tasks:
  - name: "计算1+1"
    status: completed
    description: 为 alice 计算 1+1
    result: "2"
    dependencies: []
    created: 2026-03-01T10:00:00Z
    completed: 2026-03-01T10:00:05Z
    
  - name: "计算3+4"
    status: completed
    description: 为 alice 计算 3+4
    result: "7"
    dependencies: []
    created: 2026-03-01T10:01:00Z
    completed: 2026-03-01T10:01:03Z
    
  - name: "求和前两个结果"
    status: in_progress
    description: 将"计算1+1"和"计算3+4"的结果相加
    dependencies: ["计算1+1", "计算3+4"]
    created: 2026-03-01T10:02:00Z

# 角色自定义字段（不同角色可能有不同需求）
custom:
  # 例如 PM 角色可能需要：
  # team_members: [alice, bob, calculator]
  # current_sprint: sprint_5
```

#### 3.2.2 记忆字段说明

**knowledge（经验知识）**：
- 类型：字符串数组
- 内容：工作经验、知识积累、与其他员工的关系
- 维护方式：AI 自主判断并更新

**tasks（任务列表）**：
- 类型：任务对象数组
- 字段：
  - `name`：任务名称（唯一标识，AI 自己命名）
  - `status`：任务状态（`pending` | `in_progress` | `completed` | `cancelled`）
  - `description`：任务描述
  - `result`：任务结果（完成时填写）
  - `dependencies`：依赖的任务名称列表
  - `created`：创建时间
  - `completed`：完成时间（可选）
- 维护方式：通过 `edit_tasks` 工具管理

**custom（自定义字段）**：
- 类型：对象
- 内容：角色特定的数据
- 维护方式：AI 自主判断并更新

#### 3.2.3 记忆更新机制

**实时更新**：
- 任务通过 `edit_tasks` 工具实时更新
- 不需要等待总结

**定期总结**：
- 触发条件：上下文达到阈值（token 数或轮次）
- 总结内容：只总结 `knowledge` 和 `custom`
- 总结方式：
  1. 发送特殊 prompt 要求总结
  2. 使用 structured output 获取结构化记忆
  3. 保存到 `memory.yaml`
  4. 关闭当前 session
  5. 下次事件创建新 session，加载更新后的记忆

**总结 Schema**：
```typescript
{
  type: "object",
  properties: {
    knowledge: { 
      type: "array", 
      items: { type: "string" } 
    },
    custom: { 
      type: "object" 
    }
  }
}
```

---

### 3.3 任务依赖系统（DAG）

#### 3.3.1 任务依赖图
- 使用 DAG（有向无环图）表示任务依赖关系
- 任务名称作为唯一标识（AI 自己命名，不会重复）
- 支持并行执行：自动计算依赖已满足的任务

#### 3.3.2 Mermaid 可视化
- 框架自动根据 `tasks` 生成 Mermaid 图
- 喂给 AI 作为上下文，帮助理解任务进度
- 生成示例：
  ```mermaid
  graph TD
    计算1+1[completed: 计算1+1]
    计算3+4[completed: 计算3+4]
    求和结果[in_progress: 求和结果]
    计算1+1 --> 求和结果
    计算3+4 --> 求和结果
  ```

#### 3.3.3 可执行任务计算
- 扫描所有 `pending` 状态的任务
- 检查依赖的任务是否都是 `completed`
- 找出所有可以执行的任务
- 这些任务可以并行启动

---

### 3.4 工具系统

#### 3.4.1 工具调用机制
- AI 通过工具执行动作
- 支持多轮调用：每次工具调用后，AI 可以根据结果决定下一步
- AI 可以自由输出文本表示等待（不需要 `wait` 工具）

#### 3.4.2 可用工具

**1. edit_tasks - 批量编辑任务**

```typescript
{
  name: "edit_tasks",
  description: "批量编辑任务列表（添加、更新、删除任务）",
  parameters: {
    operations: [
      {
        action: "add" | "update" | "delete",
        
        // add 时必填
        name?: "任务名称",
        description?: "任务描述", 
        dependencies?: ["依赖任务列表"],
        
        // update 时必填
        name?: "任务名称",
        status?: "pending | in_progress | completed | cancelled",
        result?: "任务结果",
        
        // delete 时必填
        name?: "任务名称"
      }
    ]
  }
}
```

**使用示例**：
```json
{
  "operations": [
    {
      "action": "add",
      "name": "计算5*6",
      "description": "为 alice 计算 5*6",
      "dependencies": []
    },
    {
      "action": "update",
      "name": "计算1+1",
      "status": "completed",
      "result": "2"
    },
    {
      "action": "delete",
      "name": "已取消的任务"
    }
  ]
}
```

**2. send_message - 发送消息**

```typescript
{
  name: "send_message",
  description: "发送消息给其他员工",
  parameters: {
    to: "接收者名称",
    content: "消息内容"
  }
}
```

**3. create_agent - 创建 Agent 执行任务**

```typescript
{
  name: "create_agent",
  description: "创建 OpenCode agent 执行任务",
  parameters: {
    task_name: "关联的任务名称",
    prompt: "给 agent 的提示词"
  },
  returns: "agent_id"
}
```

**4. hire_employee - 雇佣新员工**

```typescript
{
  name: "hire_employee",
  description: "雇佣新员工",
  parameters: {
    name: "员工名称",
    role: "角色类型"
  }
}
```

---

### 3.5 员工运行循环

#### 3.5.1 运行流程

```typescript
async function employeeLoop(employeeName: string, role: Role) {
  // 1. 初始化
  const msgClient = new MessageClient(employeeName)
  const opcodeClient = createOpencodeClient()
  let currentSession = null
  
  // 2. 主循环
  while (true) {
    // 3. 等待事件（阻塞）
    const event = await waitForEvent(msgClient)
    // event 可能是 MessageEvent, TaskEvent, AgentEvent, TimerEvent
    
    // 4. 读取当前记忆
    const memory = readMemory(employeeName)
    
    // 5. 生成 Mermaid 任务图
    const mermaidGraph = generateMermaid(memory.tasks)
    
    // 6. 计算可执行的任务
    const executableTasks = calculateExecutableTasks(memory.tasks)
    
    // 7. 构建上下文
    const context = buildContext({
      rolePrompt: role.systemPrompt,
      memory: memory,
      mermaidGraph: mermaidGraph,
      executableTasks: executableTasks,
      event: event
    })
    
    // 8. 创建或复用 session
    if (!currentSession) {
      currentSession = await opcodeClient.session.create()
    }
    
    // 9. 发送 prompt 给 AI（包含工具）
    const response = await opcodeClient.session.prompt({
      path: { id: currentSession.id },
      body: {
        parts: [{ type: "text", text: context }],
        tools: [
          editTasksTool,
          sendMessageTool,
          createAgentTool,
          hireEmployeeTool
        ]
      }
    })
    
    // 10. 处理工具调用
    // AI 可能调用多次工具，每次根据结果决定下一步
    // 框架自动处理工具调用循环
    
    // 11. 检查上下文长度
    if (currentSession.tokens.total > THRESHOLD) {
      // 强制总结记忆
      const summary = await summarizeMemory(opcodeClient, currentSession)
      writeMemory(employeeName, {
        knowledge: summary.knowledge,
        tasks: memory.tasks,  // tasks 不需要总结
        custom: summary.custom
      })
      
      // 关闭 session
      currentSession = null
    }
    
    // 12. 继续循环，等待下一个事件
  }
}
```

#### 3.5.2 上下文构建

**上下文结构**：
```markdown
# 系统提示词（角色定义）
{role.systemPrompt}

# 当前记忆
## 经验知识
{memory.knowledge}

## 自定义字段
{memory.custom}

# 任务状态（Mermaid 图）
```mermaid
{mermaidGraph}
```

# 可执行的任务
以下任务的依赖已满足，可以立即执行：
{executableTasks}

# 当前事件
类型: {event.type}
{event 的其他字段}

# 你的任务
根据以上信息，决定下一步行动。你可以：
- 调用工具执行操作
- 输出文本表示等待（例如："很好，接下来只需要等待 xxx"）
```

#### 3.5.3 事件等待机制

```typescript
async function waitForEvent(msgClient: MessageClient): Promise<Event> {
  // 并发等待多种事件源
  return Promise.race([
    // 1. 等待新消息
    msgClient.recv().then(msg => ({
      type: "message",
      from: msg.from,
      content: msg.content,
      timestamp: msg.timestamp
    })),
    
    // 2. 等待任务完成（通过文件监听或轮询）
    waitForTaskCompletion(),
    
    // 3. 等待 Agent 完成
    waitForAgentCompletion(),
    
    // 4. 定时器事件
    waitForTimer()
  ])
}
```

---

## 4. 第一版实现

### 4.1 实现目标
- 验证核心机制：消息收发、任务管理、记忆维护、自主决策
- 测试角色：Calculator（计算器）

### 4.2 Calculator 角色定义

**系统提示词**：
```
你是一个计算器员工，只会做数学计算。
你的职责是接收计算请求，执行计算，并返回结果。
不要做任何其他事情。
```

**行为模式**：
1. 收到消息事件：`"计算 1+1"`
2. 直接计算（简单计算）或创建 Agent 计算（复杂计算）
3. 发送回复消息：`"结果是 2"`
4. 等待下一个消息

### 4.3 测试场景

**场景 1：简单计算**
```
alice -> calculator: "计算 1+1"
calculator -> alice: "结果是 2"
```

**场景 2：多个计算请求**
```
alice -> calculator: "计算 1+1"
bob -> calculator: "计算 5*6"
calculator -> alice: "结果是 2"
calculator -> bob: "结果是 30"
```

**场景 3：复杂计算（需要 Agent）**
```
alice -> calculator: "计算 (123 + 456) * 789"
calculator 创建 Agent 执行计算
Agent 完成 -> calculator 收到 AgentEvent
calculator -> alice: "结果是 456831"
```

### 4.4 成功标准
- ✅ 消息能正确收发
- ✅ 计算结果正确
- ✅ 记忆能正确维护
- ✅ 上下文达阈值时能正确总结
- ✅ 多个请求能正确处理

---

## 5. 技术实现

### 5.1 技术栈
- **语言**：TypeScript
- **运行环境**：OpenCode 插件
- **SDK**：@opencode-ai/sdk
- **存储**：文件系统（YAML）

### 5.2 项目结构
```
opencode-cclover/
├── src/
│   ├── core/
│   │   ├── MessageService.ts      # 消息服务
│   │   ├── MemoryManager.ts       # 记忆管理
│   │   ├── TaskManager.ts         # 任务管理（DAG）
│   │   └── EventLoop.ts           # 事件循环
│   ├── tools/
│   │   ├── EditTasksTool.ts       # edit_tasks 工具
│   │   ├── SendMessageTool.ts     # send_message 工具
│   │   ├── CreateAgentTool.ts     # create_agent 工具
│   │   └── HireEmployeeTool.ts    # hire_employee 工具
│   ├── roles/
│   │   └── Calculator.ts          # 计算器角色定义
│   ├── utils/
│   │   ├── MermaidGenerator.ts    # Mermaid 图生成
│   │   └── ContextBuilder.ts      # 上下文构建
│   └── index.ts                   # 插件入口
├── .opencode/
│   └── plugin/
│       └── manifest.json          # 插件配置
└── package.json
```

### 5.3 插件启动流程
```typescript
// src/index.ts
import { createOpencodeClient } from "@opencode-ai/sdk"

export async function activate() {
  console.log("多 Agent 协作系统启动")
  
  // 1. 初始化消息服务
  const messageService = new MessageService()
  await messageService.start()
  
  // 2. 启动第一个员工（Calculator）
  const calculator = new Employee("calculator", CalculatorRole)
  calculator.start()
  
  // 3. 插件保持运行
  // 员工的事件循环会持续运行
}
```

### 5.4 部署方式
- OpenCode 启动时自动加载插件
- 插件的 `activate()` 函数被调用
- 员工的事件循环开始运行
- 无需额外部署或配置

---

## 6. 未来扩展

### 6.1 多角色支持
- 实现 Coder、PM、Researcher、Tester、Architect 角色
- 测试多角色协作场景

### 6.2 层级管理
- 实现上下级关系
- PM 可以分配任务给 Coder
- Coder 可以向 PM 汇报进度

### 6.3 权限系统
- 不同角色有不同权限
- 例如：只有 PM 可以雇佣新员工

### 6.4 持久化优化
- 使用数据库替代文件系统
- 提高查询效率

### 6.5 监控和可视化
- 实时查看员工状态
- 可视化任务依赖图
- 查看消息历史

---

## 7. 附录

### 7.1 关键设计决策

**为什么用文件系统存储？**
- 简单直观，易于调试
- 每个员工消息量不大，不存在性能问题
- 不存在并发问题（中心化服务保证一致性）

**为什么任务用 name 而不是 id？**
- AI 自己命名，语义化
- 不会重复（AI 会避免重复命名）
- 方便生成 Mermaid 图

**为什么总结时不包含 tasks？**
- 任务通过工具实时管理，已经持久化
- 总结只需要保存 AI 的"思考"（knowledge 和 custom）

**为什么用工具调用而不是结构化输出？**
- 更灵活，支持多轮交互
- AI 可以根据工具返回结果决定下一步
- 不需要强制 AI 每次都输出完整结构

### 7.2 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 角色 | Role | 员工的模板，定义系统提示词 |
| 员工 | Employee | 角色的实例，有独立记忆和状态 |
| 事件 | Event | 触发员工行动的事件 |
| 记忆 | Memory | 员工的经验知识和任务状态 |
| 任务 | Task | 员工需要完成的工作 |
| 工具 | Tool | AI 可以调用的函数 |
| Agent | Agent | OpenCode 创建的 AI 实例 |
| DAG | Directed Acyclic Graph | 有向无环图，用于表示任务依赖 |

---

## 8. 参考资料

- OpenCode SDK 文档：`~/.config/opencode/node_modules/@opencode-ai/sdk/`
- OpenCode 插件开发指南：（待补充）
- 本项目示例：1 分钟输出 hello world 的插件实现
