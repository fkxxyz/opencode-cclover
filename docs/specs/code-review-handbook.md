# Code Review Handbook

## Purpose

This handbook defines the code review process and standards for the cclover multi-agent collaboration system. It establishes what reviewers check, how they check it, and how they report results.

## Review Philosophy

Reviews validate complete change packages against explicit task and design references.

A complete package includes:
- Implementation code
- Tests validating changed behavior
- Design documentation updates (when behavior semantics change)
- Navigation or index updates (when adding or moving components)

Reviews check compliance with task documents, Technical Contract Cards, design references, and project standards. Missing required package components are blocking failures, not optional cleanup.

Reviews do not invent missing design semantics, approve incomplete packages by privately filling gaps, or impose personal architectural preferences not required by references.

## Review Scope

### What to Review

Focus on:
- Logic correctness against the assigned task scope
- Compliance with the Technical Contract Card
- Compliance with referenced software design documents
- Validation completeness for the reviewed requirement
- Package completeness for the assigned scope
- Missing required design-document updates tied directly to the reviewed change
- Missing required navigation or index updates tied directly to the reviewed change
- Security, safety, and sensitive-data exposure risks
- Repository hygiene for the reviewed file set

### What Not to Review

Do not focus on:
- Unrelated files outside the assigned file list
- Speculative repository-wide redesign not required by the task
- Pure style suggestions with no correctness or workflow impact

### Scope Boundaries

Review only:
- The assigned worktree
- The assigned file list
- The assigned TASK or TASKPLAN document
- Referenced design materials

Do not widen scope unless explicitly reassigned by the leader.

## Review Checklist

### 1. Reference Compliance

**Check**: Does the implementation follow the task document and design references?

**Validation**:
- Read the TASK or TASKPLAN document
- Identify the Technical Contract Card
- Read referenced design documents
- Compare implementation against these references

**Failure conditions**:
- Implementation contradicts task requirements
- Implementation violates design constraints
- Implementation follows wrong task or design model

### 2. Package Completeness

**Check**: Does the package include all required companion updates?

**Validation**:
- Identify what the task requires beyond code changes
- Check if design documents need updates (when behavior semantics change)
- Check if navigation or index files need updates (when adding or moving components)
- Verify all required pieces are present in the reviewed file list

**Failure conditions**:
- Code changes behavior semantics but design doc unchanged
- New module added but navigation index not updated
- Task references required updates that are missing from package

### 3. Validation Evidence

**Check**: Is there concrete evidence that the implementation works?

**Validation**:
- Check for test output in completion reports
- Verify tests cover the changed behavior
- Check for logs or command output demonstrating correctness
- Note when validation is impossible in current environment

**Failure conditions**:
- No test output provided
- Tests don't cover changed behavior
- Claims of correctness without evidence

### 4. Code Quality

**Check**: Does the code follow project-specific conventions?

**Validation**:
- Check formatting rules (quotes, semicolons, indentation)
- Check import organization
- Check naming conventions
- Check error handling patterns
- Check comment language and style

**Failure conditions**:
- Inconsistent style within the package
- Violates project conventions defined in AGENTS.md
- Error handling patterns don't match existing codebase

## Review Approach

Your goal is to validate the change package against task requirements and produce a structured review report.

A reliable approach:

1. **Confirm inputs**: Verify you have leader name, TASK or TASKPLAN document path, worktree path, and assigned file list. Ask the leader if any are missing.

2. **Read review context**: Read the TASK document, identify the Technical Contract Card, read referenced design materials, and determine what the package must contain.

3. **Collect diff evidence**: Run `git diff` only for assigned files in the assigned worktree to prevent scope creep and ensure reviews stay focused on the assigned task.

4. **Run available validation**: Inspect tests, logs, command output, or other provided evidence. Record validation gaps instead of assuming correctness when proof is missing.

5. **Review by priority**: Focus on critical issues first (correctness, safety, contract violations, protected surfaces) before spending time on lower-priority concerns (design compliance, package completeness, validation sufficiency, then secondary quality issues).

6. **Write structured result**: Use the mandatory output format (see Output Format section). Ensure every blocking finding includes substantive reasoning. Separate blockers from noise.

7. **Handle outcome**: If PASS, send result summary to the leader. If FAIL or FAIL-SERIOUS, write a REVIEWER report file beside the TASK document, then send failed result and report path to the leader.

8. **Stop**: Do not send review feedback directly to the developer. Do not begin a second review round unless reassigned by the leader.

If you discover a more direct path to validation, you may follow it instead.

## Output Format

Every completed review MUST use these top-level fields in this exact order:

### 1. Result

Values: `PASS` / `FAIL` / `FAIL-SERIOUS`

**PASS**: No blocking finding exists in the assigned review scope.

**FAIL**: At least one blocking finding exists.

**FAIL-SERIOUS**: A blocking finding exists and also indicates severe process risk, dangerous shortcut, serious contract breach, or escalation-worthy behavior.

Do NOT use extra labels such as `PASS WITH COMMENTS`.

### 2. Review Scope

State what was reviewed:
- TASK or TASKPLAN document path
- Worktree path
- Assigned file list
- Referenced design materials

### 3. Summary

One-sentence conclusion of the review result.

### 4. Findings

Numbered findings list using mandatory schema (see Findings Classification section).

### 5. Contract Check

Line-by-line contract verification:
- Assigned file scope respected / violated
- Requirement satisfied / not satisfied
- Design reference followed / not followed
- Required package companions present / missing
- Validation evidence sufficient / insufficient
- Protected surfaces unchanged / violated
- Repo hygiene clean / blocked

Do not write a generic paragraph.

### 6. Validation Evidence

Concrete evidence actually checked:
- TASK document path reviewed
- Assigned file list reviewed
- Exact `git diff` scope inspected
- Referenced design docs read
- Tests, logs, or command output checked
- Absence of evidence when proof was missing

Never imply you validated something you did not actually validate.

### 7. Noise / Environment Notes

Explicitly separate:
- Harmless noise that does not block review
- Environment limitations that reduce confidence but are not blockers
- Actual blocking environment issues that must become findings

### 8. Final Action

Name the next owner and next action.

Examples:
- `Leader may treat this review as passed and continue the workflow.`
- `Leader routes F1 back for implementation fix, then reassigns review.`
- `Leader routes F2 to Software Designer because design clarification is required before more coding.`
- `Stop coding. Leader escalates F3 to Technical Lead for ruling before implementation continues.`

## Findings Classification

### Mandatory Schema

Every finding MUST be numbered `F1`, `F2`, `F3`, etc.

Every finding MUST include all of these subfields:
- `title`
- `severity`: `serious` / `major` / `minor`
- `classification`: (see classifications below)
- `location`
- `reason`
- `impact`
- `required_fix`
- `escalation`

### Classifications

**implementation defect**: The expected behavior or package requirement is already clear, and the reviewed implementation or required related update is wrong, incomplete, or missing.

**validation gap**: The implementation may be plausible, but the available tests, logs, or other proof are insufficient.

**architecture ambiguity**: The reviewed changes expose unclear or conflicting architectural expectations.

**model mismatch**: The implementation follows the wrong task, workflow, design, data, or protocol model.

**requires TL ruling**: The issue cannot be resolved responsibly without Technical Lead judgment.

### Reasoning Requirement

Every FAIL or FAIL-SERIOUS finding MUST include a substantive `reason` that explains:

1. Which requirement, boundary, package expectation, or validation point is violated
2. Why the current diff or evidence does not satisfy it
3. Why the issue belongs to the chosen classification
4. Whether coding may continue after a normal fix, or whether work must stop for escalation

Never write a finding that only states the symptom.

## Package Completeness Rules

### When Design Updates Are Required

Design document updates are required when:
- Implementation changes behavior semantics
- Implementation changes interface contracts
- Implementation changes architectural boundaries
- Task explicitly references design documents that must be updated

### When Navigation Updates Are Required

Navigation or index updates are required when:
- New modules or components are added
- Existing modules or components are moved
- Module structure changes affect navigation

### Failure Handling

If required package components are missing, this is a blocking `implementation defect`, not optional cleanup.

The finding should:
- Identify which required component is missing
- Explain why it's required (reference to task or design doc)
- Specify what must be added to complete the package

## Escalation Paths

### Route to Developer

Use when:
- Implementation defect with clear fix
- Validation gap that developer can address
- Package incompleteness that developer can complete

Action: Leader routes finding back for fix, then reassigns review.

### Route to Software Designer

Use when:
- Architecture ambiguity requires design clarification
- Design references are incomplete or conflicting
- Implementation exposes design gaps

Action: Leader routes finding to Software Designer for design clarification before more coding.

### Route to Technical Lead

Use when:
- Issue requires TL ruling
- Serious process risk or contract breach
- Decision outside reviewer's authority

Action: Stop coding. Leader escalates to Technical Lead for ruling before implementation continues.

## REVIEWER Report File

### When to Write

Write a REVIEWER report file when the result is FAIL or FAIL-SERIOUS.

### Filename Format

Generate timestamp using:
```bash
date "+%Y-%m-%dT%H-%M-%S-%3N"
```

If TASK file is:
```
<task-timestamp>-TASK-<task-name>.md
```

Then REVIEWER report file MUST be:
```
<review-timestamp>-REVIEWER-TASK-<task-name>.md
```

### Location

Write the report in the same directory as the TASK or TASKPLAN document.

### Content

Include the full structured review result with all mandatory fields.

## Example Review

### Good Example: FAIL with Complete Reasoning

```text
Result: FAIL
Review Scope: Reviewed .cclover/tasks/2026-04-09T15-30-00-123-TASK-runtime-retry-fix.md, referenced design doc docs/runtime/retry.md, and git diff for src/core/RetryRuntime.ts and docs/runtime/retry.md in the assigned worktree.
Summary: Retry logic changed, but the required design update is missing and the package is incomplete.

Findings:
- F1
  - title: Missing required design-document update for retry-state change
  - severity: major
  - classification: implementation defect
  - location: docs/runtime/retry.md
  - reason: The TASK and referenced design material make the retry-state semantics part of the review contract. The code diff changes those semantics, but the related design document was not updated in the reviewed package. Because the required companion update is already clear from the task context, this is a blocking implementation defect rather than optional documentation cleanup.
  - impact: Review and later work may operate on stale design semantics.
  - required_fix: Update the required design document in the same task package and align it with the implemented behavior.
  - escalation: Leader routes this back for package completion, then reassigns review.

Contract Check:
- Assigned file scope respected: SATISFIED
- Retry semantic requirement: PARTIALLY SATISFIED
- Required design companion update: NOT SATISFIED
- Validation evidence for retry-state behavior: PARTIALLY SATISFIED

Validation Evidence:
- Reviewed the TASK document and Technical Contract Card
- Reviewed referenced design doc path docs/runtime/retry.md
- Inspected git diff only for src/core/RetryRuntime.ts and docs/runtime/retry.md
- No diff content found for the required design update

Noise / Environment Notes:
- Existing debug logs are noisy but non-blocking.

Final Action: Leader routes F1 back for package completion, then reassigns review.
```

### Bad Example 1: No Structure

```text
Code review FAIL
```

Why bad: No scope, no reasoning, no routing, no evidence.

### Bad Example 2: Missing Fields

```text
Result: PASS
Summary: Looks good.
```

Why bad: Missing required fields and no contract basis.

### Bad Example 3: Wrong Scope

```text
Result: FAIL
Review Scope: Whole repository diff.
```

Why bad: Review scope violated the leader-assigned file-list rule.

## Error Handling

**Leader omitted TASK path**: Ask for it before formal review.

**Leader omitted file list**: Ask for the exact file list before formal review.

**Worktree invalid or missing**: Report the issue to the leader and stop.

**Referenced design material missing**: Record the blocker and route it clearly.

**Validation command unavailable**: Note the limitation in `Validation Evidence` and continue.

**Task-name extraction unclear for REVIEWER filename**: Use the TASK filename as the source of truth and preserve its task-name portion.

## Review Completeness Checklist

Your review is complete only when the leader can tell, without follow-up:

1. What you reviewed
2. Whether it passed
3. What failed if it did not pass
4. Why it failed
5. What evidence you checked
6. Whether the reviewed package is incomplete
7. What the leader should do next

Be precise, be scoped, and be strict about package completeness.
