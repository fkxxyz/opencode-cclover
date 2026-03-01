# opencode-cclover

多 Agent 自主协作系统 - 基于 OpenCode 插件实现的员工协作框架。

## 概述

opencode-cclover 是一个 OpenCode 插件，实现了多 Agent 自主协作系统。系统模拟员工之间的协作行为，员工可以收发消息、管理任务、创建 Agent 执行工作，实现自主决策和并行工作。

### 核心特性

- **事件驱动**: 通过消息、任务完成等事件触发员工行动
- **自主决策**: AI 根据上下文自主决定下一步行动
- **任务管理**: 支持 DAG 任务依赖，自动计算可并行执行的任务
- **记忆系统**: 员工维护自己的经验知识和工作状态
- **并行执行**: 支持多个 Agent 并行工作

## 项目状态

### 当前进度

**阶段 1: 基础设施层** ✅ 已完成
- ✅ MessageService - 消息收发和同步
- ✅ MemoryManager - 记忆管理和任务 DAG
- ✅ 工具系统框架 - 工具注册和权限管理
- ✅ 工具辅助模块 - Mermaid 生成、上下文构建、注册表
- ✅ 单元测试和集成测试 (79 个测试，100% 通过)

**阶段 2: 核心逻辑层** ✅ 已完成
- ✅ 具体工具实现 (send_message, edit_tasks, create_agent)
- ✅ EventLoop - 事件循环和 Session 管理
- ✅ Calculator 角色定义

**阶段 3: 集成测试** ✅ 已完成
- ✅ 插件入口集成
- ✅ 端到端测试（可在 workspace_test 目录进行真实测试）

**阶段 4: Console 管理控制台** ⏳ 计划中
- ⏳ Web 管理控制台（实时监控员工状态、消息、任务）
- ⏳ HTTP API 服务器
- ⏳ WebSocket 实时推送
- 详见 [Console 实现计划](console/docs/Implementation-Plan.md)

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
│   │   ├── CreateAgentTool.ts     # create_agent 工具
│   │   ├── HireEmployeeTool.ts    # hire_employee 工具
│   │   └── index.ts
│   ├── utils/                     # 工具辅助模块
│   │   ├── MermaidGenerator.ts    # Mermaid 图生成
│   │   ├── ContextBuilder.ts      # 上下文构建
│   │   ├── SessionRegistry.ts     # Session 注册表
│   │   ├── AgentRegistry.ts       # Agent 注册表
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
│   ├── src/                      # 前端源码
│   ├── docs/                     # Console 相关文档
│   │   ├── Implementation-Plan.md  # 实现计划
│   │   ├── API-Spec.md           # API 接口规范（待创建）
│   │   ├── WebSocket-Spec.md     # WebSocket 协议（待创建）
│   │   └── Data-Models.md        # 数据模型（待创建）
│   ├── REQUIREMENTS.md           # Console 需求文档
│   └── DEVELOPMENT.md            # 开发规范（待创建）
├── package.json
├── tsconfig.json
├── README.md                      # 本文件
├── USAGE.md                       # 使用说明
└── REQUIREMENTS.md                # 主需求文档
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

## 核心概念

### 角色 (Role)

角色是员工的模板，定义了系统提示词和行为模式。

示例角色：
- **Calculator**: 计算器，只做数学计算
- **Coder**: 程序员，写代码、修 bug
- **PM**: 项目经理，分配任务、协调工作

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
- **create_agent**: 创建 OpenCode agent 执行任务
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

详细设计文档位于 `docs/` 目录：

**插件核心**:
- [需求文档](./REQUIREMENTS.md) - 完整的需求说明
- [总览](./docs/00-Overview.md) - 系统架构总览
- [实现计划](./docs/07-ImplementationPlan.md) - 分阶段实现计划
**Console 管理控制台**:
- [Console 需求文档](./console/REQUIREMENTS.md) - Console 功能需求
- [Console 实现计划](./console/docs/Implementation-Plan.md) - 并行开发方案

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
