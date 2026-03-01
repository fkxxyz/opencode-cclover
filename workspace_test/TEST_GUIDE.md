# 测试指南

## 启动 OpenCode Server

```bash
cd workspace_test
opencode serve --port 4099
```

## 验证插件加载

查看日志，应该看到：

```
[Cclover] Initializing opencode-cclover plugin...
[Cclover] Workspace root: .../workspace_test/.cclover/workspace
[Cclover] MessageService initialized
[Cclover] MemoryManager initialized
[Cclover] Tools created
[calculator] Starting event loop...
[Cclover] Started employee: calculator
[Cclover] Plugin initialized successfully
```

## 测试场景 1: 简单计算

### 使用 OpenCode SDK

```typescript
import { createOpencodeClient } from "@opencode-ai/sdk"

const client = createOpencodeClient({ baseUrl: "http://localhost:4099" })

// 创建 session
const session = await client.session.create({
  body: { title: "Test Calculator" }
})

// 发送消息给 calculator
await client.session.prompt({
  path: { id: session.data.id },
  body: {
    parts: [{
      type: "text",
      text: "使用 send_message 工具发送消息给 calculator: '计算 1+1'"
    }]
  }
})
```

### 验证结果

```bash
# 查看 calculator 收到的消息
cat .cclover/workspace/employees/calculator/messages/bayecao/chat.yaml

# 查看 calculator 的回复
cat .cclover/workspace/employees/bayecao/messages/calculator/chat.yaml

# 查看 calculator 的任务
cat .cclover/workspace/employees/calculator/memory.yaml
```

## 测试场景 2: 复杂计算（使用 Agent）

```typescript
await client.session.prompt({
  path: { id: session.data.id },
  body: {
    parts: [{
      type: "text",
      text: "使用 send_message 工具发送消息给 calculator: '计算 (123+456)*789'"
    }]
  }
})
```

观察日志，应该看到：
- calculator 创建 Agent
- Agent 执行计算
- calculator 收到 Agent 完成事件
- calculator 发送回复

## 测试场景 3: 多轮对话

连续发送多条消息，验证 calculator 能正确处理。

## 测试场景 4: 记忆总结

发送 20+ 条消息，触发记忆总结机制。

## 调试技巧

### 查看实时日志

```bash
# 使用 tmux
tmux attach -t opencode-test

# 或者直接在终端查看
```

### 检查文件系统

```bash
# 查看工作空间结构
tree .cclover/workspace/

# 查看所有消息
find .cclover/workspace -name "chat.yaml" -exec cat {} \;

# 查看记忆
cat .cclover/workspace/employees/calculator/memory.yaml
```

### 清理并重新测试

```bash
# 停止 server (Ctrl+C)
# 删除工作空间
rm -rf .cclover/
# 重新启动 server
opencode serve --port 4099
```

## 预期结果

### ✅ 成功标准

1. 插件成功加载
2. calculator 员工启动
3. 能接收消息
4. 能调用工具（edit_tasks, send_message, create_agent）
5. 简单计算直接完成
6. 复杂计算创建 Agent
7. 消息文件正确同步
8. 记忆文件正确更新

### ❌ 常见问题

1. **插件未加载**: 检查 `.opencode/plugin/cclover.ts` 符号链接
2. **calculator 未启动**: 查看 EventLoop 错误日志
3. **消息未接收**: 检查 MessageService
4. **工具调用失败**: 检查工具注册
