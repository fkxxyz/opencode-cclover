import { Box, Typography } from "@mui/material"
import type { Event, EventType } from "../../types"
import { SessionLink } from "../ui/SessionLink"

interface EventItemProps {
  event: Event
  projectPath: string
}

// 事件图标映射
const EVENT_ICONS: Partial<Record<EventType, string>> = {
  employee_updated: "🔄",
  employee_work_session_created: "⚡",
  employee_work_session_status_changed: "🔄",
  employee_work_session_closed: "⏹️",
  session_created: "⚡",
  session_prompt_started: "🤔",
  session_prompt_completed: "💡",
  session_summary_started: "📝",
  session_summary_completed: "📊",
  summary_parse_failed: "⚠️",
  task_created: "📋",
  task_modified: "✏️",
  task_completed: "✅",
  task_cancelled: "🚫",
  task_deleted: "🗑️",
  task_decomposed: "🔀",
  task_waiting_for_message: "🚧",
  task_available: "🔔",
  task_reminder: "⏰",
  message: "💬",
  timer: "⏰",
  employee_hired: "👤",
  reply_attempted: "⚠️",
  reply_reminder: "🔔",
  feedback_received: "💬",
}

// 生成事件描述
function getEventDescription(
  event: Event,
  projectPath: string
): React.ReactNode {
  const { type, details } = event

  switch (type) {
    case "employee_updated":
      return `员工更新: ${event.employeeId}`

    case "employee_work_session_created":
      return `工作会话创建: ${event.employeeWorkSessionId}`

    case "employee_work_session_status_changed":
      return `状态变化: ${details.oldStatus} → ${details.newStatus}`

    case "employee_work_session_closed":
      return `工作会话关闭: ${event.employeeWorkSessionId}`

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

    case "task_created":
      return `任务创建: ${details.taskName}`

    case "task_modified":
      return `任务修改: ${details.taskName}`

    case "task_completed":
      return `任务完成: ${details.taskName}`

    case "task_cancelled":
      return `任务取消: ${details.taskName}`

    case "task_deleted":
      return `任务删除: ${details.taskName}${details.affectedCount ? ` (清理了 ${details.affectedCount} 个任务的依赖)` : ""}`

    case "task_decomposed":
      return `任务分解: ${details.originalTask} → ${details.subtaskCount} 个子任务`

    case "task_waiting_for_message":
      return `任务等待消息: ${details.taskName} - ${details.reason || "waiting for message"}`

    case "employee_hired":
      return `雇佣员工: ${event.employeeId} (${details.roleId})`

    case "message":
      return `消息: ${details.from} → ${details.to}`

    case "timer":
      return `定时器触发 (间隔: ${details.interval}ms)`

    case "reply_attempted":
      return `回复错误: ${details.from} 应回复 ${details.to}，但尝试发送给 ${details.attemptedRecipient}`

    case "reply_reminder":
      return `回复提醒: ${event.employeeId} 需要回复 ${details.peer}`

    case "task_available":
      return `任务可执行: ${details.taskName || (Array.isArray(details.tasks) ? details.tasks.join(", ") : "")}`

    case "task_reminder":
      return `任务提醒: ${details.taskName || (Array.isArray(details.tasks) ? details.tasks.join(", ") : "")}`

    case "summary_parse_failed":
      return `会话总结解析失败 (会话: ${details.sessionId})`

    case "feedback_received":
      return `反馈已收到 (接收时间: ${new Date(String(details.receivedAt)).toLocaleString("zh-CN")})`

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
