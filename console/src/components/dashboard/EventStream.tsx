import { useEvents } from "../../hooks/useEvents"
import { Badge } from "../ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import type { EventType } from "../../types/index"

const eventTypeColors: Record<EventType, string> = {
  message: "bg-blue-100 text-blue-800",
  task_completed: "bg-green-100 text-green-800",
  task_failed: "bg-red-100 text-red-800",
  agent_completed: "bg-purple-100 text-purple-800",
  agent_failed: "bg-red-100 text-red-800",
  timer: "bg-secondary text-secondary-foreground",
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
    case "agent_completed":
      return `Agent ${details.agentId} 完成任务 "${details.taskName}"`
    case "agent_failed":
      return `Agent ${details.agentId} 失败: ${details.error}`
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

export function EventStream() {
  const { events, loading } = useEvents({ limit: 50 })

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>实时事件流</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">加载中...</div>
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
          <div className="text-center text-muted-foreground">暂无事件</div>
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
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {events.map((event, index) => (
            <div
              key={`${event.timestamp}-${index}`}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex-shrink-0 pt-1">
                <Badge className={eventTypeColors[event.type]}>
                  {eventTypeLabels[event.type]}
                </Badge>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {event.employeeName && (
                    <span className="text-sm font-medium">
                      {event.employeeName}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground break-words">
                  {getEventDescription(
                    event.type,
                    event.details,
                    event.employeeName
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
