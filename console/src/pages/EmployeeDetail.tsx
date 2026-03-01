import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import { apiClient } from "../services"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { EmployeeCard } from "../components/employee/EmployeeCard"
import { MessageList } from "../components/employee/MessageList"
import { TaskList } from "../components/employee/TaskList"
import { TaskDAG } from "../components/visualizations/TaskDAG"
import { MemoryView } from "../components/employee/MemoryView"
import { AgentList } from "../components/employee/AgentList"
import { EventTimeline } from "../components/employee/EventTimeline"
import type { EmployeeDetail as EmployeeDetailType } from "../types"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export function EmployeeDetail() {
  const { name } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<EmployeeDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!name) return

    setLoading(true)
    apiClient
      .getEmployeeDetail(name)
      .then(setEmployee)
      .catch((err: Error) => {
        console.error("获取员工详情失败:", err)
        setError(err)
      })
      .finally(() => setLoading(false))
  }, [name])

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Loader2 className="h-6 w-6 animate-spin" />
          <Typography color="text.secondary">加载中...</Typography>
        </Box>
      </Box>
    )
  }

  if (error || !employee) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Card sx={{ maxWidth: "md" }}>
          <CardContent sx={{ pt: 3 }}>
            <Box
              sx={{
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <Typography color="error">
                {error?.message || "员工不存在"}
              </Typography>
              <Button onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回总览
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <Box
        sx={{
          maxWidth: "lg",
          mx: "auto",
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <Typography variant="h3" fontWeight="bold">
            {employee.name}
          </Typography>
        </Box>
        <EmployeeCard employee={employee} />
        <Tabs
          defaultValue="messages"
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          <TabsList
            sx={{
              display: "grid",
              width: "100%",
              gridTemplateColumns: "repeat(5, 1fr)",
            }}
          >
            <TabsTrigger value="messages">消息通信</TabsTrigger>
            <TabsTrigger value="tasks">任务管理</TabsTrigger>
            <TabsTrigger value="memory">记忆系统</TabsTrigger>
            <TabsTrigger value="agents">Agent执行</TabsTrigger>
            <TabsTrigger value="events">事件历史</TabsTrigger>
          </TabsList>
          <TabsContent
            value="messages"
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <MessageList employeeName={employee.name} />
          </TabsContent>
          <TabsContent
            value="tasks"
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <TaskList employeeName={employee.name} />
            <Card>
              <CardContent sx={{ pt: 3 }}>
                <Box sx={{ height: 600 }}>
                  <TaskDAG tasks={employee.tasks} executableTasks={[]} />
                </Box>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent
            value="memory"
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <MemoryView memory={employee.memory} />
          </TabsContent>
          <TabsContent
            value="agents"
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <AgentList agents={employee.agents} />
          </TabsContent>
          <TabsContent
            value="events"
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <EventTimeline employeeName={employee.name} />
          </TabsContent>
        </Tabs>
      </Box>
    </Box>
  )
}
