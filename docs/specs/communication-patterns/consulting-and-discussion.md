# Communication Pattern: Consulting and Discussion

## When to Use

Use when you need to discuss options, explore solutions, or consult on decisions before proceeding.

**Triggers**:
- Discussing tradeoffs between multiple approaches
- Need expert input on a technical decision
- Exploring a problem space before committing
- Aligning on direction before implementing

## Message Structure

**Initial message** typically includes:
- Options with analysis (not just "What should I do?")
- Context and constraints
- What you're trying to achieve
- expect_reply=true

**During discussion**:
- expect_reply=true for each message
- Direct responses to questions
- Refined thinking based on input

**Final message**:
- expect_reply=false (closes the discussion)

## Managing expect_reply

Consultation involves multiple rounds of discussion. Messages during discussion use expect_reply=true. The final message that closes discussion uses expect_reply=false.

## Best Practices

### Present Options with Analysis

Example: "Caching options: Redis (fast, infrastructure cost), in-memory (simple, won't scale), CDN (offloads, less control). Context: 1000 req/min, 3x growth expected. Recommendation?"

### Provide Context and Constraints

Useful context includes:
- What you're trying to achieve
- Constraints you're working within
- Factors that matter most

### Know When Discussion is Complete

Discussion typically concludes when:
- Decision made
- Direction agreed upon
- All questions answered
- Both parties aligned

## Task Management

If discussion blocks your work:
1. Send initial message with expect_reply=true
2. Mark blocked tasks as `waiting_for_message`
3. Keep tasks as `waiting_for_message` during discussion
4. When discussion concludes, update tasks to `in_progress` or `pending`
