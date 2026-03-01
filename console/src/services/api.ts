import type {
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
    const data = await this.request<{ employees: Employee[] }>("/employees")
    return data.employees
  }

  async getEmployeeDetail(name: string): Promise<EmployeeDetail> {
    return this.request<EmployeeDetail>(`/employees/${name}`)
  }

  async getMessages(
    employeeName: string,
    peer?: string,
    limit?: number
  ): Promise<Message[]> {
    const params = new URLSearchParams()
    if (peer) params.append("peer", peer)
    if (limit) params.append("limit", limit.toString())

    const query = params.toString() ? `?${params.toString()}` : ""
    const data = await this.request<{ messages: Message[] }>(
      `/employees/${employeeName}/messages${query}`
    )
    return data.messages
  }

  async getTasks(employeeName: string): Promise<TasksResponse> {
    return this.request<TasksResponse>(`/employees/${employeeName}/tasks`)
  }

  async getEvents(options?: {
    limit?: number
    employeeName?: string
  }): Promise<Event[]> {
    const params = new URLSearchParams()
    if (options?.limit) params.append("limit", options.limit.toString())
    if (options?.employeeName)
      params.append("employeeName", options.employeeName)

    const query = params.toString() ? `?${params.toString()}` : ""
    const data = await this.request<{ events: Event[] }>(`/events${query}`)
    return data.events
  }

  async getHierarchy(): Promise<EmployeeHierarchy> {
    const data = await this.request<{ hierarchy: EmployeeHierarchy }>(
      "/employees/hierarchy"
    )
    return data.hierarchy
  }

  async getStats(): Promise<{
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
    }>("/stats")
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
