import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CourseSeedInput } from '../CourseSeedInputRefactored'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'

// Mock dependencies
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setTitle: vi.fn()
  }))
}))

vi.mock('../../services/FileStorage', () => ({
  fileStorage: {
    isInitialized: true,
    currentProjectId: 'test-project',
    saveProject: vi.fn().mockResolvedValue({}),
    saveContent: vi.fn().mockResolvedValue({}),
    saveCourseMetadata: vi.fn().mockResolvedValue({}),
    addStateChangeListener: vi.fn(() => () => {})
  }
}))

/**
 * Actual Behavior Tests for CourseSeedInput
 * 
 * These tests document the component's actual behavior
 * following TDD principles of testing user interactions
 */

describe('CourseSeedInput - Actual Behavior', () => {
  const mockHandlers = {
    onSubmit: vi.fn(),
    onSave: vi.fn().mockResolvedValue({ success: true }),
    onSaveAs: vi.fn(),
    onOpen: vi.fn(),
    onSettingsClick: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }

  const renderComponent = () => {
    return render(
      <PersistentStorageProvider>
        <StepNavigationProvider initialStep={0}>
          <CourseSeedInput {...mockHandlers} />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Course Creation Flow', () => {
    it('allows teachers to create a course with minimal input', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Teacher enters course title
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      await user.type(titleInput, 'Introduction to Testing')
      
      // Default difficulty is already selected (3)
      expect(screen.getByTestId('difficulty-3')).toHaveClass('btn-primary')
      
      // Teacher proceeds without selecting template or adding topics
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      // Course is created with defaults
      await waitFor(() => {
        expect(mockHandlers.onSubmit).toHaveBeenCalledWith({
          courseTitle: 'Introduction to Testing',
          difficulty: 3,
          customTopics: [],
          template: 'standard',
          templateTopics: []
        })
      })
    })

    it('shows validation error when title is missing', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Teacher tries to proceed without title
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      // Error appears as toast notification
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument()
      })
      
      // Form does not submit
      expect(mockHandlers.onSubmit).not.toHaveBeenCalled()
    })
  })

  describe('Difficulty Selection', () => {
    it('allows changing difficulty level', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Initial state: difficulty 3 is selected
      expect(screen.getByTestId('difficulty-3')).toHaveClass('btn-primary')
      
      // Teacher selects expert level (5)
      await user.click(screen.getByTestId('difficulty-5'))
      
      // UI updates to show new selection
      expect(screen.getByTestId('difficulty-5')).toHaveClass('btn-primary')
      expect(screen.getByTestId('difficulty-3')).not.toHaveClass('btn-primary')
    })
  })

  describe('Topics Management', () => {
    it('accepts custom topics as line-separated text', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Teacher enters topics
      const topicsInput = screen.getByPlaceholderText(/enter each topic/i)
      await user.type(topicsInput, 'Topic 1\nTopic 2\nTopic 3')
      
      // Topics are preserved in the textarea
      expect(topicsInput).toHaveValue('Topic 1\nTopic 2\nTopic 3')
    })
  })

  describe('Save Functionality', () => {
    it('saves course progress at any time', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Teacher enters partial data
      await user.type(
        screen.getByPlaceholderText(/enter your course title/i),
        'Work in Progress'
      )
      
      // Save the progress
      const saveButton = screen.getByRole('button', { name: /save project/i })
      await user.click(saveButton)
      
      // Save handler is called
      expect(mockHandlers.onSave).toHaveBeenCalled()
      
      // Auto-save indicator updates
      await waitFor(() => {
        const indicator = screen.getByTestId('autosave-indicator')
        expect(indicator).toHaveTextContent(/saved/i)
      })
    })
  })

  describe('Navigation Controls', () => {
    it('provides access to all major actions', () => {
      renderComponent()
      
      // File operations
      expect(screen.getByRole('button', { name: /open project/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save project/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /save project as/i })).toBeInTheDocument()
      
      // Help and settings
      expect(screen.getByRole('button', { name: /help documentation/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /application settings/i })).toBeInTheDocument()
      
      // Course preview
      expect(screen.getByText('Preview Course')).toBeInTheDocument()
      
      // Progress indicator shows current step
      expect(screen.getByTestId('progress-step-0')).toBeInTheDocument()
    })
  })
})