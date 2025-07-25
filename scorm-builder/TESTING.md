# Testing Guidelines for SCORM Builder

## Overview

This project follows an **intent-based testing** approach that focuses on user actions and goals rather than implementation details. Our tests describe what users want to achieve, making them more resilient to refactoring and easier to understand.

## Core Testing Principles

### 1. Test User Intent, Not Implementation

❌ **Bad Example:**
```typescript
it('should call setState with new value', () => {
  // Tests internal implementation
})
```

✅ **Good Example:**
```typescript
it('should allow user to change course title', () => {
  // Tests what the user wants to do
})
```

### 2. Use Descriptive Test Names

Tests should read like user stories:
- `User wants to...`
- `User expects...`
- `User should be able to...`

### 3. Test Structure

```typescript
describe('ComponentName - User Intent Tests', () => {
  describe('User wants to [action/goal]', () => {
    it('should [expected behavior]', () => {
      // Arrange
      // Act  
      // Assert
    })
  })
})
```

## Writing Intent-Based Tests

### Component Tests

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('CourseSeedInput - User Intent Tests', () => {
  describe('User wants to create a new course', () => {
    it('should show required field indicators', () => {
      render(<CourseSeedInput />)
      
      // User should see which fields are required
      expect(screen.getByText('*')).toBeInTheDocument()
      expect(screen.getByText(/required/i)).toBeInTheDocument()
    })

    it('should validate before allowing progression', async () => {
      const user = userEvent.setup()
      render(<CourseSeedInput />)
      
      // User tries to continue without filling required fields
      const continueButton = screen.getByRole('button', { name: /continue/i })
      await user.click(continueButton)
      
      // User should see validation message
      expect(screen.getByText(/course title is required/i)).toBeInTheDocument()
    })
  })
})
```

### Service Tests

```typescript
describe('ProjectStorage - User Intent Tests', () => {
  describe('User wants to save their project', () => {
    it('should save project and return success', async () => {
      const storage = new ProjectStorage()
      const projectData = { 
        courseTitle: 'My Course',
        // ... other data
      }
      
      const result = await storage.saveProject(projectData)
      
      expect(result.success).toBe(true)
      expect(result.message).toContain('saved successfully')
    })
  })
})
```

### Hook Tests

```typescript
describe('useAutoSave - User Intent Tests', () => {
  describe('User wants automatic saving', () => {
    it('should save after specified delay', async () => {
      const mockSave = vi.fn()
      const { result } = renderHook(() => 
        useAutoSave({ data, onSave: mockSave, delay: 1000 })
      )
      
      // Make changes
      act(() => {
        // Update data
      })
      
      // Fast forward time
      vi.advanceTimersByTime(1000)
      
      // Should trigger save
      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled()
      })
    })
  })
})
```

## Common Testing Patterns

### 1. Form Interactions

```typescript
describe('User wants to fill out a form', () => {
  it('should accept user input', async () => {
    const user = userEvent.setup()
    render(<MyForm />)
    
    const input = screen.getByLabelText(/course title/i)
    await user.type(input, 'JavaScript Basics')
    
    expect(input).toHaveValue('JavaScript Basics')
  })
})
```

### 2. Navigation

```typescript
describe('User wants to navigate between steps', () => {
  it('should go to next step when clicking next', async () => {
    const user = userEvent.setup()
    const mockOnNext = vi.fn()
    
    render(<StepComponent onNext={mockOnNext} />)
    
    const nextButton = screen.getByRole('button', { name: /next/i })
    await user.click(nextButton)
    
    expect(mockOnNext).toHaveBeenCalled()
  })
})
```

### 3. Loading States

```typescript
describe('User wants to see loading feedback', () => {
  it('should show loading indicator while saving', async () => {
    const user = userEvent.setup()
    render(<SaveableComponent />)
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)
    
    expect(screen.getByText(/saving/i)).toBeInTheDocument()
  })
})
```

### 4. Error Handling

```typescript
describe('User wants clear error messages', () => {
  it('should show error when save fails', async () => {
    const mockSave = vi.fn().mockRejectedValue(new Error('Network error'))
    render(<Component onSave={mockSave} />)
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
    })
  })
})
```

## Test Organization

```
src/
├── components/
│   ├── __tests__/
│   │   ├── ComponentName.intent.test.tsx
│   │   └── AnotherComponent.intent.test.tsx
│   └── ComponentName.tsx
├── services/
│   ├── __tests__/
│   │   └── ServiceName.intent.test.ts
│   └── ServiceName.ts
├── hooks/
│   ├── __tests__/
│   │   └── useHookName.intent.test.ts
│   └── useHookName.ts
└── tests/
    └── integration/
        └── workflow.integration.test.tsx
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test ComponentName.intent.test.tsx

# Run integration tests
npm run test:integration
```

## Test Coverage Goals

- Minimum coverage: **80%** for all metrics
- Focus on critical user paths
- Don't test implementation details
- Prioritize integration tests for complex workflows

## Best Practices

### DO:
- ✅ Test from the user's perspective
- ✅ Use semantic queries (getByRole, getByLabelText)
- ✅ Test happy paths and error cases
- ✅ Mock external dependencies
- ✅ Keep tests focused and isolated
- ✅ Use descriptive test names

### DON'T:
- ❌ Test implementation details
- ❌ Use snapshot tests for dynamic content
- ❌ Test third-party libraries
- ❌ Write brittle selectors
- ❌ Ignore accessibility in tests
- ❌ Skip error scenarios

## Accessibility Testing

Always consider accessibility in your tests:

```typescript
it('should be keyboard navigable', async () => {
  const user = userEvent.setup()
  render(<Navigation />)
  
  await user.tab()
  expect(screen.getByRole('link', { name: /home/i })).toHaveFocus()
  
  await user.keyboard('{Enter}')
  // Verify navigation occurred
})

it('should have proper ARIA labels', () => {
  render(<FormComponent />)
  
  const submitButton = screen.getByRole('button', { name: /submit form/i })
  expect(submitButton).toHaveAttribute('aria-label')
})
```

## Integration Testing

For complex workflows, write integration tests:

```typescript
describe('Full Course Creation Workflow', () => {
  it('should allow user to create course from start to finish', async () => {
    const user = userEvent.setup()
    render(<App />)
    
    // Step 1: Enter course details
    const titleInput = screen.getByLabelText(/course title/i)
    await user.type(titleInput, 'My Course')
    
    // Step 2: Continue through wizard
    const continueButton = screen.getByRole('button', { name: /continue/i })
    await user.click(continueButton)
    
    // ... continue through all steps
    
    // Verify final result
    expect(screen.getByText(/course created successfully/i)).toBeInTheDocument()
  })
})
```

## Debugging Tests

When tests fail:

1. Check the error message carefully
2. Use `screen.debug()` to see the current DOM
3. Use `screen.logTestingPlaygroundURL()` for Testing Library playground
4. Check if the element is actually in the document
5. Verify your queries are correct
6. Ensure async operations are properly awaited

```typescript
// Debugging example
it('should show element', async () => {
  render(<Component />)
  
  // Debug the current DOM
  screen.debug()
  
  // Get playground URL
  screen.logTestingPlaygroundURL()
  
  // Use more specific queries if needed
  const element = screen.getByRole('button', { name: /specific text/i })
})
```

## Contributing

When adding new features:

1. Write failing tests first (TDD)
2. Implement the feature
3. Ensure tests pass
4. Check coverage hasn't decreased
5. Update this documentation if needed

Remember: **Tests are documentation**. They should clearly communicate what the application does from the user's perspective.