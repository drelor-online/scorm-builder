# Comprehensive TDD Refactoring Plan for SCORM Builder

## Executive Summary

This plan outlines a systematic approach to refactor the SCORM Builder test suite to follow proper Test-Driven Development (TDD) principles, where tests define expected behavior from the user's perspective rather than verifying implementation details.

## Current State Analysis

### Strengths
- Intent-based test files exist (*.intent.test.tsx)
- User-focused test descriptions
- Good test organization with describe blocks
- Proper mocking patterns for dependencies

### Issues Requiring Attention
1. **Mixed Testing Approaches**: Some tests focus on implementation details rather than user behavior
2. **Coverage Gaps**: Missing tests for complete user workflows
3. **Test Maintenance**: Tests modified to "work around" implementation changes
4. **Integration Testing**: Insufficient real-world scenario coverage

## Priority Order for Test Refactoring

### Priority 1: Critical User Journey Tests (Week 1)

#### 1.1 End-to-End Workflow Test Suite
Create `src/__tests__/integration/completeUserJourney.test.tsx`

**User Stories to Test:**
- As a trainer, I want to create a complete course from scratch to SCORM export
- As a trainer, I want to save my progress and continue later
- As a trainer, I want to reopen and edit existing courses
- As a trainer, I want to handle interruptions gracefully (browser refresh, network issues)

**Key Test Scenarios:**
```typescript
describe('Complete User Journey', () => {
  describe('User creates a new safety training course', () => {
    it('should guide user through all steps from setup to export')
    it('should preserve all data when navigating between steps')
    it('should generate valid SCORM package at the end')
  })

  describe('User resumes work on existing course', () => {
    it('should restore exact state when reopening project')
    it('should handle version migrations transparently')
    it('should show progress indicators correctly')
  })
})
```

#### 1.2 App Component Comprehensive Tests
Refactor `src/__tests__/App.intent.test.tsx`

**Focus Areas:**
- Navigation between steps with data validation
- Auto-save functionality during real user interactions
- Error recovery scenarios
- Keyboard shortcuts in context
- Project management (save, open, delete)

### Priority 2: Storage and Persistence Tests (Week 1-2)

#### 2.1 PersistentStorage Integration Tests
Create `src/services/__tests__/PersistentStorage.realworld.test.ts`

**Real-World Scenarios:**
- Large course with 50+ topics
- Media-heavy courses (100+ images)
- Concurrent editing in multiple tabs
- Storage quota exceeded scenarios
- Corrupted data recovery

#### 2.2 Project Migration Tests
Create `src/services/__tests__/projectMigration.test.ts`

**Test Cases:**
- Old format to new format migration
- Missing fields handling
- Data validation and sanitization
- Backwards compatibility

### Priority 3: Component Behavior Tests (Week 2-3)

#### 3.1 Course Setup Component
Refactor `CourseSeedInputRefactored.intent.test.tsx`

**User Scenarios:**
- First-time user setting up a course
- User using templates effectively
- User modifying existing course setup
- Validation and error guidance

#### 3.2 Media Enhancement Wizard
Refactor `MediaEnhancementWizardRefactored.test.tsx`

**User Scenarios:**
- Adding media to topics
- Searching and selecting appropriate media
- Handling media loading failures
- Bulk media operations

#### 3.3 Activities Editor
Create comprehensive tests for `ActivitiesEditorRefactored`

**User Scenarios:**
- Creating various question types
- Setting up assessments with passing criteria
- Previewing assessment flow
- Importing/exporting questions

### Priority 4: SCORM Generation Tests (Week 3)

#### 4.1 SCORM Output Validation
Create `src/services/__tests__/scormGeneration.validation.test.ts`

**Validation Tests:**
- SCORM 1.2 compliance
- Manifest structure correctness
- Navigation flow accuracy
- Score tracking functionality
- Bookmark/resume capability

#### 4.2 Content Rendering Tests
- HTML structure validation
- Media embedding verification
- Responsive design testing
- Accessibility compliance

### Priority 5: Supporting Features (Week 4)

#### 5.1 Auto-Save Behavior
Enhance `useAutoSave.intent.test.ts`

**Real Scenarios:**
- Typing continuously in text fields
- Rapid navigation between pages
- Network interruption recovery
- Conflict resolution

#### 5.2 Search and Filter Operations
- Media library search
- Project search functionality
- Content filtering

## Implementation Strategy

### Phase 1: Test Infrastructure (Days 1-2)
1. Set up test utilities for common user interactions
2. Create test data factories for realistic scenarios
3. Implement custom matchers for SCORM validation
4. Set up visual regression testing framework

### Phase 2: Critical Path Tests (Days 3-7)
1. Implement end-to-end journey tests
2. Refactor App.intent.test.tsx with comprehensive scenarios
3. Create PersistentStorage real-world tests
4. Add project migration tests

### Phase 3: Component Refactoring (Days 8-14)
1. Refactor existing component tests to focus on behavior
2. Add missing component tests
3. Remove implementation-focused tests
4. Ensure all user interactions are covered

### Phase 4: SCORM and Integration (Days 15-21)
1. Implement SCORM validation suite
2. Add content rendering tests
3. Create performance benchmarks
4. Integration with external services

### Phase 5: Polish and Documentation (Days 22-28)
1. Review and refactor test descriptions
2. Add test documentation
3. Create testing guidelines
4. Set up CI/CD test reporting

## Testing Principles to Follow

### 1. Test User Intent, Not Implementation
```typescript
// ❌ Bad: Testing implementation
expect(component.state.isLoading).toBe(true)

// ✅ Good: Testing user experience
expect(screen.getByText('Loading your course...')).toBeInTheDocument()
```

### 2. Use Realistic Test Data
```typescript
// ❌ Bad: Minimal test data
const course = { title: 'Test' }

// ✅ Good: Realistic scenario
const course = {
  title: 'Workplace Safety Fundamentals',
  difficulty: 3,
  customTopics: [
    'Personal Protective Equipment',
    'Hazard Identification',
    'Emergency Procedures'
  ],
  template: 'Safety'
}
```

### 3. Test Complete Workflows
```typescript
// ❌ Bad: Isolated component test
render(<MediaEnhancer topic={mockTopic} />)

// ✅ Good: Full user flow
const user = userEvent.setup()
await user.click(screen.getByText('Add Media'))
await user.type(screen.getByLabelText('Search'), 'safety equipment')
await user.click(screen.getByText('Search'))
await waitFor(() => {
  expect(screen.getByAltText('Hard hat')).toBeInTheDocument()
})
await user.click(screen.getByAltText('Hard hat'))
expect(screen.getByText('Media added successfully')).toBeInTheDocument()
```

### 4. Handle Async Operations Properly
```typescript
// ❌ Bad: Not waiting for async operations
fireEvent.click(saveButton)
expect(mockSave).toHaveBeenCalled()

// ✅ Good: Proper async handling
await user.click(saveButton)
await waitFor(() => {
  expect(screen.getByText('Course saved')).toBeInTheDocument()
})
expect(await screen.findByText('Last saved: just now')).toBeInTheDocument()
```

## Success Metrics

1. **Test Stability**: 0% flaky tests in CI/CD
2. **Coverage**: 90%+ coverage of user journeys (not code coverage)
3. **Maintenance**: Tests only change when user requirements change
4. **Performance**: Full test suite runs in under 5 minutes
5. **Documentation**: Every test clearly describes user intent

## Backwards Compatibility Strategy

1. **Parallel Test Suites**: Run old and new tests during transition
2. **Gradual Migration**: Refactor one component at a time
3. **Feature Flags**: Use flags to toggle between implementations
4. **Data Validation**: Ensure all data formats are supported

## Tools and Resources

### Required Tools
- @testing-library/react for user-centric testing
- @testing-library/user-event for realistic interactions
- MSW for API mocking
- Playwright for E2E tests
- jest-axe for accessibility testing

### Documentation Needed
1. Testing guidelines document
2. Common testing patterns
3. Test data factory documentation
4. CI/CD integration guide

## Timeline and Milestones

### Week 1: Foundation
- ✓ Test infrastructure setup
- ✓ Critical path tests implemented
- ✓ Storage tests refactored

### Week 2: Components
- ✓ Component tests refactored
- ✓ Missing tests added
- ✓ Implementation tests removed

### Week 3: Integration
- ✓ SCORM validation complete
- ✓ E2E tests running in CI
- ✓ Performance benchmarks established

### Week 4: Polish
- ✓ Documentation complete
- ✓ Team training conducted
- ✓ Monitoring dashboard live

## Risk Mitigation

### Risk 1: Breaking Existing Functionality
**Mitigation**: Run parallel test suites, extensive manual testing

### Risk 2: Team Resistance
**Mitigation**: Demonstrate value through improved stability, provide training

### Risk 3: Time Overrun
**Mitigation**: Prioritize critical paths, defer nice-to-have features

### Risk 4: Technical Debt
**Mitigation**: Refactor incrementally, maintain backwards compatibility

## Conclusion

This TDD refactoring plan prioritizes user experience and system reliability. By focusing on what users actually do rather than how the code works, we create a more maintainable and valuable test suite that serves as living documentation of system behavior.