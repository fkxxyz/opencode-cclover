# Responsibility Document Placement

## Purpose

This specification defines where versioned responsibility documents live in this repository.

It only governs file placement and naming. It does not define document type semantics, role-specific obligations, context loading order, hiring workflow, or risk management rules.

## Default Rule

Versioned responsibility documents follow the natural location of the responsibility domain.

Do not place long-lived responsibility documents in `.cclover/` by default. Use `.cclover/` only for runtime state, local private overrides, or temporary bootstrap material that is not intended to be maintained through repository commits.

## Root Domain

Repository-level responsibility documents belong in the repository governance area:

```text
docs/leadership/
```

Example:

```text
docs/leadership/root-technical-lead-contract.md
docs/leadership/root-domain-handbook.md
```

If a repository already has an equivalent governance directory, use the established directory consistently.

## Directory-Shaped Domain

When the responsibility domain maps to a directory, place responsibility documents under that directory's documentation area:

```text
<domain>/docs/
```

Examples:

```text
src/docs/technical-lead-contract.md
src/docs/domain-handbook.md
console/docs/technical-lead-contract.md
console/docs/domain-handbook.md
src/core/docs/technical-lead-contract.md
src/core/docs/domain-handbook.md
```

## Documentation Domain Exception

When the responsibility domain is `docs/`, do not create `docs/docs/` for responsibility documents. Place them in the repository governance area instead.

Examples:

```text
docs/leadership/docs-domain-contract.md
docs/leadership/docs-domain-handbook.md
```

## Single-File Domain

When the responsibility domain maps to one file, place responsibility documents in the nearest owning directory's documentation area. Do not scatter responsibility documents beside source files.

Example for `src/core/MessageService.ts`:

```text
src/core/docs/message-service-contract.md
src/core/docs/message-service-handbook.md
```

## Cross-Cutting Domain

When the responsibility domain does not naturally map to one directory, place responsibility documents in the repository governance area.

Examples:

```text
docs/leadership/role-system-contract.md
docs/leadership/meeting-mode-handbook.md
docs/leadership/testing-standards-contract.md
```

If a cross-cutting domain has an established authoritative directory, use that directory's documentation area only when the ownership relationship is clear.

## File Naming

File names describe responsibility domains, not employee instances.

Use names such as:

```text
root-domain-handbook.md
technical-lead-contract.md
message-service-handbook.md
role-system-contract.md
```

Avoid names such as:

```text
emp_123_handbook.md
boss-hired-root-tl-contract.md
alice-technical-lead.md
```

Employees can be replaced; responsibility domains are the stable unit.
