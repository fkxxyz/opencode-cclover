# 多实例架构重构方案

## 1. 为什么需要重构

### 1.1 当前架构的问题

**问题1: 端口冲突**
- OpenCode为每个project启动一个插件实例
- 每个插件实例都尝试启动HTTP服务在4097端口
- 导致第二个project加载时端口冲突

**问题2: 员工生命周期问题**
- 员工的EventLoop在插件实例中启动
- 当project关闭时,员工停止工作
- 不符合"员工持续运行"的设计理念

**问题3: 多实例管理缺失**
- 没有全局视角管理所有project
- Console界面无法切换查看不同project
- 无法实现跨project的统一监控

### 1.2 重构目标

1. **全局单一HTTP服务**: 只启动一个HTTP服务,管理所有project
2. **员工持续运行**: 员工独立于project打开状态,持续工作
3. **多project支持**: Console界面可以切换查看不同project
4. **配置化管理**: 通过配置文件管理需要监控的project

---

## 2. 架构决策

### 2.1 核心设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 实例隔离 | 每个project独立的员工系统 | 不同project像不同公司,完全独立 |
| 工作空间 | Project级别 (`{projectRoot}/.cclover/workspace/`) | 每个project有自己的员工和记忆 |
| 角色定义 | 全局共享(代码级别) | 角色是模板,可复用 |
| HTTP服务 | 全局单例,管理所有project | 避免端口冲突,统一管理 |
| Project发现 | 配置文件 (`~/.config/opencode-cclover/config.yaml`) | 明确指定需要管理的project |
| 员工启动 | 全局服务启动,不依赖project打开 | 员工持续运行 |
| 工具注册 | 插件实例注册到OpenCode | 利用OpenCode工具系统 |
| 服务启动 | 单例模式,首个插件实例触发 | 简单可靠 |

### 2.2 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│ 配置文件: ~/.config/opencode-cclover/config.yaml            │
│ projects:                                                    │
│   - name: my-app                                            │
│     path: /path/to/my-app                                   │
│     enabled: true                                           │
└─────────────────────────────────────────────────────────────┘
                          ↓ 读取
┌─────────────────────────────────────────────────────────────┐
│ GlobalCcloverService (全局单例)                             │
│ ├─ 读取配置,发现所有project                                 │
│ ├─ 为每个project创建服务实例                                │
│ │  ├─ MessageService                                        │
│ │  ├─ MemoryManager                                         │
│ │  ├─ StateManager                                          │
│ │  └─ AgentRegistry                                         │
│ ├─ 启动每个project的员工EventLoop                           │
│ └─ 提供HTTP/WebSocket API (4097端口)                        │
└─────────────────────────────────────────────────────────────┘
                          ↓ 查询
┌─────────────────────────────────────────────────────────────┐
│ OpenCode Plugin Instance (每个project一个)                  │
│ ├─ 从全局服务获取当前project的服务实例                       │
│ ├─ 创建工具(使用project的服务实例)                          │
│ └─ 注册工具到OpenCode (return { tool: tools })              │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 职责划分

**全局服务 (GlobalCcloverService)**:
- 读取配置文件,管理所有project
- 为每个project创建独立的服务实例
- 启动员工EventLoop(持续运行)
- 提供HTTP/WebSocket API

**插件实例 (CcloverPlugin)**:
- 从全局服务获取当前project的服务实例
- 创建工具并注册到OpenCode
- **仅此而已** - 不启动员工,不启动HTTP服务

---

## 3. 模块修改清单

### 3.1 新增模块

#### 3.1.1 配置文件

**位置**: `~/.config/opencode-cclover/config.yaml`

**格式**:
```yaml
projects:
  - name: my-app
    path: /home/user/projects/my-app
    enabled: true
  
  - name: blog
    path: /home/user/projects/blog
    enabled: true
  
  - name: api-server
    path: /home/user/projects/api-server
    enabled: false  # 禁用的project不会启动员工
```

**创建时机**: 用户手动创建,或提供CLI工具辅助

#### 3.1.2 配置管理模块

**位置**: `src/config/ConfigManager.ts` (新建)

**职责**:
- 读取和解析配置文件
- 验证配置格式
- 提供配置更新接口

**接口**:
```typescript
export interface ProjectConfig {
  name: string
  path: string
  enabled: boolean
}

export interface CcloverConfig {
  projects: ProjectConfig[]
}

export class ConfigManager {
  private static CONFIG_PATH = path.join(
    os.homedir(),
    '.config/opencode-cclover/config.yaml'
  )
  
  // 读取配置
  static async load(): Promise<CcloverConfig>
  
  // 保存配置
  static async save(config: CcloverConfig): Promise<void>
  
  // 验证配置
  static validate(config: CcloverConfig): boolean
}
```

#### 3.1.3 Project注册表

**位置**: `src/server/ProjectRegistry.ts` (新建)

**职责**:
- 管理所有project实例
- 提供project查询接口

**接口**:
```typescript
export interface ProjectInstance {
  projectId: string           // 唯一标识(使用path的hash)
  projectName: string         // 项目名称
  directory: string           // 项目路径
  workspaceRoot: string       // .cclover/workspace路径
  stateManager: StateManager
  messageService: MessageService
  memoryManager: MemoryManager
  agentRegistry: AgentRegistry
}

export class ProjectRegistry {
  private projects: Map<string, ProjectInstance>
  
  // 注册project
  register(project: ProjectInstance): void
  
  // 注销project
  unregister(projectId: string): void
  
  // 获取project
  get(projectId: string): ProjectInstance | undefined
  
  // 通过路径获取project
  getByPath(directory: string): ProjectInstance | undefined
  
  // 获取所有project
  getAll(): ProjectInstance[]
}
```

#### 3.1.4 全局服务单例

**位置**: `src/server/GlobalServer.ts` (新建)

**职责**:
- 单例模式管理全局服务
- 初始化所有project
- 启动HTTP服务
- 启动员工EventLoop

**接口**:
```typescript
export class GlobalCcloverService {
  private static instance: GlobalCcloverService | null = null
  private projectRegistry: ProjectRegistry
  private httpServer: ConsoleServer | null = null
  private initialized: boolean = false
  
  // 获取单例
  static async getInstance(): Promise<GlobalCcloverService>
  
  // 初始化服务
  private async initialize(): Promise<void>
  
  // 加载配置并初始化所有project
  private async loadProjects(): Promise<void>
  
  // 初始化单个project
  private async initializeProject(config: ProjectConfig): Promise<void>
  
  // 启动project的员工
  private startEmployees(project: ProjectInstance): void
  
  // 获取project
  getProject(directory: string): ProjectInstance | undefined
  
  // 获取所有project
  getAllProjects(): ProjectInstance[]
}
```

**实现要点**:
```typescript
export class GlobalCcloverService {
  static async getInstance(): Promise<GlobalCcloverService> {
    if (!this.instance) {
      this.instance = new GlobalCcloverService()
      await this.instance.initialize()
    }
    return this.instance
  }
  
  private async initialize(): Promise<void> {
    if (this.initialized) return
    
    logger.info("Initializing GlobalCcloverService...")
    
    // 1. 加载配置并初始化所有project
    await this.loadProjects()
    
    // 2. 启动HTTP服务(单例)
    this.httpServer = new ConsoleServer(
      { port: 4097 },
      this.projectRegistry
    )
    await this.httpServer.start()
    
    this.initialized = true
    logger.info("GlobalCcloverService initialized")
  }
  
  private async loadProjects(): Promise<void> {
    const config = await ConfigManager.load()
    
    for (const projectConfig of config.projects) {
      if (projectConfig.enabled) {
        await this.initializeProject(projectConfig)
      }
    }
  }
  
  private async initializeProject(config: ProjectConfig): Promise<void> {
    const workspaceRoot = path.join(config.path, '.cclover/workspace')
    
    // 创建服务实例
    const stateManager = new StateManager()
    const messageService = new MessageService(workspaceRoot, stateManager)
    const memoryManager = new MemoryManager(workspaceRoot, stateManager)
    const agentRegistry = new AgentRegistry()
    
    // 注册到registry
    const projectInstance: ProjectInstance = {
      projectId: hashPath(config.path),
      projectName: config.name,
      directory: config.path,
      workspaceRoot,
      stateManager,
      messageService,
      memoryManager,
      agentRegistry,
    }
    
    this.projectRegistry.register(projectInstance)
    
    // 启动员工
    this.startEmployees(projectInstance)
    
    logger.info(`Project initialized: ${config.name}`)
  }
  
  private startEmployees(project: ProjectInstance): void {
    // 注册初始员工
    project.stateManager.registerEmployee({
      name: "calculator",
      role: "calculator",
      status: "inactive",
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    })
    
    // 启动员工EventLoop
    const messageClient = project.messageService.getClient("calculator")
    const opcodeClient = createOpencodeClient()  // 使用SDK创建client
    
    const eventLoop = new EventLoop(
      "calculator",
      CalculatorRole,
      messageClient,
      project.memoryManager,
      opcodeClient,
      project.stateManager
    )
    
    // 后台运行
    eventLoop.run().catch((error) => {
      logger.error(`[calculator] EventLoop crashed:`, error)
    })
  }
}
```

### 3.2 修改模块

#### 3.2.1 插件入口

**位置**: `src/index.ts`

**当前代码** (第87-162行):
```typescript
export const CcloverPlugin: Plugin = async (ctx) => {
  // 1. 初始化工作空间
  const workspaceRoot = path.join(ctx.directory, ".cclover/workspace")
  
  // 2-7. 初始化各种服务...
  const messageService = new MessageService(workspaceRoot)
  const memoryManager = new MemoryManager(workspaceRoot)
  const stateManager = new StateManager()
  
  // 8. 创建工具
  const tools = createTools({...})
  
  // 9. 启动员工
  startEmployees(...)
  
  // 10. 启动HTTP服务 ← 问题所在!
  await createAndStartServer(...)
  
  // 11. 返回工具
  return { tool: tools }
}
```

**修改后**:
```typescript
export const CcloverPlugin: Plugin = async (ctx) => {
  logger.info("Initializing opencode-cclover plugin...")
  
  // 1. 确保全局服务已启动(单例,只启动一次)
  const globalService = await GlobalCcloverService.getInstance()
  
  // 2. 确保 .gitignore
  await ensureGitignore(ctx.directory)
  
  // 3. 从全局服务获取当前project的服务实例
  const project = globalService.getProject(ctx.directory)
  
  if (!project) {
    logger.warn(`Project not found in config: ${ctx.directory}`)
    logger.warn("Please add this project to ~/.config/opencode-cclover/config.yaml")
    return {}  // 返回空,不提供工具
  }
  
  // 4. 创建工具(使用project的服务实例)
  const tools = createTools({
    messageService: project.messageService,
    memoryManager: project.memoryManager,
    opcodeClient: ctx.client,  // 使用插件提供的client
  })
  
  logger.info("Plugin initialized successfully")
  
  // 5. 返回工具(注册到OpenCode)
  return {
    tool: tools,
  }
}
```

**关键变化**:
- 移除所有服务初始化代码
- 移除员工启动代码
- 移除HTTP服务启动代码
- 改为从全局服务获取project实例
- 只负责创建和注册工具

#### 3.2.2 HTTP服务器

**位置**: `src/server/index.ts`

**当前代码** (第12-116行):
```typescript
export class ConsoleServer {
  constructor(config: ServerConfig, deps: ServerDependencies) {
    this.port = config.port || DEFAULT_PORT
    this.deps = deps
    this.router = new Router(deps)
    // ...
  }
}
```

**修改后**:
```typescript
export class ConsoleServer {
  private port: number
  private router: Router
  private wsManager: WebSocketManager
  private projectRegistry: ProjectRegistry  // ← 新增
  private server: any = null
  
  constructor(
    config: ServerConfig,
    projectRegistry: ProjectRegistry  // ← 改为接收projectRegistry
  ) {
    this.port = config.port || DEFAULT_PORT
    this.projectRegistry = projectRegistry
    this.router = new Router(projectRegistry)  // ← 传递projectRegistry
    this.wsManager = new WebSocketManager()
  }
  
  // ... 其他方法保持不变
}
```

**关键变化**:
- 构造函数接收 `ProjectRegistry` 而不是单个project的依赖
- Router也接收 `ProjectRegistry`

#### 3.2.3 路由器

**位置**: `src/server/router.ts`

**当前代码** (第14-146行):
```typescript
export class Router {
  private deps: ServerDependencies
  
  constructor(deps: ServerDependencies) {
    this.deps = deps
  }
  
  async handle(req: Request): Promise<Response> {
    // 直接使用 this.deps.stateManager 等
    if (pathname === "/api/employees" && method === "GET") {
      return this.jsonResponse(employees.getEmployees(this.deps.stateManager))
    }
    // ...
  }
}
```

**修改后**:
```typescript
export class Router {
  private projectRegistry: ProjectRegistry
  
  constructor(projectRegistry: ProjectRegistry) {
    this.projectRegistry = projectRegistry
  }
  
  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const pathname = url.pathname
    const method = req.method
    
    try {
      // 健康检查
      if (pathname === "/api/health" && method === "GET") {
        return this.jsonResponse(health.getHealth())
      }
      
      // 获取所有project列表 ← 新增
      if (pathname === "/api/projects" && method === "GET") {
        const projects = this.projectRegistry.getAll().map(p => ({
          projectId: p.projectId,
          projectName: p.projectName,
          directory: p.directory,
        }))
        return this.jsonResponse({ projects })
      }
      
      // 所有其他API都需要projectId ← 修改
      const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)\/(.+)$/)
      if (!projectMatch) {
        return this.jsonResponse({
          success: false,
          error: {
            code: "INVALID_PATH",
            message: "API路径必须包含projectId: /api/projects/:projectId/...",
          }
        }, 400)
      }
      
      const projectId = projectMatch[1]
      const subpath = projectMatch[2]
      
      // 获取project实例
      const project = this.projectRegistry.get(projectId)
      if (!project) {
        return this.jsonResponse({
          success: false,
          error: {
            code: "PROJECT_NOT_FOUND",
            message: `Project '${projectId}' not found`,
          }
        }, 404)
      }
      
      // 构建依赖对象(兼容现有API处理器)
      const deps: ServerDependencies = {
        stateManager: project.stateManager,
        memoryManager: project.memoryManager,
        messageService: project.messageService,
        agentRegistry: project.agentRegistry,
        workspaceRoot: project.workspaceRoot,
      }
      
      // 分发到具体API处理器
      if (subpath === "employees" && method === "GET") {
        return this.jsonResponse(employees.getEmployees(deps.stateManager))
      }
      
      if (subpath === "employees/hierarchy" && method === "GET") {
        return this.jsonResponse(hierarchy.getHierarchy(deps.stateManager))
      }
      
      if (subpath === "events" && method === "GET") {
        const limit = url.searchParams.get("limit")
          ? parseInt(url.searchParams.get("limit")!)
          : 50
        const employeeName = url.searchParams.get("employeeName") || undefined
        return this.jsonResponse(
          events.getEvents({ limit, employeeName }, deps.stateManager)
        )
      }
      
      if (subpath === "stats" && method === "GET") {
        return this.jsonResponse(
          await stats.getStats(deps.stateManager, deps.memoryManager)
        )
      }
      
      // 员工相关API
      const employeeMatch = subpath.match(/^employees\/([^/]+)(?:\/(.+))?$/)
      if (employeeMatch && method === "GET") {
        const employeeName = employeeMatch[1]
        const employeeSubpath = employeeMatch[2]
        
        if (employeeSubpath === "messages") {
          const peer = url.searchParams.get("peer") || undefined
          const limit = url.searchParams.get("limit")
            ? parseInt(url.searchParams.get("limit")!)
            : 50
          return this.jsonResponse(
            await messages.getMessages(
              employeeName,
              peer,
              limit,
              deps.messageService
            )
          )
        }
        
        if (employeeSubpath === "tasks") {
          return this.jsonResponse(
            await tasks.getTasks(employeeName, deps.memoryManager)
          )
        }
        
        if (!employeeSubpath) {
          return this.jsonResponse(
            await employees.getEmployeeDetail(
              employeeName,
              deps.stateManager,
              deps.memoryManager,
              deps.agentRegistry,
              deps.workspaceRoot
            )
          )
        }
      }
      
      // 404
      return this.jsonResponse({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `路由 ${method} ${pathname} 不存在`,
        }
      }, 404)
    } catch (error: any) {
      console.error("Router error:", error)
      return this.jsonResponse({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message || "内部服务器错误",
        }
      }, 500)
    }
  }
}
```

**关键变化**:
- 构造函数接收 `ProjectRegistry`
- 所有API路径改为 `/api/projects/:projectId/...`
- 新增 `GET /api/projects` 获取project列表
- 从projectRegistry获取project实例,再构建deps对象
- API处理器代码保持不变(仍然接收deps参数)

#### 3.2.4 API处理器

**位置**: `src/api/*.ts`

**修改**: **无需修改**

所有API处理器的函数签名保持不变,仍然接收服务实例作为参数:
```typescript
// src/api/employees.ts
export function getEmployees(stateManager: StateManager) { ... }

// src/api/messages.ts
export async function getMessages(
  employeeName: string,
  peer: string | undefined,
  limit: number,
  messageService: MessageService
) { ... }
```

Router负责从projectRegistry获取project实例,构建deps对象传递给API处理器。

### 3.3 不需要修改的模块

以下模块**完全不需要修改**:

- `src/core/MessageService.ts` - 已经是per-project实例
- `src/core/MemoryManager.ts` - 已经是per-project实例
- `src/state/StateManager.ts` - 已经是per-project实例
- `src/core/EventLoop.ts` - 已经是per-employee实例
- `src/tools/*.ts` - 工具实现无需改动
- `src/utils/*` - 工具函数无需改动
- `src/api/*.ts` - API处理器无需改动

---

## 4. 实现步骤

### 4.1 第一步: 创建配置管理

1. 创建 `src/config/ConfigManager.ts`
2. 实现配置文件读取和验证
3. 添加单元测试

### 4.2 第二步: 创建Project注册表

1. 创建 `src/server/ProjectRegistry.ts`
2. 实现project注册和查询
3. 添加单元测试

### 4.3 第三步: 创建全局服务

1. 创建 `src/server/GlobalServer.ts`
2. 实现单例模式
3. 实现project初始化逻辑
4. 实现员工启动逻辑
5. 添加集成测试

### 4.4 第四步: 修改HTTP服务器

1. 修改 `src/server/index.ts` 的 `ConsoleServer` 构造函数
2. 修改 `src/server/router.ts` 的路由逻辑
3. 添加 `/api/projects` 端点
4. 修改所有API路径为 `/api/projects/:projectId/...`
5. 测试API功能

### 4.5 第五步: 修改插件入口

1. 修改 `src/index.ts` 的 `CcloverPlugin` 函数
2. 移除服务初始化代码
3. 移除员工启动代码
4. 移除HTTP服务启动代码
5. 改为从全局服务获取project实例
6. 测试插件加载

### 4.6 第六步: 端到端测试

1. 创建测试配置文件
2. 启动OpenCode,加载多个project
3. 验证HTTP服务只启动一次
4. 验证员工持续运行
5. 验证Console界面可以切换project

---

## 5. 测试策略

### 5.1 单元测试

- `ConfigManager`: 配置读取、验证、保存
- `ProjectRegistry`: 注册、查询、注销
- `GlobalCcloverService`: 初始化、project管理

### 5.2 集成测试

- 全局服务启动流程
- 多project初始化
- HTTP API多project访问
- 员工EventLoop持续运行

### 5.3 端到端测试

- 创建测试配置文件
- 启动OpenCode加载多个project
- 验证HTTP服务单例
- 验证API功能
- 验证员工工作

---

## 6. 迁移指南

### 6.1 用户迁移步骤

1. **创建配置文件**:
   ```bash
   mkdir -p ~/.config/opencode-cclover
   cat > ~/.config/opencode-cclover/config.yaml << EOF
   projects:
     - name: my-app
       path: /path/to/my-app
       enabled: true
   EOF
   ```

2. **更新插件**:
   ```bash
   cd opencode-cclover
   git pull
   bun install
   bun run build
   ```

3. **重启OpenCode**:
   - 关闭所有OpenCode窗口
   - 重新打开project

4. **验证**:
   - 访问 `http://localhost:4097/api/projects` 查看project列表
   - 访问 Console界面,验证可以切换project

### 6.2 开发者迁移步骤

1. **更新依赖**:
   ```bash
   bun install
   ```

2. **运行测试**:
   ```bash
   bun test
   ```

3. **构建**:
   ```bash
   bun run build
   ```

4. **手动测试**:
   - 创建测试配置文件
   - 启动OpenCode
   - 验证功能

---

## 7. 风险和注意事项

### 7.1 已知风险

1. **配置文件缺失**: 如果用户没有创建配置文件,插件会警告但不会报错
2. **Project路径变化**: 如果project移动位置,需要更新配置文件
3. **端口占用**: 如果4097端口被占用,服务启动失败

### 7.2 缓解措施

1. **配置文件**: 提供CLI工具辅助创建配置
2. **路径变化**: 提供配置更新命令
3. **端口占用**: 支持配置端口号

### 7.3 回滚方案

如果重构出现问题,可以回滚到重构前的版本:
```bash
git checkout <pre-refactor-commit>
bun install
bun run build
```

---

## 8. 后续优化

### 8.1 短期优化

- 提供CLI工具管理配置文件
- 支持配置文件热重载
- 添加project健康检查

### 8.2 长期优化

- 支持project自动发现(扫描目录)
- 支持project动态添加/删除
- 支持project分组管理
- 支持project优先级配置

---

## 9. 参考资料

- [原始需求文档](../REQUIREMENTS.md)
- [Console需求文档](../console/REQUIREMENTS.md)
- [OpenCode插件开发文档](https://github.com/opencode-ai/opencode)
