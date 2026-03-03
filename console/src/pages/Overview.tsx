import { useParams } from "react-router-dom"
import { GlobalStats } from "../components/dashboard/GlobalStats"
import { EventStream } from "../components/dashboard/EventStream"
import { EmployeeTreeList } from "../components/visualizations/EmployeeTreeList"
import { BossList } from "../components/dashboard/BossList"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Loader2 } from "lucide-react"
import { apiClient } from "../services"
import { useEffect, useState } from "react"
import type { EmployeeHierarchy } from "../types"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export function Overview() {
  const { projectId } = useParams<{ projectId: string }>()
  const [hierarchy, setHierarchy] = useState<EmployeeHierarchy | null>(null)
  const [hierarchyLoading, setHierarchyLoading] = useState(true)
  useEffect(() => {
    if (!projectId) {
      setHierarchyLoading(false)
      return
    }
    setHierarchyLoading(true)
    apiClient
      .getHierarchy(projectId)
      .then(setHierarchy)
      .catch((err: Error) => {
        console.error("获取雇佣关系失败:", err)
      })
      .finally(() => setHierarchyLoading(false))
  }, [projectId])

  if (hierarchyLoading) {
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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h3" fontWeight="bold">
            CClover 管理控制台
          </Typography>
          <Typography variant="body2" color="text.secondary"></Typography>
        </Box>
        <GlobalStats projectId={projectId!} />
        {/* Boss 列表 */}
        <Card>
          <CardHeader>
            <CardTitle>Boss 列表</CardTitle>
          </CardHeader>
          <CardContent>
            <BossList />
          </CardContent>
        </Card>
        {/* 员工列表 */}
        {hierarchy && (
          <Card>
            <CardHeader>
              <CardTitle>员工列表</CardTitle>
            </CardHeader>
            <CardContent>
              <EmployeeTreeList hierarchy={hierarchy} />
            </CardContent>
          </Card>
        )}
        <EventStream projectId={projectId!} />
      </Box>
    </Box>
  )
}
