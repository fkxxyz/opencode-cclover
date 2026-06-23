# 使用说明

本文档提供 opencode-cclover 插件的详细使用说明。

## 快速开始

### 前置要求

- Bun >= 1.0.0
- OpenCode 已安装并可运行
- 基本的 TypeScript/JavaScript 知识

### 安装步骤

#### 1. 克隆或下载项目

```bash
git clone <repository-url>
cd opencode-cclover
```

#### 2. 安装依赖

```bash
bun install
```

#### 3. 构建项目

```bash
bun run build
```

## 使用方式

### 方法 1: 自动发现（推荐用于开发）

OpenCode 会自动扫描项目中的 `.opencode/plugin/` 目录。

```bash
# 在你的项目根目录
mkdir -p .opencode/plugin

# 创建符号链接（使用绝对路径）
ln -s /absolute/path/to/opencode-cclover/src/index.ts .opencode/plugin/cclover.ts
```

**优点**:
- 无需配置文件
- 自动发现
- 适合开发调试

**注意**: 使用绝对路径，不要使用 `$(pwd)` 或相对路径。

### 方法 2: 配置文件引用（推荐用于生产）

在项目根目录创建或编辑 `opencode.json`:

```json
{
  "plugin": [
    "file:///absolute/path/to/opencode-cclover/src/index.ts"
  ]
}
```

或使用构建后的文件：

```json
{
  "plugin": [
    "file:///absolute/path/to/opencode-cclover/dist/index.js"
  ]
}
```

**优点**:
- 明确的配置
- 支持多个插件
- 适合生产环境

### 方法 3: npm 包（未来支持）

发布到 npm 后，可以直接引用：

```json
{
  "plugin": ["opencode-cclover"]
}
```

## 验证插件是否工作

### 1. 启动 OpenCode

```bash
# 在你的项目目录
opencode
```

### 2. 检查控制台输出

应该看到类似以下日志：

```
[Cclover] Initializing plugin...
[Cclover] Plugin initialized
```

### 3. 检查工作空间

插件会在项目根目录创建 `.cclover/` 目录：

```bash
ls -la .cclover/
# 应该看到:
# .cclover/
# └── workspace/
#     └── employees/
```

### 4. 验证 .gitignore

插件会自动将 `.cclover/` 添加到 `.gitignore`：

```bash
cat .gitignore | grep cclover
# 应该看到:
# # Cclover workspace
# .cclover/
```

## 开发模式

### 监视模式

在插件目录运行：

```bash
bun run dev
```

这会启动 TypeScript 监视模式，自动重新编译修改的文件。

### 调试

#### 查看日志

插件使用 `console.log` 输出日志，所有日志都带有 `[Cclover]` 前缀：

```typescript
console.log("[Cclover] Your message here")
```

#### 检查文件

查看消息文件：

```bash
# 查看员工的消息
cat .cclover/workspace/employees/calculator/messages/alice/chat.yaml
```

查看记忆文件：

```bash
# 查看员工的记忆
cat .cclover/workspace/employees/calculator/memory.yaml
```

## 测试

### 运行所有测试

```bash
bun test
```

### 运行特定测试

```bash
# 单元测试
bun test tests/unit

# 集成测试
bun test tests/integration

# 特定文件
bun test tests/unit/MessageService.test.ts
```

### 查看测试覆盖率

```bash
bun test --coverage
```

## 工作空间结构

插件运行时会创建以下目录结构：

```
.cclover/
└── workspace/
    └── employees/
        ├── calculator/              # 员工目录
        │   ├── memory.yaml          # 记忆文件
        │   └── messages/            # 消息目录
        │       ├── alice/
        │       │   └── chat.yaml    # 与 alice 的聊天记录
        │       └── bob/
        │           └── chat.yaml    # 与 bob 的聊天记录
        └── alice/
            ├── memory.yaml
            └── messages/
                └── calculator/
                    └── chat.yaml    # 与 calculator 的聊天记录
```

### 文件格式

#### memory.yaml

```yaml
# 经验知识
knowledge:
  - alice 经常问我数学计算问题
  - 我擅长处理四则运算和简单代数

# 任务列表
tasks:
  - name: "计算1+1"
    status: completed
    description: 为 alice 计算 1+1
    result: "2"
    dependencies: []
    created: 2026-03-01T10:00:00Z
    completed: 2026-03-01T10:00:05Z

# 自定义字段
custom:
  total_calculations: 42
```

#### chat.yaml

```yaml
- timestamp: 2026-03-01T10:00:00Z
  direction: receive
  content: 计算 1+1

- timestamp: 2026-03-01T10:00:05Z
  direction: send
  content: 结果是 2
```

## 使用工具

### send_message

发送消息给其他员工：

```typescript
// AI 会调用此工具
{
  "to": "alice",
  "content": "结果是 2"
}
```

### edit_tasks

批量编辑任务：

```typescript
{
  "operations":  {
      "action": "add",
      "name": "计算5*6",
      "description": "为 alice 计算 5*6",
      "dependencies": []
    },
    {
      "action": "update",
      "name": "计算1+1",
      "status": "completed",
      "result": "2"
    },
    {
      "action": "delete",
      "name": "已取消的任务"
    }
  ]
}
```

### create_employee_work_session

创建 EmployeeWorkSession 执行任务。EmployeeWorkSession 是员工的运行时工作会话，会绑定一个 OpenCode Session；Employee 本身只保存角色和层级等元数据。

```typescript
{
  "task_name": "计算复杂表达式",
  "prompt": "请计算 (123+456)*789"
}
```

## 常见问题

### Q: 插件没有加载？

**A**: 检查以下几点：
1. 确认 OpenCode 版本兼容
2. 检查插件路径是否正确（使用绝对路径）
3. 查看 OpenCode 控制台是否有错误信息
4. 确认 `package.json` 中的依赖已安装

### Q: 找不到 .cclover 目录？

**A**: 
1. 确认插件已成功加载
2. 检查是否有文件权限问题
3. 查看控制台是否有错误日志

### Q: 测试失败？

**A**:
1. 确认依赖已安装：`bun install`
2. 清理测试工作空间：`rm -rf /tmp/cclover-test-workspace`
3. 重新运行测试：`bun test`

### Q: 如何清理工作空间？

**A**:
```bash
# 删除工作空间（会丢失所有数据）
rm -rf .cclover/

# 重启 OpenCode 会重新创建
```

### Q: 如何修改员工行为？

**A**: 
1. 编辑角色定义文件（如 `src/roles/Calculator.ts`）
2. 修改 `systemPrompt` 字段
3. 重新构建：`bun run build`
4. 重启 OpenCode

## 高级用法

### 自定义角色

创建新角色文件 `src/roles/MyRole.ts`:

```typescript
import { Role } from '../types'

export const MyRole: Role = {
  name: 'my-role',
  systemPrompt: `
你是一个自定义角色。
你的职责是...
  `.trim()
}
```

### 添加自定义工具

创建新工具文件 `src/tools/MyTool.ts`:

```typescript
import { tool } from "@opencode-ai/plugin"

export const myTool = tool({
  description: "工具描述",
  args: {
    param: tool.schema.string().describe("参数描述"),
  },
  async execute(args, context) {
    // 实现逻辑
    return "结果"
  },
})
```

在 `src/tools/index.ts` 中导出：

```typescript
export { myTool } from "./MyTool"
```

## 性能优化

### 文件锁超时

如果遇到文件锁超时，可以调整 `MessageService.ts` 和 `MemoryManager.ts` 中的锁配置：

```typescript
release = await lockfile.lock(filePath, {
  retries: {
    retries: 10,        // 增加重试次数
    minTimeout: 100,
    maxTimeout: 2000,   // 增加最大超时
  },
  stale: 10000,         // 增加锁过期时间
})
```

### 记忆总结阈值

调整 `EventLoop.ts` 中的总结阈值：

```typescript
if (currentSession.tokens.total > 20000) {  // 增加阈值
  // 触发总结
}
```

## 故障排除

### 启用详细日志

在代码中添加更多日志：

```typescript
console.log("[Cclover] Debug info:", data)
```

### 检查文件权限

```bash
# 检查工作空间权限
ls -la .cclover/

# 修复权限
chmod -R 755 .cclover/
```

### 清理并重建

```bash
# 清理构建产物
rm -rf dist/

# 清理依赖
rm -rf node_modules/

# 重新安装和构建
bun install
bun run build
```

## 更多资源

- [需求文档](./REQUIREMENTS.md) - 完整的需求说明
- [设计文档](./docs/) - 详细的设计文档
- [实现计划](./docs/07-ImplementationPlan.md) - 分阶段实现计划

## 获取帮助

如果遇到问题：

1. 查看本文档的常见问题部分
2. 检查 GitHub Issues
3. 查看设计文档了解系统原理
4. 提交新的 Issue 描述问题

## 贡献

欢迎贡献代码、文档或报告问题！请参考 [README.md](./README.md) 中的贡献指南。
