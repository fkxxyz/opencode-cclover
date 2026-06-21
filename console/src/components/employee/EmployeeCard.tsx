import { Badge } from "../ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import type { Employee, EmployeeStatus } from "../../types/index"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

interface EmployeeCardProps {
  employee: Employee
  onClick?: () => void
}

const statusColors: Record<EmployeeStatus, { bg: string; text: string }> = {
  busy: { bg: "#10b981", text: "#ffffff" },
  idle: { bg: "#eab308", text: "#ffffff" },
  error: { bg: "#ef4444", text: "#ffffff" },
  offline: { bg: "#6b7280", text: "#ffffff" },
  abnormal: { bg: "#f97316", text: "#ffffff" },
}

const statusLabels: Record<EmployeeStatus, string> = {
  busy: "忙碌",
  idle: "空闲",
  error: "错误",
  offline: "离线",
  abnormal: "异常",
}

export function EmployeeCard({ employee, onClick }: EmployeeCardProps) {
  return (
    <Card
      style={{
        cursor: "pointer",
        transition: "box-shadow 0.2s",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 4px 6px -1px rgb(0 0 0 / 0.1)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = ""
      }}
    >
      <CardHeader style={{ paddingBottom: "12px" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <CardTitle style={{ fontSize: "1.125rem" }}>
            {employee.name}
          </CardTitle>
          {/* Boss 不显示状态 */}
          {employee.roleId !== "Boss" && (
            <Badge
              style={{
                backgroundColor: statusColors[employee.status]?.bg ?? "#f1f5f9",
                color: statusColors[employee.status]?.text ?? "#475569",
              }}
            >
              {statusLabels[employee.status] ?? "未知"}
            </Badge>
          )}
        </Box>
      </CardHeader>
      <CardContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            <Box component="span" fontWeight="medium">
              员工 ID:
            </Box>{" "}
            {employee.employeeId}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <Box component="span" fontWeight="medium">
              姓名:
            </Box>{" "}
            {employee.name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <Box component="span" fontWeight="medium">
              角色 ID:
            </Box>{" "}
            {employee.roleId}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <Box component="span" fontWeight="medium">
              角色手册:
            </Box>{" "}
            {employee.handbookPath || "未设置"}
          </Typography>
          {employee.hiredBy && (
            <Typography variant="body2" color="text.secondary">
              <Box component="span" fontWeight="medium">
                雇佣者:
              </Box>{" "}
              {employee.hiredBy}
            </Typography>
          )}
          {!employee.hiredBy && (
            <Typography variant="body2" color="text.secondary">
              <Box component="span" fontWeight="medium">
                雇佣者:
              </Box>{" "}
              无
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            创建时间: {new Date(employee.createdAt).toLocaleString("zh-CN")}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            最后活跃: {new Date(employee.lastActiveAt).toLocaleString("zh-CN")}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}
