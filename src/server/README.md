# Server 路由系统

## 概述

本目录包含 HTTP API 服务器的实现，使用 **Map 查找**优化路由性能。

## 文件结构

```
src/server/
├── index.ts          # ConsoleServer 主类（HTTP + WebSocket）
├── router.ts         # 路由分发器（使用 Map 查找）
├── routes.ts         # 路由定义表（集中管理所有 API）
├── types.ts          # 类型定义
├── websocket.ts      # WebSocket 管理器
├── GlobalServer.ts   # 全局服务单例
└── ProjectRegistry.ts # 项目注册表
```

## 路由系统设计

### 1. 路由定义 (`routes.ts`)

所有 API 路由集中定义在 `routes.ts` 文件中，分为三类：

#### 静态路由 (`staticRoutes`)
- 使用 Map 存储，键格式：`"METHOD:PATH"`
- O(1) 查找复杂度
- 适用于固定路径的 API

```typescript
staticRoutes.get("GET:/api/health")  // 健康检查
staticRoutes.get("POST:/api/projects")  // 添加项目
```

#### 项目级路由 (`projectRoutes`)
- 使用 Map 存储，键格式：`"METHOD:subpath"`
- 完整路径：`/api/projects/:projectId{subpath}`
- 适用于项目级固定路径的 API

```typescript
projectRoutes.get("GET:/employees")  // 获取员工列表
projectRoutes.get("GET:/stats")  // 获取统计数据
```

#### 项目级参数路由 (`projectParamRoutes`)
- 使用 Map 存储，键格式：`"METHOD:subpath_with_params"`
- 包含路径参数（如 `:name`）
- 需要路径匹配，性能略低于静态路由

```typescript
projectParamRoutes.get("GET:/employees/:name")  // 获取员工详情
projectParamRoutes.get("GET:/employees/:name/messages")  // 获取消息历史
```

### 2. 路由分发 (`router.ts`)

Router 类按优先级查找路由：

1. **静态路由**：直接 Map 查找（最快）
2. **项目级路由**：提取 projectId 后 Map 查找
3. **参数路由**：遍历匹配路径模式（最慢，但只在前两步失败后执行）

```typescript
// 查找顺序
1. staticRoutes.get("GET:/api/health")  // O(1)
2. projectRoutes.get("GET:/employees")  // O(1)
3. matchParamRoute("GET", "/employees/alice")  // O(n)，n 为参数路由数量
```

## API 文档

每个路由都有详细的 JSDoc 注释，包括：

- `@endpoint`: API 端点
- `@description`: 功能描述
- `@pathParams`: 路径参数说明
- `@queryParams`: 查询参数说明
- `@requestBody`: 请求体格式
- `@response`: 响应格式
- `@errors`: 错误码说明
- `@example`: 使用示例

**查看完整 API 文档**：直接阅读 `routes.ts` 文件中的注释。

## 性能优化

### 为什么使用 Map？

| 方案 | 查找复杂度 | 优点 | 缺点 |
|------|-----------|------|------|
| 数组遍历 | O(n) | 简单直接 | 路由多时性能差 |
| Map 查找 | O(1) | 性能最优 | 需要精确匹配 |
| 正则匹配 | O(n) | 灵活 | 性能最差 |

**本项目方案**：
- 静态路由：Map 查找（O(1)）
- 参数路由：Map + 路径匹配（O(n)，但 n 很小）

### 性能对比

假设有 13 个 API：

- **旧方案**（数组遍历）：平均 6.5 次比较
- **新方案**（Map 查找）：
  - 静态路由：1 次查找
  - 参数路由：1 次 Map 查找失败 + 最多 3 次路径匹配

## 添加新 API

### 1. 添加静态路由

在 `routes.ts` 的 `staticRoutes` 中添加：

```typescript
/**
 * 你的 API 描述
 *
 * @endpoint GET /api/your-endpoint
 * @description 详细说明
 * @response { success: true, data: {...} }
 */
[
  "GET:/api/your-endpoint",
  async (req, params, deps) => {
    // 你的处理逻辑
    return { success: true, data: {} }
  },
],
```

### 2. 添加项目级路由

在 `routes.ts` 的 `projectRoutes` 中添加：

```typescript
/**
 * 你的 API 描述
 *
 * @endpoint GET /api/projects/:projectId/your-endpoint
 * @description 详细说明
 */
[
  "GET:/your-endpoint",
  async (req, params, deps) => {
    // deps 包含: stateManager, memoryManager, messageService, agentRegistry, workspaceRoot
    return { success: true, data: {} }
  },
],
```

### 3. 添加参数路由

在 `routes.ts` 的 `projectParamRoutes` 中添加：

```typescript
/**
 * 你的 API 描述
 *
 * @endpoint GET /api/projects/:projectId/items/:id
 * @pathParams
 *   - projectId: 项目ID
 *   - id: 项目ID
 */
[
  "GET:/items/:id",
  async (req, eps) => {
    const itemId = params.id  // 从 params 获取路径参数
    return { success: true, data: {} }
  },
],
```

## 注意事项

1. **路由键格式**：必须严格遵守 `"METHOD:PATH"` 格式
2. **参数命名**：路径参数使用 `:name` 格式，在 handler 中通过 `params.name` 访问
3. **注释完整性**：每个路由都应有完整的 JSDoc 注释
4. **错误处理**：Router 会自动捕获异常并返回 500 错误
5. **CORS**：所有响应自动添加 CORS 头

## 测试

运行测试确保路由正常工作：

```bash
bun test
```

所有测试应该通过（153 个测试）。
