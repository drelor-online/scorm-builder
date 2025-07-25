# Bug Report - Component Testing Phase

## How to Identify Broken Code vs Test Issues

### 1. Check Against Requirements
Before adjusting a test to pass, ask:
- What is the business requirement?
- What would a user expect to happen?
- Does the current behavior meet accessibility standards?
- Is this good UX?

### 2. Red Flags for Broken Code

#### 🚨 Poor Error Handling
**Bug Found**: Validation errors appear as toast notifications that disappear
- **Problem**: Users might miss critical errors
- **Expected**: Inline, persistent error messages near the invalid field
- **Impact**: Users might think form submitted when it didn't

#### 🚨 Missing Accessibility
**Bug Found**: Form inputs lack proper ARIA attributes
- **Problem**: Screen reader users can't understand form state
- **Expected**: 
  - `aria-invalid="true"` on invalid fields
  - `aria-describedby` linking to error messages
  - `role="alert"` on error messages
- **Impact**: App is not accessible to users with disabilities

#### 🚨 Data Loss Risks
**Bug Found**: No retry mechanism for failed saves
- **Problem**: Network errors could lose user data
- **Expected**: Retry button, offline queue, or persistent draft
- **Impact**: Users lose work

#### 🚨 Unclear State
**Bug Found**: Difficulty selection only shown by color
- **Problem**: Color-blind users can't see selection
- **Expected**: Text indication, aria-pressed, or check mark
- **Impact**: Users unsure of their selection

## Testing Strategy to Find Real Bugs

### 1. Write "Should" Tests First
```typescript
describe('REQUIREMENT: Course must have a title', () => {
  it('Should prevent form submission without required fields', async () => {
    // This describes what SHOULD happen
    // If it fails, either:
    // 1. The code is broken (fix the code)
    // 2. The requirement changed (update test & code)
  })
})
```

### 2. Test User Journeys
```typescript
it('Should allow users to recover from errors', async () => {
  // Simulate network failure
  mockSave.mockRejectedOnce(new Error('Network error'))
  
  // User tries to save
  await user.click(saveButton)
  
  // MUST show error
  expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
  
  // MUST retain form data
  expect(titleInput).toHaveValue('My Course')
  
  // MUST offer retry
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
})
```

### 3. Test Edge Cases
```typescript
it('Should handle rapid clicks on save button', async () => {
  // Users often click multiple times
  await user.tripleClick(saveButton)
  
  // Should only save once
  expect(mockSave).toHaveBeenCalledTimes(1)
})
```

### 4. Test Accessibility
```typescript
it('Should announce errors to screen readers', async () => {
  // Submit invalid form
  await user.click(submitButton)
  
  // Error must be announced
  const error = await screen.findByRole('alert')
  expect(error).toHaveTextContent(/required/i)
})
```

## Current Bugs Found

### 1. Validation UX Issues
- ❌ Errors disappear too quickly (toast)
- ❌ No inline validation
- ❌ No aria-invalid attributes
- ❌ Can't retry after validation error

### 2. Accessibility Violations  
- ❌ Difficulty buttons lack proper labels
- ❌ No aria-pressed states
- ❌ Errors not announced to screen readers
- ❌ Form state changes not communicated

### 3. Data Safety Concerns
- ❌ No retry for failed saves
- ❌ No indication of unsaved changes
- ❌ Auto-save failures not clearly shown
- ❌ No offline support

### 4. User Feedback Problems
- ❌ Template selection feedback unclear
- ❌ Save success only shown briefly
- ❌ No loading states during async operations
- ❌ Can't tell if form is submitting

## Recommendations

### Immediate Fixes Needed:
1. Add inline validation with persistent errors
2. Add proper ARIA attributes for accessibility
3. Implement retry mechanism for failed operations
4. Add clear visual and textual feedback for all interactions

### Testing Approach:
1. Write tests for how it SHOULD work
2. Document when tests fail due to bugs
3. Fix the code, not the tests
4. Only adjust tests if requirements actually changed

### Questions for Product Team:
1. Should validation be on blur or on submit?
2. How long should success messages display?
3. What happens if save fails repeatedly?
4. Should templates auto-populate or just suggest topics?

## Conclusion

Don't make tests pass by matching broken behavior. Instead:
1. Write tests for correct behavior
2. Document the bugs found
3. Fix the implementation
4. Tests then pass naturally

This approach ensures we're improving the codebase, not just achieving green tests.