import type {
  Project,
  CandidateProject,
  Employee,
  EmployeeDetail,
  EmployeeHierarchy,
  Message,
  PeerWithLastMessage,
  TasksResponse,
  Event,
  SuccessResponse,
  ErrorResponse,
  TimelineItem,
} from "../types/index"
import { ApiError, NetworkError } from "../lib/error-handler"

const API_BASE_URL = "http://localhost:4097/api"

export class ApiClient {
  async getProjects(): Promise<Project[]> {
    const data = await this.request<{ projects: Project[] }>("/projects")
    return data.projects
  }

  async getCandidateProjects(): Promise<CandidateProject[]> {
    const data = await this.request<{ candidates: CandidateProject[] }>(
      "/candidate-projects"
    )
    return data.candidates
  }

  async addProject(name: string, path: string): Promise<Project> {
    try {
      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, path }),
      })
      const json = (await response.json()) as
        | SuccessResponse<{ project: any }>
        | ErrorResponse
      if (!json.success) {
        const error = json as ErrorResponse
        throw new ApiError(error.error.message, error.error.code)
      }
      return (json as SuccessResponse<{ project: any }>).data.project
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new NetworkError("无法连接到服务器")
      }
      throw error
    }
  }

  async deleteProject(path: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/projects/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      })
      const json = (await response.json()) as
        | SuccessResponse<any>
        | ErrorResponse
      if (!json.success) {
        const error = json as ErrorResponse
        throw new ApiError(error.error.message, error.error.code)
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new NetworkError("无法连接到服务器")
      }
      throw error
    }
  }

  private async request<T>(endpoint: string): Promise<T> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`)
      const json = (await response.json()) as SuccessResponse<T> | ErrorResponse
      if (!json.success) {
        const error = json as ErrorResponse
        throw new ApiError(error.error.message, error.error.code)
      }
      return (json as SuccessResponse<T>).data
    } catch (error) {
      // 网络错误
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new NetworkError("无法连接到服务器")
      }
      // 重新抛出其他错误
      throw error
    }
  }

  async getEmployees(projectId: string): Promise<Employee[]> {
    const data = await this.request<{ employees: Employee[] }>(
      `/projects/${projectId}/employees`
    )
    return data.employees
  }
  async getBosses(projectId: string): Promise<Employee[]> {
    const data = await this.request<{ bosses: Employee[] }>(
      `/projects/${projectId}/bosses`
    )
    return data.bosses
  }
  async getBossDetail(
    projectId: string,
    name: string
  ): Promise<EmployeeDetail> {
    return this.request<EmployeeDetail>(`/projects/${projectId}/boss/${name}`)
  }
  async getEmployeeDetail(
    projectId: string,
    name: string
  ): Promise<EmployeeDetail> {
    return this.request<EmployeeDetail>(
      `/projects/${projectId}/employees/${name}`
    )
  }

  async getMessages(
    projectId: string,
    employeeName: string,
    peer?: string,
    limit?: number
  ): Promise<Message[]> {
    const params = new URLSearchParams()
    if (peer) params.append("peer", peer)
    if (limit) params.append("limit", limit.toString())
    const query = params.toString() ? `?${params.toString()}` : ""
    const data = await this.request<{ messages: Message[] }>(
      `/projects/${projectId}/employees/${employeeName}/messages${query}`
    )
    return data.messages
  }

  async getPeers(
    projectId: string,
    employeeName: string
  ): Promise<PeerWithLastMessage[]> {
    const data = await this.request<{ peers: PeerWithLastMessage[] }>(
      `/projects/${projectId}/employees/${employeeName}/peers`
    )
    return data.peers
  }

  async sendMessage(
    projectId: string,
    employeeName: string,
    to: string,
    content: string
  ): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/projects/${projectId}/employees/${employeeName}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, content }),
        }
      )
      const json = (await response.json()) as
        | SuccessResponse<any>
        | ErrorResponse
      if (!json.success) {
        const error = json as ErrorResponse
        throw new ApiError(error.error.message, error.error.code)
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new NetworkError("无法连接到服务器")
      }
      throw error
    }
  }

  async getTasks(
    projectId: string,
    employeeName: string
  ): Promise<TasksResponse> {
    return this.request<TasksResponse>(
      `/projects/${projectId}/employees/${employeeName}/tasks`
    )
  }

  async getEvents(
    projectId: string,
    options?: {
      limit?: number
      employeeName?: string
    }
  ): Promise<Event[]> {
    const params = new URLSearchParams()
    if (options?.limit) params.append("limit", options.limit.toString())
    if (options?.employeeName)
      params.append("employeeName", options.employeeName)
    const query = params.toString() ? `?${params.toString()}` : ""
    const data = await this.request<{ events: Event[] }>(
      `/projects/${projectId}/events${query}`
    )
    return data.events
  }

  async getHierarchy(projectId: string): Promise<EmployeeHierarchy> {
    const data = await this.request<{ hierarchy: EmployeeHierarchy }>(
      `/projects/${projectId}/employees/hierarchy`
    )
    return data.hierarchy
  }

  async getStats(projectId: string): Promise<{
    totalEmployees: number
    activeEmployees: number
    pendingTasks: number
    todayMessages: number
  }> {
    return this.request<{
      totalEmployees: number
      activeEmployees: number
      pendingTasks: number
      todayMessages: number
    }>(`/projects/${projectId}/stats`)
  }

  async getHealth(): Promise<{
    status: string
    timestamp: string
    version: string
  }> {
    return this.request<{
      status: string
      timestamp: string
      version: string
    }>("/health")
  }

  async getTimeline(
    projectId: string,
    employeeName: string,
    limit?: number
  ): Promise<TimelineItem[]> {
    const params = new URLSearchParams()
    if (limit) params.append("limit", limit.toString())
    const query = params.toString() ? `?${params.toString()}` : ""
    const data = await this.request<{ timeline: TimelineItem[] }>(
      `/projects/${projectId}/employees/${employeeName}/timeline${query}`
    )
    return data.timeline
  }
}

export const apiClient = new ApiClient()
