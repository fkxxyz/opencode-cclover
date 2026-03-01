import { Box, Typography } from "@mui/material"
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

const statusColors: Record<
  AgentStatus,
  { backgroundColor: string; color: string }
> = {
  running: { backgroundColor: "#dbeafe", color: "#1e40af" },
  completed: { backgroundColor: "#dcfce7", color: "#166534" },
  failed: { backgroundColor: "#fee2e2", color: "#991b1b" },
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
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              暂无 Agent 执行记录
            </Typography>
          </Box>
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
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{ fontFamily: "monospace", fontSize: "0.875rem" }}
                  >
                    {agent.agentId}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {agent.taskName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    {agent.status === "running" && (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    <Badge style={statusColors[agent.status]}>
                      {statusLabels[agent.status]}
                    </Badge>
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {formatTimestamp(agent.createdAt)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {agent.completedAt
                      ? formatTimestamp(agent.completedAt)
                      : "-"}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{
                      maxWidth: "28rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {agent.result || "-"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
