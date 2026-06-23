import { useEffect, useState } from "react"
import type { Employee } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"

export function useEmployees(projectId: string | undefined) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const { subscribe } = useWebSocket()

  // 初始加载
  useEffect(() => {
    if (!projectId) {
      setLoading(false)
      setEmployees([])
      return
    }
    setLoading(true)
    apiClient
      .getEmployees(projectId)
      .then(setEmployees)
      .catch((err: Error) => {
        console.error("获取员工列表失败:", err)
        setError(err)
      })
      .finally(() => setLoading(false))
  }, [projectId])

  // 实时更新
  useEffect(() => {
    const unsubscribe = subscribe("employee_status_changed", (event) => {
      const employeeId = event.employeeId
      if (employeeId) {
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.employeeId === employeeId
              ? {
                  ...emp,
                  status:
                    (event.details.newStatus as Employee["status"]) ||
                    emp.status,
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
