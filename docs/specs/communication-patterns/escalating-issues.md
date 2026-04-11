# Communication Pattern: Escalating Issues

## When to Escalate

Escalate when you encounter a problem **outside your authority or capability** to resolve, or when you discover information that requires higher-level decision.

### Escalate Immediately (Don't Try First)

**Authority decisions**: Decision requires authority you don't have.

**Resource problems**: You lack access, permissions, or resources.

**Definite knowledge**: Someone definitely knows the answer. Asking takes seconds, exploring takes hours.

**Expertise gap**: Someone is 10x better at this. Their 10 minutes vs your 2 hours.

**Better approach discovered**: You found a significantly better solution that changes the agreed direction.

**Unacceptable cost/risk discovered**: Current approach will cost too much or risk too much.

### Escalate After Trying

**Unclear problem**: Try basic diagnosis first.

**Learning opportunity**: Problem is within your capability range.

**Ambiguous ownership**: Not clear who has the answer.

If stuck after reasonable attempts (15-30 min for simple, 1-2 hours for complex), escalate.

## Message Structure

- State the problem or decision needed
- State what you need (decision, access, guidance, expert review)
- State why you cannot resolve it (authority, capability, or new information)
- If you tried: List what didn't work
- If you didn't try: State why (boundary or new information)
- Set expect_reply=true

## Decision Framework

1. **Do I have authority to decide?** No → Escalate immediately
2. **Do I have resources/access?** No → Escalate immediately
3. **Did I discover significantly better approach?** Yes → Escalate immediately
4. **Did I discover unacceptable cost/risk?** Yes → Escalate immediately
5. **Does someone definitely know the answer?** Yes → Escalate immediately
6. **Is someone 10x better at this?** Yes → Escalate immediately
7. **Is this within my capability?** Yes → Try first, escalate if stuck
8. **Am I stuck after reasonable attempts?** Yes → Escalate now

## Common Mistakes

**Over-escalating**: Escalating routine decisions within your authority.

**Under-escalating**: Spending hours on problems someone else could solve in minutes.

**Not escalating new information**: Discovering better approach or unacceptable risk, but continuing without escalating.

**Escalating without clarity**: "I have a problem" without stating what you need.

## Task Management

After escalating, mark blocked tasks as `waiting_for_message`. When help arrives, update to `in_progress`.

## Summary

Escalate immediately when you lack authority, resources, or when someone definitely knows the answer. Also escalate when you discover better approaches or unacceptable cost/risk. Escalate after trying when stuck. Don't waste hours exploring when asking gets you unblocked in minutes. Don't continue with suboptimal or risky plans without escalating.
