import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useProjectData } from '../useProjectData'
import { CourseSeedData } from '../../types/course'
import { CourseContent } from '../../types/aiPrompt'

// Don't mock Date globally as the hook uses new Date() inside useMemo

describe('useProjectData', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 4,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'Technology',
    templateTopics: ['React', 'TypeScript']
  }

  const mockCourseContent: CourseContent = {
    title: 'Test Course Content',
    pages: [
      {
        id: 'page-1',
        title: 'Introduction',
        content: '<p>Welcome to the course</p>',
        narration: 'Welcome to the course'
      }
    ]
  }

  describe('Default values', () => {
    it('should return default project data when courseSeedData is null', () => {
      const { result } = renderHook(() => 
        useProjectData({
          courseSeedData: null,
          courseContent: null,
          currentStep: 'seed'
        })
      )

      expect(result.current).toEqual({
        courseTitle: '',
        courseSeedData: {
          courseTitle: '',
          difficulty: 3,
          customTopics: [],
          template: 'None',
          templateTopics: []
        },
        currentStep: 0,
        lastModified: expect.any(String),
        mediaFiles: {},
        audioFiles: {}
      })
    })
  })

  describe('With course seed data', () => {
    it('should return project data with courseSeedData', () => {
      const { result } = renderHook(() => 
        useProjectData({
          courseSeedData: mockCourseSeedData,
          courseContent: null,
          currentStep: 'seed'
        })
      )

      expect(result.current).toEqual({
        courseTitle: 'Test Course',
        courseSeedData: mockCourseSeedData,
        courseContent: undefined,
        currentStep: 0,
        lastModified: expect.any(String),
        mediaFiles: {},
        audioFiles: {}
      })
    })

    it('should include courseContent when provided', () => {
      const { result } = renderHook(() => 
        useProjectData({
          courseSeedData: mockCourseSeedData,
          courseContent: mockCourseContent,
          currentStep: 'json'
        })
      )

      expect(result.current).toEqual({
        courseTitle: 'Test Course',
        courseSeedData: mockCourseSeedData,
        courseContent: mockCourseContent,
        currentStep: 2,
        lastModified: expect.any(String),
        mediaFiles: {},
        audioFiles: {}
      })
    })
  })

  describe('Step mapping', () => {
    it('should map step names to numbers correctly', () => {
      const steps = [
        { name: 'seed', number: 0 },
        { name: 'prompt', number: 1 },
        { name: 'json', number: 2 },
        { name: 'media', number: 3 },
        { name: 'audio', number: 4 },
        { name: 'activities', number: 5 },
        { name: 'scorm', number: 6 }
      ]

      steps.forEach(({ name, number }) => {
        const { result } = renderHook(() => 
          useProjectData({
            courseSeedData: mockCourseSeedData,
            courseContent: null,
            currentStep: name
          })
        )

        expect(result.current.currentStep).toBe(number)
      })
    })

    it('should handle unknown step names', () => {
      const { result } = renderHook(() => 
        useProjectData({
          courseSeedData: mockCourseSeedData,
          courseContent: null,
          currentStep: 'unknown-step'
        })
      )

      // Should return undefined for unknown steps
      expect(result.current.currentStep).toBeUndefined()
    })
  })

  describe('Memoization', () => {
    it('should memoize result when inputs do not change', () => {
      const { result, rerender } = renderHook(
        ({ courseSeedData, courseContent, currentStep }) => 
          useProjectData({ courseSeedData, courseContent, currentStep }),
        {
          initialProps: {
            courseSeedData: mockCourseSeedData,
            courseContent: mockCourseContent,
            currentStep: 'json'
          }
        }
      )

      const firstResult = result.current

      // Rerender with same props
      rerender({
        courseSeedData: mockCourseSeedData,
        courseContent: mockCourseContent,
        currentStep: 'json'
      })

      expect(result.current).toBe(firstResult) // Same reference
    })

    it('should create new object when inputs change', () => {
      const { result, rerender } = renderHook(
        ({ courseSeedData, courseContent, currentStep }) => 
          useProjectData({ courseSeedData, courseContent, currentStep }),
        {
          initialProps: {
            courseSeedData: mockCourseSeedData,
            courseContent: mockCourseContent,
            currentStep: 'json'
          }
        }
      )

      const firstResult = result.current

      // Change currentStep
      rerender({
        courseSeedData: mockCourseSeedData,
        courseContent: mockCourseContent,
        currentStep: 'media'
      })

      expect(result.current).not.toBe(firstResult) // Different reference
      expect(result.current.currentStep).toBe(3)
    })
  })

  describe('Edge cases', () => {
    it('should handle partial courseSeedData', () => {
      const partialSeedData: CourseSeedData = {
        courseTitle: 'Partial Course',
        difficulty: 1,
        customTopics: [],
        template: 'None',
        templateTopics: []
      }

      const { result } = renderHook(() => 
        useProjectData({
          courseSeedData: partialSeedData,
          courseContent: null,
          currentStep: 'seed'
        })
      )

      expect(result.current.courseTitle).toBe('Partial Course')
      expect(result.current.courseSeedData).toEqual(partialSeedData)
    })

    it('should handle empty strings in courseSeedData', () => {
      const emptySeedData: CourseSeedData = {
        courseTitle: '',
        difficulty: 3,
        customTopics: [],
        template: 'None',
        templateTopics: []
      }

      const { result } = renderHook(() => 
        useProjectData({
          courseSeedData: emptySeedData,
          courseContent: null,
          currentStep: 'seed'
        })
      )

      expect(result.current.courseTitle).toBe('')
      expect(result.current.courseSeedData).toEqual(emptySeedData)
    })

    it('should always return empty objects for mediaFiles and audioFiles', () => {
      const { result } = renderHook(() => 
        useProjectData({
          courseSeedData: mockCourseSeedData,
          courseContent: mockCourseContent,
          currentStep: 'media'
        })
      )

      expect(result.current.mediaFiles).toEqual({})
      expect(result.current.audioFiles).toEqual({})
    })

    it('should always generate lastModified as ISO string', () => {
      const { result } = renderHook(() => 
        useProjectData({
          courseSeedData: mockCourseSeedData,
          courseContent: null,
          currentStep: 'seed'
        })
      )

      // Check that lastModified is a valid ISO date string
      expect(result.current.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      
      // Verify it can be parsed as a valid date
      const date = new Date(result.current.lastModified)
      expect(date.toString()).not.toBe('Invalid Date')
    })
  })

  describe('Integration scenarios', () => {
    it('should handle complete course creation flow', () => {
      const { result, rerender } = renderHook(
        ({ courseSeedData, courseContent, currentStep }) => 
          useProjectData({ courseSeedData, courseContent, currentStep }),
        {
          initialProps: {
            courseSeedData: null,
            courseContent: null,
            currentStep: 'seed'
          }
        }
      )

      // Initial state
      expect(result.current.courseTitle).toBe('')
      expect(result.current.currentStep).toBe(0)

      // User enters course seed data
      rerender({
        courseSeedData: mockCourseSeedData,
        courseContent: null,
        currentStep: 'prompt'
      })

      expect(result.current.courseTitle).toBe('Test Course')
      expect(result.current.currentStep).toBe(1)

      // AI generates content
      rerender({
        courseSeedData: mockCourseSeedData,
        courseContent: mockCourseContent,
        currentStep: 'json'
      })

      expect(result.current.courseContent).toEqual(mockCourseContent)
      expect(result.current.currentStep).toBe(2)

      // User progresses through steps
      rerender({
        courseSeedData: mockCourseSeedData,
        courseContent: mockCourseContent,
        currentStep: 'scorm'
      })

      expect(result.current.currentStep).toBe(6)
    })
  })
})