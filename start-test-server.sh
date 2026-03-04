#!/usr/bin/env bash
# 快速启动 OpenCode server 进行测试

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$SCRIPT_DIR/workspace_test"

echo "🚀 Starting OpenCode server for cclover plugin testing..."
echo ""
echo "🔌 Port: 4099"
echo "📁 Working dir: workspace_test"
echo ""
echo "Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 后台启动 OpenCode server，输出到临时文件
LOG_FILE="/tmp/opencode-cclover-test-$.log"
cd "$WORKSPACE_DIR" && CCLOVER_ENABLE=1 opencode serve --port 4099 > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# 清理函数
cleanup() {
  echo ""
  echo "🛑 Stopping server..."
  
  # 转发信号给 opencode 进程
  if kill -0 $SERVER_PID 2>/dev/null; then
    kill -TERM $SERVER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
  fi
  
  # 停止 tail
  if [ -n "$TAIL_PID" ] && kill -0 $TAIL_PID 2>/dev/null; then
    kill $TAIL_PID 2>/dev/null || true
  fi
  
  # 删除日志文件
  rm -f "$LOG_FILE"
  
  echo "✅ Server stopped"
  exit 0
}

# 捕获信号并转发
trap cleanup SIGINT SIGTERM EXIT

# 等待服务器启动并触发插件加载
echo "⏳ Waiting for server to start..."
for i in {1..10}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:4099/project/current >/dev/null 2>&1; then
    echo "✅ Server started and plugin loaded"
    break
  fi
  sleep 1
done

# 显示日志（包含插件加载信息）
echo "📋 Server log:"
echo ""
tail -n 10000 -f "$LOG_FILE" &
TAIL_PID=$!

# 等待服务器进程结束
wait $SERVER_PID
# 清理
kill $TAIL_PID 2>/dev/null || true
rm -f "$LOG_FILE"
