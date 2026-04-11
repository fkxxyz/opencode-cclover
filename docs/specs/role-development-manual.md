# Role Development Manual

## Purpose

This manual guides employees who create or modify role definitions in the cclover multi-agent collaboration system.

This manual assumes you already have clear requirements. It focuses on how to design role metadata and write role prompts effectively.

---

## Metadata Design

Role metadata appears in the YAML frontmatter of the role file. Metadata defines the role's external interface and system-level properties.

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

### contextIds

**What it is**: A list of role context specifications that should be loaded with the role.

**How to design it**: When writing any role body, first consider whether reusable guidance should be extracted into role context instead of being written directly into the role body. Keep `contextIds` minimal: include only context the role genuinely needs, not context that is merely possibly relevant. If you are significantly unsure because only part of a context applies, strongly prefer splitting that context into more precise specifications.

**Why it matters**: This keeps the role focused on the employee itself while shared working guidance remains reusable and composable.

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

The role prompt is the Markdown body of the role file. It defines how the role thinks, decides, and acts. Before adding reusable guidance to a role body, first consider whether it should be expressed as role context instead.

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
Identity establishes the role's perspective and mindset, providing the foundation for role-appropriate decisions in ambiguous situations. It answers "what kind of agent am I?" rather than "what tasks do I perform?"

### Your Responsibilities

**What this section should contain**:
The exact content from the `responsibilities` field in metadata.

**How to write it**:
Copy the responsibilities array from metadata directly into this section as a list.

**Why write it this way**:
Responsibilities are defined once in metadata and reused in the prompt body, ensuring consistency between the role's external interface and internal guidance.

### Your Boundaries

**What this section should contain**:
The exact content from the `boundaries` field in metadata.

**How to write it**:
Copy the boundaries array from metadata directly into this section as a list.

**Why write it this way**:
Boundaries are defined in metadata and reused in the prompt, maintaining consistency between the role's limits and what other roles expect.

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
A three-tier priority system makes rule priorities explicit and helps the AI make correct tradeoffs when rules conflict. Explaining WHY each rule exists enables intelligent application to situations not explicitly covered.

### Tool Usage Guidelines

**What this section should answer**:
- When should this role use each tool?
- How frequently should each tool be used?
- What should this role consider when using each tool?

**How to write it**:
For each required tool section (send_message, edit_tasks, hire_employee), provide:

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
Different roles use the same tools in very different ways. Role-specific tool guidelines explain when and how THIS role should use them, not just what the tools do. Concrete guidance like "Use send_message to report task completion to your manager after finishing each major milestone" is more actionable than abstract principles like "Use send_message to communicate".

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
A workflow provides a proven path that works in most cases, reducing decision paralysis. Frame it as a reliable default using language like "typically", "usually", "a reliable approach is" to allow deviation when the standard workflow doesn't fit the situation.

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
Specific, actionable criteria transform "I don't know what to do" into "I can evaluate my options against these standards". When criteria conflict, explicit priority ordering prevents paralysis and ensures consistent behavior.

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
In cclover's multi-agent system, clear collaboration patterns reduce coordination overhead and prevent misunderstandings. They define when to reach out to others, who to reach out to, and the role's position in the organizational structure.

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
Concrete examples make abstract rules tangible and enable pattern-matching in similar situations. Good/bad pairs create contrast that reinforces correct behavior and highlights common mistakes. Examples should cover the role's core responsibilities.

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
Error handling guidance enables resilience. The key distinction is escalate vs. self-recover - clear escalation paths prevent both under-escalation (struggling alone when help is available) and over-escalation (bothering others with trivial issues).

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
