# Large Test File Refactoring Plan

## Overview
Several consolidated test files have grown beyond 700-800 lines, making them difficult to maintain. This plan breaks them into focused, manageable test suites.

## Current Large Files (Lines > 650)
1. **MediaDisplay.consolidated.test.tsx** (828 lines) → 8 logical sections
2. **ProjectManagement.consolidated.test.tsx** (781 lines) → 6 logical sections  
3. **AutoSave.consolidated.test.tsx** (780 lines) → 5 logical sections
4. **ProjectLoadingDialog.consolidated.test.tsx** (741 lines) → 4 logical sections
5. **ProjectDashboard.consolidated.test.tsx** (739 lines) → 6 logical sections
6. **MediaPersistence.consolidated.test.tsx** (735 lines) → 5 logical sections

## Refactoring Strategy

### Target Structure
- **Maximum 400 lines per test file**
- **Focus on single responsibility** (one major feature area per file)
- **Maintain all existing test coverage**
- **Keep related tests together**

### Example: MediaDisplay.consolidated.test.tsx → 8 Focused Files

1. **MediaDisplay.rendering.test.tsx** (~100 lines)
   - Core rendering and fallback behavior
   - Basic image rendering
   - Loading states

2. **MediaDisplay.urls.test.tsx** (~120 lines)
   - Media URL generation and blob handling
   - URL creation and management
   - MIME type handling

3. **MediaDisplay.lifecycle.test.tsx** (~100 lines)
   - Blob URL lifecycle management and cleanup
   - Memory management
   - Component unmount behavior

4. **MediaDisplay.integration.test.tsx** (~150 lines)
   - Integration with MediaService and UnifiedMediaContext
   - Context interactions
   - Service method calls

5. **MediaDisplay.errors.test.tsx** (~100 lines)
   - Loading states and error handling
   - Error scenarios and recovery
   - Network failure simulation

6. **MediaDisplay.media-types.test.tsx** (~130 lines)
   - Different media types (image, video, audio)
   - Type-specific behavior
   - Format handling

7. **MediaDisplay.performance.test.tsx** (~100 lines)
   - Memory management and performance
   - Performance optimization verification
   - Resource usage monitoring

8. **MediaDisplay.edge-cases.test.tsx** (~120 lines)
   - Edge cases and error scenarios
   - Unusual input handling
   - Boundary conditions

### Benefits of This Approach

1. **Easier Navigation**: Developers can quickly find tests for specific functionality
2. **Faster Test Execution**: Smaller files run faster and can be parallelized
3. **Better Maintainability**: Changes to specific features only affect relevant test files
4. **Clearer Intent**: Each file has a clear, focused purpose
5. **Reduced Merge Conflicts**: Smaller files reduce the likelihood of conflicts

### Implementation Steps

1. **Extract and Validate**: Create new focused test files and verify they pass
2. **Remove Duplication**: Ensure no tests are duplicated across files
3. **Update Imports**: Verify all necessary mocks and utilities are imported
4. **Maintain Coverage**: Confirm overall test coverage remains the same
5. **Update Documentation**: Update file headers to reflect the new structure

### Rollback Plan
- Keep original consolidated files as `.backup` until new structure is validated
- Maintain test count verification to ensure no tests are lost
- Run full test suite to confirm functionality preservation

## Implementation Status

✅ **Created example**: MediaDisplay.rendering.test.tsx (demonstrates approach)
⏳ **Pending**: Complete extraction of remaining 7 MediaDisplay files
⏳ **Pending**: Apply same approach to other large consolidated files

## Validation Criteria

- [ ] Total test count remains the same
- [ ] All tests pass with same behavior
- [ ] Test coverage percentage maintained
- [ ] No performance regression in test execution
- [ ] Clear file naming and organization