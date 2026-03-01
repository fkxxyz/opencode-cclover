# Console 多 Project 支持 - 迁移文档

## 1. 为什么要改

### 1.1 问题背景

OpenCode 会为每个 project 启动一个插件实例,导致以下问题:

**原有架构问题:**
- HTTP 服务在每个插件实例初始化时启动
- 多个 project 会尝试启动多个 HTTP 服务
- 端口冲突导致只有第一个 project 能正常工作

**示例:**
```
Project A → 插件实例 A → 启动 HTTP 服务 (4097端口) ✅
Project B → 插件实例 B → 启动 HTTP 服务 (4097端口) ❌ 端口冲突!
Project C → 插件实例 C → 启动 HTTP 服务 (4097端口) ❌ 端口冲突!
```

### 1.2 解决方案

**新架构:**
- HTTP 服务改为全局单例,只启动一次
- 每个 project 实例注册到全局服务
- Console 界面支持切换和管理多个 project

```
┌─────────────────────────────────────────────────────────┐
│ GlobalServer (单例, 4097端口)                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ProjectRegistry                                     │ │
│ │ ├─ ProjectA: {stateManager, messageService, ...}   │ │
│ │ ├─ ProjectB: {stateManager, messageService, ...}   │ │
│ │ └─ ProjectC: {stateManager, messageService, ...}   │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
         ▲              ▲              ▲
         │              │              │
    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
    │ Plugin  │    │ Plugin  │    │ Plugin  │
    │Instance │    │Instance │    │Instance │
    │(ProjectA)│   │(ProjectB)│   │(ProjectC)│
    └─────────┘    └─────────┘    └─────────┘
```

---

## 2. 架构决策

### 2.1 核心设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| **实例隔离** | 每个 project 独立的员工系统 | 不同 project 如同不同公司,完全独立 |
| **工作空间** | Project 级别 (`{projectRoot}/.cclover/workspace/`) | 每个 project 有独立的记忆和历史 |
| **角色共享** | 所有实例共享角色定义 | 角色是代码级别的模板,可复用 |
| **跨 project 通信** | 不刻意支持也不刻意禁止 | 自然隔离,实现简单 |
| **HTTP 服务** | 全局单例,管理所有 project | 避免端口冲突,统一管理 |
| **启动时机** | 单例模式,首次插件初始化时启动 | 确保只启动一次 |
| **注册机制** | 注册服务实例引用 | API 需要直接访问各 project 的服务 |
| **StateManager** | 每个 project 独立实例 | 每个 project 有独立的员工状态 |
| **Console 界面** | 侧边栏显示所有 project,点击切换 | 直观,易用 |
| **切换交互** | 只更新数据,不刷新页面 | 体验流畅 |

### 2.2 Project 标识符

```typescript
interface Project {
  projectId: string      // 唯一标识 (后端生成)
  projectName: string    // 项目名称 (从 directory 提取)
  directory: string      // 项目路径
}
```

### 2.3 API 结构

**新的 API 路径格式:**
```
GET /api/projects                                    # 获取所有 project 列表
GET /api/projects/:projectId/employees               # 获取指定 project 的员工
GET /api/projects/:projectId/employees/:name         # 获取员工详情
GET /api/projects/:projectId/employees/:name/messages
GET /api/projects/:projectId/employees/:name/tasks
GET /api/projects/:projectId/events
GET /api/projects/:projectId/stats
GET /api/projects/:projectId/employees/hierarchy
```

**旧的 API 路径 (已废弃):**
```
GET /api/employees
GET /api/employees/:name
...
```

---

## 3. 后端改动 (已完成)

### 3.1 已实现的功能

✅ **GlobalServer 单例模式**
- 文件: `src/server/GlobalServer.ts`
- 功能: 确保 HTTP 服务只启动一次

✅ **ProjectRegistry**
- 文件: `src/server/ProjectRegistry.ts`
- 功能: 管理所有 project 实例的注册和查询

✅ **多 project API 路由**
- 文件: `src/server/router.ts`
- 功能: 支持 `/api/projects/:projectId/...` 路径格式

✅ **插件入口改造**
- 文件: `src/index.ts`
- 功能: 每个插件实例注册到全局服务

### 3.2 需要补充的后端改动

#### ⚠️ **关键阻塞项: Event 接口缺少 projectId**

**问题:**
当前 Event 接口没有 projectId 字段,导致前端无法区分不同 project 的事件。

**需要修改的文件:**

**1. `src/types/index.ts`**
```typescript
// 修改前
export interface Event {
  type: EventType
  timestamp: string
  employeeName?: string
  details: Record<string, any>
}

// 修改后
export interface Event {
  projectId: string           // 新增!
  type: EventType
  timestamp: string
  employeeName?: string
  details: Record<string, any>
}
```

**2. `src/state/StateManager.ts`**

StateManager 发射事件时需要包含 projectId:

```typescript
// 修改前
this.emit("event", {
  type: "employee_status_changed",
  timestamp: new Date().toISOString(),
  employeeName: name,
  details: { status, lastActiveAt }
})

// 修改后
this.emit("event", {
  projectId: this.projectId,  // 新增!
  type: "employee_status_changed",
  timestamp: new Date().toISOString(),
  employeeName: name,
  details: { status, lastActiveAt }
})
```

**需要做的:**
1. StateManager 构造函数添加 `projectId` 参数
2. 所有 `emit("event", ...)` 调用添加 `projectId` 字段
3. 更新插件入口传递 projectId 给 StateManager

**影响范围:**
- `src/state/StateManager.ts` - 添加 projectId 参数和字段
- `src/index.ts` - 创建 StateManager 时传递 projectId
- `src/types/index.ts` - Event 接口添加 projectId 字段

---

## 4. Console 前端改动

### 4.1 改动概览

| 类别 | 新增代码 | 修改代码 | 难度 |
|------|---------|---------|------|
| 类型定义 | ~30行 | ~10行 | 简单 |
| API 客户端 | ~50行 | ~100行 | 中等 |
| 状态管理 | ~150行 | ~50行 | 中等 |
| UI 组件 | ~200行 | ~80行 | 中等 |
| **总计** | **~430行** | **~260行** | **中等** |

### 4.2 新增文件清单

```
console/src/
├── contexts/
│   └── ProjectContext.tsx      # Project 上下文 (新增)
├── hooks/
│   └── useProjects.ts          # Project 列表 hook (新增)
└── components/
    └── layout/
        ├── Sidebar.tsx         # 侧边栏组件 (新增)
        └── Layout.tsx          # 布局容器 (新增)
```

### 4.3 修改文件清单

```
console/src/
├── types/index.ts              # 添加 Project 类型,修改 Event 类型
├── services/
│   ├── api.ts                  # 改造为多 project API
│   └── websocket.ts            # 添加 projectId 过滤
├── hooks/
│   ├── useEmployees.ts         # 添加 currentProject 依赖
│   ├── useEvents.ts            # 添加 currentProject 依赖
│   ├── useMessages.ts          # 添加 currentProject 依赖
│   ├── useStats.ts             # 添加 currentProject 依赖
│   └── useTasks.ts             # 添加 currentProject 依赖
├── pages/
│   ├── Overview.tsx            # 使用 ProjectContext
│   └── EmployeeDetail.tsx      # 使用 ProjectContext
└── App.tsx                     # 包裹 Provider 和 Layout
```

### 4.4 详细修改说明

#### 4.4.1 类型定义 (`src/types/index.ts`)

**新增类型:**
```typescript
// Project 类型
export interface Project {
  projectId: string
  projectName: string
  directory: string
}
```

**修改类型:**
```typescript
// Event 类型添加 projectId
export interface Event {
  projectId: string           // 新增!
  type: EventType
  timestamp: string
  employeeName?: string
  details: Record<string, unknown>
}
```

#### 4.4.2 API 客户端 (`src/services/api.ts`)

**核心改动:**
```typescript
export class ApiClient {
  private currentProjectId: string | null = null

  // 新增: 设置当前 project
  setProject(projectId: string): void {
    this.currentProjectId = projectId
  }

  // 新增: 获取 project 列表
  async getProjects(): Promise<Project[]> {
    const data = await this.request<{ projects: Project[] }>("/projects")
    return data.projects
  }

  // 修改: 所有方法改为 /projects/:projectId/... 格式
  async getEmployees(): Promise<Employee[]> {
    if (!this.currentProjectId) {
      throw new Error("No project selected")
    }
    const data = await this.request<{ employees: Employee[] }>(
      `/projects/${this.currentProjectId}/employees`
    )
    return data.employees
  }

  async getEmployeeDetail(name: string): Promise<EmployeeDetail> {
    if (!this.currentProjectId) {
      throw new Error("No project selected")
    }
    return this.request<EmployeeDetail>(
      `/projects/${this.currentProjectId}/employees/${name}`
    )
  }

  // ... 其他方法类似修改
}
```

**需要修改的方法:**
- `getEmployees()`
- `getEmployeeDetail(name)`
- `getMessages(employeeName, peer?, limit?)`
- `getTasks(employeeName)`
- `getEvents(options?)`
- `getHierarchy()`
- `getStats()`

#### 4.4.3 WebSocket 客户端 (`src/services/websocket.ts`)

**添加 projectId 过滤:**
```typescript
export class WebSocketClient {
  private currentProjectId: string | null = null

  // 新增: 设置当前 project
  setProject(projectId: string): void {
    this.currentProjectId = projectId
  }

  // 修改: 处理事件时过滤 projectId
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
}
```

#### 4.4.4 Project 上下文 (`src/contexts/ProjectContext.tsx`)

**新建文件:**
```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import type { Project } from "../types"
import { apiClient } from "../services"

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

#### 4.4.5 侧边栏组件 (`src/components/layout/Sidebar.tsx`)

**新建文件:**
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

#### 4.4.6 布局组件 (`src/components/layout/Layout.tsx`)

**新建文件:**
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

#### 4.4.7 App 组件 (`src/App.tsx`)

**修改:**
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

#### 4.4.8 Hooks 修改

**所有 hooks 都需要添加 `currentProject` 依赖:**

**示例: `src/hooks/useEmployees.ts`**
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
      const employeeName = event.employeeName
      if (employeeName) {
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.name === employeeName
              ? {
                  ...emp,
                  status:
                    (event.details.status as Employee["status"]) || emp.status,
                  lastActiveAt:
                    (event.details.lastActiveAt as string) || emp.lastActiveAt,
                }
              : emp
          )
        )
      }
    })
    return unsubscribe
  }, [subscribe])

  return { employees, loading, error }
}
```

**需要类似修改的 hooks:**
- `src/hooks/useEvents.ts`
- `src/hooks/useMessages.ts`
- `src/hooks/useStats.ts`
- `src/hooks/useTasks.ts`

**修改要点:**
1. 导入 `useProjectContext`
2. 获取 `currentProject`
3. 在 `useEffect` 中添加 `if (!currentProject) return` 检查
4. 在 `useEffect` 依赖数组中添加 `currentProject`

#### 4.4.9 页面组件修改

**`src/pages/Overview.tsx` 和 `src/pages/EmployeeDetail.tsx`:**

只需要确保使用了正确的 hooks,不需要额外修改。因为 hooks 已经处理了 `currentProject` 的变化。

---

## 5. 实现顺序

### 阶段 1: 后端补充 (阻塞)

**必须先完成,否则前端无法正常工作**

1. 修改 `src/types/index.ts` - Event 接口添加 projectId
2. 修改 `src/state/StateManager.ts` - 添加 projectId 参数和字段
3. 修改 `src/index.ts` - 创建 StateManager 时传递 projectId
4. 测试验证事件包含 projectId

**验证方法:**
```bash
# 启动插件,打开浏览器开发者工具
# 查看 WebSocket 消息,确认 Event 包含 projectId 字段
```

### 阶段 2: 前端基础设施

1. 修改 `src/types/index.ts` - 添加 Project 类型,修改 Event 类型
2. 创建 `src/contexts/ProjectContext.tsx`
3. 创建 `src/hooks/useProjects.ts`
4. 修改 `src/services/api.ts` - 改造为多 project API
5. 修改 `src/services/websocket.ts` - 添加 projectId 过滤

**验证方法:**
```bash
# 在浏览器控制台测试
apiClient.getProjects()  # 应该返回 project 列表
```

### 阶段 3: 前端 UI

1. 创建 `src/components/layout/Sidebar.tsx`
2. 创建 `src/components/layout/Layout.tsx`
3. 修改 `src/App.tsx` - 包裹 Provider 和 Layout
4. 修改所有 hooks - 添加 currentProject 依赖
   - `src/hooks/useEmployees.ts`
   - `src/hooks/useEvents.ts`
   - `src/hooks/useMessages.ts`
   - `src/hooks/useStats.ts`
   - `src/hooks/useTasks.ts`

**验证方法:**
```bash
# 启动开发服务器
cd console
bun run dev

# 打开浏览器,应该看到侧边栏显示 project 列表
# 点击不同 project,数据应该切换
```

### 阶段 4: 测试和优化

1. 多 project 切换测试
2. 实时事件过滤测试
3. 边界情况测试 (无 project, 单 project, 多 project)
4. 性能优化 (避免不必要的重新渲染)

---

## 6. 测试清单

### 6.1 后端测试

- [ ] Event 包含 projectId 字段
- [ ] 不同 project 的事件有不同的 projectId
- [ ] `/api/projects` 返回所有 project 列表
- [ ] `/api/projects/:projectId/employees` 返回正确的员工列表
- [ ] 切换 project 后数据正确隔离

### 6.2 前端测试

- [ ] 侧边栏显示所有 project
- [ ] 点击 project 切换成功
- [ ] 切换 project 后员工列表更新
- [ ] 切换 project 后统计数据更新
- [ ] 切换 project 后事件流更新
- [ ] WebSocket 事件正确过滤 (只显示当前 project 的事件)
- [ ] 无 project 时显示友好提示
- [ ] 单 project 时侧边栏正常显示
- [ ] 多 project 时切换流畅无卡顿

### 6.3 集成测试

- [ ] 启动多个 project,Console 显示所有 project
- [ ] 在 Project A 中发送消息,只在 Project A 的事件流中显示
- [ ] 在 Project B 中创建任务,只在 Project B 的任务列表中显示
- [ ] 切换 project 时 WebSocket 连接保持,事件正确过滤

---

## 7. 常见问题

### Q1: 为什么 Event 必须包含 projectId?

**A:** 因为 WebSocket 是全局的,所有 project 的事件都通过同一个 WebSocket 连接推送。如果 Event 没有 projectId,前端无法区分事件属于哪个 project,会导致:
- Project A 的事件显示在 Project B 的界面上
- 切换 project 后仍然收到旧 project 的事件

### Q2: 为什么不为每个 project 创建独立的 WebSocket 连接?

**A:** 
- 增加复杂度: 需要管理多个 WebSocket 连接的生命周期
- 资源浪费: 大部分时间用户只关注一个 project
- 实现简单: 在 Event 中添加 projectId 更简单直接

### Q3: 切换 project 时会重新连接 WebSocket 吗?

**A:** 不会。WebSocket 连接保持不变,只是前端过滤事件时使用不同的 projectId。

### Q4: 如果后端 Event 暂时无法添加 projectId 怎么办?

**A:** 可以临时方案:
1. 前端不过滤 WebSocket 事件,显示所有 project 的事件
2. 在事件流中显示 projectId (如果有其他方式获取)
3. 但这不是长期方案,最终还是需要后端添加 projectId

### Q5: 为什么选择侧边栏而不是顶部下拉菜单?

**A:** 
- 侧边栏可以同时显示所有 project,一目了然
- 点击切换比下拉菜单更直观
- 可以显示更多 project 信息 (名称 + 路径)
- 符合常见的管理后台设计模式

---

## 8. 参考资料

- [主需求文档](../../REQUIREMENTS.md) - 插件核心功能需求
- [Console 需求文档](../REQUIREMENTS.md) - Console 原始需求
- [后端 Router 实现](../../src/server/router.ts) - 多 project API 实现
- [后端 GlobalServer 实现](../../src/server/GlobalServer.ts) - 单例模式实现

---

## 9. 总结

**改动量:** 中等 (~700 行代码)

**难度:** 中等

**风险:** 低 (架构清晰,改动范围明确)

**关键阻塞点:** 后端 Event 必须先添加 projectId 字段

**预计工时:**
- 后端补充: 1-2 小时
- 前端基础设施: 3-4 小时
- 前端 UI: 4-5 小时
- 测试和优化: 2-3 小时
- **总计: 10-14 小时**

**成功标准:**
- 侧边栏显示所有 project
- 点击 project 切换成功,数据正确更新
- WebSocket 事件正确过滤
- 多 project 切换流畅无卡顿
