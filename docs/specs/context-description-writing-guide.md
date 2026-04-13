# Context Description Writing Guide

## Purpose

Context descriptions are prompts for AI roles. They help AI understand when to request specific context to complete tasks effectively.

## Core Principle

**Describe the situation and outcome, not the content.**

Description answers:
- **When**: What situation requires this context?
- **What for**: What can you accomplish with this context?
- **Scope**: What does this apply to?
- **Why**: Why is this context necessary?

## Structure Pattern

### Simple Pattern

```
Use when [situation] to [outcome], because [reason]
```

**Example**:
```yaml
prompt-specification:
  description: "Use when creating or reviewing prompt-bearing artifacts to ensure prompts guide effectively without over-constraining, because prompt quality directly affects AI reasoning and adaptation"
```

### Extended Pattern

For complex contexts requiring more detail:

```
Use when [situation]. Enables [capability]. Applies to [scope]. [Why it matters].
```

**Example**:
```yaml
task-management-best-practices:
  description: "Use when managing tasks with dependencies or coordinating with the reminder system. Enables accurate status tracking to prevent unnecessary reminders. Applies to all task operations. The system relies on status to determine when to send reminder events."
```

## Writing Process

### 1. Identify the Situation

Ask: When would an AI role need this context?

**Examples**:
- "When writing role definitions"
- "When managing subordinates"
- "When analyzing system health"
- "When responding to messages"

### 2. Define the Outcome

Ask: What can the AI accomplish with this context?

**Examples**:
- "Ensures prompts guide without over-constraining"
- "Prevents unnecessary reminders"
- "Enables effective delegation"
- "Maintains communication efficiency"

### 3. Specify Scope (if not obvious)

Ask: What does this apply to?

**Examples**:
- "Applies to all prompt-bearing artifacts"
- "Applies to all task operations"
- "Applies to hiring decisions"

### 4. Explain Why

Ask: Why does this context matter?

**Examples**:
- "Because prompt quality affects AI behavior"
- "Because the system relies on status for reminders"
- "Because unclear delegation causes rework"

## Quality Checklist

Before finalizing a description, verify:

- [ ] Starts with situational trigger ("Use when" or equivalent)
- [ ] Describes what AI can accomplish (outcome)
- [ ] Specifies scope/boundaries if not obvious
- [ ] Explains why this context matters
- [ ] Avoids merely listing content topics
- [ ] Helps AI decide "do I need this for my current task?"
- [ ] Concise (one sentence preferred, two maximum)

## Examples

### Good Examples

```yaml
prompt-specification:
  description: "Use when creating or reviewing prompt-bearing artifacts to ensure prompts guide effectively without over-constraining, because prompt quality directly affects AI reasoning and adaptation"

role-document-specification:
  description: "Use when creating or modifying role definition files to ensure consistent structure and valid metadata, because the system requires specific format for role loading"

communication-reporting-completion:
  description: "Use when completing work that unblocks others to report efficiently with reference_docs instead of lengthy descriptions, because files provide evidence and save tokens"

task-management-best-practices:
  description: "Use when managing tasks with dependencies or coordinating with the reminder system to maintain accurate status and prevent unnecessary reminders, because the system relies on status to determine when to send reminder events"

git-repository-workflow:
  description: "Use when committing changes or merging branches to preserve linear history through rebase and fast-forward merge, because the project uses git bisect for debugging"
```

### Bad Examples

**❌ Content listing**:
```yaml
prompt-specification:
  description: "Prompt writing principles and best practices"
```
Problem: Only describes what's inside, not when to use it.

**❌ Topic naming**:
```yaml
role-document-specification:
  description: "Standard file format for role documents"
```
Problem: Describes the topic, not the usage situation.

**❌ Generic label**:
```yaml
task-management-best-practices:
  description: "Task management philosophy and best practices"
```
Problem: Too generic, doesn't explain when or why to use.

**❌ Missing reason**:
```yaml
git-repository-workflow:
  description: "Use when committing changes to preserve linear history"
```
Problem: Doesn't explain why linear history matters for this project.

## Anti-Patterns

### Content Listing

**Pattern**: "X principles and Y practices"

**Why bad**: Describes content structure, not usage context.

**Fix**: Describe when these principles/practices are needed and what they enable.

### Topic Naming

**Patteruide for doing X" or "Standard for X"

**Why bad**: Labels the document type, not the usage situation.

**Fix**: Describe the situation where this guide/standard is needed.

### Generic Labels

**Pattern**: "Best practices for X"

**Why bad**: Too vague, doesn't help AI decide if it's relevant.

**Fix**: Specify what situations require these practices and why.

### Missing Causality

**Pattern**: "Use when X to do Y"

**Why bad**: Doesn't explain why Y matters or why this context is necessary.

**Fix**: Add "because [reason]" to explain the necessity.

## Relationship to Prompt Specification

Context descriptions are prompts. They should follow prompt-specification principles:

1. **Describe situation over commands**: "Use when [situation]" not "Load this for X"
2. **Describe outcome over procedure**: "Enables [capability]" not "Contains steps to X"
3. **State boundaries**: "Applies to [scope]" clarifies limits
4. **Explain why**: "Because [reason]" helps AI generalize correctly

## Common Mistakes

| Mistake | Example | Fix |
|---------|---------|-----|
| Only describing content | "Prompt writing principles" | "Use when creating prompts to ensure effective guidance" |
| Missing situation | "Ensures consistent role structure" | "Use when creating roles to ensure consistent structure" |
| Missing outcome | "Use when writing roles" | "Use when writing roles to ensure valid metadata format" |
| Missing reason | "Use when committing to preserve linear history" | "...because project uses git bisect for debugging" |
| Too verbose | Three sentences with redundant information | One or two concise sentences with all key information |

## Self-Application

This specification follows its own principles:

**If this were a context entry**:
```yaml
context-description-writing-guide:
  description: "Use when creating or updating context.yml entries to write descriptions that help AI roles understand when they need specific context, because descriptions are prompts that enable AI to request relevant context for their tasks"
```

This description:
- ✅ Describes situation: "when creating or updating context.yml entries"
- ✅ Describes outcome: "help AI roles understand when they need specific context"
- ✅ Explains why: "descriptions are prompts that enable AI to request relevant context"
- ✅ Concise: One sentence
- ✅ Actionable: Clear when to use this guide
