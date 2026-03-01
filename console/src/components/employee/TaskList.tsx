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
import { cn } from "../../lib/utils"

interface TaskListProps {
  employeeName: string
}

const statusColors: Record<TaskStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-secondary text-gray-800",
}

const statusLabels: Record<TaskStatus, string> = {
  pending: "待处理",
  in_progress: "进行中",
  completed: "已完成",
  cancelled: "已取消",
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

export function TaskList({ employeeName }: TaskListProps) {
  const { tasks, executableTasks, loading } = useTasks(employeeName)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>任务列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">加载中...</div>
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
          <div className="text-center text-muted-foreground">暂无任务</div>
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
                  className={cn(
                    isExecutable && task.status === "pending" && "bg-green-50"
                  )}
                >
                  <TableCell className="font-medium">
                    {task.name}
                    {isExecutable && task.status === "pending" && (
                      <Badge className="ml-2 bg-green-100 text-green-800">
                        可执行
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[task.status]}>
                      {statusLabels[task.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {task.description}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTimestamp(task.created)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {task.completed ? formatTimestamp(task.completed) : "-"}
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
