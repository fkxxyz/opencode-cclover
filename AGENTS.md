# opencode-cclover - Development Guidelines

## What This Project Does

An OpenCode plugin for multi-agent collaboration. It runs AI employees inside project workspaces, gives them messaging and task-management tools, persists their state, and supports background delegation plus a web console.

## Architecture

**Tech stack**
- Runtime: Bun
- Language: TypeScript (strict mode)
- SDK: `@opencode-ai/plugin`, `@opencode-ai/sdk`
- Storage: YAML files on local filesystem
- Coordination: `eventemitter3`, `proper-lockfile`

**Core modules**
- `src/index.ts` - plugin entry
- `src/server/` - HTTP/WebSocket server and project registry
- `src/core/` - `MessageService`, `MemoryManager`, `EventLoop`, `BossManager`, `RoleManager`
- `src/state/StateManager.ts` - employee state persistence
- `src/tools/` - OpenCode tools exposed to agents
- `src/utils/` - context building, registries, Mermaid generation
- `console/` - React-based management console

**Important flow**
1. Plugin initializes `GlobalCcloverService`
2. Config loads enabled projects from `~/.config/opencode-cclover/config.yaml`
3. Each project gets runtime services under `.cclover/workspace/`
4. Opening the project exposes tools and starts employee event loops

## Project Structure

```text
src/         core plugin code
tests/       unit and integration tests
console/     management console frontend and docs
docs/        requirements, design, and development specs
workspace_test/ manual plugin test workspace
```

Use `docs/structure.md` for the full file map when navigation by directory names is not enough.

## Configuration

Primary config: `~/.config/opencode-cclover/config.yaml`

Key fields:
- `bosses` - boss identities
- `projects[]` - managed projects
- `port` - server port, overridden by `CCLOVER_PORT`
- `logLevel` - log level, overridden by `CCLOVER_LOG_LEVEL`
- `modelTypes` - role model mapping with same-layer redirection

Model resolution order:
1. global config
2. `src/config/preset.yaml`
3. OpenCode default model

## Role System

Role files are markdown with YAML frontmatter.

Priority order:
1. `<project>/.cclover/roles/<role>.md`
2. `~/.config/opencode-cclover/roles/<role>.md`
3. `src/roles/<role>.md`

Use role files as the authority for role behavior. Related prompt artifacts outside those paths are secondary unless project docs explicitly say otherwise.

Supported frontmatter fields:
- `name`
- `description`
- `model_type`
- `requiredArgs`
- `canHire`
- `groups`

## Development Rules

### Before Every Commit

Run all three:

```bash
bun run type-check
bunx prettier --write "src/**/*.ts" "tests/**/*.ts"
bun test
```

Notes:
- `bun run type-check` checks both `src/` and `tests/`
- `bun run build` is for publish/build validation, not the required pre-commit type check
- Commit messages must be English Conventional Commits

## Code Conventions

Project-specific conventions derived from the current codebase:
- Use double quotes and no semicolons
- Order imports: Node built-ins, external packages, internal modules
- Use `import type` for type-only imports
- Use Chinese for implementation comments; use JSDoc for public APIs
- Prefer `export function` over `export const` for exported functions
- Handle filesystem missing-file cases with `catch (error: any)` and `error.code === "ENOENT"`
- Prefer `async`/`await`; do not introduce `.then()` chains in core code
- Keep public module exports collected in nearby `index.ts` files
- Test filenames use `.test.ts`

## Common Pitfalls

- **File writes**: use `proper-lockfile` for YAML/runtime persistence to avoid corruption
- **Task dependencies**: let `MemoryManager` validate DAG changes instead of bypassing it
- **Session mapping**: tools that need employee identity must use `SessionRegistry` to map `sessionID`

## Testing

- Unit tests: `bun test tests/unit/...`
- Integration tests: `bun test tests/integration/...`
- Manual plugin testing: `./start-test-server.sh`
- Alternative manual start: `OPENCODE_CONFIG_DIR="$(pwd)/workspace_test/.opencode" opencode serve --port 4099`
- File-writing tests must follow [testing-workspace-standard.md](testing-workspace-standard.md): use suite-specific directories under `tests/test-workspace/`, keep `projectPath` separate from `.cclover/workspace`, and never write runtime data to the repository root or `tests/fixtures/`.

Coverage targets for core modules:
- `MessageService`: 100%
- `MemoryManager`: 100%
- tools: 80%+

## Documentation

This section indexes all project documentation. Follow the appropriate branch based on your task.

### Getting Started

[README.md - Project overview and quick start](README.md) - Read this first if you're new to the project. Explains what opencode-cclover does, current implementation status, and how to install. Start here to understand the project scope before diving into requirements or design.

[USAGE.md - Usage guide and configuration](USAGE.md) - Read this when you need to configure, deploy, or use the plugin. Covers installation methods, configuration file format, and basic usage patterns. Essential for setting up development or production environments.

[deployment.md - Deployment procedures](deployment.md) - Read this when deploying to production or setting up multi-project configurations. Covers advanced deployment scenarios, troubleshooting, and production best practices.

### Requirements Branch

[docs/requirements.md - System requirements overview](docs/requirements.md) - Read this to understand WHAT the system must do and WHY it exists. This is the requirements entry point that explains the overall problem space and links to detailed subsystem requirements. Start here before reading design documents to understand the fundamental needs.

Detailed subsystem requirements (read when working on specific subsystems):
- [docs/requirements-messaging.md](docs/requirements-messaging.md) - Message system requirements
- [docs/requirements-memory.md](docs/requirements-memory.md) - Memory management requirements
- [docs/requirements-tasks.md](docs/requirements-tasks.md) - Task management requirements
- [docs/requirements-tools.md](docs/requirements-tools.md) - Tool system requirements
- [docs/requirements-runtime.md](docs/requirements-runtime.md) - Employee runtime requirements
- [docs/requirements-boss.md](docs/requirements-boss.md) - Boss system requirements
- [docs/requirements-project-management.md](docs/requirements-project-management.md) - Project management requirements

### Design Branch

[docs/architecture.md - System architecture and module structure](docs/architecture.md) - Read this to understand HOW the system is structured and WHY this architecture was chosen. Explains core components, data flow, and architectural decisions. Read this before modifying any core module to understand system-wide design constraints and component relationships.

[docs/design.md - Design overview and component designs](docs/design.md) - Read this to understand the overall design approach and navigate to specific component designs. This is the design entry point that links to detailed component design documents.

Detailed component designs (read when implementing or modifying specific components):
- [docs/design-message-service.md](docs/design-message-service.md) - MessageService design
- [docs/design-memory-manager.md](docs/design-memory-manager.md) - MemoryManager design
- [docs/design-event-loop.md](docs/design-event-loop.md) - EventLoop design
- [docs/design-tools.md](docs/design-tools.md) - Tool system design
- [docs/design-roles.md](docs/design-roles.md) - Role definition design
- [docs/design-plugin-entry.md](docs/design-plugin-entry.md) - Plugin entry design
- [docs/design-meeting-mode.md](docs/design-meeting-mode.md) - Meeting Mode design

[docs/migration-guide.md - Role format migration guide](docs/migration-guide.md) - Read this when upgrading role definitions from old format to new YAML frontmatter format. Contains migration procedures and compatibility information.

### Development Standards Branch

[docs/specs/repository-structure-best-practices.md - Repository organization principles](docs/specs/repository-structure-best-practices.md) - Read this when organizing documentation, deciding file placement, or maintaining the documentation index. Explains why documentation index maintenance is critical and how to structure repositories for AI navigation.

**Role Development:**
- [docs/specs/role-development-manual.md](docs/specs/role-development-manual.md) - Read when creating new roles
- [docs/specs/role-document-specification.md](docs/specs/role-document-specification.md) - Role file format specification
- [docs/specs/role-context-best-practices.md](docs/specs/role-context-best-practices.md) - Role context design patterns
- [docs/specs/role-review-handbook.md](docs/specs/role-review-handbook.md) - Role review procedures
- [docs/specs/role-review-report-format.md](docs/specs/role-review-report-format.md) - Role review report format

**Communication Patterns:**
- [docs/specs/communication-patterns/ai-to-ai-communication-principles.md](docs/specs/communication-patterns/ai-to-ai-communication-principles.md) - Core AI-to-AI communication efficiency principles
- [docs/specs/communication-patterns/responding-to-messages.md](docs/specs/communication-patterns/responding-to-messages.md) - How to respond to messages
- [docs/specs/communication-patterns/delegating-work.md](docs/specs/communication-patterns/delegating-work.md) - Work delegation patterns
- [docs/specs/communication-patterns/escalating-issues.md](docs/specs/communication-patterns/escalating-issues.md) - Issue escalation patterns
- [docs/specs/communication-patterns/reporting-completion.md](docs/specs/communication-patterns/reporting-completion.md) - Completion reporting patterns
- [docs/specs/communication-patterns/requesting-information.md](docs/specs/communication-patterns/requesting-information.md) - Information request patterns
- [docs/specs/communication-patterns/consulting-and-discussion.md](docs/specs/communication-patterns/consulting-and-discussion.md) - Consultation patterns

**Code Development:**
- [docs/specs/code-development-standards.md](docs/specs/code-development-standards.md) - Code quality and development standards
- [docs/specs/code-review-handbook.md](docs/specs/code-review-handbook.md) - Code review procedures
- [docs/specs/git-repository-workflow.md](docs/specs/git-repository-workflow.md) - Git workflow and branching strategy

**Task and Project Management:**
- [docs/specs/task-management-best-practices.md](docs/specs/task-management-best-practices.md) - Task management patterns
- [docs/specs/task-document-format.md](docs/specs/task-document-format.md) - Task document format
- [docs/specs/manager-execution-pattern.md](docs/specs/manager-execution-pattern.md) - Manager role execution patterns
- [docs/specs/subordinate-management-philosophy.md](docs/specs/subordinate-management-philosophy.md) - Subordinate management principles
- [docs/specs/leadership-risk-handling.md](docs/specs/leadership-risk-handling.md) - Leadership risk handling
- [docs/specs/risk-analysis-practice.md](docs/specs/risk-analysis-practice.md) - Risk analysis practices
- [docs/specs/system-entropy-analysis.md](docs/specs/system-entropy-analysis.md) - System entropy analysis

**Specification Writing:**
- [docs/specs/ai-specification-writing-guide.md](docs/specs/ai-specification-writing-guide.md) - How to write specifications
- [docs/specs/ai-specification-review-guide.md](docs/specs/ai-specification-review-guide.md) - How to review specifications
- [docs/specs/prompt-best-practices.md](docs/specs/prompt-best-practices.md) - Prompt best practices
- [docs/specs/context-description-writing-guide.md](docs/specs/context-description-writing-guide.md) - Context description writing
- [docs/specs/responsibility-document-placement.md](docs/specs/responsibility-document-placement.md) - Read when choosing repository paths for versioned responsibility documents such as contracts and handbooks. Defines placement rules by domain shape without redefining document semantics or role-specific obligations.

### Console Documentation

[console/docs/requirements.md - Console requirements](console/docs/requirements.md) - Read this to understand console feature requirements. The console is a separate module with its own documentation branch.

[console/docs/architecture.md - Console architecture](console/docs/architecture.md) - Read this to understand console frontend architecture before modifying console code.

Additional console design documents:
- [console/docs/design.md](console/docs/design.md) - Console design overview
- [console/docs/design-components.md](console/docs/design-components.md) - Component design
- [console/docs/design-services.md](console/docs/design-services.md) - Service layer design
- [console/docs/design-state-hooks.md](console/docs/design-state-hooks.md) - State management design
- [console/docs/design-patterns.md](console/docs/design-patterns.md) - Design patterns
- [console/docs/design-testing.md](console/docs/design-testing.md) - Testing strategy
- [console/docs/design-event-timeline.md](console/docs/design-event-timeline.md) - Event timeline feature
- [console/docs/session-link-feature.md](console/docs/session-link-feature.md) - Session link feature
- [console/docs/structure.md](console/docs/structure.md) - Console file structure

### Reference Documents

[docs/structure.md - Project file structure reference](docs/structure.md) - Complete file structure listing. Read when you need to locate specific files or understand the overall project organization.

### Documentation Maintenance

**Code Comments**:
- Use Chinese for implementation details
- Use JSDoc for public API documentation
- Explain WHY, not WHAT (code shows what)

**Keeping Documentation Current**:
- Update design documents when making architectural changes
- Keep README.md synchronized with implementation status
- Update this documentation index when adding new documents
