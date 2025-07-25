import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'

// Mock FileStorage
const mockSaveProject = vi.fn()
vi.mock('../services/FileStorage', () => ({
  fileStorage: {
    initialize: vi.fn().mockResolvedValue(undefined),
    isInitialized: true,
    currentProjectId: null,
    createProject: vi.fn().mockResolvedValue({ id: 'test-id', name: 'Test Project', created: new Date().toISOString(), last_modified: new Date().toISOString() }),
    openProject: vi.fn().mockResolvedValue(undefined),
    saveProject: mockSaveProject,
    deleteProject: vi.fn().mockResolvedValue(undefined),
    listProjects: vi.fn().mockResolvedValue([]),
    getRecentProjects: vi.fn().mockResolvedValue([]),
    getCurrentProjectId: vi.fn().mockReturnValue(null),
    clearCurrentProject: vi.fn(),
    saveContent: vi.fn().mockResolvedValue(undefined),
    getContent: vi.fn().mockResolvedValue(null),
    saveCourseMetadata: vi.fn().mockResolvedValue(undefined),
    getCourseMetadata: vi.fn().mockResolvedValue(null),
    addStateChangeListener: vi.fn().mockReturnValue(() => {})
  }
}))

// Mock autosave hook to prevent automatic saves
vi.mock('../hooks/useAutoSave', () => ({
  useAutoSave: vi.fn()
}))

describe('App - Course Seed Input Save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    
    // Reset mock implementation for each test
    mockSaveProject.mockResolvedValue(undefined)
  })

  it('should allow saving when course title is entered in the form', async () => {
    render(
      <PersistentStorageProvider>
        <App />
      </PersistentStorageProvider>
    )
    
    // Enter course title
    const titleInput = screen.getByLabelText(/course title/i)
    fireEvent.change(titleInput, { target: { value: 'My Test Course' } })
    
    // Click save button
    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)
    
    // Wait for save to complete
    await waitFor(() => {
      const successMessage = screen.getByText(/Project saved successfully/i)
      expect(successMessage).toBeInTheDocument()
    })
    
    // Verify save was called with correct data
    expect(mockSaveProject).toHaveBeenCalledWith(
      expect.objectContaining({
        courseTitle: 'My Test Course',
        courseSeedData: expect.objectContaining({
          courseTitle: 'My Test Course'
        })
      }),
      undefined
    )
  })

  it('should show error when saving without course title', async () => {
    // Mock save to return error for empty title
    mockSaveProject.mockResolvedValue({
      success: false,
      error: 'Course title is required to save project'
    })
    
    render(<App />)
    
    // Don't enter any course title
    // Click save button
    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)
    
    // Should show error
    await waitFor(() => {
      const errorMessage = screen.getByText(/Course title is required to save project/i)
      expect(errorMessage).toBeInTheDocument()
    })
    
    // Verify save was called with empty title
    expect(mockSaveProject).toHaveBeenCalledWith(
      expect.objectContaining({
        courseTitle: '',
        courseSeedData: expect.objectContaining({
          courseTitle: ''
        })
      }),
      undefined
    )
  })
})