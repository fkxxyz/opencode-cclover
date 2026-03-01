# WebSocket 协议规范

本文档定义了 Console 前后端之间的 WebSocket 实时通信协议。

## 1. 基本信息

### 1.1 连接信息

- **WebSocket URL**: `ws://localhost:4097/ws`
- **协议**: WebSocket (RFC 6455)
- **消息格式**: JSON

### 1.2 连接生命周期

```
客户端                                服务器
  |                                     |
  |--- WebSocket 连接请求 ------------->|
  |<-- 连接建立 (101 Switching) --------|
  |                                     |
  |<-- 事件推送 (JSON消息) -------------|
  |<-- 事件推送 (JSON消息) -------------|
  |<-- 事件推送 (JSON消息) -------------|
  |                                     |
  |--- Ping (心跳) -------------------->|
  |<-- Pong (心跳响应) -----------------|
  |                                     |
  |--- Close (关闭连接) --------------->|
  |<-- Close (确认关闭) ----------------|
```

---

## 2. 连接管理

### 2.1 建立连接

**客户端代码示例**:
```typescript
const ws = new WebSocket("ws://localhost:4097/ws")

ws.onopen = () => {
  console.log("WebSocket 连接已建立")
}

ws.onerror = (error) => {
  console.error("WebSocket 错误:", error)
}

ws.onclose = (event) => {
  console.log("WebSocket 连接已关闭:", event.code, event.reason)
}
```

### 2.2 心跳机制

**目的**: 保持连接活跃,检测连接断开

**实现**:
- 客户端每 30 秒发送一次 Ping 帧
- 服务器收到 Ping 后立即回复 Pong 帧
- 如果 60 秒内未收到 Pong,客户端认为连接断开并重连

**客户端代码示例**:
```typescript
let pingInterval: NodeJS.Timeout

ws.onopen = () => {
  // 启动心跳
  pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.ping()
    }
  }, 30000)
}

ws.onclose = () => {
  // 停止心跳
  clearInterval(pingInterval)
}
```

### 2.3 断线重连

**策略**: 指数退避重连

**实现**:
```typescript
let reconnectAttempts = 0
const maxReconnectAttempts = 10
const baseDelay = 1000 // 1秒

function connect() {
  const ws = new WebSocket("ws://localhost:4097/ws")
  
  ws.onopen = () => {
    reconnectAttempts = 0 // 重置重连计数
  }
  
  ws.onclose = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = baseDelay * Math.pow(2, reconnectAttempts)
      console.log(`${delay}ms 后重连...`)
      setTimeout(connect, delay)
      reconnectAttempts++
    } else {
      console.error("达到最大重连次数,停止重连")
    }
  }
}
```

---

## 3. 消息格式

### 3.1 消息包装

所有服务器推送的消息都遵循统一格式:

```typescript
interface WebSocketMessage {
  type: "event"           // 消息类型(目前只有event)
  data: Event             // 事件数据
}
```

### 3.2 事件数据格式

```typescript
interface Event {
  type: EventType             // 事件类型
  timestamp: string           // 事件时间戳 (ISO 8601)
  employeeName?: string       // 相关员工名称(可选)
  details: Record<string, any>  // 事件详情
}

type EventType = 
  | "message"                 // 消息事件
  | "task_completed"          // 任务完成
  | "task_failed"             // 任务失败
  | "agent_completed"         // Agent完成
  | "agent_failed"            // Agent失败
  | "timer"                   // 定时器事件
  | "employee_hired"          // 员工雇佣
  | "employee_status_changed" // 员工状态变化
  | "message_sent"            // 消息发送
  | "message_received"        // 消息接收
  | "task_updated"            // 任务状态更新
  | "agent_updated"           // Agent状态更新
```

---

## 4. 事件类型详解

### 4.1 消息事件 (`message`)

**触发时机**: 员工收到或发送消息时

**消息示例**:
```json
{
  "type": "event",
  "data": {
    "type": "message",
    "timestamp": "2026-03-01T10:00:00.000Z",
    "employeeName": "calculator",
    "details": {
      "from": "alice",
      "to": "calculator",
      "content": "计算 1+1"
    }
  }
}
```

**details 字段**:
- `from`: 发送者名称
- `to`: 接收者名称
- `content`: 消息内容

---

### 4.2 任务完成事件 (`task_completed`)

**触发时机**: 员工完成任务时

**消息示例**:
```json
{
  "type": "event",
  "data": {
    "type": "task_completed",
    "timestamp": "2026-03-01T10:00:05.000Z",
    "employeeName": "calculator",
    "details": {
      "taskName": "计算1+1",
      "result": "2"
    }
  }
}
```

**details 字段**:
- `taskName`: 任务名称
- `result`: 任务结果

---

### 4.3 员工状态变化事件 (`employee_status_changed`)

**触发时机**: 员工状态改变时

**消息示例**:
```json
{
  "type": "event",
  "data": {
    "type": "employee_status_changed",
    "timestamp": "2026-03-01T10:00:00.000Z",
    "employeeName": "calculator",
    "details": {
      "oldStatus": "idle",
      "newStatus": "active"
    }
  }
}
```

**details 字段**:
- `oldStatus`: 旧状态
- `newStatus`: 新状态

---

## 5. 客户端实现示例

```typescript
class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private baseDelay = 1000
  private pingInterval: NodeJS.Timeout | null = null
  private eventHandlers: Map<EventType, (event: Event) => void> = new Map()

  connect() {
    this.ws = new WebSocket("ws://localhost:4097/ws")

    this.ws.onopen = () => {
      console.log("WebSocket 连接已建立")
      this.reconnectAttempts = 0
      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        if (message.type === "event") {
          this.handleEvent(message.data)
        }
      } catch (error) {
        console.error("解析 WebSocket 消息失败:", error)
      }
    }

    this.ws.onerror = (error) => {
      console.error("WebSocket 错误:", error)
    }

    this.ws.onclose = () => {
      console.log("WebSocket 连接已关闭")
      this.stopHeartbeat()
      this.reconnect()
    }
  }

  private startHeartbeat() {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping()
      }
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = this.baseDelay * Math.pow(2, this.reconnectAttempts)
      console.log(`${delay}ms 后重连...`)
      setTimeout(() => this.connect(), delay)
      this.reconnectAttempts++
    } else {
      console.error("达到最大重连次数,停止重连")
    }
  }

  private handleEvent(event: Event) {
    const handler = this.eventHandlers.get(event.type)
    if (handler) {
      handler(event)
    }
  }

  on(eventType: EventType, handler: (event: Event) => void) {
    this.eventHandlers.set(eventType, handler)
  }

  disconnect() {
    this.stopHeartbeat()
    this.ws?.close()
    this.ws = null
  }
}
```

---

## 6. 服务器实现要点

### 6.1 Bun.serve WebSocket 处理

```typescript
const clients = new Set<WebSocket>()

const server = Bun.serve({
  port: 4097,
  fetch(req, server) {
    const url = new URL(req.url)
    
    if (url.pathname === "/ws") {
      const success = server.upgrade(req)
      if (success) {
        return undefined
      }
      return new Response("WebSocket upgrade failed", { status: 500 })
    }
    
    return handleHttpRequest(req)
  },
  websocket: {
    open(ws) {
      console.log("WebSocket 客户端连接")
      clients.add(ws)
    },
    message(ws, message) {
      console.log("收到消息:", message)
    },
    close(ws) {
      console.log("WebSocket 客户端断开")
      clients.delete(ws)
    },
  },
})

// 广播事件到所有客户端
function broadcastEvent(event: Event) {
  const message: WebSocketMessage = {
    type: "event",
    data: event,
  }
  const json = JSON.stringify(message)
  
  for (const client of clients) {
    client.send(json)
  }
}
```

---

## 7. 版本控制

**当前版本**: v1.0.0

### 7.1 版本变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0.0 | 2026-03-01 | 初始版本 |
