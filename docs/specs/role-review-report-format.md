# Role Review Report Format

## Purpose

This document defines the standard format for role review reports in the cclover multi-agent collaboration system.

Role reviewers must produce structured reports that enable leaders to make routing decisions without follow-up questions. This format ensures consistency, completeness, and actionability.

---

## Report Structure

Every completed review MUST contain these fields in this exact order:

1. **Result**: PASS / FAIL / FAIL-SERIOUS
2. **Review Scope**: What file and sections were reviewed
3. **Summary**: One-sentence conclusion
4. **Findings**: Numbered findings list (if any)
5. **Contract Check**: Line-by-line check of prompt and workflow contracts
6. **Validation Evidence**: Actual evidence reviewed
7. **Noise / Environment Notes**: Noise vs blocker distinction
8. **Final Action**: Next workflow action

Do NOT omit, rename, or reorder these fields.

---

## Result Classification

### PASS

The role definition satisfies all workflow-governance requirements and role-file requirements.

Minor wording improvements may be noted in "Noise / Environment Notes" but do not block approval.

### FAIL

The role definition has one or more issues that must be corrected before approval, but the issues are fixable through role editing without requiring higher-level workflow decisions.

### FAIL-SERIOUS

The role definition has issues that either:
- Require Technical Lead or workflow-design ruling to resolve
- Indicate fundamental workflow-governance violations
- Cannot be fixed by the role editor alone

---

## Findings Schema

### Numbering

Every finding MUST be numbered sequentially: `F1`, `F2`, `F3`, etc.

### Required Fields

Every finding MUST contain all of these fields:

**title**: Brief description of the issue

**severity**: 
- `serious`: Blocks approval, requires immediate fix
- `major`: Significant issue that should be fixed before approval
- `minor`: Should be improved but may not block approval

**classification**:
- `implementation defect`: Role text clearly violates a required workflow rule or role-file rule
- `validation gap`: Role claims behavior but written instructions don't make it verifiable
- `architecture ambiguity`: Role ownership overlaps or conflicts with another role
- `model mismatch`: Role assumes wrong workflow model, authority model, or communication model
- `requires TL ruling`: Conflict touches disputed high-level workflow architecture

**location**: Where in the role file the issue appears

**reason**: Detailed explanation of:
- Which workflow rule, ownership boundary, role contract, or file requirement is violated
- Why the current role text does not satisfy it
- Why the issue belongs to the chosen classification
- Whether the role editor can fix it directly or must wait for higher-level ruling

**impact**: What happens if this issue is not fixed

**required_fix**: Specific action needed to resolve the issue

**escalation**: Who should handle this and how

### Reasoning Requirement

Every blocking finding in a FAIL or FAIL-SERIOUS review MUST include a real `reason` that explains the violation, not just symptoms.

Symptom-only reports are forbidden.

---

## Contract Check Format

The Contract Check section MUST inspect relevant workflow and role contracts one by one.

Use this format:

```
Contract Check:
- [contract item]: SATISFIED / NOT SATISFIED / PARTIALLY SATISFIED
- [contract item]: SATISFIED / NOT SATISFIED / PARTIALLY SATISFIED
...
```

Example contract items:
- Assigned file scope respected
- Leader-only communication model
- Review input model from assigned file list
- Ownership boundaries clear
- Workflow topology aligned
- Legacy workflow drift absent
- Required header and footer present
- English-only requirement satisfied

Do not replace this with a generic paragraph.

---

## Validation Evidence Format

The Validation Evidence section must list what you actually checked.

Examples:
- TASK document path reviewed
- Workflow design doc paths reviewed
- Assigned file list reviewed
- Exact `git diff` scope inspected
- Lines or sections showing ownership conflict or communication mismatch

Never pretend you verified behavior beyond what the text supports.

---

## Noise / Environment Notes

Distinguish between:
- **Harmless wording noise**: Does not block approval
- **Environment limitations**: Reduce confidence but are not blockers
- **Actual blocker-level ambiguity**: Must become a finding

This section helps leaders understand what was noticed but not escalated to findings.

---

## Final Action Format

The Final Action field MUST identify the next owner and action.

Examples:
- `Leader may treat this review as passed and continue the workflow.`
- `Leader routes F1 back for role update, then reassigns review.`
- `Leader escalates F2 to Technical Lead because workflow ownership remains ambiguous.`

---

## REVIEWER Report File Rule

When the result is FAIL or FAIL-SERIOUS, the reviewer MUST write the full structured report as a markdown file in the same directory as the TASK or TASKPLAN document.

### Timestamp Generation

Generate the review timestamp using this exact command:

```bash
date "+%Y-%m-%dT%H-%M-%S-%3N"
```

### Filename Convention

If the TASK file is:

```
<task-timestamp>-TASK-<task-name>.md
```

then the REVIEWER report file MUST be:

```
<review-timestamp>-REVIEWER-TASK-<task-name>.md
```

### Report Content

The report file contains the full structured review result with all required fields.

---

## Example: PASS Review

```text
Result: PASS
Review Scope: Reviewed .cclover/tasks/2026-04-09T15-30-00-123-TASK-developer-workflow-update.md and git diff for src/roles/general-developer.md.
Summary: Role updates align with new workflow model and satisfy all role-file requirements.

Findings: None

Contract Check:
- Assigned file scope respected: SATISFIED
- Leader-only communication model: SATISFIED
- Ownership boundaries clear: SATISFIED
- Workflow topology aligned: SATISFIED
- Legacy workflow drift absent: SATISFIED
- Required header and footer present: SATISFIED
- English-only requirement satisfied: SATISFIED

Validation Evidence:
- Reviewed TASK document at .cclover/tasks/2026-04-09T15-30-00-123-TASK-developer-workflow-update.md
- Inspected git diff only for src/roles/general-developer.md
- Verified escalation paths match new workflow
- Verified communication targets are correct

Noise / Environment Notes:
- Minor wording repetition in examples section is non-blocking

Final Action: Leader may treat this review as passed and continue the workflow.
```

---

## Example: FAIL Review

```text
Result: FAIL
Review Scope: Reviewed .cclover/tasks/2026-04-09T15-30-00-123-TASK-reviewer-workflow-update.md, the assigned workflow design reference, and git diff for src/roles/code-reviewer.md.
Summary: The role updates review rigor, but it still routes failure messages to the developer instead of the leader.

Findings:
- F1
  - title: Failure communication target still points to developer
  - severity: major
  - classification: model mismatch
  - n: Message Rules section, lines 45-48
  - reason: The new workflow requires reviewer communication to go only to the leader. The role text still treats the developer as a direct review-output recipient, which preserves the old communication model and breaks the simplified workflow. This is a model mismatch rather than a wording preference because it changes the operational routing contract. The role editor can fix this directly by updating the communication target.
  - impact: Review handling will bypass the intended leadership-controlled communication path.
  - required_fix: Update the role so completed reviews report only to the leader, with failed reviews written beside the TASK document before reporting.
  - escalation: Leader routes this back for role correction, then reassigns review.

Contract Check:
- Assigned file scope respected: SATISFIED
- Leader-only communication model: NOT SATISFIED
- Review input model from assigned file list: SATISFIED
- Ownership boundaries: SATISFIED
- Legacy workflow drift absent: NOT SATISFIED

Validation Evidence:
- Reviewed the TASK document at .cclover/tasks/2026-04-09T15-30-00-123-TASK-reviewer-workflow-update.md
- Reviewed the workflow design context provided for this task
- Inspected git diff only for src/roles/code-reviewer.md
- Found direct developer-report wording in lines 45-48

Noise / Environment Notes:
- Minor wording repetition exists but is non-blocking

Final Action: Leader routes F1 back for role correction, then reassigns review.
```

---

## Example: FAIL-SERIOUS Review

```text
Result: FAIL-SERIOUS
Review Scope: Reviewed .cclover/tasks/2026-04-10T09-15-00-456-TASK-designer-role-update.md and git diff for src/roles/software-designer.md.
Summary: Role ownership overlaps with Technical Lead authority in architecture decisions, requiring TL ruling.

Findings:
- F1
  - title: Architecture decision authority overlaps with Technical Lead
  - severity: serious
  - classification: requires TL ruling
  - location: Decision Criteria section, lines 78-92
  - reason: The role grants Software Designer authority to make final architecture decisions without Technical Lead approval. The workflow design document does not clarify whether this authority shift is intentional or whether Technical Lead retains architecture approval authority. This is not a simple role-editing fix because it touches disputed high-level workflow architecture. The role editor cannot resolve this without a ruling from Technical Lead on the intended authority boundary.
  - impact: Architecture decisions may be made without proper authority, or Technical Lead authority may be undermined.
  - required_fix: Technical Lead must clarify whether Software Designer has final architecture authority or must escalate architecture decisions for approval.
  - escalation: Leader escalates F1 to Technical Lead for authority boundary ruling.

Contract Check:
- Assigned file scope respected: SATISFIED
- Ownership boundaries clear: NOT SATISFIED (requires TL ruling)
- Authority boundaries respected: NOT SATISFIED (requires TL ruling)
- Workflow topology aligned: UNCLEAR (depends on TL ruValidation Evidence:
- Reviewed TASK document at .cclover/tasks/2026-04-10T09-15-00-456-TASK-designer-role-update.md
- Reviewed workflow design reference (does not clarify architecture authority boundary)
- Inspected git diff for src/roles/software-designer.md
- Found architecture decision authority in lines 78-92 without escalation requirement

Noise / Environment Notes:
- None

Final Action: Leader escalates F1 to Technical Lead for authority boundary ruling before role can be approved.
```

---

## Closing Position

This format exists to make review results actionable without follow-up questions.

Every field serves a purpose:
- **Result** tells the leader whether to approve
- **Review Scope** confirms what was actually reviewed
- **Summary** provides quick context
- **Findings** identify specific issues with reasoning
- **Contract Check** shows which contracts passed or failed
- **Validation Evidence** proves what was verified
- **Noise / Environment Notes** separate concerns from blockers
- **Final Action** tells the leader what to do next

Follow this format exactly. Do not improvise.
