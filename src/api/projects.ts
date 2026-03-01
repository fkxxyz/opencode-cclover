import { ConfigManager } from "../config/ConfigManager"
import { CandidateProjectsManager } from "../config/CandidateProjectsManager"
import type { ProjectConfig } from "../config/ConfigManager"
import type { CandidateProject } from "../config/CandidateProjectsManager"
import type { SuccessResponse } from "../types/index"
import { GlobalCcloverService } from "../server/GlobalServer"

/**
 * 获取候选项目列表
 */
export async function getCandidateProjects(): Promise<
  SuccessResponse<{ candidates: CandidateProject[] }>
> {
  const candidates = await CandidateProjectsManager.getAll()
  return {
    success: true,
    data: { candidates },
  }
}

/**
 * 添加项目到配置
 */
export async function addProject(
  name: string,
  path: string
): Promise<SuccessResponse<{ project: ProjectConfig }>> {
  const config = await ConfigManager.load()

  // 检查是否已存在
  const existing = config.projects.find((p) => p.path === path)
  if (existing) {
    throw new Error(`Project already exists: ${path}`)
  }

  // 添加新项目
  const newProject: ProjectConfig = {
    name,
    path,
    enabled: true,
  }

  config.projects.push(newProject)
  await ConfigManager.save(config)
  // 从候选列表中移除
  await CandidateProjectsManager.removeCandidate(path)
  // 动态初始化项目实例
  const globalService = await GlobalCcloverService.getInstance()
  await globalService.addProject(newProject)

  return {
    success: true,
    data: { project: newProject },
  }
}

/**
 * 删除项目
 */
export async function deleteProject(
  path: string
): Promise<SuccessResponse<{ success: boolean }>> {
  const config = await ConfigManager.load()

  // 查找项目
  const index = config.projects.findIndex((p) => p.path === path)
  if (index === -1) {
    throw new Error(`Project not found: ${path}`)
  }

  // 删除项目
  config.projects.splice(index, 1)
  await ConfigManager.save(config)
  // 动态删除项目实例
  const globalService = await GlobalCcloverService.getInstance()
  await globalService.removeProject(path)

  return {
    success: true,
    data: { success: true },
  }
}

/**
 * 更新项目配置
 */
export async function updateProject(
  path: string,
  updates: Partial<ProjectConfig>
): Promise<SuccessResponse<{ project: ProjectConfig }>> {
  const config = await ConfigManager.load()

  // 查找项目
  const project = config.projects.find((p) => p.path === path)
  if (!project) {
    throw new Error(`Project not found: ${path}`)
  }

  // 更新项目
  if (updates.name !== undefined) project.name = updates.name
  if (updates.enabled !== undefined) project.enabled = updates.enabled

  await ConfigManager.save(config)

  return {
    success: true,
    data: { project },
  }
}
