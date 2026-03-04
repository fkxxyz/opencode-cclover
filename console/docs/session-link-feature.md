# Session Link Feature

## 功能说明

在事件列表中，所有包含 session id 的事件类型现在会将 session id 渲染为蓝色的可点击超链接，点击后会在新标签页中打开对应的 OpenCode session 页面。

## 实现细节

### 1. 工具函数 (`src/lib/opencode-link.ts`)

- `generateOpenCodeSessionLink()`: 生成 OpenCode session 链接
  - 将项目路径进行 base64 编码
  - 格式: `{endpoint}/{base64_encoded_path}/session/{sessionId}`
  - 示例: `http://127.0.0.1:4099/L3J1bi9tZWRpYS9ma3h4eXovd3NsL2hvbWUvZmt4eHl6L3Byby9ma3h4eXovb3BlbmNvZGUtY2Nsb3Zlcg/session/ses_349cbf9a9ffeMfPuKPnxlQ2hhZ`

- `truncateSessionId()`: 截断 session id 用于显示
  - 默认保留前 8 个字符
  - 示例: `ses_349cbf9a9ffeMfPuKPnxlQ2hhZ` → `ses_349c...`

### 2. SessionLink 组件 (`src/components/ui/SessionLink.tsx`)

可复用的 React 组件，用于渲染 session id 链接。

**Props:**

- `sessionId`: Session ID (必需)
- `projectPath`: 项目路径 (必需)
- `truncate`: 是否截断显示 (可选，默认 true)
- `truncateLength`: 截断长度 (可选，默认 8)

**特性:**

- 自动从设置中获取 OpenCode 端点
- 在新标签页中打开链接
- 蓝色文字，悬停时显示下划线

### 3. 修改的组件

以下组件已更新以支持 session id 链接：

1. **EventStream** (`src/components/dashboard/EventStream.tsx`)
   - 获取项目信息以获得 directory
   - 在 session 相关事件中使用 SessionLink 组件

2. **EventTimeline** (`src/components/employee/EventTimeline.tsx`)
   - 获取项目信息以获得 directory
   - 在 session 相关事件中使用 SessionLink 组件

3. **EventItem** (`src/components/employee/EventItem.tsx`)
   - 接受 `projectPath` prop
   - 在 session 相关事件中使用 SessionLink 组件

4. **Timeline** (`src/components/employee/Timeline.tsx`)
   - 获取项目信息并传递给 EventItem

5. **MessagePanel** (`src/components/employee/MessagePanel.tsx`)
   - 获取项目信息并传递给 EventItem

### 4. 支持的事件类型

以下事件类型的 session id 会被渲染为链接：

- `session_created`: 会话创建
- `session_prompt_started`: AI请求开始
- `session_prompt_completed`: AI响应完成
- `session_summary_started`: 总结开始
- `session_summary_completed`: 总结完成

## 使用示例

```tsx
import { SessionLink } from "../components/ui/SessionLink"

// 基本使用
<SessionLink
  sessionId="ses_349cbf9a9ffeMfPuKPnxlQ2hhZ"
  projectPath="/run/media/fkxxyz/wsl/home/fkxxyz/pro/fkxxyz/opencode-cclover"
/>

// 不截断显示
<SessionLink
  sessionId="ses_349cbf9a9ffeMfPuKPnxlQ2hhZ"
  projectPath="/run/media/fkxxyz/wsl/home/fkxxyz/pro/fkxxyz/opencode-cclover"
  truncate={false}
/>

// 自定义截断长度
<SessionLink
  sessionId="ses_349cbf9a9ffeMfPuKPnxlQ2hhZ"
  projectPath="/run/media/fkxxyz/wsl/home/fkxxyz/pro/fkxxyz/opencode-cclover"
  truncateLength={12}
/>
```

## 配置

OpenCode 端点可以在设置页面中配置（默认: `http://127.0.0.1:4099`）。

## 注意事项

1. 链接生成依赖于设置中的 OpenCode 端点配置
2. 项目路径使用 base64 编码以确保 URL 安全
3. 链接在新标签页中打开，不会影响当前页面
4. 如果项目信息未加载完成，session id 不会显示为链接
