# Risk Analysis Practice Guide

## Six-Dimensional Risk Model

Every significant decision should be evaluated across six dimensions:

1. **Short-term cost**: What resources, time, or effort does this require now?
2. **Short-term benefit**: What value does this deliver immediately?
3. **Short-term risk**: What can go wrong in the current stage?
4. **Long-term cost**: What maintenance burden, technical debt, or future constraints does this create?
5. **Long-term benefit**: What strategic value, flexibility, or foundation does this provide?
6. **Long-term risk**: What future problems, limitations, or instability does this introduce?

### When to Apply

Apply this model when:
- The decision materially affects implementation, architecture, or review
- The choice is not obvious
- Different options have different risk profiles
- The decision will be difficult to reverse later

Do not apply this model to trivial decisions where the cost of analysis exceeds the cost of being wrong.

## Identifying Dominant Uncertainty

Ask these questions in order:
1. Which uncertainty blocks the most critical decision?
2. Which uncertainty has the highest potential impact if wrong?
3. Which uncertainty must be resolved before others matter?
4. Which uncertainty carries the greatest risk if ignored?

The first "yes" answer identifies the dominant uncertainty.

## Writing Explicit Reasoning

When making a risk-based decision, write out:
- What uncertainties exist
- Which uncertainty is dominant
- What the six-dimensional trade-offs are
- Why you chose this option over alternatives
- What assumptions you are making
- What could invalidate this decision

### Format

No fixed format is required. The reasoning must be visible, not formatted.

Example of sufficient explicit reasoning:
```
Current dominant uncertainty: Whether the retry coordinator change 
belongs in internal orchestration or shared domain layer.

Six-dimensional analysis:
- Short-term cost: Internal = 2 days, Shared = 4 days (more coordination)
- Short-term benefit: Both deliver the fix
- Short-term risk: Shared risks accidental API expansion
- Long-term cost: Internal = low, Shared = high (more coupling)
- Long-term benefit: Internal = preserves flexibility, Shared = none
- Long-term risk: Shared risks semantic drift across systems

Decision: Keep change in internal orchestration layer.
Assution: No other system needs this retry semantic.
Invalidation condition: If another system requests similar retry behavior, 
reassess whether shared abstraction is justified.
```

## Executing Reassessment

When a meaningful discovery occurs:
1. Stop execution if the discovery might invalidate the current plan
2. Explicitly restate your reasoning with the new information
3. Re-evaluate the six-dimensional trade-offs
4. Decide whether to continue, adjust, or abandon the current plan
5. Document what changed and why

## Uncertainty Routing Table

This project uses the following uncertainty routing:

| Uncertainty Type | Resolun|-----------------|----------------|
| Requirement ambiguity | Requester or boss |
| Repository entry / navigation gap | Documentation Governor |
| Detailed design gap | Software Designer |
| External knowledge gap | General Researcher |
| Architectural / technical judgment | Architecture Consultant |
| Verification confidence gap | Test Engineer |
| Collaboration / role conflict | Soul Optimizer or Soul Lead |
| Execution and implementation | Project Manager |

### When to Route

Route immediately when:
- The uncertainty is outside your authority or expertise
- Someone else definitenows the answer
- The specialist can resolve it 10x faster than you

Route after trying when:
- The uncertainty is within your capability range
- It is unclear who has the answer
- The problem is a learning opportunity

If stuck after reasonable attempts (15-30 min for simple, 1-2 hours for complex), route.

## Risk Communication Format

When explaining a decision to others:
- What options you considered
- What the six-dimensional trade-offs were
- Which dimension(s) dominated the decision
- What assumptions you made
- What could change your decision

### Example

**Insufficient**: "Use Redis for caching."

**Sufficient**: "Use Redis for caching.  caching has lower short-term cost (no new dependency) but higher long-term risk (won't work with horizontal scaling planned in 3-6 months). Redis has higher short-term cost (new dependency, deployment complexity) but eliminates the scaling risk. Scaling timeline dominates this decision."

## Self-Application

This specification provides concrete tools and formats for executing risk analysis. It should be loaded when an AI agent needs to perform risk analysis, not just understand its philosophy.
