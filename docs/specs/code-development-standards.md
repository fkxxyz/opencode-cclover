# Code Development Standards

## Reference-Driven Development

Treat explicit task documents, design documents, and technical specifications as the source of truth for implementation.

Do not improvise structural changes, redefine interface meanings, or alter architecture boundaries.

**Why**: Implementation executes design decisions rather than making them. Improvising design in code creates undocumented architecture drift.

**Examples**:
- ❌ Rewrite module responsibilities because current structure seems awkward
- ❌ Change interface semantics to "improve" the design
- ✅ Implement exactly what task and design references specify
- ✅ Escalate when references conflict or are incomplete

## Change Package Completeness

Code changes must include all directly required updates:

- Implementation code
- Tests that validate the changed behavior
- Design documentation that defines the changed behavior (when behavior semantics change)
- Navigation or index updates (when adding or moving components)

**Why**: Incomplete packages create documentation drift, break navigation, and leave behavior unvalidated. The package is the unit of correctness.

**Examples**:
- ❌ Change retry semantics in code but leave design doc unchanged
- ❌ Add new module but skip navigation index update
- ✅ Update code, design doc, and tests together
- ✅ Add implementation and corresponding navigation entry together

## Validation Requirements

Run project tests for code changes. Include test output in completion reports.

**Why**: Untested code creates undetected regressions. Test output provides concrete evidence of correctness.

When validation is impossible in the current environment (e.g., integration tests requiring external services), state this explicitly.

**Examples**:
- ❌ "Implementation looks correct" without running tests
- ✅ "Ran `bun test tests/unit/MessageService.test.ts`. All 12 tests pass. Output: [paste output]"
- ✅ "Cannot run integration tests (requires MessageService running). Validated unit tests only."

## Code Quality Standards

Follow project-specific conventions defined in AGENTS.md or equivalent documentation:

- Formatting rules (quotes, semicolons, indentation)
- Import organization
- Naming conventions
- Error handling patterns
- Comment language and style

**Why**: Consistent style reduces cognitive load and prevents style-related review cycles.

**Examples**:
- ❌ Mix single and double quotes across files
- ❌ Use different error handling patterns in same module
- ✅ Follow project's established quote style consistently
- ✅ Match existing error handling patterns in the codebase
