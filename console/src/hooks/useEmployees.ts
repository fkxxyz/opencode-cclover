import { useEffect, useState } from "react"
import { useProjectContext } from "../contexts/ProjectContext"
import type { Employee } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"
export function useEmployees() {
  const { currentProject } = useProjectContext()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { subscribe } = useWebSocket()
  // 初始加载
  useEffect(() => {
    if (!currentProject) return
    setLoading(true)
    apiClient
      .getEmployees()
      .then(setEmployees)
      .catch((err: Error) => {
        console.error("获取员工列表失败:", err)
        setError(err)
      })
      .finally(() => setLoading(false))
  }, [currentProject])

  // 实时更新
  useEffect(() => {
    const unsubscribe = subscribe("employee_status_changed", (event) => {
      const employeeName = event.employeeName
      if (employeeName) {
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.name === employeeName
              ? {
                  ...emp,
                  status:
                    (event.details.status as Employee["status"]) || emp.status,
                  lastActiveAt:
                    (event.details.lastActiveAt as string) || emp.lastActiveAt,
                }
              : emp
          )
        )
      }
    })
    return unsubscribe
  }, [subscribe])

  return { employees, loading, error }
}
