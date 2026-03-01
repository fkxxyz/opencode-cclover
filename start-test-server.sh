#!/usr/bin/env bash
# 快速启动 OpenCode server 进行测试
set -e
# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "🚀 Starting OpenCode server for cclover plugin testing..."
echo ""
echo "📁 Project root: $SCRIPT_DIR"
echo "🔌 Port: 4099"
echo "🔗 Config dir: workspace_test/.opencode"
echo ""
echo "Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
# 使用 OPENCODE_CONFIG_DIR 指向 workspace_test/.opencode
OPENCODE_CONFIG_DIR="$SCRIPT_DIR/workspace_test/.opencode" opencode serve --port 4099
