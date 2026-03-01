# Memory System Requirements

## Memory File Structure

```yaml
# calculator/memory.yaml

# Experience knowledge (free text, AI-maintained)
knowledge:
  - alice often asks me math calculation questions
  - I'm good at handling arithmetic and simple algebra
  - I cannot handle complex calculus problems

# Task state (DAG structure)
tasks:
  - name: "Calculate1+1"
    status: completed
    description: Calculate 1+1 for alice
    result: "2"
    dependencies: []
    created: 2026-03-01T10:00:00Z
    completed: 2026-03-01T10:00:05Z
    
  - name: "Calculate3+4"
    status: completed
    description: Calculate 3+4 for alice
    result: "7"
    dependencies: []
    created: 2026-03-01T10:01:00Z
    completed: 2026-03-01T10:01:03Z
    
  - name: "SumPreviousResults"
    status: in_progress
    description: Add results of "Calculate1+1" and "Calculate3+4"
    dependencies: ["Calculate1+1", "Calculate3+4"]
    created: 2026-03-01T10:02:00Z

# Role-specific custom fields
custom:
  # Example: PM role might need:
  # team_members: [alice, bob, calculator]
  # current_sprint: sprint_5
```

## Memory Field Specifications

### knowledge (Experience Knowledge)

- **Type**: String array
- **Content**: Work experience, knowledge accumulation, relationships with other employees
- **Maintenance**: AI autonomously judges and updates
- **Purpose**: Long-term learning and context retention

### tasks (Task List)

- **Type**: Task object array
- **Fields**:
  - `name`: Task name (unique identifier, AI-generated)
  - `status`: Task status (`pending` | `in_progress` | `completed` | `cancelled`)
  - `description`: Task description
  - `result`: Task result (filled when completed)
  - `dependencies`: List of dependent task names
  - `created`: Creation timestamp
  - `completed`: Completion timestamp (optional)
- **Maintenance**: Managed via `edit_tasks` tool
- **Purpose**: Track work progress and dependencies

### custom (Custom Fields)

- **Type**: Object
- **Content**: Role-specific data
- **Maintenance**: AI autonomously judges and updates
- **Purpose**: Role-specific state and configuration

## Memory Update Mechanism

### Real-Time Updates

- Tasks updated via `edit_tasks` tool immediately
- No need to wait for summarization
- Changes persisted to file system immediately

### Periodic Summarization

**Trigger Conditions**:
- Context reaches threshold (token count or turn count)

**Summarization Content**:
- Only summarize `knowledge` and `custom`
- Tasks are already up-to-date (managed by tool)

**Summarization Process**:
1. Send special prompt requesting summarization
2. Use structured output to get structured memory
3. Save to `memory.yaml`
4. Close current session
5. Next event creates new session, loads updated memory

**Summarization Schema**:
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
  }
}
```

## Memory Access Patterns

### Read Memory

- Read entire memory file at event loop start
- Parse YAML into structured object
- Pass to context builder

### Write Memory

**Tasks**:
- Updated via `edit_tasks` tool
- Immediate write to file system
- File locking ensures consistency

**Knowledge and Custom**:
- Updated via periodic summarization
- Batch write after summarization
- File locking ensures consistency

## Implementation Requirements

### File Operations

- Use YAML format for human readability
- Use `proper-lockfile` for concurrent access
- Handle file not found gracefully (create default memory)

### Validation

- Validate task dependencies (no cycles)
- Validate task status transitions
- Validate required fields

### Error Handling

- Handle corrupted YAML files
- Handle missing fields (use defaults)
- Provide meaningful error messages

## Test Scenarios

### Scenario 1: Task Lifecycle

```
1. Add task "Calculate1+1" (pending)
2. Update task to in_progress
3. Update task to completed with result "2"
```

**Verification**:
- Task status transitions correctly
- Timestamps recorded correctly
- Result saved correctly

### Scenario 2: Task Dependencies

```
1. Add task "Calculate1+1" (pending)
2. Add task "Calculate3+4" (pending)
3. Add task "SumResults" (pending, depends on both)
4. Complete "Calculate1+1"
5. Complete "Calculate3+4"
6. "SumResults" becomes executable
```

**Verification**:
- Dependencies tracked correctly
- Executable task calculation correct
- No circular dependencies allowed

### Scenario 3: Memory Summarization

```
1. Employee processes 50 messages
2. Context reaches threshold
3. Trigger summarization
4. New session loads updated memory
```

**Verification**:
- Knowledge updated with new insights
- Custom fields updated correctly
- Tasks preserved (not summarized)
- Session reset successful

## Design Rationale

**Why separate tasks from knowledge/custom?**
- Tasks are structured data, managed by tools
- Knowledge/custom are unstructured, AI-maintained
- Different update mechanisms (real-time vs. periodic)

**Why AI-generated task names?**
- Semantic naming improves readability
- AI naturally avoids duplicates
- Easier to reference in dependencies
- Better for Mermaid visualization

**Why not summarize tasks?**
- Tasks already structured and up-to-date
- Summarization might lose important details
- Tool-based management is more reliable

**Why periodic summarization?**
- Prevents context explosion
- Consolidates learning over time
- Reduces token usage in subsequent sessions
