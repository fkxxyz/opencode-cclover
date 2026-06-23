# Testing Workspace Standard

Tests that write files must use a suite-specific directory under `tests/test-workspace/`.

## Directory Layout

Use this layout for tests that need both project metadata and runtime data:

```text
tests/test-workspace/<suite-name>/
  project/
    .cclover/
      employees.yaml
      employee-work-sessions.yaml
      roles/
      workspace/
        ews/
        employees/
        bosses/
```

Use `projectPath` for project metadata and role definitions:

```ts
const projectPath = path.join(suiteRoot, "project")
```

Use `workspaceRoot` for runtime persistence:

```ts
const workspaceRoot = path.join(projectPath, ".cclover", "workspace")
```

The production server uses the same separation: `projectPath` is the project root, and `workspaceRoot` is `<project>/.cclover/workspace`.

## Required Helper

Prefer `tests/helpers/testWorkspace.ts` instead of hard-coded paths:

```ts
const { suiteRoot, projectPath, workspaceRoot } = getTestProjectPaths(
  "employee-work-session-manager"
)

beforeEach(async () => {
  await resetTestWorkspace(suiteRoot)
})
```

## Component Path Rules

Pass `projectPath` to components that manage project metadata:

- `EmployeePersistence`
- `EmployeeWorkSessionManager`
- `RoleManager`

Pass `workspaceRoot` to components that write runtime state:

- `StateManager` second constructor argument
- `MemoryManager`
- `MessageService`
- `EventLogger`
- `BossManager` when it records runtime sessions

When a component needs both, pass both explicitly:

```ts
const stateManager = new StateManager("test", workspaceRoot, projectPath)
const roleManager = new RoleManager(projectPath)
const memoryManager = new MemoryManager(workspaceRoot, stateManager)
const messageService = new MessageService(workspaceRoot, stateManager)
const ewsManager = new EmployeeWorkSessionManager(
  projectPath,
  stateManager,
  roleManager
)
```

## Cleanup Rules

- Each test file must use a unique `<suite-name>`.
- `beforeEach` should remove and recreate that suite directory unless the test explicitly needs cross-case persistence.
- `afterEach` should remove the suite directory when no post-failure inspection is needed.
- Do not write runtime data to the repository root.
- Do not use `tests/fixtures/` for runtime output; reserve fixtures for stable input data.

## Git Ignore

`tests/test-workspace/` is ignored. Generated files under it must never be committed.
