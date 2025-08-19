import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

describe('CourseSeedInput Save Button Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
    mockStorage.saveCourseSeedData.mockResolvedValue(undefined)
  })

  it('should have disabled Save button when no onSave prop is passed', () => {
    const initialData = {
      courseTitle: 'Test Course',
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
          // onSave prop is missing - this should disable the Save button
          initialData={initialData}
        />
      </TestProviders>
    )
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeDisabled()
  })

  it('should enable Save button when onSave prop is provided', () => {
    const mockOnSave = vi.fn()
    const initialData = {
      courseTitle: 'Test Course',
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
          onSave={mockOnSave}  // This should enable the Save button
          initialData={initialData}
        />
      </TestProviders>
    )
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeEnabled()
  })

  it('should call onSave with current data when Save button is clicked', async () => {
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
    
    // Change some data
    const titleInput = screen.getByDisplayValue('Original Title')
    await user.clear(titleInput)
    await user.type(titleInput, 'Modified Title')
    
    // Click Save button
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)
    
    // Should call onSave with current form data
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        courseTitle: 'Modified Title',
        difficulty: 3,
        template: 'None'
      })
    )
  })

  it('should disable Save button while saving is in progress', async () => {
    const user = userEvent.setup()
    let resolveOnSave: () => void
    const mockOnSave = vi.fn(() => new Promise<void>((resolve) => {
      resolveOnSave = resolve
    }))
    
    const initialData = {
      courseTitle: 'Test Course',
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
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    
    // Initially enabled
    expect(saveButton).toBeEnabled()
    
    // Click save - should become disabled during save
    await user.click(saveButton)
    
    // Should be disabled while saving
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveTextContent('Saving...')
    
    // Resolve the save operation
    resolveOnSave!()
    
    // Should become enabled again after save completes
    await waitFor(() => {
      expect(saveButton).toBeEnabled()
      expect(saveButton).toHaveTextContent('Save')
    })
  })

  it('should handle save errors gracefully and re-enable Save button', async () => {
    const user = userEvent.setup()
    const mockOnSave = vi.fn().mockRejectedValue(new Error('Save failed'))
    
    const initialData = {
      courseTitle: 'Test Course',
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
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    
    // Click save
    await user.click(saveButton)
    
    // Should become enabled again even after save error
    await waitFor(() => {
      expect(saveButton).toBeEnabled()
      expect(saveButton).toHaveTextContent('Save')
    })
  })
})