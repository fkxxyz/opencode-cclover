# Testing Strategy

## Overview

This document describes the comprehensive testing approach for the Console frontend, covering unit tests, integration tests, and end-to-end tests.

## Architecture Reference

Implements testing strategy for the Console frontend described in [Architecture](./architecture.md).

## Unit Tests

Test custom hooks in isolation using `@testing-library/react-hooks`:

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useEmployees } from './useEmployees'

test('useEmployees fetches and returns employees', async () => {
  const { result } = renderHook(() => useEmployees())
  
  await waitFor(() => expect(result.current.loading).toBe(false))
  
  expect(result.current.employees).toHaveLength(2)
  expect(result.current.error).toBeNull()
})
```

Test API client methods:

```typescript
import { ApiClient } from './services/api'

test('ApiClient.getEmployees returns employee list', async () => {
  const client = new ApiClient()
  client.setProject('project-123')
  
  const employees = await client.getEmployees()
  
  expect(employees).toHaveLength(2)
  expect(employees[0].name).toBe('calculator')
})
```

Test WebSocket client event handling:

```typescript
import { WebSocketClient } from './services/websocket'

test('WebSocketClient filters events by projectId', () => {
  const client = new WebSocketClient()
  client.setProject('project-123')
  
  const handler = jest.fn()
  client.on('employee_status_changed', handler)
  
  // Simulate event with matching projectId
  client.handleEvent({ projectId: 'project-123', type: 'employee_status_changed', ... })
  expect(handler).toHaveBeenCalledTimes(1)
  
  // Simulate event with different projectId
  client.handleEvent({ projectId: 'project-456', type: 'employee_status_changed', ... })
  expect(handler).toHaveBeenCalledTimes(1) // Not called again
})
```

## Integration Tests

Test component + hook integration:

```typescript
import { render, screen, waitFor } from '@testing-library/react'
import { EmployeeList } from './components/EmployeeList'

test('EmployeeList displays employees from API', async () => {
  render(<EmployeeList />)
  
  expect(screen.getByText('Loading...')).toBeInTheDocument()
  
  await waitFor(() => {
    expect(screen.getByText('calculator')).toBeInTheDocument()
    expect(screen.getByText('coder')).toBeInTheDocument()
  })
})
```

Test real-time update flows:

```typescript
test('EmployeeList updates when employee status changes', async () => {
  const { rerender } = render(<EmployeeList />)
  
  await waitFor(() => {
    expect(screen.getByText('calculator')).toBeInTheDocument()
  })
  
  // Simulate WebSocket event
  wsClient.handleEvent({
    projectId: 'project-123',
    type: 'employee_status_changed',
    employeeName: 'calculator',
    details: { status: 'active' }
  })
  
  await waitFor(() => {
    expect(screen.getByText('active')).toBeInTheDocument()
  })
})
```

Test error handling paths:

```typescript
test('EmployeeList displays error when API fails', async () => {
  // Mock API to throw error
  jest.spyOn(apiClient, 'getEmployees').mockRejectedValue(new Error('API error'))
  
  render(<EmployeeList />)
  
  await waitFor(() => {
    expect(screen.getByText('Error: API error')).toBeInTheDocument()
  })
})
```

## E2E Tests

Test complete user workflows using Playwright or Cypress:

```typescript
test('User can view employee details', async () => {
  await page.goto('http://localhost:5173')
  
  // Wait for employee list to load
  await page.waitForSelector('[data-testid="employee-card"]')
  
  // Click on first employee
  await page.click('[data-testid="employee-card"]:first-child')
  
  // Verify detail page loaded
  await page.waitForSelector('[data-testid="employee-detail"]')
  expect(await page.textContent('h1')).toBe('calculator')
  
  // Verify tabs are present
  expect(await page.isVisible('[data-testid="messages-tab"]')).toBe(true)
  expect(await page.isVisible('[data-testid="tasks-tab"]')).toBe(true)
})
```

Test WebSocket reconnection:

```typescript
test('App reconnects when WebSocket disconnects', async () => {
  await page.goto('http://localhost:5173')
  
  // Wait for connection
  await page.waitForSelector('[data-testid="connected-indicator"]')
  
  // Simulate server disconnect
  await page.evaluate(() => {
    window.wsClient.ws.close()
  })
  
  // Verify reconnection indicator
  await page.waitForSelector('[data-testid="reconnecting-indicator"]')
  
  // Wait for reconnection
  await page.waitForSelector('[data-testid="connected-indicator"]', { timeout: 10000 })
})
```

Test project switching:

```typescript
test('User can switch between projects', async () => {
  await page.goto('http://localhost:5173')
  
  // Select project dropdown
  await page.click('[data-testid="project-selector"]')
  
  // Click second project
  await page.click('[data-testid="project-option"]:nth-child(2)')
  
  // Verify employee list updated
  await page.waitForSelector('[data-testid="employee-card"]')
  const employees = await page.$$('[data-testid="employee-card"]')
  expect(employees.length).toBeGreaterThan(0)
})
```

---

**Version**: 1.0  
**Last Updated**: 2026-03-02  
**Status**: Living Document
