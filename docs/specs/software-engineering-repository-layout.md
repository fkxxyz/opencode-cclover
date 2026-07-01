# Software Engineering Repository Layout

## Purpose

This specification defines the repository layout model for AI-driven software engineering work. It separates requirements, architecture, design, code, and tests so downstream roles can own different decision levels without blurring authority.

## Core Layer Model

Use four engineering layers:

```text
Requirements → Architecture → Design → Code
```

- **Requirements** define user goals, system capabilities, acceptance intent, and external constraints.
- **Architecture** defines system and subsystem boundaries, dependency rules, responsibility ownership, and long-term evolution constraints.
- **Design** defines how a subsystem, module, or workflow works inside approved architecture boundaries.
- **Code** implements the approved design through modules, functions, and data structures.

The layers form a traceable graph, not a strict one-to-one directory mapping. One requirement may involve multiple architecture decisions, designs, modules, and tests.

## System, Subsystem, and Module Boundaries

A system or subsystem is a responsibility unit that provides a recognizable external capability. It normally has stable external interfaces, independent evolution pressure, and internal modules that collaborate to deliver the capability.

A module is an implementation responsibility inside a system or subsystem. Its lifecycle is normally owned by the containing subsystem, and its public contract exists to serve that subsystem unless it grows into a reusable capability.

Boundary promotion is an architecture decision. A design owner may report that a module has become large or widely reused, but the architecture owner decides whether it becomes a subsystem.

## Recursive Ownership Model

Large systems can be recursively decomposed:

```text
System
  → Subsystem
    → Subsystem or Module
      → Module or Component
```

Every level needs an owner for boundary coherence. Deeper levels do not automatically require more architects. Use architecture ownership when decisions define external capability, cross-boundary dependencies, or long-term constraints. Use design ownership when decisions remain inside an approved boundary.

## Documentation Placement

Use centralized documents for cross-boundary knowledge and colocated documents for local implementation knowledge. Use this layout as the default structure unless an existing repository convention provides a clearer local organization.

```text
docs/
  requirements/       # capability requirements and acceptance intent
  architecture/       # global architecture, subsystem map, and dependency rules
    adr/              # long-lived architecture decision records
  design/             # cross-subsystem or cross-module workflow designs
  specs/              # stable process, format, and governance specifications
  acceptance/         # human-readable acceptance scenarios when separate from requirements

src/
  subsystem-a/
    architecture.md   # optional subsystem architecture when complex enough
    design/           # designs spanning multiple modules inside the subsystem
    module-x/
      design.md       # module-level design when the module has non-trivial contract or behavior
```

Placement rules:

- Global architecture and cross-subsystem constraints belong in `docs/architecture/`.
- Subsystem-internal architecture may live at the subsystem root when it is tightly coupled to that code boundary.
- Cross-subsystem or workflow design belongs in `docs/design/`.
- Subsystem-internal multi-module design belongs under the subsystem root, typically `src/[subsystem]/design/`.
- Module-level design belongs near the module code when it changes with that module.
- Simple modules do not need standalone design documents.

## Test Taxonomy and Ownership

Use four test categories with six ownership subtypes:

```text
tests/
  unit/
    contract/          # designer-owned module contract tests
    implementation/    # engineer-owned implementation support tests

  integration/
    architecture/      # architect-owned boundary and dependency contract tests
    design/            # designer-owned module collaboration tests

  system/              # architect-owned system capability tests
  e2e/                 # automated acceptance-path tests derived from requirements
```

Ownership rules:

- **Requirements engineers** define human-readable acceptance scenarios and E2E intent.
- **Architecture owners** define system tests and architecture integration tests that protect boundaries, dependency direction, and system capabilities.
- **Design owners** define contract unit tests and design integration tests that protect module semantics and approved collaboration flows.
- **Engineers** define implementation support tests for private helpers, regression protection, optimization branches, and development confidence.

Test authority follows intent ownership. Test implementation may be automated by another role, but intent changes require the owning role. Engineers may update technical details of tests to keep them runnable, but must not weaken requirement, architecture, or design intent without returning to the owning role.

Implementation support tests must not become authority for public module behavior. If a private helper becomes important enough to require stable testing, promote it to a design-owned contract.

Filename suffixes should preserve ownership subtype when tests are moved, searched, or reported outside their directory context:

```text
*.contract.test.ts
*.implementation.test.ts
*.architecture.integration.test.ts
*.design.integration.test.ts
*.system.test.ts
*.e2e.test.ts
```

## E2E and Acceptance Separation

E2E intent should be human-readable before it is automated.

```text
docs/requirements/[capability].md
docs/acceptance/[scenario].md    # when acceptance scenarios are separate
tests/e2e/[scenario].e2e.test.ts
```

The acceptance document describes the user-visible path and pass criteria. The E2E test code is only an executable simulation of that path through a real user entry point such as browser automation, CLI invocation, API call, or full service workflow.

## Traceability Expectations

Maintain traceability through document structure and index entries. Keep these top-level navigation files when the corresponding branch exists:

```text
docs/requirements.md
docs/architecture.md
docs/design.md
tests/README.md
```

These files route readers from the global view to the relevant requirements, architecture decisions, designs, code boundaries, and test categories.

```text
Requirement
  → Architecture decision or constraint
    → Design document
      → Code module
        → Test category
```

The repository does not need mechanical one-to-one files for every layer. It needs enough indexed links and colocated documents that a role can answer:

- Which requirement motivates this architecture or design?
- Which architecture boundary constrains this design?
- Which design governs this module?
- Which tests protect the requirement, boundary, design contract, or implementation detail?

## Minimal Rule

Create documents at the level where decisions become stable enough to govern future work. Do not create documents merely because a directory exists.
