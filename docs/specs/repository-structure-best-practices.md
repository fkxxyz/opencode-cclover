# Repository Structure Best Practices

## Core Philosophy: Documentation Index Maintenance Above All

The fundamental principle of repository organization is: **Documentation index maintenance is more important than any other organizational concern.**

### Why This Matters

AI agents working on a codebase face a critical problem: without proper guidance, they resort to text search tools to find what they need. This creates several severe issues:

1. **Loss of Global Vision**: Searching for specific code fragments gives AI only local context, missing the broader system design and architectural decisions.

2. **Conflicting Changes**: Without understanding the full system, AI agents may make changes that contradict existing designs, creating a "shit mountain" where different parts of the system work against each other.

3. **Repeated Mistakes**: Without access to design rationale and architectural decisions, AI agents repeat the same mistakes that were already solved.

4. **Inability to Maintain Coherence**: Text search cannot reveal the relationships between requirements, design decisions, and implementation boundaries.

### The Solution: Progressive Index System

The solution is to **prohibit code search** and require AI agents to navigate through a structured documentation index system. This forces AI to:

1. Start with the repository overview (AGENTS.md)
2. Understand what they need to do (deploy? test? write code? understand a module?)
3. Follow the appropriate index branch to progressively deeper documentation
4. Reach the specific boundary code or design document they need

This approach ensures AI maintains global vision while working on local details.

## Index Documents Are Design-Carrying Navigation Artifacts

An index document is not defined only by being a link list.

Index documents often carry multiple functions at once:

- overall design explanation
- architecture diagram or system map
- navigation entry point
- downstream document routing

"Index" is therefore a component of this document type, not its essence.

The essential property is: the document gives AI a high-level model of the repository and a valid path toward deeper material.

Because of this, any "overall design" document can also serve as an index document, as long as it both explains the system at the right level and routes readers toward the next layer of documents.

Do not force a false separation where one document explains the whole system and another separate document acts as the index if one document can do both cleanly.

## AGENTS.md: The Root Index Document

`AGENTS.md` is the top-level index document that loads into every AI agent's context. In practice, this usually makes it both a root navigation artifact and a repository-level design overview. Because of this universal loading, it should contain:

- **Repository background and basic introduction**: What this project does and why it exists
- **Technology stack and architectural decisions**: Core technical choices that affect the entire codebase
- **Repository-wide rules and conventions**: Standards that apply everywhere (commit message format, testing requirements, etc.)

`AGENTS.md` should NOT contain:

- **Detailed module documentation**: These belong in separate indexed documents
- **Specific implementation details**: These belong in design documents or boundary code
- **Lengthy tutorials or guides**: These belong in separate documentation branches

The key principle: AGENTS.md is an **index document**, not a dump of all details. It may explain the overall system, but it should do so in a way that routes readers toward the next appropriate documents instead of trying to replace them.

## Index System Architecture

### Index Branches

A well-organized repository has multiple documentation branches, each serving a different purpose. Two branches are nearly universal:

#### Requirements Branch

```
AGENTS.md 
  → System Map (overview of all systems/modules)
    → System Requirements Documents (what each system must do)
      → User Stories (specific user-facing features)
        → Acceptance Criteria (how to verify the feature works)
```

**Why this branch exists**: AI needs to understand WHAT the system should do before understanding HOW it does it. Requirements documents answer "why does this code exist?" and "what problem does it solve?"

#### Design Branch

```
AGENTS.md 
  → Architecture Diagram and Architectural Decisions (system structure and why it's structured that way)
    → Design Documents and Design Decisions (how each component works and why it works that way)
      → Boundary Code (interfaces, types, test cases)
```

**Why this branch exists**: AI needs to understand the design rationale before modifying code. Design documents answer "why is it implemented this way?" and "what constraints must be respected?"

#### Other Branches (As Needed)

Projects may need additional branches:

- **Operations Branch**: Deployment procedures, monitoring setup, incident response
- **Tools Branch**: Development tool usage, script documentation, build system
- **Contribution Branch**: How to contribute, code review process, release procedures

**Critical requirement**: Regardless of which branches exist, ALL content must be reachable through recursive indexing from AGENTS.md. No orphaned documents.

### Why Separate Requirements and Design

Requirements and design must be separate branches because they serve different purposes:

- **Requirements** define the problem space: what needs to be built and why
- **Design** defines the solution space: how it's built and why this approach was chosen

Mixing them creates confusion: AI cannot distinguish between "this is what we need" and "this is how we chose to do it." Separating them allows AI to:

1. Verify that design actually satisfies requirements
2. Propose alternative designs without questioning requirements
3. Understand which constraints are fundamental (requirements) vs. implementation choices (design)

## Index Format Specification

### Link Format

Every index entry must use markdown link format:

```markdown
[Description of what this document contains and why you should read it](path/to/document.md)
```

### Description Guidelines

Index descriptions should be **a paragraph, not a sentence**. The description should focus on **WHY** rather than **WHAT**:

❌ Bad: `[User authentication module](docs/auth.md)`

✅ Good: `[User authentication module - Read this when implementing any feature that needs to verify user identity, because this document defines the authentication contract that all other modules depend on. Understanding this first prevents security vulnerabilities and integration issues.](docs/auth.md)`

The description should answer:
- **When should I read this?** (What task or question does this document help with?)
- **Why does this document exist?** (What problem does it solve or what decision does it record?)
- **What will I understand after reading it?** (What knowledge or capability will I gain?)

### No Standardized Section Titles

Do NOT enforce standardized section titles like "## Requirements Documents" or "## Design Documents". 

**Why**: Different projects have different organizational needs. What matters is that the index has **value** - it helps AI navigate from general to specific, from problem to solution, from requirements to implementation.

The structure should emerge naturally from the project's needs, not from a template.

### Indexing Does Not Require "Pure Index" Documents

Do NOT assume an index document must be mostly links with minimal explanation.

An effective index document may include:

- high-level design framing
- system maps or architecture diagrams
- scope boundaries
- navigation links into more detailed documents

What matters is not whether the document looks like a directory listing. What matters is whether it helps AI move from global understanding to the correct deeper materials without search-driven guesswork.

## Recursive Indexing to Boundary Code

The ultimate goal of the index system is to ensure AI can reach **all boundary code** without using text search.

### What is Boundary Code?

Boundary code defines the contracts and interfaces between components:

- **Type definitions**: Data structures and their constraints
- **Interface definitions**: Function signatures and protocols
- **Test cases**: Expected behavior and edge cases
- **API contracts**: External interfaces and their guarantees

### Why Boundary Code Must Be Indexed

Boundary code is the most critical code in the system because:

1. **It defines contracts**: Changes to boundary code affect all code that depends on it
2. **It documents intent**: Well-written boundary code explains what the system should do
3. **It prevents conflicts**: Understanding boundaries prevents AI from making incompatible changes

If AI must search for boundary code, it will miss critical contracts and create incompatible changes.

### How to Ensure Complete Indexing

Every boundary code file should be reachable through this path:

```
AGENTS.md 
  → [Branch index] 
    → [Module/component documentation] 
      → [Specific boundary code file]
```

If a boundary code file is not indexed, it is effectively invisible to AI agents following the index system.

## Recommended Directory Structure

The following structure is a **recommendation**, not a requirement. Adapt it to your project's needs.

### Top-Level Directories

```
/
├── src/           - Source code (business logic goes here)
├── tests/         - Test cases (all test code)
├── docs/          - Documentation (all markdown documentation)
├── scripts/       - Utility scripts (build, deploy, maintenance)
├── config/        - Configuration files (environment-specific settings)
├── examples/      - Example code and sample configurations
└── AGENTS.md      - Root index document
```

### Documentation Structure (docs/)

```
docs/
├── requirements/     - Requirements branch documents
│   ├── system-map.md
│   └── [system-name]/
│       ├── overview.md
│       ├── user-stories.md
│       └── acceptance-criteria.md
├── design/          - Design branch documents
│   ├── architecture.md
│   ├── decisions/   - Architectural Decision Records (ADRs)
│   └── [component-name]/
│       ├── design.md
│       └── api.md
└── [other-branches]/ - Additional branches as needed
```

### Boundary Code Organization

Boundary code should be organized to make it easy to index:

```
src/
├── types/        - Type definitions (TypeScript interfaces, data models)
├── interfaces/   - Interface definitions (API contracts, protocols)
├── contracts/    - Formal contracts (OpenAPI specs, GraphQL schemas)
└── [business-code]/  - Business logic (organized by feature/module)
```

### Test Organization

```
tests/
├── unit/         - Unit tests (test individual functions/classes)
├── integration/  - Integration tests (test component interactions)
├── e2e/          - End-to-end tests (test full user workflows)
└── fixtures/     - Test data and mocks
```

## Content Classification Guide

To help AI decide where content belongs, here are common content types and their typical locations:

| Content Type | Typical Location | Index Branch |
|-------------|------------------|--------------|
| User requirements | `docs/requirements/` | Requirements |
| System architecture | `docs/design/architecture.md` | Design |
| Design decisions | `docs/design/decisions/` | Design |
| API documentation | `docs/design/[component]/api.md` | Design |
| Type definitions | `src/types/` | Design (indexed from component docs) |
| Interface definitions | `src/interfaces/` | Design (indexed from component docs) |
| Test cases | `tests/` | Design (indexed from component docs) |
| Deployment procedures | `docs/operations/` | Operations (if branch exists) |
| Tool usage guides | `docs/tools/` | Tools (if branch exists) |
| Git workflow rules | `AGENTS.md` or `docs/contributing/` | Root or Contribution |
| Code style guide | `AGENTS.md` or `docs/contributing/` | Root or Contribution |

**Key principle**: If you're unsure where something belongs, ask: "What question does this answer?" and "Who needs this information to do what task?" The answer will guide you to the right location and index branch.

## Maintaining the Index System

### When Adding New Content

1. **Determine the content type**: Is this a requirement, design, operation, or tool documentation?
2. **Find the appropriate branch**: Which index branch should lead to this content?
3. **Create or update the index**: Add a link with a descriptive paragraph explaining why this content exists
4. **Verify recursive reachability**: Can you reach this content by following links from AGENTS.md?

### When Modifying Existing Content

1. **Update the index description**: If the content's purpose changed, update the "why" in the index
2. **Check for broken links**: Ensure all links still point to the correct locations
3. **Verify the index path**: Is this still the right place in the index hierarchy?

### When Removing Content

1. **Remove the index entry**: Don't leave broken links
2. **Check for dependent indexes**: Did other documents link to this content?
3. **Consider archiving**: If the content has historical value, move it to an archive directory and update indexes accordingly

## Anti-Patterns to Avoid

### ❌ Orphaned Documentation

**Problem**: Creating documentation files that are not linked from any index.

**Why it's bad**: AI agents following the index system will never find this content. It might as well not exist.

**Solution**: Every document must be reachable through recursive indexing from AGENTS.md.

### ❌ "Everything in AGENTS.md"

**Problem**: Putting all documentation directly in AGENTS.md because "AI will see it."

**Why it's bad**: AGENTS.md loads into every AI's context. Bloating it with details wastes context window and makes it hard to find the overview.

**Solution**: AGENTS.md should be an index, not a manual. Move details to separate documents and link to them.

### ❌ Mixing Requirements and Design

**Problem**: Putting "what we need" and "how we built it" in the same document.

**Why it's bad**: AI cannot distinguish between fundamental requirements and implementation choices, leading to inappropriate changes.

**Solution**: Separate requirements branch from design branch. Link between them when design decisions reference requirements.

### ❌ "README-driven documentation"

**Problem**: Creating many README.md files in subdirectories instead of a structured index.

**Why it's bad**: AI must search for README files or guess their locations. No clear path from overview to details.

**Solution**: Use a structured index system. READMEs can exist for human convenience, but the index system is for AI navigation.

### ❌ Relying on Code Comments for Design Rationale

**Problem**: Putting design decisions and architectural rationale only in code comments.

**Why it's bad**: AI must search through code to find design rationale, losing global context. Comments are scattered and hard to maintain.

**Solution**: Design rationale belongs in design documents, indexed from AGENTS.md. Code comments should reference design documents for details.

## Summary

The key to effective repository organization for AI agents is:

1. **Maintain a structured index system** starting from AGENTS.md
2. **Separate requirements from design** in different index branches
3. **Write index descriptions that explain WHY**, not just what
4. **Ensure all boundary code is reachable** through recursive indexing
5. **Prohibit code search** - force AI to navigate through indexes to maintain global vision

This approach ensures AI agents understand the full context before making changes, preventing the creation of conflicting designs and maintaining system coherence.
