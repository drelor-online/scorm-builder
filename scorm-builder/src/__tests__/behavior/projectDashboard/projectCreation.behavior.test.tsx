import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProjectDashboard } from '../../../components/ProjectDashboard'
import { PersistentStorageProvider } from '../../../contexts/PersistentStorageContext'
import { fileStorage } from '../../../services/FileStorage'
import { setupBehaviorTest } from '../../utils/behaviorTestHelpers'

/**
 * Behavior Tests for Project Dashboard - Project Creation
 * 
 * These tests verify the expected behavior from BEHAVIOR_TESTING_REQUIREMENTS.md:
 * - User should be prompted to enter a title when creating a new project
 * - Create button should create .scormproj file in default folder
 * - User should see "Create First Project" when no projects exist
 */

// Mock the FileStorage service
vi.mock('../../../services/FileStorage', () => ({
  fileStorage: {
    initialize: vi.fn(),
    listProjects: vi.fn(),
    getDefaultProjectsDir: vi.fn(),
    createProject: vi.fn(),
    openProject: vi.fn(),
    currentProjectId: null
  }
}))

describe('Project Dashboard - Project Creation', () => {
  const { 
    user, 
    expectToast,
    expectInlineValidationError,
    expectProperLabeling
  } = setupBehaviorTest()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fileStorage.getDefaultProjectsDir).mockResolvedValue('/Users/test/Projects')
  })

  it('❌ EXPECTED FAILURE: should prompt for title when creating new project', async () => {
    // GIVEN: User on dashboard with existing projects
    vi.mocked(fileStorage.listProjects).mockResolvedValue([
      {
        id: 'existing-1',
        name: 'Existing Project',
        filePath: '/Users/test/Projects/existing.scormproj',
        lastModified: new Date().toISOString(),
        metadata: { courseTitle: 'Existing Project', created: new Date().toISOString(), version: '1.0' }
      }
    ])

    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    // WHEN: User clicks "Create New Project"
    const createButton = await screen.findByRole('button', { name: /create new project/i })
    await user.click(createButton)

    // THEN: Dialog appears with title input
    const dialog = await screen.findByRole('dialog', { name: /create.*project/i })
    expect(dialog).toBeInTheDocument()

    // Should have a properly labeled title input
    const titleInput = within(dialog).getByRole('textbox', { name: /project.*title/i })
    expect(titleInput).toBeInTheDocument()
    expectProperLabeling(titleInput, /project.*title/i)

    // Should have Create and Cancel buttons
    const createProjectButton = within(dialog).getByRole('button', { name: /create/i })
    const cancelButton = within(dialog).getByRole('button', { name: /cancel/i })
    
    expect(createProjectButton).toBeInTheDocument()
    expect(cancelButton).toBeInTheDocument()

    // Create button should be disabled when title is empty
    expect(createProjectButton).toBeDisabled()

    // Cancel should close dialog
    await user.click(cancelButton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('❌ EXPECTED FAILURE: should create .scormproj file in default folder', async () => {
    // GIVEN: User enters project title in creation dialog
    vi.mocked(fileStorage.listProjects).mockResolvedValue([])
    vi.mocked(fileStorage.createProject).mockResolvedValue({
      id: 'new-project-id',
      name: 'My New Course',
      filePath: '/Users/test/Projects/my-new-course.scormproj'
    })

    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    const createButton = await screen.findByRole('button', { name: /create.*project/i })
    await user.click(createButton)

    const titleInput = within(screen.getByRole('dialog')).getByRole('textbox', { name: /project.*title/i })
    
    // WHEN: User enters title and clicks Create
    await user.type(titleInput, 'My New Course')
    
    const createProjectButton = within(screen.getByRole('dialog')).getByRole('button', { name: /create/i })
    expect(createProjectButton).toBeEnabled()
    
    await user.click(createProjectButton)

    // THEN: File is created in default folder
    await waitFor(() => {
      expect(fileStorage.createProject).toHaveBeenCalledWith('My New Course')
    })

    // Dialog should close
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Should show success feedback
    await expectToast(/project.*created/i, 'success')

    // Should automatically open the new project
    expect(fileStorage.openProject).toHaveBeenCalledWith('new-project-id')
  })

  it('❌ EXPECTED FAILURE: should show "Create First Project" when no projects exist', async () => {
    // GIVEN: No projects in folder
    vi.mocked(fileStorage.listProjects).mockResolvedValue([])

    // WHEN: User opens dashboard
    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    // THEN: Special "Create First Project" button appears
    const createFirstButton = await screen.findByRole('button', { name: /create.*first.*project/i })
    expect(createFirstButton).toBeInTheDocument()

    // Should be more prominent than regular create button
    const styles = window.getComputedStyle(createFirstButton)
    expect(styles.fontSize).toMatch(/[1-9]\d+|large/i)
    
    // Should have encouraging text
    expect(screen.getByText(/ready to create your first|let's get started|begin creating/i)).toBeInTheDocument()
  })

  it('❌ EXPECTED FAILURE: should validate project title before creation', async () => {
    // GIVEN: User in project creation dialog
    vi.mocked(fileStorage.listProjects).mockResolvedValue([])

    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    const createButton = await screen.findByRole('button', { name: /create.*project/i })
    await user.click(createButton)

    const titleInput = within(screen.getByRole('dialog')).getByRole('textbox', { name: /project.*title/i })
    const createProjectButton = within(screen.getByRole('dialog')).getByRole('button', { name: /create/i })

    // WHEN: User tries to create with invalid titles
    
    // Empty title
    await user.clear(titleInput)
    await user.click(createProjectButton)
    await expectInlineValidationError(titleInput, /title.*required/i)

    // Only whitespace
    await user.clear(titleInput)
    await user.type(titleInput, '   ')
    await user.click(createProjectButton)
    await expectInlineValidationError(titleInput, /title.*required/i)

    // Invalid characters for filename
    await user.clear(titleInput)
    await user.type(titleInput, 'Project/With\\Invalid:Characters')
    await user.click(createProjectButton)
    await expectInlineValidationError(titleInput, /invalid.*characters/i)

    // THEN: Create button remains disabled until valid title
    expect(createProjectButton).toBeDisabled()

    // Valid title enables button
    await user.clear(titleInput)
    await user.type(titleInput, 'Valid Project Title')
    expect(createProjectButton).toBeEnabled()
  })

  it('❌ EXPECTED FAILURE: should handle project creation errors gracefully', async () => {
    // GIVEN: File system error will occur
    vi.mocked(fileStorage.listProjects).mockResolvedValue([])
    vi.mocked(fileStorage.createProject).mockRejectedValue(new Error('Disk full'))

    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    const createButton = await screen.findByRole('button', { name: /create.*project/i })
    await user.click(createButton)

    const titleInput = within(screen.getByRole('dialog')).getByRole('textbox', { name: /project.*title/i })
    await user.type(titleInput, 'My Course')
    
    const createProjectButton = within(screen.getByRole('dialog')).getByRole('button', { name: /create/i })

    // WHEN: User tries to create and it fails
    await user.click(createProjectButton)

    // THEN: Error is shown clearly
    await expectToast(/failed.*create.*disk full/i, 'error')

    // Dialog should remain open for retry
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    
    // Input should retain the entered title
    expect(titleInput).toHaveValue('My Course')
  })

  it('❌ EXPECTED FAILURE: should prevent duplicate project names', async () => {
    // GIVEN: Project with same name already exists
    vi.mocked(fileStorage.listProjects).mockResolvedValue([
      {
        id: 'existing-1',
        name: 'My Course',
        filePath: '/Users/test/Projects/my-course.scormproj',
        lastModified: new Date().toISOString(),
        metadata: { courseTitle: 'My Course', created: new Date().toISOString(), version: '1.0' }
      }
    ])

    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    const createButton = await screen.findByRole('button', { name: /create new project/i })
    await user.click(createButton)

    const titleInput = within(screen.getByRole('dialog')).getByRole('textbox', { name: /project.*title/i })

    // WHEN: User enters duplicate name
    await user.type(titleInput, 'My Course')

    // THEN: Validation shows duplicate error
    await expectInlineValidationError(titleInput, /already exists/i)

    // Should suggest alternative
    expect(screen.getByText(/my course \(2\)|my course - copy/i)).toBeInTheDocument()
  })

  it('❌ EXPECTED FAILURE: should auto-focus title input when dialog opens', async () => {
    // GIVEN: User clicks create
    vi.mocked(fileStorage.listProjects).mockResolvedValue([])

    render(
      <PersistentStorageProvider>
        <ProjectDashboard />
      </PersistentStorageProvider>
    )

    const createButton = await screen.findByRole('button', { name: /create.*project/i })

    // WHEN: Dialog opens
    await user.click(createButton)

    // THEN: Title input is focused
    const titleInput = within(screen.getByRole('dialog')).getByRole('textbox', { name: /project.*title/i })
    expect(document.activeElement).toBe(titleInput)
  })
})