/**
 * BEHAVIOR TEST: Direct Navigation to Previously Visited Steps
 *
 * This test reproduces the issue where users can't jump directly to previously visited steps
 * after reopening a project. Instead of being able to click on any step they've completed
 * (e.g., jumping straight to SCORM generation), they're locked at their current position
 * and must click "Next" repeatedly to re-unlock steps.
 *
 * ISSUE: When project loads at step N, visitedSteps should include all steps 0 through N,
 * but the current implementation fails to properly unlock all intermediate steps.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { StepNavigationProvider, useStepNavigation } from './StepNavigationContext'
import { PersistentStorageProvider } from './PersistentStorageContext'
import { MockFileStorage } from '../services/MockFileStorage'

// Test component that simulates the navigation UI
function TestNavigationUI() {
  const nav = useStepNavigation()

  return (
    <div>
      {/* Current state indicators */}
      <div data-testid="current-step">{nav.currentStep}</div>
      <div data-testid="visited-steps">{nav.visitedSteps.join(',')}</div>

      {/* Step navigation buttons (simulating PageLayout.tsx WorkflowProgress) */}
      {Array.from({ length: 8 }, (_, i) => (
        <button
          key={i}
          data-testid={`nav-step-${i}`}
          disabled={!nav.visitedSteps.includes(i)}
          onClick={() => nav.navigateToStep(i)}
          className={nav.visitedSteps.includes(i) ? 'unlocked' : 'locked'}
        >
          Step {i}
        </button>
      ))}

      {/* Navigation state checks */}
      <div data-testid="can-navigate-to-scorm">{nav.canNavigateToStep(7) ? 'yes' : 'no'}</div>
      <div data-testid="can-navigate-to-audio">{nav.canNavigateToStep(4) ? 'yes' : 'no'}</div>
      <div data-testid="can-navigate-to-media">{nav.canNavigateToStep(3) ? 'yes' : 'no'}</div>

      {/* Helper functions for testing */}
      <button onClick={() => nav.unlockSteps([0, 1, 2, 3, 4, 5, 6, 7])} data-testid="unlock-all">
        Unlock All Steps
      </button>
    </div>
  )
}

// Mock storage instance
let mockStorage: MockFileStorage

const renderNavigationWithProject = async (projectId: string) => {
  // Ensure the mock storage has the correct current project ID
  if (mockStorage.currentProjectId !== projectId) {
    // Simulate setting the current project ID
    await mockStorage.setCurrentProject(projectId)
  }
  console.log('🔧 Test setup - Storage currentProjectId:', mockStorage.currentProjectId)
  console.log('🔧 Test setup - Storage isInitialized:', mockStorage.isInitialized)

  return render(
    <PersistentStorageProvider fileStorage={mockStorage}>
      <StepNavigationProvider initialStep={0}>
        <TestNavigationUI />
      </StepNavigationProvider>
    </PersistentStorageProvider>
  )
}

describe('StepNavigationContext - Direct Navigation Behavior', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockStorage = new MockFileStorage()
    await mockStorage.initialize()
  })

  it('should reproduce the direct navigation restriction issue', async () => {
    console.log('🧪 REPRODUCING: Direct navigation restriction after project reload...')

    // SETUP: Create a project and simulate user having progressed to SCORM step
    const project = await mockStorage.createProject('Advanced Course Project')
    console.log('📝 Created project:', project.id)

    // Simulate App.tsx saving currentStep as 'scorm' (step 7)
    await mockStorage.saveContent('currentStep', { step: 'scorm' })
    console.log('💾 Saved currentStep to storage: scorm (step 7)')

    // Simulate that visitedSteps were saved previously (user completed all steps)
    const completedSteps = { steps: [0, 1, 2, 3, 4, 5, 6, 7] }
    await mockStorage.saveContent('visitedSteps', completedSteps)
    console.log('💾 Saved visitedSteps to storage:', completedSteps)

    // Verify the data was actually saved
    const verifyCurrentStep = await mockStorage.getContent('currentStep')
    const verifyVisitedSteps = await mockStorage.getContent('visitedSteps')
    console.log('🔍 Verification - currentStep:', verifyCurrentStep)
    console.log('🔍 Verification - visitedSteps:', verifyVisitedSteps)

    // STEP 1: Initial render simulating project reload
    await renderNavigationWithProject(project.id)

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toBeInTheDocument()
    })

    console.log('📊 Initial state after "project reload":')
    console.log('- Current step:', screen.getByTestId('current-step').textContent)
    console.log('- Visited steps:', screen.getByTestId('visited-steps').textContent)
    console.log('- Can navigate to SCORM:', screen.getByTestId('can-navigate-to-scorm').textContent)
    console.log('- Can navigate to audio:', screen.getByTestId('can-navigate-to-audio').textContent)
    console.log('- Can navigate to media:', screen.getByTestId('can-navigate-to-media').textContent)

    // CRITICAL TEST: User should be able to navigate directly to any previously visited step
    // This is what users expect - they've been to SCORM before, so all steps should be unlocked

    // Wait for visitedSteps to load properly
    await waitFor(() => {
      const visitedSteps = screen.getByTestId('visited-steps').textContent
      console.log('🔍 Checking if all steps 0-7 are visited:', visitedSteps)

      // This should pass when the bug is fixed
      // Currently this test SHOULD FAIL because visitedSteps don't load correctly
      expect(visitedSteps).toContain('0,1,2,3,4,5,6,7')
    }, { timeout: 3000 })

    // STEP 2: Test direct navigation capabilities
    console.log('🎯 Testing direct navigation to previously visited steps...')

    // Should be able to navigate directly to SCORM generation (step 7)
    expect(screen.getByTestId('can-navigate-to-scorm')).toHaveTextContent('yes')

    // Should be able to navigate directly to audio step (step 4)
    expect(screen.getByTestId('can-navigate-to-audio')).toHaveTextContent('yes')

    // Should be able to navigate directly to media step (step 3)
    expect(screen.getByTestId('can-navigate-to-media')).toHaveTextContent('yes')

    // STEP 3: Test clicking on step buttons
    console.log('🖱️ Testing step button interactions...')

    // All step buttons should be enabled (not disabled)
    for (let i = 0; i <= 7; i++) {
      const stepButton = screen.getByTestId(`nav-step-${i}`)
      expect(stepButton).not.toBeDisabled()
      expect(stepButton).toHaveClass('unlocked')
    }

    // Should be able to click directly on SCORM step
    const scormButton = screen.getByTestId('nav-step-7')
    fireEvent.click(scormButton)

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('7')
    })

    // Should be able to click directly on audio step
    const audioButton = screen.getByTestId('nav-step-4')
    fireEvent.click(audioButton)

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('4')
    })

    // Should be able to click directly on media step
    const mediaButton = screen.getByTestId('nav-step-3')
    fireEvent.click(mediaButton)

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('3')
    })

    console.log('✅ Test expects users to navigate directly to any previously visited step')
  })

  it('should handle incomplete visitedSteps data gracefully', async () => {
    console.log('🧪 TESTING: Graceful handling of incomplete visitedSteps...')

    const project = await mockStorage.createProject('Incomplete Project')

    // Simulate App.tsx having currentStep=5 but visitedSteps missing or incomplete
    await mockStorage.saveContent('currentStep', { step: 'activities' }) // Step 5
    // No visitedSteps saved - this should be backfilled

    await renderNavigationWithProject(project.id)

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toBeInTheDocument()
    })

    console.log('📊 State with incomplete visitedSteps:')
    console.log('- Current step:', screen.getByTestId('current-step').textContent)
    console.log('- Visited steps:', screen.getByTestId('visited-steps').textContent)

    // The system should backfill visitedSteps to include all steps 0-5
    await waitFor(() => {
      const visitedSteps = screen.getByTestId('visited-steps').textContent
      expect(visitedSteps).toMatch(/0.*1.*2.*3.*4.*5/) // Should contain steps 0 through 5
    }, { timeout: 2000 })

    // Should be able to navigate to any step up to activities (5)
    expect(screen.getByTestId('can-navigate-to-media')).toHaveTextContent('yes')
    expect(screen.getByTestId('can-navigate-to-audio')).toHaveTextContent('yes')

    // But not to steps beyond current progression
    expect(screen.getByTestId('can-navigate-to-scorm')).toHaveTextContent('no')

    console.log('✅ Test expects backfill to work when visitedSteps is incomplete')
  })

  it('should synchronize App.tsx currentStep with navigation visitedSteps', async () => {
    console.log('🧪 TESTING: App.tsx and StepNavigationContext synchronization...')

    const project = await mockStorage.createProject('Sync Test Project')

    // Simulate different scenarios where sync might break

    // Scenario 1: currentStep exists but no visitedSteps
    await mockStorage.saveContent('currentStep', { step: 'settings' }) // Step 6
    // No visitedSteps saved

    await renderNavigationWithProject(project.id)

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toBeInTheDocument()
    })

    // Should automatically backfill visitedSteps based on currentStep
    await waitFor(() => {
      const visitedSteps = screen.getByTestId('visited-steps').textContent
      console.log('📊 Backfilled visitedSteps:', visitedSteps)

      // Should include all steps 0 through 6
      expect(visitedSteps).toMatch(/0.*1.*2.*3.*4.*5.*6/)
    }, { timeout: 2000 })

    console.log('✅ Test expects automatic synchronization between App and StepNavigation')
  })

  it('should persist navigation state correctly across sessions', async () => {
    console.log('🧪 TESTING: Navigation state persistence across sessions...')

    const project = await mockStorage.createProject('Persistence Test')

    // PHASE 1: Initial session - user progresses to step 4
    const { unmount } = await renderNavigationWithProject(project.id)

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toBeInTheDocument()
    })

    // Simulate user progression by unlocking steps and navigating
    fireEvent.click(screen.getByTestId('unlock-all'))
    fireEvent.click(screen.getByTestId('nav-step-4'))

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('4')
    })

    console.log('📊 End of session 1:')
    console.log('- Current step:', screen.getByTestId('current-step').textContent)
    console.log('- Visited steps:', screen.getByTestId('visited-steps').textContent)

    // End session
    unmount()

    // PHASE 2: New session - reload project
    console.log('🔄 Starting new session...')

    await renderNavigationWithProject(project.id)

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toBeInTheDocument()
    })

    console.log('📊 Start of session 2:')
    console.log('- Current step:', screen.getByTestId('current-step').textContent)
    console.log('- Visited steps:', screen.getByTestId('visited-steps').textContent)

    // Should maintain all previously visited steps
    await waitFor(() => {
      const visitedSteps = screen.getByTestId('visited-steps').textContent
      // Should still have all steps that were unlocked in previous session
      expect(visitedSteps).toContain('0,1,2,3,4,5,6,7')
    }, { timeout: 2000 })

    // Should be able to navigate directly to any previously visited step
    fireEvent.click(screen.getByTestId('nav-step-7'))

    await waitFor(() => {
      expect(screen.getByTestId('current-step')).toHaveTextContent('7')
    })

    console.log('✅ Test expects navigation state to persist across sessions')
  })
})