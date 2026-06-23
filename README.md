# opencode-cclover

多员工自主协作系统 - 基于 OpenCode 插件实现的员工协作框架。

## 概述

opencode-cclover 是一个 OpenCode 插件，实现了多员工自主协作系统。系统模拟员工之间的协作行为，员工可以收发消息、管理任务，并通过 EmployeeWorkSession 运行 OpenCode 会话来完成工作，实现自主决策和并行工作。

### 核心特性

- **事件驱动**: 通过消息、任务完成等事件触发员工行动
- **自主决策**: AI 根据上下文自主决定下一步行动
- **任务管理**: 支持 DAG 任务依赖，自动计算可并行执行的任务
- **记忆系统**: 员工维护自己的经验知识和工作状态
- **并行执行**: 支持多个员工工作会话并行运行

## 项目状态

### 当前进度

**阶段 1: 基础设施层** ✅ 已完成
- ✅ MessageService - 消息收发和同步
- ✅ MemoryManager - 记忆管理和任务 DAG
- ✅ 工具系统框架 - 工具注册和权限管理
- ✅ 工具辅助模块 - Mermaid 生成、上下文构建、注册表
- ✅ 单元测试和集成测试 (79 个测试，100% 通过)

**阶段 2: 核心逻辑层** ✅ 已完成
- ✅ 具体工具实现 (send_message, edit_tasks, create_employee_work_session)
- ✅ EventLoop - 事件循环和 Session 管理
- ✅ Calculator 角色定义

**阶段 3: 集成测试** ✅ 已完成
- ✅ 插件入口集成
- ✅ 端到端测试（可在 workspace_test 目录进行真实测试）

**阶段 4: Console 管理控制台** ✅ 已完成
- ✅ HTTP API 服务器 (端口 4097)
- ✅ WebSocket 实时推送
- ✅ Web 前端界面 (React + MUI)
- ✅ 实时监控员工状态、消息、任务
- 详见 [Console 文档](console/docs/)

## 安装

### 前置要求

- Bun >= 1.0.0
- OpenCode (已安装)

### 本地开发

```bash
# 克隆仓库
git clone <repository-url>
cd opencode-cclover

# 安装依赖
bun install

# 构建
bun run build

# 运行测试
bun test
```

## 快速开始

### 1. 安装依赖

```bash
bun install
```

### 2. 启动测试服务器

```bash
# 启动 OpenCode 测试服务器 (端口 4099)
./start-test-server.sh
```

### 3. 启动 Console 前端

在另一个终端:

```bash
cd console
bun run dev
```

前端将在 `http://localhost:5173` 启动。

### 4. 访问 Console

打开浏览器访问 `http://localhost:5173`,即可看到员工仪表盘。

## 使用方式

### 方法 1: 自动发现（推荐）

将插件放在项目的 `.opencode/plugin/` 目录中：

```bash
# 在你的项目根目录
mkdir -p .opencode/plugin
ln -s /absolute/path/to/opencode-cclover/src/index.ts .opencode/plugin/cclover.ts
```

OpenCode 会自动发现并加载插件。

### 方法 2: 配置文件引用

在项目的 `opencode.json` 中添加：

```json
{
  "plugin": [
    "file:///absolute/path/to/opencode-cclover/src/index.ts"
  ]
}
```

### 方法 3: npm 包（未来）

```json
{
  "plugin": ["opencode-cclover"]
}
```

## 项目结构

```
opencode-cclover/
├── src/
│   ├── index.ts                   # 插件入口
│   ├── core/                      # 核心模块
│   │   ├── MessageService.ts      # 消息服务
│   │   ├── MemoryManager.ts       # 记忆管理
│   │   └── index.ts
│   ├── tools/                     # 工具系统
│   │   ├── SendMessageTool.ts     # send_message 工具
│   │   ├── EditTasksTool.ts       # edit_tasks 工具
│   │   ├── EmployeeTools.ts        # 员工与员工工作会话工具
│   │   ├── HireEmployeeTool.ts    # hire_employee 工具
│   │   └── index.ts
│   ├── utils/                     # 工具辅助模块
│   │   ├── MermaidGenerator.ts    # Mermaid 图生成
│   │   ├── ContextBuilder.ts      # 上下文构建
│   │   ├── SessionRegistry.ts     # Session 注册表
│   │   ├── SessionRegistry.ts     # OpenCode Session 映射注册表
│   │   └── index.ts
│   └── lib/                       # 通用库
│       ├── background.ts          # 后台任务管理
│       └── logger.ts              # 日志工具
├── tests/                         # 测试目录
│   ├── unit/                      # 单元测试
│   ├── integration/               # 集成测试
│   └── fixtures/                  # 测试数据
├── docs/                          # 设计文档
│   ├── 00-Overview.md             # 总览
│   ├── 01-MessageService.md       # 消息服务设计
│   ├── 02-MemoryManager.md        # 记忆管理设计
│   ├── 03-EventLoop.md            # 事件循环设计
│   ├── 04-Tools.md                # 工具系统设计
│   ├── 05-Roles.md                # 角色定义设计
│   ├── 06-PluginEntry.md          # 插件入口设计
│   └── 07-ImplementationPlan.md   # 实现计划
├── console/                      # Web 管理控制台
│   ├── src/                      # 前端源码 (React + MUI)
│   │   ├── components/           # UI 组件
│   │   ├── pages/                # 页面 (Overview, EmployeeDetail, ProjectManagement)
│   │   ├── hooks/                # 自定义 Hooks
│   │   ├── services/             # API 和 WebSocket 客户端
│   │   └── types/                # TypeScript 类型
│   ├── docs/                     # Console 文档
│   │   ├── requirements.md       # 需求文档
│   │   ├── architecture.md       # 架构设计
│   │   ├── design*.md            # 详细设计文档
│   │   └── structure.md          # 文件结构
│   ├── DEVELOPMENT.md            # 前端开发规范
│   └── package.json              # 前端依赖
├── src/server/                   # 后端服务器 (已实现)
│   ├── GlobalServer.ts           # 全局服务器 (单例)
│   ├── ProjectRegistry.ts        # 项目注册表
│   ├── router.ts                 # HTTP 路由
│   ├── websocket.ts              # WebSocket 服务
│   └── index.ts                  # ConsoleServer 主类
├── start-test-server.sh          # 快速启动测试服务器脚本
├── package.json
├── tsconfig.json
├── AGENTS.md                      # 项目开发指南 (英文)
├── AGENTS.zh-CN.md                # 项目开发指南 (中文)
└── README.md                      # 本文件
```

## 开发

### 开发模式

```bash
# 监视模式（自动重新编译）
bun run dev
```

### 运行测试

```bash
# 运行所有测试
bun test

# 运行单元测试
bun test tests/unit

# 运行集成测试
bun test tests/integration

# 运行特定测试文件
bun test tests/unit/MessageService.test.ts

# 查看测试覆盖率
bun test --coverage
```

### 构建

```bash
# 构建生产版本
bun run build
```

## 配置

### 配置文件

配置文件位于 `~/.config/opencode-cclover/config.yaml`。

示例配置：

```yaml
bosses:
  - your_name
port: 4097  # 可选，HTTP 服务器端口（默认：4097）
logLevel: info  # 可选，日志级别：error, warn, info, debug（默认：info）
projects:
  - name: my_project
    path: /absolute/path/to/project
    enabled: true
```

### 日志级别控制

日志级别从低到高：`error` < `warn` < `info` < `debug`

**设置方式**（优先级从高到低）：

1. **环境变量**（临时）：
   ```bash
   CCLOVER_LOG_LEVEL=debug opencode serve --port 4099
   ```

2. **配置文件**（持久）：
   ```yaml
   logLevel: debug
   ```

3. **默认值**：`info`

**日志级别说明**：
- `error`: 仅显示错误
- `warn`: 显示警告和错误
- `info`: 显示信息、警告和错误（默认）
- `debug`: 显示所有日志（包括调试信息）

## 核心概念

### 角色 (Role)

角色是员工的模板，定义了系统提示词和行为模式。

**角色文件格式**:

角色使用带 YAML frontmatter 的 Markdown 文件定义：

```markdown
---
name: "RoleName"
description: "角色简介"
requiredArgs:
  参数名:
    type: string
    description: "参数说明"
canHire:
  - 角色名
  - 模式-*
  - group:组名
groups:
  - 组名
---

系统提示词内容（Markdown 格式）
```

**文件位置优先级**（高优先级覆盖低优先级）：
1. **项目**: `<project>/.cclover/roles/<role_name>.md` (最高优先级)
2. **全局**: `~/.config/opencode-cclover/roles/<role_name>.md`
3. **预设**: `src/roles/<role_name>.md` (最低优先级)

**示例角色**：

```markdown
---
name: "Calculator"
description: "专门负责数学计算"
requiredArgs: {}
canHire: []
groups: []
---

你是一个计算器员工，专门负责数学计算。

## 你的职责

1. 接收计算请求
2. 执行计算并返回结果
3. 维护计算历史记录

## 可用工具

- **send_message**: 发送消息给其他员工
- **edit_tasks**: 管理任务
- **create_employee_work_session**: 创建 Agent 执行复杂计算
```

**元数据字段说明**：
- `name` (必需): 角色名称，必须与文件名匹配
- `description` (可选): 角色简介
- `requiredArgs` (可选): 雇佣时需要提供的参数
- `canHire` (可选): 该角色可以雇佣的其他角色（支持精确名称、通配符、组引用）
- `groups` (可选): 该角色所属的组

**内置角色**：
- **Calculator**: 计算器，只做数学计算
- **General Developer**: 通用开发者，独立完成开发任务
- **Soul Developer**: 灵魂开发者，深度思考和架构设计
- **Project Manager**: 项目经理，分配任务、协调工作

### 员工 (Employee)

员工是角色的实例，有独立的记忆和任务状态。每个员工：
- 有独立的消息历史
- 维护自己的任务列表（DAG 结构）
- 积累经验知识
- 可以创建 Agent 执行工作

### 消息系统

- **去中心化存储**: 每个员工本地存储自己的消息
- **中心化服务**: 统一的消息服务负责同步
- **事件驱动**: 通过 EventEmitter 通知新消息

### 记忆系统

每个员工维护三类记忆：
- **knowledge**: 经验知识（AI 自主维护）
- **tasks**: 任务列表（DAG 结构）
- **custom**: 自定义数据（角色特定）

### 任务依赖 (DAG)

任务使用有向无环图表示依赖关系：
- 自动计算可执行的任务
- 支持并行执行
- 循环依赖检测

## 工具系统

### 可用工具

- **send_message**: 发送消息给其他员工
- **edit_tasks**: 批量编辑任务（添加、更新、删除）
- **create_employee_work_session**: 创建 OpenCode agent 执行任务
- **hire_employee**: 雇佣新员工（第一版暂不实现）

## 技术栈

- **语言**: TypeScript
- **运行环境**: OpenCode 插件
- **SDK**: @opencode-ai/plugin, @opencode-ai/sdk
- **存储**: 文件系统（YAML）
- **依赖**:
  - `eventemitter3`: 事件管理
  - `proper-lockfile`: 文件锁
  - `yaml`: YAML 解析

## 测试

项目包含完整的测试套件：

- **单元测试**: 测试单个模块功能
- **集成测试**: 测试模块间交互
- **端到端测试**: 测试完整场景（待实现）

当前测试覆盖：
- 79 个测试
- 100% 通过率
- 188 个断言

## 文档

详细设计文档位于 `docs/` 和 `console/docs/` 目录:
**插件核心** (`docs/`):
- [需求文档](./docs/requirements.md) - 完整的需求说明
- [架构设计](./docs/architecture.md) - 系统架构
- [设计文档](./docs/design.md) - 详细设计
- [文件结构](./docs/structure.md) - 项目结构说明
**Console 管理控制台** (`console/docs/`):
- [需求文档](./console/docs/requirements.md) - Console 功能需求
- [架构设计](./console/docs/architecture.md) - Console 架构
- [设计文档](./console/docs/design.md) - Console 详细设计
- [开发规范](./console/DEVELOPMENT.md) - 前端开发规范

## 贡献

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

## 许可证

MIT

## 作者

fkxxyz
