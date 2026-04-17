# opencode-cclover - 开发指南

## What This Project Does

这是一个用于多 Agent 协作的 OpenCode 插件。它在项目工作区内运行 AI 员工，为它们提供消息与任务管理工具，持久化员工状态，并支持后台委派与 Web 管理控制台。

## 架构

**技术栈**
- 运行时：Bun
- 语言：TypeScript（strict mode）
- SDK：`@opencode-ai/plugin`、`@opencode-ai/sdk`
- 存储：本地文件系统上的 YAML 文件
- 协调：`eventemitter3`、`proper-lockfile`

**核心模块**
- `src/index.ts` - 插件入口
- `src/server/` - HTTP/WebSocket 服务与项目注册表
- `src/core/` - `MessageService`、`MemoryManager`、`EventLoop`、`BossManager`、`RoleManager`
- `src/state/StateManager.ts` - 员工状态持久化
- `src/tools/` - 暴露给 Agent 的 OpenCode 工具
- `src/utils/` - 上下文构建、注册表、Mermaid 生成
- `console/` - 基于 React 的管理控制台

**关键流程**
1. 插件初始化 `GlobalCcloverService`
2. 配置从 `~/.config/opencode-cclover/config.yaml` 加载启用项目
3. 每个项目在 `.cclover/workspace/` 下获得运行时服务数据
4. 打开项目后暴露工具并启动员工事件循环

## 项目结构

```text
src/         插件核心代码
tests/       单元测试与集成测试
console/     管理控制台前端与文档
docs/        需求、设计与开发规范
workspace_test/ 手动测试用插件工作区
```

当仅看目录名不足以定位内容时，使用 `docs/structure.md` 查看完整文件结构。

## 配置

主配置文件：`~/.config/opencode-cclover/config.yaml`

关键字段：
- `bosses` - boss 身份列表
- `projects[]` - 受管项目
- `port` - 服务端口，可被 `CCLOVER_PORT` 覆盖
- `logLevel` - 日志级别，可被 `CCLOVER_LOG_LEVEL` 覆盖
- `modelTypes` - 角色模型映射，支持同层重定向

模型解析顺序：
1. 全局配置
2. `src/config/preset.yaml`
3. OpenCode 默认模型

## 角色系统

角色文件使用带 YAML frontmatter 的 Markdown。

优先级顺序：
1. `<project>/.cclover/roles/<role>.md`
2. `~/.config/opencode-cclover/roles/<role>.md`
3. `src/roles/<role>.md`

角色行为以这些角色文件为准。位于这些路径之外的相关提示词文件默认只作补充，除非项目文档另有明确说明。

支持的 frontmatter 字段：
- `name`
- `description`
- `model_type`
- `requiredArgs`
- `canHire`
- `groups`

## 开发规则

### 每次提交前

必须运行以下三项：

```bash
bun run type-check
bunx prettier --write "src/**/*.ts" "tests/**/*.ts"
bun test
```

说明：
- `bun run type-check` 同时检查 `src/` 和 `tests/`
- `bun run build` 用于发布或构建验证，不是必需的提交前类型检查
- 提交信息必须使用英文 Conventional Commits

## 代码约定

基于当前代码库提炼出的项目特定约定：
- 使用双引号，不写分号
- import 顺序：Node 内置、外部依赖、内部模块
- 纯类型导入使用 `import type`
- 实现注释使用中文；公共 API 使用 JSDoc
- 导出函数优先使用 `export function`，不要用 `export const`
- 处理文件缺失时使用 `catch (error: any)` 并检查 `error.code === "ENOENT"`
- 核心代码优先使用 `async`/`await`，不要引入 `.then()` 链
- 模块对外导出尽量集中在相邻的 `index.ts`
- 测试文件使用 `.test.ts`

## 常见陷阱

- **文件写入**：YAML 与运行时持久化写入必须使用 `proper-lockfile`，避免数据损坏
- **任务依赖**：任务 DAG 变更应交给 `MemoryManager` 校验，不要绕过它
- **会话映射**：需要员工身份的工具必须通过 `SessionRegistry` 映射 `sessionID`

## 测试

- 单元测试：`bun test tests/unit/...`
- 集成测试：`bun test tests/integration/...`
- 手动插件测试：`./start-test-server.sh`
- 备用手动启动：`OPENCODE_CONFIG_DIR="$(pwd)/workspace_test/.opencode" opencode serve --port 4099`

核心模块覆盖率目标：
- `MessageService`：100%
- `MemoryManager`：100%
- tools：80%+

## 文档

本节索引项目文档。按任务类型进入对应分支。

### 入门

[README.md - 项目概览与快速开始](README.md) - 如果你刚接触这个项目，先读这里。它说明 opencode-cclover 是什么、当前实现状态，以及如何安装。在深入需求或设计文档之前，先用它建立项目整体认识。

[USAGE.md - 使用指南与配置](USAGE.md) - 当你需要配置、部署或使用这个插件时阅读。包含安装方式、配置文件格式与基础使用模式，是搭建开发或生产环境的主要入口。

[deployment.md - 部署流程](deployment.md) - 当你要部署到生产环境，或配置多项目场景时阅读。包含更进阶的部署方式、排障信息与生产实践。

### 需求分支

[docs/requirements.md - 系统需求总览](docs/requirements.md) - 用于理解系统“要做什么”以及“为什么存在”。这是需求入口文档，解释整体问题空间，并链接到更细的子系统需求。在阅读设计文档前先读这里，先建立基础约束。

详细子系统需求（在处理具体子系统时阅读）：
- [docs/requirements-messaging.md](docs/requirements-messaging.md) - 消息系统需求
- [docs/requirements-memory.md](docs/requirements-memory.md) - 记忆管理需求
- [docs/requirements-tasks.md](docs/requirements-tasks.md) - 任务管理需求
- [docs/requirements-tools.md](docs/requirements-tools.md) - 工具系统需求
- [docs/requirements-runtime.md](docs/requirements-runtime.md) - 员工运行时需求
- [docs/requirements-boss.md](docs/requirements-boss.md) - Boss 系统需求
- [docs/requirements-project-management.md](docs/requirements-project-management.md) - 项目管理需求

### 设计分支

[docs/architecture.md - 系统架构与模块结构](docs/architecture.md) - 用于理解系统“如何组织”以及“为什么采用这种架构”。它解释核心组件、数据流与架构决策。修改任何核心模块前都应先读，以理解系统级设计约束与组件关系。

[docs/design.md - 设计总览与组件设计入口](docs/design.md) - 用于理解整体设计方式，并导航到具体组件设计文档。这是设计分支的入口。

详细组件设计（在实现或修改具体组件时阅读）：
- [docs/design-message-service.md](docs/design-message-service.md) - MessageService 设计
- [docs/design-memory-manager.md](docs/design-memory-manager.md) - MemoryManager 设计
- [docs/design-event-loop.md](docs/design-event-loop.md) - EventLoop 设计
- [docs/design-tools.md](docs/design-tools.md) - 工具系统设计
- [docs/design-roles.md](docs/design-roles.md) - 角色定义设计
- [docs/design-plugin-entry.md](docs/design-plugin-entry.md) - 插件入口设计
- [docs/design-meeting-mode.md](docs/design-meeting-mode.md) - Meeting Mode 设计

[docs/migration-guide.md - 角色格式迁移指南](docs/migration-guide.md) - 当你需要把旧格式角色定义升级到 YAML frontmatter 新格式时阅读。包含迁移步骤与兼容性信息。

### 开发规范分支

[docs/specs/repository-structure-best-practices.md - 仓库组织原则](docs/specs/repository-structure-best-practices.md) - 当你需要组织文档、决定文件放置位置或维护文档索引时阅读。它解释为什么文档索引维护很重要，以及如何为 AI 导航组织仓库。

**角色开发：**
- [docs/specs/role-development-manual.md](docs/specs/role-development-manual.md) - 创建新角色时阅读
- [docs/specs/role-document-specification.md](docs/specs/role-document-specification.md) - 角色文件格式规范
- [docs/specs/role-context-best-practices.md](docs/specs/role-context-best-practices.md) - 角色上下文设计模式
- [docs/specs/role-review-handbook.md](docs/specs/role-review-handbook.md) - 角色评审流程
- [docs/specs/role-review-report-format.md](docs/specs/role-review-report-format.md) - 角色评审报告格式

**通信模式：**
- [docs/specs/communication-patterns/ai-to-ai-communication-principles.md](docs/specs/communication-patterns/ai-to-ai-communication-principles.md) - AI 间高效通信的核心原则
- [docs/specs/communication-patterns/responding-to-messages.md](docs/specs/communication-patterns/responding-to-messages.md) - 如何回复消息
- [docs/specs/communication-patterns/delegating-work.md](docs/specs/communication-patterns/delegating-work.md) - 工作委派模式
- [docs/specs/communication-patterns/escalating-issues.md](docs/specs/communication-patterns/escalating-issues.md) - 问题升级模式
- [docs/specs/communication-patterns/reporting-completion.md](docs/specs/communication-patterns/reporting-completion.md) - 完成汇报模式
- [docs/specs/communication-patterns/requesting-information.md](docs/specs/communication-patterns/requesting-information.md) - 信息请求模式
- [docs/specs/communication-patterns/consulting-and-discussion.md](docs/specs/communication-patterns/consulting-and-discussion.md) - 咨询与讨论模式

**代码开发：**
- [docs/specs/code-development-standards.md](docs/specs/code-development-standards.md) - 代码质量与开发规范
- [docs/specs/code-review-handbook.md](docs/specs/code-review-handbook.md) - 代码评审流程
- [docs/specs/git-repository-workflow.md](docs/specs/git-repository-workflow.md) - Git 工作流与分支策略

**任务与项目管理：**
- [docs/specs/task-management-best-practices.md](docs/specs/task-management-best-practices.md) - 任务管理模式
- [docs/specs/task-document-format.md](docs/specs/task-document-format.md) - 任务文档格式
- [docs/specs/manager-execution-pattern.md](docs/specs/manager-execution-pattern.md) - Manager 角色执行模式
- [docs/specs/subordinate-management-philosophy.md](docs/specs/subordinate-management-philosophy.md) - 下属管理原则
- [docs/specs/leadership-risk-handling.md](docs/specs/leadership-risk-handling.md) - 领导风险处理
- [docs/specs/risk-analysis-practice.md](docs/specs/risk-analysis-practice.md) - 风险分析实践
- [docs/specs/system-entropy-analysis.md](docs/specs/system-entropy-analysis.md) - 系统熵分析

**规范写作：**
- [docs/specs/ai-specification-writing-guide.md](docs/specs/ai-specification-writing-guide.md) - 如何编写规范
- [docs/specs/ai-specification-review-guide.md](docs/specs/ai-specification-review-guide.md) - 如何评审规范
- [docs/specs/prompt-specification.md](docs/specs/prompt-specification.md) - Prompt 设计规范
- [docs/specs/context-description-writing-guide.md](docs/specs/context-description-writing-guide.md) - 上下文描述写作指南

### Console 文档

[console/docs/requirements.md - Console 需求](console/docs/requirements.md) - 用于理解控制台功能需求。Console 是独立模块，拥有自己的文档分支。

[console/docs/architecture.md - Console 架构](console/docs/architecture.md) - 修改 Console 代码前先读，用于理解前端架构。

更多 Console 设计文档：
- [console/docs/design.md](console/docs/design.md) - Console 设计总览
- [console/docs/design-components.md](console/docs/design-components.md) - 组件设计
- [console/docs/design-services.md](console/docs/design-services.md) - 服务层设计
- [console/docs/design-state-hooks.md](console/docs/design-state-hooks.md) - 状态管理设计
- [console/docs/design-patterns.md](console/docs/design-patterns.md) - 设计模式
- [console/docs/design-testing.md](console/docs/design-testing.md) - 测试策略
- [console/docs/design-event-timeline.md](console/docs/design-event-timeline.md) - 事件时间线功能
- [console/docs/session-link-feature.md](console/docs/session-link-feature.md) - Session Link 功能
- [console/docs/structure.md](console/docs/structure.md) - Console 文件结构

### 参考文档

[docs/structure.md - 项目文件结构参考](docs/structure.md) - 完整文件结构清单。当你需要定位具体文件或理解整体项目组织时阅读。

### 文档维护

**代码注释：**
- 实现细节使用中文
- 公共 API 文档使用 JSDoc
- 解释 WHY，而不是 WHAT（代码已经展示 WHAT）

**保持文档最新：**
- 架构变更时同步更新设计文档
- 保持 README.md 与实现状态同步
- 新增文档时同步更新这里的文档索引

