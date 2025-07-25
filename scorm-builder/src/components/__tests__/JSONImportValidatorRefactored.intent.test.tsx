import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JSONImportValidator } from '../JSONImportValidatorRefactored'
import type { CourseContent } from '../../types/aiPrompt'

describe('JSONImportValidator - User Intent Tests', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnSettingsClick = vi.fn()
  const mockOnSave = vi.fn()
  const mockOnOpen = vi.fn()
  const mockOnHelp = vi.fn()
  const mockOnStepClick = vi.fn()

  const defaultProps = {
    onNext: mockOnNext,
    onBack: mockOnBack,
    onSettingsClick: mockOnSettingsClick,
    onSave: mockOnSave,
    onOpen: mockOnOpen,
    onHelp: mockOnHelp,
    onStepClick: mockOnStepClick
  }

  const validCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to JavaScript',
      content: 'Welcome to this JavaScript course',
      narration: 'Welcome everyone to JavaScript fundamentals'
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'By the end of this course you will learn...',
      narration: 'Let\'s review what you will learn'
    },
    topics: [
      {
        id: 'topic1',
        title: 'Variables',
        content: 'Variables are containers for data',
        narration: 'In this section we\'ll learn about variables',
        knowledgeCheck: {
          questions: [
            {
              id: 'kc1',
              type: 'multiple-choice',
              question: 'What is a variable?',
              options: ['A container', 'A function', 'A loop', 'A class'],
              correctAnswer: 0
            }
          ]
        }
      },
      {
        id: 'topic2',
        title: 'Functions',
        content: 'Functions are reusable blocks of code',
        narration: 'Functions help us organize our code'
      }
    ],
    assessment: {
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'What is JavaScript?',
          options: ['A programming language', 'A database', 'An operating system', 'A text editor'],
          correctAnswer: 0
        },
        {
          id: 'q2',
          type: 'true-false',
          question: 'JavaScript can only run in browsers',
          correctAnswer: false
        }
      ],
      passMark: 80
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage
    localStorage.clear()
    
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        readText: vi.fn(),
        writeText: vi.fn()
      },
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('User wants to import JSON from their AI chatbot', () => {
    it('should allow pasting JSON directly into the textarea', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      const jsonInput = screen.getByLabelText(/json input/i)
      const jsonString = JSON.stringify(validCourseContent, null, 2)
      
      // User pastes JSON
      await user.click(jsonInput)
      await user.paste(jsonString)

      expect(jsonInput).toHaveValue(jsonString)
    })

    it('should validate pasted JSON and show success message', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      // Paste valid JSON
      const jsonInput = screen.getByLabelText(/json input/i)
      // Use fireEvent for JSON input to avoid userEvent parsing issues with special characters
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(validCourseContent) } })

      // Click validate
      const validateButton = screen.getByRole('button', { name: /validate json/i })
      await user.click(validateButton)

      // Should show success with summary
      await waitFor(() => {
        expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
        expect(screen.getByText(/4 pages.*including.*1 knowledge check.*2 assessment/i)).toBeInTheDocument()
      })
    })

    it('should show error for invalid JSON syntax', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      // Enter invalid JSON
      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: '{ invalid json' } })

      // Validate
      await user.click(screen.getByRole('button', { name: /validate json/i }))

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/invalid json syntax/i)).toBeInTheDocument()
      })
    })

    it('should detect and reject old format JSON', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      const oldFormatJson = {
        activities: [], // Old format indicator
        quiz: { questions: [] },
        topics: []
      }

      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(oldFormatJson) } })

      await user.click(screen.getByRole('button', { name: /validate json/i }))

      await waitFor(() => {
        expect(screen.getByText(/invalid format.*old json format/i)).toBeInTheDocument()
      })
    })
  })

  describe('User wants to paste from clipboard', () => {
    it('should paste content from clipboard when button is clicked', async () => {
      const user = userEvent.setup()
      const jsonString = JSON.stringify(validCourseContent);
      (navigator.clipboard.readText as any) = vi.fn().mockResolvedValue(jsonString)

      render(<JSONImportValidator {...defaultProps} />)

      // Click paste button
      const pasteButton = screen.getByRole('button', { name: /paste from clipboard/i })
      await user.click(pasteButton)

      // Should populate textarea and show success toast
      await waitFor(() => {
        const jsonInput = screen.getByLabelText(/json input/i)
        expect(jsonInput).toHaveValue(jsonString)
        expect(screen.getByText(/pasted from clipboard/i)).toBeInTheDocument()
      })
    })

    it('should show error when clipboard access fails', async () => {
      const user = userEvent.setup();
      (navigator.clipboard.readText as any) = vi.fn().mockRejectedValue(new Error('Permission denied'))

      render(<JSONImportValidator {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /paste from clipboard/i }))

      await waitFor(() => {
        expect(screen.getByText(/failed to read from clipboard/i)).toBeInTheDocument()
      })
    })
  })

  describe('User wants to upload a JSON file', () => {
    it('should read and display file contents when uploaded', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      const jsonContent = JSON.stringify(validCourseContent)
      const file = new File([jsonContent], 'course.json', { type: 'application/json' })

      // Find file input
      const fileInput = screen.getByLabelText(/upload json file/i) as HTMLInputElement
      
      // Upload file
      await user.upload(fileInput, file)

      // Should populate textarea
      await waitFor(() => {
        const jsonInput = screen.getByLabelText(/json input/i)
        expect(jsonInput).toHaveValue(jsonContent)
      })
    })
  })

  describe('User wants to continue to next step', () => {
    it('should enable Next button only after successful validation', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      const nextButton = screen.getByRole('button', { name: /next/i })
      
      // Initially disabled
      expect(nextButton).toBeDisabled()

      // Enter and validate JSON
      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(validCourseContent) } })
      await user.click(screen.getByRole('button', { name: /validate json/i }))

      // Should enable Next button
      await waitFor(() => {
        expect(nextButton).not.toBeDisabled()
      })
    })

    it('should call onNext with parsed data when Next is clicked', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      // Enter, validate and proceed
      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(validCourseContent) } })
      await user.click(screen.getByRole('button', { name: /validate json/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled()
      })

      await user.click(screen.getByRole('button', { name: /next/i }))

      expect(mockOnNext).toHaveBeenCalledWith(validCourseContent)
    })
  })

  describe('User wants to validate specific JSON requirements', () => {
    it('should validate that welcomePage has all required fields', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      const invalidJson = {
        ...validCourseContent,
        welcomePage: {
          id: 'welcome',
          title: 'Welcome',
          // Missing content and narration
        }
      }

      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(invalidJson) } })
      await user.click(screen.getByRole('button', { name: /validate json/i }))

      await waitFor(() => {
        expect(screen.getByText(/missing required fields in welcomepage/i)).toBeInTheDocument()
      })
    })

    it('should validate that all topics have required fields', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      const invalidJson = {
        ...validCourseContent,
        topics: [
          {
            id: 'topic1',
            title: 'Topic 1',
            // Missing content and narration
          }
        ]
      }

      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(invalidJson) } })
      await user.click(screen.getByRole('button', { name: /validate json/i }))

      await waitFor(() => {
        expect(screen.getByText(/missing required fields in topic/i)).toBeInTheDocument()
      })
    })
  })

  describe('User wants to reset and start over', () => {
    it('should clear all content when reset button is clicked', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      // Enter some JSON
      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(validCourseContent) } })
      
      // Validate it
      await user.click(screen.getByRole('button', { name: /validate json/i }))
      
      await waitFor(() => {
        expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
      })

      // Click reset
      const resetButton = screen.getByRole('button', { name: /reset/i })
      await user.click(resetButton)

      // Should clear everything
      expect(jsonInput).toHaveValue('')
      expect(screen.queryByText(/valid json structure/i)).not.toBeInTheDocument()
      expect(screen.getByText(/content cleared/i)).toBeInTheDocument()
    })
  })

  describe('User wants to preview course before proceeding', () => {
    it('should show course preview button after successful validation', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      // Enter and validate JSON
      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(validCourseContent) } })
      await user.click(screen.getByRole('button', { name: /validate json/i }))

      // Should show preview button
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument()
      })
    })
  })

  describe('User has a draft from previous session', () => {
    it('should auto-load draft content on mount', async () => {
      // Save draft to localStorage in the format the hook expects
      const jsonString = JSON.stringify(validCourseContent)
      const draftData = {
        data: jsonString,
        timestamp: Date.now()
      }
      localStorage.setItem('jsonImportValidator_draft', JSON.stringify(draftData))

      render(<JSONImportValidator {...defaultProps} />)

      // Should load the draft
      await waitFor(() => {
        const jsonInput = screen.getByLabelText(/json input/i)
        expect(jsonInput).toHaveValue(jsonString)
      })
    })

    it('should not load draft if initialData is provided', () => {
      // Save draft
      localStorage.setItem('jsonImportValidator_draft', JSON.stringify(validCourseContent))
      
      const differentContent: CourseContent = {
        ...validCourseContent,
        welcomePage: {
          ...validCourseContent.welcomePage,
          title: 'Different Title'
        }
      }

      render(<JSONImportValidator {...defaultProps} initialData={differentContent} />)

      // Should use initialData, not draft
      const jsonInput = screen.getByLabelText(/json input/i)
      expect(jsonInput).toHaveValue(JSON.stringify(differentContent, null, 2))
    })
  })

  describe('User wants to go back to previous step', () => {
    it('should call onBack when Back button is clicked', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)

      expect(mockOnBack).toHaveBeenCalled()
    })
  })
})
