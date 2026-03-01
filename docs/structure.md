# File Structure

```txt
opencode-cclover/
├── .gitignore
├── .prettierignore
├── .prettierrc
├── package.json
├── tsconfig.json
├── bun.lock
├── AGENTS.md                                    - Project development guidelines (English)
├── AGENTS.zh-CN.md                              - Project development guidelines (Chinese)
├── README.md                                    - Project overview and quick start
├── USAGE.md                                     - Usage guide
├── deployment.md                                - Deployment and configuration guide
├── config.example.yaml                          - Example configuration file
├── software-development-directory-standard.md   - Directory structure standard
├── start-test-server.sh                         - Test server startup script
├── docs/                                        - Design documentation
│   ├── structure.md                             - This file
│   ├── requirements.md                          - Main requirements document
│   ├── requirements-messaging.md                - Messaging system requirements
│   ├── requirements-memory.md                   - Memory system requirements
│   ├── requirements-tasks.md                    - Task management requirements
│   ├── requirements-tools.md                    - Tool system requirements
│   ├── requirements-runtime.md                  - Employee runtime requirements
│   ├── requirements-project-management.md       - Project management requirements
│   ├── architecture.md                          - System architecture
│   ├── architecture-modules.md                  - Module design details
│   ├── design.md                                - Main design document
│   ├── design-message-service.md                - MessageService design
│   ├── design-memory-manager.md                 - MemoryManager design
│   ├── design-event-loop.md                     - EventLoop design
│   ├── design-tools.md                          - Tool system design
│   ├── design-roles.md                          - Role definition design
│   └── design-plugin-entry.md                   - Plugin entry design
├── src/                                         - Source code
│   ├── index.ts                                 - Plugin entry point
│   ├── core/                                    - Core services
│   │   ├── MessageService.ts
│   │   ├── MemoryManager.ts
│   │   ├── EventLoop.ts
│   │   └── index.ts
│   ├── config/                                  - Configuration management
│   │   ├── ConfigManager.ts
│   │   ├── CandidateProjectsManager.ts
│   │   └── index.ts
│   ├── state/                                   - State management
│   │   ├── StateManager.ts
│   │   ├── EmployeeRegistry.ts
│   │   ├── EventHistory.ts
│   │   └── index.ts
│   ├── tools/                                   - Tool implementations
│   │   ├── SendMessageTool.ts
│   │   ├── EditTasksTool.ts
│   │   ├── CreateAgentTool.ts
│   │   ├── HireEmployeeTool.ts
│   │   └── index.ts
│   ├── utils/                                   - Utility modules
│   │   ├── MermaidGenerator.ts
│   │   ├── ContextBuilder.ts
│   │   ├── SessionRegistry.ts
│   │   ├── AgentRegistry.ts
│   │   └── index.ts
│   ├── roles/                                   - Role definitions
│   │   ├── Calculator.ts
│   │   └── index.ts
│   ├── server/                                  - HTTP server
│   │   ├── ConsoleServer.ts
│   │   ├── Router.ts
│   │   └── index.ts
│   ├── api/                                     - API handlers
│   │   ├── projects.ts
│   │   ├── employees.ts
│   │   └── index.ts
│   ├── types/                                   - TypeScript type definitions
│   │   └── index.ts
│   └── lib/                                     - Shared libraries
│       ├── background.ts
│       ├── logger.ts
│       └── index.ts
├── tests/                                       - Test suite
│   ├── unit/                                    - Unit tests─ MessageService.test.ts
│   │   ├── MemoryManager.test.ts
│   │   ├── EventLoop.test.ts
│   │   ├── Calculator.test.ts
│   │   ├── ContextBuilder.test.ts
│   │   ├── MermaidGenerator.test.ts
│   │   ├── SessionRegistry.test.ts
│   │   ├── AgentRegistry.test.ts
│   │   ├── EmployeeRegistry.test.ts
│   │   └── EventHistory.test.ts
│   ├── integration/                             - Integration tests
│   │   └── ...
│   ├── api/                                     - API tests
│   │   └── ...
│   ├── fixtures/                                - Test data
│   │   └── ...
│   ├── demo/                                    - Demo scenarios
│   │   └── ...
│   └── workspace_test/                          - Test workspace
│       └── ...
├── console/                                     - Web management console (separate module)
│   └── ...                                      (has its own structure)
├── workspace_test/                              - Manual testing workspace
│   ├── .opencode/
│   └── .cclover/
├── dist/                                        - Build output (generated)
│   └── ...
└── node_modules/                                - Dependencies (generated)
    └── ...
```

## Custom Folders

- **docs/**: Design and requirements documentation following software development directory standard
- **src/**: TypeScript source code organized by module type (core, tools, utils, etc.)
- **tests/**: Comprehensive test suite with unit, integration, and API tests
- **console/**: Web management console (separate frontend application)
- **workspace_test/**: Manual testing environment with real OpenCode server
- **dist/**: TypeScript build output (generated by `bun run build`)

## Notes

- **console/** is a separate module with its own documentation and structure
- **dist/** and **node_modules/** are generated directories (excluded from version control)
- **.cclover/** directories are runtime workspaces created by the plugin
