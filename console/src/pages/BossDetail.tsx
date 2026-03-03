import { useEffect, useState } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import { apiClient } from "../services"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { EmployeeCard } from "../components/employee/EmployeeCard"
import { ConversationView } from "../components/employee/ConversationView"
import { TaskList } from "../components/employee/TaskList"
import { TaskDAG } from "../components/visualizations/TaskDAG"
import { MemoryView } from "../components/employee/MemoryView"
import { AgentList } from "../components/employee/AgentList"
import { EventTimeline } from "../components/employee/EventTimeline"
import type { EmployeeDetail as EmployeeDetailType } from "../types"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export function BossDetail() {
  const { projectId, name } = useParams<{ projectId: string; name: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [boss, setBoss] = useState<EmployeeDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // 从 URL 读取当前标签页，默认为 messages
  const currentTab = searchParams.get("tab") || "messages"
  // 从 URL 读取当前聊天对象
  const currentPeer = searchParams.get("peer") || null

  useEffect(() => {
    if (!name || !projectId) return
    setLoading(true)
    // 复用员工详情 API
    apiClient
      .getEmployeeDetail(projectId, name)
      .then(setBoss)
      .catch((err: Error) => {
        console.error("获取 boss 详情失败:", err)
        setError(err)
      })
      .finally(() => setLoading(false))
  }, [name, projectId])

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

  if (error || !boss) {
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
                {error?.message || "Boss 不存在"}
              </Typography>
              <Button onClick={() => navigate(`/projects/${projectId}`)}>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <Typography variant="h3" fontWeight="bold">
            {boss.name} (Boss)
          </Typography>
        </Box>
        <EmployeeCard employee={boss} />
        <Tabs
          value={currentTab}
          onValueChange={(value) => {
            // 更新 URL query params，保留其他参数
            const newParams = new URLSearchParams(searchParams)
            newParams.set("tab", value)
            setSearchParams(newParams)
          }}
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
            <ConversationView
              projectId={projectId!}
              employeeName={boss.name}
              selectedPeer={currentPeer}
              onPeerChange={(peer) => {
                // 更新 URL query params
                const newParams = new URLSearchParams(searchParams)
                if (peer) {
                  newParams.set("tab", "messages") // 确保在 messages 标签页
                  newParams.set("peer", peer)
                } else {
                  newParams.delete("peer")
                }
                setSearchParams(newParams)
              }}
            />
          </TabsContent>
          <TabsContent
            value="tasks"
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <TaskList projectId={projectId!} employeeName={boss.name} />
            <Card>
              <CardContent sx={{ pt: 3 }}>
                <Box sx={{ height: 600 }}>
                  <TaskDAG tasks={boss.tasks} executableTasks={[]} />
                </Box>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent
            value="memory"
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <MemoryView memory={boss.memory} />
          </TabsContent>
          <TabsContent
            value="agents"
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <AgentList agents={boss.agents} />
          </TabsContent>
          <TabsContent
            value="events"
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <EventTimeline
          projectId={projectId!}
              employeeName={boss.name}
            />
          </TabsContent>
        </Tabs>
      </Box>
    </Box>
  )
}
