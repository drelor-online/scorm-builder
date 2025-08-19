import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import JSONImportValidator from './JSONImportValidator'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { FileStorage } from '../services/FileStorage'

// Mock FileStorage
vi.mock('../services/FileStorage')

// Mock Tauri APIs
const mockTauriAPI = {
  invoke: vi.fn(),
  convertFileSrc: vi.fn().mockImplementation((path: string) => `tauri://localhost/${path}`)
}

Object.defineProperty(window, '__TAURI__', {
  value: mockTauriAPI,
  writable: true
})

// Create wrapper component with all required providers and initialize storage
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <PersistentStorageProvider>
      <StepNavigationProvider>
        <UnsavedChangesProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </UnsavedChangesProvider>
      </StepNavigationProvider>
    </PersistentStorageProvider>
  )
}

// Helper function to setup a mock project for testing
const setupMockProject = () => {
  const mockFileStorage = vi.mocked(FileStorage)
  const mockInstance = {
    initializeProject: vi.fn().mockResolvedValue(undefined),
    openProject: vi.fn().mockResolvedValue({
      id: 'test-project-123',
      name: 'Test Project',
      courseSeedData: null,
      courseContent: null
    }),
    saveContent: vi.fn().mockResolvedValue(undefined),
    getContent: vi.fn().mockResolvedValue(null),
    isInitialized: true,
    currentProjectId: 'test-project-123'
  }
  
  mockFileStorage.mockImplementation(() => mockInstance as any)
  return mockInstance
}

describe('JSONImportValidator Data Persistence', () => {
  const mockProps = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn(),
  }

  let mockStorage: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage = setupMockProject()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should reproduce the workflow recording issue: JSON data disappears when navigating back', async () => {
    const validJSON = `{
      "welcomePage": {
        "id": "welcome",
        "title": "Welcome",
        "content": "Welcome to our course", 
        "narration": "Welcome narration"
      },
      "learningObjectivesPage": {
        "id": "objectives",
        "title": "Learning Objectives",
        "content": "Course objectives",
        "narration": "Objectives narration"
      },
      "topics": [{
        "id": "topic-1",
        "title": "Topic 1",
        "content": "Topic content", 
        "narration": "Topic narration"
      }],
      "assessment": {
        "questions": [{
          "id": "q1",
          "type": "multiple-choice",
          "question": "Test question",
          "options": ["A", "B"],
          "correctAnswer": 0
        }]
      }
    }`

    // Set up storage to return null initially (no persisted data)
    mockStorage.getContent.mockResolvedValue(null)

    // First render - user enters and validates JSON (Step 3)
    const { rerender } = render(
      <TestWrapper>
        <JSONImportValidator {...mockProps} />
      </TestWrapper>
    )
    
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: validJSON } })
    
    // Wait for validation to complete - check for the Next button to be enabled
    await waitFor(() => {
      const nextButton = screen.getByTestId('next-button')
      expect(nextButton).not.toHaveAttribute('disabled')
    })

    // Verify storage was called to persist the data
    expect(mockStorage.saveContent).toHaveBeenCalledWith('json-import-data', expect.objectContaining({
      rawJson: validJSON,
      isLocked: true,
      validationResult: expect.objectContaining({
        isValid: true
      })
    }))

    // Now simulate the fix: when user navigates back to JSON import page, 
    // storage should return the saved data
    const savedData = {
      rawJson: validJSON,
      isLocked: true,
      validationResult: {
        isValid: true,
        data: JSON.parse(validJSON),
        summary: expect.any(String)
      }
    }
    mockStorage.getContent.mockResolvedValue(savedData)

    // Rerender component to simulate navigation back to JSON import page
    rerender(
      <TestWrapper>
        <JSONImportValidator {...mockProps} />
      </TestWrapper>
    )

    // Wait for component to load and restore data
    await waitFor(() => {
      const newTextarea = screen.getByRole('textbox')
      // Debug: Check what value the textarea actually has
      console.log('Textarea value:', newTextarea.value)
      console.log('Storage getContent calls:', mockStorage.getContent.mock.calls)
      
      // After the fix: textarea should contain the restored JSON
      expect(newTextarea).toHaveValue(validJSON)
      
      // Next button should be enabled since valid JSON is loaded
      const nextButton = screen.getByTestId('next-button')
      expect(nextButton).not.toHaveAttribute('disabled')
    })

    // Verify that storage.getContent was called to load the data
    expect(mockStorage.getContent).toHaveBeenCalledWith('json-import-data')
  })
})