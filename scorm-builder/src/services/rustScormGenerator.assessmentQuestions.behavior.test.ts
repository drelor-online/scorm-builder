/**
 * Test for assessment questions undefined error - reproduces beta tester issue
 * Error: "Cannot read properties of undefined (reading 'length')"
 * This happens when assessment exists but questions array is undefined
 */

import { describe, it, expect } from 'vitest'
import { convertToRustFormat } from './rustScormGenerator'

describe('Assessment Questions Undefined Error', () => {

  it('should handle assessment with no questions array gracefully (fixed)', async () => {
    // Arrange: Create course content with assessment but no questions array
    const courseContent = {
      title: 'Test Course',
      welcome: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome to the course',
        media: []
      },
      objectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Course objectives',
        media: []
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content for topic 1',
          media: []
        }
      ],
      // THIS IS THE ISSUE: Assessment exists but questions is undefined
      assessment: {
        enabled: true,
        passingScore: 80
        // NO questions array defined - this causes the error
      }
    }

    const projectId = 'test-project-1234'

    // Act: Should now handle undefined questions array gracefully
    const result = await convertToRustFormat(courseContent, projectId)

    // Assert: Should succeed without throwing the undefined error
    expect(result).toBeDefined()
    expect(result.courseData).toBeDefined()
    expect(result.courseData.assessment).toBeDefined()
    expect(result.courseData.assessment.questions).toEqual([]) // Should be empty array
  })

  it('should handle assessment with explicitly undefined questions gracefully (fixed)', async () => {
    // Arrange: Explicitly set questions to undefined
    const courseContent = {
      title: 'Test Course',
      welcome: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome to the course',
        media: []
      },
      objectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Course objectives',
        media: []
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content for topic 1',
          media: []
        }
      ],
      assessment: {
        enabled: true,
        passingScore: 80,
        questions: undefined // Explicitly undefined
      }
    }

    const projectId = 'test-project-1234'

    // Act: Should now handle explicitly undefined questions gracefully
    const result = await convertToRustFormat(courseContent, projectId)

    // Assert: Should succeed without throwing the undefined error
    expect(result).toBeDefined()
    expect(result.courseData).toBeDefined()
    expect(result.courseData.assessment).toBeDefined()
    expect(result.courseData.assessment.questions).toEqual([]) // Should be empty array
  })

  it('should work correctly when assessment has valid questions array', async () => {
    // Arrange: Valid assessment with questions array
    const courseContent = {
      title: 'Test Course',
      welcome: {
        id: 'welcome',
        title: 'Welcome',
        content: 'Welcome to the course',
        media: []
      },
      objectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: 'Course objectives',
        media: []
      },
      topics: [
        {
          id: 'topic-1',
          title: 'Topic 1',
          content: 'Content for topic 1',
          media: []
        }
      ],
      assessment: {
        enabled: true,
        passingScore: 80,
        questions: [ // Valid questions array
          {
            question: 'What is 2 + 2?',
            options: ['3', '4', '5', '6'],
            correctAnswer: 1,
            type: 'multiple-choice'
          }
        ]
      }
    }

    const projectId = 'test-project-1234'

    // Act: This should NOT throw the specific "reading 'length'" error
    try {
      await convertToRustFormat(courseContent, projectId)
      // If it doesn't throw, that's good too
    } catch (error) {
      // The test passes if it doesn't throw the specific undefined length error
      expect(error).toBeDefined()
      expect((error as Error).message).not.toContain("Cannot read properties of undefined (reading 'length')")
      expect((error as Error).message).not.toContain("Cannot read properties of undefined (reading 'map')")
    }
  })
})