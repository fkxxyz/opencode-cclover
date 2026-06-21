import { useParams } from "react-router-dom"
import { GlobalStats } from "../components/dashboard/GlobalStats"
import { EventStream } from "../components/dashboard/EventStream"
import { WorkItemTree } from "../components/dashboard/WorkItemTree"
import { EmployeeTreeList } from "../components/visualizations/EmployeeTreeList"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Loader2 } from "lucide-react"
import { apiClient } from "../services"
import { useEffect, useState, useCallback } from "react"
import type { EmployeeHierarchy } from "../types"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export function Overview() {
  const { projectId } = useParams<{ projectId: string }>()
  const [hierarchy, setHierarchy] = useState<EmployeeHierarchy[]>([])
  const [hierarchyLoading, setHierarchyLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

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
  }, [projectId, refreshTrigger])

  const handleRefresh = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1)
  }, [])

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
        <Card>
          <CardHeader>
            <CardTitle>最新根任务工作项树</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkItemTree projectId={projectId!} />
          </CardContent>
        </Card>
        {hierarchy.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>人员列表</CardTitle>
            </CardHeader>
            <CardContent>
              {hierarchy.map((root) => (
                <EmployeeTreeList
                  key={root.name}
                  hierarchy={root}
                  onRefresh={handleRefresh}
                />
              ))}
            </CardContent>
          </Card>
        )}
        <EventStream projectId={projectId!} />
      </Box>
    </Box>
  )
}
