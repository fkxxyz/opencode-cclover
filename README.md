# opencode-cclover

A comprehensive OpenCode plugin for cclover.

## Features

- Background task management
- Outputs "hello world" every minute (demonstration)

## Installation

### Local Development

```bash
# Install dependencies
bun install

# Build
bun run build
```

### Use in OpenCode

#### Method 1: Auto-discovery

Place the plugin in your project's `.opencode/plugin/` directory:

```bash
# From your project root
mkdir -p .opencode/plugin
ln -s $(pwd)/src/index.ts .opencode/plugin/cclover.ts
```

OpenCode will automatically discover and load it.

#### Method 2: Local file reference

In your project's `opencode.json`:

```json
{
  "plugin": [
    "file:///absolute/path/to/opencode-cclover/src/index.ts"
  ]
}

#### Method 3: npm package (after publishing)

```json
{
  "plugin": ["opencode-cclover"]
}

```

## Development

```bash
# Watch mode
bun run dev

# Build
bun run build

# Test
bun run test
```

## Project Strun```
opencode-cclover/
├── src/
│   ├── index.ts              # Plugin entry point
│   └── lib/
│       ├── background.ts     # Background task management
│       └── logger.ts         # Logging utility
├── dist/                     # Compiled output (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
