# Console 多 Project 支持 - 详细修改清单

## 文档说明

本文档详细列出了为支持多 Project 功能所需的所有代码修改点，包括：
- 具体的文件路径
- 需要修改的代码位置
- 修改内容说明
- 预计工作量评估

**生成时间**: 2026-03-02  
**基于文档**: `Multi-Project-Migration.md`  
**状态**: 待实施

---

## 目录

1. [后端修改 (阻塞项)](#后端修改-阻塞项)
2. [前端修改](#前端修改)
3. [修改成本评估](#修改成本评估)
4. [实施顺序建议](#实施顺序建议)
5. [关键风险点](#关键风险点)

---

## 后端修改 (阻塞项)

> ⚠️ **关键**: 后端修改必须先完成，否则前端无法正常工作

### 1. 类型定义 - `src/types/index.ts`

**文件路径**: `/src/types/index.ts`

**修改位置**: Line 92-97 (Event 接口定义)

**修改前**:
```typescript
export interface Event {
  type: EventType
  timestamp: string
  employeeName?: string
  details: Record<string, any>
}
```

**修改后**:
```typescript
export interface Event {
  projectId: string           // 新增!
  type: EventType
  timestamp: string
  employeeName?: string
  details: Record<string, any>
}
```

**影响范围**: 所有使用 Event 类型的地方

**预计修改**: 5行

---

### 2. StateManager - `src/state/StateManager.ts`

**文件路径**: `/src/state/StateManager.ts`

#### 修改点 1: 添加 projectId 字段

**修改位置**: Line 9-14 (类定义开始)

**修改前**:
```typescript
export class StateManager {
  private employeeRegistry: EmployeeRegistry
  private eventHistory: EventHistory
  private taskCount: Map<string, number>
  private messageCount: Map<string, number>

  constructor() {
    this.employeeRegistry = new EmployeeRegistry()
    this.eventHistory = new EventHistory()
    this.taskCount = new Map()
    this.messageCount = new Map()
  }
```

**修改后**:
```typescript
export class StateManager {
  private projectId: string                    // 新增!
  private employeeRegistry: EmployeeRegistry
  private eventory: EventHistory
  private taskCount: Map<string, number>
  private messageCount: Map<string, number>

  constructor(projectId: string) {             // 修改!
    this.projectId = projectId                 // 新增!
    this.employeeRegistry = new EmployeeRegistry()
    this.eventHistory = new EventHistory()
    this.taskCount = new Map()
    this.messageCount = new Map()
  }
```

#### 修改点 2: updateEmployeeStatus 方法

**修改位置**: Line 58-66

**修改前**:
```typescript
// 记录状态变化事件
this.eventHistory.add({
  type: "employee_status_changed",
  timestamp: new Date().toISOString(),
  employeeName: name,
  details: {
    oldStatus,
    newStatus: status,
  },
})
```

**修改后**:
```typescript
// 记录状态变化事件
this.eventHistory.add({
  projectId: this.projectId,                   // 新增!
  type: "employee_status_changed",
  timestamp: new Date().toISOString(),
  employeeName: name,
  details: {
    oldStatus,
    newStatus: status,
  },
})
```

**预计修改**: 15行

---

### 3. MessageService - `src/core/MessageService.ts`

**文件路径**: `/src/core/MessageService.ts`

#### 修改点 1: 添加 projectId 字段

**修改位置**: 构造函数附近

**需要添加**:
- 构造函数参数添加 `projectId: string`
- 添加私有字段 `private projectId: string`
- 构造函数中赋值 `this.projectId = projectId`

#### 修改点 2: addEvent 调用

**修改位置**: Line 158-167

**修改前**:
```typescript
this.stateManager?.addEvent({
  type: "message",
  timestamp,
  employeeName: from,
  details: {
    from,
    to,
    content,
  },
})
```

**修改后**:
```typescript
this.stateManager?.addEvent({
  projectId: this.projectId,                   // 新增!
  type: "message",
  timestamp,
  employeeName: from,
  details: {
    from,
    to,
    content,
  },
})
```

**预计修改**: 10行

---

### 4. MemoryManager - `src/core/MemoryManager.ts`

**文件路径**: `/src/core/MemoryManager.ts`

#### 修改点 1: 添加 projectId 字段

**修改位置**: 构造函数附近

**需要添加**:
- 构造函数参数添加 `projectId: string`
- 添加私有字段 `private projectId: string`
- 构造函数中赋值 `this.projectId = projectId`

#### 修改点 2: addEvent 调用 (task_completed)

**修改位置**: Line 205-213

**修改前**:
```typescript
this.stateManager?.addEvent({
  type: "task_completed",
  timestamp,
  employeeName,
  details: {
    taskName,
    result: updates.result,
  },
})
```

**修改后**:
```typescript
this.stateManager?.addEvent({
  projectId: this.projectId,                   // 新增!
  type: "task_completed",
  timestamp,
  employeeName,
  details: {
    taskName,
    result: updates.result,
  },
})
```

#### 修改点 3: addEvent 调用 (task_failed)

**修改位置**: Line 215-223

**修改前**:
```typescript
this.stateManager?.addEvent({
  type: "task_failed",
  timestamp,
  employeeName,
  details: {
    taskName,
    reason: "cancelled",
  },
})
```

**修改后**:
```typescript
this.stateManager?.addEvent({
  projectId: this.projectId,                   // 新增!
  type: "task_failed",
  timestamp,
  employeeName,
  details: {
    taskName,
    reason: "cancelled",
  },
})
```

**预计修改**: 15行

---

### 5. GlobalServer - `src/server/GlobalServer.ts`

**文件路径**: `/src/server/GlobalServer.ts`

**修改位置**: Line 82-89 (initializeProject 方法)

**修改前**:
```typescript
// 创建服务实例
const stateManager = new StateManager()
const messageService = new MessageService(workspaceRoot, stateManager)
const memoryManager = new MemoryManager(workspaceRoot, stateManager)
const agentRegistry = new AgentRegistry()
```

**修改后**:
```typescript
// 创建服务实例
const projectId = ProjectRegistry.hashPath(config.path)  // 新增!
const stateManager = new StateManager(projectId)         // 修改!
const messageService = new MessageService(workspaceRoot, stateManager, projectId)  // 修改!
const memoryManager = new MemoryManager(workspaceRoot, stateManager, projectId)    // 修改!
const agentRegistry = new AgentRegistry()
```

**预计修改**: 5行

---

## 后端修改总结

| 文件 | 修改行数 | 难度 |
|------|---------|------|
| `src/types/index.ts` | 5行 | 简单 |
| `src/state/StateManager.ts` | 15行 | 简单 |
| `src/core/MessageService.ts` | 10行 | 简单 |
| `src/core/MemoryManager.ts` | 15行 | 简单 |
| `src/server/GlobalServer.ts` | 5行 | 简单 |
| **总计** | **50行** | **简单** |

**预计工时**: 1-2小时

**验证方法**:
```bash
# 启动插件，打开浏览器开发者工具
# 查看 WebSocket 消息，确认 Event 包含 projectId 字段
```

---

## 前端修改

### 阶段 1: 类型定义和基础设施

#### 1. 类型定义 - `console/src/types/index.ts`

**文件路径**: `/console/src/types/index.ts`

##### 修改点 1: 新增 Project 类型

**修改位置**: 文件开头（Line 1 附近）

**新增内容**:
```typescript
// Project types
export interface Project {
  projectId: string
  projectName: string
  directory: string
}
```

##### 修改点 2: 修改 Event 接口

**修改位置**: Line 88-93

**修改前**:
```typescript
export interface Event {
  type: EventType
  timestamp: string
  employeeName?: string
  details: Record<string, unknown>
}
```

**修改后**:
```typescript
export interface Event {
  projectId: string           // 新增!
  type: EventType
  timestamp: string
  employeeName?: string
  details: Record<string, unknown>
}
```

**预计修改**: 10行

---

#### 2. API 客户端 - `console/src/services/api.ts`

**文件路径**: `/console/src/services/api.ts`

##### 修改点 1: 添加 currentProjectId 和相关方法

**修改位置**: Line 14 (类定义开始)

**修改前**:
```typescript
export class ApiClient {
  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`)
    // ...
  }
```

**修改后**:
```typescript
export class ApiClient {
  private currentProjectId: string | null = null    // 新增!

  // 新增: 设置当前 project
  setProject(projectId: string): void {
    this.currentProjectId = projectId
  }

  // 新增: 获取 project 列表
  async getProjects(): Promise<Project[]> {
    const data = await this.request<{ projects: Project[] }>("/projects")
    return data.projects
  }

  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`)
    // ...
  }
```

##### 修改点 2: 修改 getEmployees 方法

**修改位置**: Line 27-30

**修改前**:
```typescript
async getEmployees(): Promise<Employee[]> {
  const data = await this.request<{ employees: Employee[] }>("/employees")
  return data.employees
}
```

**修改后**:
```typescript
async getEmployees(): Promise<Employee[]> {
  if (!this.currentProjectId) {
    throw new Error("No project selected")
  }
  const data = await this.request<{ employees: Employee[] }>(
    `/projects/${this.currentProjectId}/employees`
  )
  return data.employees
}
```

##### 修改点 3: 修改 getEmployeeDetail 方法

**修改位置**: Line 32-34

**修改前**:
```typescript
async getEmployeeDetail(name: string): Promise<EmployeeDetail> {
  return this.request<EmployeeDetail>(`/employees/${name}`)
}
```

**修改后**:
```typescript
async getEmployeeDetail(name: string): Promise<EmployeeDetail> {
  if (!this.currentProjectId) {
    throw new Error("No project selected")
  }
  return this.request<EmployeeDetail>(
    `/projects/${this.currentProjectId}/employees/${name}`
  )
}
```

##### 修改点 4: 修改 getMessages 方法

**修改位置**: Line 36-50

**修改前**:
```typescript
async getMessages(
  employeeName: string,
  peer?: string,
  limit?: number
): Promise<Message[]> {
  const params = new URLSearchParams()
  if (peer) params.append("peer", peer)
  if (limit) params.append("limit", limit.toString())

  const query = params.toString() ? `?${params.toString()}` : ""
  const data = await this.request<{ messages: Message[] }>(
    `/employees/${employeeName}/messages${query}`
  )
  return data.messages
}
```

**修改后**:
```typescript
async getMessages(
  employeeName: string,
  peer?: string,
  limit?: number
): Promise<Message[]> {
  if (!this.currentProjectId) {
    throw new Error("No project selected")
  }
  const params = new URLSearchParams()
  if (peer) params.append("peer", peer)
  if (limit) params.append("limit", limit.toString())

  const query = params.toString() ? `?${params.toString()}` : ""
  const data = await this.request<{ messages: Message[] }>(
    `/projects/${this.currentProjectId}/employees/${employeeName}/messages${query}`
  )
  return data.messages
}
```

##### 修改点 5: 修改 getTasks 方法

**修改位置**: Line 52-54

**修改前**:
```typescript
async getTasks(employeeName: string): Promise<TasksResponse> {
  return this.request<TasksResponse>(`/employees/${employeeName}/tasks`)
}
```

**修改后**:
```typescript
async getTasks(employeeName: string): Promise<TasksResponse> {
  if (!this.currentProjectId) {
    throw new Error("No project selected")
  }
  return this.request<TasksResponse>(
    `/projects/${this.currentProjectId}/employees/${employeeName}/tasks`
  )
}
```

##### 修改点 6: 修改 getEvents 方法

**修改位置**: Line 56-68

**修改前**:
```typescript
async getEvents(options?: {
  limit?: number
  employeeName?: string
}): Promise<Event[]> {
  const params = new URLSearchParams()
  if (options?.limit) params.append("limit", options.limit.toString())
  if (options?.employeeName)
    params.append("employeeName", options.employeeName)

  const query = params.toString() ? `?${params.toString()}` : ""
  const data = await this.request<{ events: Event[] }>(`/events${query}`)
  return data.events
}
```

**修改后**:
```typescript
async getEvents(options?: {
  limit?: number
  employeeName?: string
}): Promise<Event[]> {
  if (!this.currentProjectId) {
    throw new Error("No project selected")
  }
  const params = new URLSearchParams()
  if (options?.limit) params.append("limit", options.limit.toString())
  if (options?.employeeName)
    params.append("employeeName", options.employeeName)

  const query = params.toString() ? `?${params.toString()}` : ""
  const data = await this.request<{ events: Event[] }>(
    `/projects/${this.currentProjectId}/events${query}`
  )
  return data.events
}
```

##### 修改点 7: 修改 getHierarchy 方法

**修改位置**: Line 70-75

**修改前**:
```typescript
async getHierarchy(): Promise<EmployeeHierarchy> {
  const data = await this.request<{ hierarchy: EmployeeHierarchy }>(
    "/employees/hierarchy"
  )
  return data.hierarchy
}
```

**修改后**:
```typescript
async getHierarchy(): Promise<EmployeeHierarchy> {
  if (!this.currentProjectId) {
    throw new Error("No project selected")
  }
  const data = await this.request<{ hierarchy: EmployeeHierarchy }>(
    `/projects/${this.currentProjectId}/employees/hierarchy`
  )
  return data.hierarchy
}
```

##### 修改点 8: 修改 getStats 方法

**修改位置**: Line 77-89

**修改前**:
```typescript
async getStats(): Promise<{
  totalEmployees: number
  activeEmployees: number
  pendingTasks: number
  todayMessages: number
}> {
  return this.request<{
    totalEmployees: number
    activeEmployees: number
    pendingTasks: number
    todayMessages: number
  }>("/stats")
}
```

**修改后**:
```typescript
async getStats(): Promise<{
  totalEmployees: number
  activeEmployees: number
  pendingTasks: number
  todayMessages: number
}> {
  if (!this.currentProjectId) {
    throw new Error("No project selected")
  }
  return this.request<{
    totalEmployees: number
    activeEmployees: number
    pendingTasks: number
    todayMessages: number
  }>(`/projects/${this.currentProjectId}/stats`)
}
```

**预计修改**: 100行

---

#### 3. WebSocket 客户端 - `console/src/services/websocket.ts`

**文件路径**: `/console/src/services/websocket.ts`

##### 修改点 1: 添加 currentProjectId 和 setProject 方法

**修改位置**: 类定义开始

**需要添加**:
```typescript
export class WebSocketClient {
  private currentProjectId: string | null = null    // 新增!

  // 新增: 设置当前 project
  setProject(projectId: string): void {
    this.currentProjectId = projectId
  }

  // ... 其他代码
}
```

##### 修改点 2: 修改事件处理逻辑

**修改位置**: handleEvent 方法

**修改前**:
```typescript
private handleEvent(event: Event): void {
  const handlers = this.eventHandlers.get(event.type)
  if (handlers) {
    handlers.forEach((handler) => handler(event))
  }
}
```

**修改后**:
```typescript
private handleEvent(event: Event): void {
  // 只处理当前 project 的事件
  if (event.projectId !== this.currentProjectId) {
    return
  }

  const handlers = this.eventHandlers.get(event.type)
  if (handlers) {
    handlers.forEach((handler) => handler(event))
  }
}
```

**预计修改**: 30行

---

#### 4. Project 上下文 - `console/src/contexts/ProjectContext.tsx` (新建)

**文件路径**: `/console/src/contexts/ProjectContext.tsx`

**新建文件内容**:
```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { Project } from "../types"
import { apiClient, wsClient } from "../services"

interface ProjectContextValue {
  projects: Project[]
  currentProject: string | null
  setCurrentProject: (projectId: string) => void
  loading: boolean
  error: Error | null
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // 加载 project 列表
  useEffect(() => {
    apiClient
      .getProjects()
      .then((data) => {
        setProjects(data)
        // 默认选择第一个 project
        if (data.length > 0 && !currentProject) {
          setCurrentProject(data[0].projectId)
        }
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  // 切换 project 时更新 API 客户端
  useEffect(() => {
    if (currentProject) {
      apiClient.setProject(currentProject)
      wsClient.setProject(currentProject)
    }
  }, [currentProject])

  return (
    <ProjectContext.Provider
      value={{ projects, currentProject, setCurrentProject, loading, error }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error("useProjectContext must be used within ProjectProvider")
  }
  return context
}
```

**预计代码**: 150行

---

#### 5. useProjects Hook - `console/src/hooks/useProjects.ts` (新建)

**文件路径**: `/console/src/hooks/useProjects.ts`

**新建文件内容**:
```typescript
import { useEffect, useState } from "react"
import type { Project } from "../types"
import { apiClient } from "../services"

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    apiClient
      .getProjects()
      .then(setProjects)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  return { projects, loading, error }
}
```

**预计代码**: 50行

---

### 阶段 2: UI 组件

#### 6. 侧边栏组件 - `console/src/components/layout/Sidebar.tsx` (新建)

**文件路径**: `/console/src/components/layout/Sidebar.tsx`

**新建文件内容**:
```typescript
import { useProjectContext } from "../../contexts/ProjectContext"
import { cn } from "../../lib/utils"

export function Sidebar() {
  const { projects, currentProject, setCurrentProject } = useProjectContext()

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {projects.map((project) => (
          <button
            key={project.projectId}
            onClick={() => setCurrentProject(project.projectId)}
            className={cn(
              "w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors",
              "border-b border-gray-100",
              currentProject === project.projectId &&
                "bg-blue-50 border-l-4 border-l-blue-500"
            )}
          >
            <div className="font-medium text-gray-900">
              {project.projectName}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {project.directory}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

**预计代码**: 80行

---

#### 7. 布局组件 - `console/src/components/layout/Layout.tsx` (新建)

**文件路径**: `/console/src/components/layout/Layout.tsx`

**新建文件内容**:
```typescript
import { ReactNode } from "react"
import { Sidebar } from "./Sidebar"

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}
```

**预计代码**: 20行

---

#### 8. App 组件 - `console/src/App.tsx`

**文件路径**: `/console/src/App.tsx`

**修改前**:
```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Overview, EmployeeDetail } from "./pages"

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/employee/:name" element={<EmployeeDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
```

**修改后**:
```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ProjectProvider } from "./contexts/ProjectContext"  // 新增
import { Layout } from "./components/layout/Layout"          // 新增
import { Overview, EmployeeDetail } from "./pages"

function App() {
  return (
    <BrowserRouter>
      <ProjectProvider>                                      {/* 新增 */}
        <Layout>                                             {/* 新增 */}
          <div className="min-h-screen bg-gray-50">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/employee/:name" element={<EmployeeDetail />} />
            </Routes>
          </div>
        </Layout>                                            {/* 新增 */}
      </ProjectProvider>                                     {/* 新增 */}
    </BrowserRouter>
  )
}

export default App
```

**预计修改**: 10行

---

### 阶段 3: Hooks 修改

所有 hooks 的修改模式相同，以 `useEmployees` 为例：

#### 9. useEmployees - `console/src/hooks/useEmployees.ts`

**文件路径**: `/console/src/hooks/useEmployees.ts`

**修改前**:
```typescript
import { useEffect, useState } from "react"
import type { Employee } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { subscribe } = useWebSocket()

  // 初始加载
  useEffect(() => {
    setLoading(true)
    apiClient
      .getEmployees()
      .then(setEmployees)
      .catch((err: Error) => {
        console.error("获取员工列表失败:", err)
        setError(err)
      })
      .finally(() => setLoading(false))
  }, [])

  // 实时更新
  useEffect(() => {
    const unsubscribe = subscribe("employee_status_changed", (event) => {
      // ... 事件处理逻辑
    })
    return unsubscribe
  }, [subscribe])

  return { employees, loading, error }
}
```

**修改后**:
```typescript
import { useEffect, useState } from "react"
import { useProjectContext } from "../contexts/ProjectContext"  // 新增
import type { Employee } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"

export function useEmployees() {
  const { currentProject } = useProjectContext()              // 新增
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { subscribe } = useWebSocket()

  // 初始加载 - 添加 currentProject 依赖
  useEffect(() => {
    if (!currentProject) return                               // 新增

    setLoading(true)
    apiClient
      .getEmployees()
      .then(setEmployees)
      .catch((err: Error) => {
        console.error("获取员工列表失败:", err)
        setError(err)
      })
      .finally(() => setLoading(false))
  }, [currentProject])                                        // 修改: 添加依赖

  // 实时更新
  useEffect(() => {
    const unsubscribe = subscribe("employee_status_changed", (event) => {
      // ... 事件处理逻辑
    })
    return unsubscribe
  }, [subscribe])

  return { employees, loading, error }
}
```

**修改要点**:
1. 导入 `useProjectContext`
2. 获取 `currentProject`
3. 在 `useEffect` 中添加 `if (!currentProject) return` 检查
4. 在 `useEffect` 依赖数组中添加 `currentProject`

**预计修改**: 10行

---

#### 10-13. 其他 Hooks 修改

以下 hooks 需要进行相同的修改：

| Hook | 文件路径 | 修改内容 | 预计修改 |
|------|---------|---------|---------|
| `useEvents` | `/console/src/hooks/useEvents.ts` | 同 useEmployees | 10行 |
| `useMessages` | `/console/src/hooks/useMessages.ts` | 同 useEmployees | 10行 |
| `useStats` | `/console/src/hooks/useStats.ts` | 同 useEmployees | 10行 |
| `useTasks` | `/console/src/hooks/useTasks.ts` | 同 useEmployees | 10行 |

**总预计修改**: 50行

---

## 前端修改总结

| 类别 | 文件数 | 新增代码 | 修改代码 | 难度 | 预计工时 |
|------|--------|---------|---------|------|---------|
| **类型定义** | 1 | 10行 | 5行 | 简单 | 0.5小时 |
| **API 客户端** | 1 | 30行 | 100行 | 中等 | 2小时 |
| **WebSocket 客户端** | 1 | 20行 | 10行 | 中等 | 1小时 |
| **Project 上下文** | 2 | 200行 | 0行 | 中等 | 2-3小时 |
| **UI 组件** | 3 | 100行 | 10行 | 简单 | 1-2小时 |
| **Hooks 修改** | 5 | 0行 | 50行 | 简单 | 1-2小时 |
| **总计** | **13** | **360行** | **175行** | **中等** | **7.5-10.5小时** |

---

## 修改成本评估

### 总体统计

| 类别 | 文件数 | 新增代码 | 修改代码 | 总代码量 | 难度 | 预计工时 |
|------|--------|---------|---------|---------|------|---------|
| **后端 (阻塞)** | 5 | 20行 | 50行 | 70行 | 简单 | 1-2小时 |
| **前端** | 13 | 360行 | 175行 | 535行 | 中等 | 7.5-10.5小时 |
| **测试和调试** | - | - | - | - | 中等 | 2-3小时 |
| **总计** | **18** | **380行** | **225行** | **605行** | **中等** | **10.5-15.5小时** |

### 详细分解

#### 后端修改 (阻塞项)

| 文件 | 类型 | 新增 | 修改 | 难度 | 工时 |
|------|------|------|------|------|------|
| `src/types/index.ts` | 类型定义 | 5行 | 0行 | 简单 | 0.2小时 |
| `src/state/StateManager.ts` | 核心逻辑 | 5行 | 10行 | 简单 | 0.5小时 |
| `src/core/MessageService.ts` | 核心逻辑 | 5行 | 5行 | 简单 | 0.3小时 |
| `src/core/MemoryManager.ts` | 核心逻辑 | 5行 | 10行 | 简单 | 0.5小时 |
| `src/server/GlobalServer.ts` | 服务层 | 0行 | 5行 | 简单 | 0.2小时 |
| **小计** | - | **20行** | **30行** | **简单** | **1.7小时** |

#### 前端修改

| 文件 | 类型 | 新增 | 修改 | 难度 | 工时 |
|------|------|------|------|------|------|
| `console/src/types/index.ts` | 类型定义 | 10行 | 5行 | 简单 | 0.5小时 |
| `console/src/services/api.ts` | API 客户端 | 30行 | 100行 | 中等 | 2小时 |
| `console/src/services/websocket.ts` | WebSocket | 20行 | 10行 | 中等 | 1小时 |
| `console/src/contexts/ProjectContext.tsx` | 上下文 | 150行 | 0行 | 中等 | 2小时 |
| `console/src/hooks/useProjects.ts` | Hook | 50行 | 0行 | 简单 | 1小时 |
| `console/src/components/layout/Sidebar.tsx` | UI 组件 | 80行 | 0行 | 简单 | 1小时 |
| `console/src/components/layout/Layout.tsx` | UI 组件 | 20行 | 0行 | 简单 | 0.5小时 |
| `console/src/App.tsx` | 根组件 | 0行 | 10行 | 简单 | 0.5小时 |
| `console/src/hooks/useEmployees.ts` | Hook | 0行 | 10行 | 简单 | 0.5小时 |
| `console/src/hooks/useEvents.ts` | Hook | 0行 | 10行 | 简单 | 0.5小时 |
| `console/src/hooks/useMessages.ts` | Hook | 0行 | 10行 | 简单 | 0.5小时 |
| `console/src/hooks/useStats.ts` | Hook | 0行 | 10行 | 简单 | 0.5小时 |
| `console/src/hooks/useTasks.ts` | Hook | 0行 | 10行 | 简单 | 0.5小时 |
| **小计** | - | **360行** | **175行** | **中等** | **10.5小时** |

---

## 实施顺序建议

### 阶段 1: 后端补充 (阻塞项) - 1-2小时

**必须先完成，否则前端无法正常工作**

1. 修改 `src/types/index.ts` - Event 接口添加 projectId
2. 修改 `src/state/StateManager.ts` - 添加 projectId 参数和字段
3. 修改 `src/core/MessageService.ts` - 添加 projectId 参数
4. 修改 `src/core/MemoryManager.ts` - 添加 projectId 参数
5. 修改 `src/server/GlobalServer.ts` - 创建服务时传递 projectId
6. 测试验证事件包含 projectId

**验证方法**:
```bash
# 启动插件，打开浏览器开发者工具
# 查看 WebSocket 消息，确认 Event 包含 projectId 字段
```

**完成标准**:
- ✅ 所有 Event 对象包含 projectId 字段
- ✅ 不同 project 的事件有不同的 projectId
- ✅ 编译无错误
- ✅ 现有测试通过

---

### 阶段 2: 前端基础设施 - 4-6小时

#### 步骤 1: 类型定义和 API 改造 (2-3小时)

1. 修改 `console/src/types/index.ts`
   - 添加 Project 类型
   - 修改 Event 类型添加 projectId

2. 修改 `console/src/services/api.ts`
   - 添加 currentProjectId 字段
   - 添加 setProject() 方法
   - 添加 getProjects() 方法
   - 修改所有 API 方法路径

3. 修改 `console/src/services/websocket.ts`
   - 添加 currentProjectId 字段
   - 添加 setProject() 方法
   - 修改事件处理逻辑，过滤 projectId

**验证方法**:
```bash
# 在浏览器控制台测试
apiClient.getProjects()  # 应该返回 project 列表
```

#### 步骤 2: 上下文和 Hooks (2-3小时)

4. 创建 `console/src/contexts/ProjectContext.tsx`
   - ProjectProvider 组件
   - useProjectContext hook

5. 创建 `console/src/hooks/useProjects.ts`
   - 加载 project 列表

**验证方法**:
```typescript
// 在组件中测试
const { projects, currentProject } = useProjectContext()
console.log(projects, currentProject)
```

---

### 阶段 3: 前端 UI - 2-4小时

#### 步骤 1: 布局组件 (1-2小时)

1. 创建 `console/src/components/layout/Sidebar.tsx`
   - 显示 project 列表
   - 高亮当前 project
   - 点击切换 project

2. 创建 `console/src/components/layout/Layout.tsx`
   - 包含 Sidebar 和主内容区域

3. 修改 `console/src/App.tsx`
   - 包裹 ProjectProvider
   - 包裹 Layout

**验证方法**:
```bash
cd console
bun run dev
# 打开浏览器，应该看到侧边栏显示 project 列表
```

#### 步骤 2: Hooks 修改 (1-2小时)

4. 修改所有 hooks，添加 currentProject 依赖:
   - `console/src/hooks/useEmployees.ts`
   - `console/src/hooks/useEvents.ts`
   - `console/src/hooks/useMessages.ts`
   - `console/src/hooks/useStats.ts`
   - `console/src/hooks/useTasks.ts`

**验证方法**:
```bash
# 在浏览器中
# 1. 点击不同 project，数据应该切换
# 2. 打开开发者工具，查看网络请求路径是否正确
```

---

### 阶段 4: 测试和优化 - 2-3小时

#### 功能测试

1. **多 project 切换测试**
   - [ ] 侧边栏显示所有 project
   - [ ] 点击 project 切换成功
   - [ ] 切换 project 后员工列表更新
   - [ ] 切换 project 后统计数据更新
   - [ ] 切换 project 后事件流更新

2. **实时事件过滤测试**
   - [ ] WebSocket 事件正确过滤 (只显示当前 project 的事件)
   - [ ] 切换 project 后不再收到旧 project 的事件

3. **边界情况测试**
   - [ ] 无 project 时显示友好提示
   - [ ] 单 project 时侧边栏正常显示
   - [ ] 多 project 时切换流畅无卡顿

#### 集成测试

4. **端到端测试**
   - [ ] 启动多个 project，Console 显示所有 project
   - [ ] 在 Project A 中发送消息，只在 Project A 的事件流中显示
   - [ ] 在 Project B 中创建任务，只在 Project B 的任务列表中显示
   - [ ] 切换 project 时 WebSocket 连接保持，事件正确过滤

#### 性能优化

5. **性能检查**
   - [ ] 切换 project 时避免不必要的重新渲染
   - [ ] WebSocket 事件过滤性能良好
   - [ ] 大量 project 时侧边栏滚动流畅

---

## 关键风险点

### 1. 后端 Event 必须先添加 projectId

**风险**: 如果后端没有先添加 projectId，前端无法区分不同 project 的事件

**影响**: 
- Project A 的事件显示在 Project B 的界面上
- 切换 project 后仍然收到旧 project 的事件
- 数据混乱，用户体验极差

**缓解措施**:
- 后端修改必须先完成并验证
- 前端开发前先确认后端 Event 包含 projectId

---

### 2. WebSocket 事件过滤

**风险**: 事件过滤逻辑错误导致事件丢失或显示错误

**影响**:
- 用户看不到应该看到的事件
- 或者看到不应该看到的事件

**缓解措施**:
- 仔细测试事件过滤逻辑
- 添加日志记录过滤的事件
- 在开发者工具中验证 WebSocket 消息

---

### 3. API 路径变更

**风险**: 遗漏某个 API 方法的路径更新

**影响**:
- 该功能无法正常工作
- 返回 404 错误

**缓解措施**:
- 使用 grep 搜索所有 API 调用
- 逐个检查每个方法
- 编写测试覆盖所有 API 端点

---

### 4. 状态管理

**风险**: 切换 project 时状态没有正确清理和重新加载

**影响**:
- 显示旧 project 的数据
- 数据混乱

**缓解措施**:
- 在 useEffect 中添加 currentProject 依赖
- 切换 project 时重新加载所有数据
- 测试切换 project 的各种场景

---

## 常见问题 (FAQ)

### Q1: 为什么 Event 必须包含 projectId?

**A**: 因为 WebSocket 是全局的，所有 project 的事件都通过同一个 WebSocket 连接推送。如果 Event 没有 projectId，前端无法区分事件属于哪个 project，会导致:
- Project A 的事件显示在 Project B 的界面上
- 切换 project 后仍然收到旧 project 的事件

---

### Q2: 为什么不为每个 project 创建独立的 WebSocket 连接?

**A**: 
- **增加复杂度**: 需要管理多个 WebSocket 连接的生命周期
- **资源浪费**: 大部分时间用户只关注一个 project
- **实现简单**: 在 Event 中添加 projectId 更简单直接

---

### Q3: 切换 project 时会重新连接 WebSocket 吗?

**A**: 不会。WebSocket 连接保持不变，只是前端过滤事件时使用不同的 projectId。

---

### Q4: 如果后端 Event 暂时无法添加 projectId 怎么办?

**A**: 可以临时方案:
1. 前端不过滤 WebSocket 事件，显示所有 project 的事件
2. 在事件流中显示 projectId (如果有其他方式获取)
3. 但这不是长期方案，最终还是需要后端添加 projectId

---

### Q5: 为什么选择侧边栏而不是顶部下拉菜单?

**A**: 
- 侧边栏可以同时显示所有 project，一目了然
- 点击切换比下拉菜单更直观
- 可以显示更多 project 信息 (名称 + 路径)
- 符合常见的管理后台设计模式

---

## 验证清单

### 后端验证

- [ ] Event 接口包含 projectId 字段
- [ ] StateManager 构造函数接受 projectId 参数
- [ ] MessageService 构造函数接受 projectId 参数
- [ ] MemoryManager 构造函数接受 projectId 参数
- [ ] GlobalServer 创建服务时传递 projectId
- [ ] 所有 addEvent 调用包含 projectId
- [ ] 编译无错误
- [ ] 现有测试通过
- [ ] WebSocket 消息包含 projectId (浏览器开发者工具验证)

### 前端验证

- [ ] Project 类型定义正确
- [ ] Event 类型包含 projectId
- [ ] ApiClient.getProjects() 返回 project 列表
- [ ] ApiClient.setProject() 正确设置 currentProjectId
- [ ] 所有 API 方法路径更新为 `/api/projects/:projectId/...`
- [ ] WebSocketClient.setProject() 正确设置 currentProjectId
- [ ] WebSocket 事件过滤逻辑正确
- [ ] ProjectContext 正确管理 projects 和 currentProject
- [ ] Sidebar 显示所有 project
- [ ] 点击 project 切换成功
- [ ] 切换 project 后数据正确更新
- [ ] 所有 hooks 添加 currentProject 依赖
- [ ] 编译无错误
- [ ] 无 TypeScript 类型错误

### 集成验证

- [ ] 启动多个 project，Console 显示所有 project
- [ ] 在 Project A 中发送消息，只在 Project A 的事件流中显示
- [ ] 在 Project B 中创建任务，只在 Project B 的任务列表中显示
- [ ] 切换 project 时 WebSocket 连接保持，事件正确过滤
- [ ] 无 project 时显示友好提示
- [ ] 单 project 时侧边栏正常显示
- [ ] 多 project 时切换流畅无卡顿

---

## 参考资料

- [主需求文档](../../REQUIREMENTS.md) - 插件核心功能需求
- [Console 需求文档](../REQUIREMENTS.md) - Console 原始需求
- [多 Project 迁移文档](./Multi-Project-Migration.md) - 架构设计和迁移方案
- [后端 Router 实现](../../src/server/router.ts) - 多 project API 实现
- [后端 GlobalServer 实现](../../src/server/GlobalServer.ts) - 单例模式实现

---

## 总结

### 修改规模

- **总文件数**: 18个
- **新增代码**: ~380行
- **修改代码**: ~225行
- **总代码量**: ~605行

### 难度评估

- **整体难度**: 中等
- **后端难度**: 简单 (主要是添加参数和字段)
- **前端难度**: 中等 (需要理解 React Context 和状态管理)

### 时间评估

- **后端**: 1-2小时
- **前端**: 7.5-10.5小时
- **测试**: 2-3小时
- **总计**: 10.5-15.5小时

### 关键成功因素

1. **后端先行**: 后端 Event 必须先添加 projectId
2. **系统测试**: 每个阶段完成后进行验证
3. **渐进实施**: 按照建议的顺序逐步实施
4. **充分测试**: 覆盖所有边界情况和集成场景

### 风险评估

- **风险等级**: 低-中等
- **主要风险**: 后端 Event 未添加 projectId
- **缓解措施**: 后端优先，充分测试

---

**文档版本**: 1.0  
**最后更新**: 2026-03-02  
**维护者**: 八叶草 AI Assistant
