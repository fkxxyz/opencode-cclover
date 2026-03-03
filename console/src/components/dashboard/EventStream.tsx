import { useEvents } from "../../hooks/useEvents"
import { Badge } from "../ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import type { EventType } from "../../types/index"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

const eventTypeColors: Partial<Record<EventType, { bg: string; text: string }>> = {
  message: { bg: "#dbeafe", text: "#1e40af" },
  task_completed: { bg: "#dcfce7", text: "#166534" },
  task_failed: { bg: "#fee2e2", text: "#991b1b" },
  task_created: { bg: "#e0f2fe", text: "#075985" },
  task_modified: { bg: "#fef3c7", text: "#92400e" },
  agent_completed: { bg: "#f3e8ff", text: "#6b21a8" },
  agent_failed: { bg: "#fee2e2", text: "#991b1b" },
  agent_created: { bg: "#ede9fe", text: "#5b21b6" },
  timer: { bg: "#f1f5f9", text: "#475569" },
  employee_hired: { bg: "#fef3c7", text: "#92400e" },
  employee_status_changed: { bg: "#fed7aa", text: "#9a3412" },
  session_created: { bg: "#ddd6fe", text: "#5b21b6" },
  session_summarized: { bg: "#e0e7ff", text: "#3730a3" },
  message_sent: { bg: "#dbeafe", text: "#1e40af" },
  message_received: { bg: "#dbeafe", text: "#1e40af" },
  task_updated: { bg: "#dcfce7", text: "#166534" },
  agent_updated: { bg: "#f3e8ff", text: "#6b21a8" },
}

const eventTypeLabels: Partial<Record<EventType, string>> = {
  message: "消息",
  task_completed: "任务完成",
  task_failed: "任务失败",
  task_created: "任务创建",
  task_modified: "任务修改",
  agent_completed: "Agent完成",
  agent_failed: "Agent失败",
  agent_created: "Agent创建",
  timer: "定时器",
  employee_hired: "员工雇佣",
  employee_status_changed: "状态变化",
  session_created: "会话创建",
  session_summarized: "会话总结",
  message_sent: "发送消息",
  message_received: "接收消息",
  task_updated: "任务更新",
  agent_updated: "Agent更新",
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 60) return `${seconds}秒前`
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`

  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getEventDescription(
  type: EventType,
  details: Record<string, unknown>,
  employeeName?: string
): string {
  switch (type) {
    case "message":
    case "message_sent":
    case "message_received":
      return `${details.from} → ${details.to}: ${details.content}`
    case "task_completed":
      return `任务 "${details.taskName}" 已完成`
    case "task_failed":
      return `任务 "${details.taskName}" 失败: ${details.error}`
    case "task_created":
      return `创建任务 "${details.taskName}"${details.description ? `: ${details.description}` : ""}`
    case "task_modified":
      return `修改任务 "${details.taskName}"`
    case "agent_completed":
      return `Agent ${details.agentId} 完成任务 "${details.taskName}"`
    case "agent_failed":
      return `Agent ${details.agentId} 失败: ${details.error}`
    case "agent_created":
      return `创建 Agent 执行任务 "${details.taskName}"`
    case "session_created":
      return `创建会话 (${String(details.sessionId).slice(0, 8)}...)`
    case "session_summarized":
      return `会话总结 (${details.messageCount} 条消息, ${details.tokenCount} tokens)`
    case "employee_hired":
      return `${details.hiredBy} 雇佣了 ${details.employeeName} (${details.role})`
    case "employee_status_changed":
      return `${employeeName} 状态: ${details.oldStatus} → ${details.newStatus}`
    case "task_updated":
      return `任务更新: ${details.taskName}`
    case "agent_updated":
      return `Agent ${details.agentId} 状态更新`
    case "timer":
      return `定时器触发 (间隔: ${details.interval}ms)`
    default:
      return JSON.stringify(details)
  }
}

interface EventStreamProps {
  projectId: string
}
export function EventStream({ projectId }: EventStreamProps) {
  const { events, loading } = useEvents(projectId, { limit: 50 })

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>实时事件流</CardTitle>
        </CardHeader>
        <CardContent>
          <Typography textAlign="center" color="text.secondary">
            加载中...
          </Typography>
        </CardContent>
      </Card>
    )
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>实时事件流</CardTitle>
        </CardHeader>
        <CardContent>
          <Typography textAlign="center" color="text.secondary">
            暂无事件
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>实时事件流</CardTitle>
      </CardHeader>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            maxHeight: 600,
            overflowY: "auto",
          }}
        >
          {events.map((event, index) => (
            <Box
              key={`${event.timestamp}-${index}`}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                p: 1.5,
                borderRadius: 1,
                border: 1,
                borderColor: "divider",
                bgcolor: "background.paper",
                "&:hover": {
                  bgcolor: "action.hover",
                },
                transition: "background-color 0.2s",
              }}
            >
              <Box sx={{ flexShrink: 0, pt: 0.5 }}>
                <Badge
                  style={{
                    backgroundColor:
                      eventTypeColors[event.type]?.bg || "#e5e7eb",
                    color: eventTypeColors[event.type]?.text || "#374151",
                  }}
                >
                  {eventTypeLabels[event.type] || event.type || "未知事件"}
                </Badge>
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  {event.employeeName && (
                    <Typography variant="body2" fontWeight="medium">
                      {event.employeeName}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatTimestamp(event.timestamp)}
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ wordBreak: "break-word" }}
                >
                  {getEventDescription(
                    event.type,
                    event.details,
                    event.employeeName
                  )}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}
