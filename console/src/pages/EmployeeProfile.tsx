import { useEffect, useState } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Loader2, MessageSquare } from "lucide-react"
import { apiClient } from "../services"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Badge } from "../components/ui/badge"
import { EmployeeCard } from "../components/employee/EmployeeCard"
import { TaskList } from "../components/employee/TaskList"
import { TaskDAG } from "../components/visualizations/TaskDAG"
import { MemoryView } from "../components/employee/MemoryView"
import { AgentList } from "../components/employee/AgentList"
import { EventTimeline } from "../components/employee/EventTimeline"
import type { EmployeeDetail as EmployeeDetailType, Role } from "../types"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export function EmployeeProfile() {
  const { projectId, name } = useParams<{ projectId: string; name: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [employee, setEmployee] = useState<EmployeeDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)
  const [roleError, setRoleError] = useState<Error | null>(null)

  // 从 URL 读取当前标签页，默认为 tasks
  const currentTab = searchParams.get("tab") || "tasks"

  useEffect(() => {
    if (!name || !projectId) return
    setLoading(true)
    apiClient
      .getEmployeeDetail(projectId, name)
      .then(setEmployee)
      .catch((err: Error) => {
        console.error("获取员工详情失败:", err)
        setError(err)
      })
      .finally(() => setLoading(false))
  }, [name, projectId])

  useEffect(() => {
    if (!name || !projectId) return
    setRoleLoading(true)
    apiClient
      .getEmployeeRole(projectId, name)
      .then(setRole)
      .catch((err: Error) => {
        console.error("获取角色信息失败:", err)
        setRoleError(err)
      })
      .finally(() => setRoleLoading(false))
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/projects/${projectId}/employee/${name}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回消息
          </Button>
          <Typography variant="h3" fontWeight="bold">
            {employee.name} - 资料
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate(`/projects/${projectId}/employee/${name}`)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            消息
          </Button>
        </Box>
        <EmployeeCard employee={employee} />
        {/* 角色信息卡片 */}
        <Card>
          <CardContent sx={{ pt: 3 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              角色信息
            </Typography>
            {roleLoading && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <Typography color="text.secondary">加载角色信息...</Typography>
              </Box>
            )}
            {roleError && (
              <Typography color="error">
                加载角色信息失败: {roleError.message}
              </Typography>
            )}
            {role && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                  >
                    角色名称
                  </Typography>
                  <Typography variant="body1">{role.name}</Typography>
                </Box>
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                  >
                    描述
                  </Typography>
                  <Typography variant="body1">{role.description}</Typography>
                </Box>
                {role.requiredArgs &&
                  Object.keys(role.requiredArgs).length > 0 && (
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 0.5 }}
                      >
                        必需参数
                      </Typography>
                      <Box component="ul" sx={{ m: 0, pl: 2 }}>
                        {Object.entries(role.requiredArgs).map(
                          ([key, value]) => (
                            <li key={key}>
                              <Typography variant="body2">
                                <strong>{key}</strong> ({value.type}):{" "}
                                {value.description}
                              </Typography>
                            </li>
                          )
                        )}
                      </Box>
                    </Box>
                  )}
                {role.canHire && role.canHire.length > 0 && (
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      可雇佣角色
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {role.canHire.map((pattern: string) => (
                        <Badge key={pattern} variant="secondary">
                          {pattern}
                        </Badge>
                      ))}
                    </Box>
                  </Box>
                )}
                {role.groups && role.groups.length > 0 && (
                  <Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      所属组
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {role.groups.map((group: string) => (
                        <Badge key={group} variant="outline">
                          {group}
                        </Badge>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
        <Tabs
          value={currentTab}
          onValueChange={(value) => {
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
              gridTemplateColumns: "repeat(4, 1fr)",
            }}
          >
            <TabsTrigger value="tasks">任务管理</TabsTrigger>
            <TabsTrigger value="memory">记忆系统</TabsTrigger>
            <TabsTrigger value="agents">Agent执行</TabsTrigger>
            <TabsTrigger value="events">事件历史</TabsTrigger>
          </TabsList>
          <TabsContent
            value="tasks"
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <TaskList projectId={projectId!} employeeId={employee.employeeId} />
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
            <EventTimeline
              projectId={projectId!}
              employeeId={employee.employeeId}
            />
          </TabsContent>
        </Tabs>
      </Box>
    </Box>
  )
}
