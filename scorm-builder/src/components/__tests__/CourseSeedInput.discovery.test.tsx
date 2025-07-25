import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CourseSeedInput } from '../CourseSeedInputRefactored'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import type { CourseSeedData } from '../../types/course'

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
    initialize: vi.fn(),
    createProject: vi.fn(),
    saveProject: vi.fn().mockResolvedValue({}),
    getContent: vi.fn(),
    saveContent: vi.fn().mockResolvedValue({}),
    getCourseMetadata: vi.fn(),
    saveCourseMetadata: vi.fn().mockResolvedValue({}),
    addStateChangeListener: vi.fn(() => () => {})
  }
}))

/**
 * Discovery Tests for CourseSeedInput Component
 * 
 * These tests document the actual behavior of the component
 * and help us understand how it really works.
 */

describe('CourseSeedInput - Behavior Discovery', () => {
  const mockHandlers = {
    onSubmit: vi.fn(),
    onSave: vi.fn().mockResolvedValue({ success: true }),
    onSaveAs: vi.fn(),
    onOpen: vi.fn(),
    onSettingsClick: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn()
  }

  const renderComponent = (props = {}) => {
    return render(
      <PersistentStorageProvider>
        <StepNavigationProvider initialStep={0}>
          <CourseSeedInput {...mockHandlers} {...props} />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Structure Discovery', () => {
    it('reveals the actual UI structure', () => {
      renderComponent()
      
      // Discovery: Component uses PageLayout which provides header and navigation
      expect(screen.getByTestId('page-wrapper')).toBeInTheDocument()
      expect(screen.getByTestId('page-header')).toBeInTheDocument()
      
      // Discovery: Auto-save indicator is always present
      expect(screen.getByTestId('autosave-indicator')).toBeInTheDocument()
      
      // Discovery: Course preview button is available
      expect(screen.getByText('Preview Course')).toBeInTheDocument()
    })

    it('discovers difficulty selection implementation', () => {
      renderComponent()
      
      // Discovery: Difficulty uses numbered buttons, not text labels
      expect(screen.getByTestId('difficulty-1')).toBeInTheDocument()
      expect(screen.getByTestId('difficulty-2')).toBeInTheDocument()
      expect(screen.getByTestId('difficulty-3')).toBeInTheDocument()
      expect(screen.getByTestId('difficulty-4')).toBeInTheDocument()
      expect(screen.getByTestId('difficulty-5')).toBeInTheDocument()
      
      // Discovery: Default difficulty has btn-primary class
      const defaultDifficulty = screen.getByTestId('difficulty-3')
      expect(defaultDifficulty).toHaveClass('btn-primary')
    })

    it('discovers template selection structure', () => {
      renderComponent()
      
      // Discovery: Templates are in a card with specific styling
      const templateCard = screen.getByText(/template library/i).closest('.card')
      expect(templateCard).toBeInTheDocument()
      
      // Discovery: Template buttons are structured differently than expected
      const templateSection = screen.getByText(/choose a template/i).parentElement
      expect(templateSection).toBeInTheDocument()
    })
  })

  describe('Form Validation Discovery', () => {
    it('discovers actual validation behavior', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Try to submit without title
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)
      
      // Discovery: Error appears in a toast, not inline
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument()
      })
    })
  })

  describe('Data Flow Discovery', () => {
    it('discovers how save functionality works', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Enter a title
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      await user.type(titleInput, 'Test Course')
      
      // Click save
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)
      
      // Discovery: onSave is called with form data
      expect(mockHandlers.onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          courseTitle: 'Test Course'
        })
      )
      
      // Discovery: Auto-save indicator shows "Saved"
      await waitFor(() => {
        expect(screen.getByText(/saved/i)).toBeInTheDocument()
      })
    })

    it('discovers how templates affect the form', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Find and click a template button
      const buttons = screen.getAllByRole('button')
      const templateButton = buttons.find(btn => 
        btn.textContent?.includes('Technical') || 
        btn.textContent?.includes('Safety')
      )
      
      if (templateButton) {
        await user.click(templateButton)
        
        // Discovery: Template selection changes the topics display
        await waitFor(() => {
          // Look for template-specific content
          const topicsSection = screen.queryByText(/topics included/i)
          expect(topicsSection).toBeInTheDocument()
        })
      }
    })
  })

  describe('Initial Data Handling Discovery', () => {
    it('discovers how initial data is displayed', () => {
      const initialData: CourseSeedData = {
        courseTitle: 'Existing Course',
        difficulty: 4,
        customTopics: ['Topic A', 'Topic B'],
        template: 'Technical',
        templateTopics: []
      }
      
      renderComponent({ initialData })
      
      // Discovery: Title is properly restored
      const titleInput = screen.getByPlaceholderText(/enter your course title/i)
      expect(titleInput).toHaveValue('Existing Course')
      
      // Discovery: Difficulty 4 button has btn-primary class
      expect(screen.getByTestId('difficulty-4')).toHaveClass('btn-primary')
      
      // Discovery: Custom topics are joined with newlines
      const topicsTextarea = screen.getByPlaceholderText(/enter each topic/i)
      expect(topicsTextarea).toHaveValue('Topic A\nTopic B')
    })
  })

  describe('User Interaction Discovery', () => {
    it('discovers difficulty selection behavior', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Click a different difficulty
      const expertButton = screen.getByTestId('difficulty-5')
      await user.click(expertButton)
      
      // Discovery: Button classes change
      expect(expertButton).toHaveClass('btn-primary')
      expect(screen.getByTestId('difficulty-3')).not.toHaveClass('btn-primary')
    })

    it('discovers form submission requirements', async () => {
      const user = userEvent.setup()
      renderComponent()
      
      // Fill minimum required fields
      await user.type(
        screen.getByPlaceholderText(/enter your course title/i),
        'Valid Course Title'
      )
      
      // Submit
      await user.click(screen.getByRole('button', { name: /next/i }))
      
      // Discovery: onSubmit is called with all form data
      await waitFor(() => {
        expect(mockHandlers.onSubmit).toHaveBeenCalledWith({
          courseTitle: 'Valid Course Title',
          difficulty: 3, // default
          customTopics: [],
          template: 'standard', // default
          templateTopics: []
        })
      })
    })
  })
})