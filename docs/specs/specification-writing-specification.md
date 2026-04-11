# Specification Writing Specification

## 1. What a Specification Is

### 1.1 A Specification Is a Modular Context Building Block

A specification is not a comprehensive guide or a complete reference manual. It is a focused, self-contained module of project-specific knowledge designed to be composed with other specifications to form precise context for AI agents.

A specification defines one aspect of how work should be done in this project, without duplicating what language models already know.

### 1.2 Specifications Enable Precision Through Composition

Different roles require different context. By maintaining specifications as independent modules, the system can assemble exactly the context needed for each role - no more, no less.

This modular approach:
- eliminates redundancy across role definitions
- keeps attention focused on what matters
- allows specifications to evolve independently
- prevents context bloat that degrades AI performance

### 1.3 Why This Matters

Language models have limited attention. Every token in the context competes for that attention. Specifications that contain public knowledge or redundant information waste attention on what the model already knows, leaving less capacity for project-specific details that actually matter.

Modular specifications allow precise context assembly. Each role loads only the specifications it needs, maximizing the signal-to-noise ratio in the prompt.

### 1.4 Scope of This Specification

This document defines how to write specifications stored in `docs/specs/` for this project.

This specification itself is a prompt artifact and follows the principles defined in `prompt-specification.md`.

---

## 2. Core Principles

### 2.1 Project-specific content only because public knowledge wastes attention

#### What this means

A specification should contain only information unique to this project. If the content exists in standard documentation, common practice, or general knowledge that language models are trained on, it does not belong in a specification.

#### Why this works

Language models already know public knowledge. Including it in specifications wastes context window space and dilutes attention away from the project-specific information that actually guides behavior.

The goal is extreme conciseness - every sentence should convey information the model cannot infer from its training.

#### Examples of public knowledge (DO NOT include)

- "Git is a version control system"
- "To commit changes: git add, git commit, git push"
- "Follow PEP 8 for Python code style"
- "Use semantic versioning"
- "REST APIs use HTTP methods"
- "TypeScript is a typed superset of JavaScript"

#### Examples of project-specific content (DO include)

- "Use `assert` from `cdef/debug.h`, never `<cassert>`, because our assert converts to compiler hints in Release mode"
- "Run `python -m black {file}` before every commit"
- "API endpoints must return errors in format: `{code: string, message: string, details?: object}`"
- "Database migrations use custom tool `scripts/migrate.sh`, not standard ORM migrations"

#### Exception: Prompt-related principles

Prompt engineering principles, communication patterns, and AI interaction guidelines are an exception to the public knowledge rule. Although these are technically public knowledge, the field evolves rapidly and different models may have been trained on different prompt engineering practices.

Including prompt-related principles in specifications is acceptable when:
- They define how AI agents should communicate in this project
- They establish reasoning or decision-making patterns
- They specify interaction protocols between agents and users

Examples of acceptable prompt-related content:
- "When uncertain, ask clarifying questions before proceeding"
- "Explain reasoning before proposing solutions"
- "Use structured thinking for complex problems"
- "Communicate progress after each significant step"

#### How to judge

Ask: "Could the model learn this from public documentation or common practice?"
- If yes AND not prompt-related: Remove it
- If yes AND prompt-related: Keep it (exception)
- If no: Keep it

---

### 2.2 Extract common content into separate specifications because duplication wastes attention

#### What this means

When multiple specifications contain overlapping content, that content should be extracted into its own specification. Specifications should reference shared concepts by loading the common specification, not by duplicating its content.

This is analogous to refactoring code - when you see duplication, extract it.

#### Why this works

Duplication across specifications means:
- The same information consumes context multiple times
- Updates require changing multiple files
- Inconsistencies emerge over time
- Attention is wasted on redundant content

Extracting common content into separate specifications ensures each piece of information exists exactly once, maximizing context efficiency.

#### When to extract

Extract when:
- Two or more specifications contain similar content (even if worded differently)
- A concept is referenced by multiple specifications
- Content is logically independent and could be useful in other combinations

Do not extract when:
- Content appears in only one specification
- Extraction would create a specification too small to be meaningful (< 3 sentences)
- The content is inherently tied to a specific context and cannot be reused

#### Example: Before extraction

**Specification A:**
```markdown
## Error Handling
All functions must return errors in format: {code: string, message: string, details?: object}
Never throw exceptions in API handlers.
```

**Specification B:**
```markdown
## API Response Format
Success responses: {data: T}
Error responses: {code: string, message: string, details?: object}
```

**Problem:** Error format is duplicated.

#### Example: After extraction

**New Specification: error-format.md**
```markdown
## Error Format
All errors must use format: {code: string, message: string, details?: object}
- code: Machine-readable error identifier
- message: Human-readable description
- details: Optional additional context
```

**Specification A:**
```markdown
## Error Handling
Never throw exceptions in API handlers. Return errors using the standard error format.
```

**Specification B:**
```markdown
## API Response Format
Success responses: {data: T}
Error responses: Use standard error format.
```

**Note:** Specifications do not reference each other explicitly. The system loads both specifications when needed.

---

### 2.3 Specifications must not reference each other because context assembly handles composition

#### What this means

Specifications should never contain references like "see specification X" or "refer to the error handling specification". Each specification should be self-contained within its scope.

Composition happens at the context assembly level, not within specifications themselves.

#### Why this works

When a role needs multiple specifications, the system loads all required specifications into the context. The AI agent receives the complete composed context without needing to follow references.

References between specifications would:
- Create coupling that makes specifications harder to maintain independently
- Require the system to recursively load referenced specifications
- Make it unclear which specifications are actually needed for a role
- Waste tokens on navigation instructions instead of content

#### What to do instead

When writing a specification that relates to concepts in another specification:
- Assume the related specification will be loaded if needed
- Use consistent terminology without explaining it (the other specification explains it)
- Focus on your specification's unique content

The system that assembles context is responsible for loading all necessary specifications together.

#### Example: Wrong approach

```markdown
## API Implementation

When implementing API endpoints, follow the error handling rules 
defined in error-handling-specification.md.

For response format, see api-response-specification.md.
```

#### Example: Correct approach

```markdown
## API Implementation

When implementing API endpoints:
- Return errors using the standard error format
- Wrap successful responses in {data: T} structure
- Validate input before processing
- Log all requests with correlation IDs
```

**Note:** The terms "standard error format" and response structure are defined in other specifications. Those specifications will be loaded together with this one when needed.

---

## 3. Quality Standards

### 3.1 Conciseness

A specification should use the minimum number of words necessary to convey its information clearly.

**Indicators of good conciseness:**
- Every sentence adds new information
- No redundant explanations
- No filler words or phrases
- Examples are minimal but sufficient

**Indicators of poor conciseness:**
- Explaining why obvious things are obvious
- Repeating the same point in different words
- Long introductions before getting to the point
- Excessive examples that don't add clarity

### 3.2 Adherence to Prompt Specification

Since specifications are prompt artifacts consumed by AI agents, they must follow the principles in `prompt-specification.md`:

- Describe situations and outcomes, not just commands
- State boundaries rather than micromanaging
- Explain why recommendations exist
- Treat procedures as defaults, not rigid requirements (when appropriate)

### 3.3 Project-Specific Content Only

Every piece of information should be unique to this project. If it could be found in public documentation or is common practice, it should not be in the specification.

This is the most critical quality standard - violations directly waste context and degrade AI performance.

---

## 4. Maintenance

### 4.1 Detecting Duplication

When reviewing or updating specifications, actively look for:
- Similar concepts described in multiple specifications
- Repeated examples or patterns
- Overlapping rules or constraints

When duplication is found, extract the common content into a new specification or merge it into an existing one.

### 4.2 Detecting Public Knowledge

When reviewing specifications, question every statement:
- Is this unique to our project?
- Could an AI model learn this from public sources?
- Does this describe a standard practice?

If the answer suggests public knowledge, remove it.

### 4.3 Keeping Specifications Focused

Each specification should have a clear, narrow scope. If a specification grows beyond ~50 lines or covers multiple distinct topics, consider splitting it.

**Good scope examples:**
- Error handling format
- Database migration process
- API authentication flow
- Code formatting requirements

**Poor scope examples:**
- "Backend development guide" (too broad)
- "Miscellaneous rules" (unfocused)
- "Best practices" (vague)

### 4.4 Evolution Over Time

Specifications should evolve as the project evolves:
- Add specifications when new project-specific patterns emerge
- Remove specifications when practices are deprecated
- Update specifications when requirements change
- Extract specifications when duplication is discovered

The goal is a living set of specifications that accurately reflects current project practices without accumulating obsolete content.

---

## 5. Relationship to AGENTS.md

Specifications in `docs/specs/` should gradually replace content in `AGENTS.md` that fits the specification model.

**Content that belongs in specifications:**
- Focused, reusable rules and patterns
- Technical standards and formats
- Process definitions
- Tool usage guidelines

**Content that remains in AGENTS.md:**
- Project overview ("What This Project Does")
- Architecture overview
- Directory structure
- Integration of multiple specifications into workflows

As specifications mature, `AGENTS.md` should become thinner, serving primarily as a high-level guide that references the modular specifications loaded by the context assembly system.

---

## 6. Self-Application

This specification itself follows the principles it defines:

- It contains only project-specific guidance for writing specifications in this project
- It does not duplicate content from `prompt-specification.md` (which defines general prompt writing principles)
- It is concise, focusing on what makes specification writing unique in this context
- It does not reference other specifications explicitly (though it assumes `prompt-specification.md` will be loaded when needed)

This specification should be loaded when an AI agent is tasked with creating, modifying, or reviewing specification documents in `docs/specs/`.

---

## Closing Position

Better specifications do not attempt to teach the AI everything. Better specifications provide exactly the project-specific context needed to make informed decisions, trusting the AI's existing knowledge for everything else.

Specification writing is therefore best understood as context curation - selecting and organizing the minimal set of project-specific information that, when combined with the AI's training, enables correct behavior.
