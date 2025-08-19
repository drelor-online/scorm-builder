import React from 'react'
import { render, screen } from '@testing-library/react'
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

describe('CourseSeedInput isSaving State Management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
    mockStorage.saveCourseSeedData.mockResolvedValue(undefined)
  })

  const initialData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: [],
    template: 'None' as const,
    templateTopics: []
  }

  it('should disable Save button when isSaving prop is true', () => {
    const mockOnSave = vi.fn()
    
    render(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          onSave={mockOnSave}
          isSaving={true}  // This should disable the Save button
          initialData={initialData}
        />
      </TestProviders>
    )
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeDisabled()
    expect(saveButton).toHaveTextContent('Saving...')
  })

  it('should enable Save button when isSaving prop is false and onSave is provided', () => {
    const mockOnSave = vi.fn()
    
    render(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          onSave={mockOnSave}
          isSaving={false}  // This should enable the Save button
          initialData={initialData}
        />
      </TestProviders>
    )
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeEnabled()
    expect(saveButton).toHaveTextContent('Save')
  })

  it('should disable Save button when no onSave prop is provided regardless of isSaving', () => {
    render(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          // onSave prop is missing - this should disable the Save button
          isSaving={false}  // Even though not saving, should still be disabled
          initialData={initialData}
        />
      </TestProviders>
    )
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeDisabled()
  })

  it('should show proper text based on isSaving state', () => {
    const mockOnSave = vi.fn()
    
    const { rerender } = render(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          onSave={mockOnSave}
          isSaving={false}
          initialData={initialData}
        />
      </TestProviders>
    )
    
    let saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toHaveTextContent('Save')
    
    // Re-render with isSaving=true
    rerender(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          onSave={mockOnSave}
          isSaving={true}
          initialData={initialData}
        />
      </TestProviders>
    )
    
    // When isSaving is true, the button should still have "Save project" aria-label
    // but the text content should be "Saving..."
    saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toHaveTextContent('Saving...')
  })

  it('should handle undefined isSaving prop (default to false behavior)', () => {
    const mockOnSave = vi.fn()
    
    render(
      <TestProviders>
        <CourseSeedInput 
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          onSave={mockOnSave}
          // isSaving prop is undefined - should default to enabled
          initialData={initialData}
        />
      </TestProviders>
    )
    
    const saveButton = screen.getByRole('button', { name: /save/i })
    expect(saveButton).toBeEnabled()
    expect(saveButton).toHaveTextContent('Save')
  })
})