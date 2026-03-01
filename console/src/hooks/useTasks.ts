import { useEffect, useState } from "react"
import type { Task } from "../types/index"
import { apiClient } from "../services/index"
import { useWebSocket } from "./useWebSocket"
export function useTasks(projectId: string | undefined, employeeName: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [executableTasks, setExecutableTasks] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const { subscribe } = useWebSocket()
  // 初始加载
  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    apiClient
      .getTasks(projectId, employeeName)
      .then((data) => {
        setTasks(data.tasks)
        setExecutableTasks(data.executableTasks)
      })
      .catch((err: Error) => {
        console.error("获取任务失败:", err)
        setTasks([])
        setExecutableTasks([])
      })
      .finally(() => setLoading(false))
  }, [projectId, employeeName])
  // 实时更新
  useEffect(() => {
    const unsubscribe = subscribe("task_updated", (event) => {
      const taskData = event.details as Partial<Task> & { name: string }
      if (taskData && taskData.name) {
        setTasks((prev) => {
          const existing = prev.find((t) => t.name === taskData.name)
          if (existing) {
            return prev.map((t) =>
              t.name === taskData.name ? { ...t, ...taskData } : t
            )
          }
          return prev
        })
      }
      // 更新可执行任务列表
      if (event.details.executableTasks) {
        setExecutableTasks(event.details.executableTasks as string[])
      }
    })
    return unsubscribe
  }, [subscribe])
  return { tasks, executableTasks, loading }
}
