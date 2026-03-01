# 事件循环设计文档 (EventLoop)

## 1. 概述

事件循环是员工的核心运行机制，负责等待事件、处理事件、调用 AI、管理 session 生命周期。

### 1.1 设计原则

- **事件驱动**：通过事件触发员工行动
- **异步非阻塞**：使用 async/await 实现并发
- **Session 复用**：session 持续使用直到达到 token 阈值
- **自动总结**：达到阈值时自动总结记忆

### 1.2 核心功能

- 事件等待和分发
- Session 生命周期管理
- 上下文构建和 AI 调用
- 记忆总结触发

---

## 2. 架构设计

### 2.1 类图

```typescript
class EventLoop {
  private currentSession: Session | null = null
  
  constructor(
    private employeeName: string,
    private role: Role,
    private messageClient: MessageClient,
    private memoryManager: MemoryManager,
    private opcodeClient: OpencodeClient
  )
  
  // 主循环
  async run(): Promise<void>
  
  // 事件等待
  private async waitForEvent(): Promise<Event>
  
  // 处理事件
  private async handleEvent(event: Event): Promise<void>
  
  // Session 管理
  private async ensureSession(): Promise<Session>
  private async closeSession(): Promise<void>
  
  // 上下文构建
  private async buildSystemPrompt(): Promise<string>
  private buildEventMessage(event: Event): string
  
  // 总结机制
  private async summarizeIfNeeded(): Promise<void>
}
```

### 2.2 事件类型

```typescript
type Event = MessageEvent | AgentEvent

interface MessageEvent {
  type: 'message'
  from: string
  content: string
  timestamp: string
}

interface AgentEvent {
  type: 'agent_completed'
  agentId: string
  taskName: string
  result: string
  timestamp: string
}
```

---

## 3. 核心流程

### 3.1 主循环

```typescript
async run(): Promise<void> {
  console.log(`[${this.employeeName}] Starting event loop...`)
  
  while (true) {
    try {
      // 1. 等待事件
      const event = await this.waitForEvent()
      
      // 2. 处理事件
      await this.handleEvent(event)
      
      // 3. 检查是否需要总结
      await this.summarizeIfNeeded()
      
    } catch (error) {
      console.error(`[${this.employeeName}] Error in event loop:`, error)
      // 继续循环，不退出
    }
  }
}
```

### 3.2 事件等待

```typescript
private async waitForEvent(): Promise<Event> {
  // 并发等待多种事件源
  return Promise.race([
    // 1. 等待新消息
    this.messageClient.recv().then(msg => ({
      type: 'message' as const,
      from: msg.from,
      content: msg.content,
      timestamp: msg.timestamp
    })),
    
    // 2. 等待 Agent 完成（通过 SDK event subscription）
    this.waitForAgentCompletion()
  ])
}

private async waitForAgentCompletion(): Promise<AgentEvent> {
  // 订阅 OpenCode 事件流
  const events = await this.opcodeClient.event.subscribe()
  
  for await (const event of events.stream) {
    if (event.payload.type === 'session.status') {
      // 检查是否是我们创建的 agent session
      const sessionId = event.payload.properties.sessionID
      if (this.isOurAgent(sessionId)) {
        return {
          type: 'agent_completed',
          agentId: sessionId,
          taskName: this.getTaskName(sessionId),
          result: await this.getAgentResult(sessionId),
          timestamp: new Date().toISOString()
        }
      }
    }
  }
  
  // 永远不会到达这里（for await 会一直等待）
  throw new Error('Unexpected end of event stream')
}
```

### 3.3 处理事件

```typescript
private async handleEvent(event: Event): Promise<void> {
  console.log(`[${this.employeeName}] Received event:`, event.type)
  
  // 1. 确保 session 存在
  const session = await this.ensureSession()
  
  // 2. 构建事件消息
  const eventMessage = this.buildEventMessage(event)
  
  // 3. 发送给 AI
  await this.opcodeClient.session.prompt({
    path: { id: session.id },
    body: {
      parts: [
        { type: 'text', text: eventMessage }
      ],
      tools: {
        'send_message': true,
        'edit_tasks': true,
        'create_agent': true
      }
    }
  })
  
  // 4. AI 会自动调用工具，工具执行完成后返回
  console.log(`[${this.employeeName}] Event handled`)
}
```

### 3.4 Session 管理

```typescript
private async ensureSession(): Promise<Session> {
  if (this.currentSession) {
    return this.currentSession
  }
  
  // 创建新 session
  const systemPrompt = await this.buildSystemPrompt()
  
  const response = await this.opcodeClient.session.create({
    body: {
      title: `${this.employeeName} - ${new Date().toISOString()}`,
      system: systemPrompt
    }
  })
  
  this.currentSession = response.data
  console.log(`[${this.employeeName}] Created session: ${this.currentSession.id}`)
  
  return this.currentSession
}

private async closeSession(): Promise<void> {
  if (!this.currentSession) return
  
  console.log(`[${this.employeeName}] Closing session: ${this.currentSession.id}`)
  this.currentSession = null
}
```

### 3.5 上下文构建

```typescript
private async buildSystemPrompt(): Promise<string> {
  return await this.memoryManager.buildSystemPrompt(
    this.employeeName,
    this.role.systemPrompt
  )
}

private buildEventMessage(event: Event): string {
  if (event.type === 'message') {
    return `
# 当前事件
类型: 消息事件
发送者: ${event.from}
内容: ${event.content}
时间: ${event.timestamp}
`.trim()
  }
  
  if (event.type === 'agent_completed') {
    return `
# 当前事件
类型: Agent 完成事件
Agent ID: ${event.agentId}
关联任务: ${event.taskName}
执行结果: ${event.result}
时间: ${event.timestamp}
`.trim()
  }
  
  return ''
}
```

### 3.6 总结机制

```typescript
private async summarizeIfNeeded(): Promise<void> {
  if (!this.currentSession) return
  
  // 获取当前 session 的 token 使用情况
  const session = await this.opcodeClient.session.get({
    path: { id: this.currentSession.id }
  })
  
  const TOKEN_THRESHOLD = 100000  // 10万 token
  
  if (session.data.tokens.total >= TOKEN_THRESHOLD) {
    console.log(`[${this.employeeName}] Token threshold reached, summarizing...`)
    
    // 1. 请求 AI 总结
    const summary = await this.requestSummary()
    
    // 2. 保存总结
    await this.memoryManager.summarize(this.employeeName, summary)
    
    // 3. 关闭当前 session
    await this.closeSession()
    
    console.log(`[${this.employeeName}] Summary completed`)
  }
}

private async requestSummary(): Promise<{ knowledge: string[], custom: Record<string, any> }> {
  if (!this.currentSession) {
    throw new Error('No active session')
  }
  
  // 使用 structured output 获取总结
  const response = await this.opcodeClient.session.prompt({
    path: { id: this.currentSession.id },
    body: {
      parts: [
        {
          type: 'text',
          text: '请总结你的经验知识和自定义数据。'
        }
      ],
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            knowledge: {
              type: 'array',
              items: { type: 'string' },
              description: '经验知识列表'
            },
            custom: {
              type: 'object',
              description: '自定义数据'
            }
          },
          required: ['knowledge', 'custom']
        }
      }
    }
  })
  
  return response.data.info.structured as { knowledge: string[], custom: Record<string, any> }
}
```

---

## 4. 并发控制

### 4.1 多员工并行

```typescript
// 在插件入口启动多个员工
async function startEmployees() {
  const employees = [
    { name: 'calculator', role: CalculatorRole },
    // 未来可以添加更多员工
  ]
  
  // 并行启动所有员工
  await Promise.all(
    employees.map(async ({ name, role }) => {
      const messageClient = messageService.getClient(name)
      const eventLoop = new EventLoop(
        name,
        role,
        messageClient,
        memoryManager,
        opcodeClient
      )
      
      // 每个员工独立运行
      await eventLoop.run()
    })
  )
}
```

### 4.2 错误隔离

```typescript
async run(): Promise<void> {
  while (true) {
    try {
      const event = await this.waitForEvent()
      await this.handleEvent(event)
      await this.summarizeIfNeeded()
    } catch (error) {
      console.error(`[${this.employeeName}] Error:`, error)
      
      // 错误不影响其他员工
      // 继续循环
    }
  }
}
```

---

## 5. 实现清单

- [ ] EventLoop 类
  - [ ] 构造函数和初始化
  - [ ] run() 主循环
- [ ] 事件等待
  - [ ] waitForEvent() 方法
  - [ ] waitForAgentCompletion() 方法
- [ ] 事件处理
  - [ ] handleEvent() 方法
  - [ ] buildEventMessage() 方法
- [ ] Session 管理
  - [ ] ensureSession() 方法
  - [ ] closeSession() 方法
- [ ] 上下文构建
  - [ ] buildSystemPrompt() 方法
- [ ] 总结机制
  - [ ] summarizeIfNeeded() 方法
  - [ ] requestSummary() 方法
