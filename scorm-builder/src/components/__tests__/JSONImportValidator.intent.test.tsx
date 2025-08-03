import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../test/testProviders'
import userEvent from '@testing-library/user-event'
import { JSONImportValidator } from '../JSONImportValidator'
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
      narration: 'Welcome everyone to JavaScript fundamentals',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 2
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'By the end of this course you will learn...',
      narration: 'Let\'s review what you will learn',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 2
    },
    topics: [
      {
        id: 'topic1',
        title: 'Variables',
        content: 'Variables are containers for data',
        narration: 'In this section we\'ll learn about variables',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
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
        narration: 'Functions help us organize our code',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5
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
      passMark: 80,
      narration: null
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

      // JSON should be pasted
      const jsonInput = screen.getByLabelText(/json input/i)
      await waitFor(() => {
        expect(jsonInput).toHaveValue(jsonString)
      })
    })

    it('should show error when clipboard access is denied', async () => {
      const user = userEvent.setup();
      (navigator.clipboard.readText as any) = vi.fn().mockRejectedValue(new Error('Clipboard access denied'))

      render(<JSONImportValidator {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /paste from clipboard/i }))

      await waitFor(() => {
        expect(screen.getByText(/failed to paste from clipboard/i)).toBeInTheDocument()
      })
    })
  })

  describe('User wants to clear and start over', () => {
    it('should clear the JSON input when clear button is clicked', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      // Enter some JSON
      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: '{"test": "data"}' } })

      // Click clear
      await user.click(screen.getByRole('button', { name: /clear/i }))

      expect(jsonInput).toHaveValue('')
    })

    it('should clear validation results when cleared', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      // First validate some JSON
      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(validCourseContent) } })
      await user.click(screen.getByRole('button', { name: /validate json/i }))

      // Should show validation results
      await waitFor(() => {
        expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
      })

      // Clear
      await user.click(screen.getByRole('button', { name: /clear/i }))

      // Validation results should be gone
      expect(screen.queryByText(/valid json structure/i)).not.toBeInTheDocument()
    })
  })

  describe('User wants to proceed after validation', () => {
    it('should enable Next button only after successful validation', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      // Next button should be disabled initially
      const nextButton = screen.getByRole('button', { name: /next/i })
      expect(nextButton).toBeDisabled()

      // Enter and validate JSON
      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(validCourseContent) } })
      await user.click(screen.getByRole('button', { name: /validate json/i }))

      // Wait for validation
      await waitFor(() => {
        expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
      })

      // Next button should now be enabled
      expect(nextButton).toBeEnabled()
    })

    it('should save validated content to context when proceeding', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      // Validate JSON
      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(validCourseContent) } })
      await user.click(screen.getByRole('button', { name: /validate json/i }))

      await waitFor(() => {
        expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
      })

      // Click Next
      await user.click(screen.getByRole('button', { name: /next/i }))

      // Verify the onNext callback was called
      expect(mockOnNext).toHaveBeenCalled()
    })
  })

  describe('User wants to format JSON', () => {
    it('should format unformatted JSON when format button is clicked', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      const unformattedJson = '{"welcomePage":{"id":"welcome","title":"Test"}}'
      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: unformattedJson } })

      // Click format
      await user.click(screen.getByRole('button', { name: /format json/i }))

      // Should be formatted with indentation
      const formatted = JSON.stringify(JSON.parse(unformattedJson), null, 2)
      expect(jsonInput).toHaveValue(formatted)
    })

    it('should show error when trying to format invalid JSON', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      const invalidJson = '{"invalid": json}'
      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: invalidJson } })

      await user.click(screen.getByRole('button', { name: /format json/i }))

      await waitFor(() => {
        expect(screen.getByText(/unable to format.*invalid json/i)).toBeInTheDocument()
      })
    })
  })

  describe('User wants to see validation errors clearly', () => {
    it('should show specific missing field errors', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      const incompleteJson = {
        welcomePage: validCourseContent.welcomePage,
        // Missing learningObjectivesPage
        topics: validCourseContent.topics,
        assessment: validCourseContent.assessment
      }

      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(incompleteJson) } })

      await user.click(screen.getByRole('button', { name: /validate json/i }))

      await waitFor(() => {
        expect(screen.getByText(/missing required field.*learningObjectivesPage/i)).toBeInTheDocument()
      })
    })

    it('should show multiple validation errors at once', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      const invalidJson = {
        welcomePage: {
          id: 'welcome',
          // Missing required fields
          content: 'Test'
        },
        topics: [], // Empty topics
        // Missing other required fields
      }

      const jsonInput = screen.getByLabelText(/json input/i)
      fireEvent.change(jsonInput, { target: { value: JSON.stringify(invalidJson) } })

      await user.click(screen.getByRole('button', { name: /validate json/i }))

      await waitFor(() => {
        // Should show multiple errors
        expect(screen.getByText(/multiple validation errors/i)).toBeInTheDocument()
      })
    })
  })

  describe('User wants to work with large JSON files', () => {
    it('should handle large JSON input without freezing', async () => {
      const user = userEvent.setup()
      render(<JSONImportValidator {...defaultProps} />)

      // Create a large but valid JSON with many topics
      const largeCourseContent = {
        ...validCourseContent,
        topics: Array.from({ length: 50 }, (_, i) => ({
          id: `topic${i}`,
          title: `Topic ${i}`,
          content: `Content for topic ${i}`,
          narration: `Narration for topic ${i}`,
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 5
        }))
      }

      const jsonInput = screen.getByLabelText(/json input/i)
      const largeJson = JSON.stringify(largeCourseContent)
      
      // Use fireEvent for large content
      fireEvent.change(jsonInput, { target: { value: largeJson } })

      await user.click(screen.getByRole('button', { name: /validate json/i }))

      await waitFor(() => {
        expect(screen.getByText(/valid json structure/i)).toBeInTheDocument()
        expect(screen.getByText(/52 pages/i)).toBeInTheDocument() // 50 topics + welcome + objectives
      })
    })
  })
})