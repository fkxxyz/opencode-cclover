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
  active: { bg: "#dcfce7", text: "#166534" },
  idle: { bg: "#fef3c7", text: "#92400e" },
  error: { bg: "#fee2e2", text: "#991b1b" },
  inactive: { bg: "#f1f5f9", text: "#475569" },
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
          {employee.role !== "Boss" && (
            <Badge
              style={{
                backgroundColor: statusColors[employee.status].bg,
                color: statusColors[employee.status].text,
              }}
            >
              {statusLabels[employee.status]}
            </Badge>
          )}
        </Box>
      </CardHeader>
      <CardContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            <Box component="span" fontWeight="medium">
              角色:
            </Box>{" "}
            {employee.role}
          </Typography>
          {employee.hiredBy && (
            <Typography variant="body2" color="text.secondary">
              <Box component="span" fontWeight="medium">
                雇佣者:
              </Box>{" "}
              {employee.hiredBy}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            最后活跃: {new Date(employee.lastActiveAt).toLocaleString("zh-CN")}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}
