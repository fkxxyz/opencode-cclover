# 数据模型定义

本文档定义了 Console 前后端通信使用的所有数据模型。所有类型定义使用 TypeScript 语法。

## 1. 员工 (Employee)

### 1.1 基本类型

```typescript
interface Employee {
  name: string                // 员工名称(唯一标识)
  role: string                // 所属角色
  status: EmployeeStatus      // 当前状态
  createdAt: string           // 创建时间 (ISO 8601)
  lastActiveAt: string        // 最后活跃时间 (ISO 8601)
  hiredBy?: string            // 雇佣者名称(可选,根节点为null)
}

type EmployeeStatus = "active" | "idle" | "error" | "inactive"
```

### 1.2 状态说明

| 状态 | 含义 | 颜色 |
|------|------|------|
| `active` | 活跃中(正在处理任务或消息) | 🟢 绿色 |
| `idle` | 空闲(等待事件) | 🟡 黄色 |
| `error` | 错误(执行失败或异常) | 🔴 红色 |
| `inactive` | 未启动 | ⚪ 灰色 |

### 1.3 完整员工信息

```typescript
interface EmployeeDetail extends Employee {
  memory: Memory              // 记忆数据
  tasks: Task[]               // 任务列表
  agents: AgentExecution[]    // Agent执行记录
}
```

### 1.4 雇佣关系树

```typescript
interface EmployeeHierarchy {
  name: string                // 员工名称
  role: string                // 所属角色
  status: EmployeeStatus      // 当前状态
  children: EmployeeHierarchy[]  // 下属员工
}
```

---

## 2. 消息 (Message)

```typescript
interface Message {
  timestamp: string           // 消息时间戳 (ISO 8601)
  from: string                // 发送者名称
  to: string                  // 接收者名称
  content: string             // 消息内容
  direction: MessageDirection // 消息方向(相对于当前员工)
}

type MessageDirection = "send" | "receive"
```

### 2.1 字段说明

- `timestamp`: ISO 8601 格式,如 `"2026-03-01T10:00:00Z"`
- `direction`: 相对于当前查看的员工
  - `"send"`: 该员工发送的消息
  - `"receive"`: 该员工接收的消息

---

## 3. 任务 (Task)

```typescript
interface Task {
  name: string                // 任务名称(唯一标识)
  status: TaskStatus          // 任务状态
  description: string         // 任务描述
  result?: string             // 任务结果(完成时填写)
  dependencies: string[]      // 依赖的任务名称列表
  created: string             // 创建时间 (ISO 8601)
  completed?: string          // 完成时间 (ISO 8601,可选)
}

type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled"
```

### 3.1 状态说明

| 状态 | 含义 |
|------|------|
| `pending` | 待处理(依赖未满足或未开始) |
| `in_progress` | 进行中 |
| `completed` | 已完成 |
| `cancelled` | 已取消 |

### 3.2 可执行任务

```typescript
interface TasksResponse {
  tasks: Task[]               // 所有任务
  executableTasks: string[]   // 可执行任务名称列表(依赖已满足)
}
```

---

## 4. 记忆 (Memory)

```typescript
interface Memory {
  knowledge: string[]         // 经验知识列表
  custom: Record<string, any> // 自定义字段(JSON对象)
}
```

### 4.1 字段说明

- `knowledge`: 员工积累的经验知识,每条一行
- `custom`: 自定义数据,可以存储任意JSON对象

### 4.2 示例

```json
{
  "knowledge": [
    "alice 经常问我数学计算问题",
    "bob 喜欢用简洁的回答"
  ],
  "custom": {
    "preferences": {
      "language": "zh-CN",
      "timezone": "Asia/Shanghai"
    },
    "statistics": {
      "totalMessages": 42,
      "totalTasks": 15
    }
  }
}
```

---

## 5. Agent 执行记录 (AgentExecution)

```typescript
interface AgentExecution {
  agentId: string             // Agent ID
  taskName: string            // 关联的任务名称
  status: AgentStatus         // 执行状态
  createdAt: string           // 创建时间 (ISO 8601)
  completedAt?: string        // 完成时间 (ISO 8601,可选)
  result?: string             // 执行结果(可选)
}

type AgentStatus = "running" | "completed" | "failed"
```

### 5.1 状态说明

| 状态 | 含义 |
|------|------|
| `running` | 运行中 |
| `completed` | 已完成 |
| `failed` | 失败 |

---

## 6. 事件 (Event)

```typescript
interface Event {
  type: EventType             // 事件类型
  timestamp: string           // 事件时间戳 (ISO 8601)
  employeeName?: string       // 相关员工名称(可选)
  details: Record<string, any>  // 事件详情(JSON对象)
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
```

### 6.1 事件详情格式

不同事件类型的 `details` 字段格式:

#### 6.1.1 消息事件 (`message`)

```typescript
{
  from: string      // 发送者
  to: string        // 接收者
  content: string   // 消息内容
}
```

#### 6.1.2 任务事件 (`task_completed`, `task_failed`)

```typescript
{
  taskName: string  // 任务名称
  result?: string   // 任务结果(可选)
  error?: string    // 错误信息(失败时)
}
```

#### 6.1.3 Agent事件 (`agent_completed`, `agent_failed`)

```typescript
{
  agentId: string   // Agent ID
  taskName: string  // 关联任务
  result?: string   // 执行结果(可选)
  error?: string    // 错误信息(失败时)
}
```

#### 6.1.4 定时器事件 (`timer`)

```typescript
{
  interval: number  // 定时器间隔(毫秒)
}
```

#### 6.1.5 员工雇佣事件 (`employee_hired`)

```typescript
{
  employeeName: string  // 新员工名称
  role: string          // 角色
  hiredBy: string       // 雇佣者
}
```

#### 6.1.6 员工状态变化事件 (`employee_status_changed`)

```typescript
{
  oldStatus: EmployeeStatus  // 旧状态
  newStatus: EmployeeStatus  // 新状态
}
```

---

## 7. API 响应包装

所有 API 响应都遵循统一格式:

### 7.1 成功响应

```typescript
interface SuccessResponse<T> {
  success: true
  data: T
}
```

### 7.2 错误响应

```typescript
interface ErrorResponse {
  success: false
  error: {
    code: string      // 错误码
    message: string   // 错误消息
  }
}
```

### 7.3 错误码定义

| 错误码 | 含义 |
|--------|------|
| `EMPLOYEE_NOT_FOUND` | 员工不存在 |
| `INVALID_PARAMETER` | 参数无效 |
| `INTERNAL_ERROR` | 内部错误 |
| `FILE_READ_ERROR` | 文件读取失败 |
| `FILE_WRITE_ERROR` | 文件写入失败 |

---

## 8. WebSocket 消息

### 8.1 消息包装

```typescript
interface WebSocketMessage {
  type: "event"           // 消息类型(目前只有event)
  data: Event             // 事件数据
}
```

### 8.2 连接状态

```typescript
type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error"
```

---

## 9. 类型导出

前端和后端应该共享这些类型定义。建议:

**后端**: 在 `src/types/index.ts` 中定义
**前端**: 在 `console/src/types/index.ts` 中定义(复制或共享)

### 9.1 完整导出列表

```typescript
// 员工相关
export type { Employee, EmployeeStatus, EmployeeDetail, EmployeeHierarchy }

// 消息相关
export type { Message, MessageDirection }

// 任务相关
export type { Task, TaskStatus, TasksResponse }

// 记忆相关
export type { Memory }

// Agent相关
export type { AgentExecution, AgentStatus }

// 事件相关
export type { Event, EventType }

// API响应
export type { SuccessResponse, ErrorResponse }

// WebSocket
export type { WebSocketMessage, ConnectionStatus }
```

---

## 10. 数据验证

### 10.1 时间格式

所有时间字段必须使用 ISO 8601 格式:
- 格式: `YYYY-MM-DDTHH:mm:ss.sssZ`
- 示例: `"2026-03-01T10:00:00.000Z"`
- 时区: UTC (Z 后缀)

### 10.2 字符串长度限制

| 字段 | 最大长度 |
|------|----------|
| `Employee.name` | 100 |
| `Employee.role` | 100 |
| `Message.content` | 10000 |
| `Task.name` | 200 |
| `Task.description` | 2000 |
| `Task.result` | 5000 |

### 10.3 数组长度限制

| 字段 | 最大长度 |
|------|----------|
| `Memory.knowledge` | 1000 |
| `Task.dependencies` | 50 |

---

## 11. 版本控制

**当前版本**: v1.0.0

### 11.1 版本变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0.0 | 2026-03-01 | 初始版本 |

### 11.2 兼容性策略

- **主版本号变更**: 不兼容的破坏性变更
- **次版本号变更**: 向后兼容的功能新增
- **修订号变更**: 向后兼容的问题修复
