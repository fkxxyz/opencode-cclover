import type {
  Project,
  Employee,
  EmployeeDetail,
  EmployeeHierarchy,
  Message,
  TasksResponse,
  Event,
  SuccessResponse,
  ErrorResponse,
} from "../types/index"
const API_BASE_URL = "http://localhost:4097/api"
export class ApiClient {
  private currentProjectId: string | null = null
  setProject(projectId: string): void {
    this.currentProjectId = projectId
  }
  async getProjects(): Promise<Project[]> {
    const data = await this.request<{ projects: Project[] }>("/projects")
    return data.projects
  }
  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`)
    const json = (await response.json()) as SuccessResponse<T> | ErrorResponse
    if (!json.success) {
      const error = json as ErrorResponse
      throw new Error(error.error.message)
    }
    return (json as SuccessResponse<T>).data
  }
  async getEmployees(): Promise<Employee[]> {
    if (!this.currentProjectId) {
      throw new Error("No project selected")
    }
    const data = await this.request<{ employees: Employee[] }>(
      `/projects/${this.currentProjectId}/employees`
    )
    return data.employees
  }
  async getEmployeeDetail(name: string): Promise<EmployeeDetail> {
    if (!this.currentProjectId) {
      throw new Error("No project selected")
    }
    return this.request<EmployeeDetail>(
      `/projects/${this.currentProjectId}/employees/${name}`
    )
  }
  async getMessages(
    employeeName: string,
    peer?: string,
    limit?: number
  ): Promise<Message[]> {
    if (!this.currentProjectId) {
      throw new Error("No project selected")
    }
    const params = new URLSearchParams()
    if (peer) params.append("peer", peer)
    if (limit) params.append("limit", limit.toString())
    const query = params.toString() ? `?${params.toString()}` : ""
    const data = await this.request<{ messages: Message[] }>(
      `/projects/${this.currentProjectId}/employees/${employeeName}/messages${query}`
    )
    return data.messages
  }
  async getTasks(employeeName: string): Promise<TasksResponse> {
    if (!this.currentProjectId) {
      throw new Error("No project selected")
    }
    return this.request<TasksResponse>(
      `/projects/${this.currentProjectId}/employees/${employeeName}/tasks`
    )
  }
  async getEvents(options?: {
    limit?: number
    employeeName?: string
  }): Promise<Event[]> {
    if (!this.currentProjectId) {
      throw new Error("No project selected")
    }
    const params = new URLSearchParams()
    if (options?.limit) params.append("limit", options.limit.toString())
    if (options?.employeeName)
      params.append("employeeName", options.employeeName)
    const query = params.toString() ? `?${params.toString()}` : ""
    const data = await this.request<{ events: Event[] }>(
      `/projects/${this.currentProjectId}/events${query}`
    )
    return data.events
  }
  async getHierarchy(): Promise<EmployeeHierarchy> {
    if (!this.currentProjectId) {
      throw new Error("No project selected")
    }
    const data = await this.request<{ hierarchy: EmployeeHierarchy }>(
      `/projects/${this.currentProjectId}/employees/hierarchy`
    )
    return data.hierarchy
  }
  async getStats(): Promise<{
    totalEmployees: number
    activeEmployees: number
    pendingTasks: number
    todayMessages: number
  }> {
    if (!this.currentProjectId) {
      throw new Error("No project selected")
    }
    return this.request<{
      totalEmployees: number
      activeEmployees: number
      pendingTasks: number
      todayMessages: number
    }>(`/projects/${this.currentProjectId}/stats`)
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
}
