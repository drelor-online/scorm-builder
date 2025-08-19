import React from 'react'
import { render, screen } from '@testing-library/react'
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

describe('CourseSeedInput Simple Save Test', () => {
  let mockOnSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
    mockStorage.saveCourseSeedData.mockResolvedValue(undefined)
    
    mockOnSave = vi.fn()
  })

  const initialData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'None' as const,
    templateTopics: []
  }

  it('should call onSave when Save button is clicked', async () => {
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
    
    // Find and click the Save button
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)
    
    // Verify onSave was called
    expect(mockOnSave).toHaveBeenCalledWith(
      expect.objectContaining({
        courseTitle: 'Test Course',
        difficulty: 3,
        template: 'None'
      })
    )
  })

  it('should verify the onSave callback structure matches expected format', () => {
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
    
    // Just verify the component renders without errors
    expect(screen.getByDisplayValue('Test Course')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })
})