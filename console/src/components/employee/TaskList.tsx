import { useTasks } from "../../hooks/useTasks"
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
import type { TaskStatus } from "../../types/index"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"

interface TaskListProps {
  projectId: string
  employeeId: string
}

const statusVariants: Record<
  TaskStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  in_progress: "default",
  completed: "secondary",
  cancelled: "destructive",
  waiting_for_message: "outline",
}

const statusLabels: Record<TaskStatus, string> = {
  pending: "待处理",
  in_progress: "进行中",
  completed: "已完成",
  cancelled: "已取消",
  waiting_for_message: "等待消息",
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

export function TaskList({ projectId, employeeId }: TaskListProps) {
  const { tasks, executableTasks, loading } = useTasks(projectId, employeeId)
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }
  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Typography align="center" color="text.secondary">
            暂无任务
          </Typography>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>任务列表</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>任务名称</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>描述</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>完成时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => {
              const isExecutable = executableTasks.includes(task.name)
              return (
                <TableRow
                  key={task.name}
                  sx={{
                    ...(isExecutable &&
                      task.status === "pending" && {
                        bgcolor: "success.light",
                      }),
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography fontWeight="medium">{task.name}</Typography>
                      {isExecutable && task.status === "pending" && (
                        <Badge variant="secondary">可执行</Badge>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariants[task.status]}>
                      {statusLabels[task.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Typography noWrap sx={{ maxWidth: 400 }}>
                      {task.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatTimestamp(task.created)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {task.completed ? formatTimestamp(task.completed) : "-"}
                    </Typography>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
