#!/usr/bin/env bash
# 快速启动 OpenCode server 进行测试

set -e

echo "🚀 Starting OpenCode server for cclover plugin testing..."
echo ""
echo "📁 Working directory: workspace_test"
echo "🔌 Port: 4099"
echo "🔗 Plugin: .opencode/plugin/cclover.ts"
echo ""
echo "Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd workspace_test
opencode serve --port 4099
