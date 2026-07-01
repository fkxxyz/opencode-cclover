# Employee Hiring Best Practices

## Purpose

This specification defines how employees should hire other employees in the cclover three-layer collaboration model.

Hiring is organization design, not task dispatch. A new employee should represent a stable responsibility domain that can repeatedly create runnable work sessions without rediscovering the repository from scratch.

## Core Model

The collaboration model is:

```text
Role -> Employee -> Employee Work Session
```

- **Role** is the reusable occupational template that defines behavior, required arguments, and expected management or delegation behavior.
- **Employee** is the stable domain owner created from a role.
- **Employee Work Session** is the runnable task instance derived from an employee.

There is no separate root task object in the hiring model. A work session with no parent is the root of its work-session tree. Root sessions have no special semantics; every work session may execute work, coordinate work, or create child work sessions.

## When to Hire an Employee

Hire an employee when the target responsibility should persist beyond one runnable task instance.

Good reasons to hire:

- a file, document set, module, project area, or organization area needs a stable owner;
- repeated work in that domain would otherwise force agents to search the repository from scratch;
- a larger employee needs subordinate employees to preserve global perspective while delegating local domains;
- the domain needs a maintained handbook that captures responsibility boundaries and accumulated knowledge.

Do not hire an employee merely to run one task. Create an Employee Work Session for concrete task execution.

## Employee Responsibility Domains

Employee domain size has a minimum but no maximum.

- Minimum domain: one file.
- Maximum domain: unbounded; an employee may own a module, subproject, whole project, or organization area.

Employees may manage other employees. The employee organization tree expresses both responsibility decomposition and management authority: a higher employee owns a broader domain and may delegate concrete task packages by creating child work sessions from subordinate employees.

The employee organization tree and the work-session tree are related but distinct. Employee organization expresses durable responsibility and management authority. Work-session parent-child relationships express runtime task decomposition and delivery for one task tree.

Employee organization relationships are discovered from employee metadata and management tools, not from handbook paths. `hired_by` records creation provenance; it should not be treated as the only possible runtime delegation relationship.

## Hiring Requires Handbook Design

Before hiring an employee, the hiring employee must provide useful long-lived context through `context_paths`.

For recursive responsibility owners over broad or unassessed domains, useful context means clear boundary and takeover authority, not speculative internal decomposition.

If mature documentation already defines the responsibility domain, use it. Otherwise, write a Supervisor Contract before hiring. The new employee may create or improve its own Domain Handbook through later work sessions, but initial responsibility assignment must not be disguised as domain memory.

Supervisor Contract, Domain Handbook, and role prompt are different context layers.

### Context Ownership Is Mandatory

Every `context_paths` entry must have the correct owner and document identity.

Do not pass a parent employee's Supervisor Contract or Domain Handbook as a subordinate employee's contract or handbook. A Supervisor Contract defines one employee's assigned boundary; a Domain Handbook is one employee's accumulated memory. Copying either document to another employee creates overlapping responsibility and polluted memory.

When hiring a subordinate:

- create or identify a subordinate-specific Supervisor Contract;
- include a Domain Handbook only when it belongs to that subordinate domain and contains established memory;
- pass parent or sibling documents only as read-only source references when the task genuinely needs them.

The role prompt defines generic behavior for the occupation.

The Supervisor Contract is written by the assigning authority. It defines the employee's assigned responsibility boundary, explicit exclusions, domain-specific operating constraints, and authority limits. It is a delta over the role prompt, not a replacement or summary of it.

The Domain Handbook is maintained by the employee. It records accumulated project-specific knowledge discovered or confirmed after taking responsibility for the domain.

Do not use a Domain Handbook to restate the role prompt or to assign responsibility boundaries. Do not use a Supervisor Contract to restate generic role behavior or pre-fill speculative domain knowledge.

## Handbook Document Types

`context_paths` is an ordered array of project-relative documents. Use path naming and array order to express document type in the MVP.

### Supervisor Contract

Supervisor contract documents define the employee's responsibility boundary and operating contract.

Owner: the position designer or organizational owner responsible for maintaining the contract.

Contents may include, when specific to the assigned domain:

- owned domain and non-owned domain;
- domain-specific delivery constraints;
- upstream reporting requirements not already implied by the role prompt;
- management or delegation boundaries specific to this assignment;
- forbidden actions or forbidden areas.

Supervisor contracts describe relative authority relationships. They must not hard-code a specific supervisor employee name. The same employee may be used by different parent work sessions. Express relationships as caller, parent work session, delegating employee, authorized manager, or equivalent relative terms.

### Domain Handbook

Domain handbooks capture the employee's accumulated domain knowledge. They are not supervisor contracts and should not assign responsibility boundaries.

Owner: the employee responsible for the domain.

Contents should include:

- domain structure;
- common files and entry points;
- common task flows;
- historical decisions;
- risks and pitfalls;
- validation methods.

The employee should update its domain handbook when work sessions reveal reusable domain knowledge, obsolete instructions, or recurring mistakes.

### Source References

Source references are authoritative project documents the employee needs when working in its domain.

Owner: the owner of the referenced document or domain, not necessarily the employee that references it.

Examples include requirements, design documents, API specifications, review standards, and test standards.

The referencing employee treats source references as read-only unless it also owns those documents.

## `context_paths` Ordering

Order `context_paths` from strongest operating contract to supporting source material:

```yaml
context_paths:
  - "docs/handbooks/<domain>-contract.md"
  - "docs/handbooks/<domain>-handbook.md"
  - "docs/requirements-<domain>.md"
  - "docs/design-<domain>.md"
```

The example paths are illustrative, not a required directory scheme. Long-lived contract and domain handbook documents should usually live in the repository location where that project asset naturally belongs. Use `.cclover` only when no suitable repository location has been specified.

Recommended order:

1. supervisor contract documents;
2. domain handbooks;
3. source references.

Employee Work Session creation snapshots the ordered paths and reads them in order. Each injected document should be wrapped with path boundary markers so the running session can distinguish sources.

If context documents conflict, prefer earlier responsibility and contract documents for operating boundaries. If a source reference contains a newer explicit user requirement that conflicts with an older contract, report the conflict to the parent work session instead of silently overriding either document.

## Temporary Task Context

Do not place one-off task details in employee handbooks.

Temporary context belongs in the Employee Work Session description, args, or parent-child messages. Long-lived employee context should contain reusable domain guidance only.

## Hiring Checklist

Before creating employee metadata, the hiring employee should ensure:

- the responsibility domain is stable enough to justify a long-lived employee;
- the employee is not created for a responsibility narrower than one file;
- the role matches the intended kind of work;
- `description` explains what the employee is good for so other employees can select it correctly;
- `context_paths` includes this employee's own supervisor contract or equivalent responsibility-boundary document, such as an existing module maintenance guide or project governance document;
- supervisor contracts contain only assignment-specific boundaries and constraints, not generic role behavior;
- no parent, sibling, or unrelated employee Supervisor Contract is included as this employee's contract;
- `context_paths` may include an existing domain handbook only when it contains established domain memory rather than initial assignment text;
- no parent, sibling, or unrelated employee Domain Handbook is included as this employee's handbook;
- each `context_paths` entry has an intended identity: contract, handbook, or source reference;
- if no established domain memory exists, do not fabricate a domain handbook for completeness;
- contract documents avoid fixed supervisor names;
- source references are owned by the appropriate domain owners;
- task-specific details are left for work-session creation.

## Employee Work Sessions After Hiring

Hiring an employee does not start work. Concrete work starts by creating an Employee Work Session from that employee.

One work session represents one task package. Parent work sessions create child work sessions, and child work sessions report back to their parent. The work-session tree is the task decomposition and delivery path.

Any work session may create or delete a worktree when its task requires one. Worktrees and commits should remain traceable to the responsible work session, typically by recording the `employee_work_session_id` in worktree metadata or commit messages.

## Handbook Path Placement

MVP uses `context_paths: string[]`; do not introduce structured context metadata solely for handbook type.

Handbook paths are selected by document type and practical project ownership, not by a single global handbook directory.

### Contracts and Domain Handbooks

Supervisor contracts and domain handbooks are usually long-lived project assets. They capture responsibility design, employee memory, domain decisions, risks, and maintenance practices that change with the repository. Prefer placing them in the repository location where that asset naturally belongs, such as an existing documentation branch, domain handbook directory, specification area, design area, or module-maintenance document location.

Use `.cclover` only as a fallback when the hiring employee has not specified a suitable repository location. A `.cclover` fallback path is an internal storage convenience, not the conceptual home of employee handbooks.

### Source References

Source references stay at their authoritative project locations. Reference them directly from `context_paths`; do not copy or mirror them into a handbook directory. If many source references need reading guidance, create an index document that lists paths, purpose, and reading order without duplicating source content.

### Path Naming

Follow the naming style of the directory where the document lives. Prefer names that describe the domain or purpose, not employee IDs, employee names, or organization-tree position.

Employee-to-document association belongs in employee metadata and `context_paths`. File paths should not encode who hired the employee, which employee owns the document, or where the employee sits in the organization tree.

If path conventions and ordering become insufficient, a future model may replace string paths with structured entries containing path, type, and owner metadata.
