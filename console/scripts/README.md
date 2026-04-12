# Console Scripts

## Event Type Verification Test

### Purpose

Ensures that the frontend completely handles all event types defined in the backend.

### What It Checks

1. **Type Definition Coverage**: Frontend `EventType` includes all backend event types
2. **Event Handler Coverage**: `EventItem.tsx` provides description logic for all event types
3. **Icon Mapping Coverage**: All event types have icon mappings (warning only)

### Usage

```bash
# From console directory
bun test scripts/verify-event-types.test.ts

# Or run all tests
bun test

# Or use the npm script
bun run test:events
```

### Output

The test will:
- ✅ Pass if frontend completely handles all backend events
- ❌ Fail if any event types are missing or unhandled
- ⚠️  Warn if icon mappings are missing (non-blocking)

### Example Output

```
bun test v1.3.11 (af24e281)

 6 pass
 0 fail
 11 expect() calls
Ran 6 tests across 1 file. [15.00ms]
```

If there are errors, the test framework will show detailed failure messages.

### When to Run

- Before committing frontend changes
- After adding new event types to backend
- When debugging event display issues
- As part of CI/CD pipeline (recommended)

### Integration with Development Workflow

Add to your pre-commit checks:

```bash
# In console directory
bun test && bun run build
```

### Troubleshooting

**Missing Event Types**:
1. Check backend `src/types/index.ts` for the canonical event type list
2. Add missing types to frontend `console/src/types/index.ts`
3. Add handler logic to `console/src/components/employee/EventItem.tsx`
4. Add icon mapping to `EVENT_ICONS` in `EventItem.tsx`

**Extra ypes**:
- Frontend has types not in backend
- Usually indicates deprecated types that should be removed
- Or backend types that were removed but frontend wasn't updated
