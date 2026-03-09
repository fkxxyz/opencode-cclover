import { useState, useEffect, useRef, useMemo, memo } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useTimeline } from "../../hooks/useTimeline"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"
import IconButton from "@mui/material/IconButton"
import useMediaQuery from "@mui/material/useMediaQuery"
import { useTheme } from "@mui/material/styles"
import { ArrowLeft, ArrowDown } from "lucide-react"
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import { Send } from "lucide-react"
import { apiClient } from "../../services/api"
import { EventItem } from "./EventItem"
import type { Message, Event, Project } from "../../types"
import { handleError, ValidationError } from "../../lib/error-handler"

interface MessagePanelProps {
  projectId: string
  employeeName: string
  peer: string
  onBack?: () => void
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// 记忆化消息组件
const VirtualMessageItem = memo(
  ({
    message,
    index,
    employeeName,
  }: {
    message: Message
    index: number
    employeeName: string
  }) => {
    const theme = useTheme()
    const isSent = message.direction === "send"

    return (
      <Box
        key={`message-${message.timestamp}-${index}`}
        sx={{
          display: "flex",
          justifyContent: isSent ? "flex-end" : "flex-start",
        }}
      >
        <Box
          sx={{
            maxWidth: "70%",
            borderRadius: 2,
            p: 1.5,
            bgcolor: isSent
              ? "primary.main"
              : (theme) =>
                  theme.palette.mode === "dark" ? "grey.800" : "grey.200",
            color: isSent
              ? "primary.contrastText"
              : (theme) =>
                  theme.palette.mode === "dark" ? "grey.100" : "grey.900",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 0.5,
            }}
          >
            <Typography variant="caption" fontWeight="medium">
              {isSent ? message.from : message.from}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: isSent
                  ? "rgba(255, 255, 255, 0.7)"
                  : (theme) =>
                      theme.palette.mode === "dark"
                        ? "grey.400"
                        : "text.secondary",
              }}
            >
              {formatTimestamp(message.timestamp)}
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {message.content}
          </Typography>
        </Box>
      </Box>
    )
  }
)

VirtualMessageItem.displayName = "VirtualMessageItem"

// 记忆化事件组件
const VirtualEventItem = memo(
  ({
    event,
    projectPath,
    index,
  }: {
    event: Event
    projectPath: string
    index: number
  }) => {
    return (
      <EventItem
        key={`event-${event.timestamp}-${index}`}
        event={event}
        projectPath={projectPath}
      />
    )
  }
)

VirtualEventItem.displayName = "VirtualEventItem"

export function MessagePanel({
  projectId,
  employeeName,
  peer,
  onBack,
}: MessagePanelProps) {
  const { timeline, loading, loadMoreMessages, hasMore, loadingMore } =
    useTimeline(projectId, employeeName)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))
  const [inputValue, setInputValue] = useState("")
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isInitialLoadRef = useRef(true)
  const [project, setProject] = useState<Project | null>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [hasNewMessages, setHasNewMessages] = useState(false)
  const [scrollRestoreTarget, setScrollRestoreTarget] = useState<number | null>(
    null
  )
  const prevPeerRef = useRef(peer)

  // 获取项目信息以获得 directory
  useEffect(() => {
    apiClient
      .getProjects()
      .then((projects) => {
        const found = projects.find((p) => p.projectId === projectId)
        if (found) {
          setProject(found)
        }
      })
      .catch((err) => console.error("获取项目信息失败:", err))
  }, [projectId])

  // 过滤只显示与当前 peer 的消息和事件
  const filteredTimeline = useMemo(
    () =>
      timeline?.filter((item) => {
        if (item.type === "message") {
          const message = item.data as Message
          return (
            (message.from === employeeName && message.to === peer) ||
            (message.from === peer && message.to === employeeName)
          )
        }
        // 事件总是显示
        return true
      }) || [],
    [timeline, employeeName, peer]
  )

  // 虚拟列表配置
  const virtualizer = useVirtualizer({
    count: filteredTimeline.length,
    getScrollElement: () => messagesContainerRef.current,
    estimateSize: () => 100, // 初始估计高度
    measureElement:
      typeof window !== "undefined" &&
      navigator.userAgent.indexOf("Firefox") === -1
        ? (element) => element.getBoundingClientRect().height
        : undefined,
    overscan: 5,
    onChange: (instance) => {
      // 恢复滚动位置（在测量完成后）
      const scrollElement = messagesContainerRef.current
      if (scrollRestoreTarget !== null && scrollElement) {
        scrollElement.scrollTop =
          scrollElement.scrollHeight - scrollRestoreTarget
        setScrollRestoreTarget(null)
      }
    },
  })

  // 滚动到底部
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight
    }
  }

  // 滚动检测
  const handleScroll = () => {
    const container = messagesContainerRef.current
    if (!container) return

    // 检查是否接近顶部 - 触发加载更多
    if (container.scrollTop < 100 && hasMore && !loadingMore) {
      handleLoadMore()
    }

    // 检查是否接近底部 - 用于自动滚动行为
    const threshold = 100
    const isNear =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold
    setIsNearBottom(isNear)
    if (isNear) setHasNewMessages(false)
  }

  // 加载更多消息
  const handleLoadMore = async () => {
    const scrollElement = messagesContainerRef.current
    if (!scrollElement || !hasMore || loadingMore) return

    // 保存距离底部的滚动位置
    const scrollFromBottom =
      scrollElement.scrollHeight - scrollElement.scrollTop

    // 触发加载
    await loadMoreMessages()

    // 设置恢复目标（onChange 会处理实际恢复）
    setScrollRestoreTarget(scrollFromBottom)
  }

  // 初始加载时直接定位到底部，后续新消息根据位置决定
  useEffect(() => {
    if (filteredTimeline.length > 0) {
      if (isInitialLoadRef.current) {
        // 初始加载：直接跳到底部
        scrollToBottom()
        isInitialLoadRef.current = false
      } else if (isNearBottom) {
        // 用户在底部：自动滚动
        scrollToBottom()
      } else {
        // 用户在上方：显示新消息指示器
        setHasNewMessages(true)
      }
    }
  }, [filteredTimeline])

  // 切换 peer 时重置状态
  useEffect(() => {
    if (prevPeerRef.current !== peer) {
      // 重置滚动到底部
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight
      }
      isInitialLoadRef.current = true
      setHasNewMessages(false)
      prevPeerRef.current = peer
    }
  }, [peer])

  const handleSend = async () => {
    // 验证输入
    if (!inputValue.trim()) {
      handleError(
        new ValidationError("消息不能为空", "请输入消息内容"),
        "发送消息"
      )
      return
    }

    const messageContent = inputValue
    setInputValue("") // 立即清空输入框（乐观更新）

    try {
      await apiClient.sendMessage(projectId, employeeName, peer, messageContent)
    } catch (error) {
      // 统一错误处理
      const appError = handleError(error, "发送消息")

      // 如果可以重试，恢复输入框内容
      if (appError.retryable) {
        setInputValue(messageContent)
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        {isMobile && onBack && (
          <IconButton
            size="small"
            onClick={onBack}
            sx={{ mr: 1 }}
            aria-label="返回对话列表"
          >
            <ArrowLeft className="h-5 w-5" />
          </IconButton>
        )}
        <Typography variant="h6">与 {peer} 的对话</Typography>
      </Box>
      <Box
        ref={messagesContainerRef}
        onScroll={handleScroll}
        sx={{
          flex: 1,
          overflowY: "auto",
          position: "relative",
        }}
      >
        {loadingMore && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              p: 1,
              bgcolor: "background.paper",
              zIndex: 1,
            }}
          >
            <CircularProgress size={20} />
          </Box>
        )}
        {filteredTimeline.length === 0 ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <Typography color="text.secondary">暂无消息</Typography>
          </Box>
        ) : (
          <Box
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
              padding: "16px",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = filteredTimeline[virtualItem.index]

              return (
                <Box
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                    padding: "0 16px",
                  }}
                >
                  {item.type === "event" ? (
                    <VirtualEventItem
                      event={item.data as Event}
                      projectPath={project?.directory || ""}
                      index={virtualItem.index}
                    />
                  ) : (
                    <VirtualMessageItem
                      message={item.data as Message}
                      index={virtualItem.index}
                      employeeName={employeeName}
                    />
                  )}
                </Box>
              )
            })}
          </Box>
        )}
        {hasNewMessages && (
          <Box
            sx={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2,
            }}
          >
            <Button
              variant="contained"
              size="small"
              onClick={scrollToBottom}
              startIcon={<ArrowDown className="h-4 w-4" />}
            >
              新消息
            </Button>
          </Box>
        )}
      </Box>
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          gap: 1,
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="输入消息..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          multiline
          maxRows={4}
        />
        <Button
          variant="contained"
          onClick={handleSend}
          disabled={!inputValue.trim()}
          sx={{ minWidth: "auto", px: 2 }}
        >
          <Send className="h-5 w-5" />
        </Button>
      </Box>
    </Box>
  )
}
