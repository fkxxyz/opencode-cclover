# 多 Agent 协作系统 - 设计文档总览

## 1. 文档导航

本系统的设计文档分为以下几个模块：

1. **[消息服务 (MessageService)](./01-MessageService.md)**
   - 员工之间的消息收发和同步
   - 未读消息队列管理
   - YAML 文件持久化

2. **[记忆管理 (MemoryManager)](./02-MemoryManager.md)**
   - 经验知识、任务状态、自定义数据管理
   - DAG 任务依赖分析
   - Mermaid 任务图生成
   - 上下文构建

3. **[事件循环 (EventLoop)](./03-EventLoop.md)**
   - 事件等待和分发
   - Session 生命周期管理
   - AI 调用和工具执行
   - 记忆总结触发

4. **[工具系统 (Tools)](./04-Tools.md)**
   - send_message - 发送消息
   - edit_tasks - 管理任务
   - create_agent - 创建 Agent
   - hire_employee - 雇佣员工

5. **[角色定义 (Roles)](./05-Roles.md)**
   - Calculator 角色（第一版）
   - 未来角色扩展

6. **[插件入口 (PluginEntry)](./06-PluginEntry.md)**
   - 插件初始化流程
   - 员工启动机制
   - 部署和测试

---

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                    OpenCode Plugin                      │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │              Plugin Entry (index.ts)              │ │
│  └───────────────────────────────────────────────────┘ │
│                          │                              │
│         ┌────────────────┼────────────────┐            │
│         ▼                ▼                ▼            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Message    │  │   Memory    │  │    Tools    │   │
│  │  Service    │  │   Manager   │  │   System    │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
│         │                │                │            │
│         └────────────────┼────────────────┘            │
│                          ▼                              │
│                  ┌───────────────┐                     │
│                  │  Event Loop   │                     │
│                  │  (Employee)   │                     │
│                  └───────────────┘                     │
│                          │                              │
│                          ▼                              │
│                  ┌───────────────┐                     │
│                  │ OpenCode SDK  │                     │
│                  │   (Session)   │                     │
│                  └───────────────┘                     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
                  ┌───────────────┐
                  │  File System  │
                  │  (.cclover/)  │
                  └───────────────┘
```

### 2.2 数据流

```
用户 (八叶草)
    │
    │ 调用 send_message 工具
    ▼
MessageService
    │
    │ 写入 YAML 文件
    │ 触发 EventEmitter
    ▼
Calculator EventLoop
    │
    │ recv() 返回消息
    │ 构建上下文
    ▼
OpenCode Session
    │
    │ AI 处理
    │ 调用工具
    ▼
Tools (send_message / edit_tasks / create_agent)
    │
    │ 执行操作
    ▼
MessageService / MemoryManager
    │
    │ 更新状态
    ▼
用户收到回复
```

---

## 3. 核心概念

### 3.1 角色 (Role)
- 员工的模板
- 定义系统提示词和行为模式
- 例如：Calculator、Coder、PM

### 3.2 员工 (Employee)
- 角色的实例
- 有独立的记忆和任务状态
- 通过事件循环运行

### 3.3 事件 (Event)
- 触发员工行动的事件
- 类型：MessageEvent、AgentEvent
- 通过 EventLoop 处理

### 3.4 记忆 (Memory)
- knowledge：经验知识
- tasks：任务状态（DAG）
- custom：自定义数据

### 3.5 工具 (Tool)
- AI 可以调用的函数
- 全局注册，权限控制
- 例如：send_message、edit_tasks

---

## 4. 技术栈

- **语言**：TypeScript
- **运行环境**：OpenCode 插件
- **SDK**：@opencode-ai/plugin, @opencode-ai/sdk
- **存储**：文件系统（YAML）
- **并发**：async/await, Promise.all

---

## 5. 第一版实现范围

### 5.1 核心功能
- ✅ 消息收发（MessageService）
- ✅ 记忆管理（MemoryManager）
- ✅ 事件循环（EventLoop）
- ✅ 工具系统（Tools）
- ✅ Calculator 角色

### 5.2 测试场景
- ✅ 简单计算（1+1）
- ✅ 复杂计算（使用 Agent）
- ✅ 多轮对话

### 5.3 暂不实现
- ❌ 多角色协作
- ❌ 层级管理
- ❌ 权限系统
- ❌ hire_employee 工具

---

## 6. 开发流程

### 6.1 实现顺序

1. **基础设施**
   - MessageService
   - MemoryManager
   - 工具系统

2. **核心逻辑**
   - EventLoop
   - Calculator 角色

3. **集成测试**
   - 插件入口
   - 端到端测试

### 6.2 测试策略

- 单元测试：每个模块独立测试
- 集成测试：模块间交互测试
- 端到端测试：完整场景测试

---

## 7. 未来扩展

### 7.1 多角色支持
- Coder、PM、Researcher、Tester、Architect
- 角色间协作场景

### 7.2 层级管理
- 上下级关系
- 任务分配和汇报

### 7.3 持久化优化
- 使用数据库替代文件系统
- 提高查询效率

### 7.4 监控和可视化
- 实时查看员工状态
- 可视化任务依赖图
- 查看消息历史

---

## 8. 参考资料

- [需求文档](../REQUIREMENTS.md)
- [OpenCode SDK 文档](~/.config/opencode/node_modules/@opencode-ai/sdk/)
- [OpenCode 插件开发指南](技能文档)
