# TDD Patterns and Anti-Patterns Guide

## Purpose
This guide provides concrete examples of good TDD patterns to follow and anti-patterns to avoid, using real examples from the SCORM Builder codebase.

## Good TDD Patterns to Follow

### 1. User Story-Driven Tests

**Pattern**: Start with a user story, then write tests that verify the story is fulfilled.

```typescript
// ✅ GOOD: User story clearly stated
describe('User wants to create a safety training course', () => {
  it('should guide them through template selection with relevant options', async () => {
    renderApp()
    
    // User selects safety template
    await user.click(screen.getByRole('button', { name: /safety/i }))
    
    // They see safety-specific topics
    expect(screen.getByText('Personal Protective Equipment')).toBeInTheDocument()
    expect(screen.getByText('Hazard Identification')).toBeInTheDocument()
    expect(screen.getByText('Emergency Procedures')).toBeInTheDocument()
    
    // They can customize for their workplace
    const customTopics = screen.getByLabelText('Add your own topics')
    await user.type(customTopics, 'Chemical Storage Safety{enter}')
    
    // Their customization is preserved
    expect(screen.getByText('Chemical Storage Safety')).toBeInTheDocument()
  })
})
```

### 2. Behavior Verification

**Pattern**: Test what happens, not how it happens.

```typescript
// ✅ GOOD: Testing behavior
it('should save progress automatically while user works', async () => {
  renderCourseEditor()
  
  // User types content
  const editor = screen.getByRole('textbox', { name: /course content/i })
  await user.type(editor, 'Important safety information...')
  
  // Auto-save indicator appears
  await waitFor(() => {
    expect(screen.getByText('Saving...')).toBeInTheDocument()
  })
  
  // Indicator shows saved
  await waitFor(() => {
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })
  
  // Refresh page
  window.location.reload()
  
  // Content is preserved
  await waitFor(() => {
    expect(screen.getByText('Important safety information...')).toBeInTheDocument()
  })
})
```

### 3. Error Scenario Testing

**Pattern**: Test how the system helps users recover from errors.

```typescript
// ✅ GOOD: Testing error recovery
it('should help user recover when media upload fails', async () => {
  // Mock network error
  server.use(
    rest.post('/api/upload', (req, res, ctx) => {
      return res(ctx.status(500), ctx.json({ error: 'Upload failed' }))
    })
  )
  
  renderMediaUploader()
  
  // User tries to upload
  const file = new File(['test'], 'safety-diagram.png', { type: 'image/png' })
  const input = screen.getByLabelText(/upload image/i)
  await user.upload(input, file)
  
  // Error message is helpful
  await waitFor(() => {
    expect(screen.getByText(/Upload failed. Please try again/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry upload/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /choose different file/i })).toBeInTheDocument()
  })
  
  // User can retry
  server.use(
    rest.post('/api/upload', (req, res, ctx) => {
      return res(ctx.json({ url: 'https://example.com/image.png' }))
    })
  )
  
  await user.click(screen.getByRole('button', { name: /retry upload/i }))
  
  // Success after retry
  await waitFor(() => {
    expect(screen.getByText(/Upload successful/i)).toBeInTheDocument()
  })
})
```

### 4. Accessibility-First Testing

**Pattern**: Ensure all interactions work with keyboard and screen readers.

```typescript
// ✅ GOOD: Testing accessibility
it('should be fully navigable with keyboard', async () => {
  renderApp()
  
  // Tab through interface
  await user.tab() // Skip link
  await user.tab() // First form field
  
  // Verify focus indicators
  expect(document.activeElement).toHaveAccessibleName(/course title/i)
  expect(document.activeElement).toHaveStyle('outline: 2px solid')
  
  // Enter data with keyboard
  await user.keyboard('Workplace Safety 101')
  await user.tab() // Next field
  
  // Use arrow keys for selection
  await user.keyboard('{ArrowDown}{ArrowDown}{Enter}') // Select template
  
  // Submit with Enter
  await user.keyboard('{Enter}')
  
  // Verify progression
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Step 2')
})
```

## Anti-Patterns to Avoid

### 1. Implementation Detail Testing

**Anti-Pattern**: Testing internal state, methods, or structure.

```typescript
// ❌ BAD: Testing implementation
it('should update state when saving', () => {
  const { result } = renderHook(() => useCourseSave())
  
  act(() => {
    result.current.save({ title: 'Test' })
  })
  
  expect(result.current.state.isSaving).toBe(true)
  expect(result.current.state.lastSaved).toBeDefined()
})

// ✅ GOOD: Testing user experience
it('should show saving status to user', async () => {
  renderCourseEditor()
  
  await user.click(screen.getByRole('button', { name: /save course/i }))
  
  expect(screen.getByText('Saving your course...')).toBeInTheDocument()
  
  await waitFor(() => {
    expect(screen.getByText('Course saved successfully')).toBeInTheDocument()
  })
})
```

### 2. Over-Mocking

**Anti-Pattern**: Mocking everything, making tests meaningless.

```typescript
// ❌ BAD: Over-mocked test
vi.mock('../components/CourseEditor')
vi.mock('../components/MediaLibrary') 
vi.mock('../services/CourseService')
vi.mock('../hooks/useAutoSave')

it('should render', () => {
  render(<App />)
  expect(screen.getByText('Mock Course Editor')).toBeInTheDocument()
})

// ✅ GOOD: Minimal mocking
// Only mock external services
vi.mock('../services/api', () => ({
  uploadFile: vi.fn().mockResolvedValue({ url: 'https://example.com/file' })
}))

it('should allow complete course creation', async () => {
  // Test real components working together
  renderApp()
  
  // Complete user workflow with real components
  await createCompleteCourse()
  
  // Verify actual output
  expect(await downloadGeneratedScorm()).toMatchScormStandard()
})
```

### 3. Brittle Selectors

**Anti-Pattern**: Using implementation-specific selectors.

```typescript
// ❌ BAD: Brittle selectors
const button = container.querySelector('.btn-primary.save-btn')
const input = container.querySelector('#course_title_input_field_1')

// ✅ GOOD: User-centric selectors
const button = screen.getByRole('button', { name: /save course/i })
const input = screen.getByLabelText(/course title/i)
```

### 4. Synchronous Async Testing

**Anti-Pattern**: Not properly handling async operations.

```typescript
// ❌ BAD: Missing async handling
it('should save', () => {
  renderEditor()
  fireEvent.click(screen.getByText('Save'))
  expect(mockSave).toHaveBeenCalled() // Might not work
})

// ✅ GOOD: Proper async handling
it('should save and confirm', async () => {
  renderEditor()
  await user.click(screen.getByRole('button', { name: /save/i }))
  
  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Saved successfully')
  })
})
```

### 5. Test-After Development

**Anti-Pattern**: Writing tests after implementation to achieve coverage.

```typescript
// ❌ BAD: Tests that just exercise code
it('should call all the methods', () => {
  const component = new CourseComponent()
  component.initialize()
  component.validate()
  component.save()
  expect(component.saved).toBe(true)
})

// ✅ GOOD: Tests that drive development
it('should prevent user from losing unsaved work', async () => {
  renderEditor()
  
  // User makes changes
  await user.type(screen.getByRole('textbox'), 'Important content')
  
  // User tries to navigate away
  await user.click(screen.getByRole('link', { name: /home/i }))
  
  // System protects their work
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'You have unsaved changes. Do you want to save before leaving?'
  )
  
  // User can choose to save
  await user.click(screen.getByRole('button', { name: /save and continue/i }))
  
  // Work is saved and navigation proceeds
  await waitFor(() => {
    expect(window.location.pathname).toBe('/home')
  })
})
```

## Testing Workflow

### 1. Red-Green-Refactor

1. **Red**: Write a failing test for desired behavior
2. **Green**: Write minimal code to make test pass
3. **Refactor**: Improve code while keeping tests green

### 2. Outside-In Testing

Start with high-level user journey tests, then work down to unit tests as needed.

```typescript
// Start here: User journey
describe('Complete course creation', () => {
  it('should allow creating a full course')
})

// Then: Feature tests
describe('Media enhancement', () => {
  it('should add media to topics')
})

// Finally: Unit tests (only if needed)
describe('Media validator', () => {
  it('should validate file types')
})
```

### 3. Test Naming Convention

Use the Given-When-Then pattern in test names:

```typescript
it('given a new user, when they access the app, then they should see the welcome tutorial')
it('given an existing project, when the user opens it, then all data should be restored')
it('given a network error, when saving, then the user should see retry options')
```

## Refactoring Checklist

When refactoring existing tests, check:

- [ ] Does the test describe user behavior?
- [ ] Could a non-developer understand what's being tested?
- [ ] Are we testing outcomes, not implementation?
- [ ] Does the test still pass if we refactor the code?
- [ ] Are we using accessible selectors?
- [ ] Are async operations handled properly?
- [ ] Is the test resilient to UI changes?
- [ ] Does the test cover error scenarios?

## Conclusion

Good TDD is about:
1. **User Focus**: Test what users do and see
2. **Behavior**: Test outcomes, not implementation
3. **Resilience**: Tests survive refactoring
4. **Documentation**: Tests explain the system
5. **Confidence**: Tests catch real bugs

Avoid:
1. **Implementation Testing**: Don't test how, test what
2. **Over-Mocking**: Keep integration real
3. **Brittleness**: Use semantic selectors
4. **Coverage Chase**: Quality over quantity
5. **Test-After**: Let tests drive development