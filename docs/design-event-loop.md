# EventLoop Design

## Overview

EventLoop is the core runtime mechanism for employees, responsible for waiting for events, processing events, invoking AI, and managing session lifecycle.

**Module Purpose**: Implement event-driven employee behavior, enabling autonomous decision-making through continuous event processing and AI interaction.

**Key Responsibilities**:
- Event waiting and dispatching
- Session lifecycle management
- Context building and AI invocation
- Memory summarization triggering
- Tool execution coordination

## Architecture Reference

Implements the employee runtime requirements specified in [Requirements - Employee Runtime](./requirements-runtime.md).

**Design Principles**:
- **Event-Driven**: Employee actions triggered by events (messages, agent completion, etc.)
- **Async Non-Blocking**: Use async/await for concurrency
- **Session Reuse**: Session persists until token threshold reached
- **Auto-Summarization**: Automatically summarize memory when threshold exceeded

## Interface

### Public API

#### EventLoop Class

```typescript
class EventLoop {
  constructor(
    private employeeName: string,
    private role: Role,
    private messageClient: MessageClient,
    private memoryManager: MemoryManager,
    private opcodeClient: OpencodeClient
  )
  
  // Main loop (never returns)
  async run(): Promise<void>
}
```

#### Event Types

```typescript
type Event = MessageEvent | AgentEvent

interface MessageEvent {
  type: 'message'
  from: string
  content: string
  timestamp: string
}

interface AgentEvent {
  type: 'agent_completed'
  agentId: string
  taskName: string
  result: string
  timestamp: string
}
```

### Creating Instance

```typescript
import { EventLoop } from './core/EventLoop'
import { CalculatorRole } from './roles/Calculator'

// Create event loop for calculator employee
const eventLoop = new EventLoop(
  'calculator',                    // Employee name
  CalculatorRole,                  // Role definition
  messageClient,                   // MessageClient instance
  memoryManager,                   // MemoryManager instance
  opcodeClient                     // OpenCode SDK client
)

// Start event loop (runs forever)
await eventLoop.run()
```

## Internal Design

### Component Architecture

```mermaid
graph TD
    A[EventLoop] --> B[waitForEvent]
    A --> C[handleEvent]
    A --> D[Session Manager]
    A --> E[Summarization]
    
    B --> F[MessageClient.recv]
    B --> G[Agent Completion Events]
    
    C --> H[ensureSession]
    C --> I[buildEventMessage]
    C --> J[OpencodeClient.prompt]
    
    D --> K[createSession]
    D --> L[closeSession]
    
    E --> M[checkTokenThreshold]
    E --> N[requestSummaE --> O[MemoryManager.summarize]
```

### Internal Components

#### 1. Main Event Loop

```typescript
async run(): Promise<void> {
  console.log(`[${this.employeeName}] Starting event loop...`)
  
  while (true) {
    try {
      // 1. Wait for event (blocking)
      const event = await this.waitForEvent()
      
      // 2. Handle event
      await this.handleEvent(event)
      
      // 3. Check if summarization needed
      await this.summarizeIfNeeded()
      
    } catch (error) {
      console.error(`[${this.employeeName}] Error in event loop:`, error)
      // Continue loop, don't exit
    }
  }
}
```

#### 2. aiting

```typescript
private async waitForEvent(): Promise<Event> {
  // Race between multiple event sources
  return Promise.race([
    // Wait for new message
    this.messageClient.recv().then(msg => ({
      type: 'message' as const,
      from: msg.from,
      content: msg.content,
      timestamp: msg.timestamp
    })),
    
    // Wait for agent completion
    this.waitForAgentCompletion()
  ])
}

private async waitForAgentCompletion(): Promise<AgentEvent> {
  // Subscribe to OpenCode event stream
  const events = await this.opcodent.event.subscribe()
  
  for await (const event of events.stream) {
    if (event.payload.type === 'session.status') {
      const sessionId = event.payload.properties.sessionID
      
      // Check if this is our agent
      if (agentRegistry.isOurAgent(sessionId)) {
        const info = agentRegistry.getInfo(sessionId)!
        
        return {
          type: 'agent_completed',
          agentId: sessionId,
          taskName: info.taskName,
          result: await this.getAgentResult(sessionId),
          timestamp: new Date().toISOString()
        }
      }
    }
  }
  
  throw new Error('Unexpected end of event stream')
}
```

#### 3. Event Handling

```typescript
private async handleEvent(event: Event): Promise<void> {
  console.log(`[${this.employeeName}] Received event:`, event.type)
  
  // 1. Ensure session exists
  const session = await this.ensureSession()
  
  // 2. Build event message
  const eventMessage = this.buildEventMessage(event)
  
  // 3. Send to AI with tools
  await this.opcodeClient.session.prompt({
    path: { id: session.id },
    body: {
      parts: [
        { type: 'text', text: eventMessage }
      ],
      tools: {
        'send_message': true,
        'edit_tasks': true,
        'create_agent': true
      }
    }
  })
  
  // Increment message count
  this.messageCount++
  
  // AI will automatically call tools, execution completes when tools return
  console.log(`[${this.employeeName}] Event handled`)
}
```

#### 4. Session Management

```typescript
private currentSession: Session | null = null
private messageCount: number = 0

private async ensureSession(): Promise<Session> {
  if (this.currentSession) {
    return this.currentSession
  }
  
  // Try to recover session from memory
  const memory = await this.memoryManager.read(this.employeeName)
  if (memory.sessionId) {
    try {
      const session = await this.opcodeClient.session.get({ path: { id: memory.sessionId } })
      this.currentSession = session.data
      // Recover message count from API
      const messages = await this.opcodeClient.session.messages({ path: { id: memory.sessionId } })
      this.messageCount = messages.data.length
      console.log(`[${this.employeeName}] Recovered session: ${memory.sessionId}`)
      return this.currentSession
    } catch (error) {
      console.log(`[${this.employeeName}] Failed to recover session, creating new one`)
    }
  }
  
  // Create new session
  const systemPrompt = await this.buildSystemPrompt()
  
  const response = await this.opcodeClient.session.create({
    body: {
      title: `${this.employeeName} - ${new Date().toISOString()}`,
      system: systemPrompt
    }
  })
  
  this.currentSession = response.data
  this.messageCount = 0
  
  // Persist session ID to memory
  memory.sessionId = this.currentSession.id
  await this.memoryManager.write(this.employeeName, memory)
  
  // Register session in registry
  sessionRegistry.register(this.currentSession.id, this.employeeName)
  
  console.log(`[${this.employeeName}] Created session: ${this.currentSession.id}`)
  
  return this.currentSession
}

private async closeSession(): Promise<void> {
  if (!this.currentSession) return
  
  console.log(`[${this.employeeName}] Closing session: ${this.currentSession.id}`)
  this.currentSession = null
  this.messageCount = 0
  // sessionId is cleared by summarize() in MemoryManager
}
```

#### 5. Context Building

```typescript
private async buildSystemPrompt(): Promise<string> {
  return await this.memoryManager.buildSystemPrompt(
    this.employeeName,
    this.role.systemPrompt
  )
}

private buildEventMessage(event: Event): string {
  if (event.type === 'message') {
    return `
# Current Event
Type: Message Event
Sender: ${event.from}
Content: ${event.content}
Time: ${event.timestamp}
`.trim()
  }
  
  if (event.type === 'agent_completed') {
    return `
# Current Event
Type: Agent Completion Event
Agent ID: ${event.agentId}
Related Task: ${event.taskName}
Execution Result: ${event.result}
Time: ${event.timestamp}
`.trim()
  }
  
  return ''
}
```

#### 6. Summarization Mechanism

```typescript
private async summarizeIfNeeded(): Promise<void> {
  if (!this.currentSession) return
  
  // Get current session token usage
  const session = await this.opcodeClient.session.get({
    path: { id: this.currentSession.id }
  })
  
  const TOKEN_THRESHOLD = 100000  // 100k tokens
  
  if (session.data.tokens.total >= TOKEN_THRESHOLD) {
    console.log(`[${this.employeeName}] Token threshold reached, summarizing...`)
    
    // 1. Request AI to summarize
    const summary = await this.requestSummary()
    
    // 2. Save summary to memory
    await this.memoryManager.summarize(this.employeeName, summary)
    
    // 3. Close current session
    await this.closeSession()
    
    console.log(`[${this.employeeName}] Summary completed`)
  }
}

private async requestSummary(): Promise<{ knowledge: string[], custom: Record<string, any> }> {
  if (!this.currentSession) {
    throw new Error('No active session')
  }
  
  // Use structured output to get summary
  const response = await this.opcodeClient.session.prompt({
    path: { id: this.currentSession.id },
    body: {
      parts: [
        {
          type: 'text',
          text: 'Please summarize your experience knowledge and custom data.'
        }
      ],
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            knowledge: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of experience knowledge'
            },
            custom: {
              type: 'object',
              description: 'Custom data'
            }
          },
          required: ['knowledge', 'custom']
        }
      }
    }
  })
  
  return response.data.info.structured as { knowledge: string[], custom: Record<string, any> }
}
```

### Error Handling

**Event Loop Errors**:
- Catch all errors in main loop
- Log error and continue (don't exit)
- Ensures one employee's error doesn't affect others

**Session Errors**:
- Session creation failure → Log and retry on next event
- Prompt failure → Log and continue
- Summarization failure → Log and close session anyway

## Data Flow

### Event Processing Flow

```mermaid
sequenceDiagram
    participant Loop as EventLoop
    participant Client as MessageClient
    participant Session as OpenCode Session
    participant Tools as Tool System
    participant Memory as MemoryManager
    
    Loop->>Client: recv() (blocking)
    Client-->>Loop: MessageEvent
    Loop->>Loop: ensureSession()
    Loop->>Loop: buildEventMessage()
    Loop->>Session: prompt(event + tools)
    Session->>Session: AI processes event
    Session->>Tools: Call send_message
    Tools->>Tools: Execute tool
    Tools-->>Session: Tool result
    Session-->>Loop: Prompt complete
    Loop->>Loop: summarizeIfNeeded()
    Loop->>Client: recv() (next iteration)
```

### Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> NoSession: EventLoop starts
    NoSession --> SessionActive: First event arrives
    SessionActive --> SessionActive: Process events
    SessionActive --> Summarizing: Token threshold reached
    Summarizing --> NoSession: Summary complete
    NoSession --> SessionActive: Next event arrives
```

### Multi-Employee Concurrency

```mermaid
graph TD
    A[Plugin Entry] --> B[EventLoop: calculator]
    A --> C[EventLoop: coder]
    A --> D[EventLoop: pm]
    
    B --> E[MessageService]
    C --> E
    D --> E
    
    B --> F[MemoryManager]
    C --> F
    D --> F
    
    B --> G[OpencodeClient]
    C --> G
    D --> G
```

## Performance Considerations

### Optimization Strategies

1. **Parallel Employee Execution**: Each employee runs in independent async context
2. **Session Reuse**: Avoid creating new session for every event
3. **Lazy Summarization**: Only summarize when threshold reached

### Scalability Limitations (Phase 1)

- No limit on number of concurrent employees
- Each employee maintains one active session
- Token threshold is fixed (not configurable)

### Future Optimizations

- Configurable token threshold per role
- Session pooling for faster startup
- Event prioritization (urgent vs normal)
- Graceful shutdown mechanism

## Testing Strategy

### Unit Tests

```typescript
describe('EventLoop', () => {
  test('process message event', async () => {
    const mockMessageClient = createMockMessageClient()
    const mockMemoryManager = createMockMemoryManager()
    const mockOpcodeClient = createMockOpcodeClient()
    
    const eventLoop = new EventLoop(
      'test-employee',
      TestRole,
      mockMessageClient,
      mockMemoryManager,
      mockOpcodeClient
    )
    
    // Simulate message event
    mockMessageClient.recv.mockResolvedValueOnce({
      from: 'user',
      content: 'Hello',
      timestamp: '2026-03-01T10:00:00Z'
    })
    
    // Run one iteration
    await eventLoop.runOnce() // Test helper method
    
    expect(mockOpcodeClient.session.prompt).toHaveBeenCalled()
  })
  
  test('trigger summarization at threshold', async () => {
    const mockOpcodeClient = createMockOpcodeClient()
    mockOpcodeClient.session.get.mockResolvedValue({
      data: { tokens: { total: 150000 } }
    })
    
    const eventLoop = new EventLoop(...)
    
    await eventLoop.summarizeIfNeeded()
    
    expect(mockMemoryManager.summarize).toHaveBeenCalled()
  })
})
```

### Integration Tests

- Test complete event processing with real MessageService
- Test session creation and reuse
- Test summarization trigger and memory update
- Test error recovery and loop continuation

## Implementation Checklist

- [x] EventLoop class
  - [x] Constructor and initialization
  - [x] run() main loop
- [x] Event waiting
  - [x] waitForEvent() method
  - [x] waitForAgentCompletion() method
- [x] Event handling
  - [x] handleEvent() method
  - [x] buildEventMessage() method
- [x] Session management
  - [x] ensureSession() method
  - [x] closeSession() method
- [x] Context building
  - [x] buildSystemPrompt() method
- [x] Summarization
  - [x] summarizeIfNeeded() method
  - [x] requestSummary() method
- [x] Error handling
  - [x] Try-catch in main loop
  - [x] Error logging
- [x] Tests
  - [x] Unit tests
  - [x] Integration tests
