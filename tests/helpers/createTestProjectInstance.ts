import {
  ModelConfigManager,
  loadPresetConfig,
} from "../../src/config/ModelConfigManager"
import { BossManager } from "../../src/core/BossManager"
import { EmployeeWorkSessionManager } from "../../src/core/EmployeeWorkSessionManager"
import { MessageService } from "../../src/core/MessageService"
import { MemoryManager } from "../../src/core/MemoryManager"
import { RoleManager } from "../../src/core/RoleManager"
import { MeetingModePromptInjector } from "../../src/meeting-mode/PromptInjector"
import { StateManager } from "../../src/state/StateManager"
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
  const stateManager = new StateManager(
    "test-project",
    workspaceRoot,
    workspaceRoot
  )
  const bossManager = new BossManager(globalConfig, workspaceRoot)
  const messageService = new MessageService(
    workspaceRoot,
    stateManager,
    "test-project",
    bossManager
  )
  const memoryManager = new MemoryManager(
    workspaceRoot,
    stateManager,
    "test-project"
  )
  const roleManager = new RoleManager(workspaceRoot)
  const employeeWorkSessionManager = new EmployeeWorkSessionManager(
    workspaceRoot,
    stateManager,
    roleManager
  )

  return {
    projectId: "test-project",
    projectName: "Test Project",
    directory: workspaceRoot,
    workspaceRoot,
    stateManager,
    messageService,
    memoryManager,
    employeeWorkSessionManager,
    bossManager,
    roleManager,
    modelConfigManager,
    meetingModePromptInjector,
    feedbackManager: {} as any,
    eventLoopStarted: false,
    eventLoopStarting: null,
    eventLoops: new Map(),
    ...overrides, // 允许测试覆盖特定属性
  }
}
