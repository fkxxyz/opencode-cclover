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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-red-600">
                {error?.message || "员工不存在"}
              </p>
              <Button onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回总览
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">
            {employee.name}
          </h1>
        </div>

        <EmployeeCard employee={employee} />

        <Tabs defaultValue="messages" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="messages">消息通信</TabsTrigger>
            <TabsTrigger value="tasks">任务管理</TabsTrigger>
            <TabsTrigger value="memory">记忆系统</TabsTrigger>
            <TabsTrigger value="agents">Agent执行</TabsTrigger>
            <TabsTrigger value="events">事件历史</TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="space-y-4">
            <MessageList employeeName={employee.name} />
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <TaskList employeeName={employee.name} />
            <Card>
              <CardContent className="pt-6">
                <div className="h-[600px]">
                  <TaskDAG
                    tasks={employee.tasks}
                    executableTasks={[]}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="memory" className="space-y-4">
            <MemoryView memory={employee.memory} />
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            <AgentList agents={employee.agents} />
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <EventTimeline employeeName={employee.name} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
