# Test Workaround Analysis and Fixes

## Overview
This document identifies specific areas where tests were modified to "work around" implementation issues rather than driving the implementation through proper TDD.

## Identified Test Workarounds

### 1. Mock-Heavy Tests
**Problem**: Tests that mock internal components instead of testing integrated behavior

**Example**: In `App.intent.test.tsx`
```typescript
// Current (Workaround):
vi.mock('../components/MediaEnhancementWizardRefactored', () => ({
  MediaEnhancementWizard: () => <div>Media Enhancement Wizard</div>
}))
```

**Fix**: Test the actual component integration
```typescript
// Proper TDD:
// Don't mock internal components
// Test the full user experience including lazy loading
it('should load media enhancement wizard when user reaches that step', async () => {
  // Setup user to reach media step
  // Verify actual media UI appears, not a mock
})
```

### 2. Implementation-Focused Storage Tests
**Problem**: Tests checking localStorage calls instead of user outcomes

**Example**: In `ProjectStorage.intent.test.ts`
```typescript
// Current (Workaround):
expect(localStorageMock.setItem).toHaveBeenCalledWith(
  expect.stringMatching(/^scorm_project_/),
  expect.any(String)
)
```

**Fix**: Test what the user experiences
```typescript
// Proper TDD:
it('should allow user to close and reopen their project with all data intact', async () => {
  // Save project
  // Simulate browser close/open
  // Verify user sees their exact data
})
```

### 3. Async Timing Workarounds
**Problem**: Tests using fake timers to control async behavior

**Example**: In `useAutoSave.intent.test.ts`
```typescript
// Current (Workaround):
vi.useFakeTimers()
act(() => {
  vi.advanceTimersByTime(1000)
})
```

**Fix**: Test real user experience with actual delays
```typescript
// Proper TDD:
it('should save automatically while user is typing', async () => {
  // Type content
  // Wait for actual auto-save delay
  // Verify save indicator appears
  // Verify data persists on reload
})
```

### 4. State Verification Anti-Pattern
**Problem**: Tests checking component state instead of user-visible outcomes

**Example**: Found in various component tests
```typescript
// Current (Workaround):
expect(component.state.currentStep).toBe(2)
```

**Fix**: Verify what the user sees
```typescript
// Proper TDD:
expect(screen.getByText('Step 2 of 7: AI Prompt Generator')).toBeInTheDocument()
expect(screen.getByRole('button', { name: /back to course setup/i })).toBeEnabled()
```

### 5. Missing Error Scenario Tests
**Problem**: Happy path tests without real error handling

**Fix**: Add comprehensive error scenarios
```typescript
describe('When things go wrong', () => {
  it('should help user recover when media fails to load')
  it('should preserve work when network disconnects')
  it('should guide user when SCORM generation fails')
  it('should handle corrupted project data gracefully')
})
```

## Specific Files Needing Refactoring

### High Priority (Most Workarounds)
1. **MediaEnhancementWizardRefactored.test.tsx**
   - Uses window.confirm mocking
   - Tests implementation details of media state
   - Should test complete user media workflow

2. **ProjectStorage.intent.test.ts**
   - Mocks localStorage heavily
   - Should use actual storage in integration tests
   - Missing real-world scenarios

3. **App.intent.test.tsx**
   - Mocks too many child components
   - Should test integrated behavior
   - Missing complete workflow tests

### Medium Priority
1. **AudioNarrationWizardRefactored.*.test.tsx**
   - Split into too many small test files
   - Should have comprehensive user journey tests
   - Focus on audio workflow, not implementation

2. **JSONImportValidatorRefactored.test.tsx**
   - Tests parsing logic instead of user experience
   - Should test import scenarios from user perspective

3. **ActivitiesEditorRefactored.test.tsx**
   - Limited coverage of question creation flows
   - Should test complete assessment building

### Low Priority (Mostly Good)
1. **CourseSeedInputRefactored.intent.test.tsx**
   - Generally follows good patterns
   - Could add more edge cases

2. **useAutoSave.intent.test.ts**
   - Good intent-based structure
   - Could remove timer mocking

## Recommended Refactoring Approach

### Phase 1: Stop the Bleeding
1. Add new tests following proper TDD for any new features
2. Don't modify existing tests to work around new bugs
3. Create integration tests for critical paths

### Phase 2: Gradual Migration
1. When fixing bugs, rewrite related tests properly
2. Replace mock-heavy tests with integration tests
3. Add missing error scenarios

### Phase 3: Comprehensive Refactor
1. Dedicate sprints to test refactoring
2. Pair program to ensure consistent approach
3. Document patterns for future tests

## Testing Principles to Enforce

### 1. The User Can't See Your Code
If a test is checking something the user can't see or experience, it's wrong.

### 2. Test Behavior, Not Implementation
```typescript
// ❌ Wrong: Implementation detail
expect(setState).toHaveBeenCalledWith({ loading: true })

// ✅ Right: User experience
expect(screen.getByText('Loading your media...')).toBeInTheDocument()
```

### 3. Real Integration Over Mocks
```typescript
// ❌ Wrong: Mocking everything
vi.mock('./every/internal/component')

// ✅ Right: Real integration
// Only mock external services (APIs, file system)
```

### 4. Test the Unhappy Path
For every happy path test, add:
- Network failure scenario
- Invalid data scenario
- User mistake scenario
- Recovery scenario

## Success Metrics

Track these metrics to measure improvement:
1. **Test Stability**: Reduce flaky tests to 0%
2. **Mock Reduction**: Decrease internal mocks by 80%
3. **Scenario Coverage**: Cover 100% of user journeys
4. **Maintenance Time**: Reduce test fix time by 50%

## Conclusion

The current test suite has drifted from TDD principles due to:
- Pressure to make tests pass quickly
- Lack of clear testing guidelines
- Over-reliance on mocking
- Focus on code coverage over behavior coverage

By following this plan and refactoring systematically, we can return to tests that:
- Drive development through user needs
- Serve as living documentation
- Catch real bugs, not implementation changes
- Build confidence in the system