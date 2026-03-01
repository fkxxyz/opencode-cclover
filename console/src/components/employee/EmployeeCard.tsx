import { Badge } from "../ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import type { Employee, EmployeeStatus } from "../../types/index"

interface EmployeeCardProps {
  employee: Employee
  onClick?: () => void
}

const statusColors: Record<EmployeeStatus, string> = {
  active: "bg-green-100 text-green-800",
  idle: "bg-yellow-100 text-yellow-800",
  error: "bg-red-100 text-red-800",
  inactive: "bg-secondary text-secondary-foreground",
}

const statusLabels: Record<EmployeeStatus, string> = {
  active: "活跃",
  idle: "空闲",
  error: "错误",
  inactive: "未启动",
}

export function EmployeeCard({ employee, onClick }: EmployeeCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{employee.name}</CardTitle>
          <Badge className={statusColors[employee.status]}>
            {statusLabels[employee.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">角色:</span> {employee.role}
          </p>
          {employee.hiredBy && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">雇佣者:</span> {employee.hiredBy}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            最后活跃: {new Date(employee.lastActiveAt).toLocaleString("zh-CN")}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
