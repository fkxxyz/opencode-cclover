# TASK and TASKPLAN Document Format

## What These Documents Are

TASK and TASKPLAN documents are handoff artifacts that carry frozen execution context from Technical Lead to Project Manager. They exist to prevent the acceptance contract from drifting across scattered messages, review fragments, and ad-hoc clarifications.

When a TASK or TASKPLAN document exists, it becomes the canonical shared contract for implementation and review. Project Manager, Developer, and Reviewer should be able to execute work based on the document alone, without reconstructing intent from chat history.

---

## Why This Format Exists

### The Problem

Without a stable handoff format:
- Acceptance criteria drift across TASK prose, side messages, and review notes
- Frozen boundaries become unclear as discussion continues
- Developers and reviewers must guess which constraints are negotiable
- Project Manager cannot tell what is frozen, what is open, and what needs a ruling

### The Solution

A standard document format ensures:
- All critical handoff information appears in predictable locations
- Frozen boundaries are explicit, not implied
- Open questions are visible, not hidden in vague wording
- The contract stays stable even as clarifications arrive

---

## Document Types

### TASK

Use TASK when handing off exactly one executable task to Project Manager.

**Why this exists**: Single-task handoffs need a simpler structure than multi-task plans. A TASK document focuses on one worktree, one goal, and one acceptance contract.

**Typical filename pattern**: `.cclover/tasks/<timestamp>-TASK-<task-name>.md`

### TASKPLAN

Use TASKPLAN when handing off multiple tasks that can execute in parallel during the current stage.

**Why this exists**: When work naturally splits into parallel worktrees, a TASKPLAN provides the shared context and individual task assignments in one document. This keeps the stage-level contract visible while allowing independent execution.

**Typical filename pattern**: `.cclover/tasks/<timestamp>-TASKPLAN-<task-name>.md`

**Current-stage scope**: TASKPLAN describes only the current, immediately executable stage. Future stages may be mentioned in one sentence to provide direction, but should not be broken into detailed tasks. This preserves adaptation room as new discoveries emerge.

---

## Timestamp Convention

Timestamps provide chronological ordering and prevent filename collisions.

**Recommended command**: `date "+%Y-%m-%dT%H-%M-%S-%3N"`

**Format**: `YYYY-MM-DDTHH-MM-SS-mmm`

**Why milliseconds matter**: When multiple tasks are created in quick succession, millisecond precision prevents collisions and preserves creation order.

---

## Core Document Sections

The following sections form a reliable structure for TASK and TASKPLAN handoffs. This structure has proven effective because it separates concerns c: what problem is being solved, what boundaries are frozen, what work is expected, and what questions remain open.

### Goal

State the objective clearly. This answers "what should be accomplished" without prescribing how.

**Why this section exists**: The goal provides the success criterion. When implementation choices conflict, the goal helps decide which choice better serves the objective.

### Why Now / Why This Stage Exists

Explain why this work should happen now rather than later.

**Why this section exists**: Timing context helps Project Manager prioritize when blockers appear. If the work is urgent, PM escalates immediately. If the work can wait, PM may resolve other issues first.

### Current Risks

Describe the key short-term and long-term risks relevant to this work.

**Why this section exists**: Risk awareness shapes implementation and review judgment. A high-risk change receives more careful review. A low-risk change may proceed faster.

### Referenced Design Materials

List the design documents, index documents, or key interface files that provide necessary context.

**Why this section exists**: Rather than duplicating design detail into the handoff, reference the stable documents where that detail l keeps the handoff concise while ensuring implementation has access to necessary context.

**Typical format**: `- [path]: [why this matters]`

### Execution Assignment (TASK) / Execution Assignments (TASKPLAN)

State the worktree, primary owner, and required participants.

**Why this section exists**: Worktree topology is a Technical Lead decision, not a Project Manager invention. Explicit assignment prevents confusion about where work should happen and who should participate.

**TASK format**: Single worktree assignment  
**TASKPLAN format**: Multiple worktree assignments, one per parallel task

### Technical Contract Card

The Technical Contract Card is the stable execution and review carrier. It contains seven sections that together define the complete acceptance contract.

**Why the card exists**: Without a canonical contract, acceptance criteria drift. The card ensures PM, Developer, and Reviewer operate on the same stable understanding of what "done" means.

#### Problem / Scope

Describe what problem is being solved and what is explicitly out of scope.

**Why this section exists**: Scope boundaries prevent feature creep. When a developer encounters a related problem, the scope section clarifies whether fixinart of this task or a separate concern.

#### Frozen Architecture Boundary

State whether the work is internal-only or affects shared/public surfaces, which layers may change, and which surfaces must not expand.

**Why this section exists**: Shared and public surfaces have broader impact than internal implementation. Freezing the boundary prevents accidental semantic expansion that would affect other systems.

#### Semantic / Behavioral Requirements

Define the non-negotiable runtime or workflow semantics such as ordering, gating, timing, preservation, or recovery guarantees.

**Why this section exists**: Behavioral constraints define correctness. A reviewer cannot judge whether implementation is correct without knowing what behavior is required.

#### Required Validation Points

Describe the minimum checks a reviewer must perform and the minimum self-validation a developer should complete before review.

**Why this section exists**: Validation expectations align developer and reviewer on what "ready for review" means. This reduces review cycles caused by missing obvious checks.

#### Known Risks / Watch Points

List likely misreads, known noise, existing log noisend items that are non-blocking u they cross a stated threshold.

**Why this section exists**: Some risks are known but acceptable. Calling them out prevents reviewers from treating expected noise as a blocker.

#### Open Questions / Requires Ruling

List unresolved decisions, state who owns the decision, and clarify whether implementation can continue before the ruling arrives.

**Why this section exists**: Open questions that block implementation must be visible. If implementation can continue, that should be explicit. If implementation must pause, that should also be explicit.

#### Re-review Mapping Section

For first-pass work, this section says "No prior review findings yet." For re-review rounds, it maps prior finding IDs to developer-claimed fixes and exact re-verification points.

**Why this section exists**: Re-review efficiency depends on clear mapping between findings and fixes. Without this mapping, reviewers must re-examine the entire change to verify fixes.

### Frozen Architecture Boundary (Duplicate Section)

This section repeats the frozen boundary information in a different format for emphasis.

**Why duplication exists**: The Technical Contract Card containanonical boundary statement. This duplicate section provides a checklist format that some readers find easier to scan.

**Typical items**:
- Layer placement
- Internal-only semantics
- Protected shared/public surfaces
- Non-goals
- Success/failure semantic constraints

### Frozen Items

List decisions that downstream roles must treat as fixed for this stage.

**Why this section exists**: Explicit frozen items prevent re-litigation of settled decisions during implementation.

### Unfrozen Items

List things intentionally left open because they do not block this stage.

**Why this section exists**: Explicit unfrozen items clarify that some flexibility remains. This prevents developers from treating every detail as frozen.

### Needs Ruling

List questions that still require explicit judgment before or during implementation.

**Why this section exists**: Blocking questions must be visible. If a ruling is needed before implementation starts, that should be clear. If a ruling can arrive during implementation, that should also be clear.

### Expected Work (TASK) / Current Parallel Tasks (TASKPLAN)

Describe what Project Manager should drive others to implement.

**Why tction exists**: This section translates contract into actionable work. It bridges the gap between "what must be true" (contract) and "what must be done" (implementation).

### Acceptance Criteria

List the conditions that must be satisfied for the work to be considered complete.

**Why this section exists**: Acceptance criteria provide the final checklist. When all criteria are met, the work is ready for final integration.

### Next Stage Direction (TASKPLAN only)

Provide a one-sentence direction for the next stage.

**Why this section exists**: A brief next-stage direction helps maintain continuity without over-planning. Detailed future planning is deferred until current-stage discoveries clarify the risk picture.

---

## Maintenance and Evolution

### When Clarifications Arrive

If a later clarification changes the contract, update the document itself rather than leaving the authoritative answer only in chat.

**Why this matters**: The document is the canonical contract. If the contract changes, the document must reflect that change. Otherwise, PM, Developer, and Reviewer may operate on different understandings.

### Card Completeness

The Technical Contract Card should be minimal but complete. It in enough information to guide implementation and review, but should not duplicate entire design documents.

**Why this matters**: A bloated card wastes attention. A sparse card leaves critical gaps. The right balance provides exactly the information needed to execute and review correctly.

### Worktree Assignment Clarity

Every TASK or TASKPLAN should specify the exact worktree where work will be executed. Project Manager does not invent worktree topology—Technical Lead defines it before handoff.

**Why this matters**: Worktree topology affects integration strategy. If TL does not define it, PM must guess, which can lead to integration conflicts lat---

## Relationship to Other Artifacts

### TASK/TASKPLAN vs edit_tasks

TASK and TASKPLAN documents are formal handoff artifacts for Project Manager. The `edit_tasks` tool is for personal task tracking.

**Why this distinction matters**: Handoff documents must be stable and complete. Personal task tracking can be informal and evolving. Mixing the two creates confusion about what is canonical.

### TASK/TASKPLAN vs Design Documents

TASK and TASKPLAN documents reference design documents rather than duplicating them.

**Why this matters**: Design documents are the source of truth for detailed design. Duplicating that detail into handoff documents creates maintenance burden and drift risk.

---

## Example Structures

The following structures represent a reliable default format. They are not rigid templates—adapt them when the situation requires it, but understand why each section exists before removing or changing it.

### TASK Document Structure

```markdown
# TASK: [Task Name]

## Goal
[One clear objective]

## Why Now
[Why this should be done now]

## Current Risks
[Short-term and long-term risks]

## Referenced Design Materials
- [path]: [why this matters]

## Execution Assignment
- Worktree: [exact worktree name/path]
- Primary owner: [employee name]
- Required participants: [roles/names]

## Technical Contract Card

### Problem / Scope
[What problem is solved, plus explicit non-goals]

### Frozen Architecture Boundary
[Internal vs shared/public, allowed layers, forbidden expansions]

### Semantic / Behavioral Requirements
[Core behavioral constraints]

### Required Validation Points
- Reviewer must verify: [...]
- Developer self-validation should cover: [...]

### Known Risks / Watch Points
[Likely misreads, known noise, non-blockers]

### Open Questions / Requires Ruling
- Open question: [...]
- Decision owner: [...]
- Can implementation continue before ruling? [yes/no]

### Re-review Mapping Section
[No prior review findings yet.]

## Frozen Architecture Boundary
- Layer placement: [...]
- Internal-only semantics: [...]
- Protected shared/public surfaces: [...]
- Non-goals: [...]
- Success/failure semantic constraints: [...]

## Frozen Items
- [Fixed decision 1]
- [Fixed decision 2]

## Unfrozen Items
- [Intentionally open item] or "None"

## Needs Ruling
- [Blocking ruling item] or "None"

## Expected Work
[What PM should drive others to implement]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

### TASKPLAN Document Structure

```markdown
# TASKPLAN: [Plan Name]

## Goal
[Current-stage objective]

## Why This Stage Exists
[Why these tasks should happen now]

## Current Risks
[Key short-term and long-term risk trade-offs]

## Referenced Design Materials
- [path]: [why this matters]

## Execution Assignments
- Worktree A: [path] - Owner: [name] - Participants: [names/roles]
- Worktree B: [path] - Owner: [name] - Participants: [names/roles]

## Technical Contract Card

### Problem / Scope
[What this stage solves, plus non-goals]

### Frcture Boundary
[Internal vs shared/public, allowed layers, forbidden expansions]

### Semantic / Behavioral Requirements
[Shared behavioral constraints across the current stage]

### Required Validation Points
- Reviewer must verify: [...]
- Developer self-validation should cover: [...]

### Known Risks / Watch Points
[Likely misreads, noise, non-blockers]

### Open Questions / Requires Ruling
- Open question: [...]
- Decision owner: [...]
- Can current stage continue before ruling? [yes/no]

### Re-review Mapping Section
[No prior review findings yet.]

## Frozen Architecture Boundary
- Layer placement: [...]
- Internal-only semantics: [...]
- Protected shared/public surfaces: [...]
- Non-goals: [...]
- Success/failure semantic constraints: [...]

## Frozen Items
- [Fixed decision 1]
- [Fixed decision 2]

## Unfrozen Items
- [Intentionally open item] or "None"

## Needs Ruling
- [Blocking ruling item] or "None"

## Current Parallel Tasks
- Task A: [goal, scope, constraints]
- Task B: [goal, scope, constraints]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Next Stage Direction
[One sentence only]
```

---

## Closing Position

This document format exists to prevent contract drift and ensure stable handoffs. The structure is a reliable default that has proven effective, but it is not a rigid requirement.

If a situation requires deviation from this format, understand why each section exists before removing or changing it. The goal is clear communication, not format compliance.
