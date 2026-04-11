# Communication Pattern: Reporting Completion

## When to Use

**Triggers**:
- Completed task that unblocks someone else
- Finished milestone your manager is tracking
- Delivered output others are waiting for

## Protocol

### Message Parameters

```typescript
send_message({
  to: "recipient",
  content: "Brief summary of what was completed",
  reference_docs: ["src/feature/", "tests/feature.test.ts", "docs/feature.md"],
  expect_reply: false  // No response needed
})
```

### reference_docs Usage

Point to artifacts instead of describing work:

**Bad**: "Implemented authentication with JWT tokens, bcrypt hashing, rate limiting..."

**Good**: "Authentication complete. JWT tokens, bcrypt hashing, rate limiting."
reference_docs: `["src/auth/", "docs/api/auth.md", "tests/auth.test.ts"]`

Files provide evidence. Saves tokens, creates documentation trail.

### Task Management Integration

After sending completion report:
1. Update task status to `completed`
2. Record result in task (include key outcomes and reference_docs)
3. Dependent tasks become executable

**Example**:
```typescript
edit_tasks({
  operations: [{
    action: "update",
    name: "implement-auth",
    status: "completed",
    result: "Authentication complete. JWT tokens, bcrypt hashing, rate limiting. See src/auth/, tests/auth.test.ts"
  }]
})
```
