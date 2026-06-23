# Workspace Test - 真实环境测试

这个目录用于在真实的 OpenCode 环境中测试 cclover 插件。

## 快速开始

### 方法 1: 使用快速启动脚本（推荐）

在项目根目录运行：

```bash
./start-test-server.sh
```

### 方法 2: 使用 tmux

```bash
# 启动 OpenCode server（在 tmux session 中）
tmux new-session -d -s opencode-test "cd workspace_test && opencode serve --port 4099"

# 查看 server 日志
tmux attach -t opencode-test

# 退出 tmux: Ctrl+B, 然后按 D

# 停止 server
tmux kill-session -t opencode-test
```

### 方法 3: 手动启动

在一个终端中：

```bash
cd workspace_test
opencode serve --port 4099
```

保持这个终端运行，在另一个终端中进行测试。

## 测试插件

### 自动测试脚本

```bash
# 确保 server 正在运行
bun run workspace_test/test-plugin.ts
```

### 手动测试

参考 [TEST_GUIDE.md](./TEST_GUIDE.md) 进行详细的手动测试。

## 目录结构

```
workspace_test/
├── .opencode/
│   └── plugin/
│       └── cclover.ts -> ../../../src/index.ts  # 插件符号链接
├── .cclover/                                     # 运行时工作空间（自动创建）
│   └── workspace/
│       └── employees/
│           ├── calculator/
│           │   ├── messages/
│           │   └── memory.yaml
│           └── bayecao/
│               └── messages/
├── test-plugin.ts                                # 自动测试脚本
├── TEST_GUIDE.md                                 # 详细测试指南
└── README.md                                     # 本文件
```

## 验证插件加载

启动 server 后，应该在日志中看到：

```
[Cclover] Initializing opencode-cclover plugin...
[Cclover] Workspace root: .../workspace_test/.cclover/workspace
[Cclover] MessageService initialized
[Cclover] MemoryManager initialized
[Cclover] Tools created
[calculator] Starting event loop...
[Cclover] Started employee: calculator
[Cclover] Started 1 employee(s)
[Cclover] Plugin initialized successfully
```

## 可用工具

插件注册了以下工具，可以在 OpenCode session 中使用：

- `send_message`: 发送消息给员工
- `asks`: 管理任务
- `create_employee_work_session`: 创建 EmployeeWorkSession 执行任务

## 测试场景

详见 [TEST_GUIDE.md](./TEST_GUIDE.md)：

1. ✅ 简单计算（1+1）
2. ✅ 复杂计算（使用 EmployeeWorkSession）
3. ⏳ 多轮对话
4. ⏳ 记忆总结
5. ⏳ 并发消息

## 调试

### 查看日志

OpenCode server 的日志会显示所有插件活动和 calculator 的行为。

### 检查文件系统

```bash
# 查看工作空间
tree .cclover/workspace/

# 查看消息
cat .cclover/workspace/employees/calculator/messages/*/chat.yaml

# 查看记忆
cat .cclover/workspace/employees/calculator/memory.yaml
```

### 清理测试数据

```bash
# 删除工作空间（重新开始测试）
rm -rf .cclover/

# 重启 server 会自动重新创建
```

## 故障排除

### 插件未加载

检查符号链接：

```bash
ls -la .opencode/plugin/
# 应该看到: cclover.ts -> ../../../src/index.ts
```

### Calculator 未启动

检查 EventLoop 错误：

```bash
# 查看 server 日志中的错误信息
```

### 工具调用失败

检查工具注册：

```bash
# 在 OpenCode session 中运行
opencode session prompt "列出所有可用的工具"
# 应该看到 send_message, edit_tasks, create_employee_work_session
```

## 下一步

完成测试后，可以：

1. 更新 README.md 中的测试状态
2. 记录发现的问题
3. 继续实现阶段 3.2（端到端测试）
