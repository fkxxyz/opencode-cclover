# Communication Pattern: Delegating Work

## When to Use

Use when you need someone else to do work that's outside your role or capacity.

**Triggers**:
- Assigning a task to a team member
- Handing off work to another role
- Someone needs to implement something you've designed
- Distributing work across the team

## Core Principle: Document First, Message Second

**Always**:
1. Write complete information in a document first
2. Use reference_docs to share the document
3. Keep message content brief
4. Set expect_reply=false (if document is complete)

**Why**:
- Creates permanent record (tracked, versioned, referenced)
- Recipient can forward document easily
- Saves tokens (document has details, message just points)
- Clearer than long messages
- No unnecessary confirmation needed

## Message Structure

**Message**: "Implement user profile page per tasks/user-profile-page.md."

**reference_docs**: `["tasks/user-profile-page.md", "designs/user-profile.png"]`

**expect_reply**: false

## Document Requirements

Write complete specifications in document. Recipient will ask if unclear.

## Best Practices

### Write Document First

Don't put requirements in message. Write them in document, then reference document.

Documents can be updated, tracked in version control, referenced by multiple people, and are easier to read than long messages.

### Keep Message Brief

Message states what needs to be done and points to document. Don't repeat document contents.

Do: "Implement user profile page per tasks/user-profile-page.md."

### Set expect_reply=false for Complete Delegation

If document is complete, set expect_reply=false. Recipient knows what to do.

**Exception**: If delegating to someone new or task is ambiguous, might set expect_reply=true to confirm understanding. Should be rare—aim for complete documentation.

## Handling Questions

If recipient asks questions:
1. Answer clearly
2. Update document if question reveals missing information
3. Set expect_reply=false if answer is complete
4. Set expect_reply=true if you need confirmation they understand
