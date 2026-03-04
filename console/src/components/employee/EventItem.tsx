import { Box, Typography } from "@mui/material"
import type { Event, EventType } from "../../types"
import { SessionLink } from "../ui/SessionLink"

interface EventItemProps {
  event: Event
  projectPath: string
}

// 事件图标映射
const EVENT_ICONS: Partial<Record<EventType, string>> = {
  employee_status_changed: "🔄",
  session_created: "⚡",
  session_prompt_started: "🤔",
  session_prompt_completed: "💡",
  session_summary_started: "📝",
  session_summary_completed: "📊",
  agent_created: "🤖",
  agent_completed: "✅",
  task_created: "📋",
  task_modified: "✏️",
  task_completed: "✅",
  message: "💬",
  task_failed: "❌",
  agent_failed: "❌",
  timer: "⏰",
  employee_hired: "👤",
  message_sent: "📤",
  message_received: "📥",
  task_updated: "📝",
  agent_updated: "🔄",
}

// 生成事件描述
function getEventDescription(
  event: Event,
  projectPath: string
): React.ReactNode {
  const { type, details } = event

  switch (type) {
    case "employee_status_changed":
      return `状态变化: ${details.oldStatus} → ${details.newStatus}`

    case "session_created":
      return (
        <>
          会话创建 (
          <SessionLink
            sessionId={String(details.sessionId)}
            projectPath={projectPath}
          />
          )
        </>
      )

    case "session_prompt_started":
      return (
        <>
          AI请求开始 (会话:{" "}
          <SessionLink
            sessionId={String(details.sessionId)}
            projectPath={projectPath}
          />
          , 事件: {String(details.eventType)})
        </>
      )

    case "session_prompt_completed":
      return (
        <>
          AI响应完成 (会话:{" "}
          <SessionLink
            sessionId={String(details.sessionId)}
            projectPath={projectPath}
          />
          )
        </>
      )

    case "session_summary_started":
      return (
        <>
          开始总结会话 (
          <SessionLink
            sessionId={String(details.sessionId)}
            projectPath={projectPath}
          />
          )
        </>
      )

    case "session_summary_completed":
      return `会话总结完成 (${details.messageCount} 条消息, ${details.tokenCount} tokens)`

    case "agent_created":
      return `Agent 创建: ${details.taskName}`

    case "agent_completed":
      return `Agent 完成: ${details.taskName}`

    case "task_created":
      return `任务创建: ${details.taskName}`

    case "task_modified":
      return `任务修改: ${details.taskName}`

    case "task_completed":
      return `任务完成: ${details.taskName}`

    case "task_failed":
      return `任务失败: ${details.taskName}`

    case "agent_failed":
      return `Agent 失败: ${details.taskName}`

    case "employee_hired":
      return `雇佣员工: ${details.employeeName} (${details.role})`

    case "message":
    case "message_sent":
    case "message_received":
      return `消息: ${details.from} → ${details.to}`

    case "timer":
      return `定时器触发 (间隔: ${details.interval}ms)`

    case "task_updated":
      return `任务更新: ${details.taskName}`

    case "agent_updated":
      return `Agent 更新: ${details.agentId}`

    default:
      return JSON.stringify(details)
  }
}

export function EventItem({ event, projectPath }: EventItemProps) {
  const icon = EVENT_ICONS[event.type] || "📌"
  const description = getEventDescription(event, projectPath)
  const timestamp = new Date(event.timestamp).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        padding: "8px 0",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          fontSize: "12px",
          color: "#999",
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            fontSize: "0.7rem",
          }}
        >
          {timestamp}
        </Typography>
        <span style={{ fontSize: "14px" }}>{icon}</span>
        <Typography
          variant="caption"
          sx={{
            color: "inherit",
            fontWeight: 400,
          }}
        >
          {description}
        </Typography>
      </Box>
    </Box>
  )
}
