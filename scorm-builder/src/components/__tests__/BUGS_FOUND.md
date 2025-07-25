# Bugs Found Through Requirements Testing

## Summary
By writing tests for how the component SHOULD behave (not how it currently behaves), we identified several bugs that impact user experience and accessibility.

## Confirmed Bugs

### 1. ❌ No Inline Validation Errors
**Test**: Should show persistent validation error near the input field
**Expected**: Error message appears near the invalid field and stays visible
**Actual**: No inline error - validation only shows as toast notification
**Impact**: 
- Users might miss the error message
- Poor accessibility for screen reader users
- Violates form validation best practices

### 2. ❌ Poor Accessibility for Form Controls
**Test**: All form inputs should have proper labels
**Expected**: 
- Difficulty buttons have descriptive aria-labels
- Selected state is communicated via aria-pressed
**Actual**: 
- Difficulty buttons only labeled as "Level 5" 
- No indication of selected state for screen readers
**Impact**: Users with disabilities cannot use the form effectively

### 3. ❌ Error Messages Not Properly Announced
**Test**: Error messages should be announced to screen readers
**Expected**: 
- Errors have role="alert"
- Invalid fields have aria-invalid="true"
- Errors linked to fields with aria-describedby
**Actual**: Toast notifications that disappear, no ARIA attributes
**Impact**: Screen reader users won't know about validation errors

### 4. ❌ No Error Recovery Mechanism
**Test**: Should handle save failures gracefully
**Expected**: 
- Clear error message when save fails
- Retry button available
- Form data preserved
**Actual**: Test couldn't complete due to multiple save buttons issue
**Impact**: Users could lose work if save fails

### 5. ❌ Ambiguous Button Feedback
**Test**: Should show clear feedback for all actions
**Expected**: Selected difficulty shows "Selected: Expert" or similar
**Actual**: Only shows "Level 5" with color change
**Impact**: 
- Color-blind users can't see selection
- No confirmation of what was selected

## Additional Issues Found

### UI/UX Problems:
1. **Multiple Save Buttons**: Both "Save" and "Save As..." match the same query
2. **Toast Notifications**: Critical errors shown as temporary toasts
3. **No Loading States**: Can't tell when async operations are happening
4. **Missing Confirmation**: No clear feedback when actions complete

### Code Quality Issues:
1. **Inconsistent Props**: Some handlers return promises, others don't
2. **Missing Error Boundaries**: Component errors could crash the app
3. **No Retry Logic**: Failed operations can't be retried

## How We Found These Bugs

### 1. Write Tests for Requirements
```typescript
it('Should show persistent validation error near the input field', async () => {
  // This test EXPECTS proper inline validation
  // When it fails, we know the implementation is wrong
})
```

### 2. Test Accessibility Requirements
```typescript
it('All form inputs should have proper labels', () => {
  // This ensures the app is usable by everyone
  // Failures indicate accessibility violations
})
```

### 3. Test Error Scenarios
```typescript
it('Should handle save failures gracefully', async () => {
  // Simulate what happens when things go wrong
  // Missing error handling is a bug
})
```

## Next Steps

### Fix These Bugs:
1. Add inline validation with persistent error messages
2. Add proper ARIA attributes for accessibility
3. Implement retry mechanism for failed saves
4. Improve button labels and feedback

### Update Tests After Fixes:
Once bugs are fixed, the requirements tests should pass without modification. This proves we're testing the right behavior.

### Prevent Future Bugs:
1. Always write requirements tests first
2. Don't modify tests to match broken behavior
3. Use accessibility testing tools
4. Test error scenarios

## Conclusion

By writing tests for correct behavior (not current behavior), we found:
- 5 confirmed bugs affecting UX and accessibility
- Multiple code quality issues
- Clear path to fix the problems

This approach ensures we're improving the codebase, not just achieving green tests. The tests document how the app SHOULD work, making bugs obvious when tests fail.