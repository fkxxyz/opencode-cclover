#!/usr/bin/env bash
# 快速启动 OpenCode server 进行测试

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting OpenCode server for cclover plugin testing..."
echo ""
echo "🔌 Port: 4099"
echo ""
echo "Press Ctrl+C to stop the server"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 后台启动 OpenCode server，输出到临时文件
LOG_FILE="/tmp/opencode-cclover-test.log"
cd "$SCRIPT_DIR"
CCLOVER_ENABLE=1 opencode serve --port 4099 > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# 清理函数
CLEANUP_DONE=0
cleanup() {
  # 防止重复执行
  if [ $CLEANUP_DONE -eq 1 ]; then
    return
  fi
  CLEANUP_DONE=1
  
  echo ""
  echo "🛑 Stopping server..."
  
  # 转发信号给 opencode 进程
  if kill -0 $SERVER_PID 2>/dev/null; then
    kill -TERM $SERVER_PID 2>/dev/null || true
    # 等待进程优雅退出（最多 5 秒）
    for i in {1..50}; do
      if ! kill -0 $SERVER_PID 2>/dev/null; then
        break
      fi
      sleep 0.1
    done
    # 如果还没退出，强制杀死
    if kill -0 $SERVER_PID 2>/dev/null; then
      kill -9 $SERVER_PID 2>/dev/null || true
    fi
  fi
  
  # 停止 tail
  if [ -n "$TAIL_PID" ] && kill -0 $TAIL_PID 2>/dev/null; then
    kill $TAIL_PID 2>/dev/null || true
  fi
  
  # 删除日志文件
  rm -f "$LOG_FILE"
  
  echo "✅ Server stopped"
}

# 捕获信号并转发（移除 EXIT trap 避免重复调用）
trap cleanup SIGINT SIGTERM

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

# 等待服务器进程结束（或被信号中断）
wait $SERVER_PID 2>/dev/null || true

# 显式调用清理（如果 wait 被中断，trap 会调用 cleanup；如果正常退出，这里调用）
cleanup
exit 0
