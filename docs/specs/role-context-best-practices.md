# Role Context Best Practices

## 1. What Role Context Solves

### 1.1 Role Context Solves Shared Context Reuse

Role context exists to separate reusable working context from role-specific identity.

Without role context, the same principles, workflow guidance, and background constraints get repeated across multiple role bodies. That repetition makes role prompts longer, harder to maintain, and easier to drift apart.

### 1.2 Role Context Enables Composable Prompt Design

Different roles need different combinations of shared guidance. Role context makes that guidance composable instead of duplicating it into every role.

This keeps role prompts focused on the role itself while allowing shared project knowledge to evolve independently.

### 1.3 Why This Matters

Role prompts are prompt artifacts competing for limited model attention. When reusable guidance is embedded directly into many role bodies, attention is wasted on repetition instead of the role-specific information that actually distinguishes one employee from another.

Role context improves both clarity and composition:
- role bodies stay centered on the employee itself
- shared guidance stays reusable and easier to maintain
- different roles can load different context combinations without copying text

---

## 2. Core Principle

If a piece of guidance is reusable working context rather than part of the role's own definition, it should usually be expressed as role context instead of being written directly into the role body.

This is a strong default, not an absolute law. Leave content in the role body when doing so preserves the role's own clarity better than extraction would.

---

## 3. Derived Principles

### 3.1 Keep the Role Body Focused on the Role Itself

The role body should primarily define the employee itself:
- who the employee is
- what the employee is responsible for
- what the employee must not do
- how the employee collaborates with other employees
- role-specific working rules that are meaningfully part of that role

This keeps the role self-explanatory. A reader should be able to understand why this role exists and how it behaves as an employee without digging through general-purpose guidance.

### 3.2 Put Shared Working Knowledge Into Role Context

Role context is the right place for reusable working knowledge that may be needed by multiple roles, such as:
- shared workflow guidance
- shared communication patterns
- shared prompt-writing principles
- shared governance constraints
- other reusable project-specific methods or standards

This keeps shared knowledge modular and prevents the same guidance from being restated across multiple roles.

### 3.3 Extract Principles, Not Just Text

The goal of extraction is not merely to shorten a role file. The goal is to separate generalizable guidance from role identity.

When a working rule, method, or judgment pattern can guide more than one role, it should usually become a specification rather than remain trapped inside one role body. This improves reuse, maintenance, and context composition.

### 3.4 Keep `contextIds` Minimal

`contextIds` should include only role context that is genuinely necessary for that role.

Do not include context merely because it seems somewhat related. Every additional context competes for limited attention and increases the risk of context bloat.

When you are significantly unsure whether a context belongs in `contextIds` because only part of it is relevant to the role, strongly prefer splitting that context into more precise specifications instead of loading the broader context anyway.

---

## 4. Boundaries

Role context should not become a dumping ground for everything that does not fit neatly somewhere else.

Keep content in the role body when it is primarily about:
- the role's identity
- the role's responsibilities
- the role's boundaries
- the role's collaboration topology
- role-specific instructions whose meaning depends on this role being this role

Move content toward role context when it is primarily about reusable project guidance rather than the identity of a particular employee.

---

## 5. Writing Consequence

When writing or revising any role body, first ask whether part of that guidance is actually reusable role context that should be expressed as a separate specification.

Good role design therefore separates two concerns:
- the role body defines the employee
- role context provides reusable surrounding guidance

This separation produces prompts that are easier to compose, easier to maintain, and easier for the model to interpret correctly.
