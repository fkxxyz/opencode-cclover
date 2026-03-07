import { useEffect, useState } from "react"
import type { Role } from "../types/index"
import { apiClient } from "../services/index"

export function useRoles(projectId: string | undefined) {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // 初始加载
  useEffect(() => {
    if (!projectId) {
      setLoading(false)
      setRoles([])
      return
    }

    const fetchRoles = async () => {
      setLoading(true)
      try {
        const data = await apiClient.getRoles(projectId)
        setRoles(data)
      } catch (err) {
        console.error("获取角色列表失败:", err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    fetchRoles()
  }, [projectId])

  return { roles, loading, error }
}
