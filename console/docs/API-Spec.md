# API 接口规范

本文档定义了 Console 后端提供的所有 HTTP API 接口。

## 1. 基本信息

### 1.1 服务地址

- **Base URL**: `http://localhost:4097/api`
- **协议**: HTTP/1.1
- **内容类型**: `application/json`

### 1.2 通用响应格式

所有 API 响应都遵循统一格式:

**成功响应**:
```json
{
  "success": true,
  "data": { ... }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

### 1.3 错误码

| 错误码 | HTTP状态码 | 含义 |
|--------|-----------|------|
| `EMPLOYEE_NOT_FOUND` | 404 | 员工不存在 |
| `INVALID_PARAMETER` | 400 | 参数无效 |
| `INTERNAL_ERROR` | 500 | 内部错误 |
| `FILE_READ_ERROR` | 500 | 文件读取失败 |
| `FILE_WRITE_ERROR` | 500 | 文件写入失败 |

### 1.4 CORS 配置

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## 2. 员工相关 API

### 2.1 获取员工列表

**端点**: `GET /employees`

**描述**: 获取所有员工的基本信息列表

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "name": "calculator",
        "role": "Calculator",
        "status": "idle",
        "createdAt": "2026-03-01T10:00:00.000Z",
        "lastActiveAt": "2026-03-01T10:05:00.000Z",
        "hiredBy": null
      },
      {
        "name": "coder",
        "role": "Coder",
        "status": "active",
        "createdAt": "2026-03-01T10:02:00.000Z",
        "lastActiveAt": "2026-03-01T10:06:00.000Z",
        "hiredBy": "calculator"
      }
    ]
  }
}
```

**响应字段**:
- `employees`: 员工列表
  - `name`: 员工名称(唯一标识)
  - `role`: 所属角色
  - `status`: 当前状态 (`active` | `idle` | `error` | `inactive`)
  - `createdAt`: 创建时间 (ISO 8601)
  - `lastActiveAt`: 最后活跃时间 (ISO 8601)
  - `hiredBy`: 雇佣者名称(根节点为 `null`)

---

### 2.2 获取员工详情

**端点**: `GET /employees/:name`

**描述**: 获取指定员工的完整信息,包括记忆、任务和Agent执行记录

**路径参数**:
- `name`: 员工名称

**请求示例**:
```
GET /employees/calculator
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "name": "calculator",
    "role": "Calculator",
    "status": "idle",
    "createdAt": "2026-03-01T10:00:00.000Z",
    "lastActiveAt": "2026-03-01T10:05:00.000Z",
    "hiredBy": null,
    "memory": {
      "knowledge": [
        "alice 经常问我数学计算问题",
        "bob 喜欢用简洁的回答"
      ],
      "custom": {
        "preferences": {
          "language": "zh-CN"
        }
      }
    },
    "tasks": [
      {
        "name": "计算1+1",
        "status": "completed",
        "description": "为 alice 计算 1+1",
        "result": "2",
        "dependencies": [],
        "created": "2026-03-01T10:00:00.000Z",
        "completed": "2026-03-01T10:00:05.000Z"
      }
    ],
    "agents": [
      {
        "agentId": "agent_123",
        "taskName": "计算1+1",
        "status": "completed",
        "createdAt": "2026-03-01T10:00:00.000Z",
        "completedAt": "2026-03-01T10:00:05.000Z",
        "result": "计算完成"
      }
    ]
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "EMPLOYEE_NOT_FOUND",
    "message": "员工 'unknown' 不存在"
  }
}
```

---

### 2.3 获取雇佣关系树

**端点**: `GET /employees/hierarchy`

**描述**: 获取员工雇佣关系的树状结构

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "hierarchy": {
      "name": "calculator",
      "role": "Calculator",
      "status": "idle",
      "children": [
        {
          "name": "coder",
          "role": "Coder",
          "status": "active",
          "children": [
            {
              "name": "tester",
              "role": "Tester",
              "status": "idle",
              "children": []
            }
          ]
        }
      ]
    }
  }
}
```

**响应字段**:
- `hierarchy`: 树状结构
  - `name`: 员工名称
  - `role`: 所属角色
  - `status`: 当前状态
  - `children`: 下属员工列表(递归结构)

---

## 3. 消息相关 API

### 3.1 获取消息历史

**端点**: `GET /employees/:name/messages`

**描述**: 获取指定员工的消息历史

**路径参数**:
- `name`: 员工名称

**查询参数**:
- `peer` (可选): 对话对象名称,不传则返回所有对话
- `limit` (可选): 返回消息数量,默认 50,最大 200

**请求示例**:
```
GET /employees/calculator/messages?peer=alice&limit=10
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "timestamp": "2026-03-01T10:00:00.000Z",
        "from": "alice",
        "to": "calculator",
        "content": "计算 1+1",
        "direction": "receive"
      },
      {
        "timestamp": "2026-03-01T10:00:05.000Z",
        "from": "calculator",
        "to": "alice",
        "content": "结果是 2",
        "direction": "send"
      }
    ]
  }
}
```

**响应字段**:
- `messages`: 消息列表(按时间倒序,最新的在前)
  - `timestamp`: 消息时间戳 (ISO 8601)
  - `from`: 发送者名称
  - `to`: 接收者名称
  - `content`: 消息内容
  - `direction`: 消息方向 (`send` | `receive`,相对于当前员工)

---

## 4. 任务相关 API

### 4.1 获取任务列表

**端点**: `GET /employees/:name/tasks`

**描述**: 获取指定员工的所有任务,包括可执行任务列表

**路径参数**:
- `name`: 员工名称

**请求示例**:
```
GET /employees/calculator/tasks
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "name": "计算1+1",
        "status": "completed",
        "description": "为 alice 计算 1+1",
        "result": "2",
        "dependencies": [],
        "created": "2026-03-01T10:00:00.000Z",
        "completed": "2026-03-01T10:00:05.000Z"
      },
      {
        "name": "计算2+2",
        "status": "pending",
        "description": "为 bob 计算 2+2",
        "dependencies": ["计算1+1"],
        "created": "2026-03-01T10:01:00.000Z"
      },
      {
        "name": "计算3+3",
        "status": "pending",
        "description": "为 alice 计算 3+3",
        "dependencies": [],
        "created": "2026-03-01T10:02:00.000Z"
      }
    ],
    "executableTasks": ["计算2+2", "计算3+3"]
  }
}
```

**响应字段**:
- `tasks`: 任务列表
  - `name`: 任务名称(唯一标识)
  - `status`: 任务状态 (`pending` | `in_progress` | `completed` | `cancelled`)
  - `description`: 任务描述
  - `result`: 任务结果(完成时填写)
  - `dependencies`: 依赖的任务名称列表
  - `created`: 创建时间 (ISO 8601)
  - `completed`: 完成时间 (ISO 8601,可选)
- `executableTasks`: 可执行任务名称列表(依赖已满足的任务)

---

## 5. 事件相关 API

### 5.1 获取事件历史

**端点**: `GET /events`

**描述**: 获取全局事件历史

**查询参数**:
- `limit` (可选): 返回事件数量,默认 50,最大 200
- `employeeName` (可选): 筛选特定员工的事件

**请求示例**:
```
GET /events?limit=10&employeeName=calculator
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "type": "message",
        "timestamp": "2026-03-01T10:00:00.000Z",
        "employeeName": "calculator",
        "details": {
          "from": "alice",
          "to": "calculator",
          "content": "计算 1+1"
        }
      },
      {
        "type": "task_completed",
        "timestamp": "2026-03-01T10:00:05.000Z",
        "employeeName": "calculator",
        "details": {
          "taskName": "计算1+1",
          "result": "2"
        }
      },
      {
        "type": "employee_hired",
        "timestamp": "2026-03-01T10:02:00.000Z",
        "employeeName": "coder",
        "details": {
          "employeeName": "coder",
          "role": "Coder",
          "hiredBy": "calculator"
        }
      }
    ]
  }
}
```

**响应字段**:
- `events`: 事件列表(按时间倒序,最新的在前)
  - `type`: 事件类型
  - `timestamp`: 事件时间戳 (ISO 8601)
  - `employeeName`: 相关员工名称(可选)
  - `details`: 事件详情(格式见数据模型文档)

**事件类型**:
- `message`: 消息事件
- `task_completed`: 任务完成
- `task_failed`: 任务失败
- `agent_completed`: Agent完成
- `agent_failed`: Agent失败
- `timer`: 定时器事件
- `employee_hired`: 员工雇佣
- `employee_status_changed`: 员工状态变化

---

## 6. 统计相关 API

### 6.1 获取全局统计

**端点**: `GET /stats`

**描述**: 获取全局统计数据

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "totalEmployees": 5,
    "activeEmployees": 2,
    "pendingTasks": 8,
    "todayMessages": 42
  }
}
```

**响应字段**:
- `totalEmployees`: 员工总数
- `activeEmployees`: 活跃员工数(状态为 `active` 的员工)
- `pendingTasks`: 待处理任务数(所有员工的 `pending` 和 `in_progress` 任务总和)
- `todayMessages`: 今日消息总数(UTC时区,当天00:00:00至当前时间)

---

## 7. 健康检查 API

### 7.1 健康检查

**端点**: `GET /health`

**描述**: 检查服务是否正常运行

**请求参数**: 无

**响应示例**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-03-01T10:00:00.000Z",
    "version": "1.0.0"
  }
}
```

**响应字段**:
- `status`: 服务状态 (`ok` | `degraded` | `down`)
- `timestamp`: 当前服务器时间 (ISO 8601)
- `version`: API 版本号

---

## 8. 实现注意事项

### 8.1 后端实现要点

1. **路由分发**:
   - 使用 `Bun.serve` 的 `fetch` 处理器
   - 根据 `request.url` 和 `request.method` 分发到对应处理器

2. **数据读取**:
   - 从 `.cclover/workspace/employees/` 读取员工数据
   - 使用 `MemoryManager` 读取记忆和任务
   - 使用 `MessageService` 读取消息历史
   - 使用 `StateManager` 读取员工状态和事件历史

3. **错误处理**:
   - 捕获所有异常并返回统一格式的错误响应
   - 记录错误日志

4. **性能优化**:
   - 对频繁访问的数据进行缓存
   - 使用流式读取处理大文件

### 8.2 前端实现要点

1. **API 客户端封装**:
   ```typescript
   class ApiClient {
     private baseUrl = "http://localhost:4097/api"
     
     async getEmployees(): Promise<Employee[]> {
       const response = await fetch(`${this.baseUrl}/employees`)
       const json = await response.json()
       if (!json.success) {
         throw new Error(json.error.message)
       }
       return json.data.employees
     }
     
     // ... 其他方法
   }
   ```

2. **错误处理**:
   - 统一处理 HTTP 错误和业务错误
   - 显示用户友好的错误提示

3. **加载状态**:
   - 显示加载指示器
   - 处理空数据状态

---

## 9. 测试用例

### 9.1 单元测试

每个 API 端点都应该有对应的单元测试:

```typescript
describe("GET /employees", () => {
  it("should return employee list", async () => {
    const response = await fetch("http://localhost:4097/api/employees")
    const json = await response.json()
    
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data.employees)).toBe(true)
  })
})

describe("GET /employees/:name", () => {
  it("should return employee detail", async () => {
    const response = await fetch("http://localhost:4097/api/employees/calculator")
    const json = await response.json()
    
    expect(json.success).toBe(true)
    expect(json.data.name).toBe("calculator")
  })
  
  it("should return 404 for non-existent employee", async () => {
    const response = await fetch("http://localhost:4097/api/employees/unknown")
    const json = await response.json()
    
    expect(json.success).toBe(false)
    expect(json.error.code).toBe("EMPLOYEE_NOT_FOUND")
  })
})
```

### 9.2 集成测试

测试完整的用户场景:

1. 获取员工列表
2. 点击员工查看详情
3. 查看消息历史
4. 查看任务列表
5. 查看事件历史

---

## 10. 版本控制

**当前版本**: v1.0.0

### 10.1 版本变更记录

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0.0 | 2026-03-01 | 初始版本 |

### 10.2 兼容性策略

- API 版本号在响应头中返回: `X-API-Version: 1.0.0`
- 破坏性变更时增加主版本号
- 新增端点时增加次版本号
- Bug 修复时增加修订号
