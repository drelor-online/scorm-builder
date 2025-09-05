import { render, screen, fireEvent, waitFor, cleanup } from '../test/testProviders'
import { vi } from 'vitest'
import { ProjectDashboard } from './ProjectDashboard'

// Mock notifications - we'll spy on the actual calls
const mockNotifications = {
  error: vi.fn(),
  success: vi.fn(), 
  info: vi.fn()
}

// Mock the storage
vi.mock('../contexts/PersistentStorageContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useStorage: () => ({
      isInitialized: true,
      currentProjectId: null,
      createProject: vi.fn().mockRejectedValue(new Error('Invalid filename')),
      listProjects: vi.fn().mockResolvedValue([]), // Main projects list
      getRecentProjects: vi.fn().mockResolvedValue([]), // Recent projects list 
      getProjectList: vi.fn().mockResolvedValue([]),
      clearRecentFilesCache: vi.fn().mockResolvedValue(undefined),
      getContent: vi.fn().mockResolvedValue(null),
      saveContent: vi.fn().mockResolvedValue(undefined)
    })
  }
})

// Mock the notification context to return our spy functions
vi.mock('../contexts/NotificationContext', async (importOriginal) => {
  const actual = await importOriginal() as any
  return {
    ...actual,
    useNotifications: () => mockNotifications
  }
})

// Mock ultra simple logger
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}))

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({ projects_directory: '/test/path' })
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue('/test/path')
}))

// Mock the performance hook
vi.mock('../hooks/usePerformanceMonitor', () => ({
  usePerformanceMonitor: () => ({
    measureAsync: vi.fn((name, fn) => fn()),
    measure: vi.fn((name, fn) => fn())
  })
}))

describe('ProjectDashboard - Filename Validation', () => {
  let mockOnProjectSelected: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnProjectSelected = vi.fn()
    cleanup() // Clean up any remaining components from previous tests
  })

  const openCreateDialog = async () => {
    render(<ProjectDashboard onProjectSelected={mockOnProjectSelected} />)
    
    // Wait for component to finish loading (should render the new project button)
    await waitFor(() => {
      expect(screen.queryByTestId('new-project-button')).toBeInTheDocument()
    }, { timeout: 5000 })
    
    // Click the create new project button (use getAllByTestId if multiple exist)
    const createButtons = screen.getAllByTestId('new-project-button')
    const createButton = createButtons[0] // Use the first one
    fireEvent.click(createButton)
    
    // Wait for dialog to open
    await waitFor(() => {
      expect(screen.getByTestId('project-name-input')).toBeInTheDocument()
    })
    
    return screen.getByTestId('project-name-input')
  }

  const attemptCreateProject = async (projectName: string) => {
    const input = await openCreateDialog()
    
    // Enter the project name
    fireEvent.change(input, { target: { value: projectName }})
    
    // Click create button
    const confirmButton = screen.getByTestId('create-project-confirm')
    fireEvent.click(confirmButton)
    
    // Wait for validation to complete
    await waitFor(() => {}, { timeout: 1000 })
  }

  describe('Invalid Filename Characters', () => {
    // These are the characters that cause problems in actual filenames across different OS
    const invalidCharacters = [
      { char: '<', name: 'less than' },
      { char: '>', name: 'greater than' },
      { char: ':', name: 'colon' },
      { char: '"', name: 'double quote' },
      { char: '/', name: 'forward slash' },
      { char: '\\', name: 'backslash' },
      { char: '|', name: 'pipe' },
      { char: '?', name: 'question mark' },
      { char: '*', name: 'asterisk' }
    ]

    invalidCharacters.forEach(({ char, name }) => {
      it(`should show error for ${name} character (${char})`, async () => {
        await attemptCreateProject(`My Project${char}`)
        
        // Should show error message for invalid character
        expect(mockNotifications.error).toHaveBeenCalledWith(
          expect.stringMatching(/invalid.*character|cannot.*contain|not.*allowed/i)
        )
      })

      it(`should show error for ${name} character in middle of name`, async () => {
        await attemptCreateProject(`My${char}Project`)
        
        // Should show error message for invalid character
        expect(mockNotifications.error).toHaveBeenCalledWith(
          expect.stringMatching(/invalid.*character|cannot.*contain|not.*allowed/i)
        )
      })
    })

    it('should show error for multiple invalid characters', async () => {
      await attemptCreateProject('My<Project>Name')
      
      // Should show error message
      expect(mockNotifications.error).toHaveBeenCalledWith(
        expect.stringMatching(/invalid.*character|cannot.*contain|not.*allowed/i)
      )
    })

    it('should show specific list of invalid characters in error message', async () => {
      await attemptCreateProject('My<Project')
      
      // Error message should mention the specific invalid characters
      expect(mockNotifications.error).toHaveBeenCalledWith(
        expect.stringMatching(/[<>:"\/\\|?*]/)
      )
    })
  })

  describe('Valid Characters', () => {
    const validNames = [
      'My Project',
      'Course-2023',
      'Training_Module_1',
      'Safety Course (Updated)',
      'Project 123',
      'A-B_C D'
    ]

    validNames.forEach(name => {
      it(`should accept valid name: "${name}"`, async () => {
        await attemptCreateProject(name)
        
        // Should not show error for valid names
        // Note: This test will fail initially because our validation is too restrictive
        expect(mockNotifications.error).not.toHaveBeenCalledWith(
          expect.stringMatching(/invalid.*character|cannot.*contain|not.*allowed/i)
        )
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle reserved Windows filenames', async () => {
      const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'LPT1']
      
      for (const name of reservedNames) {
        mockNotifications.error.mockClear()
        cleanup() // Clean up before each iteration
        await attemptCreateProject(name)
        
        // Should show error for reserved names
        expect(mockNotifications.error).toHaveBeenCalledWith(
          expect.stringMatching(/reserved.*name|cannot.*use|not.*allowed/i)
        )
        cleanup() // Clean up after each iteration
      }
    })

    it('should handle names ending with periods or spaces', async () => {
      await attemptCreateProject('My Project.')
      
      // Should show error for names ending with period
      expect(mockNotifications.error).toHaveBeenCalledWith(
        expect.stringMatching(/cannot.*end.*with|invalid.*ending/i)
      )
    })

    it('should handle very long names', async () => {
      const longName = 'A'.repeat(256) // Most filesystems have 255 char limit
      await attemptCreateProject(longName)
      
      // Should show error for too long names
      expect(mockNotifications.error).toHaveBeenCalledWith(
        expect.stringMatching(/too.*long|name.*length|exceed.*limit/i)
      )
    })
  })

  describe('Error Message Quality', () => {
    it('should suggest valid alternatives when showing error', async () => {
      await attemptCreateProject('My<Project')
      
      // Should provide helpful suggestion
      expect(mockNotifications.error).toHaveBeenCalledWith(
        expect.stringMatching(/try.*using|consider.*instead|suggestion/i)
      )
    })

    it('should show which characters are allowed', async () => {
      await attemptCreateProject('My|Project')
      
      // Should mention what characters ARE allowed
      expect(mockNotifications.error).toHaveBeenCalledWith(
        expect.stringMatching(/letters.*numbers.*spaces|allowed.*characters/i)
      )
    })
  })
})