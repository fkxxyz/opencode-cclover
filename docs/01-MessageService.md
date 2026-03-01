# 消息服务设计文档 (MessageService)

## 1. 概述

消息服务是多 Agent 协作系统的核心通信模块，负责员工之间的消息收发和同步。

### 1.1 设计原则

- **去中心化存储**：每个员工本地存储自己的消息
- **中心化服务**：统一的消息服务负责同步
- **只读客户端**：员工只能读取消息，不能直接写入

### 1.2 核心功能

- 消息发送和接收
- 未读消息队列管理
- 消息持久化（YAML 格式）
- 事件通知机制

---

## 2. 文件结构

### 2.1 目录布局

```
{ctx.directory}/.cclover/workspace/employees/
├── calculator/
│   └── messages/
│       └── bayecao/
│           └── chat.yaml      # calculator 和 bayecao 的聊天记录
└── bayecao/
    └── messages/
        └── calculator/
            └── chat.yaml      # bayecao 和 calculator 的聊天记录（同一份对话）
```

### 2.2 消息文件格式 (YAML)

```yaml
# calculator/messages/bayecao/chat.yaml
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

**字段说明：**
- `timestamp`：消息时间戳（ISO 8601 格式）
- `direction`：消息方向（`send` 或 `receive`）
- `content`：消息内容

---

## 3. 架构设计

### 3.1 类图

```typescript
class MessageService {
  private clients: Map<string, MessageClient>
  private unreadQueues: Map<string, Message[]>
  private eventEmitter: EventEmitter
  
  constructor(workspaceRoot: string)
  getClient(employeeName: string): MessageClient
  send(from: string, to: string, content: string): Promise<void>
  private notifyNewMessage(to: string, message: Message): void
}

class MessageClient {
  constructor(
    private employeeName: string,
    private service: MessageService
  )
  
  recv(): Promise<Message>
  send(to: string, content: string): Promise<void>
  history(peer: string, limit?: number): Promise<Message[]>
}

interface Message {
  from: string
  content: string
  timestamp: string
}
```

### 3.2 组件关系

```
┌─────────────────────────────────────────┐
│         MessageService                  │
│  ┌───────────────────────────────────┐  │
│  │  unreadQueues: Map<string, []>    │  │
│  │  eventEmitter: EventEmitter       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌─────────────┐    ┌─────────────┐   │
│  │ calculator  │    │  bayecao    │   │
│  │   client    │    │   client    │   │
│  └─────────────┘    └─────────────┘   │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
    ┌─────────┐          ┌─────────┐
    │ YAML    │          │ YAML    │
    │ Files   │          │ Files   │
    └─────────┘          └─────────┘
```

---

## 4. 核心流程

### 4.1 消息发送流程

```typescript
async send(from: string, to: string, content: string): Promise<void> {
  const timestamp = new Date().toISOString()
  const message: Message = { from, content, timestamp }
  
  // 1. 写入发送方的消息文件
  await this.appendMessage(from, to, {
    timestamp,
    direction: 'send',
    content
  })
  
  // 2. 写入接收方的消息文件
  await this.appendMessage(to, from, {
    timestamp,
    direction: 'receive',
    content
  })
  
  // 3. 添加到接收方的未读队列
  this.addToUnreadQueue(to, message)
  
  // 4. 触发事件通知接收方
  this.notifyNewMessage(to, message)
}
```

**关键点：**
- 顺序写入双方文件（简单实现，不考虑严格原子性）
- 写入完成后才触发事件
- 未读消息在内存中维护

### 4.2 消息接收流程

```typescript
async recv(): Promise<Message> {
  // 1. 检查未读队列
  const queue = this.service.getUnreadQueue(this.employeeName)
  
  if (queue.length > 0) {
    // 2. 如果有未读消息，立即返回第一条
    return queue.shift()!
  }
  
  // 3. 如果没有未读消息，返回 Promise 并等待
  return new Promise((resolve) => {
    const listener = (message: Message) => {
      this.service.eventEmitter.off(`message:${this.employeeName}`, listener)
      resolve(message)
    }
    this.service.eventEmitter.on(`message:${this.employeeName}`, listener)
  })
}
```

**关键点：**
- 优先消费未读队列
- 队列为空时返回 Promise，通过 EventEmitter 实现"阻塞"
- 收到消息后自动移除监听器

### 4.3 历史消息查询

```typescript
async history(peer: string, limit?: number): Promise<Message[]> {
  // 1. 读取消息文件
  const filePath = this.getMessageFilePath(this.employeeName, peer)
  const content = await fs.readFile(filePath, 'utf-8')
  
  // 2. 解析 YAML
  const messages = yaml.parse(content) as YamlMessage[]
  
  // 3. 转换格式
  const result = messages.map(msg => ({
    from: msg.direction === 'receive' ? peer : this.employeeName,
    content: msg.content,
    timestamp: msg.timestamp
  }))
  
  // 4. 限制数量
  if (limit) {
    return result.slice(-limit)
  }
  
  return result
}
```

---

## 5. 数据结构

### 5.1 内存数据结构

```typescript
// 未读消息队列（每个员工一个队列）
private unreadQueues: Map<string, Message[]> = new Map()

// 示例：
// unreadQueues = {
//   "calculator": [
//     { from: "bayecao", content: "计算 1+1", timestamp: "..." }
//   ],
//   "bayecao": []
// }
```

### 5.2 文件数据结构

```yaml
# YAML 文件中的消息格式
- timestamp: string      # ISO 8601 格式
  direction: "send" | "receive"
  content: string
```

---

## 6. 错误处理

### 6.1 文件操作错误

```typescript
async appendMessage(owner: string, peer: string, message: YamlMessage): Promise<void> {
  try {
    const filePath = this.getMessageFilePath(owner, peer)
    
    // 确保目录存在
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    
    // 读取现有内容
    let messages: YamlMessage[] = []
    if (await fs.exists(filePath)) {
      const content = await fs.readFile(filePath, 'utf-8')
      messages = yaml.parse(content) || []
    }
    
    // 追加新消息
    messages.push(message)
    
    // 写入文件
    await fs.writeFile(filePath, yaml.stringify(messages), 'utf-8')
    
  } catch (error) {
    console.error(`Failed to append message: ${error}`)
    throw error
  }
}
```

### 6.2 并发控制

**第一版简化处理：**
- 不实现文件锁
- 依赖 JavaScript 单线程特性
- 如果写入失败，抛出错误并记录日志

---

## 7. 性能考虑

### 7.1 文件读写优化

- **追加写入**：每次只追加新消息，不重写整个文件
- **延迟加载**：历史消息按需加载，不预加载
- **内存队列**：未读消息在内存中维护，减少文件读取

### 7.2 扩展性

**当前设计限制：**
- 单个消息文件可能变大（长期对话）
- 所有消息保存在一个文件中

**未来优化方向：**
- 按日期分片存储
- 定期归档旧消息
- 使用数据库替代文件系统

---

## 8. 测试策略

### 8.1 单元测试

```typescript
describe('MessageService', () => {
  test('send and receive message', async () => {
    const service = new MessageService(workspaceRoot)
    const alice = service.getClient('alice')
    const bob = service.getClient('bob')
    
    // Alice 发送消息
    await alice.send('bob', 'Hello')
    
    // Bob 接收消息
    const message = await bob.recv()
    expect(message.from).toBe('alice')
    expect(message.content).toBe('Hello')
  })
  
  test('unread queue', async () => {
    const service = new MessageService(workspaceRoot)
    const alice = service.getClient('alice')
    const bob = service.getClient('bob')
    
    // 发送多条消息
    await alice.send('bob', 'Message 1')
    await alice.send('bob', 'Message 2')
    
    // 按顺序接收
    const msg1 = await bob.recv()
    const msg2 = await bob.recv()
    
    expect(msg1.content).toBe('Message 1')
    expect(msg2.content).toBe('Message 2')
  })
})
```

### 8.2 集成测试

- 测试文件持久化
- 测试多员工并发收发
- 测试历史消息查询

---

## 9. 使用示例

### 9.1 初始化服务

```typescript
import { MessageService } from './core/MessageService'

const workspaceRoot = path.join(ctx.directory, '.cclover/workspace')
const messageService = new MessageService(workspaceRoot)
```

### 9.2 创建客户端

```typescript
const calculatorClient = messageService.getClient('calculator')
const bayecaoClient = messageService.getClient('bayecao')
```

### 9.3 发送和接收消息

```typescript
// Bayecao 发送消息
await bayecaoClient.send('calculator', '计算 1+1')

// Calculator 接收消息
const message = await calculatorClient.recv()
console.log(message.content)  // "计算 1+1"

// Calculator 回复
await calculatorClient.send('bayecao', '结果是 2')
```

### 9.4 查询历史

```typescript
// 查询最近 10 条消息
const history = await calculatorClient.history('bayecao', 10)
console.log(history)
```

---

## 10. 实现清单

- [ ] MessageService 类
  - [ ] 构造函数和初始化
  - [ ] send() 方法
  - [ ] getClient() 方法
  - [ ] 未读队列管理
  - [ ] EventEmitter 集成
- [ ] MessageClient 类
  - [ ] recv() 方法
  - [ ] send() 方法
  - [ ] history() 方法
- [ ] 文件操作
  - [ ] appendMessage() 方法
  - [ ] 目录创建
  - [ ] YAML 解析和序列化
- [ ] 测试
  - [ ] 单元测试
  - [ ] 集成测试
- [ ] 文档
  - [ ] API 文档
  - [ ] 使用示例
