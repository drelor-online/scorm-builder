import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CourseSeedInput } from './CourseSeedInput'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'

// Mock the storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn(),
  saveCourseSeedData: vi.fn()
}

const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PersistentStorageProvider storage={mockStorage as any}>
    <StepNavigationProvider>
      <UnsavedChangesProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </UnsavedChangesProvider>
    </StepNavigationProvider>
  </PersistentStorageProvider>
)

describe('CourseSeedInput State Synchronization Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
    mockStorage.saveCourseSeedData.mockResolvedValue(undefined)
  })

  it('should call onSave callback when auto-save occurs to update parent state', async () => {
    const user = userEvent.setup()
    const mockOnSave = vi.fn()
    
    const initialData = {
      courseTitle: 'Original Title',
      difficulty: 3,
      customTopics: [],
      template: 'None',
      templateTopics: []
    }
    
    render(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          onSave={mockOnSave}
          initialData={initialData}
        />
      </TestProviders>
    )
    
    // Find course title input and change it to trigger auto-save
    const titleInput = screen.getByDisplayValue('Original Title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Modified Title')
    
    // Wait for auto-save debounce (1 second) + execution
    await waitFor(() => {
      expect(mockStorage.saveCourseSeedData).toHaveBeenCalledWith(
        expect.objectContaining({
          courseTitle: 'Modified Title',
          template: 'None'
        })
      )
    }, { timeout: 2000 })
    
    // BUG: This should pass but currently fails
    // The auto-save doesn't call onSave callback, so parent state is not updated
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          courseTitle: 'Modified Title',
          template: 'None'
        })
      )
    }, { timeout: 500 })
  })

  it('should preserve changes when component unmounts and remounts (settings dialog scenario)', async () => {
    const user = userEvent.setup()
    const mockOnSave = vi.fn()
    
    const initialData = {
      courseTitle: 'Test Course',
      difficulty: 3,
      customTopics: [],
      template: 'None',
      templateTopics: []
    }
    
    // First render
    const { unmount } = render(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          onSave={mockOnSave}
          initialData={initialData}
        />
      </TestProviders>
    )
    
    // Change title to trigger auto-save
    const titleInput = screen.getByDisplayValue('Test Course')
    await user.clear(titleInput)
    await user.type(titleInput, 'Modified Course')
    
    // Wait for auto-save to complete
    await waitFor(() => {
      expect(mockStorage.saveCourseSeedData).toHaveBeenCalled()
    }, { timeout: 2000 })
    
    // Simulate settings dialog opening (component unmounts)
    unmount()
    
    // Simulate returning from settings (component remounts)
    // BUG: The initialData still has courseTitle: 'Test Course' because App.tsx state wasn't updated
    render(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          onSave={mockOnSave}
          initialData={initialData} // Still has old title!
        />
      </TestProviders>
    )
    
    // BUG: This should show 'Modified Course' but shows 'Test Course' because state wasn't synchronized
    const titleAfterRemount = screen.getByDisplayValue('Test Course')
    expect(titleAfterRemount).toHaveValue('Modified Course') // This will fail
  })

  it('should enable manual save button when changes are made', async () => {
    const user = userEvent.setup()
    const mockOnSave = vi.fn()
    
    render(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          onSave={mockOnSave}
          initialData={{
            courseTitle: 'Test Course',
            difficulty: 3,
            customTopics: [],
            template: 'None',
            templateTopics: []
          }}
        />
      </TestProviders>
    )
    
    // Find save button (should be disabled initially)
    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeDisabled()
    
    // Change template
    const templateSelect = screen.getByDisplayValue('None')
    await user.selectOptions(templateSelect, 'Safety')
    
    // BUG: Save button should be enabled after changes but remains disabled
    await waitFor(() => {
      expect(saveButton).toBeEnabled() // This will fail
    })
  })
})