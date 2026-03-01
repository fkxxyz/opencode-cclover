# File Structure

Console module file structure documentation.

## Directory Tree

console/
- docs/ - Documentation directory
  - structure.md - This file
  - requirements.md - Console requirements
  - architecture.md - Console architecture
  - design.md - Main design document (entry point)
  - design-services.md - Services layer design (API + WebSocket)
  - design-state-hooks.md - State management and custom hooks design
  - design-components.md - Component layer design
  - design-patterns.md - Integration patterns and optimization
  - design-testing.md - Testing strategy
- src/ - Frontend source code (to be implemented)
- server/ - Backend server (to be implemented)
- package.json - Dependencies and scripts
- tsconfig.json - TypeScript configuration
- vite.config.ts - Vite configuration
- README.md - Console README

## Custom Folders

- docs/: Console documentation (requirements, architecture, design, testing)
- src/: Frontend source code (React + TypeScript + Vite)
- server/: Backend server (Bun + HTTP + WebSocket)

Note: src/ and server/ directories will be created during implementation phase.
