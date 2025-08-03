# SCORM Builder Testing Documentation

## Overview

This project follows an **intent-based testing** approach that focuses on user actions and goals rather than implementation details. Our tests describe what users want to achieve, making them more resilient to refactoring and easier to understand.

The project has achieved **87.5% test coverage** through extensive unit and integration testing.

## Testing Stack

- **Test Framework**: Vitest 3.2.4
- **Test Environment**: jsdom
- **Testing Libraries**: 
  - React Testing Library 16.3.0
  - @testing-library/user-event 14.6.1
  - @testing-library/jest-dom 6.6.3
- **Coverage Tool**: @vitest/coverage-v8
- **E2E Testing**: Playwright & Cucumber
- **TDD Enforcement**: tdd-guard (pre-commit hook)

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

### Basic Commands

```bash
# Run all tests
npm test

# Run tests with UI (interactive mode)
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Check coverage against thresholds
npm run coverage:check

# Generate detailed coverage report
npm run coverage:report

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test ComponentName.intent.test.tsx
```

### E2E and BDD Tests

```bash
# Run Playwright E2E tests
npm run test:e2e
npm run test:e2e:ui      # With UI
npm run test:e2e:headed  # With browser

# Run Cucumber BDD tests
npm run test:bdd
npm run test:bdd:stable  # Only stable tests
npm run test:bdd:debug   # Debug mode
npm run test:bdd:headed  # With browser
```

## Test Coverage Summary

### Overall Coverage: 87.5%
- **Total Files**: 128
- **Tested Files**: 112
- **Untested Files**: 16

### Coverage by Category

| Category | Total | Tested | Coverage |
|----------|-------|--------|----------|
| Components | 56 | 56 | 100% |
| Services | 21 | 21 | 100% |
| Hooks | 14 | 14 | 100% |
| Contexts | 4 | 4 | 100% |
| Constants | 4 | 4 | 100% |
| Config | 2 | 2 | 100% |
| Utils | 13 | 7 | 53.8% |
| Types | 6 | 0 | 0% |

### Untested Files
The following files are excluded from testing for valid reasons:

1. **Entry Points** (Not testable):
   - `main.tsx` - Application entry point
   - `test-main.tsx` - Test environment entry

2. **Type Definitions** (Pure TypeScript interfaces):
   - `types/*.ts` - All type definition files

3. **Test Utilities** (Test infrastructure):
   - `mocks/mockTauriAPI.ts` - Test mock
   - `utils/*Tests.ts` - Test utilities

4. **Style Files**:
   - `styles/buttonStyles.ts` - Pure style constants

## Test Coverage Goals

- Minimum coverage: **80%** for all metrics (Currently exceeding at 87.5%)
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

## Mocking Strategies

### 1. Tauri API Mocking
```typescript
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue('mocked response')
}))
```

### 2. File System Mocking
```typescript
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn().mockResolvedValue('file content'),
  writeTextFile: vi.fn().mockResolvedValue(undefined)
}))
```

### 3. Component Mocking
```typescript
vi.mock('../ComplexComponent', () => ({
  ComplexComponent: () => <div data-testid="mock-complex">Mock</div>
}))
```

## Continuous Integration

### Pre-commit Hooks
The project uses Husky to run tests before commits:
- Linting with ESLint
- Type checking with TypeScript
- Test execution for changed files
- TDD enforcement via tdd-guard

### GitHub Actions
Coverage reports are generated and tracked in CI:
- Coverage threshold checks
- HTML coverage reports
- Coverage trend analysis

## Tips for Maintaining High Coverage

1. **Write Tests First**: Follow TDD principles strictly
2. **Test Edge Cases**: Don't just test the happy path
3. **Mock External Dependencies**: Keep tests isolated and fast
4. **Use Coverage Reports**: Identify untested code paths
5. **Refactor with Confidence**: Good tests enable safe refactoring

## Contributing

When adding new features:

1. Write failing tests first (TDD) - **Required by tdd-guard**
2. Implement the feature
3. Ensure tests pass
4. Check coverage hasn't decreased
5. Update this documentation if needed

Remember: **Tests are documentation**. They should clearly communicate what the application does from the user's perspective.

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [TDD Guide](https://martinfowler.com/bliki/TestDrivenDevelopment.html)