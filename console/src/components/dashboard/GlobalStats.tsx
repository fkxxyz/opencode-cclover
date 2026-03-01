import { Box, Typography } from "@mui/material"
import { Users, Activity, CheckSquare, MessageSquare } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useStats } from "../../hooks/useStats"
interface GlobalStatsProps {
  projectId: string
}
export function GlobalStats({ projectId }: GlobalStatsProps) {
  const { stats, loading } = useStats(projectId)
  const statCards = [
    {
      title: "员工总数",
      value: stats.totalEmployees,
      icon: Users,
      color: "#2563eb",
    },
    {
      title: "活跃员工",
      value: stats.activeEmployees,
      icon: Activity,
      color: "#16a34a",
    },
    {
      title: "待处理任务",
      value: stats.pendingTasks,
      icon: CheckSquare,
      color: "#ea580c",
    },
    {
      title: "今日消息",
      value: stats.todayMessages,
      icon: MessageSquare,
      color: "#9333ea",
    },
  ]
  if (loading) {
    return (
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, 1fr)",
            lg: "repeat(4, 1fr)",
          },
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  加载中...
                </Typography>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                --
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    )
  }
  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: {
          xs: "1fr",
          md: "repeat(2, 1fr)",
          lg: "repeat(4, 1fr)",
        },
      }}
    >
      {statCards.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardHeader>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <CardTitle>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {stat.title}
                  </Typography>
                </CardTitle>
                <Icon className="h-4 w-4" style={{ color: stat.color }} />
              </Box>
            </CardHeader>
            <CardContent>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {stat.value}
              </Typography>
            </CardContent>
          </Card>
        )
      })}
    </Box>
  )
}
