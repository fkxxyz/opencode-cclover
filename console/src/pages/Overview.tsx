import { useNavigate } from "react-router-dom"
import { useEmployees } from "../hooks/useEmployees"
import { GlobalStats } from "../components/dashboard/GlobalStats"
import { EventStream } from "../components/dashboard/EventStream"
import { HierarchyTree } from "../components/visualizations/HierarchyTree"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Loader2 } from "lucide-react"
import { apiClient } from "../services"
import { useEffect, useState } from "react"
import type { EmployeeHierarchy } from "../types"

export function Overview() {
  const navigate = useNavigate()
  const { employees, loading: employeesLoading } = useEmployees()
  const [hierarchy, setHierarchy] = useState<EmployeeHierarchy | null>(null)
  const [hierarchyLoading, setHierarchyLoading] = useState(true)

  useEffect(() => {
    apiClient
      .getHierarchy()
      .then(setHierarchy)
      .catch((err: Error) => {
        console.error("获取雇佣关系失败:", err)
      })
      .finally(() => setHierarchyLoading(false))
  }, [])

  const handleNodeClick = (employee: { name: string; role: string }) => {
    navigate(`/employee/${employee.name}`)
  }

  if (employeesLoading || hierarchyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">
            CClover 管理控制台
          </h1>
          <div className="text-sm text-muted-foreground">
            {employees.length} 个员工
          </div>
        </div>

        <GlobalStats />

        {hierarchy && (
          <Card>
            <CardHeader>
              <CardTitle>雇佣关系树状图</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[600px]">
                <HierarchyTree
                  hierarchy={hierarchy}
                  onNodeClick={handleNodeClick}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <EventStream />
      </div>
    </div>
  )
}
