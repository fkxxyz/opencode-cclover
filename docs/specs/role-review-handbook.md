# Role Review Handbook

## Purpose

This handbook defines what to check when reviewing role-definition documents in the cclover multi-agent collaboration system.

A role review is not general writing feedback and not generic prompt criticism. Its purpose is to verify that a role definition is correct as a workflow artifact, a role contract, and a usable system prompt.

This handbook is a public review reference. It focuses only on review criteria: what to inspect, what to validate, and what kinds of problems matter. It does not define reviewer-specific reporting style, private workflow behavior, or approval-routing procedure.

---

## Review Inputs

When available, review a role against these inputs in priority order:

1. **TASK / TASKPLAN document**
2. **Technical Contract Card** inside that document
3. **Workflow design references** associated with the task
4. **The role-definition file itself**
5. **The role-definition diff**

The role should be judged against the intended workflow and contract, not only against local wording quality.

---

## What a Role Review Should Validate

A good role review checks four things:

1. **Workflow alignment**: the role matches the intended collaboration and authority model.
2. **Scope correctness**: the role is responsible for the right things and avoids the wrong things.
3. **Document correctness**: the file follows required structure and metadata rules.
4. **Operational usability**: the prompt is specific and coherent enough to be used in practice.

---

## Review Dimension 1: Workflow-Governance Correctness

This is the most important review dimension.

### 1.1 Ownership Boundaries

Check whether the role's ownership is clear and consistent with the workflow.

Questions to ask:
- What does this role own?
- What does this role explicitly not own?
- Do those boundaries match the intended workflow?
- Do the stated responsibilities overlap with another role's core responsibility?
- Does the role silently absorb work that should belong elsewhere?

What to look for:
- Responsibilities that are too broad
- Boundaries that are too vague
- Missing escalation when the role reaches a boundary
- Ownership overlap with Technical Lead, Project Manager, Software Designer, Documentation Governor, Reviewer, Repo Integrator, or Developer

Typical problems:
- A Developer role that makes software design decisions
- A Reviewer role that decides workflow architecture
- A coordinator role that also performs implementation without saying when and why

### 1.2 Communication Topology

Check whether the role communicates through the intended paths.

Questions to ask:
- Who does this role report to?
- Who gives this role work?
- Who receives this role's outputs?
- Are those communication paths explicit?
- Do those paths match the intended workflow?

What to look for:
- Missing reporting targets
- Wrong recipients for outputs, failure reports, or escalations
- Unnecessary direct communication paths that bypass the intended chain
- Ambiguous wording like "notify others as needed" without naming who and when

Typical problems:
- A reviewer reporting results to a developer instead of the designated leader
- A worker role escalating directly to top-level ownership when an intermediate coordinator is required
- A role sending final decisions to multiple parties without authority clarity

### 1.3 Authority Boundaries

Check whether the role has the right level of authority and no more.

Questions to ask:
- What decisions may this role make independently?
- What decisions must this role escalate?
- Are authority limits stated clearly?
- Does the role assume authority that belongs to another role?

What to look for:
- Hidden design authority
- Hidden approval authority
- Hidden arbitration authority
- Hidden scope-selection authority
- Missing escalation rules for decisions outside the role's remit

Typical problems:
- A Developer choosing architecture instead of escalating design questions
- A Reviewer resolving ownership conflicts instead of flagging them
- A documentation role deciding implementation behavior rather than documenting agreed behavior

### 1.4 Review / Input Model

Check whether the role works from the correct input model.

Questions to ask:
- Is the role supposed to work from assigned files, packages, tasks, or open-ended repository exploration?
- Does the text make that input model clear?
- Does the role self-expand its own scope when it should not?

What to look for:
- Full-repository assumptions where assigned-scope review is required
- Isolated-file assumptions where package-level review is required
- Missing instructions on what source material the role should read first
- Vague wording that lets the role redefine its own scope

Typical problems:
- A reviewer assuming permission to inspect the whole repository
- A role reviewing only the changed lines when the workflow expects package-level consistency review
- A role claiming to validate behavior not supported by its available inputs

### 1.5 Collaboration Model

Check whether collaboration expectations are explicit and coherent.

Questions to ask:
- Which other roles does this role normally interact with?
- For what purpose?
- Under what conditions?
- What happens when collaboration fails or becomes ambiguous?

What to look for:
- Missing collaboration partners
- Collaboration patterns that contradict responsibility boundaries
- No failure path when another role is missing, blocked, or disagrees
- Collaboration described as optional when the workflow requires it

Typical problems:
- A role that depends on another role but never says when to contact it
- A role that duplicates another role's work instead of collaborating with it
- A role that cannot handle unresolved cross-role conflicts

---

## Review Dimension 2: Legacy Workflow Drift

Check for old workflow assumptions that no longer match the current model.

Common drift patterns include:

### 2.1 Developer Absorbs Design Authority

Problem signs:
- Developer chooses architecture, interface design, package boundaries, or technical direction by default
- Design escalation is missing or treated as optional
- The role treats design as part of implementation cleanup

### 2.2 Reviewer Absorbs Design or Workflow Authority

Problem signs:
- Reviewer resolves ownership disputes instead of identifying them
- Reviewer decides workflow architecture
- Reviewer rewrites role boundaries instead of reviewing whether they are correct

### 2.3 Documentation Treated as Optional

Problem signs:
- Package documentation, navigation, or public contract updates are described as optional despite workflow requirements
- Documentation work is framed as a best-effort extra instead of a required package deliverable

### 2.4 Full-Repository Review Assumption

Problem signs:
- Reviewer is told to inspect the whole repository without assignment-based scoping
- Reviewer broadens scope on its own initiative
- Role conflates targeted review with general codebase audit

### 2.5 Wrong Communication Routing

Problem signs:
- Reviewer sends outcomes to the editor/implementer when the workflow expects leader-controlled routing
- Roles bypass designated coordinators
- Failure handling uses legacy direct peer-to-peer routing

---

## Review Dimension 3: Role-File Structural Correctness

A role file is also a governed document format. Review whether it follows the required structure.

### 3.1 Frontmatter

Check:
- Frontmatter exists
- Frontmatter is valid YAML
- `name` is present
- `description` is present when expected
- Metadata fields are coherent with the body
- The role name matches file naming expectations where required

Potential issues:
- Invalid YAML
- Missing required field
- Metadata says one thing while the body says another
- Permissions or memory schema that do not match the role behavior

### 3.2 Required Header and Footer

Check:
- Required opening header is present exactly as specified
- Required closing footer is present exactly as specified

Potential issues:
- Header missing
- Footer missing
- Wording changed in required fixed text

### 3.3 Required Section Skeleton

Check:
- Required sections are present
- Heading levels are correct
- Section order is correct
- No required section is silently removed

Core sections to verify include:
- `## Your Identity`
- `## Your Responsibilities`
- `## Your Boundaries`
- `## Working Principles`
- `## Tool Usage Guidelines`
- `## Workflow`
- `## Decision Criteria`
- `## Collaboration Patterns`
- `## Examples`
- `## Error Handling`

Potential issues:
- Missing section
- Reordered sections
- Wrong heading level
- Collapsed required sections into ad hoc prose

### 3.4 Language Constraint

Check:
- The role document uses clear English throughout the prompt body
- Language usage is readable and operationally precise

Potential issues:
- Mixed-language role prompt where English-only is required
- Unclear or culturally implicit wording that weakens execution reliability

---

## Review Dimension 4: Metadata and Body Coherence

The metadata and body should describe the same role.

### 4.1 Responsibilities Consistency

Check:
- Responsibilities in metadata and body match
- Responsibilities are specific enough to be actionable
- Responsibilities describe outcomes rather than accidental procedures
- Responsibilities do not conflict with boundaries

Potential issues:
- Metadata says the role coordinates, but the body tells it to implement
- Responsibilities are so generic that almost any role could claim them
- A listed responsibility is not supported anywhere else in the prompt

### 4.2 Boundaries Consistency

Check:
- Boundaries in metadata and body match
- Boundaries clearly exclude common scope-creep risks
- Boundaries align with workflow ownership expectations

Potential issues:
- Boundary says "do not make architectural decisions" but decision criteria implicitly allow it
- Boundary is too weak to stop authority drift
- Boundary is so broad that the role cannot complete its legitimate work

### 4.3 Tool Permissions vs Prompt Behavior

Check:
- The prompt's described behavior matches the tools the role is expected to use
- The role does not rely on tools it does not meaningfully have
- Tool guidance is role-specific, not generic filler

Potential issues:
- Prompt depends on delegation but never explains how or when to delegate
- Prompt describes heavy hiring behavior for a role that should not be staffing others
- Tool sections repeat generic tool descriptions without role-specific decision guidance

### 4.4 Memory and State Expectations

Check:
- Memory-related metadata matches actual role needs
- Custom memory schema, if present, supports rather than confuses the role
- Long-term memory assumptions are justified

Potential issues:
- Persistent memory enabled without a real cross-session need
- Memory schema fields that are never used by the prompt
- Prompt expects state tracking but metadata provides no structure for it

---

## Review Dimension 5: Prompt Usability and Internal Consistency

A role can be structurally valid but still be unusable. Review whether the prompt can actually guide behavior.

### 5.1 Identity Clarity

Check:
- The role identity explains what kind of role this is
- The role's unique value is clear
- The identity helps resolve ambiguity rather than adding flavor only

Potential issues:
- Identity is generic and indistinguishable from many other roles
- Identity contains style/personality language but no operational role definition
- Identity conflicts with stated responsibilities

### 5.2 Responsibilities and Boundaries Are Actionable

Check:
- A reader could tell what the role should do
- A reader could also tell what the role should refuse, escalate, or delegate

Potential issues:
- Responsibilities are vague slogans
- Boundaries are missing the main risks of scope creep
- Escalation conditions are not stated

### 5.3 Working Principles Have Real Priority

Check:
- Critical vs important vs suggested guidance is meaningfully separated
- Higher-priority rules are truly non-negotiable
- Rules explain why they exist where necessary

Potential issues:
- Everything is labeled critical
- Priority tiers exist but make no practical difference
- Important workflow constraints are buried as optional guidance

### 5.4 Workflow Is a Useful Default

Check:
- The workflow describes a reliable normal path
- The workflow is not so rigid that it suppresses judgment without reason
- The workflow is not so vague that it gives no help at all

Potential issues:
- The workflow is an unexplained strict script for every case
- The workflow is only a list of abstract ideals
- The workflow contradicts decision criteria or collaboration rules

### 5.5 Decision Criteria Are Concrete

Check:
- Common choices are identified
- The role has concrete criteria for making those choices
- Priority is clear when criteria conflict

Potential issues:
- "Use good judgment" replaces actual decision guidance
- Important tradeoffs are unnamed
- The role cannot distinguish when to act vs escalate

### 5.6 Collaboration Guidance Is Specific

Check:
- Named collaborators are identified
- Trigger conditions for collaboration are described
- Reporting and escalation paths are operationally clear

Potential issues:
- Collaboration is described only as "work with others as needed"
- The role does not say when another role should be involved
- Cross-role conflict handling is absent

### 5.7 Examples Reinforce the Contract

Check:
- Examples demonstrate core responsibilities and boundaries
- Examples show realistic correct and incorrect behavior
- Examples teach the most important distinctions in the role

Potential issues:
- Examples are ornamental and do not cover core risks
- Bad examples are too trivial to be useful
- Examples contradict the role's formal rules

### 5.8 Error Handling Is Practical

Check:
- The role can recognize common failure states
- The role knows when to recover locally and when to escalate
- Fallback behavior is coherent with ownership boundaries

Potential issues:
- The role has no escalation path for blockers
- The role attempts self-recovery in areas outside its authority
- The role freezes because failure handling is underspecified

---

## Review Dimension 6: Length, Redundancy, and Logical Consistency

These checks are secondary to workflow correctness, but they still matter because they directly affect whether the role can be read, trusted, and executed correctly.

### 6.1 Length and Information Density

Check whether the role is proportionate in length and dense enough in useful guidance.

Questions to ask:
- Is the document significantly longer than the role complexity justifies?
- Are the most important constraints easy to locate, or buried in excess text?
- Are any sections too short to support execution?
- Is the text mostly operational guidance, or is it filled with low-information filler?

What to look for:
- Very long prose that restates obvious points without adding constraints or decisions
- Extremely short sections that exist formally but provide no real guidance
- Major imbalance between sections, where low-value sections dominate and core contract sections are underdeveloped
- Important instructions hidden inside long narrative paragraphs instead of being made visible as actionable guidance

Typical problems:
- A role whose workflow section is many paragraphs long but still does not clarify the actual normal path
- A role whose boundaries section is only one vague sentence despite high scope-creep risk
- A role whose examples are much longer than the actual decision criteria, causing the examples to dominate the contract

Important note:
Length is not a problem by itself. A long role may be justified if the role is genuinely complex and the added text improves clarity, scope control, or execution reliability. The real issue is length that reduces usability, hides priorities, or lowers information density.

### 6.2 Redundancy and Repetition

Check whether repeated content is useful reinforcement or harmful duplication.

Questions to ask:
- Does repeated content add clarity, or merely restate the same idea?
- Do repeated rules stay semantically consistent across sections?
- Does repetition create false emphasis on lower-value content?
- Does duplication blur the role contract by expressing the same rule in multiple slightly different ways?

What to look for:
- The same responsibility repeated across identity, workflow, examples, and error handling without adding new meaning
- Repeated instructions that use slightly different wording and accidentally shift meaning
- Multiple sections restating the same boundary with different strictness
- Generic tool guidance copied into several sections
- Examples that simply restate the written rules instead of demonstrating them

Typical problems:
- A boundary appears in metadata, boundaries section, and workflow, but each version uses different escalation wording
- A role repeats "communicate clearly" in many sections while failing to specify actual communication targets
- The decision criteria section duplicates the workflow section almost verbatim

Important note:
Some repetition is legitimate. Repeating a critical boundary in both metadata and body may be useful if the meaning stays consistent. Repetition becomes a review problem when it adds no new value, shifts meaning, creates inconsistency, or makes the real contract harder to locate.

### 6.3 Logical Consistency

Check whether the role remains logically consistent across all of its sections.

Questions to ask:
- Do responsibilities, boundaries, workflow, decision criteria, collaboration patterns, examples, and error handling all point to the same role behavior?
- Does any section silently override another section?
- Do examples and fallback rules remain within the authority model?
- Can a reader infer one coherent role contract from the whole document?

What to look for:
- Responsibilities that conflict with boundaries
- Working principles that conflict with workflow
- Workflow steps that require authority forbidden elsewhere
- Decision criteria that allow actions the boundaries disallow
- Collaboration guidance that conflicts with reporting structure
- Examples that contradict formal rules
- Error handling that tells the role to solve problems outside its remit

Typical problems:
- The boundaries forbid architectural decisions, but the workflow asks the role to choose technical direction
- The tool guidance says delegation is required, but the workflow assumes solo execution
- The examples show direct communication with implementers while the collaboration model implies coordinator-controlled routing
- Error handling tells the role to resolve disputes that the authority model requires it to escalate

Important note:
A role does not need to avoid all overlap between sections. It does need all overlapping sections to remain mutually compatible. A real contradiction is not a wording preference; it is a contract defect.

---

## What Counts as a Real Review Problem

A review issue is meaningful when it affects one or more of these:

- workflow correctness
- ownership clarity
- authority boundaries
- routing and escalation correctness
- review/input scope correctness
- operational usability
- structural validity of the role file
- verifiability of claimed behavior

Do not over-focus on trivial wording preferences.

Examples of non-blocking noise:
- mild repetition that does not change meaning
- stylistic phrasing differences
- wording that can be improved but does not change workflow meaning
- moderate length that remains readable and does not hide key constraints

Examples of meaningful issues:
- role ambiguity that changes who is responsible
- wrong communication target
- missing escalation for out-of-scope decisions
- body/metadata contradiction
- required section missing
- prompt claims behavior that cannot be verified from the written instructions
- excessive length that buries key constraints or makes the role hard to execute
- repeated content that shifts meaning across sections
- logical contradiction between responsibilities, boundaries, workflow, decision criteria, examples, or error handling

---

## Lightweight Review Checklist

Use this checklist for a fast but meaningful review:

### Workflow
- [ ] Ownership boundaries are clear
- [ ] Communication targets are correct
- [ ] Escalation chain is clear
- [ ] Authority boundaries are respected
- [ ] Collaboration topology matches workflow
- [ ] No legacy workflow drift is present

### Scope
- [ ] Input/review scope is correctly defined
- [ ] Package vs isolated-file assumptions are correct
- [ ] The role does not silently broaden its own authority

### Structure
- [ ] Frontmatter is valid and coherent
- [ ] Required header is present
- [ ] Required footer is present
- [ ] Required sections are present and ordered
- [ ] English-only requirement is satisfied

### Usability and Consistency
- [ ] Responsibilities are actionable
- [ ] Boundaries are enforceable
- [ ] Tool guidance is role-specific
- [ ] Workflow is usable
- [ ] Decision criteria are concrete
- [ ] Collaboration guidance is specific
- [ ] Error handling is practical
- [ ] Length is proportionate and key constraints are easy to locate
- [ ] Repetition is useful rather than contract-blurring
- [ ] No logical contradictions exist across sections

---

## Closing Position

A role review should answer one question above all:

**Does this document define the right role, with the right boundaries, in the right workflow, in a form that can actually be used?**

If not, the review should identify exactly which contract failed:
- workflow contract
- ownership contract
- authority contract
- scope contract
- structural document contract
- operational prompt contract
