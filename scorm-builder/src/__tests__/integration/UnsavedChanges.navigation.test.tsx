import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, expect, test, describe, beforeEach, afterEach } from 'vitest'
import { UnsavedChangesProvider, useUnsavedChanges } from '../../contexts/UnsavedChangesContext'
import { CourseSeedInput } from '../../components/CourseSeedInput'
import { AllTheProviders } from '../../test/testProviders'
import { NotificationProvider } from '../../contexts/NotificationContext'
import type { CourseSeedData } from '../../types/course'

// Mock beforeunload event handling
const mockAddEventListener = vi.fn()
const mockRemoveEventListener = vi.fn()

// Test component that simulates browser navigation integration
const NavigationGuardTestComponent: React.FC = () => {
  const { hasUnsavedChanges } = useUnsavedChanges()
  const [courseSeedData, setCourseSeedData] = React.useState<CourseSeedData>({
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: [],
    template: 'None',
    templateTopics: []
  })

  // Simulate the beforeunload handler that would be in App.tsx
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    mockAddEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      mockRemoveEventListener('beforeunload', handleBeforeUnload)
    }
  }, [hasUnsavedChanges])

  return (
    <div data-testid="navigation-guard-test">
      <div data-testid="has-unsaved-changes">{hasUnsavedChanges.toString()}</div>
      <div data-testid="beforeunload-listener-active">
        {hasUnsavedChanges ? 'active' : 'inactive'}
      </div>
      <CourseSeedInput
        data={courseSeedData}
        onNext={vi.fn()}
        onUpdate={setCourseSeedData}
        onSave={vi.fn()}
      />
    </div>
  )
}

// Test component that simulates project switching with unsaved changes
const ProjectSwitchTestComponent: React.FC = () => {
  const { hasUnsavedChanges, resetAll } = useUnsavedChanges()
  const [currentProject, setCurrentProject] = React.useState('project-1')
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false)
  const [pendingProject, setPendingProject] = React.useState<string | null>(null)

  const [courseSeedData, setCourseSeedData] = React.useState<CourseSeedData>({
    courseTitle: 'Project 1 Course',
    difficulty: 3,
    customTopics: [],
    template: 'None',
    templateTopics: []
  })

  const handleProjectSwitch = (newProjectId: string) => {
    if (hasUnsavedChanges) {
      setPendingProject(newProjectId)
      setShowConfirmDialog(true)
    } else {
      switchProject(newProjectId)
    }
  }

  const switchProject = (projectId: string) => {
    setCurrentProject(projectId)
    resetAll() // Clear all dirty flags when switching projects
    setCourseSeedData({
      courseTitle: `Project ${projectId} Course`,
      difficulty: 3,
      customTopics: [],
      template: 'None',
      templateTopics: []
    })
    setShowConfirmDialog(false)
    setPendingProject(null)
  }

  const handleConfirmSwitch = () => {
    if (pendingProject) {
      switchProject(pendingProject)
    }
  }

  const handleCancelSwitch = () => {
    setShowConfirmDialog(false)
    setPendingProject(null)
  }

  return (
    <div data-testid="project-switch-test">
      <div data-testid="current-project">{currentProject}</div>
      <div data-testid="has-unsaved-changes">{hasUnsavedChanges.toString()}</div>
      
      <button 
        onClick={() => handleProjectSwitch('project-2')}
        data-testid="switch-to-project-2"
      >
        Switch to Project 2
      </button>
      
      <button 
        onClick={() => handleProjectSwitch('project-3')}
        data-testid="switch-to-project-3"
      >
        Switch to Project 3
      </button>

      {showConfirmDialog && (
        <div data-testid="unsaved-changes-dialog">
          <div data-testid="dialog-message">
            You have unsaved changes. Do you want to switch projects anyway?
          </div>
          <button onClick={handleConfirmSwitch} data-testid="confirm-switch">
            Yes, Switch
          </button>
          <button onClick={handleCancelSwitch} data-testid="cancel-switch">
            Cancel
          </button>
        </div>
      )}

      <CourseSeedInput
        data={courseSeedData}
        onNext={vi.fn()}
        onUpdate={setCourseSeedData}
        onSave={vi.fn()}
      />
    </div>
  )
}

// Test component for dashboard navigation
const DashboardNavigationTestComponent: React.FC = () => {
  const { hasUnsavedChanges, resetAll } = useUnsavedChanges()
  const [showDashboard, setShowDashboard] = React.useState(false)
  const [showBackToDashboardDialog, setShowBackToDashboardDialog] = React.useState(false)

  const [courseSeedData, setCourseSeedData] = React.useState<CourseSeedData>({
    courseTitle: 'Course In Progress',
    difficulty: 3,
    customTopics: [],
    template: 'None',
    templateTopics: []
  })

  const handleBackToDashboard = () => {
    if (hasUnsavedChanges) {
      setShowBackToDashboardDialog(true)
    } else {
      goToDashboard()
    }
  }

  const goToDashboard = () => {
    resetAll()
    setShowDashboard(true)
    setShowBackToDashboardDialog(false)
  }

  const handleConfirmBackToDashboard = () => {
    goToDashboard()
  }

  const handleCancelBackToDashboard = () => {
    setShowBackToDashboardDialog(false)
  }

  if (showDashboard) {
    return (
      <div data-testid="dashboard">
        <h2>Project Dashboard</h2>
        <button onClick={() => setShowDashboard(false)} data-testid="back-to-editor">
          Back to Editor
        </button>
      </div>
    )
  }

  return (
    <div data-testid="dashboard-navigation-test">
      <div data-testid="has-unsaved-changes">{hasUnsavedChanges.toString()}</div>
      
      <button 
        onClick={handleBackToDashboard}
        data-testid="back-to-dashboard"
      >
        Back to Dashboard
      </button>

      {showBackToDashboardDialog && (
        <div data-testid="back-to-dashboard-dialog">
          <div data-testid="dialog-message">
            You have unsaved changes. Do you want to leave this project?
          </div>
          <button onClick={handleConfirmBackToDashboard} data-testid="confirm-back">
            Yes, Leave
          </button>
          <button onClick={handleCancelBackToDashboard} data-testid="cancel-back">
            Stay Here
          </button>
        </div>
      )}

      <CourseSeedInput
        data={courseSeedData}
        onNext={vi.fn()}
        onUpdate={setCourseSeedData}
        onSave={vi.fn()}
      />
    </div>
  )
}

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AllTheProviders>
    <NotificationProvider>
      <UnsavedChangesProvider>
        {children}
      </UnsavedChangesProvider>
    </NotificationProvider>
  </AllTheProviders>
)

describe('UnsavedChanges Navigation Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.addEventListener and removeEventListener
    Object.defineProperty(window, 'addEventListener', {
      writable: true,
      value: mockAddEventListener
    })
    Object.defineProperty(window, 'removeEventListener', {
      writable: true,
      value: mockRemoveEventListener
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Browser Navigation Warnings', () => {
    test('should activate beforeunload listener when changes are made', async () => {
      render(
        <TestWrapper>
          <NavigationGuardTestComponent />
        </TestWrapper>
      )

      // Initially no unsaved changes, no beforeunload listener
      expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('false')
      expect(screen.getByTestId('beforeunload-listener-active')).toHaveTextContent('inactive')

      // Make changes to trigger dirty state
      const titleInput = screen.getByLabelText(/Course Title/i)
      fireEvent.change(titleInput, { target: { value: 'Modified Course Title' } })

      // Should now have unsaved changes and active beforeunload listener
      await waitFor(() => {
        expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('true')
        expect(screen.getByTestId('beforeunload-listener-active')).toHaveTextContent('active')
      })

      // Verify beforeunload listener was added
      expect(mockAddEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    })

    test('should deactivate beforeunload listener when changes are saved', async () => {
      const mockOnSave = vi.fn().mockResolvedValue({ success: true })

      const SaveableComponent: React.FC = () => {
        const { hasUnsavedChanges, resetAll } = useUnsavedChanges()
        const [courseSeedData, setCourseSeedData] = React.useState<CourseSeedData>({
          courseTitle: 'Test Course',
          difficulty: 3,
          customTopics: [],
          template: 'None',
          templateTopics: []
        })

        React.useEffect(() => {
          const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
              e.preventDefault()
              e.returnValue = 'Unsaved changes'
              return e.returnValue
            }
          }

          window.addEventListener('beforeunload', handleBeforeUnload)
          mockAddEventListener('beforeunload', handleBeforeUnload)

          return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
            mockRemoveEventListener('beforeunload', handleBeforeUnload)
          }
        }, [hasUnsavedChanges])

        const handleSave = async () => {
          await mockOnSave(courseSeedData)
          resetAll() // Simulate successful save resetting all dirty flags
        }

        return (
          <div>
            <div data-testid="has-unsaved-changes">{hasUnsavedChanges.toString()}</div>
            <button onClick={handleSave} data-testid="save-button">Save</button>
            <CourseSeedInput
              data={courseSeedData}
              onNext={vi.fn()}
              onUpdate={setCourseSeedData}
              onSave={handleSave}
            />
          </div>
        )
      }

      render(
        <TestWrapper>
          <SaveableComponent />
        </TestWrapper>
      )

      // Make changes
      const titleInput = screen.getByLabelText(/Course Title/i)
      fireEvent.change(titleInput, { target: { value: 'Changed Title' } })

      await waitFor(() => {
        expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('true')
      })

      // Save changes
      const saveButton = screen.getByTestId('save-button')
      fireEvent.click(saveButton)

      // After save, should be clean
      await waitFor(() => {
        expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('false')
        expect(mockOnSave).toHaveBeenCalled()
      })
    })
  })

  describe('Project Switching', () => {
    test('should show confirmation dialog when switching projects with unsaved changes', async () => {
      render(
        <TestWrapper>
          <ProjectSwitchTestComponent />
        </TestWrapper>
      )

      // Initially in project 1, no unsaved changes
      expect(screen.getByTestId('current-project')).toHaveTextContent('project-1')
      expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('false')

      // Make changes
      const titleInput = screen.getByLabelText(/Course Title/i)
      fireEvent.change(titleInput, { target: { value: 'Modified Project 1 Title' } })

      await waitFor(() => {
        expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('true')
      })

      // Try to switch to project 2
      const switchButton = screen.getByTestId('switch-to-project-2')
      fireEvent.click(switchButton)

      // Should show confirmation dialog
      expect(screen.getByTestId('unsaved-changes-dialog')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-message')).toHaveTextContent('unsaved changes')

      // Should still be in project 1
      expect(screen.getByTestId('current-project')).toHaveTextContent('project-1')
    })

    test('should switch projects when confirming with unsaved changes', async () => {
      render(
        <TestWrapper>
          <ProjectSwitchTestComponent />
        </TestWrapper>
      )

      // Make changes in project 1
      const titleInput = screen.getByLabelText(/Course Title/i)
      fireEvent.change(titleInput, { target: { value: 'Project 1 Changes' } })

      await waitFor(() => {
        expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('true')
      })

      // Try to switch to project 3
      const switchButton = screen.getByTestId('switch-to-project-3')
      fireEvent.click(switchButton)

      // Confirm switch
      const confirmButton = screen.getByTestId('confirm-switch')
      fireEvent.click(confirmButton)

      // Should switch to project 3 and clear unsaved changes
      await waitFor(() => {
        expect(screen.getByTestId('current-project')).toHaveTextContent('project-3')
        expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('false')
      })

      // Dialog should be gone
      expect(screen.queryByTestId('unsaved-changes-dialog')).not.toBeInTheDocument()
    })

    test('should cancel project switch when user cancels', async () => {
      render(
        <TestWrapper>
          <ProjectSwitchTestComponent />
        </TestWrapper>
      )

      // Make changes
      const titleInput = screen.getByLabelText(/Course Title/i)
      fireEvent.change(titleInput, { target: { value: 'Stay in Project 1' } })

      await waitFor(() => {
        expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('true')
      })

      // Try to switch
      const switchButton = screen.getByTestId('switch-to-project-2')
      fireEvent.click(switchButton)

      // Cancel switch
      const cancelButton = screen.getByTestId('cancel-switch')
      fireEvent.click(cancelButton)

      // Should stay in project 1 and maintain unsaved changes
      expect(screen.getByTestId('current-project')).toHaveTextContent('project-1')
      expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('true')
      expect(screen.queryByTestId('unsaved-changes-dialog')).not.toBeInTheDocument()
    })

    test('should switch projects immediately when no unsaved changes', async () => {
      render(
        <TestWrapper>
          <ProjectSwitchTestComponent />
        </TestWrapper>
      )

      // Initially no unsaved changes
      expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('false')

      // Switch to project 2
      const switchButton = screen.getByTestId('switch-to-project-2')
      fireEvent.click(switchButton)

      // Should switch immediately without dialog
      await waitFor(() => {
        expect(screen.getByTestId('current-project')).toHaveTextContent('project-2')
      })

      expect(screen.queryByTestId('unsaved-changes-dialog')).not.toBeInTheDocument()
    })
  })

  describe('Dashboard Navigation', () => {
    test('should show confirmation dialog when navigating to dashboard with unsaved changes', async () => {
      render(
        <TestWrapper>
          <DashboardNavigationTestComponent />
        </TestWrapper>
      )

      // Make changes
      const titleInput = screen.getByLabelText(/Course Title/i)
      fireEvent.change(titleInput, { target: { value: 'Changes Before Dashboard' } })

      await waitFor(() => {
        expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('true')
      })

      // Try to go back to dashboard
      const backToDashboardButton = screen.getByTestId('back-to-dashboard')
      fireEvent.click(backToDashboardButton)

      // Should show confirmation dialog
      expect(screen.getByTestId('back-to-dashboard-dialog')).toBeInTheDocument()
      expect(screen.getByTestId('dialog-message')).toHaveTextContent('unsaved changes')

      // Should still be in editor
      expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument()
    })

    test('should navigate to dashboard when confirming with unsaved changes', async () => {
      render(
        <TestWrapper>
          <DashboardNavigationTestComponent />
        </TestWrapper>
      )

      // Make changes
      const titleInput = screen.getByLabelText(/Course Title/i)
      fireEvent.change(titleInput, { target: { value: 'Lost Changes' } })

      await waitFor(() => {
        expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('true')
      })

      // Go to dashboard
      const backToDashboardButton = screen.getByTestId('back-to-dashboard')
      fireEvent.click(backToDashboardButton)

      // Confirm
      const confirmButton = screen.getByTestId('confirm-back')
      fireEvent.click(confirmButton)

      // Should be at dashboard
      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument()
      })
    })

    test('should navigate to dashboard immediately when no unsaved changes', async () => {
      render(
        <TestWrapper>
          <DashboardNavigationTestComponent />
        </TestWrapper>
      )

      // No changes made
      expect(screen.getByTestId('has-unsaved-changes')).toHaveTextContent('false')

      // Go to dashboard
      const backToDashboardButton = screen.getByTestId('back-to-dashboard')
      fireEvent.click(backToDashboardButton)

      // Should navigate immediately without dialog
      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('back-to-dashboard-dialog')).not.toBeInTheDocument()
    })
  })
})