# Task Management Best Practices

## Core Purpose: System Reminders Prevent Forgetting

**Tasks are your personal notes plus an automatic reminder system.**

The system monitors tasks with these conditions:
- Status is `pending` or `in_progress`
- All dependencies are completed or cancelled (or no dependencies)

When you have such tasks and become idle, **the system sends reminder events**.

This is why status management matters:
- ✓ Mark as `waiting_for_message` when blocked → System stops reminding
- ✗ Leave as `pending`/`in_progress` when blocked → System keeps reminding unnecessarily

## Task Status and the Reminder System

### Status Values

- **`pending`**: Ready to start, not started yet
- **`in_progress`**: Currently working on it
- **`waiting_for_message`**: Blocked on external input (system won't remind)
- **`completed`**: Done
- **`cancelled`**: No longer needed

### The Critical Pattern: Handling Blocked Work

When blocked:
1. Send message to get unblocked
2. **Mark task as `waiting_for_message`** ← System stops reminding
3. Work on other tasks

When unblocked:
1. Receive the reply
2. **Mark task back to `in_progress`** ← System resumes reminding
3. Continue work

**Why this matters**: If you don't mark blocked tasks as `waiting_for_message`, the system treats them as executable and keeps sending reminders about work you can't actually do.

## Common Patterns

### Blocked Then Unblocked
```
1. Task "Implement feature X" (status: in_progress)
2. Need clarification → send message
3. Mark as waiting_for_message ← System stops reminding
4. Work on other tasks
5. Receive reply
6. Mark back to in_progress ← System resumes reminding
7. Continue work
```

## Common Mistakes

### Mistake 1: Not Marking Blocked Tasks

**Problem**: Task is blocked but status is still `pending` or `in_progress`

**Result**: System keeps reminding you about work you can't do

**Fix**: Always mark as `waiting_for_message` when blocked

## Key Principles

### Principle 1: Status Must Reflect Reality

The reminder system relies on accurate status:
- `in_progress` = actively working right now
- `pending` = ready to start
- `waiting_for_message` = blocked (prevents reminders)
- `completed` = done

Update status as your situation changes.

### Principle 2: waiting_for_message Is Your Friend

This status is the key to working with the reminder system. Use it whenever you're blocked on external input.

## Summary

**Tasks = Personal notes + Reminder system**

The system reminds you about executable tasks when you're idle. Keep status accurate, especially `waiting_for_message` for blocked work, to prevent unnecessary reminders.
