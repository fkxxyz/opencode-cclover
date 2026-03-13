import { useEvents } from "../../hooks/useEvents"
import { Badge } from "../ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import type { EventType, Project } from "../../types/index"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { SessionLink } from "../ui/SessionLink"
import { apiClient } from "../../services"
import { useEffect, useState } from "react"

const eventTypeColors: Partial<
  Record<EventType, { bg: string; text: string }>
> = {
  message: { bg: "#dbeafe", text: "#1e40af" },
  task_completed: { bg: "#dcfce7", text: "#166534" },
  task_cancelled: { bg: "#fef3c7", text: "#92400e" },
  task_deleted: { bg: "#fee2e2", text: "#991b1b" },
  task_decomposed: { bg: "#e0e7ff", text: "#4338ca" },
  task_created: { bg: "#e0f2fe", text: "#075985" },
  task_modified: { bg: "#fef3c7", text: "#92400e" },
  task_waiting_for_message: { bg: "#fed7aa", text: "#9a3412" },
  agent_completed: { bg: "#f3e8ff", text: "#6b21a8" },
  agent_failed: { bg: "#fee2e2", text: "#991b1b" },
  agent_created: { bg: "#ede9fe", text: "#5b21b6" },
  timer: { bg: "#f1f5f9", text: "#475569" },
  employee_hired: { bg: "#fef3c7", text: "#92400e" },
  employee_status_changed: { bg: "#fed7aa", text: "#9a3412" },
  session_created: { bg: "#ddd6fe", text: "#5b21b6" },
  session_prompt_started: { bg: "#e0e7ff", text: "#4338ca" },
  session_prompt_completed: { bg: "#ddd6fe", text: "#4338ca" },
  session_summary_started: { bg: "#fef3c7", text: "#92400e" },
  session_summary_completed: { bg: "#e0e7ff", text: "#3730a3" },
  message_sent: { bg: "#dbeafe", text: "#1e40af" },
  message_received: { bg: "#dbeafe", text: "#1e40af" },
  task_updated: { bg: "#dcfce7", text: "#166534" },
  agent_updated: { bg: "#f3e8ff", text: "#6b21a8" },
}

const eventTypeLabels: Partial<Record<EventType, string>> = {
  message: "消息",
  task_completed: "任务完成",
  task_cancelled: "任务取消",
  task_deleted: "任务删除",
  task_decomposed: "任务分解",
  task_created: "任务创建",
  task_modified: "任务修改",
  task_waiting_for_message: "等待消息",
  agent_completed: "Agent完成",
  agent_failed: "Agent失败",
  agent_created: "Agent创建",
  timer: "定时器",
  employee_hired: "员工雇佣",
  employee_status_changed: "状态变化",
  session_created: "会话创建",
  session_prompt_started: "AI请求开始",
  session_prompt_completed: "AI响应完成",
  session_summary_started: "总结开始",
  session_summary_completed: "总结完成",
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
  projectPath: string,
  employeeName?: string
): React.ReactNode {
  switch (type) {
    case "message":
    case "message_sent":
    case "message_received":
      return `${details.from} → ${details.to}: ${details.content}`
    case "task_completed":
      return `任务 "${details.taskName}" 已完成`
    case "task_cancelled":
      return `任务 "${details.taskName}" 已取消: ${details.reason || "用户取消"}`
    case "task_deleted":
      return `任务 "${details.taskName}" 已删除${details.affectedCount ? ` (清理了 ${details.affectedCount} 个任务的依赖)` : ""}`
    case "task_decomposed":
      return `任务 "${details.originalTask}" 分解为 ${details.subtaskCount} 个子任务`
    case "task_created":
      return `创建任务 "${details.taskName}"${details.description ? `: ${details.description}` : ""}`
    case "task_modified":
      return `修改任务 "${details.taskName}"`
    case "task_waiting_for_message":
      return `任务 "${details.taskName}" 等待消息: ${details.reason || "waiting for message"}`
    case "agent_completed":
      return `Agent ${details.agentId} 完成任务 "${details.taskName}"`
    case "agent_failed":
      return `Agent ${details.agentId} 失败: ${details.error}`
    case "agent_created":
      return `创建 Agent 执行任务 "${details.taskName}"`
    case "session_created":
      return (
        <>
          创建会话 (
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
          , 消息数: {String(details.messageCount)})
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
          , {String(details.messageCount)} 条消息)
        </>
      )
    case "session_summary_completed":
      return `会话总结完成 (${details.messageCount} 条消息, ${details.tokenCount} tokens)`
    case "employee_hired":
      // 向后兼容：优先使用 employeeId，回退到 employeeName
      return `${details.hiredBy} 雇佣了 ${details.employeeId || details.employeeName} (${details.role})`
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
        <CardTitle>实时事件流 (共 {events.length} 条)</CardTitle>
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
          {events.map((event, index) => {
            // 使用 timestamp + employeeId + type + index 作为唯一 key（向后兼容：回退到 employeeName）
            const eventEmployeeId =
              event.employeeId || (event as any).employeeName
            const uniqueKey = `${event.timestamp}-${eventEmployeeId || "unknown"}-${event.type}-${index}`
            return (
              <Box
                key={uniqueKey}
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
                    {eventEmployeeId && (
                      <Typography variant="body2" fontWeight="medium">
                        {eventEmployeeId}
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
                    {project &&
                      getEventDescription(
                        event.type,
                        event.details,
                        project.directory,
                        eventEmployeeId
                      )}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      </CardContent>
    </Card>
  )
}
