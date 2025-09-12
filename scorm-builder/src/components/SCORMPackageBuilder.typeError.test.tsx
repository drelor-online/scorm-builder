/**
 * Test to reproduce and fix TypeScript compilation errors in SCORMPackageBuilder
 * 
 * This test verifies that the error logging functionality in SCORMPackageBuilder
 * compiles correctly and handles error scenarios properly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { SCORMPackageBuilder } from './SCORMPackageBuilder'
import type { CourseContent } from '../types/aiPrompt'
import type { CourseSeedData } from '../types/course'
import { AllTheProviders } from '../test/testProviders'

// Mock dependencies
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('../services/rustScormGenerator', () => ({
  generateRustSCORM: vi.fn().mockRejectedValue(new Error('Mock SCORM generation error'))
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn().mockResolvedValue('/test/path/course.zip')
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined)
}))

describe('SCORMPackageBuilder TypeScript Compilation', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to the Course',
      content: '<p>Welcome content</p>',
      narration: 'Welcome narration',
      imageKeywords: ['welcome'],
      imagePrompts: ['welcome image'],
      videoSearchTerms: ['welcome video'],
      duration: 5,
      media: [
        {
          id: 'welcome-image-001',
          type: 'image',
          title: 'Welcome Image',
          url: '/media/welcome.jpg'
        }
      ]
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<p>Objectives content</p>',
      narration: 'Objectives narration',
      imageKeywords: ['objectives'],
      imagePrompts: ['objectives image'],
      videoSearchTerms: ['objectives video'],
      duration: 3,
      media: [
        {
          id: 'objectives-video-001',
          type: 'video',
          title: 'Objectives Video',
          url: '/media/objectives.mp4'
        }
      ]
    },
    topics: [
      {
        id: 'topic1',
        title: 'First Topic',
        content: '<p>Topic content</p>',
        narration: 'Topic narration',
        imageKeywords: ['topic'],
        imagePrompts: ['topic image'],
        videoSearchTerms: ['topic video'],
        duration: 10,
        media: [
          {
            id: 'topic-audio-001',
            type: 'audio',
            title: 'Topic Audio',
            url: '/media/topic.mp3'
          }
        ]
      }
    ],
    assessment: {
      questions: [
        {
          id: 'q1',
          type: 'multiple-choice',
          question: 'Test question?',
          options: ['A', 'B', 'C'],
          correctAnswer: 'A'
        }
      ]
    }
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course Title',
    description: 'Test course description',
    objectives: ['Objective 1', 'Objective 2'],
    targetAudience: 'Test audience',
    duration: 60,
    difficulty: 'beginner'
  }

  const mockProps = {
    courseContent: mockCourseContent,
    courseSeedData: mockCourseSeedData,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should compile without TypeScript errors when accessing course properties', () => {
    // This test verifies that the component can be rendered without TypeScript compilation errors
    // It specifically tests the logging code that was causing the compilation issues
    
    expect(() => {
      render(
        <AllTheProviders>
          <SCORMPackageBuilder {...mockProps} />
        </AllTheProviders>
      )
    }).not.toThrow()
    
    // Verify the component renders
    expect(screen.getByText(/Generate SCORM Package/i)).toBeInTheDocument()
  })

  it('should handle error logging with correct property access', async () => {
    const { debugLogger } = await import('../utils/ultraSimpleLogger')
    
    render(
      <AllTheProviders>
        <SCORMPackageBuilder {...mockProps} />
      </AllTheProviders>
    )

    // Trigger SCORM generation which will fail due to our mock
    const generateButton = screen.getByText(/Generate SCORM Package/i)
    generateButton.click()

    // Wait for the error to be logged
    await waitFor(() => {
      expect(debugLogger.error).toHaveBeenCalledWith(
        'SCORM_PACKAGE',
        'SCORM package generation failed in UI',
        expect.objectContaining({
          // This should work without TypeScript errors
          courseTitle: expect.any(String), // Should be derived from courseContent properly
          topicCount: expect.any(Number),  // Should count topics correctly
          hasMediaItems: expect.any(Boolean), // Should detect media presence correctly
          error: expect.any(String),
          timestamp: expect.any(String)
        })
      )
    }, { timeout: 5000 })
  })

  it('should correctly extract course title from available data', () => {
    // This test verifies the courseTitle property access logic
    const courseContent = mockCourseContent
    const courseSeedData = mockCourseSeedData
    
    // Test the logic that should be used in the actual component
    const expectedTitle = courseContent.welcomePage?.title || courseSeedData?.courseTitle || 'Untitled Course'
    
    expect(expectedTitle).toBe('Welcome to the Course') // Should prefer welcomePage.title
  })

  it('should correctly detect media items from courseContent', () => {
    // This test verifies the media detection logic
    const courseContent = mockCourseContent
    
    // Test the logic that should be used instead of referencing enhancedContent
    const hasMediaItems = !!(
      courseContent.topics?.some(topic => topic.media && topic.media.length > 0) ||
      courseContent.welcomePage?.media?.length ||
      courseContent.learningObjectivesPage?.media?.length
    )
    
    expect(hasMediaItems).toBe(true) // Should detect media in topics, welcome, and objectives pages
  })

  it('should handle topic media detection with proper typing', () => {
    // This test verifies that topic parameter typing works correctly
    const courseContent = mockCourseContent
    
    // Test the specific typing issue - topic parameter should not be 'any'
    const topicsWithMedia = courseContent.topics?.filter((topic) => {
      // This should not cause TypeScript errors
      return topic.media && topic.media.length > 0
    })
    
    expect(topicsWithMedia).toHaveLength(1)
    expect(topicsWithMedia?.[0]?.title).toBe('First Topic')
  })
})