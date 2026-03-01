# Messaging System Requirements

## Design Principles

- **Decentralized Storage**: Each employee stores their own messages locally
- **Centralized Service**: Unified message service handles synchronization
- **Read-Only Client**: Employees can only read messages, cannot write directly

## File Structure

```
/workspace/employees/
  ├── calculator/
  │   └── messages/
  │       ├── alice/
  │       │   └── chat.yaml      # calculator and alice's chat history
  │       └── bob/
  │           └── chat.yaml      # calculator and bob's chat history
  │
  └── alice/
      └── messages/
          └── calculator/
              └── chat.yaml      # alice and calculator's chat history (same conversation)
```

## Message Format (YAML)

```yaml
# calculator/messages/alice/chat.yaml
- timestamp: 2026-03-01T10:00:00Z
  direction: receive
  content: Calculate 1+1

- timestamp: 2026-03-01T10:00:05Z
  direction: send
  content: Result is 2

- timestamp: 2026-03-01T10:01:00Z
  direction: receive
  content: Calculate 5*6

- timestamp: 2026-03-01T10:01:03Z
  direction: send
  content: Result is 30
```

**Field Descriptions**:
- `timestamp`: Message timestamp (ISO 8601 format)
- `direction`: Message direction (`send` or `receive`)
- `content`: Message content

## Message Service API

### Initialize Client

```typescript
const client = new MessageClient("calculator")
```

### API Methods

#### 1. recv() - Receive Message (Blocking)

- **Parameters**: None
- **Returns**: One unread message
- **Behavior**: Blocks until new message arrives
- **Return Format**:
  ```typescript
  {
    from: "alice",
    content: "Calculate 1+1",
    timestamp: "2026-03-01T10:00:00Z"
  }
  ```

#### 2. send(to, content) - Send Message

- **Parameters**:
  - `to`: Recipient name
  - `content`: Message content
- **Behavior**: Centralized service writes to both parties' message files atomically
- **Returns**: After write completes

#### 3. history(peer, limit) - Query History

- **Parameters**:
  - `peer`: Peer name
  - `limit`: Number of messages to return (optional)
- **Returns**: Specified number of historical messages
- **Purpose**: Prevent context explosion

## Message Synchronization Mechanism

1. Sender calls `send()` API
2. Centralized service appends to both parties' message files atomically:
   - Sender's file: `direction: send`
   - Receiver's file: `direction: receive`
3. API returns after write completes
4. Receiver's `recv()` unblocks and returns new message

## Unread Message Management

- Centralized service maintains unread message queue for each employee
- `recv()` call consumes one unread message
- Messages returned in chronological order

## Implementation Requirements

### File Locking

- Must use `proper-lockfile` for all write operations
- Prevents concurrent write conflicts
- Retry mechanism for lock acquisition

### Event Notification

- Use `eventemitter3` for event-driven notification
- Receiver's `recv()` blocks on event emitter
- Sender's `send()` triggers event after write completes

### Error Handling

- Handle file not found (ENOENT) gracefully
- Handle lock timeout errors
- Provide meaningful error messages

## Test Scenarios

### Scenario 1: Simple Message Exchange

```
alice -> calculator: "Calculate 1+1"
calculator -> alice: "Result is 2"
```

**Verification**:
- Both message files contain correct entries
- Timestamps are correct
- Directions are correct (send/receive)

### Scenario 2: Multiple Senders

```
alice -> calculator: "Calculate 1+1"
bob -> calculator: "Calculate 5*6"
calculator -> alice: "Result is 2"
calculator -> bob: "Result is 30"
```

**Verification**:
- Calculator receives messages in order
- Calculator sends replies to correct recipients
- No message loss or corruption

### Scenario 3: Concurrent Sends

```
alice -> calculator: "Calculate 1+1" (concurrent)
bob -> calculator: "Calculate 5*6" (concurrent)
```

**Verification**:
- File locking prevents corruption
- Both messages successfully written
- No data loss

## Design Rationale

**Why file system storage?**
- Simple and intuitive, easy to debug
- Message volume per employee is manageable
- No performance issues with current scale
- No concurrency issues (centralized service ensures consistency)

**Why decentralized storage?**
- Each employee owns their message history
- Easy to backup/restore per employee
- Natural isolation between employees

**Why centralized service?**
- Ensures atomic writes to both parties
- Maintains consistency
- Simplifies synchronization logic
