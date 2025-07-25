import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProjectDashboard } from '../../../components/ProjectDashboard'
import { PersistentStorageProvider } from '../../../contexts/PersistentStorageContext'
import { fileStorage } from '../../../services/FileStorage'
import { usePersistentStorage } from '../../../hooks/usePersistentStorage'
import { setupBehaviorTest } from '../../utils/behaviorTestHelpers'

/**
 * Behavior Tests for Project Dashboard - Project List Display
 * 
 * These tests verify the expected behavior from BEHAVIOR_TESTING_REQUIREMENTS.md
 * They should FAIL initially and only pass when the correct behavior is implemented.
 */

// Mock the FileStorage service
vi.mock('../../../services/FileStorage', () => ({
  fileStorage: {
    initialize: vi.fn().mockResolvedValue(undefined),
    listProjects: vi.fn(),
    getDefaultProjectsDir: vi.fn(),
    setDefaultProjectsDir: vi.fn(),
    openProject: vi.fn(),
    deleteProject: vi.fn(),
    currentProjectId: null,
    isInitialized: true
  }
}))

// Create mock storage that we can control
const mockStorage = {
  isInitialized: true,
  currentProjectId: null,
  error: null,
  listProjects: vi.fn().mockResolvedValue([]),
  getRecentProjects: vi.fn().mockResolvedValue([]),
  createProject: vi.fn(),
  openProject: vi.fn(),
  deleteProject: vi.fn()
}

// Mock the storage hook to return initialized state
vi.mock('../../../hooks/usePersistentStorage', () => ({
  usePersistentStorage: () => mockStorage
}))

// Also mock the useStorage hook from context
vi.mock('../../../contexts/PersistentStorageContext', async () => {
  const actual = await vi.importActual('../../../contexts/PersistentStorageContext') as any
  return {
    ...actual,
    useStorage: () => mockStorage
  }
})

const mockProjects = [
  {
    id: 'project-1',
    name: 'Introduction to React',
    filePath: '/Users/test/Projects/intro-react.scormproj',
    last_modified: new Date('2024-01-15').toISOString(),
    created: new Date('2024-01-01').toISOString(),
    metadata: {
      courseTitle: 'Introduction to React',
      created: new Date('2024-01-01').toISOString(),
      version: '1.0'
    }
  },
  {
    id: 'project-2', 
    name: 'Advanced TypeScript',
    filePath: '/Users/test/Projects/advanced-ts.scormproj',
    last_modified: new Date('2024-01-20').toISOString(),
    created: new Date('2024-01-10').toISOString(),
    metadata: {
      courseTitle: 'Advanced TypeScript',
      created: new Date('2024-01-10').toISOString(),
      version: '1.0'
    }
  }
]

describe('Project Dashboard - Project List Display', () => {
  const { 
    user, 
    expectConfirmationDialog, 
    expectTooltip,
    simulateDragAndDrop,
    createMockScormProjFile,
    expectConsistentPadding
  } = setupBehaviorTest()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fileStorage.getDefaultProjectsDir).mockResolvedValue('/Users/test/Projects')
    // Reset mock storage to default state
    mockStorage.listProjects.mockResolvedValue([])
    mockStorage.getRecentProjects.mockResolvedValue([])
  })

  it('❌ EXPECTED FAILURE: should display existing projects from default folder with open/delete options', async () => {
    // GIVEN: Projects exist in default folder
    mockStorage.listProjects.mockResolvedValue(mockProjects)
    mockStorage.getRecentProjects.mockResolvedValue(mockProjects)

    const onProjectSelected = vi.fn()

    // WHEN: User opens dashboard
    render(
      <PersistentStorageProvider>
        <ProjectDashboard onProjectSelected={onProjectSelected} />
      </PersistentStorageProvider>
    )

    // THEN: All projects are displayed with proper information
    await waitFor(() => {
      expect(screen.getByText('Introduction to React')).toBeInTheDocument()
      expect(screen.getByText('Advanced TypeScript')).toBeInTheDocument()
    })

    // Each project should show last modified date (may be off by 1 day due to timezone)
    expect(screen.getByText(/January 1[45], 2024/i)).toBeInTheDocument()
    expect(screen.getByText(/January (19|20), 2024/i)).toBeInTheDocument()

    // Each project should have Open and Delete buttons
    const projectCards = screen.getAllByRole('article')
    expect(projectCards).toHaveLength(2)

    projectCards.forEach(card => {
      const openButton = within(card).getByRole('button', { name: /open/i })
      const deleteButton = within(card).getByRole('button', { name: /delete/i })
      
      expect(openButton).toBeInTheDocument()
      expect(deleteButton).toBeInTheDocument()
      
      // Buttons should have consistent styling
      expectConsistentPadding(openButton)
      expectConsistentPadding(deleteButton)
    })
  })

  it('❌ EXPECTED FAILURE: should show helpful instructions when no projects exist', async () => {
    // GIVEN: No projects in folder
    vi.mocked(fileStorage.listProjects).mockResolvedValue([])

    // WHEN: User opens dashboard
    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    // THEN: Helpful instructions appear (not marketing/bragging)
    await waitFor(() => {
      // Should explain what the program is for
      expect(screen.getByText(/create SCORM-compliant e-learning courses/i)).toBeInTheDocument()
      
      // Should instruct to create first project
      expect(screen.getByText(/create your first project/i)).toBeInTheDocument()
      
      // Should NOT have marketing language
      expect(screen.queryByText(/revolutionary|amazing|powerful|best/i)).not.toBeInTheDocument()
    })

    // Create button should be prominent
    const createButton = screen.getByRole('button', { name: /create.*first.*project/i })
    expect(createButton).toBeInTheDocument()
  })

  it('❌ EXPECTED FAILURE: should update project list when default folder changes', async () => {
    // GIVEN: User on dashboard with projects
    vi.mocked(fileStorage.listProjects).mockResolvedValue(mockProjects)
    
    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Introduction to React')).toBeInTheDocument()
    })

    // WHEN: User changes default folder
    const folderSettingButton = screen.getByRole('button', { name: /change.*folder|folder.*settings/i })
    await user.click(folderSettingButton)

    // Should show current folder
    expect(screen.getByText('/Users/test/Projects')).toBeInTheDocument()

    // Change to new folder
    const newFolder = '/Users/test/Documents/SCORMProjects'
    const folderInput = screen.getByRole('textbox', { name: /project.*folder/i })
    await user.clear(folderInput)
    await user.type(folderInput, newFolder)

    // Mock new folder having different projects
    const newProjects = [{
      id: 'project-3',
      name: 'New Course',
      filePath: `${newFolder}/new-course.scormproj`,
      lastModified: new Date().toISOString(),
      metadata: { courseTitle: 'New Course', created: new Date().toISOString(), version: '1.0' }
    }]
    
    vi.mocked(fileStorage.listProjects).mockResolvedValue(newProjects)
    vi.mocked(fileStorage.setDefaultProjectsDir).mockResolvedValue(undefined)

    const saveButton = screen.getByRole('button', { name: /save|apply/i })
    await user.click(saveButton)

    // THEN: New folder's projects are displayed
    await waitFor(() => {
      expect(screen.queryByText('Introduction to React')).not.toBeInTheDocument()
      expect(screen.getByText('New Course')).toBeInTheDocument()
    })
  })

  it('❌ EXPECTED FAILURE: should support drag and drop of .scormproj files', async () => {
    // GIVEN: User has .scormproj file
    vi.mocked(fileStorage.listProjects).mockResolvedValue([])
    
    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    const dropZone = await screen.findByTestId('project-drop-zone')
    
    // WHEN: User drags file onto dashboard
    const file = createMockScormProjFile('dragged-project.scormproj', {
      courseTitle: 'Dragged Course',
      courseSeedData: { courseTitle: 'Dragged Course', difficulty: 3 }
    })

    await simulateDragAndDrop(file, dropZone)

    // THEN: Project opens
    await waitFor(() => {
      expect(fileStorage.openProject).toHaveBeenCalledWith(expect.any(String))
    })

    // Should show feedback during drag
    // This would be tested with drag enter/leave events
  })

  it('❌ EXPECTED FAILURE: should require confirmation before deleting project', async () => {
    // GIVEN: User clicks delete on project
    vi.mocked(fileStorage.listProjects).mockResolvedValue(mockProjects)
    
    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Introduction to React')).toBeInTheDocument()
    })

    const firstProjectCard = screen.getAllByRole('article')[0]
    const deleteButton = within(firstProjectCard).getByRole('button', { name: /delete/i })
    
    // WHEN: User clicks delete
    await user.click(deleteButton)

    // THEN: Confirmation dialog appears
    const dialog = await expectConfirmationDialog('delete')
    
    // Dialog should mention project name
    expect(dialog.dialog).toHaveTextContent('Introduction to React')
    
    // Canceling should not delete
    await dialog.cancel()
    expect(fileStorage.deleteProject).not.toHaveBeenCalled()
    expect(screen.getByText('Introduction to React')).toBeInTheDocument()

    // Try again and confirm
    await user.click(deleteButton)
    const dialog2 = await expectConfirmationDialog('delete')
    await dialog2.confirm()

    // Project should be deleted
    expect(fileStorage.deleteProject).toHaveBeenCalledWith('project-1')
  })

  it('❌ EXPECTED FAILURE: should show helpful tooltips on hover', async () => {
    // GIVEN: Dashboard with projects
    vi.mocked(fileStorage.listProjects).mockResolvedValue(mockProjects)
    
    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Introduction to React')).toBeInTheDocument()
    })

    // WHEN: User hovers over buttons
    const openButton = screen.getAllByRole('button', { name: /open/i })[0]
    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0]
    const createButton = screen.getByRole('button', { name: /create.*project/i })

    // THEN: Helpful tooltips appear
    await expectTooltip(openButton, /open this project/i)
    await expectTooltip(deleteButton, /permanently delete/i)
    await expectTooltip(createButton, /create a new SCORM project/i)
  })

  it('❌ EXPECTED FAILURE: should have consistent styling with the rest of the program', async () => {
    // GIVEN: Dashboard rendered
    vi.mocked(fileStorage.listProjects).mockResolvedValue(mockProjects)
    
    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    // THEN: All interactive elements have consistent padding
    const buttons = await screen.findAllByRole('button')
    buttons.forEach(button => {
      expectConsistentPadding(button)
    })

    // Project cards should have padding
    const projectCards = screen.getAllByRole('article')
    projectCards.forEach(card => {
      expectConsistentPadding(card, 16) // Cards typically need more padding
    })

    // No text should overflow containers
    const allTextElements = screen.getAllByText(/.+/)
    allTextElements.forEach(element => {
      const parent = element.parentElement
      if (parent) {
        const parentRect = parent.getBoundingClientRect()
        const elementRect = element.getBoundingClientRect()
        
        // Text should not exceed parent boundaries
        expect(elementRect.right).toBeLessThanOrEqual(parentRect.right)
        expect(elementRect.left).toBeGreaterThanOrEqual(parentRect.left)
      }
    })
  })
})