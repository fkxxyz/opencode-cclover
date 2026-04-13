import {
  ModelConfigManager,
  loadPresetConfig,
} from "../../src/config/ModelConfigManager"
import { MeetingModePromptInjector } from "../../src/meeting-mode/PromptInjector"
import type { ProjectInstance } from "../../src/server/ProjectRegistry"
import type { CcloverConfig } from "../../src/config/ConfigManager"

/**
 * 创建测试用的 ProjectInstance
 * 自动初始化所有必需的依赖项
 */
export async function createTestProjectInstance(
  workspaceRoot: string,
  overrides?: Partial<ProjectInstance>
): Promise<ProjectInstance> {
  // 创建最小但有效的实例
  const globalConfig: CcloverConfig = {
    bosses: [],
    projects: [],
    modelTypes: {},
  }
  const presetConfig = await loadPresetConfig()
  const modelConfigManager = new ModelConfigManager(globalConfig, presetConfig)

  const meetingModePromptInjector = new MeetingModePromptInjector(
    "test-project",
    "Test Project"
  )

  return {
    projectId: "test-project",
    projectName: "Test Project",
    directory: workspaceRoot,
    workspaceRoot,
    modelConfigManager,
    meetingModePromptInjector,
    eventLoopStarted: false,
    eventLoops: new Map(),
    ...overrides, // 允许测试覆盖特定属性
  } as ProjectInstance
}
