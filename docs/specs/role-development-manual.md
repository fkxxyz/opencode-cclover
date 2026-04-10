# Role Development Manual

## Purpose

This manual guides employees who create or modify role definitions in the cclover multi-agent collaboration system.

This manual assumes you already have clear requirements. It focuses on how to design role metadata and write role prompts effectively. It does not cover requirement collection methods, file format specifications, or post-creation verification procedures.

For file format and structure requirements, see `role-document-specification.md`.
For general prompt-writing principles, see `prompt-specification.md`.
For metadata field definitions, see `src/types/index.ts` (RoleMetadata interface).

---

## Prerequisites: Requirement Clarity Checklist

Before starting role development, ensure you have clear answers to these questions. If any answer is unclear, stop and clarify requirements first.

### Role Purpose
- [ ] What problem does this role solve?
- [ ] What value does this role provide to the system?
- [ ] Why does this role need to exist as a separate entity?

### Role Scope
- [ ] What are the core responsibilities of this role?
- [ ] What is explicitly outside this role's scope?
- [ ] How does this role differ from existing roles?

### Role Interactions
- [ ] Which other roles will this role work with?
- [ ] What is the reporting structure (if any)?
- [ ] What collaboration patterns are expected?

### Tool Usage Expectations
- [ ] How should this role use send_message?
- [ ] How should this role use edit_tasks?
- [ ] How should this role use create_agent?
- [ ] How should this role use hire_employee?

### Success Criteria
- [ ] What does successful execution look like for this role?
- [ ] What are the key performance indicators?
- [ ] What failure modes should be avoided?

If you cannot answer these questions clearly, the requirements are not ready for development.

---

## Metadata Design

Role metadata appears in the YAML frontmatter of the role file. Metadata defines the role's external interface and system-level properties.

The authoritative metadata definition is the `RoleMetadata` interface in `src/types/index.ts`.

### name

**What it is**: The unique identifier for this role.

**How to design it**:
- Use clear, descriptive names that reflect the role's purpose
- Prefer multi-word names for clarity (e.g., "Project Manager" not "Manager")
- Use title case for readability
- Ensure uniqueness within the role scope (project/global/preset)

**Why it matters**: The name is how other roles reference this role when hiring. A clear name reduces confusion and makes the system more understandable.

### description

**What it is**: A brief summary of the role's purpose and responsibilities.

**How to design it**:
- Keep it under 200 characters
- Include: core responsibilities, collaboration partners, brief workflow
- Write for someone deciding whether to hire this role
- Be specific enough to distinguish from similar roles

**Why it matters**: The description helps other roles (and humans) quickly understand what this role does without reading the full prompt. It serves as the role's "elevator pitch."

### soul

**What it is**: A boolean flag indicating whether this role has persistent memory with automatic summarization.

**How to design it**:
- Default to `false` for most roles
- Set to `true` only if the role needs long-term memory across sessions
- Consider: Does this role need to remember context from days/weeks ago?

**Why it matters**: Soul roles have different memory management behavior. Most roles work fine with temporary memory. Only use persistent memory when truly needed to avoid unnecessary complexity.

### responsibilities

**What it is**: An array of strings listing the role's core responsibilities.

**How to design it**:
- List 3-7 core responsibilities (not exhaustive)
- Each responsibility should be:
  - Specific and actionable
  - Verifiable (you can tell if it's done)
  - Focused on outcomes, not procedures
- Order by importance (most critical first)
- Avoid overlap with other roles' responsibilities

**Why it matters**: Responsibilities define what the role is accountable for. They help the AI understand "what I should accomplish" and help other roles understand "what I can expect from this role."

**Example structure**:
```yaml
responsibilities:
  - "Break down project requirements into executable tasks"
  - "Coordinate work between developers and reviewers"
  - "Monitor progress and identify blockers"
  - "Report project status to stakeholders"
```

### boundaries

**What it is**: An array of strings defining what is outside the role's scope.

**How to design it**:
- List 3-5 clear boundaries
- Focus on common misunderstandings or scope creep risks
- Be explicit about what the role should NOT do
- Include delegation boundaries (what to escalate vs. handle)

**Why it matters**: Boundaries are as important as responsibilities. They prevent scope creep, clarify when to delegate, and help the AI make correct "this is not my job" decisions.

**Example structure**:
```yaml
boundaries:
  - "Do not write code implementation (delegate to developers)"
  - "Do not make architectural decisions (escalate to technical lead)"
  - "Do not directly modify production systems"
```

### requiredArgs

**What it is**: A map of parameter names to their specifications, defining what information this role needs to function.

**How to design it**:
- Only include truly required parameters
- For each parameter, specify:
  - `type`: Currently only "string" is supported
  - `description`: Clear explanation of what this parameter is for
- Keep the list minimal (3-5 parameters maximum)
- Parameters should be role-specific, not generic

**Why it matters**: Required arguments ensure the role has necessary context to operate. The system will remind if these are missing from the employee's memory.

**Example structure**:
```yaml
requiredArgs:
  project_name:
    type: string
    description: "Name of the project this role manages"
  team_lead:
    type: string
    description: "Name of the team lead to report to"
```

### canHire

**What it is**: An array of role name patterns defining which roles this role is permitted to hire.

**How to design it**:
- Use exact names for specific roles: `"Developer"`
- Use glob patterns for role families: `"*Developer"`, `"Dev-*"`
- Use group references: `"group:engineers"`
- Use `[]` (empty array) if this role should not hire anyone
- Omit the field if this role should not hire anyone

**Why it matters**: Hiring permissions control team structure and prevent unauthorized role creation. They enforce organizational hierarchy and collaboration patterns.

**Example structure**:
```yaml
canHire:
  - "Frontend Developer"
  - "Backend Developer"
  - "group:qa"
```

### groups

**What it is**: An array of group names this role belongs to.

**How to design it**:
- Assign roles to logical groups based on function or capability
- Groups enable bulk permission management
- A role can belong to multiple groups
- Use lowercase, hyphenated names: `"engineers"`, `"code-quality"`

**Why it matters**: Groups simplify permission management. Instead of listing many individual roles in `canHire`, you can reference a group.

**Example structure**:
```yaml
groups:
  - "developers"
  - "code-contributors"
```

### memorySchema

**What it is**: A map defining the structure of this role's custom memory fields.

**How to design it**:
- Only define custom fields beyond the standard memory structure
- For each field, specify:
  - `type`: "string", "string[]", "object", "array", "number", "boolean"
  - `description`: What this field stores
  - `required`: Whether this field must be present (optional)
- Keep the schema simple and focused

**Why it matters**: Memory schema allows roles to store structured data beyond tasks and knowledge. It enables role-specific state management.

**Example structure**:
```yaml
memorySchema:
  active_sprint:
    type: string
    description: "Current sprint identifier"
    required: true
  blocked_tasks:
    type: string[]
    description: "List of task IDs that are blocked"
```

---

## Prompt Design

The role prompt is the Markdown body of the role file. It defines how the role thinks, decides, and acts.

The prompt follows a required structure defined in `role-document-specification.md`. This section explains how to write each section and why.

### Your Identity

**What this section should answer**:
- What is this role's position in the system?
- What is this role's core value proposition?
- How does this role relate to other roles?

**How to write it**:
- Describe the role's essence, not its tasks
- Explain why this role exists and what makes it unique
- Establish the role's perspective and mindset
- Keep it concise (2-4 paragraphs)

**Why write it this way**:
The AI needs to understand "who I am" before it can make role-appropriate decisions. A clear identity provides the foundation for all subsequent behavior. When facing ambiguous situations, the AI can ask "what would someone in this role do?" and find guidance in this section.

Identity is about being, not doing. It answers "what kind of agent am I?" rather than "what tasks do I perform?"

### Your Responsibilities

**What this section should contain**:
The exact content from the `responsibilities` field in metadata.

**How to write it**:
Copy the responsibilities array from metadata directly into this section as a list.

**Why write it this way**:
Responsibilities are defined once in metadata and reused in the prompt body. This ensures consistency between the role's external interface (metadata) and internal guidance (prompt). The AI sees the same responsibilities that other roles see when deciding whether to hire this role.

### Your Boundaries

**What this section should contain**:
The exact content from the `boundaries` field in metadata.

**How to write it**:
Copy the boundaries array from metadata directly into this section as a list.

**Why write it this way**:
Like responsibilities, boundaries are defined in metadata and reused in the prompt. This maintains consistency and ensures the AI's understanding of its limits matches what other roles expect.

### Working Principles

**What this section should answer**:
- What rules must this role always follow?
- What rules should this role usually follow?
- What rules are optional optimizations?

**How to write it**:
Organize rules into three priority tiers:

**CRITICAL Rules**:
- Absolute constraints that must never be violated
- Safety, security, and system stability requirements
- Compliance and policy requirements
- Each rule should explain WHY it is critical

**Important Rules**:
- Best practices that should be followed
- Quality and efficiency standards
- Each rule should explain the benefit of following it

**Suggested Guidelines**:
- Optional optimizations
- Nice-to-have improvements
- Each guideline should explain when it applies

**Why write it this way**:
Not all rules are equally important. When rules conflict, the AI needs to know which takes priority. A three-tier system makes priorities explicit and helps the AI make correct tradeoffs.

Explaining WHY each rule exists helps the AI generalize correctly to situations not explicitly covered. A rule with a reason can be applied intelligently; a rule without a reason becomes a brittle constraint.

### Tool Usage Guidelines

**What this section should answer**:
- When should this role use each tool?
- How frequently should each tool be used?
- What should this role consider when using each tool?

**How to write it**:
For each of the four tools (send_message, edit_tasks, create_agent, hire_employee), provide:

**When to use**:
- Specific scenarios that trigger tool usage
- Conditions that indicate this tool is appropriate
- Examples of situations where this tool is the right choice

**Frequency**:
- How often this role typically uses this tool
- Whether usage is continuous, periodic, or rare
- What factors affect usage frequency

**Key considerations**:
- Important factors to consider before using the tool
- Common mistakes to avoid
- Role-specific usage patterns

**Why write it this way**:
Tools are the role's only way to interact with the system. Different roles use the same tools in very different ways. A project manager uses send_message constantly for coordination; a calculator role might never use it.

Generic tool documentation explains what tools do. Role-specific tool guidelines explain when and how THIS role should use them. This customization is essential for appropriate behavior.

The AI needs concrete guidance, not abstract principles. "Use send_message to communicate" is too vague. "Use send_message to report task completion to your manager after finishing each major milestone" is actionable.

### Workflow

**What this section should answer**:
- What is the typical sequence of actions for this role?
- What is the standard path from input to output?
- What does a normal work cycle look like?

**How to write it**:
- Describe the recommended workflow as a sequence of steps
- Explain the purpose of each step
- Frame it as a reliable default, not a mandatory procedure
- Explicitly allow deviation when appropriate
- Use language like "typically", "usually", "a reliable approach is"

**Why write it this way**:
A workflow provides a proven path that works in most cases. It gives the AI a starting point and reduces decision paralysis. However, rigidly enforcing a workflow removes the AI's ability to adapt to unusual situations.

The goal is to guide without constraining. The workflow should feel like advice from an experienced colleague, not commands from a rigid system. When the AI encounters a situation where the standard workflow doesn't fit, it should feel empowered to find a better path.

This reflects the prompt-specification principle: describe the desired outcome and provide a recommended path, but don't force the path when a better one exists.

### Decision Criteria

**What this section should answer**:
- What choices does this role commonly face?
- How should this role make those choices?
- What factors should influence decisions?

**How to write it**:
- Identify the role's common decision points
- For each decision point, provide:
  - The choice being made
  - Concrete criteria for making the choice
  - Priority when criteria conflict
  - Examples of how to apply the criteria
- Make criteria specific and actionable
- Avoid vague guidance like "use good judgment"

**Why write it this way**:
AI agents constantly make decisions. Without clear criteria, decisions become arbitrary or inconsistent. Decision criteria transform "I don't know what to do" into "I can evaluate my options against these standards."

Specific criteria are essential. "Choose the best approach" is useless. "Choose the approach that minimizes risk when safety is critical, or maximizes speed when deadlines are tight" is actionable.

When criteria conflict, the AI needs to know which takes priority. Explicit priority ordering prevents paralysis and ensures consistent behavior.

### Collaboration Patterns

**What this section should answer**:
- Who does this role work with?
- When and why does collaboration happen?
- What does collaboration look like for this role?

**How to write it**:
- List the roles this role commonly interacts with
- For each collaboration relationship, describe:
  - When collaboration is triggered
  - What form collaboration takes (messages, hiring, etc.)
  - What each party expects from the other
  - How to handle collaboration failures
- Describe reporting chains (who to report to)
- Describe delegation patterns (who to delegate to)
- Explain conflict resolution if applicable

**Why write it this way**:
Cclover is a multi-agent system. Roles don't work in isolation. Clear collaboration patterns reduce coordination overhead and prevent misunderstandings.

The AI needs to know "when should I reach out to someone else?" and "who should I reach out to?" Without this guidance, roles either over-communicate (spamming messages) or under-communicate (working in silos).

Collaboration patterns also define the role's position in the organizational structure. Is this role a coordinator, an executor, a reviewer? The collaboration section makes this explicit.

### Examples

**What this section should answer**:
- What does correct behavior look like in practice?
- What does incorrect behavior look like?
- How can I recognize good vs. bad execution?

**How to write it**:
Provide at least 2-3 pairs of good and bad examples:

**Good Example: [Scenario Name]**:
- Describe a representative scenario
- Show the correct response
- Explain why this response is correct
- Highlight key decision points

**Bad Example: [Scenario Name]**:
- Describe the same or similar scenario
- Show an incorrect response
- Explain why this response is wrong
- Show what the correct response should have been

**Why write it this way**:
Concrete examples are more powerful than abstract rules. Examples show the rules in action and make them tangible. The AI can pattern-match against examples when facing similar situations.

Good/bad pairs create contrast that reinforces correct behavior. Seeing both what to do and what not to do strengthens understanding. The bad example often highlights common mistakes or misconceptions.

Examples should cover the role's core responsibilities. If a responsibility is important enough to list, it's important enough to demonstrate.

### Error Handling

**What this section should answer**:
- What can go wrong for this role?
- How should this role respond to problems?
- When should this role escalate vs. self-recover?

**How to write it**:
- List common error scenarios this role might encounter
- For each error type, describe:
  - How to recognize this error
  - What action to take
  - When to escalate (and to whom)
  - When to attempt self-recovery
  - What the fallback strategy is
- Provide a general fallback for unexpected errors
- Explain the escalation path clearly

**Why write it this way**:
Errors are inevitable. Without error handling guidance, the AI either freezes (doesn't know what to do) or makes poor recovery attempts (makes things worse).

Error handling is about resilience. A role that handles errors gracefully is far more valuable than one that only works in perfect conditions.

The key distinction is escalate vs. self-recover. The AI needs to know "can I fix this myself, or do I need help?" Clear escalation paths prevent both under-escalation (struggling alone when help is available) and over-escalation (bothering others with trivial issues).

---

## Creating the Role File

Once you have designed the metadata and prompt content, create the role file:

1. **Choose the file location**:
   - Project-specific: `<project>/.cclover/roles/<filename>.md`
   - User-global: `~/.config/opencode-cclover/roles/<filename>.md`
   - System preset: `src/roles/<filename>.md`

2. **Create the file with the required structure**:
   - YAML frontmatter with all metadata fields
   - Required header
   - Role introduction paragraph
   - All required sections in order
   - Required footer

3. **Verify the structure**:
   - Frontmatter is valid YAML
   - All required metadata fields are present
   - All required sections are present and in order
   - Header and footer are exactly as specified

See `role-document-specification.md` for the exact file format requirements.

---

## Final Checklist

Before considering the role complete, verify:

- [ ] All metadata fields are thoughtfully designed
- [ ] Responsibilities and boundaries are clear and non-overlapping
- [ ] Each prompt section addresses its purpose
- [ ] Tool usage guidelines are role-specific, not generic
- [ ] Working principles are prioritized and justified
- [ ] Decision criteria are concrete and actionable
- [ ] Collaboration patterns are explicit
- [ ] Examples cover core responsibilities
- [ ] Error handling covers common failure modes
- [ ] The file follows the required structure

If all items are checked, the role is ready for use.
