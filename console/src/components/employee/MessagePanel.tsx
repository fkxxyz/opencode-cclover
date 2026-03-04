import { useState, useEffect, useRef } from "react"
import { useTimeline } from "../../hooks/useTimeline"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"
import IconButton from "@mui/material/IconButton"
import useMediaQuery from "@mui/material/useMediaQuery"
import { useTheme } from "@mui/material/styles"
import { ArrowLeft } from "lucide-react"
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

export function MessagePanel({
  projectId,
  employeeName,
  peer,
  onBack,
}: MessagePanelProps) {
  const { timeline, loading } = useTimeline(projectId, employeeName)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down("md"))
  const [inputValue, setInputValue] = useState("")
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const isInitialLoadRef = useRef(true)
  const [project, setProject] = useState<Project | null>(null)

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
  const filteredTimeline =
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
    }) || []

  // 初始加载时直接定位到底部，后续新消息平滑滚动
  useEffect(() => {
    if (messagesContainerRef.current) {
      if (isInitialLoadRef.current && filteredTimeline.length > 0) {
        // 初始加载：直接跳到底部，无动画
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight
        isInitialLoadRef.current = false
      } else if (!isInitialLoadRef.current) {
        // 后续更新：平滑滚动
        messagesContainerRef.current.scrollTo({
          top: messagesContainerRef.current.scrollHeight,
          behavior: "smooth",
        })
      }
    }
  }, [filteredTimeline])

  // 切换 peer 时重置初始加载标志
  useEffect(() => {
    isInitialLoadRef.current = true
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
        sx={{
          flex: 1,
          overflowY: "auto",
          p: 2,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {filteredTimeline.length === 0 ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography color="text.secondary">暂无消息</Typography>
          </Box>
        ) : (
          filteredTimeline.map((item, index) => {
            if (item.type === "event") {
              return (
                <EventItem
                  key={`event-${item.timestamp}-${index}`}
                  event={item.data as Event}
                  projectPath={project?.directory || ""}
                />
              )
            }

            const message = item.data as Message
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
                          theme.palette.mode === "dark"
                            ? "grey.800"
                            : "grey.200",
                    color: isSent
                      ? "primary.contrastText"
                      : (theme) =>
                          theme.palette.mode === "dark"
                            ? "grey.100"
                            : "grey.900",
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
          })
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
