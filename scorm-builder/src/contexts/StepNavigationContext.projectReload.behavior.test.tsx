/**
 * BEHAVIOR TEST: Navigation Step Persistence Issue
 *
 * This test reproduces the issue where navigation steps get reset after loading a project.
 * The user navigates to step 3, saves project, closes it, reopens it, and finds they're back at step 0
 * with only step 0 unlocked, having to click "Next" repeatedly to get back to where they were.
 *
 * ISSUE: visitedSteps are not properly loaded/synchronized when project is reopened
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { StepNavigationProvider, useStepNavigation } from './StepNavigationContext'
import { PersistentStorageProvider } from './PersistentStorageContext'
import { MockFileStorage } from '../services/MockFileStorage'

// Test component to interact with navigation
function TestNavigationComponent() {
  const nav = useStepNavigation()

  return (
    <div>
      <div data-testid="current-step">{nav.currentStep}</div>
      <div data-testid="visited-steps">{nav.visitedSteps.join(',')}</div>
      <div data-testid="can-navigate-to-3">{nav.canNavigateToStep(3) ? 'yes' : 'no'}</div>
      <button onClick={() => nav.navigateToStep(1)} data-testid="nav-to-1">Go to Step 1</button>
      <button onClick={() => nav.navigateToStep(2)} data-testid="nav-to-2">Go to Step 2</button>
      <button onClick={() => nav.navigateToStep(3)} data-testid="nav-to-3">Go to Step 3</button>
      <button onClick={() => nav.unlockSteps([1, 2, 3])} data-testid="unlock-steps">Unlock Steps 1-3</button>
    </div>
  )
}

// Mock storage instance
let mockStorage: MockFileStorage

const renderNavigationWithStorage = (projectId: string) => {
  return render(
    <PersistentStorageProvider fileStorage={mockStorage}>
      <StepNavigationProvider initialStep={0}>
        <TestNavigationComponent />
      </StepNavigationProvider>
    </PersistentStorageProvider>
  )
}

describe('StepNavigationContext - Project Reload Behavior', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockStorage = new MockFileStorage()
    await mockStorage.initialize()
  })

  it('should reproduce the navigation reset issue when project is reloaded', async () => {
    console.log('🧪 REPRODUCING: Navigation steps reset after project reload...')

    // STEP 1: Create a project and set current project ID
    const project = await mockStorage.createProject('Test Project')
    console.log('📝 Created project:', project.id)

    // Set up visitedSteps in storage to simulate user having navigated to step 3
    const savedVisitedSteps = { steps: [0, 1, 2, 3] }
    await mockStorage.saveContent('visitedSteps', savedVisitedSteps)
    console.log('💾 Saved visitedSteps to storage:', savedVisitedSteps)

    // STEP 2: Initial render with project loaded
    const { unmount, rerender } = renderNavigationWithStorage(project.id)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('0')
    })

    console.log('📊 Initial state:')
    console.log('- Current step:', screen.getByTestId('current-step').textContent)
    console.log('- Visited steps:', screen.getByTestId('visited-steps').textContent)
    console.log('- Can navigate to 3:', screen.getByTestId('can-navigate-to-3').textContent)

    // STEP 3: Simulate user navigation during session
    // User unlocks steps and navigates to step 3
    screen.getByTestId('unlock-steps').click()
    screen.getByTestId('nav-to-3').click()

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('3')
    })

    console.log('📊 After navigation:')
    console.log('- Current step:', screen.getByTestId('current-step').textContent)
    console.log('- Visited steps:', screen.getByTestId('visited-steps').textContent)
    console.log('- Can navigate to 3:', screen.getByTestId('can-navigate-to-3').textContent)

    // At this point user should be able to navigate freely
    expect(screen.getByTestId('can-navigate-to-3')).toHaveTextContent('yes')

    // STEP 4: Simulate project reload (unmount and remount with same project)
    console.log('🔄 Simulating project reload...')
    unmount()

    // Small delay to simulate project switch
    await new Promise(resolve => setTimeout(resolve, 100))

    // Re-render with same project ID (simulates reopening project)
    const { container } = renderNavigationWithStorage(project.id)

    // STEP 5: Wait for component to load and check state
    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('0')
    }, { timeout: 3000 })

    console.log('📊 After project reload:')
    console.log('- Current step:', screen.getByTestId('current-step').textContent)
    console.log('- Visited steps:', screen.getByTestId('visited-steps').textContent)
    console.log('- Can navigate to 3:', screen.getByTestId('can-navigate-to-3').textContent)

    // CRITICAL TEST: This should pass when the bug is fixed
    // Currently this test SHOULD FAIL because visitedSteps don't load properly
    await waitFor(() => {
      const visitedStepsText = screen.getByTestId('visited-steps').textContent
      console.log('🔍 Checking visited steps after reload:', visitedStepsText)

      // The bug: visitedSteps should be [0,1,2,3] but will likely be just [0]
      expect(visitedStepsText).toContain('0,1,2,3')
    }, { timeout: 5000 })

    // User should be able to navigate to step 3 without clicking next repeatedly
    expect(screen.getByTestId('can-navigate-to-3')).toHaveTextContent('yes')

    console.log('✅ Test expects navigation steps to persist after project reload')
  })

  it('should load visitedSteps immediately when project ID changes', async () => {
    console.log('🧪 TESTING: Immediate visitedSteps loading on project change...')

    // Create project with saved navigation state
    const project = await mockStorage.createProject('Test Project 2')
    const savedSteps = { steps: [0, 1, 2] }
    await mockStorage.saveContent('visitedSteps', savedSteps)

    // Render with project
    renderNavigationWithStorage(project.id)

    // Should load visitedSteps quickly (within 1 second)
    await waitFor(() => {
      const visitedSteps = screen.getByTestId('visited-steps').textContent
      console.log('📊 Loaded visited steps:', visitedSteps)
      expect(visitedSteps).toBe('0,1,2')
    }, { timeout: 1000 })

    // Should be able to navigate to step 2 immediately
    expect(screen.getByTestId('can-navigate-to-3')).toHaveTextContent('no') // Step 3 not visited

    // But can navigate to step 2
    screen.getByTestId('nav-to-2').click()
    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('2')
    })

    console.log('✅ Navigation should work immediately after project load')
  })

  it('should synchronize currentStep with visitedSteps', async () => {
    console.log('🧪 TESTING: currentStep and visitedSteps synchronization...')

    const project = await mockStorage.createProject('Test Project 3')

    // Simulate App.tsx loading currentStep=3 but StepNavigationContext not having step 3 visited
    await mockStorage.saveContent('currentStep', { step: 'settings' }) // Step 3 in app terms
    // No visitedSteps saved - this is the problem scenario

    renderNavigationWithStorage(project.id)

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('0') // Initial step
    })

    // The bug: user is on step 3 according to App but can't navigate because visitedSteps is [0]
    console.log('📊 Initial navigation state:')
    console.log('- Visited steps:', screen.getByTestId('visited-steps').textContent)
    console.log('- Can navigate to 3:', screen.getByTestId('can-navigate-to-3').textContent)

    // This should pass when the fix is implemented - system should auto-unlock steps up to currentStep
    const visitedSteps = screen.getByTestId('visited-steps').textContent

    // Currently this will fail because visitedSteps is not synchronized with currentStep
    expect(visitedSteps).toMatch(/0.*1.*2.*3/) // Should contain steps 0,1,2,3

    console.log('✅ Test expects visitedSteps to be synchronized with currentStep')
  })
})