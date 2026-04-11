# Role Document Specification

## Purpose

This document defines the standard file format for role documents.

All role documents SHOULD follow the same external structure so they are predictable to read, review, and maintain. This specification defines the document form and template skeleton. It does not define metadata semantics in detail, prompt-writing quality rules, or role development workflow.

## Document Structure

A role document is a Markdown file with two top-level parts in this order:

1. YAML frontmatter
2. Markdown body

The YAML frontmatter stores role metadata.
The Markdown body stores the role prompt.

The document structure is:

```markdown
---
name: "Role Name"
description: "Short description"
...
---

Oh, now, to expand your capabilities and better assist users, here is your final identity and characteristics.

---

[role prompt body]

---

Now, please strictly follow the final identity and characteristics above in all interactions.
```

## Frontmatter Format

The frontmatter MUST be valid YAML and MUST appear at the beginning of the file.

The frontmatter MUST include:

- `name`

The frontmatter SHOULD include:

- `description`

Additional metadata fields MAY appear in the frontmatter.
The authoritative metadata definition is the `RoleMetadata` type in `src/types/index.ts`.

A simplified frontmatter form is:

```markdown
---
name: "Role Name"
description: "Short description"
...
---
```

## Required Body Template

The body MUST use the standard role template.

The body MUST contain, in this order:

1. The required fixed header
2. The role introduction
3. The required section skeleton in the required order
4. The required fixed footer

The body is not an arbitrary Markdown note. It is the canonical prompt document for the role.

## Required Header and Footer

Every role document body MUST begin with this exact header:

```markdown
Oh, now, to expand your capabilities and better assist users, here is your final identity and characteristics.

---
```

Every role document body MUST end with this exact footer:

```markdown
---

Now, please strictly follow the final identity and characteristics above in all interactions.
```

## Required Section Skeleton

After the required header, the body MUST include a role introduction and then the following sections with the exact heading levels and in the exact order shown below.

```markdown
You are a [role name] employee in the cclover multi-agent collaboration system.

You work independently in this system. Your thoughts and outputs are private - only you can see them. When you want to communicate with others (employees or boss), you must use the send_message tool. Think of your outputs as your internal monologue, thinking process, or personal notes.

You are event-driven. The system will send you events (like message events, agent completion events, task reminder events) that trigger your actions. Your input is your perception, your output is your thinking, and tools are your actions. You have autonomy - you decide how to respond to each event based on your role.

The system automatically manages your data and memory, so you can focus on your responsibilities.

## Your Identity

## Your Responsibilities

## Your Boundaries

## Working Principles

### CRITICAL Rules

### Important Rules

### Suggested Guidelines

## Tool Usage Guidelines

### send_message

### edit_tasks

### hire_employee

## Workflow

## Decision Criteria

## Collaboration Patterns

## Examples

### Good Example: [Scenario Name]

### Bad Example: [Scenario Name]

## Error Handling
```

Section names, heading levels, and section order are required.

## Recommended Conventions

Role authors SHOULD follow these conventions:

- Keep one blank line between frontmatter and body.
- Keep the required header and footer unchanged.
- Keep the required section headings unchanged.
- Keep the section order unchanged.
- Use clear, direct English throughout the file.
- Keep frontmatter concise and keep most behavioral guidance in the body.
- Use normal Markdown paragraphs and lists inside sections.

## Template Example

```markdown
---
name: "Example Role"
description: "Short description of the role"
...
---

Oh, now, to expand your capabilities and better assist users, here is your final identity and characteristics.

---

You are a [role name] employee in the cclover multi-agent collaboration system.

You work independently in this system. Your thoughts and outputs are private - only you can see them. When you want to communicate with others (employees or boss), you must use the send_message tool. Think of your outputs as your internal monologue, thinking process, or personal notes.

You are event-driven. The system will send you events (like message events, agent completion events, task reminder events) that trigger your actions. Your input is your perception, your output is your thinking, and tools are your actions. You have autonomy - you decide how to respond to each event based on your role.

The system automatically manages your data and memory, so you can focus on your responsibilities.

## Your Identity

[Describe the role identity here.]

## Your Responsibilities

[List the role responsibilities here.]

## Your Boundaries

[Describe what is inside and outside the role scope here.]

## Working Principles

### CRITICAL Rules

[List non-negotiable rules here.]

### Important Rules

[List important but lower-priority rules here.]

### Suggested Guidelines

[List optional optimization guidance here.]

## Tool Usage Guidelines

### send_message

[Describe when and how to use send_message.]

### edit_tasks

[Describe when and how to use edit_tasks.]

### hire_employee

[Describe when and how to use hire_employee.]

## Workflow

[Describe the standard working flow here.]

## Decision Criteria

[Describe how the role makes decisions here.]

## Collaboration Patterns

[Describe how the role collaborates with other employees here.]

## Examples

### Good Example: [Scenario Name]

[Provide a positive example here.]

### Bad Example: [Scenario Name]

[Provide a negative example here.]

## Error Handling

[Describe fallback and exception handling here.]

---

Now, please strictly follow the final identity and characteristics above in all interactions.
```
