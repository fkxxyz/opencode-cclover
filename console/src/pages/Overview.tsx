import { useNavigate, useParams } from "react-router-dom"
import { useEmployees } from "../hooks/useEmployees"
import { GlobalStats } from "../components/dashboard/GlobalStats"
import { EventStream } from "../components/dashboard/EventStream"
import { HierarchyTree } from "../components/visualizations/HierarchyTree"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { EmployeeCard } from "../components/employee/EmployeeCard"
import { Loader2 } from "lucide-react"
import { apiClient } from "../services"
import { useEffect, useState } from "react"
import type { EmployeeHierarchy } from "../types"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export function Overview() {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()
  const { employees, loading: employeesLoading } = useEmployees(projectId)
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

  const handleNodeClick = (employee: { name: string; role: string }) => {
    navigate(`/projects/${projectId}/employee/${employee.name}`)
  }

  if (employeesLoading || hierarchyLoading) {
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
          <Typography variant="body2" color="text.secondary">
            {employees.length} 个员工
          </Typography>
        </Box>
        <GlobalStats projectId={projectId!} />
        {hierarchy && (
          <Card>
            <CardHeader>
              <CardTitle>雇佣关系树状图</CardTitle>
            </CardHeader>
            <CardContent>
              <Box sx={{ height: 600 }}>
                <HierarchyTree
                  hierarchy={hierarchy}
                  onNodeClick={handleNodeClick}
                />
              </Box>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>员工列表</CardTitle>
          </CardHeader>
          <CardContent>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, 1fr)",
                  lg: "repeat(3, 1fr)",
                },
                gap: 2,
              }}
            >
              {employees.map((emp) => (
                <EmployeeCard
                  key={emp.name}
                  employee={emp}
                  onClick={() => navigate(`/projects/${projectId}/employee/${emp.name}`)}
                />
              ))}
            </Box>
          </CardContent>
        </Card>
        <EventStream projectId={projectId!} />
      </Box>
    </Box>
  )
}
