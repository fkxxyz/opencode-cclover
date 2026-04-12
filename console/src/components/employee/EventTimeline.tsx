import { useState, useEffect } from "react"
import { Box, Typography } from "@mui/material"
import { useEvents } from "../../hooks/useEvents"
import { Badge } from "../ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import type { EventType, Project } from "../../types/index"
import { SessionLink } from "../ui/SessionLink"
import { apiClient } from "../../services"

interface EventTimelineProps {
  projectId: string
  employeeId: string
}

const eventTypeColors: Partial<
  Record<EventType, { backgroundColor: string; color: string }>
> = {
  message: { backgroundColor: "#dbeafe", color: "#1e40af" },
  task_completed: { backgroundColor: "#dcfce7", color: "#166534" },
  task_cancelled: { backgroundColor: "#fef3c7", color: "#92400e" },
  task_deleted: { backgroundColor: "#fee2e2", color: "#991b1b" },
  task_decomposed: { backgroundColor: "#e0e7ff", color: "#4338ca" },
  task_created: { backgroundColor: "#e0f2fe", color: "#075985" },
  task_modified: { backgroundColor: "#fef3c7", color: "#92400e" },
  task_waiting_for_message: { backgroundColor: "#fed7aa", color: "#9a3412" },
  agent_completed: { backgroundColor: "#f3e8ff", color: "#6b21a8" },
  agent_failed: { backgroundColor: "#fee2e2", color: "#991b1b" },
  agent_created: { backgroundColor: "#ede9fe", color: "#5b21b6" },
  timer: { backgroundColor: "#f3f4f6", color: "#1f2937" },
  employee_hired: { backgroundColor: "#fef3c7", color: "#92400e" },
  employee_status_changed: { backgroundColor: "#fed7aa", color: "#9a3412" },
  session_created: { backgroundColor: "#ddd6fe", color: "#5b21b6" },
  session_prompt_started: { backgroundColor: "#e0e7ff", color: "#4338ca" },
  session_prompt_completed: { backgroundColor: "#ddd6fe", color: "#4338ca" },
  session_summary_started: { backgroundColor: "#fef3c7", color: "#92400e" },
  session_summary_completed: { backgroundColor: "#e0e7ff", color: "#3730a3" },
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
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function getEventDescription(
  type: EventType,
  details: Record<string, unknown>,
  projectPath: string
): React.ReactNode {
  switch (type) {
    case "message":
      return `${details.from} → ${details.to}: ${details.content}`
    case "task_completed":
      return `任务 "${details.taskName}" 已完成`
    case "task_cancelled":
      return `任务 "${details.taskName}" 已取消: ${details.reason || "用户取消"}`
    case "task_deleted":
      return `任务 "${details.taskName}" 已删除${details.affectedCount ? ` (清理了 ${details.affectedCount} 个任务的依赖)` : ""}`
    case "task_decomposed":
      return `任务 "${details.originalTask}" 分解为 ${details.subtaskCount} 个子任务`
    case "task_waiting_for_message":
      return `任务 "${details.taskName}" 等待消息: ${details.reason || "waiting for message"}`
    case "agent_completed":
      return `Agent ${details.agentId} 完成任务 "${details.taskName}"`
    case "agent_failed":
      return `Agent ${details.agentId} 失败: ${details.error}`
    case "employee_hired":
      // 向后兼容：优先使用 employeeId，回退到 employeeName
      return `雇佣了 ${details.employeeId || details.employeeName} (${details.role})`
    case "employee_status_changed":
      return `状态变化: ${details.oldStatus} → ${details.newStatus}`
    case "timer":
      return `定时器触发 (间隔: ${details.interval}ms)`
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
    default:
      return JSON.stringify(details)
  }
}

export function EventTimeline({ projectId, employeeId }: EventTimelineProps) {
  const { events, loading } = useEvents(projectId, { employeeId })
  const [filterType, setFilterType] = useState<EventType | "all">("all")
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

  const filteredEvents =
    filterType === "all"
      ? events
      : events.filter((event) => event.type === filterType)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>事件时间线</CardTitle>
        </CardHeader>
        <CardContent>
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              加载中...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <CardTitle>事件时间线</CardTitle>
          <Select
            value={filterType}
            onValueChange={(value: string) =>
              setFilterType(value as EventType | "all")
            }
          >
            <SelectTrigger sx={{ width: "180px" }}>
              <SelectValue placeholder="筛选事件类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部事件</SelectItem>
              {Object.entries(eventTypeLabels).map(([type, label]) => (
                <SelectItem key={type} value={type}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Box>
      </CardHeader>
      <CardContent>
        {filteredEvents.length === 0 ? (
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              暂无事件
            </Typography>
          </Box>
        ) : (
          <Box sx={{ position: "relative" }}>
            {/* 时间线竖线 */}
            <Box
              sx={{
                position: "absolute",
                left: "1rem",
                top: 0,
                bottom: 0,
                width: "2px",
                bgcolor: "divider",
              }}
            />

            {/* 事件列表 */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {filteredEvents.map((event, index) => {
                // 使用 timestamp + type + index 作为唯一 key
                const uniqueKey = `${event.timestamp}-${event.type}-${index}`
                return (
                  <Box
                    key={uniqueKey}
                    sx={{ position: "relative", pl: "2.5rem" }}
                  >
                    {/* 时间线圆点 */}
                    <Box
                      sx={{
                        position: "absolute",
                        left: "0.625rem",
                        top: "0.5rem",
                        height: "0.75rem",
                        width: "0.75rem",
                        borderRadius: "50%",
                        bgcolor: "background.paper",
                        border: "2px solid",
                        borderColor: "#3b82f6",
                      }}
                    />

                    {/* 事件内容 */}
                    <Box
                      sx={{
                        bgcolor: "background.paper",
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        p: 1.5,
                        transition: "box-shadow 0.2s",
                        "&:hover": {
                          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <Badge style={eventTypeColors[event.type]}>
                          {eventTypeLabels[event.type]}
                        </Badge>
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
                            project.directory
                          )}
                      </Typography>
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
