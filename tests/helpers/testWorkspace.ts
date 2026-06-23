import * as fs from "node:fs/promises"
import * as path from "node:path"

export const TEST_WORKSPACE_ROOT = path.join(
  import.meta.dir,
  "..",
  "test-workspace"
)

export interface TestProjectPaths {
  suiteRoot: string
  projectPath: string
  workspaceRoot: string
}

export function getTestWorkspace(suiteName: string): string {
  return path.join(TEST_WORKSPACE_ROOT, suiteName)
}

export function getTestProjectPaths(suiteName: string): TestProjectPaths {
  const suiteRoot = getTestWorkspace(suiteName)
  const projectPath = path.join(suiteRoot, "project")
  const workspaceRoot = path.join(projectPath, ".cclover", "workspace")
  return { suiteRoot, projectPath, workspaceRoot }
}

export async function resetTestWorkspace(directory: string): Promise<void> {
  await fs.rm(directory, { recursive: true, force: true })
  await fs.mkdir(directory, { recursive: true })
}
