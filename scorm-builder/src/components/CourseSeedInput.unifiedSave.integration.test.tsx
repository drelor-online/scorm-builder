import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CourseSeedInput } from './CourseSeedInput'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import type { CourseSeedData } from '../types/course'

// Mock the storage
const mockStorage = {
  isInitialized: true,
  currentProjectId: 'test-project',
  getContent: vi.fn(),
  saveContent: vi.fn(),
  saveCourseSeedData: vi.fn(),
  saveCourseContent: vi.fn(),
  saveProject: vi.fn()
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

describe('CourseSeedInput Unified Save Architecture Integration', () => {
  let mockOnSave: ReturnType<typeof vi.fn>
  let capturedSaveData: CourseSeedData | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
    mockStorage.saveCourseSeedData.mockResolvedValue(undefined)
    mockStorage.saveCourseContent.mockResolvedValue(undefined)
    mockStorage.saveProject.mockResolvedValue(undefined)
    
    // Mock onSave callback that simulates App.tsx behavior
    mockOnSave = vi.fn(async (data: CourseSeedData) => {
      console.log('mockOnSave called with:', data)
      capturedSaveData = data
      // Simulate App.tsx handleAutosave call
      await mockStorage.saveCourseSeedData(data)
      await mockStorage.saveProject()
    })
    
    capturedSaveData = undefined
  })

  const initialData = {
    courseTitle: 'Initial Course',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'None' as const,
    templateTopics: []
  }

  it('should trigger unified save when auto-save activates after user input', async () => {
    const user = userEvent.setup()
    
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
    
    // Give the component time to mount and initialize
    await waitFor(() => {
      expect(screen.getByDisplayValue('Initial Course')).toBeInTheDocument()
    })
    
    // Find the course title input
    const titleInput = screen.getByDisplayValue('Initial Course')
    
    // Modify the title to trigger auto-save
    // Use a single character change to ensure it's detected  
    await user.type(titleInput, ' Changed')
    
    // Wait for auto-save debounce (1 second) + processing time
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled()
    }, { timeout: 3000 })
    
    // Verify the callback was called with correct data
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        courseTitle: 'Initial Course Changed',
        difficulty: 3,
        template: 'None'
      })
    )
    
    // Verify App state would be updated with the captured data
    expect(capturedSaveData).toEqual(
      expect.objectContaining({
        courseTitle: 'Initial Course Changed'
      })
    )
    
    // Verify storage operations were called (simulating unified save)
    expect(mockStorage.saveCourseSeedData).toHaveBeenCalledWith(capturedSaveData)
    expect(mockStorage.saveProject).toHaveBeenCalled()
  })

  it('should handle manual save through onSave callback', async () => {
    const user = userEvent.setup()
    
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
    const difficultyButton = screen.getByTestId('difficulty-4')
    await user.click(difficultyButton)
    
    // Click the manual save button
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)
    
    // Should immediately call onSave (no debounce for manual save)
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        courseTitle: 'Initial Course',
        difficulty: 4,
        template: 'None'
      })
    )
    
    // Verify unified save was triggered
    expect(mockStorage.saveCourseSeedData).toHaveBeenCalled()
    expect(mockStorage.saveProject).toHaveBeenCalled()
  })

  it('should not double-save when both auto-save and onSave callback are triggered', async () => {
    const user = userEvent.setup()
    
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
    
    // Modify topics to trigger auto-save
    const topicsTextarea = screen.getByTestId('topics-textarea')
    await user.clear(topicsTextarea)
    await user.type(topicsTextarea, 'New Topic 1\\nNew Topic 2')
    
    // Wait for auto-save
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled()
    }, { timeout: 2000 })
    
    // Verify CourseSeedInput didn't call storage directly
    // All storage calls should come from the onSave callback (unified save)
    expect(mockStorage.saveCourseSeedData).toHaveBeenCalledTimes(1)
    expect(mockStorage.saveProject).toHaveBeenCalledTimes(1)
    
    // The onSave callback should have been called once
    expect(mockOnSave).toHaveBeenCalledTimes(1)
  })

  it('should fall back to direct storage save when no onSave callback is provided', async () => {
    const user = userEvent.setup()
    
    render(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          // No onSave prop provided
          initialData={initialData}
        />
      </TestProviders>
    )
    
    // Modify the title
    const titleInput = screen.getByDisplayValue('Initial Course')
    await user.clear(titleInput)
    await user.type(titleInput, 'Standalone Course')
    
    // Wait for auto-save fallback
    await waitFor(() => {
      expect(mockStorage.saveCourseSeedData).toHaveBeenCalled()
    }, { timeout: 2000 })
    
    // Verify direct storage call was made (fallback behavior)
    expect(mockStorage.saveCourseSeedData).toHaveBeenCalledWith(
      expect.objectContaining({
        courseTitle: 'Standalone Course'
      })
    )
  })

  it('should maintain data consistency during rapid changes', async () => {
    const user = userEvent.setup()
    
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
    
    const titleInput = screen.getByDisplayValue('Initial Course')
    
    // Make rapid changes
    await user.clear(titleInput)
    await user.type(titleInput, 'First Change')
    
    await user.clear(titleInput)  
    await user.type(titleInput, 'Second Change')
    
    await user.clear(titleInput)
    await user.type(titleInput, 'Final Change')
    
    // Wait for debounced auto-save
    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled()
    }, { timeout: 2000 })
    
    // Should only save the final state (debouncing working correctly)
    expect(capturedSaveData?.courseTitle).toBe('Final Change')
    
    // Should not have multiple storage calls due to debouncing
    expect(mockStorage.saveCourseSeedData).toHaveBeenCalledTimes(1)
  })

  it('should properly handle save errors and not corrupt App state', async () => {
    const user = userEvent.setup()
    
    // Mock save failure
    const failingOnSave = vi.fn().mockRejectedValue(new Error('Save failed'))
    
    render(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          onSave={failingOnSave}
          initialData={initialData}
        />
      </TestProviders>
    )
    
    const titleInput = screen.getByDisplayValue('Initial Course')
    await user.clear(titleInput)
    await user.type(titleInput, 'Error Test')
    
    // Wait for auto-save attempt
    await waitFor(() => {
      expect(failingOnSave).toHaveBeenCalled()
    }, { timeout: 2000 })
    
    // Component should handle the error gracefully
    // Save button should still be functional
    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeEnabled()
    
    // Manual save should still be attempted even after auto-save failure
    await user.click(saveButton)
    expect(failingOnSave).toHaveBeenCalledTimes(2) // Auto-save + manual save
  })
})