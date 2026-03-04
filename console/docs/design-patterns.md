# Integration Patterns and Optimization

## Overview

This document describes common patterns for API integration, error handling, and performance optimization used throughout the Console frontend.

## Architecture Reference

Implements integration patterns described in [Architecture](./architecture.md).

## API Integration Patterns

### Pattern 1: Initial Load + Real-time Updates

Used by: `useEmployees`, `useMessages`, `useTasks`, `useEvents`

```typescript
export function useDataWithRealtime() {
  const [data, setData] = useState([])
  const { subscribe } = useWebSocket()

  // Initial load
  useEffect(() => {
    apiClient.getData().then(setData)
  }, [])

  // Real-time updates
  useEffect(() => {
    const unsubscribe = subscribe("data_updated", (event) => {
      setData((prev) => updateData(prev, event))
    })
    return unsubscribe
  }, [subscribe])

  return { data }
}
```

**Rationale**:

- Initial load provides complete dataset
- WebSocket updates keep data fresh
- Avoids polling overhead
- Optimistic updates for instant UI feedback

### Pattern 2: Polling for Statistics

Used by: `useStats`

```typescript
export function useStats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const fetchStats = () => apiClient.getStats().then(setStats)
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  return { stats }
}
```

**Rationale**:

- Statistics are computed on-demand (not stored)
- Polling is simpler than event-based updates
- 5-second interval balances freshness and load

### Pattern 3: On-demand Fetching

Used by: Employee detail page, message filtering

```typescript
export function useEmployeeDetail(name: string) {
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    apiClient.getEmployeeDetail(name).then(setDetail)
  }, [name])

  return { detail }
}
```

**Rationale**:

- Data is fetched only when needed
- Refetches when parameter changes
- No caching (data may be stale)

## Error Handling

### API Errors

All API errors are caught and exposed through hook return values:

```typescript
const { data, loading, error } = useEmployees()

if (error) {
  return <ErrorDisplay error={error} />
}
```

**Error Display**:

- Show user-friendly error message
- Provide retry button
- Log error to console for debugging

### WebSocket Errors

WebSocket connection errors trigger automatic reconnection with exponential backoff. Connection status is exposed through `useWebSocket`:

```typescript
const { isConnected } = useWebSocket()

if (!isConnected) {
  return <ConnectionWarning />
}
```

**Connection Warning**:

- Show "Reconnecting..." message
- Display reconnection attempt count
- Provide manual reconnect button

### Component Error Boundaries

React Error Boundaries catch rendering errors and display fallback UI:

```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <MyComponent />
</ErrorBoundary>
```

**Error Fallback**:

- Show error message
- Provide "Reset" button to remount component
- Log error to error tracking service (future)

## Performance Optimization

### Memoization

Use `React.memo` for expensive components:

```typescript
export const EmployeeCard = React.memo(({ employee }) => {
  // ...
})
```

**When to use**:

- Component renders frequen
- Props rarely change
- Rendering is expensive (complex calculations, large lists)

### Lazy Loading

Code-split routes with `React.lazy`:

```typescript
const Overview = React.lazy(() => import("./pages/Overview"))
const EmployeeDetail = React.lazy(() => import("./pages/EmployeeDetail"))
```

**Benefits**:

- Smaller initial bundle size
- Faster initial page load
- Routes loaded on-demand

### Virtual Scrolling

For long lists (messages, events), use virtual scrolling:

```typescript
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
 mCount={messages.length}
  itemSize={80}
>
  {({ index, style }) => (
    <MessageItem message={messages[index]} style={style} />
  )}
</FixedSizeList>
```

**Benefits**:

- Only renders visible items
- Constant memory usage
- Smooth scrolling for 1000+ items

### Debouncing

Debounce search and filter inputs:

```typescript
import { useDebouncedValue } from "./hooks/useDebouncedValue"

const [search, setSearch] = useState("")
const debouncedSearch = useDebouncedValue(search, 300)

useEffect(() => {
  // Fetch with debouncedSearch
}, [debouncedSearch])
```

**Benefits**:

- Reduces API calls
- Improves input responsiveness
- Prevents excessive re-renders

### WebSocket Event Batching

Batch rapid WebSocket events to reduce re-renders:

```typescript
const [pendingEvents, setPendingEvents] = useState([])

useEffect(() => {
  const unsubscribe = subscribe("event", (event) => {
    setPendingEvents((prev) => [...prev, event])
  })
  return unsubscribe
}, [subscribe])

useEffect(() => {
  if (pendingEvents.length === 0) return

  const timer = setTimeout(() => {
    setData((prev) => applyEvents(prev, pendingEvents))
    setPendingEvents([])
  }, 100)

  return () => clearTimeout(timer)
}, [pendingEvents])
```

**Benefits**:

- Reduces re-render frequency
- Batches multiple updates into one
- Improves UI responsiveness during event storms

---

**Version**: 1.0  
**Last Updated**: 2026-03-02  
**Status**: Living Document
