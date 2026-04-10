# Meeting Mode Design

## Overview

Meeting Mode is a plugin-driven interaction model for opencode-cclover. It projects existing cclover roles into OpenCode primary agents so the user can directly select a role in the UI and hold a high-authority working meeting with it.

**Module Purpose**: Provide a simple, direct "meeting with a role" experience that preserves each role's domain identity while granting boss-level operating authority through the existing plugin/runtime integration.

**Key Responsibilities**:
- Project resolved cclover roles into OpenCode primary agents
- Preserve original role naming and role-specific perspective in the UI
- Augment role prompts with direct meeting-context instructions
- Grant unrestricted hiring and operational authority during the interaction
- Execute cclover tool calls under the `Boss` identity for the projected agent

## Architecture Reference

This design extends the existing role-loading and plugin-entry paths described in [Role Definition Design](./design-roles.md) and [Plugin Entry Design](./design-plugin-entry.md).

**Design Principles**:
- **Direct UI Entry**: The user enters by choosing a role from the standard OpenCode agent list
- **Role Identity Preservation**: The projected meeting agent keeps the original role name and specialization
- **Simplest Viable Architecture**: Prefer prompt augmentation and dynamic projection over persistent elevated employee state
- **Boss-Level Operability**: Projected meeting agents may organize work immediately without normal role hiring restrictions
- **Low Conceptual Overhead**: Avoid branded or theatrical mode semantics in the user-facing experience

## Product Intent

The feature exists to let the boss directly discuss plans, trade-offs, and execution with a selected role inside OpenCode, without requiring manual promotion workflows or temporary elevated employee lifecycle management.

The intended user experience is:
- the plugin dynamically exposes cclover roles as OpenCode primary agents
- the user selects one of those roles directly in the UI
- the selected role receives its original role prompt plus meeting-context augmentation
- the selected role understands that the boss is personally meeting with it
- the selected role may hire any needed staff and coordinate execution immediately
- when cclover tools are invoked, operations execute as `Boss`

## Interface

### User Entry

The user enters this interaction by selecting an existing role from the OpenCode UI agent list.

There is no separate slash command, promotion flow, or explicit mode toggle.

### UI Naming

Projected meeting agents should use the original role name, for example:
- `Technical Lead`
- `Project Manager`
- `Architect`

The UI should not introduce suffixed variants such as `technical-lead-boss` or `Technical Lead (Meeting Mode)`.

### Conversation Framing

The prompt should frame the interaction naturally as a direct working meeting with the boss.

The projected role should understand that:
- the boss is personally talking with it
- the conversation is discussion-oriented rather than passive reporting
- trade-offs and disagreement are allowed when useful
- additional staff should be hired immediately if needed

## Internal Design

### Role Projection Model

Meeting Mode uses resolved role definitions as the source of truth for projection.

The plugin should:
1. Load roles using the same precedence model already used by cclover
2. Resolve the effective role set at plugin startup
3. Register each resolved role as an OpenCode primary agent

This preserves consistency with the existing role system and avoids a parallel role-definition path.

### Agent Registration Shape

Each projected role should register a primary agent with at least:
- `name`: original role name
- `description`: role description or a short derived summary
- `prompt`: original role prompt plus meeting augmentation
- `mode`: `primary`

### Prompt Composition

Prompt composition should:
1. Start from the original role content
2. Add a meeting-context augmentation block
3. Preserve the role's domain identity and responsibilities
4. State the elevated authority model clearly

The augmentation should communicate at least these ideas:
- the boss is personally talking with you
- this is a direct working meeting
- discuss matters collaboratively and frankly
- you have full authority to organize work
- normal hiring restrictions are lifted for this interaction
- if required staff are missing, hire them immediately and proceed

### Authority Model

Projected meeting agents should operate with full boss-level authority.

This means:
- normal `canHire` restrictions do not apply in this context
- the agent may send messages freely
- the agent may edit tasks freely
- the agent may create agents freely
- the agent may hire any needed employee role freely

The design intentionally does not add feature-specific approval gates, throttles, or confirmation layers.

### Identity and Execution Model

The projected UI agent is not a persistent employee instance.

Instead:
- conversational identity = selected role
- prompt identity = selected role plus meeting augmentation
- tool execution identity = `Boss`

This keeps the implementation simple and matches the current practical behavior where primary-agent tool operations already align with boss-side execution semantics.

### Implementation Areas

The expected implementation areas are:
- resolved role loading / discovery
- plugin `config` hook agent registration
- meeting prompt augmentation
- compatibility handling for consistent `Boss` tool execution identity

Possible internal helpers may include:
- a resolved role projection builder
- a meeting prompt augmenter
- a dynamic agent registry adapter

These are implementation options rather than fixed product requirements.

## Non-Goals

Meeting Mode should not:
- bind the UI-selected agent to a long-lived employee instance
- create visible `-boss` or `-meeting` role variants
- require a separate enable/disable workflow outside normal agent selection
- preserve strict role hiring restrictions during the interaction
- add extra feature-specific approval or safety subflows

## Acceptance Criteria

The feature is successful if:
1. Resolved cclover roles become available as OpenCode primary agents at plugin startup
2. The user can select a role directly from the UI agent list
3. The displayed name is the original role name
4. The selected role speaks from its own specialization
5. The prompt frames the exchange as a direct meeting with the boss
6. Hiring restrictions are lifted in practice for the projected role
7. Missing employees can be hired immediately
8. Tool actions execute as `Boss`
9. No persistent employee instance is required
10. No separate visible promotion workflow is introduced

## Implementation Questions

Open implementation questions include:
- what the cleanest source of truth is for resolved role loading inside the plugin lifecycle
- whether prompt augmentation should append at the end or inject near the top of the role prompt
- how overridden roles from different scopes should be represented during projection
- whether future metadata should allow some roles to opt out of projection
- whether any compatibility patch is needed to guarantee `Boss` execution identity for all projected-agent tool calls

## Recommended Reading

Read these documents before implementation planning:
1. [Plugin Entry Design](./design-plugin-entry.md) - plugin startup, orchestration, and registration path
2. [Role Definition Design](./design-roles.md) - resolved role loading rules and precedence model
3. [Main Design](./design.md) - overall plugin integration context
