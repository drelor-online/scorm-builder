# Component Testing Insights - TDD Week 3

## Overview
During Week 3 of our TDD refactoring, we discovered several key insights about testing React components with a behavior-driven approach.

## Key Discoveries

### 1. Context Requirements
Components in this codebase have deep dependencies on context providers:
- `PersistentStorageProvider` - Required for storage operations
- `StepNavigationProvider` - Required for workflow navigation
- Both must be provided in tests or components will throw errors

### 2. UI Structure Patterns
The app uses a consistent structure:
- `PageLayout` wrapper provides header, navigation, and action buttons
- Auto-save indicator is always present and shows real-time status
- Course preview functionality is available on every page
- Progress stepper shows workflow steps

### 3. Form Behavior
CourseSeedInput component behavior:
- Default difficulty is 3 (intermediate) with `btn-primary` class
- Default template is "None" (not "standard" as expected)
- Validation errors appear as toast notifications, not inline
- Save operations trigger auto-save indicator updates

### 4. Testing Anti-Patterns Found
Many existing tests:
- Test implementation details (checking for specific CSS classes)
- Mock too much (losing integration value)
- Don't test from user perspective
- Focus on component internals rather than behavior

## Behavior-Driven Testing Approach

### Good Patterns
```typescript
// Test what users see and do
it('allows teachers to create a course with minimal input', async () => {
  const user = userEvent.setup()
  renderComponent()
  
  // User action
  await user.type(screen.getByPlaceholderText(/enter your course title/i), 'My Course')
  await user.click(screen.getByRole('button', { name: /next/i }))
  
  // Verify outcome
  expect(mockHandlers.onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ courseTitle: 'My Course' })
  )
})
```

### Testing Discoveries
Rather than assuming behavior, write tests that reveal actual behavior:
```typescript
// Discovery: Default template is "None" not "standard"
expect(mockHandlers.onSubmit).toHaveBeenCalledWith({
  template: 'None', // Discovered through test failure
  // ...
})
```

## Component Dependencies Map

### CourseSeedInput
- Contexts: PersistentStorageProvider, StepNavigationProvider
- Services: FileStorage (for saving)
- UI Components: PageLayout, AutoSaveIndicator
- External: Tauri APIs (window title updates)

## Testing Strategy Recommendations

### 1. Start with User Journey Tests
Test complete workflows before testing individual components:
- User creates a new course
- User returns to existing project
- User handles errors

### 2. Use Behavior-Focused Test Names
Bad: "should render difficulty buttons"
Good: "allows teachers to select course difficulty level"

### 3. Test Outcomes, Not Implementation
Bad: Check if useState was called
Good: Check if user sees updated UI after action

### 4. Minimal Mocking
Only mock:
- External services (Tauri, FileStorage)
- Network requests
- Time-dependent operations

### 5. Document Discoveries
When tests fail, document what you learned:
- Actual default values
- Required providers
- UI feedback patterns

## Next Steps

1. Apply these patterns to AIPromptGenerator tests
2. Create behavior tests for JSONImportValidator
3. Test error states and accessibility
4. Create team guidelines based on discoveries

## Test File Organization

```
__tests__/
├── integration/          # End-to-end user journeys
│   ├── userJourney.complete.test.tsx
│   └── fileStorage.integration.test.tsx
├── components/          
│   ├── ComponentName.behavior.test.tsx    # User behavior tests
│   ├── ComponentName.error.test.tsx       # Error handling
│   └── ComponentName.a11y.test.tsx        # Accessibility
└── COMPONENT_TESTING_INSIGHTS.md          # This file
```

## Conclusion

Week 3 revealed that many components are tightly coupled to their context and require careful setup in tests. By focusing on user behavior rather than implementation details, we can create more maintainable and valuable tests that actually catch bugs users would experience.