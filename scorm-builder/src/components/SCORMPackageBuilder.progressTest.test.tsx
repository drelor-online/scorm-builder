import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { render } from '../test/testProviders'
import SCORMPackageBuilder from './SCORMPackageBuilder'
import type { CourseContent } from '../types/aiPrompt'
import type { CourseSeedData } from '../types/course'

// Mock the services
vi.mock('../services/rustScormGenerator', () => ({
  generateRustSCORM: vi.fn()
}))

vi.mock('../services/courseContentConverter', () => ({
  convertToEnhancedCourseContent: vi.fn()
}))

const mockCourseContent: CourseContent = {
  welcomePage: {
    id: 'welcome-1',
    title: 'Welcome',
    content: 'Welcome to the test course',
    narration: 'Welcome narration'
  },
  learningObjectivesPage: {
    id: 'objectives-1',
    title: 'Learning Objectives',
    content: 'Course objectives',
    narration: 'Objectives narration'
  },
  topics: [
    {
      id: 'topic-1',
      title: 'Test Topic',
      content: 'Test topic content',
      narration: 'Test topic narration'
    }
  ],
  assessment: {
    questions: [
      {
        id: 'q1',
        type: 'multiple-choice',
        question: 'Test question?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0
      }
    ]
  }
}

const mockCourseSeedData: CourseSeedData = {
  courseTitle: 'Test Course',
  template: 'Safety'
}

describe('SCORMPackageBuilder - Progress Improvements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display progress bar and percentage during generation', async () => {
    const { generateRustSCORM } = await import('../services/rustScormGenerator')
    const { convertToEnhancedCourseContent } = await import('../services/courseContentConverter')
    
    // Mock implementations
    vi.mocked(convertToEnhancedCourseContent).mockResolvedValue({
      welcome: mockCourseContent.welcomePage,
      objectivesPage: mockCourseContent.learningObjectivesPage,
      topics: mockCourseContent.topics,
      assessment: mockCourseContent.assessment
    } as any)
    
    // Mock SCORM generation with progress callbacks
    vi.mocked(generateRustSCORM).mockImplementation(async (content, projectId, onProgress) => {
      // Simulate progress updates
      if (onProgress) {
        onProgress('Starting generation...', 0)
        await new Promise(resolve => setTimeout(resolve, 100))
        onProgress('Processing content...', 25)
        await new Promise(resolve => setTimeout(resolve, 100))
        onProgress('Adding media...', 50)
        await new Promise(resolve => setTimeout(resolve, 100))
        onProgress('Finalizing package...', 75)
        await new Promise(resolve => setTimeout(resolve, 100))
        onProgress('Complete!', 100)
      }
      return new Uint8Array([1, 2, 3, 4]) // Mock SCORM package data
    })

    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Start SCORM generation - use getByRole to be more specific
    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    fireEvent.click(generateButton)

    // Check that progress is displayed
    await waitFor(() => {
      expect(screen.getByText('Generating SCORM Package')).toBeInTheDocument()
    })

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText('Package Ready!')).toBeInTheDocument()
    }, { timeout: 5000 })

    // Verify the generation function was called
    expect(generateRustSCORM).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.any(Function),
      expect.any(Map)
    )
  })

  it('should allow cancellation during generation', async () => {
    const { generateRustSCORM } = await import('../services/rustScormGenerator')
    const { convertToEnhancedCourseContent } = await import('../services/courseContentConverter')
    
    vi.mocked(convertToEnhancedCourseContent).mockResolvedValue({
      welcome: mockCourseContent.welcomePage,
      objectivesPage: mockCourseContent.learningObjectivesPage,
      topics: mockCourseContent.topics,
      assessment: mockCourseContent.assessment
    } as any)
    
    // Mock long-running generation
    vi.mocked(generateRustSCORM).mockImplementation(async () => {
      // Long delay to allow cancellation
      await new Promise(resolve => setTimeout(resolve, 10000))
      return new Uint8Array([1, 2, 3, 4])
    })

    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Start generation
    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    fireEvent.click(generateButton)

    // Wait for cancel button to appear
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    // Click cancel
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)

    // Verify cancellation message appears
    await waitFor(() => {
      expect(screen.getByText(/cancelled/i)).toBeInTheDocument()
    })
  })

  it('should show progress percentage and time estimates', async () => {
    const { generateRustSCORM } = await import('../services/rustScormGenerator')
    const { convertToEnhancedCourseContent } = await import('../services/courseContentConverter')
    
    vi.mocked(convertToEnhancedCourseContent).mockResolvedValue({
      welcome: mockCourseContent.welcomePage,
      objectivesPage: mockCourseContent.learningObjectivesPage,
      topics: mockCourseContent.topics,
      assessment: mockCourseContent.assessment
    } as any)
    
    vi.mocked(generateRustSCORM).mockImplementation(async (content, projectId, onProgress) => {
      if (onProgress) {
        onProgress('Processing...', 30)
      }
      await new Promise(resolve => setTimeout(resolve, 500))
      return new Uint8Array([1, 2, 3, 4])
    })

    render(
      <SCORMPackageBuilder 
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
      />
    )

    // Start generation
    const generateButton = screen.getByRole('button', { name: /generate scorm package/i })
    fireEvent.click(generateButton)

    // Check for progress percentage
    await waitFor(() => {
      // Should show percentage in circular progress
      expect(screen.getByText(/\d+%/)).toBeInTheDocument()
    })

    // Check for elapsed time
    await waitFor(() => {
      expect(screen.getByText(/\d+\.\d+s elapsed/)).toBeInTheDocument()
    })
  })
})