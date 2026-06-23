# Employee Runtime Requirements

## Event Loop Architecture

### Main Loop Flow

```typescript
async function employeeLoop(employeeName: string, role: Role) {
  // 1. Initialize
  const msgClient = new MessageClient(employeeName)
  const opcodeClient = createOpencodeClient()
  let currentSession = null
  
  // 2. Main loop
  while (true) {
    // 3. Wait for event (blocking)
    const event = await waitForEvent(msgClient)
    // event can be MessageEvent, TaskEvent, EmployeeWorkSessionEvent, TimerEvent
    
    // 4. Read current memory
    const memory = readMemory(employeeName)
    
    // 5. Generate Mermaid task graph
    const mermaidGraph = generateMermaid(memory.tasks)
    
    // 6. Calculate executable tasks
    const executableTasks = calculateExecutableTasks(memory.tasks)
    
    // 7. Build context
    const context = buildContext({
      rolePrompt: role.systemPrompt,
      memory: memory,
      mermaidGraph: mermaidGraph,
      executableTasks: executableTasks,
      event: event
    })
    
    // 8. Create or reuse session
    if (!currentSession) {
      currentSession = await opcodeClient.session.create()
    }
    
    // 9. Send prompt to AI (with tools)
    const response = await opcodeClient.session.prompt({
      path: { id: currentSession.id },
      body: {
        parts: [{ type: "text", text: context }],
        tools: [
          editTasksTool,
          sendMessageTool,
          createAgentTool,
          hireEmployeeTool
        ]
      }
    })
    
    // 10. Process tool calls
    // AI may call tools multiple times, deciding next step based on results
    // Framework automatically handles tool call loop
    
    // 11. Check context length
    if (currentSession.tokens.total > THRESHOLD) {
      // Force memory summarization
      const summary = await summarizeMemory(opcodeClient, currentSession)
      writeMemory(employeeName, {
        knowledge: summary.knowledge,
        tasks: memory.tasks,  // tasks don't need summarization
        custom: summary.custom
      })
      
      // Close session
      currentSession = null
    }
    
    // 12. Continue loop, wait for next event
  }
}
```

## Context Building

### Context Structure

```markdown
# System Prompt (Role Definition)
{role.systemPrompt}

# Current Memory
## Experience Knowledge
{memory.knowledge}

## Custom Fields
{memory.custom}

# Task Status (Mermaid Graph)
```mermaid
{mermaidGraph}
```

# Executable Tasks
The following tasks have satisfied dependencies and can be executed immediately:
{executableTasks}

# Current Event
Type: {event.type}
{other event fields}

# Your Task
Based on the above information, decide your next action. You can:
- Call tools to perform operations
- Output text to indicate waiting (e.g., "Good, now just need to wait for xxx")
```

### Context Components

**Role Prompt**:
- Defines employee's responsibilities and behavior
- Loaded from role definition
- Static for each role

**Memory**:
- Knowledge: Experience and insights
- Custom: Role-specific data
- Loaded from memory file

**Task Graph**:
- Mermaid visualization of task dependencies
- Generated from current task list
- Helps AI understand progress

**Executable Tasks**:
- List of tasks ready to execute
- Calculated from task dependencies
- Guides AI's next actions

**Event**:
- Trigger for current loop iteration
- Contains event type and data
- Determines context of action

## Event Waiting Mechanism

```typescript
async function waitForEvent(msgClient: MessageClient): Promise<Event> {
  // Concurrently wait for multiple event sources
  return Promise.race([
    // 1. Wait for new message
    msgClient.recv().then(msg => ({
      type: "message",
      from: msg.from,
      content: msg.content,
      timestamp: msg.timestamp
    })),
    
    // 2. Wait for task completion (via file watch or polling)
    waitForTaskCompletion(),
    
    // 3. Wait for agent completion
    waitForAgentCompletion(),
    
    // 4. Timer event
    waitForTimer()
  ])
}
```

### Event Sources

**Message Events**:
- Triggered by `msgClient.recv()`
- Blocks until new message arrives
- Most common event type

**Task Events**:
- Triggered by task status changes
- Implementation: file watch or polling
- Example: Task completed by another employee

**EmployeeWorkSession Events**:
- Triggered by EmployeeWorkSession status changes
- Monitored through EmployeeWorkSessionManager and StateManager events
- Contains EmployeeWorkSession status metadata

**Timer Events**:
- Triggered by scheduled timers
- For periodic tasks
- Example: Daily report generation

## Session Management

### Session Lifecycle

**Creation**:
- Create new session when `currentSession` is null
- Load current memory into context
- Session persists across multiple events

**Reuse**:
- Reuse session for subsequent events
- Maintains conversation history
- Reduces context rebuilding overhead

**Termination**:
- Close session when context exceeds threshold
- Trigger memory summarization
- Next event creates new session

### Context Threshold

**Threshold Types**:
- Token count: Total tokens in session
- Turn count: Number of prompt-response cycles
- Time-based: Session duration

**Threshold Values** (configurable):
- Token threshold: 100,000 tokens
- Turn threshold: 50 turns
- Time threshold: 1 hour

## Memory Summarization

### Trigger Conditions

- Context reaches threshold (token/turn/time)
- Manual trigger (via tool or API)

### Summarization Process

1. Send special prompt requesting summarization
2. Use structured output to get structured memory
3. Validate summarization result
4. Write to memory file
5. Close current session
6. Next event creates new session with updated memory

### Summarization Prompt

```
Based on our conversation history, please summarize your experience and knowledge.

Focus on:
- Key insights and learnings
- Patterns you've observed
- Relationships with other employees
- Important context for future work

Provide your summary in the following format:
{
  "knowledge": ["insight 1", "insight 2", ...],
  "custom": { /* role-specific data */ }
}
```

### Summarization Schema

```typescript
{
  type: "object",
  properties: {
    knowledge: { 
      type: "array", 
      items: { type: "string" } 
    },
    custom: { 
      type: "object" 
    }
  },
  required: ["knowledge", "custom"]
}
```

## Error Handling

### Event Loop Errors

- Catch all errors in main loop
- Log error with context
- Continue loop (don't crash)
- Optionally notify admin

### Tool Execution Errors

- Tool errors returned to AI
- AI can retry or take alternative action
- Errors logged for debugging

### Session Errors

- Session creation failures: retry with backoff
- Session timeout: create new session
- API errors: log and retry

## Lifecycle Management

### Employee Startup

1. Initialize message client
2. Initialize OpenCode client
3. Load initial memory
4. Register in state manager
5. Start event loop

### Employee Shutdown

1. Complete current event processing
2. Summarize memory if needed
3. Close current session
4. Unregister from state manager
5. Clean up resources

### Graceful Restart

- Save current state before shutdown
- Resume from last event after restart
- No message loss

## Performance Considerations

### Event Processing Time

- Target: < 5 seconds per event
- Includes: context building, AI inference, tool execution
- Monitoring: Log processing time for each event

### Memory Usage

- Target: < 100MB per employee
- Includes: session state, memory, message history
- Monitoring: Track memory usage per employee

### Concurrency

- Multiple employees run concurrently
- Each employee has independent event loop
- No shared mutable state between employees

## Test Scenarios

### Scenario 1: Basic Event Loop

```
1. Start employee
2. Send message event
3. Employee processes and responds
4. Loop continues
```

**Verification**:
- Event loop starts successfully
- Event processed correctly
- Response sent
- Loop continues waiting

### Scenario 2: Multiple Events

```
1. Send message event 1
2. Send message event 2
3. Complete task (task event)
4. Agent completes (agent event)
```

**Verification**:
- Events processed in order
- Each event triggers appropriate action
- No event loss

### Scenario 3: Context Threshold

```
1. Process 50 events (reach turn threshold)
2. Trigger summarization
3. Session closed
4. Next event creates new session
```

**Verification**:
- Summarization triggered correctly
- Memory updated
- New session loads updated memory
- No context loss

### Scenario 4: Error Recovery

```
1. Tool execution fails
2. AI receives error
3. AI retries or takes alternative action
4. Loop continues
```

**Verification**:
- Error handled gracefully
- AI can recover
- Loop doesn't crash

### Scenario 5: Concurrent Employees

```
1. Start employee A
2. Start employee B
3. A sends message to B
4. B processes and responds
5. Both continue independently
```

**Verification**:
- Both employees run concurrently
- Message delivered correctly
- No interference between employees

## Design Rationale

**Why event-driven architecture?**
- Natural fit for asynchronous collaboration
- Efficient resource usage (blocking wait)
- Clear trigger for each action

**Why reuse sessions?**
- Maintains conversation context
- Reduces overhead of context rebuilding
- Better AI performance with history

**Why periodic summarization?**
- Prevents context explosion
- Consolidates learning
- Enables long-running employees

**Why blocking recv()?**
- Simple programming model
- Efficient (no polling)
- Natural synchronization point
