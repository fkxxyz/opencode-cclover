# 使用说明

## 快速开始

### 方法 1: 自动发现（推荐）

将插件放在项目的 `.opencode/plugin/` 目录中：

```bash
# 在你的项目根目录
mkdir -p .opencode/plugin
ln -s $(pwd)/src/index.ts .opencode/plugin/cclover.ts
```

OpenCode 会自动发现并加载插件。

### 方法 2: 使用源文件（开发模式）

在你的项目的 `opencode.json` 或 `opencode.jsonc` 中添加：

```json
{
  "plugin": [
    "file:///absolute/path/to/opencode-cclover/src/index.ts"
  ]
}

### 方法 3: 使用构建后的文件

```json
{
  "plugin": [
    "file:///absolute/path/to/opencode-cclover/dist/index.js"
  ]
}


## 验证插件是否工作

1. 重启 OpenCode
2. 查看控制台输出，应该看到：
   - `[opencode-cclover] Initializing opencode-cclover plugin...`
   - `[opencode-cclover] Starting background tasks...`
   - `[opencode-cclover] Background tasks started successfully`
   - `[opencode-cclover] Plugin initialized successfully`
3. 等待 1 分钟，应该看到 `hello world` 输出

## 开发模式

在插件目录中运行：

```bash
bun run dev

这会启动 TypeScript 监视模式，自动重新编译修改的文件。

## 项目结构

```
opencode-cclover/
├── src/
│   ├── index.ts              # 插件入口
│   └── lib/
│       ├── background.ts     # 后台任务管理
│       └── logger.ts         # 日志工具
├── dist/                     # 编译输出
├── package.json
├── tsconfig.json
├── README.md
└── USAGE.md                  # 本文件
```

## 修改后台任务

编辑 `src/lib/background.ts`：

```typescript
// 修改输出内容
console.log("你的自定义消息");

// 修改时间间隔（毫秒）
setInterval(() => {
  console.log("hello world");
}, 30000); // 30 秒
```

修改后运行 `bun run build` 重新构建。
