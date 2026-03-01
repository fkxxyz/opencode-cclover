import { Users, Activity, CheckSquare, MessageSquare } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { useStats } from "../../hooks/useStats"

export function GlobalStats() {
  const { stats, loading } = useStats()

  const statCards = [
    {
      title: "员工总数",
      value: stats.totalEmployees,
      icon: Users,
      color: "text-blue-600",
    },
    {
      title: "活跃员工",
      value: stats.activeEmployees,
      icon: Activity,
      color: "text-green-600",
    },
    {
      title: "待处理任务",
      value: stats.pendingTasks,
      icon: CheckSquare,
      color: "text-orange-600",
    },
    {
      title: "今日消息",
      value: stats.todayMessages,
      icon: MessageSquare,
      color: "text-purple-600",
    },
  ]

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">加载中...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">--</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
