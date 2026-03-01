# 前端开发规范

本文档定义了 Console 前端项目的开发规范和最佳实践。

## 1. 技术栈

### 1.1 核心技术

- **框架**: React 18
- **语言**: TypeScript (严格模式)
- **构建工具**: Vite
- **包管理器**: Bun
- **样式**: Tailwind CSS
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **可视化**: D3.js
- **路由**: React Router v6

### 1.2 开发工具

- **代码格式化**: Prettier
- **代码检查**: ESLint
- **类型检查**: TypeScript Compiler

---

## 2. 项目结构

```
console/
├── src/
│   ├── components/          # React 组件
│   │   ├── ui/             # shadcn/ui 基础组件
│   │   ├── dashboard/      # 仪表盘业务组件
│   │   ├── employee/       # 员工相关业务组件
│   │   └── visualizations/ # D3.js 可视化组件
│   ├── pages/              # 页面组件
│   │   ├── Overview.tsx    # 总仪表盘页面
│   │   └── EmployeeDetail.tsx  # 员工详情页面
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useWebSocket.ts # WebSocket 连接管理
│   │   ├── useEmployees.ts # 员工数据管理
│   │   ├── useMessages.ts  # 消息数据管理
│   │   └── useTasks.ts     # 任务数据管理
│   ├── services/           # API 服务层
│   │   ├── api.ts          # HTTP API 客户端
│   │   └── websocket.ts    # WebSocket 客户端
│   ├── types/              # TypeScript 类型定义
│   │   └── index.ts        # 共享类型
│   ├── lib/                # 工具函数
│   │   └── utils.ts        # 通用工具函数
│   ├── App.tsx             # 根组件
│   ├── main.tsx            # 入口文件
│   └── index.css           # 全局样式
├── public/                 # 静态资源
├── index.html              # HTML 模板
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript 配置
├── vite.config.ts          # Vite 配置
├── tailwind.config.js      # Tailwind CSS 配置
├── components.json         # shadcn/ui 配置
└── DEVELOPMENT.md          # 本文档
```

---

## 3. 代码风格

### 3.1 TypeScript 规范

**严格模式**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

**命名约定**:
- 组件: PascalCase (`EmployeeCard.tsx`)
- 函数/变量: camelCase (`fetchEmployees`)
- 类型/接口: PascalCase (`Employee`, `Message`)
- 常量: UPPER_SNAKE_CASE (`API_BASE_URL`)
- 文件名: PascalCase (组件) 或 camelCase (工具函数)

**类型定义**:
```typescript
// ✅ 正确: 使用 interface 定义对象类型
interface Employee {
  name: string
  role: string
  status: EmployeeStatus
}

// ✅ 正确: 使用 type 定义联合类型
type EmployeeStatus = "active" | "idle" | "error" | "inactive"

// ❌ 错误: 使用 any
function processData(data: any) { }

// ✅ 正确: 使用具体类型
function processData(data: Employee[]) { }
```

### 3.2 React 规范

**函数式组件**:
```typescript
// ✅ 正确: 使用函数式组件 + Hooks
export function EmployeeCard({ employee }: { employee: Employee }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <div>
      {/* ... */}
    </div>
  )
}

// ❌ 错误: 使用类组件
export class EmployeeCard extends React.Component { }
```

**Props 类型定义**:
```typescript
// ✅ 正确: 定义 Props 接口
interface EmployeeCardProps {
  employee: Employee
  onSelect?: (employee: Employee) => void
}

export function EmployeeCard({ employee, onSelect }: EmployeeCardProps) {
  // ...
}
```

**Hooks 使用**:
```typescript
// ✅ 正确: Hooks 在组件顶层调用
function MyComponent() {
  const [state, setState] = useState(0n  const data = useFetchData()
  
  return <div>{data}</div>
}

// ❌ 错误: 在条件语句中调用 Hooks
function MyComponent() {
  if (condition) {
    const [state, setState] = useState(0) // 错误!
  }
}
```

### 3.3 样式规范

**Tailwind CSS**:
```typescript
// ✅ 正确: 使用 Tailwind 类名
<div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">
  <span className="text-lg font-semibold">{employee.name}</span>
</div>

// ✅ 正确: 使用 cn 工具函数合并类名
import { cn } from "@/lib/utils"

<div className={cn(
  "flex items-center gap-4",
  isActive && "bg-green-100",
  isError && "bg-red-100"
)}>
  {/* ... */}
</div>
```

**shadcn/ui 组件**:
```typescript
// ✅ 正确: 使用 shadcn/ui 组件
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>员工信息</CardTitle>
  </CardHeader>
  <CardContent>
    <Button onClick={handleClick}>查看详情</Button>
  </CardContent>
</Card>
```

---

## 4. 组件设计原则

### 4.1 单一职责

每个组件只负责一个功能:

```typescript
// ✅ 正确: 职责单一
function EmployeeCard({ employee }: { employee: Employee }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{employee.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{employee.role}</p>
      </CardContent>
    </Card>
  )
}

// ❌ 错误: 职责过多
function EmployeeCard({ employee }: { employee: Employee }) {
  // 包含数据获取、状态管理、UI 渲染等多个职责
  const [messages, setMessages] = useState([])
  const [tasks, setTasks] = useState([])
  
  useEffect(() => {
    fetchMessages(employee.name).then(setMessages)
    fetchTasks(employee.name).then(setTasks)
  }, [employee.name])
  
  return (
    <div>
      {/* 复杂的 UI */}
    </div>
  )
}
```

### 4.2 Props 设计

**最小化 Props**:
```typescript
// ✅ 正确: 只传递必要的数据
interface EmployeeCardProps {
  employee: Employee
  onSelect: (id: string) => void
}

// ❌ 错误: 传递过多数据
interface EmployeeCardProps {
  employee: Employee
  allEmployees: Employee[]
  messages: Message[]
  tasks: Task[]
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, data: Partial<Employee>) => void
}
```

**使用回调函数**:
```typescript
// ✅ 正确: 使用回调函数
interface EmployeeCardProps {
  employee: Employee
  onSelect: (employee: Employee) => void
}

function EmployeeCard({ employee, onSelect }: EmployeeCardProps) {
  return (
    <Card onClick={() => onSelect(employee)}>
      {/* ... */}
    </Card>
  )
}
```

### 4.3 组件拆分

**按功能拆分**:
```typescript
// ✅ 正确: 拆分为多个小组件
function EmployeeDetail({ employee }: { employee: Employee }) {
  return (
    <div>
      <EmployeeInfo employee={employee} />
      <EmployeeMessages employeeName={employee.name} />
      <EmployeeTasks employeeName={employee.name} />
      <EmployeeMemory employeeName={employee.name} />
    </div>
  )
}

// ❌ 错误: 单个巨大组件
function EmployeeDetail({ employee }: { employee: Employee }) {
  return (
    <div>
      {/* 数百行代码 */}
    </div>
  )
}
```

---

## 5. 状态管理

### 5.1 本地状态

使用 `useState` 管理组件内部状态:

```typescript
function EmployeeCard({ employee }: { employee: Employee }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <Card>
      <CardHeader onClick={() => setIsExpanded(!isExpanded)}>
        <CardTitle>{employee.name}</CardTitle>
      </CardHeader>
      {isExpanded && (
        <CardContent>
          {/* 详细信息 */}
        </CardContent>
      )}
    </Card>
  )
}
```

### 5.2 共享状态

使用自定义 Hooks 管理共享状态:

```typescript
// hooks/useEmployees.ts
export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    fetchEmployees()
      .then(setEmployees)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])
  
  return { employees, loading, error }
}

// 使用
function EmployeeList() {
  const { employees, loading, error } = useEmployees()
  
  if (loading) return <div>加载中...</div>
  if (error) return <div>错误: {error.message}</div>
  
  return (
    <div>
      {employees.map(emp => (
        <EmployeeCard key={emp.name} employee={emp} />
      ))}
    </div>
  )
}
```

### 5.3 服务器状态

使用自定义 Hooks 管理服务器数据:

```typescript
// hooks/useMessages.ts
export function useMessages(employeeName: string, peer?: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    setLoading(true)
    fetchMessages(employeeName, peer)
      .then(setMessages)
      .finally(() => setLoading(false))
  }, [employeeName, peer])
  
  return { messages, loading }
}
```

---

## 6. API 调用

### 6.1 API 客户端封装

```typescript
// services/api.ts
const API_BASE_URL = "http://localhost:4097/api"

class ApiClient {
  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`)
    const json = await response.json()
    
    if (!json.success) {
      throw new Error(json.error.message)
    }
    
    return json.data
  }
  
  async getEmployees(): Promise<Employee[]> {
    const data = await this.request<{ employees: Employee[] }>("/employees")
    return data.employees
  }
  
  async getEmployeeDetail(name: string): Promise<EmployeeDetail> {
    return this.request<EmployeeDetail>(`/employees/${name}`)
  }
  
  async getMessages(employeeName: string, peer?: string, limit?: number): Promise<Message[]> {
    const params = new URLSearchParams()
    if (peer) params.append("peer", peer)
    if (limit) params.append("limit", limit.toString())
    
    const query = params.toString() ? `?${params.toString()}` : ""
    const data = await this.request<{ messages: Message[] }>(`/employees/${employeeName}/messages${query}`)
    return data.messages
  }
}

export const apiClient = new ApiClient()
```

### 6.2 错误处理

```typescript
// hooks/useEmployees.ts
export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    apiClient.getEmployees()
      .then(setEmployees)
      .catch((err) => {
        console.error("获取员工列表失败:", err)
        setError(err)
      })
      .finally(() => setLoading(false))
  }, [])
  
  return { employees, loading, error }
}
```

---

## 7. WebSocket 集成

### 7.1 WebSocket 客户端

```typescript
// services/websocket.ts
export class WebSocketClient {
  private ws: WebSocket | null = null
  private eventHandlers: Map<EventType, Set<(event: Event) => void>> = new Map()
  
  connect() {
    this.ws = new WebSocket("ws://localhost:4097/ws")
    
    this.ws.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data)
      if (message.type === "event") {
        this.emit(message.data)
      }
    }
  }
  
  on(eventType: EventType, handler: (event: Event) => void) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set())
    }
    this.eventHandlers.get(eventType)!.add(handler)
  }
  
  off(eventType: EventType, handler: (event: Event) => void) {
    this.eventHandlers.get(eventType)?.delete(handler)
  }
  
  private emit(event: Event) {
    const handlers = this.eventHandlers.get(event.type)
    if (handlers) {
      handlers.forEach(handler => handler(event))
    }
  }
  
  disconnect() {
    this.ws?.close()
    this.ws = null
  }
}

export const wsClient = new WebSocketClient()
```

### 7.2 React Hook 封装

```typescript
// hooks/useWebSocket.ts
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false)
  
  useEffect(() => {
    wsClient.connect()
    setIsConnected(true)
    
    return () => {
      wsClient.disconnect()
      setIsConnected(false)
    }
  }, [])
  
  const subscribe = useCallback((eventType: EventType, handler: (event: Event) => void) => {
    wsClient.on(eventType, handler)
    return () => wsClient.off(eventType, handler)
  }, [])
  
  return { isConnected, subscribe }
}

// 使用示例
function MyComponent() {
  const { subscribe } = useWebSocket()
  
  useEffect(() => {
    const unsubscribe = subscribe("message", (event) => {
      console.log("收到消息:", event)
    })
    
    return unsubscribe
  }, [subscribe])
  
  return <div>...</div>
}
```

---

## 8. 性能优化

### 8.1 React.memo

```typescript
// ✅ 正确: 使用 React.memo 避免不必要的重渲染
export const EmployeeCard = React.memo(function EmployeeCard({ employee }: { employee: Employee }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{employee.name}</CardTitle>
      </CardHeader>
    </Card>
  )
})
```

### 8.2 useCallback

```typescript
// ✅ 正确: 使用 useCallback 缓存回调函数
function EmployeeList() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  
  const handleSelect = useCallback((employee: Employee) => {
    setSelectedId(employee.name)
  }, [])
  
  return (
    <div>
      {employees.map(emp => (
        <EmployeeCard key={emp.name} employee={emp} onSelect={handleSelect} />
      ))}
    </div>
  )
}
```

### 8.3 useMemo

```typescript
// ✅ 正确: 使用 useMemo 缓存计算结果
function EmployeeList({ employees }: { employees: Employee[] }) {
  const activeEmployees = useMemo(() => {
    return employees.filter(emp => emp.status === "active")
  }, [employees])
  
  return (
    <div>
      <p>活跃员工数: {activeEmployees.length}</p>
      {/* ... */}
    </div>
  )
}
```

---

## 9. 测试

### 9.1 组件测试

```typescript
import { render, screen } from "@testing-library/react"
import { EmployeeCard } from "./EmployeeCard"

describe("EmployeeCard", () => {
  it("should render employee name", () => {
    const employee: Employee = {
      name: "calculator",
      role: "Calculator",
      status: "idle",
      createdAt: "2026-03-01T10:00:00.000Z",
      lastActiveAt: "2026-03-01T10:00:00.000Z",
    }
    
    render(<EmployeeCard employee={employee} />)
    
    expect(screen.getByText("calculator")).toBeInTheDocument()
  })
})
```

---

## 10. 提交规范

遵循 Conventional Commits 格式:

- `feat`: 新功能
- `fix`: 修复 bug
- `refactor`: 重构
- `style`: 样式调整
- `docs`: 文档更新
- `chore`: 构建/工具配置

**示例**:
```
feat: add employee detail page
fix: correct WebSocket reconnection logic
refactor: extract message list component
style: update employee card layout
```

---

## 11. 版本控制

**当前版本**: v1.0.0

### 11.1 版本变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0.0 | 2026-03-01 | 初始版本 |
