# 配置功能说明

## 功能概述

Console UI 现在支持用户配置，配置保存在浏览器的 localStorage 中。

## 配置项

### 1. 主题模式
- **浅色 (light)**: 明亮主题
- **深色 (dark)**: 暗色主题
- **跟随系统 (system)**: 自动跟随操作系统主题设置

### 2. 语言设置
- **简体中文 (zh-CN)**: 当前唯一支持的语言

### 3. OpenCode 端点
- 默认值: `http://127.0.0.1:4099`
- 可以自定义 OpenCode 服务器地址
- 支持测试连接功能

## 使用方式

### 快捷主题切换
在顶部导航栏右侧有一个主题切换按钮（月亮/太阳图标）：
- 点击可以在 **浅色** 和 **深色** 之间快速切换
- 不支持切换到"跟随系统"模式

### 完整设置对话框
点击顶部导航栏右侧的齿轮图标打开设置对话框：
- 可以选择所有三种主题模式（包括"跟随系统"）
- 可以修改语言设置
- 可以修改 OpenCode 端点地址
- 可以测试端点连接

## 技术实现

### 存储方案
- **方式**: localStorage
- **Key**: `cclover-console-settings`
- **格式**: JSON
```json
{
  "theme": "dark",
  "language": "zh-CN",
  "endpoint": "http://127.0.0.1:4099"
}
```

### 文件结构
```
console/src/
├── types/
│   └── settings.ts              # 配置类型定义
├── contexts/
│   └── SettingsContext.tsx      # 配置 Context 和 Provider
├── components/
│   ├── settings/
│   │   └── SettingsDialog.tsx   # 设置对话框组件
│   └── layout/
│       └── Layout.tsx            # 布局组件（包含主题切换和设置按钮）
└── main.tsx                      # 应用入口（集成 SettingsProvider）
```

### 核心组件

#### SettingsContext
- 提供全局配置状态管理
- 自动监听系统主题变化
- 提供 `toggleTheme()` 快捷切换方法
- 提供 `resolvedTheme` 计算属性（解析"跟随系统"为实际主题）

#### SettingsDialog
- 完整的配置界面
- 支持端点连接测试
- 修改后需要点击"保存"才生效

#### Layout
- 顶部工具栏包含主题切换和设置按钮
- 响应式设计，移动端和桌面端都支持

## 默认值
```typescript
{
  theme: "system",      // 默认跟随系统
  language: "zh-CN",    // 默认简体中文
  endpoint: "http://127.0.0.1:4099"  // 默认本地端点
}
```

## 测试连接功能

点击"测试连接"按钮会：
1. 向配置的端点发送 GET 请求到 `/health`
2. 5 秒超时
3. 显示连接结果（成功/失败）

注意：目前 OpenCode 服务器可能没有 `/health` 端点，测试可能会失败。这是正常的，可以根据实际 API 调整。
