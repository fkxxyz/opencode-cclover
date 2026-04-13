import { describe, test, expect, beforeAll, afterEach } from "bun:test"
import { RoleManager } from "../../src/core/RoleManager"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import * as os from "node:os"
import * as yaml from "yaml"

describe("RoleManager", () => {
  let tempDir: string
  let testPresetDir: string
  let roleManager: RoleManager

  let originalHome = process.env.HOME

  async function setupPresetFixture(): Promise<void> {
    const realPresetDir = path.join(process.cwd(), "src/roles")
    const testPresetRoot = path.dirname(testPresetDir)

    await fs.mkdir(testPresetDir, { recursive: true })

    const files = await fs.readdir(realPresetDir)
    for (const file of files) {
      if (file.endsWith(".md") || file === "context.yml") {
        const content = await fs.readFile(
          path.join(realPresetDir, file),
          "utf-8"
        )
        await fs.writeFile(path.join(testPresetDir, file), content)
      }
    }

    const contextContent = await fs.readFile(
      path.join(realPresetDir, "context.yml"),
      "utf-8"
    )
    const parsedContext = yaml.parse(contextContent) as {
      contexts?: Record<string, { documents?: string[] }>
    }

    for (const definition of Object.values(parsedContext.contexts || {})) {
      for (const documentPath of definition.documents || []) {
        const sourcePath = path.join(process.cwd(), documentPath)
        const targetPath = path.join(testPresetRoot, documentPath)

        await fs.mkdir(path.dirname(targetPath), { recursive: true })

        try {
          await fs.lstat(targetPath)
          continue
        } catch (error: any) {
          if (error.code !== "ENOENT") {
            throw error
          }
        }

        await fs.symlink(sourcePath, targetPath)
      }
    }
  }

  beforeAll(async () => {
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rolemanager-test-"))

    // 创建独立的测试 preset 目录
    testPresetDir = path.join(tempDir, "test-preset-roles")
    await setupPresetFixture()

    // 使用测试 preset 目录创建 RoleManager
    // presetRootDir 设置为 tempDir 的父目录，这样测试可以在 tempDir 下创建 docs 等目录
    const testPresetRoot = path.dirname(testPresetDir)
    roleManager = new RoleManager(tempDir, testPresetDir, testPresetRoot)
  })

  afterEach(async () => {
    process.env.HOME = originalHome
    await fs.rm(path.join(tempDir, ".cclover"), {
      recursive: true,
      force: true,
    })
    await setupPresetFixture()
  })

  test("should load preset roles", async () => {
    await roleManager.refresh()

    // 应该加载 test-role.md
    const testRole = roleManager.getRole("TestRole")
    expect(testRole).toBeDefined()
    expect(testRole?.name).toBe("TestRole")
    expect(testRole?.source).toBe("preset")
    expect(testRole?.systemPrompt).toContain("测试角色")
  })

  test("should return all role names", async () => {
    await roleManager.refresh()

    const names = roleManager.getRoleNames()
    expect(names).toContain("TestRole")
    expect(names.length).toBeGreaterThan(0)
  })

  test("should return all roles", async () => {
    await roleManager.refresh()

    const roles = roleManager.getAllRoles()
    expect(roles.length).toBeGreaterThan(0)
    expect(roles.some((r) => r.name === "TestRole")).toBe(true)
  })

  test("should return undefined for unknown role", async () => {
    await roleManager.refresh()

    const role = roleManager.getRole("unknown-role-xyz")
    expect(role).toBeUndefined()
  })

  test("should load project roles with higher priority", async () => {
    // 创建项目 role 目录
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    // 创建一个覆盖 test-role 的项目 role (with frontmatter)
    const roleContent = [
      "---",
      "name: TestRole",
      "id: test-role",
      "description: Project-specific test-role",
      "---",
      "Project-specific test-role role",
    ].join("\n")
    await fs.writeFile(path.join(projectRolesDir, "test-role.md"), roleContent)

    // 刷新并检查
    await roleManager.refresh()
    const testRole = roleManager.getRole("TestRole")
    expect(testRole?.source).toBe("project")
    expect(testRole?.systemPrompt).toBe("Project-specific test-role role")

    // 清理
    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should load custom project roles", async () => {
    // 创建项目 role 目录
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    // 创建自定义 role (with frontmatter)
    const roleContent = [
      "---",
      "name: custom-role",
      "id: custom-role",
      "description: Custom role",
      "---",
      "Custom role prompt",
    ].join("\n")
    await fs.writeFile(
      path.join(projectRolesDir, "custom-role.md"),
      roleContent
    )

    // 刷新并检查
    await roleManager.refresh()
    const customRole = roleManager.getRole("custom-role")
    expect(customRole).toBeDefined()
    expect(customRole?.name).toBe("custom-role")
    expect(customRole?.source).toBe("project")
    expect(customRole?.systemPrompt).toBe("Custom role prompt")

    // 清理
    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("test-role role should have correct content", async () => {
    await roleManager.refresh()

    const testRole = roleManager.getRole("TestRole")
    expect(testRole).toBeDefined()

    const prompt = testRole!.systemPrompt

    // 检查关键内容
    expect(prompt).toContain("测试角色")
    expect(prompt).toContain("单元测试")
  })

  test("should parse YAML frontmatter correctly", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    // 创建带 YAML frontmatter 的角色文件
    const roleContent = `---
name: TestRole
id: test-role
description: A test role with metadata
requiredArgs:
  arg1:
    type: string
    description: First argument
canHire:
  - developer
  - tester
groups:
  - engineering
---

This is the system prompt for the test role.`

    await fs.writeFile(path.join(projectRolesDir, "test-role.md"), roleContent)

    await roleManager.refresh()
    const testRole = roleManager.getRole("TestRole")

    expect(testRole).toBeDefined()
    expect(testRole?.name).toBe("TestRole")
    expect(testRole?.id).toBe("test-role")
    expect(testRole?.description).toBe("A test role with metadata")
    expect(testRole?.systemPrompt).toBe(
      "This is the system prompt for the test role."
    )
    expect(testRole?.requiredArgs).toEqual({
      arg1: {
        type: "string",
        description: "First argument",
      },
    })
    expect(testRole?.canHire).toEqual(["developer", "tester"])
    expect(testRole?.groups).toEqual(["engineering"])

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should parse memorySchema from YAML frontmatter", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: module-maintainer
id: module-maintainer
description: Maintains a module
memorySchema:
  ownedUnits:
    type: string[]
    description: List of owned code units
    required: true
  delegatedUnits:
    type: object
    description: Delegated units mapping
    required: false
---

You are a module maintainer.`

    await fs.writeFile(
      path.join(projectRolesDir, "module-maintainer.md"),
      roleContent
    )

    await roleManager.refresh()
    const role = roleManager.getRole("module-maintainer")

    expect(role).toBeDefined()
    expect(role?.memorySchema).toEqual({
      ownedUnits: {
        type: "string[]",
        description: "List of owned code units",
        required: true,
      },
      delegatedUnits: {
        type: "object",
        description: "Delegated units mapping",
        required: false,
      },
    })

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should parse responsibilities and boundaries from YAML frontmatter", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: reviewer
id: reviewer
description: Reviews code changes
responsibilities:
  - Review code quality
  - Identify correctness risks
boundaries:
  - Do not modify production code directly
  - Do not approve without evidence
---

You are a reviewer.`

    await fs.writeFile(path.join(projectRolesDir, "reviewer.md"), roleContent)

    await roleManager.refresh()
    const role = roleManager.getRole("reviewer")

    expect(role).toBeDefined()
    expect(role?.responsibilities).toEqual([
      "Review code quality",
      "Identify correctness risks",
    ])
    expect(role?.boundaries).toEqual([
      "Do not modify production code directly",
      "Do not approve without evidence",
    ])

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should work without memorySchema (backward compatibility)", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: simple-role
id: simple-role
description: A simple role without memorySchema
---

You are a simple role.`

    await fs.writeFile(
      path.join(projectRolesDir, "simple-role.md"),
      roleContent
    )

    await roleManager.refresh()
    const role = roleManager.getRole("simple-role")

    expect(role).toBeDefined()
    expect(role?.memorySchema).toBeUndefined()

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should reject role metadata when contextIds is not a string array", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: invalid-context-role
id: invalid-context-role
description: Invalid context metadata
contextIds: invalid-context
---

This role should not load.`

    await fs.writeFile(
      path.join(projectRolesDir, "invalid-context-role.md"),
      roleContent
    )

    // With atomic refresh, refresh() should throw on validation error
    await expect(roleManager.refresh()).rejects.toThrow(
      "Role validation failed"
    )
  })

  test("should reject role metadata when requiredArgs uses unsupported type", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: invalid-required-args-role
id: invalid-required-args-role
description: Invalid required args metadata
requiredArgs:
  arg1:
    type: number
    description: Invalid type
---

This role should not load.`

    await fs.writeFile(
      path.join(projectRolesDir, "invalid-required-args-role.md"),
      roleContent
    )

    // With atomic refresh, refresh() should throw on validation error
    await expect(roleManager.refresh()).rejects.toThrow(
      "Role validation failed"
    )
  })

  test("should reject role metadata when memorySchema uses unsupported type", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: invalid-memory-schema-role
id: invalid-memory-schema-role
description: Invalid memory schema metadata
memorySchema:
  score:
    type: integer
    description: Invalid memory field type
---

This role should not load.`

    await fs.writeFile(
      path.join(projectRolesDir, "invalid-memory-schema-role.md"),
      roleContent
    )

    // With atomic refresh, refresh() should throw on validation error
    await expect(roleManager.refresh()).rejects.toThrow(
      "Role validation failed"
    )
  })

  test("should reject role metadata when frontmatter contains internal-only resolvedContexts", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: invalid-internal-field-role
id: invalid-internal-field-role
description: Invalid internal field metadata
resolvedContexts: []
---

This role should not load.`

    await fs.writeFile(
      path.join(projectRolesDir, "invalid-internal-field-role.md"),
      roleContent
    )

    // With atomic refresh, refresh() should throw on validation error
    await expect(roleManager.refresh()).rejects.toThrow(
      "Role validation failed"
    )
  })

  test("should reject role when system prompt body is empty", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: empty-prompt-role
id: empty-prompt-role
description: Role with empty prompt
---

`

    await fs.writeFile(
      path.join(projectRolesDir, "empty-prompt-role.md"),
      roleContent
    )

    // With atomic refresh, refresh() should throw on validation error
    await expect(roleManager.refresh()).rejects.toThrow(
      "Role validation failed"
    )
  })

  test("should resolve layered contexts with per-contextId override semantics", async () => {
    const isolatedProjectDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "rolemanager-layered-project-")
    )
    const isolatedPresetDir = path.join(isolatedProjectDir, "preset-roles")
    const isolatedPresetRoot = path.dirname(isolatedPresetDir)
    const projectRolesDir = path.join(isolatedProjectDir, ".cclover/roles")
    const projectContextDir = path.join(isolatedProjectDir, ".cclover")
    const tempHome = await fs.mkdtemp(
      path.join(os.tmpdir(), "rolemanager-home-")
    )
    const globalContextDir = path.join(tempHome, ".config/opencode-cclover")
    const isolatedRoleManager = new RoleManager(
      isolatedProjectDir,
      isolatedPresetDir,
      isolatedPresetRoot
    )

    process.env.HOME = tempHome

    await fs.mkdir(isolatedPresetDir, { recursive: true })
    await fs.mkdir(projectRolesDir, { recursive: true })
    await fs.mkdir(projectContextDir, { recursive: true })
    await fs.mkdir(globalContextDir, { recursive: true })

    await fs.writeFile(
      path.join(isolatedPresetDir, "minimal-preset-role.md"),
      `---
name: minimal-preset-role
id: minimal-preset-role
description: Minimal preset role
---

Minimal preset prompt.`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "context-aware-role.md"),
      `---
name: context-aware-role
id: context-aware-role
description: Role with layered contexts
contextIds:
  - presetOnly
  - shared
  - projectOnly
---

Context aware prompt.`
    )

    await fs.writeFile(
      path.join(isolatedPresetDir, "context.yml"),
      `contexts:
  presetOnly:
    description: Preset context
    documents:
      - docs/preset-only.md
  shared:
    description: Preset shared context
    documents:
      - docs/shared-preset.md
`
    )
    await fs.mkdir(path.join(isolatedPresetRoot, "docs"), { recursive: true })
    await fs.writeFile(
      path.join(isolatedPresetRoot, "docs/preset-only.md"),
      "Preset only content"
    )
    await fs.writeFile(
      path.join(isolatedPresetRoot, "docs/shared-preset.md"),
      "Preset shared content"
    )

    await fs.writeFile(
      path.join(globalContextDir, "context.yml"),
      `contexts:
  shared:
    description: Global shared context
    documents:
      - docs/shared-global.md
`
    )
    await fs.mkdir(path.join(isolatedProjectDir, "docs"), { recursive: true })
    await fs.writeFile(
      path.join(isolatedProjectDir, "docs/shared-global.md"),
      "Global shared content"
    )

    await fs.writeFile(
      path.join(projectContextDir, "context.yml"),
      `contexts:
  shared:
    description: Project shared context
    documents:
      - docs/shared-project.md
  projectOnly:
    description: Project only context
    documents:
      - docs/project-only.md
`
    )
    await fs.writeFile(
      path.join(isolatedProjectDir, "docs/shared-project.md"),
      "Project shared content"
    )
    await fs.writeFile(
      path.join(isolatedProjectDir, "docs/project-only.md"),
      "Project only content"
    )

    await isolatedRoleManager.refresh()
    const role = isolatedRoleManager.getRole("context-aware-role")

    expect(role?.resolvedContexts).toHaveLength(3)
    expect(role?.resolvedContexts?.map((context) => context.id)).toEqual([
      "presetOnly",
      "shared",
      "projectOnly",
    ])

    expect(role?.resolvedContexts?.[0]).toMatchObject({
      id: "presetOnly",
      description: "Preset context",
    })
    expect(role?.resolvedContexts?.[0].documents[0].content).toContain(
      "Preset only content"
    )

    expect(role?.resolvedContexts?.[1]).toMatchObject({
      id: "shared",
      description: "Project shared context",
    })
    expect(role?.resolvedContexts?.[1].documents[0].content).toContain(
      "Project shared content"
    )

    expect(role?.resolvedContexts?.[2]).toMatchObject({
      id: "projectOnly",
      description: "Project only context",
    })
    expect(role?.resolvedContexts?.[2].documents[0].content).toContain(
      "Project only content"
    )
  })

  test("should skip invalid context sources and missing documents without aborting role load", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    const projectContextDir = path.join(tempDir, ".cclover")
    const tempHome = await fs.mkdtemp(
      path.join(os.tmpdir(), "rolemanager-home-")
    )
    const globalContextDir = path.join(tempHome, ".config/opencode-cclover")

    process.env.HOME = tempHome

    await fs.mkdir(projectRolesDir, { recursive: true })
    await fs.mkdir(projectContextDir, { recursive: true })
    await fs.mkdir(globalContextDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "resilient-role.md"),
      `---
name: resilient-role
id: resilient-role
description: Role with warning-and-skip contexts
contextIds:
  - valid-context
  - missing-context
---

Resilient prompt.`
    )

    await fs.writeFile(
      path.join(globalContextDir, "context.yml"),
      `contexts:
  valid-context:
    description: Valid global context
    documents:
      - missing-doc.md
`
    )

    await fs.writeFile(
      path.join(projectContextDir, "context.yml"),
      `contexts: [broken`
    )

    await roleManager.refresh()
    const role = roleManager.getRole("resilient-role")

    expect(role).toBeDefined()
    expect(role?.resolvedContexts).toHaveLength(1)
    expect(role?.resolvedContexts?.[0]).toMatchObject({
      id: "valid-context",
      description: "Valid global context",
    })
    expect(role?.resolvedContexts?.[0].documents).toEqual([])
  })

  test("should resolve context document paths relative to project root", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    const projectDocsDir = path.join(tempDir, "docs")

    await fs.mkdir(projectRolesDir, { recursive: true })
    await fs.mkdir(projectDocsDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "relative-context-role.md"),
      `---
name: relative-context-role
id: relative-context-role
description: Role with relative context docs
contextIds:
  - nested-context
---

Relative context prompt.`
    )

    await fs.writeFile(
      path.join(tempDir, ".cclover/context.yml"),
      `contexts:
  nested-context:
    description: Nested context
    documents:
      - docs/nested-doc.md
`
    )
    await fs.writeFile(
      path.join(projectDocsDir, "nested-doc.md"),
      "Nested document content"
    )

    await roleManager.refresh()
    const role = roleManager.getRole("relative-context-role")

    expect(role?.resolvedContexts?.[0].documents[0]).toEqual({
      path: path.join(projectDocsDir, "nested-doc.md"),
      content: "Nested document content",
    })
  })

  test("should resolve preset context document paths relative to repository root", async () => {
    const isolatedProjectDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "rolemanager-preset-path-project-")
    )
    const isolatedPresetDir = path.join(isolatedProjectDir, "preset-roles")
    const isolatedPresetRoot = path.dirname(isolatedPresetDir)
    const projectRolesDir = path.join(isolatedProjectDir, ".cclover/roles")
    const isolatedRoleManager = new RoleManager(
      isolatedProjectDir,
      isolatedPresetDir,
      isolatedPresetRoot
    )
    const presetDocsDir = path.join(isolatedPresetRoot, "docs")

    await fs.mkdir(isolatedPresetDir, { recursive: true })
    await fs.mkdir(projectRolesDir, { recursive: true })
    await fs.mkdir(presetDocsDir, { recursive: true })

    await fs.writeFile(
      path.join(isolatedPresetDir, "minimal-preset-role.md"),
      `---
name: minimal-preset-role
id: minimal-preset-role
description: Minimal preset role
---

Minimal preset prompt.`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "preset-context-role.md"),
      `---
name: preset-context-role
id: preset-context-role
description: Role with preset context docs
contextIds:
  - preset-repo-context
---

Preset context prompt.`
    )

    await fs.writeFile(
      path.join(isolatedPresetDir, "context.yml"),
      `contexts:
  preset-repo-context:
    description: Preset context from repo root
    documents:
      - docs/preset-doc.md
`
    )
    await fs.writeFile(
      path.join(presetDocsDir, "preset-doc.md"),
      "Preset document content from repo root"
    )

    await isolatedRoleManager.refresh()
    const role = isolatedRoleManager.getRole("preset-context-role")

    expect(role?.resolvedContexts?.[0].documents[0]).toEqual({
      path: path.join(presetDocsDir, "preset-doc.md"),
      content: "Preset document content from repo root",
    })
  })

  test("should reject old format without frontmatter", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    // Create old format role file without frontmatter
    await fs.writeFile(
      path.join(projectRolesDir, "old-format.md"),
      "This is an old format role without frontmatter."
    )

    // With atomic refresh, refresh() should throw on validation error
    await expect(roleManager.refresh()).rejects.toThrow(
      "Role validation failed"
    )

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("resolveGroup should return roles in group", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    // 创建多个角色，部分属于同一组
    await fs.writeFile(
      path.join(projectRolesDir, "dev1.md"),
      `---
name: dev1
id: dev1
description: Developer 1
groups:
  - developers
---
Dev 1 prompt`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "dev2.md"),
      `---
name: dev2
id: dev2
description: Developer 2
groups:
  - developers
---
Dev 2 prompt`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
id: tester
description: Tester
groups:
  - qa
---
Tester prompt`
    )

    await roleManager.refresh()

    const devGroup = roleManager.resolveGroup("group:developers")
    expect(devGroup).toHaveLength(5) // 3 from preset (General Developer, Soul Developer, Specification Engineer) + 2 from test
    expect(devGroup).toContain("dev1")
    expect(devGroup).toContain("dev2")
    expect(devGroup).toContain("General Developer")
    expect(devGroup).toContain("Soul Developer")
    expect(devGroup).toContain("Specification Engineer")

    const qaGroup = roleManager.resolveGroup("group:qa")
    expect(qaGroup).toHaveLength(1)
    expect(qaGroup).toContain("tester")

    const emptyGroup = roleManager.resolveGroup("group:nonexistent")
    expect(emptyGroup).toHaveLength(0)

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("resolveCanHire should resolve exact names", async () => {
    await roleManager.refresh()

    const resolved = roleManager.resolveCanHire(["TestRole"])
    expect(resolved).toContain("TestRole")
  })

  test("resolveCanHire should resolve glob patterns", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "dev-frontend.md"),
      `---
name: dev-frontend
id: dev-frontend
description: Frontend developer
---
Frontend dev`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "dev-backend.md"),
      `---
name: dev-backend
id: dev-backend
description: Backend developer
---
Backend dev`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
id: tester
description: Tester
---
Tester`
    )

    await roleManager.refresh()

    // Test *
    const all = roleManager.resolveCanHire(["*"])
    expect(all.length).toBeGreaterThan(0)

    // Test prefix*
    const devs = roleManager.resolveCanHire(["dev-*"])
    expect(devs).toContain("dev-frontend")
    expect(devs).toContain("dev-backend")
    expect(devs).not.toContain("tester")

    // Test *suffix
    const backends = roleManager.resolveCanHire(["*-backend"])
    expect(backends).toContain("dev-backend")
    expect(backends).not.toContain("dev-frontend")

    // Test *middle*
    const frontends = roleManager.resolveCanHire(["*front*"])
    expect(frontends).toContain("dev-frontend")
    expect(frontends).not.toContain("dev-backend")

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("resolveCanHire should resolve group references", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "dev1.md"),
      `---
name: dev1
id: dev1
groups:
  - developers
---
Dev 1`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "dev2.md"),
      `---
name: dev2
id: dev2
groups:
  - developers
---
Dev 2`
    )

    await roleManager.refresh()

    const resolved = roleManager.resolveCanHire(["group:developers"])
    expect(resolved).toHaveLength(5) // 3 from preset + 2 from test
    expect(resolved).toContain("dev1")
    expect(resolved).toContain("dev2")
    expect(resolved).toContain("General Developer")
    expect(resolved).toContain("Soul Developer")
    expect(resolved).toContain("Specification Engineer")

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("resolveCanHire should resolve mixed patterns", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "dev1.md"),
      `---
name: dev1
id: dev1
groups:
  - developers
---
Dev 1`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
id: tester
description: Tester
---
Tester`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "reviewer.md"),
      `---
name: reviewer
id: reviewer
description: Reviewer
---
Reviewer`
    )

    await roleManager.refresh()

    const resolved = roleManager.resolveCanHire([
      "group:developers",
      "tester",
      "*viewer",
    ])
    expect(resolved).toContain("dev1")
    expect(resolved).toContain("tester")
    expect(resolved).toContain("reviewer")

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("canHire should check if role A can hire role B", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "manager.md"),
      `---
name: manager
id: manager
canHire:
  - developer
  - tester
---
Manager`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "developer.md"),
      `---
name: developer
id: developer
description: Developer
---
Developer`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
id: tester
description: Tester
---
Tester`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "designer.md"),
      `---
name: designer
id: designer
description: Designer
---
Designer`
    )

    await roleManager.refresh()

    expect(roleManager.canHire("manager", "developer")).toBe(true)
    expect(roleManager.canHire("manager", "tester")).toBe(true)
    expect(roleManager.canHire("manager", "designer")).toBe(false)
    expect(roleManager.canHire("developer", "tester")).toBe(false)

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("canHire should work with glob patterns", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "manager.md"),
      `---
name: manager
id: manager
canHire:
  - dev-*
---
Manager`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "dev-frontend.md"),
      `---
name: dev-frontend
id: dev-frontend
description: Frontend developer
---
Frontend`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "dev-backend.md"),
      `---
name: dev-backend
id: dev-backend
description: Backend developer
---
Backend`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
id: tester
description: Tester
---
Tester`
    )

    await roleManager.refresh()

    expect(roleManager.canHire("manager", "dev-frontend")).toBe(true)
    expect(roleManager.canHire("manager", "dev-backend")).toBe(true)
    expect(roleManager.canHire("manager", "tester")).toBe(false)

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("canHire should work with group references", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "manager.md"),
      `---
name: manager
id: manager
canHire:
  - group:developers
---
Manager`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "dev1.md"),
      `---
name: dev1
id: dev1
groups:
  - developers
---
Dev 1`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "dev2.md"),
      `---
name: dev2
id: dev2
groups:
  - developers
---
Dev 2`
    )

    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
id: tester
description: Tester
---
Tester`
    )

    await roleManager.refresh()

    expect(roleManager.canHire("manager", "dev1")).toBe(true)
    expect(roleManager.canHire("manager", "dev2")).toBe(true)
    expect(roleManager.canHire("manager", "tester")).toBe(false)

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("canHire should return false for role without canHire", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    await fs.writeFile(
      path.join(projectRolesDir, "developer.md"),
      `---
name: developer
id: developer
description: Developer
---
Developer`
    )
    await fs.writeFile(
      path.join(projectRolesDir, "tester.md"),
      `---
name: tester
id: tester
description: Tester
---
Tester`
    )

    await roleManager.refresh()

    expect(roleManager.canHire("developer", "tester")).toBe(false)

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("all preset role contextIds should be defined in context.yml", async () => {
    const yaml = await import("yaml")

    // 读取 context.yml
    const contextYmlPath = path.join(process.cwd(), "src/roles/context.yml")
    const contextYmlContent = await fs.readFile(contextYmlPath, "utf-8")
    const contextYml = yaml.parse(contextYmlContent)
    const definedContextIds = new Set(Object.keys(contextYml.contexts || {}))

    // 读取所有预设角色文件
    const presetRolesDir = path.join(process.cwd(), "src/roles")
    const roleFiles = await fs.readdir(presetRolesDir)

    const undefinedContextIds: Array<{ role: string; contextId: string }> = []

    for (const file of roleFiles) {
      if (!file.endsWith(".md")) {
        continue
      }

      const filePath = path.join(presetRolesDir, file)
      const content = await fs.readFile(filePath, "utf-8")

      // 解析 YAML frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (!frontmatterMatch) {
        continue
      }

      const frontmatter = yaml.parse(frontmatterMatch[1])
      const contextIds = frontmatter.contextIds

      if (!contextIds || !Array.isArray(contextIds)) {
        continue
      }

      // 检查每个 contextId 是否在 context.yml 中定义
      for (const contextId of contextIds) {
        if (!definedContextIds.has(contextId)) {
          undefinedContextIds.push({
            role: frontmatter.name || file,
            contextId,
          })
        }
      }
    }

    // 如果有未定义的 contextId,测试失败并显示详细信息
    if (undefinedContextIds.length > 0) {
      const errorMessage = undefinedContextIds
        .map(
          ({ role, contextId }) =>
            `  - Role "${role}" references undefined contextId: "${contextId}"`
        )
        .join("\n")
      throw new Error(
        `Found ${undefinedContextIds.length} undefined contextIds:\n${errorMessage}`
      )
    }

    expect(undefinedContextIds.length).toBe(0)
  })

  test("all documents in context.yml should be relative paths and exist", async () => {
    const yaml = await import("yaml")

    // 读取 context.yml
    const contextYmlPath = path.join(process.cwd(), "src/roles/context.yml")
    const contextYmlContent = await fs.readFile(contextYmlPath, "utf-8")
    const contextYml = yaml.parse(contextYmlContent)

    const projectRoot = process.cwd()
    const issues: Array<{
      contextId: string
      document: string
      issue: string
    }> = []

    for (const [contextId, definition] of Object.entries(
      contextYml.contexts || {}
    )) {
      const documents = (definition as any).documents

      if (!documents || !Array.isArray(documents)) {
        continue
      }

      for (const document of documents) {
        // 检查是否为相对路径
        if (path.isAbsolute(document)) {
          issues.push({
            contextId,
            document,
            issue: "Path is absolute, should be relative",
          })
          continue
        }

        // 检查文件是否存在
        const fullPath = path.join(projectRoot, document)
        try {
          await fs.access(fullPath)
        } catch (error) {
          issues.push({
            contextId,
            document,
            issue: "File does not exist",
          })
        }
      }
    }

    // 如果有问题,测试失败并显示详细信息
    if (issues.length > 0) {
      const errorMessage = issues
        .map(
          ({ contextId, document, issue }) =>
            `  - Context "${contextId}", document "${document}": ${issue}`
        )
        .join("\n")
      throw new Error(
        `Found ${issues.length} issues in context.yml:\n${errorMessage}`
      )
    }

    expect(issues.length).toBe(0)
  })

  test("should load role with valid workflow metadata", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: workflow-role
id: workflow-role
description: Role with workflow metadata
workflow:
  id: main-workflow
  description: Main workflow
  phases:
    - id: planning
      description: Planning phase
      tasks:
        - id: gather-requirements
          description: Gather requirements
          actions:
            - id: interview
              description: Interview stakeholders
              specifications:
                - id: stakeholder-list
                  description: List of stakeholders
    - id: execution
      description: Execution phase
      tasks: []
---

You are a workflow-enabled role.`

    await fs.writeFile(
      path.join(projectRolesDir, "workflow-role.md"),
      roleContent
    )

    await roleManager.refresh()
    const role = roleManager.getRole("workflow-role")

    expect(role).toBeDefined()
    expect(role?.workflow).toBeDefined()
    expect(role?.workflow?.id).toBe("main-workflow")
    expect(role?.workflow?.description).toBe("Main workflow")
    expect(role?.workflow?.phases).toHaveLength(2)

    const planning = role?.workflow?.phases[0]
    expect(planning?.id).toBe("planning")
    expect(planning?.description).toBe("Planning phase")
    expect(planning?.tasks).toHaveLength(1)
    expect(planning?.tasks?.[0]?.id).toBe("gather-requirements")
    expect(planning?.tasks?.[0]?.actions).toHaveLength(1)
    expect(planning?.tasks?.[0]?.actions?.[0]?.specifications).toHaveLength(1)

    const execution = role?.workflow?.phases[1]
    expect(execution?.id).toBe("execution")
    expect(execution?.tasks).toEqual([])

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should load role without workflow identically to before (backward compatibility)", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: no-workflow-role
id: no-workflow-role
description: Role without workflow
canHire:
  - developer
---

You are a normal role.`

    await fs.writeFile(
      path.join(projectRolesDir, "no-workflow-role.md"),
      roleContent
    )

    await roleManager.refresh()
    const role = roleManager.getRole("no-workflow-role")

    expect(role).toBeDefined()
    expect(role?.workflow).toBeUndefined()
    expect(role?.name).toBe("no-workflow-role")
    expect(role?.canHire).toEqual(["developer"])

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should reject role with invalid workflow metadata (empty phases)", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: bad-workflow-role
id: bad-workflow-role
description: Role with invalid workflow
workflow:
  phases: []
---

Bad workflow role.`

    await fs.writeFile(
      path.join(projectRolesDir, "bad-workflow-role.md"),
      roleContent
    )

    // With atomic refresh, refresh() should throw on validation error
    await expect(roleManager.refresh()).rejects.toThrow(
      "Role validation failed"
    )

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should load role with minimal workflow (single phase, no tasks)", async () => {
    const projectRolesDir = path.join(tempDir, ".cclover/roles")
    await fs.mkdir(projectRolesDir, { recursive: true })

    const roleContent = `---
name: minimal-workflow-role
id: minimal-workflow-role
description: Minimal workflow role
workflow:
  phases:
    - id: init
---

Minimal workflow role prompt.`

    await fs.writeFile(
      path.join(projectRolesDir, "minimal-workflow-role.md"),
      roleContent
    )

    await roleManager.refresh()
    const role = roleManager.getRole("minimal-workflow-role")

    expect(role).toBeDefined()
    expect(role?.workflow?.phases).toHaveLength(1)
    expect(role?.workflow?.phases[0]?.id).toBe("init")

    await fs.rm(projectRolesDir, { recursive: true })
  })

  test("should load all preset roles without errors", async () => {
    // 这个测试验证所有预设角色都能成功加载
    await roleManager.refresh()

    const roles = roleManager.getAllRoles()
    const presetRoles = roles.filter((r) => r.source === "preset")

    // 验证至少加载了一些预设角色
    expect(presetRoles.length).toBeGreaterThan(0)

    // 验证所有预设角色都有必需的字段
    for (const role of presetRoles) {
      expect(role.name).toBeDefined()
      expect(role.systemPrompt).toBeDefined()
      expect(role.systemPrompt.length).toBeGreaterThan(0)
    }
  })
})
