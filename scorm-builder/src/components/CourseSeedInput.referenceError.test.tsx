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

describe('CourseSeedInput ReferenceError Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.getContent.mockResolvedValue(null)
    mockStorage.saveContent.mockResolvedValue(undefined)
    mockStorage.saveCourseSeedData.mockResolvedValue(undefined)
    
    // Suppress console errors during this test since we're testing error conditions
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should reproduce ReferenceError when hasMountedRef is accessed before declaration', () => {
    const initialData = {
      courseTitle: 'Test Course',
      difficulty: 3,
      customTopics: [],
      template: 'None',
      templateTopics: []
    }
    
    // This should throw ReferenceError in the current implementation
    // because hasMountedRef is used in the sync effect (lines 181, 189) 
    // before being declared (line 231)
    expect(() => {
      render(
        <TestProviders>
          <CourseSeedInput 
            onSubmit={vi.fn()}
            onBack={vi.fn()}
            onSave={vi.fn()}
            initialData={initialData}
          />
        </TestProviders>
      )
    }).toThrow(/ReferenceError|Cannot access.*before initialization/)
  })

  it('should not throw error when component mounts with proper ref declaration order', () => {
    // This test will fail initially, then pass after we fix the declaration order
    const initialData = {
      courseTitle: 'Test Course',
      difficulty: 3,
      customTopics: [],
      template: 'None',
      templateTopics: []
    }
    
    expect(() => {
      render(
        <TestProviders>
          <CourseSeedInput 
            onSubmit={vi.fn()}
            onBack={vi.fn()}
            onSave={vi.fn()}
            initialData={initialData}
          />
        </TestProviders>
      )
    }).not.toThrow()
    
    // Should successfully render the course title input
    expect(screen.getByDisplayValue('Test Course')).toBeInTheDocument()
  })

  it('should properly initialize hasMountedRef on component mount', () => {
    const initialData = {
      courseTitle: 'Test Course',
      difficulty: 3,
      customTopics: [],
      template: 'None',
      templateTopics: []
    }
    
    // Should not throw when accessing hasMountedRef in effects
    expect(() => {
      render(
        <TestProviders>
          <CourseSeedInput 
            onSubmit={vi.fn()}
            onBack={vi.fn()}
            onSave={vi.fn()}
            initialData={initialData}
          />
        </TestProviders>
      )
    }).not.toThrow()
  })
})