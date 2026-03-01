# OpenCode CClover 管理控制台 - 需求文档

## 1. 项目概述

### 1.1 项目目标
为 OpenCode CClover 多 Agent 自主协作系统构建一个 Web 管理控制台，实时监控员工状态、消息通信、任务执行、记忆系统和事件流，提供可视化的雇佣关系树状图和详细的员工仪表盘。

### 1.2 项目定位
- **独立的 Web 应用**：与插件分离，通过 HTTP API 和 WebSocket 通信
- **实时监控系统**：展示员工的实时状态和活动
- **后台管理界面**：未来支持调试和操作功能

### 1.3 核心特性
- **实时更新**：通过 WebSocket 接收事件推送，实时刷新界面
- **可视化展示**：树状图展示雇佣关系，颜色区分员工状态
- **全面监控**：覆盖员工的所有维度（状态、消息、任务、记忆、Agent、事件）
- **响应式设计**：适配不同屏幕尺寸

---

## 2. 技术架构

### 2.1 技术栈

**前端框架**：
- React 18 + TypeScript
- Vite (构建工具)
- Bun (包管理和运行时)

**UI 组件库**：
- shadcn/ui (基于 Radix UI + Tailwind CSS)
- Tailwind CSS (样式框架)

**可视化库**：
- D3.js (树状图和数据可视化)

**通信**：
- Fetch API (HTTP 请求)
- WebSocket API (实时事件推送)

### 2.2 项目结构

```
console/
├── src/
│   ├── components/          # React 组件
│   │   ├── ui/             # shadcn/ui 组件
│   │   ├── dashboard/      # 仪表盘组件
│   │   ├── employee/       # 员工相关组件
│   │   └── visualizations/ # 可视化组件 (D3.js)
│   ├── pages/              # 页面组件
│   │   ├── Overview.tsx    # 总仪表盘
│   │   └── EmployeeDetail.tsx  # 员工详情
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useWebSocket.ts # WebSocket 连接
│   │   └── useEmployees.ts # 员工数据管理
│   ├── services/           # API 服务
│   │   └── api.ts          # HTTP API 封装
│   ├── types/              # TypeScript 类型定义
│   │   └── index.ts        # 共享类型
│   ├── lib/                # 工具函数
│   │   └── utils.ts
│   ├── App.tsx             # 根组件
│   ├── main.tsx            # 入口文件
│   └── index.css           # 全局样式
├── public/                 # 静态资源
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── components.json         # shadcn/ui 配置
└── REQUIREMENTS.md         # 本文档
```

### 2.3 通信架构

```
┌─────────────────┐         HTTP API          ┌──────────────────┐
│                 │ ◄────────────────────────► │                  │
│  Web Conse    │                            │  OpenCode Plugin │
│  (React App)    │         WebSocket          │  (Bun.serve)     │
│                 │ ◄────────────────────────► │                  │
└─────────────────┘                            └──────────────────┘
                                                        │
                                                        │ OpenCode SDK
                                                        ▼
                                                ┌──────────────────┐
                                                │  OpenCode Server │
                                                │  (Event Stream)  │
                                                └──────────────────┘
```

**HTTP API**：
- 获取员工列表
- 获取员工详情
- 获取消息历史
- 获取任务列表
- 获取记忆数据
- 获取 Agent 执行记录

**WebSocket**：
- 实时推送员工状态变化
- 实时推送新消息
- 实时推送任务状态变化
- 实时推送事件流

---

## 3. 功能需求

### 3.1 总仪表盘 (Overview)

#### 3.1.1 雇佣关系树状图

**功能描述**：
- 使用 D3.js 绘制员工雇佣关系的树状图
- 节点代表员工，边代表雇佣关系
- 根节点为初始员工（如 Calculator）

**可视化要求**：
- **节点样式**：
  - 显示员工名称和角色
  - 使用颜色区分员工状态：
    - 🟢 绿色：活跃中（正在处理任务或消息）
    - 🟡 黄色：空闲（等待事件）
    - 🔴 红色：错误（执行失败或异常）
    - ⚪ 灰色：未启动
- **交互**：
  - 点击节点跳转到员工详情页
  - 悬停显示员工基本信息（角色、状态、任务数量）
- **布局**：
  - 自动调整树的布局，避免节点重叠
  - 支持缩放和拖拽

#### 3.1.2 全局统计

**显示内容**：
- 员工总数
- 活跃员工数
- 待处理任务数
- 今日消息总数

**样式**：
- 使用卡片展示，简洁明了
- 数字大而醒目，带有图标

#### 3.1.3 实时事件流

**功能描述**：
- 显示最近的系统事件（最多 50 条）
- 事件类型包括：MessageEvent, TaskEvent, AgentEvent, TimerEvent

**显示内容**：
- 事件类型
- 事件时间
- 相关员工
- 事件描述

**样式**：
- 列表形式，最新事件在顶部
- 不同事件类型使用不同颜色标识

---

### 3.2 员工详情页 (Employee Detail)

#### 3.2.1 员工基本信息

**显示内容**：
- 员工名称
- 所属角色
- 当前状态（活跃/空闲/错误/未启动）
- 创建时间
- 最后活跃时间

**样式**：
- 顶部卡片展示，带有状态指示灯

#### 3.2.2 消息通信

**功能描述**：
- 显示该员工与其他员工的消息历史
- 支持按对话对象筛选

**显示内容**：
- 消息时间
- 发送方/接收方
- 消息内容
- 消息方向（发送/接收）

**样式**：
- 聊天界面风格
- 发送的消息靠右，接收的消息靠左
- 支持滚动加载历史消息

**实时更新**：
- 通过 WebSocket 接收新消息并自动追加

#### 3.2.3 任务管理

**功能描述**：
- 显示该员工的所有任务
- 可视化任务依赖关系（DAG）

**显示内容**：
- 任务列表：
  - 任务名称
  - 任务状态（pending/in_progress/completed/cancelled）
  - 任务描述
  - 创建时间
  - 完成时间（如果已完成）
  - 依赖的任务
  - 任务结果（如果已完成）
- 任务 DAG 图：
  - 使用 D3.js 或 Mermaid 渲染
  - 节点代表任务，边代表依赖关系
  - 颜色区分任务状态

**可执行任务高亮**：
- 标记出依赖已满足、可以立即执行的任务

**实时更新**：
- 通过 WebSocket 接收任务状态变化并更新界面

#### 3.2.4 记忆系统

**功能描述**：
- 显示该员工的记忆数据

**显示内容**：
- **经验知识 (knowledge)**：
  - 列表形式展示
  - 每条知识一行
- **自定义字段 (custom)**：
  - JSON 格式展示
  - 支持折叠/展开

**样式**：
- 使用代码块或卡片展示
- 可读性强

#### 3.2.5 Agent 执行

**功能描述**：
- 显示该员工创建的 Agent 执行记录

**显示内容**：
- Agent ID
- 关联的任务名称
- 执行状态（运行中/已完成/失败）
- 创建时间
- 完成时间（如果已完成）
- 执行结果

**样式**：
- 表格形式展示
- 运行中的 Agent 带有加载动画

**实时更新**：
- 通过 WebSocket 接收 Agent 状态变化并更新界面

#### 3.2.6 事件历史

**功能描述**：
- 显示与该员工相关的所有事件

**显示内容**：
- 事件类型
- 事件时间
- 事件详情

**样式**：
- 时间线形式展示
- 支持筛选事件类型

---

## 4. 数据模型

### 4.1 员工 (Employee)

```typescript
interface Employee {
  name: string                // 员工名称（唯一标识）
  role: string                // 所属角色
  status: EmployeeStatus      // 当前状态
  createdAt: string           // 创建时间 (ISO 8601)
  lastActiveAt: string        // 最后活跃时间 (ISO 8601)
  hiredBy?: string            // 雇佣者名称
}

type EmployeeStatus = "active" | "idle" | "error" | "inactive"
```

### 4.2 消息 (Message)

```typescript
interface Message {
  timestamp: string           // 消息时间戳 (ISO 8601)
  from: string                // 发送者名称
  to: string                  // 接收者名称
  content: string             // 消息内容
  direction: "send" | "receive"  // 消息方向（相对于当前员工）
}
```

### 4.3 任务 (Task)

```typescript
interface Task {
  name: string                // 任务名称（唯一标识）
  status: TaskStatus          // 任务状态
  description: string         // 任务描述
  result?: string             // 任务结果（完成时填写）
  dependencies: string[]      // 依赖的任务名称列表
  created: string             // 创建时间 (ISO 8601)
  completed?: string          // 完成时间 (ISO 8601)
}

type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled"
```

### 4.4 记忆 (Memory)

```typescript
interface Memory {
  knowledge: string[]         // 经验知识
  custom: Record<string, any> // 自定义字段
}
```

### 4.5 Agent 执行记录 (AgentExecution)

```typescript
interface AgentExecution {
  agentId: string             // Agent ID
  taskName: string            // 关联的任务名称
  status: "running" | "completed" | "failed"
  createdAt: string           // 创建时间 (ISO 8601)
  completedAt?: string        // 完成时间 (ISO 8601)
  result?: string             // 执行结果
}
```

### 4.6 事件 (Event)

```typescript
interface Event {
  type: EventType             // 事件类型
  timestamp: string           // 事件时间戳 (ISO 8601)
  employeeName?: string       // 相关员工名称
  details: Record<string, any>  // 事件详情
}

type EventType = 
  | "message"                 // 消息事件
  | "task_completed"          // 任务完成
  | "task_failed"             // 任务失败
  | "agent_completed"         // Agent 完成
  | "agent_failed"            // Agent 失败
  | "timer"                   // 定时器事件
  | "employee_hired"          // 员工雇佣
```

---

## 5. API 设计

### 5.1 HTTP API

**Base URL**: `http://localhost:4097/api`

#### 5.1.1 获取员工列表

```
GET /employees
```

**响应**：
```json
{
  "employees": [
    {
      "name": "calculator",
      "role": "Calculator",
      "status": "idle",
      "createdAt": "2026-03-01T10:00:00Z",
      "lastActiveAt": "2026-03-01T10:05:00Z",
      "hiredBy": null
    }
  ]
}
```

#### 5.1.2 获取员工详情

```
GEloyees/:name
```

**响应**：
```json
{
  "name": "calculator",
  "role": "Calculator",
  "status": "idle",
  "createdAt": "2026-03-01T10:00:00Z",
  "lastActiveAt": "2026-03-01T10:05:00Z",
  "hiredBy": null,
  "memory": {
    "knowledge": ["alice 经常问我数学计算问题"],
    "custom": {}
  },
  "tasks": [...],
  "agents": [...]
}
```

#### 5.1.3 获取消息历史

```
GET /employees/:name/messages?peer=:peer&limit=:limit
```

**参数**：
- `peer` (可选): 对话对象名称
- `limit` (可选): 返回消息数量，默认 50

**响应**：
```json
{
  "messages": [
    {
      "timestamp": "2026-03-01T10:00:00Z",
      "from": "alice",
      "to": "calculator",
      "content": "计算 1+1",
      "direction": "receive"
    }
  ]
}
```

#### 5.1.4 获取任务列表

```
GET /employees/:name/tasks
```

**响应**：
```json
{
  "tasks": [
    {
      "name": "计算1+1",
      "status": "completed",
      "description": "为 alice 计算 1+1",
      "result": "2",
      "dependencies": [],
      "created": "2026-03-01T10:00:00Z",
      "completed": "2026-03-01T10:00:05Z"
    }
  ],
  "executableTasks": ["计算3+4"]
}
```

#### 5.1.5 获取事件历史

```
GET /events?limit=:limit&employeeName=:name
```

**参数**：
- `limit` (可选): 返回事件数量，默认 50
- `employeeName` (可选): 筛选特定员工的事件

**响应**：
```json
{
  "events": [
    {
      "type": "message",
      "timestamp": "2026-03-01T10:00:00Z",
      "employeeName": "calculator",
      "details": {
        "from": "alice",
        "content": "计算 1+1"
      }
    }
  ]
}
```

#### 5.1.6 获取雇佣关系

```
GET /employees/hierarchy
```

**响应**：
```json
{
  "hierarchy": {
    "name": "calculator",
    "role": "Calculator",
    "status": "idle",
    "children": [
      {
        "name": "coder",
        "role": "Coder",
        "status": "active",
        "children": []
      }
    ]
  }
}
```

### 5.2 WebSocket API

**连接 URL**: `ws://localhost:4097/ws`

#### 5.2.1 连接

客户端连接后，服务器开始推送事件。

#### 5.2.2 事件推送

**消息格式**：
```json
{
  "type": "event",
  "data": {
    "type": "message",
    "timestamp": "2026-03-01T10:00:00Z",
    "employeeName": "calculator",
    "details": {
      "from": "alice",
      "content": "计算 1+1"
    }
  }
}
```

**事件类型**：
- `employee_status_changed`: 员工状态变化
- `message_received`: 收到新消息
- `message_sent`: 发送消息
- `task_updated`: 任务状态更新
- `agent_updated`: Agent 状态更新
- `employee_hired`: 新员工雇佣

---

## 6. 实现阶段

### 6.1 第一版 (只读监控)

**目标**：实现完整的监控功能，不支持修改操作。

**功能清单**：
- ✅ 总仪表盘
  - ✅ 雇佣关系树状图
  - ✅ 全局统计
  - ✅ 实时事件流
- ✅ 员工详情页
  - ✅ 基本信息
  - ✅ 消息通信
  - ✅ 任务管理
  - ✅ 记忆系统
  - ✅ Agent 执行
  - ✅ 事件历史
- ✅ 实时更新（WebSocket）
- ✅ 响应式设计

### 6.2 第二版 (支持修改调试)

**目标**：支持通过界面操作员工系统。

**功能清单**：
- 发送消息给员工
- 手动创建/更新/删除任务
- 手动创建 Agent
- 雇佣新员工
- 修改员工记忆
- 暂停/恢复员工

---

## 7. 非功能需求

### 7.1 性能要求

- 页面首次加载时间 < 2 秒
- WebSocket 事件处理延迟 < 100ms
- 树状图渲染时间 < 1 秒（100 个节点以内）
- 支持同时监控 50+ 员工

### 7.2 兼容性要求

- 支持现代浏览器（Chrome, Firefox, Safari, Edge）
- 最低分辨率：1280x720

### 7.3 可维护性要求

- 代码遵循 TypeScript 严格模式
- 组件化设计，单一职责
- 完善的类型定义
- 清晰的目录结构

### 7.4 可扩展性要求

- API 设计支持未来功能扩展
- 组件设计支持主题切换
- 支持国际化（i18n）准备

---

## 8. 开发规范

### 8.1 代码风格

- 使用 TypeScript 严格模式
- 使用双引号，不使用分号（与插件项目保持一致）
- 使用 Prettier 格式化代码
- 组件使用函数式组件 + Hooks

### 8.2 命名规范

- 组件：PascalCase（如 `EmployeeDetail.tsx`）
- 函数/变量：camelCase（如 `fetchEmployees`）
- 类型/接口：PascalCase（如 `Employee`, `Message`）
- 常量：UPPER_SNAKE_CASE（如 `API_BASE_URL`）

### 8.3 提交规范

遵循 Conventional Commits 格式：
- `feat`: 新功能
- `fix`: 修复 bug
- `refactor`: 重构
- `style`: 样式调整
- `docs`: 文档更新
- `chore`: 构建/工具配置

---

## 9. 参考资料

- OpenCode CClover 插件需求文档：`../REQUIREMENTS.md`
- shadcn/ui 文档：https://ui.shadcn.com/
- D3.js 文档：https://d3js.org/
- React 文档：https://react.dev/
- Tailwind CSS 文档：https://tailwindcss.com/
