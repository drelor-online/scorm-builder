import { render, screen, waitFor } from '../test/testProviders'
import { vi } from 'vitest'
import { ProjectDashboard } from './ProjectDashboard'

// Mock the storage service
const mockStorage = {
  isInitialized: true,
  currentProjectId: null,
  listProjects: vi.fn().mockResolvedValue([]),
  getRecentProjects: vi.fn().mockResolvedValue([]),
  deleteProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn()
}

vi.mock('../contexts/PersistentStorageContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useStorage: () => mockStorage
  }
})

// Mock the notifications
const mockNotifySuccess = vi.fn()
const mockNotifyError = vi.fn()
vi.mock('../contexts/NotificationContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useNotifications: () => ({
      notifySuccess: mockNotifySuccess,
      notifyError: mockNotifyError
    })
  }
})

describe('ProjectDashboard - Delete Button Overflow Issue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not clip the delete button text on project cards', async () => {
    // Arrange: Create a project with a name that could cause overflow
    const mockProjects = [
      {
        id: '1754928164855',
        name: '49 CFR 192', // This was the actual project name from the screenshot
        lastModified: new Date().toISOString(),
        created: new Date().toISOString(),
        filePath: 'C:\\Users\\test\\Projects\\49_CFR_192_1754928164855.scormproj'
      }
    ]

    mockStorage.listProjects.mockResolvedValue(mockProjects)

    const mockOnProjectSelect = vi.fn()
    const mockOnNewProject = vi.fn()

    // Act: Render the dashboard
    render(
      <ProjectDashboard
        onProjectSelect={mockOnProjectSelect}
        onNewProject={mockOnNewProject}
      />
    )

    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText('49 CFR 192')).toBeInTheDocument()
    })

    // Assert: The delete button should be fully visible and not clipped
    const deleteButton = screen.getByTestId('delete-project-1754928164855')
    expect(deleteButton).toBeInTheDocument()
    expect(deleteButton).toHaveTextContent('Delete')
    
    // Get the computed styles to check for overflow issues
    const buttonRect = deleteButton.getBoundingClientRect()
    const parentCard = deleteButton.closest('[data-testid="project-card"]')
    const parentRect = parentCard?.getBoundingClientRect()

    // The delete button should be within the parent card bounds
    if (parentRect) {
      expect(buttonRect.right).toBeLessThanOrEqual(parentRect.right + 1) // Allow 1px tolerance
      expect(buttonRect.bottom).toBeLessThanOrEqual(parentRect.bottom + 1)
      expect(buttonRect.left).toBeGreaterThanOrEqual(parentRect.left - 1)
      expect(buttonRect.top).toBeGreaterThanOrEqual(parentRect.top - 1)
    }

    // The button should have visible text (not clipped)
    const buttonStyle = window.getComputedStyle(deleteButton)
    expect(buttonStyle.overflow).not.toBe('hidden') // Button itself shouldn't have overflow hidden
    expect(buttonStyle.textOverflow).not.toBe('ellipsis') // Button text shouldn't be ellipsed
  })

  it('should handle long project names without affecting button visibility', async () => {
    // Arrange: Create a project with a very long name that could cause layout issues
    const mockProjects = [
      {
        id: 'long-name-project',
        name: 'This is a very long project name that could potentially cause layout issues and button clipping problems in the UI',
        lastModified: new Date().toISOString(),
        created: new Date().toISOString(),
        filePath: 'C:\\Users\\test\\Projects\\Long_Project_Name.scormproj'
      }
    ]

    mockStorage.listProjects.mockResolvedValue(mockProjects)

    const mockOnProjectSelect = vi.fn()
    const mockOnNewProject = vi.fn()

    // Act: Render the dashboard
    render(
      <ProjectDashboard
        onProjectSelect={mockOnProjectSelect}
        onNewProject={mockOnNewProject}
      />
    )

    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText(/This is a very long project name/)).toBeInTheDocument()
    })

    // Assert: The delete button should still be fully accessible
    const deleteButton = screen.getByTestId('delete-project-long-name-project')
    expect(deleteButton).toBeInTheDocument()
    expect(deleteButton).toBeVisible()
    
    // The button should be clickable (not covered by overflow)
    expect(deleteButton).not.toHaveStyle({ visibility: 'hidden' })
    expect(deleteButton).not.toHaveStyle({ display: 'none' })
    
    // Button text should be complete
    expect(deleteButton).toHaveTextContent('Delete')
  })

  it('should NOT have overflow hidden on projectCardInner that clips buttons', async () => {
    // Arrange: Create a project to test the overflow issue specifically
    const mockProjects = [
      {
        id: 'overflow-test',
        name: 'Project With Button Overflow Issue',
        lastModified: new Date().toISOString(),
        created: new Date().toISOString(),
        filePath: 'C:\\Users\\test\\Projects\\Overflow_Test.scormproj'
      }
    ]

    mockStorage.listProjects.mockResolvedValue(mockProjects)

    const mockOnProjectSelect = vi.fn()
    const mockOnNewProject = vi.fn()

    // Act: Render the dashboard
    render(
      <ProjectDashboard
        onProjectSelect={mockOnProjectSelect}
        onNewProject={mockOnNewProject}
      />
    )

    // Wait for projects to load
    await waitFor(() => {
      expect(screen.getByText('Project With Button Overflow Issue')).toBeInTheDocument()
    })

    // Assert: Find the projectCardInner element which is causing the clipping
    const projectCard = screen.getByTestId('project-card')
    
    // Look for any element with class containing "projectCardInner"
    const projectCardInner = projectCard.querySelector('[class*="projectCardInner"]')
    
    expect(projectCardInner).toBeInTheDocument()
    
    if (projectCardInner) {
      const innerStyle = window.getComputedStyle(projectCardInner)
      
      // This is the actual bug from the CSS: .projectCardInner has overflow: hidden
      // which clips the delete button as seen in the screenshot
      // This test should FAIL initially, proving we found the bug
      expect(innerStyle.overflow).not.toBe('hidden')
    }
    
    // Additionally, verify the delete button is accessible
    const deleteButton = screen.getByTestId('delete-project-overflow-test')
    expect(deleteButton).toBeInTheDocument()
    expect(deleteButton).toHaveTextContent('Delete')
  })

  it('should reproduce the specific screenshot issue from beta feedback', async () => {
    // This test specifically reproduces the issue seen in workflow-screenshot-1
    // where the delete button on "49 CFR 192" project card was cut off
    
    // Arrange: Use the exact project from the screenshot
    const mockProjects = [
      {
        id: '1754928164855', // Exact ID from the screenshot
        name: '49 CFR 192',   // Exact name from the screenshot  
        lastModified: '2025-08-12T17:02:44.855Z', // From the screenshot timestamp
        created: '2025-08-12T17:02:44.855Z',
        filePath: 'C:\\Users\\test\\Documents\\SCORM Projects\\49_CFR_192_1754928164855.scormproj'
      }
    ]

    mockStorage.listProjects.mockResolvedValue(mockProjects)

    const mockOnProjectSelect = vi.fn()
    const mockOnNewProject = vi.fn()

    // Act: Render the dashboard exactly as shown in screenshot
    render(
      <ProjectDashboard
        onProjectSelect={mockOnProjectSelect}
        onNewProject={mockOnNewProject}
      />
    )

    // Wait for the specific project to load
    await waitFor(() => {
      expect(screen.getByText('49 CFR 192')).toBeInTheDocument()
    })

    // Assert: The delete button should be fully visible, not clipped
    const deleteButton = screen.getByTestId('delete-project-1754928164855')
    expect(deleteButton).toBeInTheDocument()
    
    // Find the parent container that has overflow: hidden
    const projectCard = screen.getByTestId('project-card')
    const projectCardInner = projectCard.querySelector('[class*="projectCardInner"]')
    
    if (projectCardInner) {
      const style = window.getComputedStyle(projectCardInner)
      
      // The root cause: projectCardInner has overflow: hidden in CSS line 167
      // This clips the delete button as seen in the screenshot
      // This assertion should FAIL, confirming the bug exists
      expect(style.overflow).not.toBe('hidden')
    }
  })
})