# Communication Pattern: Responding to Messages

## When to Use

Use this pattern when you receive any message from another employee.

## Setting expect_reply in Your Response

The critical decision: Does the conversation continue or end?

**Set expect_reply=false** when:
- You answered their question completely
- You provided the information they requested
- You made the decision they escalated
- The conversation is finished

**Set expect_reply=true** when:
- You need clarification before you can answer
- You answered but need their confirmation to proceed
- You're asking a follow-up question
- The conversation must continue

**The boundary is clear**: If they need to respond for the conversation to be complete, set true. Otherwise, set false.

## Why expect_reply Matters

Setting expect_reply incorrectly causes coordination failures:
- **false when true needed**: Sender thinks conversation ended, blocks waiting for response that never comes
- **true when false needed**: Sender expects reply, wastes attention checking for messages, creates unnecessary notification noise

The system uses expect_reply to manage message queues and notification priorities. Correct usage keeps communication efficient.

## Response Patterns by Message Type

### Responding to Information Requests

**Their message**: "Should MemoryManager cache task DAG calculation results?"

**Your response**: "Yes. Cache until edit_tasks called."

**expect_reply**: false

**If explanation needed**: "Yes. Cache until edit_tasks called. DAG calculation is expensive, dependencies don't change between edits."

### Responding to Escalations

**Their message**: "Need decision: MessageService use file locks or message queue?"

**Your response**: "File locks. Already implemented, proven stable."

**expect_reply**: false

**If guidance needed**: "File locks. Already implemented, proven stable. Revisit queue if lock contention becomes measurable problem."

### Responding to Coordination Requests

**Their message**: "Do my StateManager changes conflict with your EventLoop refactor?"

**Your response**: "No conflicts. Proceed."

**expect_reply**: false

**If conflicts exist**: "Conflicts in EventLoop.processEvent signature. See my changes in event-loop-refactor branch. Discuss?"

**expect_reply**: true (discussion needed)

### Responding When You Need More Information

**Their message**: "Should RoleManager validate role definitions on load or on hire?"

**Your response**: "Need context. How often are roles loaded vs hired? Tolerate startup delay for validation?"

**expect_reply**: true

## Handling Different Scenarios

### When You Can Answer Immediately

Provide the answer. Set expect_reply=false.

### When You Need Time to Investigate

Don't acknowledge receipt. Investigate, then respond with the answer.

**Exception**: If investigation takes significant time (hours/days): "Investigating. Will respond by [time]."

This sets expectations, which is information.

### When You Need Clarification

Ask for what you need. Set expect_reply=true.

**Example**: "Need context. How often are roles loaded vs hired? Tolerate startup delay?"

### When the Question is Outside Your Authority

State this and direct them to the right person.

**Example**: "Outside my authority. Escalate to Boss."

Set expect_reply=false.

### When You Partially Answer

Provide what you can, state what's missing.

**Example**: "Use proper-lockfile for MessageService. Can't advise on retry strategy without knowing expected contention rate."

Set expect_reply based on whether you need their input to complete the answer.

## Coordination with Task Management

If your response unblocks their work, they will update their tasks. You don't need to tell them to do this.

If your response creates work for you, update your own tasks.
