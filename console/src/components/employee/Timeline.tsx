import { Box, Typography, CircularProgress } from "@mui/material"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useTimeline } from "../../hooks"
import { EventItem } from "./EventItem"
import type { TimelineItem, Message, Event } from "../../types"

interface TimelineProps {
  projectId: string
  employeeName: string
  peer?: string
  limit?: number
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

// 消息气泡组件
function MessageBubble({ message }: { message: Message }) {
  const isSent = message.direction === "send"

  return (
    <Box
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

// Timeline 项组件
function TimelineItemComponent({ item }: { item: TimelineItem }) {
  if (item.type === "message") {
    return <MessageBubble message={item.data as Message} />
  }

  return <EventItem event={item.data as Event} />
}

export function Timeline({
  projectId,
  employeeName,
  peer,
  limit,
}: TimelineProps) {
  const { timeline, loading } = useTimeline(projectId, employeeName, limit)

  // 如果指定了 peer，过滤只显示与该 peer 的消息和事件
  const filteredTimeline = peer
    ? timeline?.filter((item) => {
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
    : timeline || []

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>时间线</CardTitle>
        </CardHeader>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (filteredTimeline.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>时间线</CardTitle>
        </CardHeader>
        <CardContent>
          <Typography align="center" color="text.secondary">
            暂无消息或事件
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          时间线{" "}
          {peer && (
            <Typography component="span" variant="body2" color="text.secondary">
              与 {peer}
            </Typography>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
            maxHeight: 600,
            overflowY: "auto",
          }}
        >
          {filteredTimeline.map((item, index) => (
            <TimelineItemComponent
              key={`${item.type}-${item.timestamp}-${index}`}
              item={item}
            />
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}
