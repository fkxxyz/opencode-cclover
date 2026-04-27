# Operation Handbook Specification

## Purpose

An **operation handbook** is a long-lived, repository-maintained contract that defines:

- what work an employee is allowed to do in a given working domain
- which information sources the employee is allowed to rely on (**Inputs**)
- which artifacts the employee is allowed to create or modify (**Outputs**)
- how to judge whether a delivered result is acceptable (**Acceptance**)

Operation handbooks exist to prevent “scope drift by curiosity”, especially the common failure mode where an employee relies on information outside their intended boundary (e.g., a designer reading implementation code and treating it as design truth).

This document specifies how to write and modify operation handbooks.

## Definitions

- **Handbook**: shorthand for “operation handbook”.
- **Domain**: the governed work scope (usually a repository sub-tree, module, or document set).
- **Delivery**: the employee’s delivered result for a request (committed artifacts and/or a completion report message).
- **Deterministic anchor**: a reference that a reviewer can verify without guesswork (typically a repository path or a path pattern).

## Core model

An operation handbook is **static**:

- It is not written per task instance.
- It should not include per-run identifiers, per-run routing, per-run dependencies, or per-run timelines.

An operation handbook is **closed-world**:

- **Inputs are a closed set**. Only listed inputs may be used as sources of truth.
- **Outputs are a closed set**. Only listed outputs may be created/modified.
- If work requires expanding Inputs or Outputs, treat that as a **handbook change**, not as “just do it”.

## Document format

Operation handbooks SHOULD be Markdown documents.

They SHOULD be concise (ideally one page) and expressed as **enumerated, checkable constraints**.
If a handbook exceeds one page, it MUST still keep the boundary rules and closed-world constraints near the top.

Handbooks MUST NOT create a normative dependency on other specifications or handbooks (no “required reading” cross-references).

Allowed:

- Listing concrete repository paths under Inputs/Outputs.

Not allowed:

- “Follow the rules in <other spec>”
- “See <other handbook> for details”

Handbooks MAY list any repository artifact (including other specs/handbooks) as an Input.
However, if correct execution requires a rule, the handbook MUST encode that rule as an explicit constraint rather than delegating it to another document.

### Location and naming (convention)

Handbooks SHOULD live in a small number of predictable locations so they remain discoverable and enforceable.

Acceptable patterns include:

- a dedicated documentation root (e.g. `docs/handbooks/<domain>.md`)
- a domain-local handbook file (e.g. `<domain>/OPERATION_HANDBOOK.md`)

The chosen filename SHOULD be stable over time and encode the governed domain.

## Required sections

Each operation handbook MUST contain these sections, in this order.

Optionally, a handbook MAY include a `Domain` section before `Scope` for quick scanning.
If present, `Domain` MUST be non-normative summary only; it MUST NOT replace the closed-world constraints in Inputs/Outputs.

### Scope

Defines the allowed work scope as a **set of deliverable classes**, not a single objective.

Examples of deliverable classes:

- “produce a complete design proposal”
- “answer a design consultation question”
- “write a debugging investigation report”
- “execute tests and produce a test report”
- “update a requirements document section”

Also define **Non-scope**: work that is explicitly not allowed in this domain.

### Inputs (closed-world)

List the allowed sources of truth.

Rules:

- Inputs MUST be written as a closed set.
- Every input entry MUST include a **deterministic anchor** that makes it checkable.
- Natural language MAY explain why the input is relevant, but MUST NOT replace an anchor.

Valid anchors include:

- repository file path (recommended)
- repository directory prefix + glob
- document path + a deterministic section locator

A section locator is considered deterministic only when it includes at least one of:

- the exact heading text (quoted), plus the file path
- a line range (approximate is OK) plus the file path

Do not rely on Markdown auto-generated `#anchors` as “deterministic”; they are not stable under edits.

Canonical formats (examples):

- `docs/design/foo.md :: heading "Design Constraints"`
- `docs/design/foo.md :: heading "Design Constraints" (lines ~120–170)`

Forbidden inputs MAY be listed to make common boundary violations explicit.

### Outputs (closed-world)

List the allowed artifacts this domain may create or modify.

Rules:

- Outputs MUST be written as a closed set.
- Every output entry MUST include a deterministic anchor (path or path pattern).
- If an output is a “report”, the output entry MUST specify the report location and expected permanence (committed vs. ephemeral).

By default, Outputs permission covers create/modify/rename/delete operations within the allowed output set.
If rename/delete are not allowed, state that explicitly (either in Outputs rules or in Non-scope).

Forbidden outputs MAY be listed to make “do not touch these areas” explicit.

### Acceptance

Acceptance defines **static, reusable** completion standards for the domain.

It MUST NOT be written as “for this task, do X”.

Acceptance MUST include these two universal constraints:

- **Sources Used declaration**: every delivery MUST list the sources used; the declared set MUST be a subset of Inputs.
- **Artifacts Produced/Modified declaration**: every delivery MUST list artifacts produced/modified; the declared set MUST be a subset of Outputs.

These declarations MUST appear in a checkable location:

- If the handbook’s Outputs include a committed report: include the declarations near the top of that report.
- Otherwise: include the declarations in the completion message that constitutes the delivery.

For report-like outputs, Acceptance SHOULD require minimal evidence:

- conclusions + supporting evidence
- uncertainty / confidence notes when applicable

## Writing rules

### Keep the handbook domain-level

Handbooks are about **permission and deliverable shapes**, not instance instructions.

- ❌ “Investigate bug #123 and explain root cause.”
- ✅ “Provide a design-level explanation report for a bug/incident when requested.”

### Prefer least privilege

Inputs and Outputs SHOULD be as small as possible to do the job.

Adding new Inputs/Outputs is treated as permission expansion and should be reviewed as a handbook change.

Handbooks SHOULD avoid overly broad catch-all allowances (e.g. `**/*`, repository-root patterns, or `src/**`) unless the domain truly requires it.
If such a broad allowance is necessary, the handbook SHOULD explain why it cannot be narrower.

### Anchors must be checkable

Avoid anchors that cannot be verified.

- ❌ “Any relevant files”
- ❌ “Wherever needed”
- ✅ “docs/design/**”
- ✅ “docs/requirements/requirements-*.md”
- ✅ “tests/unit/message-service/**”

### Do not encode workflow routing

Do not include:

- who reviews the work
- dependency ordering
- escalation routing

These are governed by the workflow and role definitions that inject context at runtime.

## Change policy (handbook edits)

When modifying an operation handbook:

- Treat any Inputs/Outputs expansion as a semantic change.
- Prefer minimal diffs: expand only what is required.
- Remove obsolete allowances when they are no longer needed.

If a handbook is consistently too permissive or too restrictive in practice, update it rather than relying on “common sense”.

## Minimal template

```md
# <Handbook Title>

## Domain (optional)
- Governed domain:
  - ... (paths / globs)

## Scope
- Allowed deliverable classes:
  - ...
- Non-scope:
  - ...

## Inputs (closed-world)
- Allowed:
  - ... (path / glob / section anchor)
- Forbidden (optional):
  - ...

## Outputs (closed-world)
- Allowed:
  - ... (path / glob)
- Forbidden (optional):
  - ...

## Acceptance
- Every delivery includes:
  - Sources Used (subset of Inputs)
  - Artifacts Produced/Modified (subset of Outputs)
- Evidence requirements (if reports are an output):
  - ...
```
