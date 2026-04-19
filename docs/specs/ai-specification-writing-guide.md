# AI Specification Writing Guide

## Purpose

This guide teaches AI agents how to write specifications for other AI agents in this project.

Specifications are modular context building blocks injected into AI system prompts. Different roles load different specification combinations to form precise context.

Specifications can be:
- **Markdown documents**: Prose explanations of processes, patterns, and principles
- **Code files**: Type definitions, interfaces, and implementation contracts
- **Configuration files**: Schema definitions and structural contracts

The format differs, but the principles remain the same.

## Core Principles

### Project-Specific Content Only

Include only information unique to this project. Exclude what AI models learn from training data.

**Exception**: Prompt engineering principles (field evolves rapidly, models trained on different practices).

**Decision rule**:
- Standard language/framework usage → exclude
- Project-specific tool/process/convention → include
- Universal software principle (DRY, SOLID) → exclude
- Prompt/communication pattern for this system → include (exception)

**Examples**:
- ❌ "Git is a version control system"
- ❌ "Follow PEP 8 for Python"
- ✅ "Use `assert` from `cdef/debug.h`, never `<cassert>` (converts to compiler hints in Release)"
- ✅ "When uncertain, ask clarifying questions before proceeding" (prompt pattern)

### Extract Duplication

When two+ specifications contain similar content, extract into separate specification.

**When to extract**:
- Similar content in multiple specs (even if worded differently)
- Concept referenced by multiple specs
- Content logically independent and reusable

**When not to extract**:
- Content in only one spec
- Would create spec < 3 sentences
- Content inherently tied to specific context

**Example**:
- ❌ Spec A and B both define error format `{code, message, details}`
- ✅ Separate error format specification defines once, A and B use terminology without re-explaining

### No Cross-References

Never write "see specification X" or refer to other specifications by filename.

**Why**: 
- Context assembly system loads all needed specs together. AI receives complete composed context without following references.
- Filenames may change. Natural language descriptions are more stable.

**Instead**: Use consistent terminology or natural language descriptions. Assume related specs will be loaded if needed.

**Example**:
- ❌ "Follow error handling rules defined in the error handling specification"
- ❌ "See error-format.md for details"
- ✅ "Return errors using the standard error format" (term defined in another spec loaded together)

## Quality Standards

### Information Density

Every sentence must convey project-specific information. Delete any sentence that could be removed without losing essential guidance.

**Self-check**:
- Can I delete this sentence? → If yes, delete it
- Is this explaining something obvious? → Delete
- Is this repeating an earlier point? → Delete
- Could AI infer this from training? → Delete (unless prompt-related)

### Conciseness

Use minimum words to convey information clearly.

**Indicators of good conciseness**:
- Every sentence adds new information
- Examples are one-line comparisons, not full code blocks
- No filler phrases ("it is important to note that", "as mentioned above")

**Indicators of poor conciseness**:
- Long introductions before core content
- Multiple examples showing the same distinction
- Explaining why obvious things are obvious

### Adherence to Prompt Best Practices

Specifications are prompt artifacts. Follow prompt best practice principles:
- Describe situations and outcomes, not just commands
- State boundaries rather than micromanaging
- Explain why for non-obvious recommendations
- Treat procedures as defaults when appropriate

## Structure Guidelines

### File Organization

**Markdown Specifications**:
- **Typical location**: `docs/specs/` (but not mandatory)
- **Naming**: kebab-case with .md extension (e.g., `error-format.md`, `git-workflow.md`)
- **Format**: Markdown (AI models trained on markdown-heavy data)

**Code Specifications**:
- **Location**: Where the code naturally lives (e.g., `src/types/`, `src/config/`)
- **Naming**: Follow project code conventions
- **Format**: TypeScript, JavaScript, or other project languages
- **Documentation**: Use comments as specification content

**Configuration Specifications**:
- **Location**: Where configuration naturally lives (e.g., `src/roles/context.yml`, `config/`)
- **Naming**: Follow project configuration conventions
- **Format**: YAML, JSON, or other configuration formats
- **Documentation**: Use comments or structure itself as specification

### Markdown Heading Hierarchy

Use markdown headings without numbering:
```markdown
# Specification Title

## Main Section

### Subsection

#### Detail (use sparingly)
```

Avoid: `## 2.1 Section Name` (numbering adds tokens without value)

### Code Documentation Style

**TypeScript/JavaScript**:
```typescript
/**
 * Role metadata and related type definitions
 *
 * This file defines the formal contract for role frontmatter,
 * context resolution, and loaded role definitions.
 */

/**
 * Role metadata
 *
 * Defines the metadata structure for a role. This metadata is typically
 * defined in the YAML frontmatter of a role file and controls the role's
 * behavior, permissions, and memory structure.
 */
export interface RoleMetadata {
  /** Role name (must match the filename without .md extension) */
  name: string
  
  /**
   * Stable identity ID for this role
   * Used to construct BossId (0-{id}) for meeting-mode role agents
   * Must match pattern: /^[a-z][a-z0-9-]{0,63}$/
   */
  id: string
}
```

**Key principles**:
- Block comments (`/** */`) for types, interfaces, and major structures
- Inline comments (`//`) for individual fields when brief
- Multi-line JSDoc for fields requiring explanation
- Explain project-specific constraints, not obvious type information

**YAML/Configuration**:
```yaml
# Preset role context definitions
# Keys are context IDs referenced by role metadata: contextIds: ["..."]

contexts:
  prompt-best-practices:
    description: "Use when creating or reviewing prompt-bearing artifacts"
    documents:
      - "docs/specs/prompt-best-practices.md"
```

**Key principles**:
- Use comments to explain structure and usage
- Keep comments concise and project-specific
- Explain non-obvious relationships or constraints

### Scope

Each specification should have clear, narrow scope.

**Good scope**: Error format, database migration process, API authentication flow

**Poor scope**: "Backend guide" (too broad), "Miscellaneous rules" (unfocused)

### Choosing the Right Format

**Use Markdown when**:
- Explaining processes, workflows, or patterns
- Describing principles or decision criteria
- Providing examples and comparisons
- Content is primarily prose

**Use Code when**:
- Defining type contracts or interfaces
- Specifying data structures
- The code itself is the authoritative specification
- Comments naturally document the contract

**Use Configuration when**:
- Defining schema or structure
- Specifying valid values or relationships
- The configuration format is self-documenting
- Structure itself conveys the specification

**Example decisions**:
- ✅ Markdown: "Git Repository Workflow" (process explanation)
- ✅ Code: `src/types/role.ts` (type contract)
- ✅ Configuration: `src/roles/context.yml` (context registry structure)
- ❌ Markdown: Explaining TypeScript interface syntax (code is clearer)
- ❌ Code: Explaining when to use a pattern (prose is clearer)

## Writing Process

### 1. Choose Format

Decide whether markdown, code, or configuration best expresses the specification.

**Decision criteria**:
- Is this primarily a type contract or data structure? → Code
- Is this primarily a schema or configuration structure? → Configuration
- Is this primarily a process, pattern, or principle? → Markdown

### 2. Identify Core Information

What project-specific knowledge must AI have to perform this task correctly?

Exclude:
- Standard practices AI already knows
- Information available in public docs
- Universal principles (unless prompt-related)

### 3. Organize Minimally

Use simplest structure that conveys information clearly. Avoid over-organization.

**For markdown**: Use heading hierarchy
**For code**: Use natural code organization (interfaces, types, classes)
**For configuration**: Use natural configuration structure

### 4. Write Concisely

State information directly. Delete unnecessary words.

**For markdown**: Direct prose
**For code**: Concise comments explaining project-specific constraints
**For configuration**: Brief comments explaining non-obvious relationships

### 5. Add Examples Sparingly

**For markdown**: Use one-line comparisons:
- ❌ Wrong approach
- ✅ Correct approach

Avoid full code blocks unless absolutely necessary to show structure.

**For code**: Use inline examples in comments only when the constraint is non-obvious
**For configuration**: Use example values only when the format is not self-evident

### 6. Explain Non-Obvious Rationale

If a rule's reason is not obvious, explain why. If obvious, don't explain.

**Example**:
- "No cross-references between specs" → Explain why (context assembly mechanism is project-specific)
- "Avoid duplication" → Don't explain why (DRY is universal principle)

### 7. Self-Review

Before finalizing:
- [ ] Every sentence/comment contains project-specific information?
- [ ] Can I delete any sentence/comment without losing essential guidance?
- [ ] Examples are minimal (one-line, not code blocks)?
- [ ] Explanations are for non-obvious reasons only?
- [ ] Scope is clear and focused?
- [ ] Format choice is appropriate for content type?

## Example Specifications

### Example 1: Markdown Specification

This fragment demonstrates good markdown specification style:

```markdown
# Git Repository Workflow

## Commit Messages

Format: `<type>: <description>`

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

**Example**:
- ❌ "Updated files"
- ✅ "feat: add task dependency validation"

## Branch Strategy

Work in feature branches. Merge to `main` via rebase (preserve linear history).

**Why rebase**: Project uses `git bisect` for debugging. Linear history required.

**Commands**:
```bash
git checkout -b feature/task-validation
# ... work ...
git rebase main
git checkout main
git merge --ff-only feature/task-validation
```
```

**Why this is good**:
- Project-specific: Commit format, rebase requirement, bisect usage
- Concise: No explanation of what Git is, what branches are
- Minimal examples: One-line comparison for commits
- Explains non-obvious: Why rebase (bisect requirement is project-specific)
- Focused scope: Only Git workflow, not general development process

### Example 2: Code Specification

This demonstrates good code specification style:

```typescript
/**
 * Role metadata and related type definitions
 *
 * This file defines the formal contract for role frontmatter,
 * context resolution, and loaded role definitions.
 */

export type RoleSource = "preset" | "global" | "project"

/**
 * Role metadata
 *
 * Defines the metadata structure for a role. This metadata is typically
 * defined in the YAML frontmatter of a role file and controls the role's
 * behavior, permissions, and memory structure.
 */
export interface RoleMetadata {
  /** Role name (must match the filename without .md extension) */
  name: string

  /**
   * Stable identity ID for this role
   * Used to construct BossId (0-{id}) for meeting-mode role agents
   * Must match pattern: /^[a-z][a-z0-9-]{0,63}$/
   */
  id: string

  /** Brief description of the role's purpose */
  description?: string
}
```

**Why this is good**:
- Project-specific: Explains filename matching requirement, BossId construction, pattern constraint
- Concise: No explanation of what TypeScript interfaces are
- Comments explain project-specific constraints, not obvious type information
- Code structure itself documents the contract

### Example 3: Configuration Specification

This demonstrates good configuration specification style:

```yaml
# Preset role context definitions
# Keys are context IDs referenced by role metadata: contextIds: ["..."]

contexts:
  prompt-best-practices:
    description: "Use when creating or reviewing prompt-bearing artifacts"
    documents:
      - "docs/specs/prompt-best-practices.md"

  role-metadata-types:
    description: "Use when creating or modifying role definitions to understand valid frontmatter fields"
    documents:
      - "src/types/role.ts"
```

**Why this is good**:
- Project-specific: Explains how context IDs are referenced, what description field means
- Concise: Structure is self-documenting, comments only explain non-obvious relationships
- Examples show actual usage pattern
- No explanation of YAML syntax

## Relationship to AGENTS.md

Specifications gradually replace content in `AGENTS.md` that fits the specification model.

**Belongs in specifications**:
- Focused, reusable rules and patterns
- Technical standards and formats
- Process definitions

**Remains in AGENTS.md**:
- Project overview
- Architecture overview
- Directory structure
- Integration of multiple specifications

## Self-Application

This guide follows its own principles:
- Contains only project-specific guidance for this system
- Does not explain universal principles (DRY, modularity)
- Includes examples in multiple formats (markdown, code, configuration)
- Explains non-obvious rationale (why no cross-references, format choice criteria)
- Demonstrates that specifications can be markdown, code, or configuration

This guide should be loaded when AI is tasked with creating, modifying, or reviewing specifications.
