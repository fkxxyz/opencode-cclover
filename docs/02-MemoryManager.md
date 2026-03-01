# 记忆管理设计文档 (MemoryManager)

## 1. 概述

记忆管理模块负责维护员工的经验知识、任务状态和自定义数据，支持持久化和动态更新。

### 1.1 设计原则

- **结构化存储**：使用 YAML 格式存储记忆
- **分层管理**：knowledge（经验）、tasks（任务）、custom（自定义）分开管理
- **实时更新**：任务状态实时更新，不等待总结
- **定期总结**：knowledge 和 custom 定期总结压缩

### 1.2 核心功能

- 记忆文件的读写
- 任务状态管理（CRUD）
- 经验知识总结
- Mermaid 任务图生成

---

## 2. 文件结构

### 2.1 记忆文件位置

```
{ctx.directory}/.cclover/workspace/employees/
└── calculator/
    └── memory.yaml
```

### 2.2 记忆文件格式

```yaml
# calculator/memory.yaml

# 经验知识（自由文本，AI 自主维护）
knowledge:
  - bayecao 经常问我数学计算问题
  - 我擅长处理四则运算和简单代数
  - 复杂的微积分问题我处理不了

# 任务状态（DAG 结构）
tasks:
  - name: "计算1+1"
    status: completed
    description: 为 bayecao 计算 1+1
    result: "2"
    dependencies: []
    created: 2026-03-01T10:00:00Z
    completed: 2026-03-01T10:00:05Z
    
  - name: "计算3+4"
    status: completed
    description: 为 bayecao 计算 3+4
    result: "7"
    dependencies: []
    created: 2026-03-01T10:01:00Z
    completed: 2026-03-01T10:01:03Z
    
  - name: "求和前两个结果"
    status: in_progress
    description: 将"计算1+1"和"计算3+4"的结果相加
    dependencies: ["计算1+1", "计算3+4"]
    created: 2026-03-01T10:02:00Z

# 角色自定义字段（不同角色可能有不同需求）
custom:
  # 例如 PM 角色可能需要：
  # team_members: [alice, bob, calculator]
  # current_sprint: sprint_5
```

---

## 3. 数据结构

### 3.1 TypeScript 类型定义

```typescript
interface Memory {
  knowledge: string[]
  tasks: Task[]
  custom: Record<string, any>
}

interface Task {
  name: string                    // 任务名称（唯一标识，AI 自己命名）
  status: TaskStatus              // 任务状态
  description: string             // 任务描述
  result?: string                 // 任务结果（完成时填写）
  dependencies: string[]          // 依赖的任务名称列表
  created: string                 // 创建时间（ISO 8601）
  completed?: string              // 完成时间（ISO 8601，可选）
}

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
```

### 3.2 字段说明

**knowledge（经验知识）：**
- 类型：字符串数组
- 内容：工作经验、知识积累、与其他员工的关系
- 维护方式：AI 自主判断并更新（通过总结机制）

**tasks（任务列表）：**
- 类型：任务对象数组
- 维护方式：通过 `edit_tasks` 工具实时管理
- 支持 DAG 依赖关系

**custom（自定义字段）：**
- 类型：对象
- 内容：角色特定的数据
- 维护方式：AI 自主判断并更新（通过总结机制）

---

## 4. 架构设计

### 4.1 类图

```typescript
class MemoryManager {
  constructor(private workspaceRoot: string)
  
  // 读写记忆
  read(employeeName: string): Promise<Memory>
  write(employeeName: string, memory: Memory): Promise<void>
  
  // 任务管理
  addTask(employeeName: string, task: Omit<Task, 'created'>): Promise<void>
  updateTask(employeeName: string, taskName: string, updates: Partial<Task>): Promise<void>
  deleteTask(employeeName: string, taskName: string): Promise<void>
  getTask(employeeName: string, taskName: string): Promise<Task | null>
  
  // 任务查询
  getExecutableTasks(employeeName: string): Promise<Task[]>
  generateMermaid(employeeName: string): Promise<string>
  
  // 总结机制
  summarize(employeeName: string, summary: { knowledge: string[], custom: Record<string, any> }): Promise<void>
}
```

---

## 5. 实现清单

- [ ] MemoryManager 类
  - [ ] 构造函数和初始化
  - [ ] read() 方法
  - [ ] write() 方法
- [ ] 任务管理
  - [ ] addTask() 方法
  - [ ] updateTask() 方法
  - [ ] deleteTask() 方法
  - [ ] getTask() 方法
- [ ] 任务查询
  - [ ] getExecutableTasks() 方法
- [ ] Mermaid 生成
  - [ ] generateMermaid() 方法
- [ ] 上下文构建
  - [ ] buildSystemPrompt() 方法
- [ ] 总结机制
  - [ ] summarize() 方法
