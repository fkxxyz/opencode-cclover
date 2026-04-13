# Feedback System Manual Testing Guide

## Test Scenario 1: Survey Trigger (Happy Path)

### Steps
1. As core lead employee, call `complete_major_task` tool
2. Check all employees' message queues

### Expected Outcomes
- Tool returns success message with employee count
- All employees receive message from `0-cclover`
- Message contains "Work Experience Survey"
- Message has `expect_reply=true`

## Test Scenario 2: Permission Denial

### Steps
1. As non-core-lead employee, call `complete_major_task` tool

### Expected Outcomes
- Tool throws error: "Permission denied"
- No survey sent

## Test Scenario 3: Feedback Collection

### Steps
1. Employee sends message to `0-cclover` with feedback
2. Check employee directory for feedback file

### Expected Outcomes
- File created: `feedback-{timestamp}.md`
- File contains only raw feedback content
- Timestamp is Unix seconds

## Test Scenario 4: Survey Reminders

### Steps
1. Survey sent but employee doesn't reply
2. Wait 24 hours (or mock time)
3. Check for reminder events

### Expected Outcomes
- After 24h: First `reply_reminder` event
- After 48h: Second reminder
- After 72h: Third reminder
- After 3 reminders: Employee status becomes `abnormal`

## Test Scenario 5: System Boss Verification

### Steps
1. Check BossManager.isBoss("0-cclover")
2. Check BossManager.getBosses()

### Expected Outcomes
- `isBoss("0-cclover")` returns `true`
- `getBosses()` includes "0-cclover"
- "0-cclover" appears first in list

## Acceptance Criteria

- [ ] BossManager.isBoss('0-cclover') returns true
- [ ] Core lead role can trigger survey
- [ ] Non-core-lead role rejected
- [ ] All employees receive survey from 0-cclover
- [ ] Feedback auto-saves to feedback-{timestamp}.md
- [ ] Max 3 reminders every 24h
- [ ] Abnormal status after 3 reminders
