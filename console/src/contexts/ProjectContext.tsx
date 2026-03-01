import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react"
import type { Project } from "../types"
import { apiClient, wsClient } from "../services"

interface ProjectContextValue {
  projects: Project[]
  currentProject: string | null
  setCurrentProject: (projectId: string) => void
  loading: boolean
  error: Error | null
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // 加载 project 列表
  useEffect(() => {
    apiClient
      .getProjects()
      .then((data) => {
        setProjects(data)
        // 默认选择第一个 project
        if (data.length > 0 && !currentProject) {
          setCurrentProject(data[0].projectId)
        }
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  // 切换 project 时更新 API 客户端
  useEffect(() => {
    if (currentProject) {
      apiClient.setProject(currentProject)
      wsClient.setProject(currentProject)
    }
  }, [currentProject])

  return (
    <ProjectContext.Provider
      value={{ projects, currentProject, setCurrentProject, loading, error }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjectContext() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error("useProjectContext must be used within ProjectProvider")
  }
  return context
}
