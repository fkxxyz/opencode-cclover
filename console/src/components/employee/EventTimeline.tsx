import { useState } from "react"
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

const eventTypeColors: Record<EventType, string> = {
  message: "bg-blue-100 text-blue-800",
  task_completed: "bg-green-100 text-green-800",
  task_failed: "bg-red-100 text-red-800",
  agent_completed: "bg-purple-100 text-purple-800",
  agent_failed: "bg-red-100 text-red-800",
  timer: "bg-gray-100 text-gray-800",
  employee_hired: "bg-yellow-100 text-yellow-800",
  employee_status_changed: "bg-orange-100 text-orange-800",
  message_sent: "bg-blue-100 text-blue-800",
  message_received: "bg-blue-100 text-blue-800",
  task_updated: "bg-green-100 text-green-800",
  agent_updated: "bg-purple-100 text-purple-800",
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
      return `Agent ${details.agentId} 完成任务.taskName}"`
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
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>事件时间线</CardTitle>
          <Select
            value={filterType}
            onValueChange={(value: string) =>
              setFilterType(value as EventType | "all")
            }
          >
            <SelectTrigger className="w-[180px]">
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
        </div>
      </CardHeader>
      <CardContent>
        {filteredEvents.length === 0 ? (
          <div className="text-center text-muted-foreground">暂无事件</div>
        ) : (
          <div className="relative">
            {/* 时间线竖线 */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

            {/* 事件列表 */}
            <div className="space-y-4">
              {filteredEvents.map((event, index) => (
                <div
                  key={`${event.timestamp}-${index}`}
                  className="relative pl-10"
                >
                  {/* 时间线圆点 */}
                  <div className="absolute left-2.5 top-2 h-3 w-3 rounded-full bg-white border-2 border-blue-500" />

                  {/* 事件内容 */}
                  <div className="bg-card border rounded-lg p-3 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={eventTypeColors[event.type]}>
                        {eventTypeLabels[event.type]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimestamp(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground break-words">
                      {getEventDescription(event.type, event.details)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
