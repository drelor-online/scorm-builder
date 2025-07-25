import { generateProgressivePreviewHTML } from '../progressivePreviewGenerator'
import type { CourseContent } from '../../types/aiPrompt'
import type { CourseSeedData } from '../../types/course'

describe('progressivePreviewGenerator', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
    template: 'None' as const,
    templateTopics: []
  }

  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: '<h2>Welcome to Test Course</h2><p>Real welcome content</p>',
      narration: 'Real welcome narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<h2>Learning Objectives</h2><ul><li>Real objective 1</li></ul>',
      narration: 'Real objectives narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 3
    },
    topics: [
      {
        id: 'topic1',
        title: 'Topic 1',
        content: '<h2>Topic 1</h2><p>Real topic content</p>',
        narration: 'Real topic narration',
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
          type: 'multiple-choice' as const,
          question: 'Test question?',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 'A',
          feedback: {
            correct: 'Correct!',
            incorrect: 'Test explanation'
          }
        }
      ],
      passMark: 80,
      narration: null
    }
  }

  it('should use mock data when courseContent is null', async () => {
    const html = await generateProgressivePreviewHTML(null, mockCourseSeedData, 'welcome')
    
    expect(html).toContain('Welcome to Test Course!')
    expect(html).toContain('Preview Mode - Using Template Content')
    expect(html).toContain('Difficulty Level:</strong> 3/5')
  })

  it('should use real data when courseContent is provided', async () => {
    const html = await generateProgressivePreviewHTML(mockCourseContent, mockCourseSeedData, 'welcome')
    
    expect(html).toContain('Welcome to Test Course')
    expect(html).toContain('Real welcome content')
    expect(html).not.toContain('Preview Mode - Using Template Content')
  })

  it('should handle topic pages with mock data', async () => {
    const html = await generateProgressivePreviewHTML(null, mockCourseSeedData, 'topic-0')
    
    expect(html).toContain('Topic 1')
    expect(html).toContain('Preview Mode - Using Template Content')
    expect(html).toContain('This section covers important concepts')
  })

  it('should handle topic pages with real data', async () => {
    const html = await generateProgressivePreviewHTML(mockCourseContent, mockCourseSeedData, 'topic-0')
    
    expect(html).toContain('Topic 1')
    expect(html).toContain('Real topic content')
    expect(html).not.toContain('Preview Mode - Using Template Content')
  })

  it('should handle assessment page with mock data', async () => {
    const html = await generateProgressivePreviewHTML(null, mockCourseSeedData, 'assessment')
    
    expect(html).toContain('Knowledge Check')
    expect(html).toContain('Preview Mode - Using Template Content')
    expect(html).toContain('Assessment questions will appear here')
  })

  it('should handle assessment page with real data', async () => {
    const html = await generateProgressivePreviewHTML(mockCourseContent, mockCourseSeedData, 'assessment')
    
    expect(html).toContain('Assessment')
    expect(html).toContain('Test question?')
    expect(html).toContain('Option A')
    expect(html).not.toContain('Preview Mode - Using Template Content')
  })

  it('should handle partial courseContent gracefully', async () => {
    const partialContent: Partial<CourseContent> = {
      welcomePage: mockCourseContent.welcomePage,
      // Missing other pages
    }
    
    const html = await generateProgressivePreviewHTML(partialContent as CourseContent, mockCourseSeedData, 'objectives')
    
    expect(html).toContain('Learning Objectives')
    expect(html).toContain('Preview Mode - Using Template Content')
  })

  it('should calculate progress correctly', async () => {
    // Use partial content to ensure progressive generator is used
    const partialContent = {
      ...mockCourseContent,
      topics: [] // Empty topics to avoid triggering regular generator
    }
    const html = await generateProgressivePreviewHTML(partialContent as CourseContent, mockCourseSeedData, 'topic-0')
    
    // Topic 0 is page 3 of 6 (welcome, objectives, topic-0, topic-1, topic-2, assessment)
    // With 3 topics, we have 6 total pages. Topic-0 is page 3 (index 2).
    // Progress should be (2/5) * 100 = 40%
    expect(html).toMatch(/width:\s*40%/)
  })

  it('should handle navigation correctly', async () => {
    // First page should have previous disabled
    const firstPage = await generateProgressivePreviewHTML(null, mockCourseSeedData, 'welcome')
    expect(firstPage).toMatch(/onclick="window\.parent\.postMessage\('previous', '\*'\)"[\s\S]*?disabled/)
    
    // Last page should have next disabled
    const lastPage = await generateProgressivePreviewHTML(null, mockCourseSeedData, 'assessment')
    expect(lastPage).toMatch(/onclick="window\.parent\.postMessage\('next', '\*'\)"[\s\S]*?disabled/)
  })

  it('should sanitize user content', async () => {
    const maliciousContent: CourseContent = {
      ...mockCourseContent,
      welcomePage: {
        ...mockCourseContent.welcomePage,
        content: '<script>alert("XSS")</script><h2>Welcome</h2>'
      },
      topics: [] // Empty to use progressive generator
    }
    
    const html = await generateProgressivePreviewHTML(maliciousContent, mockCourseSeedData, 'welcome')
    
    // Check that script tags are not rendered as executable scripts
    expect(html).not.toMatch(/<script[^>]*>.*<\/script>/)
    expect(html).toContain('Welcome')
  })
})