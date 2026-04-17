# Leadership Risk Handling

## Purpose

Use when a leadership role in this system must decide whether an observed situation is a risk, how severe it is, and what concrete system action should follow.

This specification is for roles that judge, coordinate, escalate, or allocate work. It is organized around concrete signals seen in multi-agent execution rather than abstract management theory.

## Decision Rules

### Treat employee reports as system signals

Bug reports, blocker reports, design complaints, and collaboration complaints are major problem-discovery channels in this system. Do not clear them as noise before checking whether they reveal a document gap, boundary problem, workload problem, tool problem, or routing failure.

### Judge spread, not just local pain

Severity depends mainly on whether the signal can spread through:
- large project scope
- many participating roles
- long coordination chains
- parallel work
- active design freeze, task distribution, or implementation
- repeated recurrence
- critical-path work

### Prefer explicit system action

When a signal is real, respond with visible system actions such as:
- pause or avoid further task decomposition or execution assignment
- send escalation or clarification messages
- update tasks to stop bad momentum
- assign follow-up work to repair the cause
- restore missing requirement or design documents
- tighten standards so the same signal does not recur

### Short-term containment and long-term repair are separate

For recurring or structural problems, do both:
- contain the current damage now
- remove the condition that will recreate it later

## Severity Bands

### Low

Local scope, clear boundary, low spread risk.

### Medium

Already affecting local judgment, coordination, or execution stability. Likely to spread if ignored.

### High

Already affecting or likely to affect multiple people, stages, or key decisions. Continuing without repair is likely to amplify drift, conflict, or rework.

## Risk Signals

## Requirements documentation missing or too weak

### Phenomenon

- no requirements document exists
- requirement text cannot reliably state goal, scope, constraints, or acceptance criteria
- requirement information exists only in scattered messages
- work is moving, but nobody can clearly state the goal and acceptance criteria

### Why this is a risk

Leadership, design, and implementation will infer different goals from incomplete context. In larger tasks this drift propagates quickly.

### Severity judgment

- low: small project, short chain, few participants
- high: large project, many participants, parallel work, or long execution chain

### Recommended actions

- do not continue formal decomposition, design freeze, or broad execution based on guessed requirements
- use `send_message` to escalate that the task lacks a usable requirement basis, or request requirement clarification from the responsible upstream role
- if current tasks already assume guessed requirements, use `edit_tasks` to stop or restructure those tasks before they spread further
- assign follow-up work to restore a minimum requirement baseline before resuming normal execution

## Design documentation missing or too weak

### Phenomenon

- no design document exists
- design text cannot reliably state structure, boundaries, key relationships, constraints, or implementation guidance
- design knowledge exists only in scattered messages, local code, or individual memory

### Why this is a risk

Participants reconstruct structure from different local clues. In larger tasks this creates incompatible local designs.

### Severity judgment

- low: small project, simple structure, few participants
- high: large project, complex structure, many participants, or boundary-heavy work

### Recommended actions

- do not freeze structure or assign boundary-sensitive implementation on top of unstable design understanding
- use `send_message` to escalate the missing shared design basis or request design completion from the responsible design role
- if active tasks already depend on unstable design boundaries, use `edit_tasks` to pause, reorder, or narrow them
- assign follow-up work to restore the minimum design baseline before broad implementation continues

## Understanding depends mainly on code search

### Phenomenon

- people mainly use code search and local implementation reading to infer system intent
- requirement or design documents are absent or too weak to carry shared meaning
- different people infer intent from different code regions

### Why this is a risk

This usually means requirement or design baselines are too weak. In large systems local code evidence does not compose into shared meaning.

### Severity judgment

- low: very small project where local code inspection approximates full understanding
- high: large project where code search has become the main substitute for requirement or design documents

### Recommended actions

- treat this as a signal to inspect requirement and design document quality rather than as proof that code search is sufficient
- use `send_message` to request or escalate the missing semantic baseline
- assign work to restore missing requirement or design documents instead of expanding code-search-only reasoning
- keep code search as support, not as the primary source of project meaning

## An employee's working context or token load becomes too large

### Phenomenon

- one employee carries too much context in a single work stream
- messages, tool output, task material, or rework history crowd out useful signal

### Why this is a risk

This is both overload and structural imbalance. Common causes in this system include noisy tools, bad split accuracy, bad work allocation, or unclear tasks and designs that create rework.

### Severity judgment

- low: long context but contained, cause is clear, spread is limited
- medium: judgment quality and work speed are visibly degrading
- high: overload reflects a repeated structural condition rather than an isolated spike

### Recommended actions

- identify whether the main cause is noisy tool output, excessive workload, bad split, or unclear task/design baseline
- if a tool is flooding low-signal output:
  - assign immediate work to reduce that output
  - add or update a specification that constrains similar tool output later
- if one employee carries too much scope:
  - use `edit_tasks` to split, reorder, or narrow the work
  - reassign work if the current allocation is structurally bad
- if rework is the cause:
  - repair the task, design, or review baseline instead of pushing more retries onto the same worker

## An employee repeatedly reports bugs

### Phenomenon

- one employee reports bugs multiple times
- the same class of bug keeps returning
- previous fixes do not stabilize the affected area

### Why this is a risk

Repeated bug reports often reveal that implementation, design, requirements, acceptance rules, or closure flow are not holding stable.

### Severity judgment

- low: local reports, clear pattern, reliable closure
- medium: recurrence is visible and local closure is no longer stable
- high: recurrence spans stages or repeatedly exposes the same upstream weakness

### Recommended actions

- inspect the recurrence pattern before deciding the cause
- use `send_message` to request focused clarification from the role that owns the unstable layer: implementation, design, requirements, or review
- if the same unstable area keeps reappearing, create follow-up repair tasks with `edit_tasks` instead of treating each bug as an isolated event
- repair the layer that reproduces the bug rather than repeatedly patching symptoms

## An employee complains that the collaboration structure is unreasonable

### Phenomenon

- an employee says the collaboration setup is unreasonable
- the complaint may target work division, communication path, reporting chain, wait states, or review flow

### Why this is a risk

The complaint itself is not proof, but it is a high-value discovery channel for blocked paths, duplicated coordination, and ownership failures.

### Severity judgment

- low: local complaint, narrow impact, easy local adjustment
- medium: similar complaints recur around the same friction
- high: the complaint reveals persistent blockage, duplicated coordination, or ownership failure

### Recommended actions

- inspect exactly what path, wait state, or ownership seam is being complained about
- use `send_message` to gather missing observations from affected roles if the complaint spans multiple people
- if the issue is local, adjust local routing or work division
- if the issue is structural, use `edit_tasks` and role coordination messages to change ownership, routing, or collaboration flow explicitly

## An employee complains that the design is unreasonable

### Phenomenon

- an employee explicitly states that the current design is unreasonable
- the complaint may target structure, boundaries, dependencies, interfaces, or implementability

### Why this is a risk

This is usually a direct design-risk signal. If ignored, the design defect will be pushed into implementation, rework, and structural debt.

### Severity judgment

- low: local design defect, bounded impact, cheap repair
- medium: already affects a local implementation or coordination path
- high: likely to contaminate multiple downstream implementations, reviews, or integrations

### Recommended actions

- do not push implementation around an unaddressed design problem
- use `send_message` to investigate whether the issue is wrong design, incomplete design, missing design constraint, or missing reusable design standard
- if the design layer must change, pause dependent tasks with `edit_tasks` until the correction is explicit enough to guide execution
- if the same type of design gap repeats, add a new design specification instead of solving each case ad hoc

## An employee cannot solve a difficulty by themselves

### Phenomenon

- an employee reports they cannot proceed or cannot close the problem on their own
- they may lack information, authority, dependency access, routing, or a stable decision rule

### Why this is a risk

This usually means the system failed to equip the worker with something necessary to finish correctly.

### Severity judgment

- high attention by default
- higher still when the blocker is on a critical path, affects others, or persists over time

### Recommended actions

- do not respond by merely urging the same worker to keep trying
- inspect whether the missing support is task assignment, document access, standard, dependency routing, or decision authority
- use `send_message` to route the blocker to the role that can actually unblock it
- use `edit_tasks` to mark blocked work accurately and to create repair work for the missing support condition

## Different people produce clearly inconsistent understandings or plans

### Phenomenon

- different participants describe the same task, goal, design, or boundary in incompatible ways
- the mismatch goes beyond wording and threatens coordination

### Why this is a risk

This is one of the highest-value signals in this system. It usually means architecture, documentation, task wording, or ownership boundaries are too unstable to produce shared meaning.

### Severity judgment

- medium minimum once the inconsistency is clear
- high when it affects key decisions, multiple roles, or active execution

### Recommended actions

- do not let incompatible interpretations continue as if they were harmless parallelism
- use `send_message` to collect the conflicting interpretations explicitly
- compare them against the current requirement, design, and task baselines
- repair whichever shared baseline is unstable before more downstream work is assigned
- if active tasks already depend on incompatible interpretations, use `edit_tasks` to pause or narrow them until alignment is restored

## The same issue is discussed repeatedly or repeatedly reworked

### Phenomenon

- the same problem is discussed many times
- the problem appears fixed and then reappears
- each treatment reduces pain temporarily but does not close the issue stably

### Why this is a risk

This usually means the system is repeatedly treating symptoms while leaving an upstream condition unchanged.

### Severity judgment

- medium once recurrence is visible
- high when recurrence affects multiple roles, key paths, or delivery rhythm

### Recommended actions

- stop treating each recurrence as an isolated event
- inspect what upstream condition keeps recreating the issue: requirements, design, task wording, acceptance rules, ownership, or closure flow
- use `edit_tasks` to create explicit root-cause repair work rather than only local retries
- if the same recurrence crosses role boundaries, use `send_message` to align affected owners on the upstream fix

## Task decomposition exists but responsibility boundaries remain unclear

### Phenomenon

- tasks are split, but responsibility still cannot be stated clearly
- ownership of interfaces, decisions, or work slices remains unstable
- multiple people can plausibly claim or avoid the same responsibility

### Why this is a risk

This usually means the design boundary is too weak to support stable ownership. More task splitting will not repair a missing boundary.

### Severity judgment

- medium: local ambiguity with bounded impact
- high: boundary ambiguity affects several roles, task seams, or key execution paths

### Recommended actions

- do not respond by only splitting tasks further
- return to the design layer and redefine the affected boundary, interface ownership, and decision ownership
- use `send_message` to align the roles currently straddling the unclear seam
- update task structure with `edit_tasks` only after the repaired boundary is explicit enough to support stable ownership
