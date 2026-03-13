import { useEffect, useState } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowLeft, Loader2, User } from "lucide-react"
import { apiClient } from "../services"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { ConversationView } from "../components/employee/ConversationView"
import type { EmployeeDetail as EmployeeDetailType } from "../types"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export function EmployeeDetail() {
  const { projectId, name } = useParams<{ projectId: string; name: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [employee, setEmployee] = useState<EmployeeDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // 从 URL 读取当前聊天对象
  const currentPeer = searchParams.get("peer") || null

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
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          maxWidth: "lg",
          mx: "auto",
          p: 3,
          display: "flex",
          alignItems: "center",
          gap: 2,
          width: "100%",
        }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/projects/${projectId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <Typography variant="h5" fontWeight="bold">
          {employee.name}
        </Typography>
        <Button
          variant="outline"
          size="sm"
          sx={{ marginLeft: "auto" }}
          onClick={() =>
            navigate(`/projects/${projectId}/employee/${name}/profile`)
          }
        >
          <User className="h-4 w-4 mr-2" />
          查看资料
        </Button>
      </Box>
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          maxWidth: "lg",
          mx: "auto",
          width: "100%",
          px: 3,
          pb: 3,
        }}
      >
        <ConversationView
          projectId={projectId!}
          employeeId={employee.employeeId}
          selectedPeer={currentPeer}
          onPeerChange={(peer) => {
            const newParams = new URLSearchParams(searchParams)
            if (peer) {
              newParams.set("peer", peer)
            } else {
              newParams.delete("peer")
            }
            setSearchParams(newParams)
          }}
        />
      </Box>
    </Box>
  )
}
