import { describe, it, expect, vi } from 'vitest'
import { generatePreviewHTML } from '../../services/previewGenerator'

describe('Preview Navigation - Functional Tests', () => {
  it('should generate preview with functional navigation', async () => {
    // Intent: Preview navigation works within the iframe
    const courseContent = {
      title: 'Test Course',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear' as const,
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the course',
        startButtonText: 'Start',
        media: []
      },
      objectives: ['Learn navigation'],
      learningObjectivesPage: {
        title: 'Objectives',
        content: ''
      },
      topics: [
        {
          id: 'topic-1',
          title: 'First Topic',
          content: 'This is the first topic',
          media: []
        },
        {
          id: 'topic-2',
          title: 'Second Topic',
          content: 'This is the second topic',
          media: []
        }
      ],
      assessment: {
        questions: []
      }
    }
    
    const html = await generatePreviewHTML(courseContent)
    
    // Check that navigation elements are present
    expect(html).toContain('nav-welcome')
    expect(html).toContain('nav-objectives')
    expect(html).toContain('nav-topic-1')
    expect(html).toContain('nav-topic-2')
    expect(html).toContain('nav-assessment')
    
    // Check navigation functions
    expect(html).toContain('function loadPage(pageId)')
    expect(html).toContain('function navigateNext()')
    expect(html).toContain('function navigatePrevious()')
    
    // Check that content for all pages is embedded
    expect(html).toContain('content-welcome')
    expect(html).toContain('content-objectives')
    expect(html).toContain('content-topic-1')
    expect(html).toContain('content-topic-2')
    expect(html).toContain('content-assessment')
    
    // Check that navigation buttons are present
    expect(html).toContain('prev-btn')
    expect(html).toContain('next-btn')
    
    // Verify navigation click handlers
    expect(html).toContain('onclick="navigatePrevious()"')
    expect(html).toContain('onclick="navigateNext()"')
    
    // Check sidebar navigation click handlers
    expect(html).toContain('data-page="welcome"')
    expect(html).toContain('data-page="topic-1"')
    
    // Verify the content switching logic
    expect(html).toContain('contentArea.innerHTML = content.innerHTML')
  })
  
  it('should include all topic content in the preview', async () => {
    // Intent: All course content is available for navigation
    const courseContent = {
      title: 'Content Test',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear' as const,
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome content here',
        startButtonText: 'Start',
        media: []
      },
      objectives: ['Objective 1', 'Objective 2'],
      learningObjectivesPage: {
        title: 'Objectives',
        content: ''
      },
      topics: [
        {
          id: 'unique-topic',
          title: 'Unique Topic Title',
          content: 'Unique content that should appear in preview',
          media: [],
          knowledgeCheck: {
            question: 'Test question?',
            options: ['Option A', 'Option B'],
            correctAnswer: 0
          }
        }
      ],
      assessment: {
        questions: []
      }
    }
    
    const html = await generatePreviewHTML(courseContent)
    
    // Verify specific content is included
    expect(html).toContain('Welcome content here')
    expect(html).toContain('Unique Topic Title')
    expect(html).toContain('Unique content that should appear in preview')
    
    // Verify objectives are included
    expect(html).toContain('Objective 1')
    expect(html).toContain('Objective 2')
    
    // Verify knowledge check is included
    expect(html).toContain('Test question?')
    expect(html).toContain('Option A')
    expect(html).toContain('Option B')
  })
  
  it('should initialize preview on the welcome page', async () => {
    // Intent: Preview starts on welcome page like real course
    const courseContent = {
      title: 'Init Test',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear' as const,
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Start here',
        startButtonText: 'Start',
        media: []
      },
      objectives: [],
      learningObjectivesPage: {
        title: 'Objectives',
        content: ''
      },
      topics: [],
      assessment: {
        questions: []
      }
    }
    
    const html = await generatePreviewHTML(courseContent)
    
    // Check initialization code
    expect(html).toContain("loadPage('welcome')")
    expect(html).toContain("currentPage = 'welcome'")
    
    // Check that welcome nav item starts as active
    expect(html).toContain('class="nav-item active" id="nav-welcome"')
  })
})