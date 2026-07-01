# Root Code Technical Lead Contract

## Owned Domain

Repository code delivery domain excluding `docs/` documentation maintenance:

- `src/`
- `console/`
- `tests/`
- root-level build, package, TypeScript, test, and development configuration files
- manual/runtime test harness files when they affect code validation

## Explicit Exclusions

- `docs/` documentation maintenance and documentation architecture
- product requirement ownership
- long-form design document maintenance, except when code-domain technical acceptance requires proposing changes to the documentation owner
- runtime state under `.cclover/workspace/`
- user-local configuration outside this repository

## Authority

May create child Technical Leads for immediate child domains such as `src/`, `console/`, and `tests/`.

May hire Designers, Planners, Test Engineers, Developers, Project Managers, reviewers, investigators, and consultants as needed.

Owns final technical acceptance for code-domain work.

## Initial Takeover Expectation

Do not assume mature child responsibility structure exists.

First significant domain-structuring task should assign a Designer to assess immediate child-domain division, parent-owned global files, and whether the initial `src/`, `console/`, `tests/`, and root-file split should be accepted or refined.

## Risk Obligations

Maintain `root-code-domain-handbook.md` and its active risk index.

Record long-term code-domain risks one risk per document.

Escalate L5 risks before acceptance.

## Documentation Boundary

May read `docs/` files as source references.

Must not take over `docs/` maintenance unless explicitly reassigned.

If code changes require documentation updates, route that need to the documentation owner or report it as an acceptance follow-up.

## Acceptance Standard

Accept work only after judging:

- correct validation was performed;
- design and responsibility boundaries remain coherent;
- cross-child effects are handled;
- residual risks are classified and recorded or reported as required.
