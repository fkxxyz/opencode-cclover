# Tool System Requirements

## Tool Invocation Mechanism

- AI executes actions through tools
- Supports multi-turn invocation: After each tool call, AI can decide next step based on result
- AI can freely output text to indicate waiting (no need for `wait` tool)

## Available Tools

### 1. edit_tasks - Batch Edit Tasks

**Purpose**: Add, update, delete, or decompose tasks in batch

**Parameters**:
```typescript
{
  operations: [
    {
      action: "add" | "update" | "delete" | "decompose",
      
      // Required for "add"
      name?: string,
      description?: string, 
      dependencies?: string[],
      
      // Required for "update"
      name?: string,
      status?: "pending" | "in_progress" | "completed" | "cancelled",
      result?: string,
      
      // Required for "delete"
      name?: string,
      
      // Required for "decompose"
      name?: string,
      subtasks?: Array<{
        name: string,
        description: string,
        dependencies?: string[]
      }>
    }
  ]
}
```

**Usage Example**:
```json
{
  "operations": [
    {
      "action": "add",
      "name": "Calculate5*6",
      "description": "Calculate 5*6 for alice",
      "dependencies": []
    },
    {
      "action": "update",
      "name": "Calculate1+1",
      "status": "completed",
      "result": "2"
    },
    {
      "action": "delete",
      "name": "CancelledTask"
    },
    {
      "action": "decompose",
      "name": "ComplexTask",
      "subtasks": [
        {
          "name": "Subtask1",
          "description": "First part"
        },
        {
          "name": "Subtask2",
          "description": "Second part",
          "dependencies": ["Subtask1"]
        }
      ]
    }
  ]
}
```

**Return Value**:
- Success: Confirmation message with number of operations performed
- Failure: Error message with details

**Validation**:
- Task names must be unique (for add)
- Dependencies must reference existing tasks
- No circular dependencies
- Status transitions must be valid

### 2. send_message - Send Message

**Purpose**: Send message to other employees

**Parameters**:
```typescript
{
  to: string,      // Recipient name
  content: string  // Message content
}
```

**Usage Example**:
```json
{
  "to": "alice",
  "content": "Result is 2"
}
```

**Return Value**:
- Success: Confirmation message
- Failure: Error message (e.g., recipient not found)

**Behavior**:
- Centralized service writes to both parties' message files
- Atomic operation (both writes succeed or both fail)
- Recipient's `recv()` unblocks after write completes

### 3. create_employee_work_session - Create EmployeeWorkSession to Execute Task

**Purpose**: Create an EmployeeWorkSession backed by an OpenCode Session to execute task in background

**Parameters**:
```typescript
{
  task_name: string,  // Associated task name (must exist in memory)
  prompt: string      // Prompt for the EmployeeWorkSession
}
```

**Usage Example**:
```json
{
  "task_name": "Calculate(123+456)*789",
  "prompt": "Calculate (123 + 456) * 789 and return the result"
}
```

**Return Value**:
- Success: EmployeeWorkSession ID
- Failure: Error message

**Behavior**:
- Creates EmployeeWorkSession metadata and an OpenCode Session using SDK
- EmployeeWorkSession runs in background
- EmployeeWorkSession status is tracked by runtime state
- Task status should be updated to `in_progress` before creating an EmployeeWorkSession

**Requirements**:
- Task must exist in memory
- Task should be in `pending` or `in_progress` status
- Prompt should be clear and specific

### 4. hire_employee - Hire New Employee

**Purpose**: Create new employee with specified role

**Parameters**:
```typescript
{
  name: string,  // Employee name (must be unique)
  role: string   // Role type (must exist in RoleManager)
}
```

**Usage Example**:
```json
{
  "name": "coder-001",
  "role": "coder"
}
```

**Return Value**:
- Success: Confirmation message
- Failure: Error message (e.g., name already exists, invalid role)

**Behavior**:
- Validates role exists in RoleManager
- Registers employee in StateManager (auto-persists to `{projectRoot}/.cclover/employees.yaml`)
- Starts employee EventLoop in ProjectInstance
- Records hiredBy relationship

**Requirements**:
- Employee name must be unique
- Role must exist in RoleManager
- Any employee can hire any role (no permission restrictions)

## Tool Design Principles

### Idempotency

- Tools should be idempotent where possible
- Example: Updating task to same status should succeed (no-op)

### Atomicity

- Batch operations should be atomic (all or nothing)
- Example: `edit_tasks` with multiple operations

### Error Handling

- Clear error messages with actionable information
- Distinguish between user errors and system errors
- Provide context for debugging

### Validation

- Validate all inputs before execution
- Fail fast with clear error messages
- Prevent invalid state transitions

## Tool Context

Each tool receives context including:
- Current employee name
- Current session ID
- Workspace root path
- Service instances (MessageService, MemoryManager, etc.)

## Tool Return Format

**Success**:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* optional result data */ }
}
```

**Failure**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* optional error details */ }
  }
}
```

## Implementation Requirements

### Tool Registration

- Tools registered via OpenCode plugin API
- Tool definitions include name, description, parameters schema
- Tools bound to current project's service instances

### Tool Execution

- Tools execute synchronously (return after completion)
- Long-running operations (create_employee_work_session) return immediately with ID
- Tools have access to all necessary services

### Tool Logging

- Log all tool invocations with parameters
- Log tool execution results
- Log errors with stack traces

## Test Scenarios

### Scenario 1: Task Management Flow

```
1. edit_tasks: Add "Calculate1+1"
2. create_employee_work_session: Create EmployeeWorkSession for "Calculate1+1"
3. edit_tasks: Update "Calculate1+1" to in_progress
4. (EmployeeWorkSession completes)
5. edit_tasks: Update "Calculate1+1" to completed with result
```

**Verification**:
- All tool calls succeed
- Task status transitions correctly
- EmployeeWorkSession executes successfully

### Scenario 2: Message Exchange

```
1. send_message: Send "Calculate 1+1" to calculator
2. (Calculator processes)
3. send_message: Send "Result is 2" to alice
```

**Verification**:
- Messages delivered correctly
- Message files updated atomically
- Recipients receive messages in order

### Scenario 3: Employee Hiring

```
1. hire_employee: Hire "bob" as "coder"
2. send_message: Send message to "bob"
3. (Bob processes message)
```

**Verification**:
- Employee created successfully
- Employee event loop starts
- Employee can receive messages

### Scenario 4: Error Handling

```
1. edit_tasks: Add task with circular dependency
2. send_message: Send to non-existent employee
3. create_employee_work_session: Create EmployeeWorkSession for non-existent task
4. hire_employee: Hire employee with duplicate name
```

**Verification**:
- All operations fail with clear error messages
- No partial state changes
- System remains consistent

### Scenario 5: Batch Operations

```
1. edit_tasks: [Add Task1, Add Task2, Add Task3 with dependencies]
2. All operations succeed or all fail
```

**Verification**:
- Atomic execution
- Validation before any changes
- Clear error if any operation invalid

## Design Rationale

**Why batch operations for tasks?**
- Reduces tool call overhead
- Ensures atomic updates
- More efficient for complex workflows

**Why separate send_message tool?**
- Clear separation of concerns
- Explicit communication action
- Easier to track message flow

**Why create_employee_work_session instead of direct execution?**
- Leverages OpenCode sessions through EmployeeWorkSession runtime
- Supports parallel execution
- Better resource management

**Why hire_employee tool?**
- Enables dynamic team scaling
- AI can autonomously expand team
- Supports hierarchical management
