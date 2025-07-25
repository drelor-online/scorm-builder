# Behavior Test Plan - SCORM Builder

Based on the behavior testing requirements, this document outlines a comprehensive test plan following TDD principles.

## Testing Philosophy

1. **Write tests for expected behavior, not current implementation**
2. **Tests should fail first (RED), then pass when behavior is implemented (GREEN)**
3. **Each test should document a specific user requirement**
4. **Tests should be independent and focused on user interactions**

## Test Organization Structure

```
src/__tests__/
├── behavior/
│   ├── projectDashboard/
│   │   ├── projectList.behavior.test.tsx
│   │   ├── projectCreation.behavior.test.tsx
│   │   ├── projectManagement.behavior.test.tsx
│   │   └── folderSettings.behavior.test.tsx
│   ├── navigation/
│   │   ├── topBar.behavior.test.tsx
│   │   ├── progressIndicator.behavior.test.tsx
│   │   └── dataPreservation.behavior.test.tsx
│   ├── courseSeedInput/
│   │   ├── validation.behavior.test.tsx
│   │   ├── templateHandling.behavior.test.tsx
│   │   └── topicManagement.behavior.test.tsx
│   ├── aiPrompt/
│   │   └── promptGeneration.behavior.test.tsx
│   ├── jsonValidation/
│   │   ├── import.behavior.test.tsx
│   │   ├── validation.behavior.test.tsx
│   │   └── clearWarning.behavior.test.tsx
│   └── common/
│       ├── styling.behavior.test.tsx
│       ├── scrolling.behavior.test.tsx
│       ├── dialogs.behavior.test.tsx
│       └── autosave.behavior.test.tsx
└── utils/
    ├── behaviorTestHelpers.ts
    └── mockHelpers.ts
```

## Test Implementation Plan

### Phase 1: Common Behaviors & Utilities

#### 1.1 Test Utilities (`utils/behaviorTestHelpers.ts`)
```typescript
// Helper functions for common test patterns
- waitForAutosave()
- expectConsistentPadding()
- expectScrollableContent()
- expectConfirmationDialog()
- expectTooltip()
- simulateDragAndDrop()
```

#### 1.2 General UI/UX Tests (`common/`)
- **Consistent Styling**: Test padding, button styles, no text overflow
- **Scrolling**: Test overflow handling in modals and pages
- **Dialogs**: Test that all destructive actions show confirmation
- **Autosave**: Test autosave indicator on all pages

### Phase 2: Project Dashboard Tests

#### 2.1 Project List Display (`projectList.behavior.test.tsx`)
```typescript
describe('Project Dashboard - Project List Display', () => {
  it('should display existing projects from default folder', async () => {
    // GIVEN: Projects exist in default folder
    // WHEN: User opens dashboard
    // THEN: All projects are displayed with open/delete options
  })

  it('should show helpful instructions when no projects exist', () => {
    // GIVEN: No projects in folder
    // WHEN: User opens dashboard
    // THEN: Instructions about creating first project appear
  })

  it('should update project list when default folder changes', async () => {
    // GIVEN: User on dashboard
    // WHEN: User changes default folder
    // THEN: New folder's projects are displayed
  })
})
```

#### 2.2 Project Creation (`projectCreation.behavior.test.tsx`)
```typescript
describe('Project Dashboard - Project Creation', () => {
  it('should prompt for title when creating new project', async () => {
    // GIVEN: User clicks "Create New Project"
    // WHEN: Dialog appears
    // THEN: Title input and Create button are shown
  })

  it('should create .scormproj file in default folder', async () => {
    // GIVEN: User enters project title
    // WHEN: User clicks Create
    // THEN: File is created and project opens
  })
})
```

#### 2.3 Project Management (`projectManagement.behavior.test.tsx`)
```typescript
describe('Project Dashboard - Project Management', () => {
  it('should require confirmation before deleting project', async () => {
    // GIVEN: User clicks delete on project
    // WHEN: Confirmation dialog appears
    // THEN: Project only deleted after confirmation
  })

  it('should support drag and drop of .scormproj files', async () => {
    // GIVEN: User has .scormproj file
    // WHEN: User drags file onto dashboard
    // THEN: Project opens
  })
})
```

### Phase 3: Navigation & Top Bar Tests

#### 3.1 Top Bar Functionality (`topBar.behavior.test.tsx`)
```typescript
describe('Top Bar - Navigation and Actions', () => {
  it('should warn about unsaved changes when opening new project', async () => {
    // GIVEN: Current project has unsaved changes
    // WHEN: User clicks Open
    // THEN: Warning dialog appears
  })

  it('should save all data from all pages', async () => {
    // GIVEN: Data entered on multiple pages
    // WHEN: User clicks Save
    // THEN: All data is persisted
  })

  it('should show autosave indicator on every page', () => {
    // GIVEN: User on any page
    // WHEN: Data changes
    // THEN: Autosave indicator activates
  })

  it('should preview course with all current data', async () => {
    // GIVEN: Data entered across multiple pages
    // WHEN: User clicks Preview
    // THEN: Preview shows complete course
  })
})
```

#### 3.2 Progress Indicator (`progressIndicator.behavior.test.tsx`)
```typescript
describe('Progress Indicator - Navigation', () => {
  it('should allow navigation to previously visited steps', () => {
    // GIVEN: User has reached step 3
    // WHEN: User clicks step 1
    // THEN: Navigation succeeds without data loss
  })

  it('should keep steps blue after visiting', () => {
    // GIVEN: User visits step 3 then goes back to step 1
    // WHEN: Viewing progress indicator
    // THEN: Steps 1, 2, and 3 remain blue
  })

  it('should show step numbers and descriptions', () => {
    // GIVEN: Progress indicator displayed
    // WHEN: User views it
    // THEN: Each step shows number and short description
  })
})
```

### Phase 4: Page-Specific Tests

#### 4.1 Course Seed Input (`courseSeedInput/validation.behavior.test.tsx`)
```typescript
describe('Course Seed Input - Validation', () => {
  it('should require title, topic, and difficulty', async () => {
    // GIVEN: Empty form
    // WHEN: User tries to proceed
    // THEN: Validation prevents navigation
  })

  it('should parse one topic per line', () => {
    // GIVEN: User enters multi-line topics
    // WHEN: Form processes input
    // THEN: Each line becomes separate topic
  })

  it('should warn before clearing topics for template', async () => {
    // GIVEN: User has entered custom topics
    // WHEN: User clicks "Add template topics"
    // THEN: Confirmation dialog warns about clearing
  })
})
```

#### 4.2 AI Prompt Page (`aiPrompt/promptGeneration.behavior.test.tsx`)
```typescript
describe('AI Prompt - Generation and Copy', () => {
  it('should generate prompt from course seed data', () => {
    // GIVEN: Course seed data exists
    // WHEN: User navigates to AI prompt page
    // THEN: Prompt reflects all entered data
  })

  it('should provide feedback when copying to clipboard', async () => {
    // GIVEN: Prompt displayed
    // WHEN: User clicks copy button
    // THEN: Success message appears
  })
})
```

#### 4.3 JSON Validation (`jsonValidation/validation.behavior.test.tsx`)
```typescript
describe('JSON Validation - Import and Validation', () => {
  it('should show specific validation errors', async () => {
    // GIVEN: Invalid JSON pasted
    // WHEN: User clicks Validate
    // THEN: Exact error location and fix shown
  })

  it('should lock validated JSON and show Clear button', async () => {
    // GIVEN: Valid JSON validated
    // WHEN: Validation succeeds
    // THEN: Input disabled, Clear button appears
  })

  it('should warn about data loss when clearing JSON', async () => {
    // GIVEN: JSON validated and subsequent pages have data
    // WHEN: User clicks Clear
    // THEN: Warning about losing subsequent page data
  })
})
```

## Test Utilities Implementation

### behaviorTestHelpers.ts
```typescript
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

export const expectConsistentPadding = (element: HTMLElement) => {
  const styles = window.getComputedStyle(element)
  const padding = parseFloat(styles.padding)
  expect(padding).toBeGreaterThan(0)
  // No elements should touch edges
}

export const expectConfirmationDialog = async (actionName: string) => {
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent(actionName)
  return {
    confirm: () => userEvent.click(screen.getByText('Confirm')),
    cancel: () => userEvent.click(screen.getByText('Cancel'))
  }
}

export const simulateDragAndDrop = async (file: File, dropTarget: HTMLElement) => {
  const dataTransfer = {
    files: [file],
    items: [{
      kind: 'file',
      type: file.type,
      getAsFile: () => file
    }],
    types: ['Files']
  }

  await userEvent.upload(dropTarget, file)
  // Or fire drag events directly
}

export const waitForAutosave = async () => {
  await waitFor(() => {
    expect(screen.getByText(/saved/i)).toBeInTheDocument()
  }, { timeout: 3000 })
}
```

## Expected Test Results

### Initial Run (RED Phase)
Most tests will fail, revealing:
1. Missing confirmation dialogs
2. Inconsistent styling
3. No drag-and-drop support
4. Missing autosave indicators
5. Navigation doesn't preserve data
6. Validation errors not specific enough

### Implementation Priority
1. **Critical**: Data preservation, autosave, navigation
2. **High**: Validation, confirmation dialogs, project management
3. **Medium**: Styling consistency, tooltips, drag-and-drop

### Success Metrics
- All tests pass without modifying expected behavior
- User workflows match requirements exactly
- No data loss scenarios
- Consistent UI/UX across all pages

## Next Steps

1. Create test utility helpers
2. Implement Phase 1 common behavior tests
3. Run tests to document current failures
4. Prioritize fixes based on user impact
5. Implement fixes following TDD cycle
6. Refactor for code quality once tests pass

This plan ensures we test what the application SHOULD do, not what it currently does, helping identify and fix bugs systematically.