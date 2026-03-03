import { useState } from "react"
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
import type { TimelineItem, Message, Event } from "../../types"

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

  const handleSend = async () => {
    if (!inputValue.trim()) return
    try {
      await apiClient.sendMessage(projectId, employeeName, peer, inputValue)
      setInputValue("")
      // 消息会通过 WebSocket 自动更新
    } catch (error) {
      console.error("发送消息失败:", error)
      alert(`发送失败: ${error instanceof Error ? error.message : "未知错误"}`)
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
