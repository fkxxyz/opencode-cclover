import { useState } from "react"
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
import type { EventType } from "../../types/index"

interface EventTimelineProps {
  employeeName: string
}

const eventTypeColors: Record<
  EventType,
  { backgroundColor: string; color: string }
> = {
  message: { backgroundColor: "#dbeafe", color: "#1e40af" },
  task_completed: { backgroundColor: "#dcfce7", color: "#166534" },
  task_failed: { backgroundColor: "#fee2e2", color: "#991b1b" },
  agent_completed: { backgroundColor: "#f3e8ff", color: "#6b21a8" },
  agent_failed: { backgroundColor: "#fee2e2", color: "#991b1b" },
  timer: { backgroundColor: "#f3f4f6", color: "#1f2937" },
  employee_hired: { backgroundColor: "#fef3c7", color: "#92400e" },
  employee_status_changed: { backgroundColor: "#fed7aa", color: "#9a3412" },
  message_sent: { backgroundColor: "#dbeafe", color: "#1e40af" },
  message_received: { backgroundColor: "#dbeafe", color: "#1e40af" },
  task_updated: { backgroundColor: "#dcfce7", color: "#166534" },
  agent_updated: { backgroundColor: "#f3e8ff", color: "#6b21a8" },
}

const eventTypeLabels: Record<EventType, string> = {
  message: "消息",
  task_completed: "任务完成",
  task_failed: "任务失败",
  agent_completed: "Agent完成",
  agent_failed: "Agent失败",
  timer: "定时器",
  employee_hired: "员工雇佣",
  employee_status_changed: "状态变化",
  message_sent: "发送消息",
  message_received: "接收消息",
  task_updated: "任务更新",
  agent_updated: "Agent更新",
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
  details: Record<string, unknown>
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
    case "agent_completed":
      return `Agent ${details.agentId} 完成任务 "${details.taskName}"`
    case "agent_failed":
      return `Agent ${details.agentId} 失败: ${details.error}`
    case "employee_hired":
      return `雇佣了 ${details.employeeName} (${details.role})`
    case "employee_status_changed":
      return `状态变化: ${details.oldStatus} → ${details.newStatus}`
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

export function EventTimeline({ employeeName }: EventTimelineProps) {
  const { events, loading } = useEvents({ employeeName })
  const [filterType, setFilterType] = useState<EventType | "all">("all")

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
              {filteredEvents.map((event, index) => (
                <Box
                  key={`${event.timestamp}-${index}`}
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
                      {getEventDescription(event.type, event.details)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
