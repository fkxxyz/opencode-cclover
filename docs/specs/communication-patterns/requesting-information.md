# Communication Pattern: Requesting Information

## When to Use

Use when you need information to proceed, and someone else has it.

**Triggers**:
- Need clarification on requirements or specifications
- Need technical information you don't have access to
- Need approval or confirmation before proceeding
- Need to choose between options and someone has the answer

## Message Structure

- State what you need clearly
- Explain what's blocked without it
- Set expect_reply=true
- Update task to waiting_for_message

## Best Practices

### Be Specific

Bad: "I have a question about authentication."
Good: "Which JWT library should I use?"

### Explain the Blocker

State what's blocked: "This blocks the 'Implement authentication' task."

Helps recipient prioritize.

### Always Set expect_reply=true

The conversation is not finished until you get an answer.

### Always Update Task Status

Mark blocked tasks as `waiting_for_message` immediately after sending.

## Task Management

**Before sending**:
1. Identify which tasks are blocked

**After sending**:
1. Mark blocked tasks as `waiting_for_message`

**When you receive reply**:
1. Update tasks to `in_progress` or `pending`

## Summary

Requesting information is about getting unblocked efficiently. State what you need, explain what's blocked, set expect_reply=true, update task status. For problems outside your authority or capability, use escalating-issues pattern instead.
