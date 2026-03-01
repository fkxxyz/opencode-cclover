import { useMessages } from "../../hooks/useMessages"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { cn } from "../../lib/utils"

interface MessageListProps {
  employeeName: string
  peer?: string
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

export function MessageList({ employeeName, peer }: MessageListProps) {
  const { messages, loading } = useMessages(employeeName, peer)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>消息列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    )
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>消息列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">暂无消息</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          消息列表{" "}
          {peer && (
            <span className="text-sm font-normal text-muted-foreground">
              与 {peer}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {messages.map((message, index) => {
            const isSent = message.direction === "send"
            return (
              <div
                key={`${message.timestamp}-${index}`}
                className={cn("flex", isSent ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-lg p-3",
                    isSent
                      ? "bg-blue-500 text-white"
                      : "bg-secondary text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">
                      {isSent ? message.from : message.from}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        isSent ? "text-blue-100" : "text-muted-foreground"
                      )}
                    >
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
