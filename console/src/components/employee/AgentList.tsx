import { Loader2 } from "lucide-react"
import { Badge } from "../ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table"
import type { AgentExecution, AgentStatus } from "../../types/index"

interface AgentListProps {
  agents: AgentExecution[]
}

const statusColors: Record<AgentStatus, string> = {
  running: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
}

const statusLabels: Record<AgentStatus, string> = {
  running: "运行中",
  completed: "已完成",
  failed: "失败",
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

export function AgentList({ agents }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent 执行记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            暂无 Agent 执行记录
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent 执行记录</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent ID</TableHead>
              <TableHead>任务名称</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>完成时间</TableHead>
              <TableHead>结果</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.agentId}>
                <TableCell className="font-mono text-sm">
                  {agent.agentId}
                </TableCell>
                <TableCell className="font-medium">{agent.taskName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {agent.status === "running" && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    <Badge className={statusColors[agent.status]}>
                      {statusLabels[agent.status]}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatTimestamp(agent.createdAt)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {agent.completedAt ? formatTimestamp(agent.completedAt) : "-"}
                </TableCell>
                <TableCell className="max-w-md truncate text-sm">
                  {agent.result || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
