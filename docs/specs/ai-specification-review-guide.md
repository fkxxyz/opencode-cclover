# AI Specification Review Guide

## Purpose

Checklist and decision criteria for reviewing specifications.

Assumes reviewer has loaded the specification writing guide and understands specification writing principles.

Specifications can be markdown documents, code files, or configuration files.

## Review Checklist

### Project-Specificity
- [ ] No public knowledge violations (except prompt patterns)
- [ ] Content specific enough to act on (concrete formats, commands, constraints)
- [ ] Examples demonstrate project-specific usage, not generic concepts

### Modularity
- [ ] No duplication across specifications
- [ ] No cross-references ("see specification X")
- [ ] Clear, narrow scope
- [ ] Self-contained within scope (uses consistent terminology without re-explaining)

### Prompt Quality
- [ ] Follows prompt specification principles
- [ ] Concise and information-dense (every sentence adds project-specific information)
- [ ] Explains non-obvious rationale only

### Usability
- [ ] Actionable guidance (can AI act on this without guessing?)
- [ ] Complete within scope (covers main aspects, addresses edge cases when relevant)
- [ ] Internally consistent (no contradictions, consistent terminology)
- [ ] Composes with related specifications (no conflicts, consistent terminology)

### Structure

**For Markdown**:
- [ ] Location appropriate (typically `docs/specs/`, but not mandatory)
- [ ] Naming: kebab-case with .md extension
- [ ] Clear title and heading structure

**For Code**:
- [ ] Location follows project code conventions
- [ ] Comments document project-specific constraints
- [ ] Code structure itself is clear and self-documenting

**For Configuration**:
- [ ] Location follows project configuration conventions
- [ ] Comments explain non-obvious relationships
- [ ] Structure is self-documenting where possible

## Decision Criteria

### When Is Public Knowledge Acceptable?

**Problem**: Content AI already knows from training data.

**Acceptable**:
- Prompt engineering principles (field evolves rapidly)
- Communication patterns for this system
- AI interaction protocols

**Not acceptable**:
- Standard tool/language/framework explanations
- Generic best practices without project-specific constraints
- Universal software principles (DRY, SOLID, etc.)

**Test**: Could AI learn this from public docs? → If yes and not prompt-related, remove.

### When Is Length a Problem?

**Problem**: Length that reduces usability or information density.

**Not a problem**:
- Long specification with high information density
- Complex scope genuinely requires detail
- Key constraints remain easy to locate

**Problem**:
- Long prose restating obvious points
- Important instructions buried in paragraphs
- Excessive examples dominating content
- Low information density (could be 50% shorter without losing guidance)

**Test**: Can I delete 30%+ without losing essential guidance? → If yes, too long.

### When Is Repetition Acceptable?

**Problem**: Repeated content that adds no value.

**Acceptable**:
- Reinforcement that aids comprehension
- Consistent terminology across sections
- Examples demonstrating different aspects of same rule

**Not acceptable**:
- Same rule repeated without adding meaning
- Repeated instructions with slightly different wording
- Examples that merely restate rules instead of demonstrating

**Test**: Does repetition add clarity or just restate? → If just restate, remove.

### When Is Duplication Across Specs Acceptable?

**Problem**: Same content in multiple specifications.

**Never acceptable**:
- Identical or near-identical content in multiple specs
- Shared concept that could be extracted

**Extraction threshold**:
- Two+ specs contain similar content → extract
- Extracted spec would be < 3 sentences → don't extract (too small)
- Content inherently tied to specific context → don't extract (not reusable)

**Test**: Is this concept referenced by multiple specs? → If yes, extract.

### When Are Cross-References Acceptable?

**Never acceptable**. Context assembly loads all needed specs together.

**Instead**: Use consistent terminology. Assume related specs will be loaded.

## Common Anti-Patterns

### Anti-Pattern 1: Public Knowledge Encyclopedia

**Problem**: Explaining what standard tools are instead of how we use them.

**Example (Markdown)**:
```markdown
# Git Workflow

Git is a distributed version control system. Common commands include 
git add, git commit, git push.
```

**Fix**:
```markdown
# Git Repository Workflow

Use rebase workflow to maintain linear history:
- `git pull --rebase origin main` before starting work
- `git rebase -i main` to clean up commits
- Fast-forward merge only (no merge commits)
```

**Example (Code)**:
```typescript
/**
 * Message interface
 * 
 * A message is a data structure used for communication between entities.
 * It contains information about the sender, recipient, and content.
 */
export interface Message {
  from: string
  to: string
  content: string
}
```

**Fix**:
```typescript
/**
 * Message format for employee communication
 * 
 * All inter-employee messages must use this format for MessageService.
 */
export interface Message {
  /** Employee name (must match registered employee) */
  from: string
  /** Employee name (must match registered employee) */
  to: string
  /** Message content (plain text, no markdown) */
  content: string
}
```

### Anti-Pattern 2: Cross-References

**Problem**: Referencing other specifications.

**Example**:
```markdown
Follow error handling rules defined in the error handling specification.
```

**Fix**:
```markdown
Return errors using standard error format.
```

### Anti-Pattern 3: Duplication

**Problem**: Same content in multiple specs.

**Example**: Spec A and B both define error format `{code, message, details}`.

**Fix**: Extract to separate error format specification. A and B use terminology without re-explaining.

### Anti-Pattern 4: Vague Guidance

**Problem**: Generic advice without specific constraints.

**Example (Markdown)**:
```markdown
Write clean code. Follow best practices. Use appropriate error handling.
```

**Fix**:
```markdown
- Run `python -m black {file}` before every commit
- Maximum line length: 88 characters
- Use double quotes for strings
```

**Example (Code)**:
```typescript
/**
 * Configuration options
 * 
 * Configure the system properly for best results.
 */
export interface Config {
  /** Set this to an appropriate value */
  timeout: number
}
```

**Fix**:
```typescript
/**
 * Configuration options
 */
export interface Config {
  /** Request timeout in milliseconds (default: 5000, max: 30000) */
  timeout: number
}
```

### Anti-Pattern 5: Explaining Obvious Rationale

**Problem**: Explaining why universal principles exist.

**Example**:
```markdown
Avoid duplication because it wastes context, requires multiple updates, 
and creates inconsistencies.
```

**Fix**: Delete explanation (DRY is universal principle).

**Counter-example** (non-obvious rationale):
```markdown
No cross-references between specs because context assembly loads all 
needed specs together.
```

Keep this explanation (context assembly mechanism is project-specific).

## Review Output

Report findings in priority order:

1. **Blocking issues** (must fix):
   - Public knowledge violations
   - Duplication across specs
   - Cross-references
   - Vague/unactionable guidance
   - Internal contradictions
   - Conflicts with other specs

2. **Improvement suggestions** (should fix):
   - Low information density
   - Excessive length
   - Unclear scope
   - Missing examples

3. **Minor notes** (optional):
   - Wording improvements
   - Structure suggestions

## Self-Application

This guide follows its own principles:
- Assumes reviewer loaded the specification writing guide (no repetition)
- Provides only review-specific content (checklist, decision criteria, anti-patterns)
- Includes examples for multiple formats (markdown, code)
- Explains decision criteria for non-obvious cases (when is X acceptable?)

This guide should be loaded when AI is tasked with reviewing specifications.
