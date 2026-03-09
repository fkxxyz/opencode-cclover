import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, MessageSquare } from "lucide-react"
import { apiClient } from "../services"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { EmployeeCard } from "../components/employee/EmployeeCard"
import type { EmployeeDetail as EmployeeDetailType } from "../types"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export function BossProfile() {
  const { projectId, name } = useParams<{ projectId: string; name: string }>()
  const navigate = useNavigate()
  const [boss, setBoss] = useState<EmployeeDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!name || !projectId) return
    setLoading(true)
    apiClient
      .getBossDetail(projectId, name)
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
            onClick={() => navigate(`/projects/${projectId}/boss/${name}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回消息
          </Button>
          <Typography variant="h3" fontWeight="bold">
            {boss.name} (Boss) - 资料
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="default"
            size="sm"
            onClick={() => navigate(`/projects/${projectId}/boss/${name}`)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            消息
          </Button>
        </Box>
        <EmployeeCard employee={boss} />
      </Box>
    </Box>
  )
}
