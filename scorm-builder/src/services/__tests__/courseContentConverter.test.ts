import { describe, it, expect } from 'vitest'
import { convertToEnhancedCourseContent } from '../courseContentConverter'
import type { CourseContent, LegacyCourseContent } from '../types/aiPrompt'
import type { CourseMetadata } from '../types/metadata'

describe('Course Content Converter', () => {
  it('should convert basic course content to enhanced format', () => {
    // RED: This test will fail because the function doesn't exist yet
    const metadata: CourseMetadata = {
      title: 'Test Course',
      identifier: 'test-course-001',
      description: 'A test course',
      version: '1.0',
      scormVersion: '1.2',
      duration: 30,
      passMark: 80
    }
    
    const courseContent: LegacyCourseContent = {
      topics: [
        {
          id: 'topic-1',
          title: 'Introduction',
          content: 'Welcome to the course',
          bulletPoints: ['Point 1', 'Point 2'],
          narration: [
            { id: 'n1', text: 'Welcome narration', blockNumber: '0001' }
          ],
          imageKeywords: ['welcome'],
          imagePrompts: ['Welcome image'],
          duration: 5
        }
      ],
      activities: [],
      quiz: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'Test question?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'C'
          }
        ],
        passMark: 80
      }
    }
    
    const enhanced = convertToEnhancedCourseContent(courseContent, metadata)
    
    expect(enhanced.title).toBe('Test Course')
    expect(enhanced.duration).toBe(30)
    expect(enhanced.passMark).toBe(80)
    expect(enhanced.welcome).toBeDefined()
    expect(enhanced.objectives).toHaveLength(0) // No objectives in basic content
    expect(enhanced.topics).toHaveLength(1)
    expect(enhanced.assessment.questions).toHaveLength(1)
  })

  it('should convert narration to audio file references', () => {
    // RED: This test will fail because narration conversion doesn't exist yet
    const metadata: CourseMetadata = {
      title: 'Audio Test',
      identifier: 'audio-test',
      description: 'Testing audio conversion',
      version: '1.0',
      scormVersion: '1.2',
      duration: 20,
      passMark: 75
    }
    
    const courseContent: LegacyCourseContent = {
      topics: [
        {
          id: 'topic-1',
          title: 'Topic with Audio',
          content: 'Content here',
          bulletPoints: [],
          narration: [
            { id: 'n1', text: 'First narration block', blockNumber: '0001' },
            { id: 'n2', text: 'Second narration block', blockNumber: '0002' }
          ],
          imageKeywords: [],
          imagePrompts: [],
          duration: 10
        }
      ],
      activities: [],
      quiz: { questions: [], passMark: 75 }
    }
    
    const enhanced = convertToEnhancedCourseContent(courseContent, metadata)
    
    expect(enhanced.topics[0].audioFile).toBe('audio-2.mp3')
    expect(enhanced.topics[0].captionFile).toBe('caption-2.vtt')
  })

  it('should convert activities to knowledge checks', () => {
    // RED: This test will fail because activity conversion doesn't exist yet
    const metadata: CourseMetadata = {
      title: 'Activity Test',
      identifier: 'activity-test',
      description: 'Testing activity conversion',
      version: '1.0',
      scormVersion: '1.2',
      duration: 25,
      passMark: 80
    }
    
    const courseContent: LegacyCourseContent = {
      topics: [
        {
          id: 'topic-1',
          title: 'Topic with Activity',
          content: 'Learn this',
          bulletPoints: [],
          narration: [],
          imageKeywords: [],
          imagePrompts: [],
          duration: 5
        }
      ],
      activities: [
        {
          id: 'act-1',
          type: 'multiple-choice',
          title: 'Check Your Understanding',
          instructions: 'What did you learn?',
          content: {
            question: 'What did you learn?',
            options: ['Option A', 'Option B', 'Option C'],
            correctAnswer: 'Option B'
          } as any
        }
      ],
      quiz: { questions: [], passMark: 80 }
    }
    
    const enhanced = convertToEnhancedCourseContent(courseContent, metadata)
    
    expect(enhanced.topics[0].knowledgeCheck).toBeDefined()
    expect(enhanced.topics[0].knowledgeCheck?.question).toBe('What did you learn?')
    expect(enhanced.topics[0].knowledgeCheck?.options).toHaveLength(3)
    expect(enhanced.topics[0].knowledgeCheck?.correctAnswer).toBe(1)
  })

  it('should handle image prompts and create image references', () => {
    // RED: This test will fail because image handling doesn't exist yet
    const metadata: CourseMetadata = {
      title: 'Image Test',
      identifier: 'image-test',
      description: 'Testing image handling',
      version: '1.0',
      scormVersion: '1.2',
      duration: 15,
      passMark: 70
    }
    
    const courseContent: LegacyCourseContent = {
      topics: [
        {
          id: 'topic-1',
          title: 'Topic with Images',
          content: 'Visual content',
          bulletPoints: [],
          narration: [],
          imageKeywords: ['safety', 'equipment'],
          imagePrompts: ['Show safety equipment in use'],
          duration: 5
        }
      ],
      activities: [],
      quiz: { questions: [], passMark: 70 }
    }
    
    const enhanced = convertToEnhancedCourseContent(courseContent, metadata)
    
    expect(enhanced.topics[0].imageUrl).toBe('image-0.jpg')
  })
})

describe('Course Content Converter - New Format', () => {
  const metadata: CourseMetadata = {
    title: 'Test Course',
    identifier: 'test-course-001',
    description: 'A test course',
    version: '1.0',
    scormVersion: '1.2',
    duration: 30,
    passMark: 80
  }

  it('should convert welcomePage from new format', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome to Safety Training',
        content: '<h1>Welcome!</h1><p>This course covers safety basics.</p>',
        narration: 'Welcome to this safety training course.',
        imageKeywords: ['welcome', 'safety'],
        imagePrompts: ['Modern workplace safety welcome image'],
        videoSearchTerms: ['safety training introduction'],
        duration: 2
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<h2>Learning Objectives</h2><ul><li>Understand safety basics</li></ul>',
        narration: 'By the end of this course, you will understand key safety concepts.',
        imageKeywords: ['objectives'],
        imagePrompts: ['Learning objectives illustration'],
        videoSearchTerms: ['course objectives'],
        duration: 3
      },
      topics: [],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    const enhanced = convertToEnhancedCourseContent(courseContent, metadata)
    
    expect(enhanced.welcome.title).toBe('Welcome to Safety Training')
    expect(enhanced.welcome.content).toContain('This course covers safety basics')
  })

  it('should extract objectives from learningObjectivesPage', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<h1>Welcome!</h1>',
        narration: 'Welcome',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<h2>Learning Objectives</h2><ul><li>Understand safety procedures</li><li>Identify workplace hazards</li><li>Apply emergency protocols</li></ul>',
        narration: 'Here are your learning objectives',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 2
      },
      topics: [],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    const enhanced = convertToEnhancedCourseContent(courseContent, metadata)
    
    expect(enhanced.objectives).toHaveLength(3)
    expect(enhanced.objectives).toContain('Understand safety procedures')
    expect(enhanced.objectives).toContain('Identify workplace hazards')
    expect(enhanced.objectives).toContain('Apply emergency protocols')
  })

  it('should convert topics with single narration string', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<h1>Welcome!</h1>',
        narration: 'Welcome',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '<h2>Objectives</h2>',
        narration: 'Objectives',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      topics: [{
        id: 'topic-1',
        title: 'Safety Fundamentals',
        content: '<h2>Safety Basics</h2><p>Always wear protective equipment.</p>',
        narration: 'Safety is our top priority. Always wear your protective equipment.',
        imageKeywords: ['safety', 'ppe'],
        imagePrompts: ['Worker wearing safety equipment'],
        videoSearchTerms: ['safety equipment tutorial'],
        duration: 5,
        knowledgeCheck: {
          questions: [{
            id: 'kc1',
            type: 'multiple-choice',
            question: 'What should you always wear?',
            options: ['Hat', 'PPE', 'Sunglasses', 'Watch'],
            correctAnswer: 'PPE'
          }]
        }
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    const enhanced = convertToEnhancedCourseContent(courseContent, metadata)
    
    expect(enhanced.topics).toHaveLength(1)
    expect(enhanced.topics[0].content).toContain('Safety Basics')
    expect(enhanced.topics[0].audioFile).toBe('audio-2.mp3')
    expect(enhanced.topics[0].captionFile).toBe('caption-2.vtt')
  })

  it('should convert knowledge checks from new format', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<h1>Welcome!</h1>',
        narration: 'Welcome',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '<h2>Objectives</h2>',
        narration: 'Objectives',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      topics: [{
        id: 'topic-1',
        title: 'Test Topic',
        content: '<p>Content</p>',
        narration: 'Narration text',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5,
        knowledgeCheck: {
          questions: [
            {
              id: 'kc1',
              type: 'multiple-choice',
              question: 'What is the answer?',
              options: ['A', 'B', 'C', 'D'],
              correctAnswer: 'B'
            },
            {
              id: 'kc2',
              type: 'true-false',
              question: 'Is this true?',
              correctAnswer: 'true'
            },
            {
              id: 'kc3',
              type: 'fill-in-the-blank',
              question: 'Fill in the blank',
              blank: 'The _____ is important',
              correctAnswer: 'safety'
            }
          ]
        }
      }],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }

    const enhanced = convertToEnhancedCourseContent(courseContent, metadata)
    
    // When there are multiple knowledge check questions, they are kept in questions array
    expect(enhanced.topics[0].knowledgeCheck).toBeDefined()
    expect(enhanced.topics[0].knowledgeCheck?.questions).toBeDefined()
    expect(enhanced.topics[0].knowledgeCheck?.questions).toHaveLength(3)
    expect(enhanced.topics[0].knowledgeCheck?.questions?.[0].question).toBe('What is the answer?')
    expect(enhanced.topics[0].knowledgeCheck?.questions?.[0].correctAnswer).toBe('B') // Kept as string
  })

  it('should convert assessment from new format', () => {
    const courseContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<h1>Welcome!</h1>',
        narration: 'Welcome',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '<h2>Objectives</h2>',
        narration: 'Objectives',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      topics: [],
      assessment: {
        questions: [
          {
            id: 'q1',
            type: 'multiple-choice',
            question: 'What is safety?',
            options: ['Important', 'Optional', 'Unnecessary', 'Boring'],
            correctAnswer: 'Important',
            feedback: {
              correct: 'Correct! Safety is very important.',
              incorrect: 'Incorrect. Safety is always important.'
            }
          },
          {
            id: 'q2',
            type: 'true-false',
            question: 'PPE is optional.',
            correctAnswer: 'false',
            feedback: {
              correct: 'Correct! PPE is mandatory.',
              incorrect: 'Incorrect. PPE is always required.'
            }
          }
        ],
        passMark: 80,
        narration: null
      }
    }

    const enhanced = convertToEnhancedCourseContent(courseContent, metadata)
    
    expect(enhanced.assessment.questions).toHaveLength(2)
    expect(enhanced.assessment.questions[0].question).toBe('What is safety?')
    expect(enhanced.assessment.questions[0].correctAnswer).toBe(0) // Index of 'Important'
    expect(enhanced.assessment.questions[1].question).toBe('PPE is optional.')
    expect(enhanced.assessment.questions[1].options).toEqual(['True', 'False'])
    expect(enhanced.assessment.questions[1].correctAnswer).toBe(1) // Index of 'False'
  })

  it('should handle both old and new format (using type guards)', () => {
    // Test with old format
    const oldContent = {
      topics: [{
        id: 'topic-1',
        title: 'Old Format Topic',
        content: 'Content',
        bulletPoints: ['Point 1'],
        narration: [{ id: 'n1', text: 'Narration', blockNumber: '0001' ,
        duration: 5
      }],
        imageKeywords: [],
        imagePrompts: [],
        duration: 5
      }],
      activities: [],
      quiz: {
        questions: [{
          id: 'q1',
          type: 'multiple-choice' as const,
          question: 'Question?',
          options: ['A', 'B'],
          correctAnswer: 'A'
        }],
        passMark: 80
      }
    } as LegacyCourseContent

    const enhancedOld = convertToEnhancedCourseContent(oldContent as any, metadata)
    expect(enhancedOld.topics).toHaveLength(1)
    expect(enhancedOld.assessment.questions).toHaveLength(1)

    // Test with new format
    const newContent: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<h1>Welcome!</h1>',
        narration: 'Welcome',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Objectives',
        content: '<h2>Objectives</h2>',
        narration: 'Objectives',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 1
      },
      topics: [{
        id: 'topic-1',
        title: 'New Format Topic',
        content: '<p>Content</p>',
        narration: 'Single narration',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 5
      }],
      assessment: {
        questions: [{
          id: 'q1',
          type: 'multiple-choice',
          question: 'Question?',
          options: ['A', 'B'],
          correctAnswer: 'A',
          feedback: { correct: 'Good!', incorrect: 'Try again' }
        }],
        passMark: 80,
        narration: null
      }
    }

    const enhancedNew = convertToEnhancedCourseContent(newContent, metadata)
    expect(enhancedNew.topics).toHaveLength(1)
    expect(enhancedNew.assessment.questions).toHaveLength(1)
  })
})