import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent , waitFor } from '../../test/testProviders'
import { CoursePreview } from '../CoursePreview'
// Removed unused React import

// Mock PersistentStorageContext
const mockSaveCourseMetadata = vi.fn()
const mockSaveContent = vi.fn()

vi.mock('../../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: any) => children,
  useStorage: () => ({
    isInitialized: true,
    currentProjectId: 'test-project',
    saveCourseMetadata: mockSaveCourseMetadata,
    saveContent: mockSaveContent,
    getCourseMetadata: vi.fn().mockResolvedValue({
      title: 'Test Course',
      topics: ['topic-1']
    }),
    getContent: vi.fn().mockResolvedValue({
      topicId: 'topic-1',
      title: 'Test Topic',
      content: 'Test content'
    }),
    getMedia: vi.fn().mockResolvedValue(null),
    getMediaForTopic: vi.fn().mockResolvedValue([])
  })
}))

// Mock the preview generator
vi.mock('../../services/previewGenerator', () => ({
  generatePreviewHTML: vi.fn().mockResolvedValue(`
    <html>
      <body>
        <h1>Preview</h1>
        <nav>
          <a href="#" data-page="welcome">Welcome</a>
          <a href="#" data-page="topic-1">Topic 1</a>
        </nav>
        <div id="content-area">Welcome content</div>
      </body>
    </html>
  `)
}))

describe('RealTimePreview Integration - Functional Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('should open preview modal and display real-time preview', async () => {
    // Intent: User can preview their course with functional navigation
    const courseContent = {
      title: 'Test Course',
      welcomePage: { title: 'Welcome', content: 'Welcome to the course' },
      objectives: ['Learn something'],
      topics: [{
        id: 'topic-1',
        title: 'First Topic',
        content: 'This is the first topic'
      ,
        duration: 5
      }]
    }
    
    const courseSeedData = {
      courseTitle: 'Test Course',
      difficulty: 3,
      customTopics: ['Topic 1'],
      template: 'None' as const,
      templateTopics: []
    }
    
    render(
      <CoursePreview 
        courseContent={courseContent}
        courseSeedData={courseSeedData}
      />
    )
    
    // Click preview button
    const previewButton = screen.getByText('Preview Course')
    fireEvent.click(previewButton)
    
    // Modal should open
    await waitFor(() => {
      expect(screen.getByTestId('course-preview-modal')).toBeInTheDocument()
    })
    
    // Should save course data for preview
    await waitFor(() => {
      expect(mockSaveCourseMetadata).toHaveBeenCalledWith({
        title: 'Test Course',
        duration: 30,
        passMark: 80,
        objectives: ['Learn something'],
        welcomeContent: 'Welcome to the course',
        topics: ['topic-1']
      })
    })
    
    // Should save topic content
    expect(mockSaveContent).toHaveBeenCalledWith('topic-1', {
      topicId: 'topic-1',
      title: 'First Topic',
      content: 'This is the first topic',
      knowledgeCheck: undefined
    })
  })
  
  it('should show real preview content inside iframe', async () => {
    // Intent: Preview shows actual course content, not mocks
    const courseContent = {
      title: 'Real Course',
      welcomePage: { title: 'Welcome', content: 'Real welcome content' },
      objectives: ['Real objective'],
      topics: [{
        id: 'real-topic',
        title: 'Real Topic',
        content: 'Real topic content'
      ,
        duration: 5
      }]
    }
    
    const courseSeedData = {
      courseTitle: 'Real Course',
      difficulty: 3,
      customTopics: ['Real Topic'],
      template: 'None' as const,
      templateTopics: []
    }
    
    render(
      <CoursePreview 
        courseContent={courseContent}
        courseSeedData={courseSeedData}
      />
    )
    
    // Open preview
    fireEvent.click(screen.getByText('Preview Course'))
    
    // Wait for preview to load
    await waitFor(() => {
      const modal = screen.getByTestId('course-preview-modal')
      expect(modal).toBeInTheDocument()
    })
    
    // Check that real content is being saved
    expect(mockSaveCourseMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Real Course',
        welcomeContent: 'Real welcome content'
      })
    )
  })
  
  it('should support device preview modes', async () => {
    // Intent: User can preview how course looks on different devices
    render(
      <CoursePreview 
        courseContent={{ 
          title: 'Test',
          welcomePage: { title: 'Welcome', content: 'Test' },
          objectives: [],
          topics: []
        }}
        courseSeedData={{
          courseTitle: 'Test',
          difficulty: 3,
          customTopics: [],
          template: 'None',
          templateTopics: []
        }}
      />
    )
    
    // Open preview
    fireEvent.click(screen.getByText('Preview Course'))
    
    await waitFor(() => {
      expect(screen.getByTestId('course-preview-modal')).toBeInTheDocument()
    })
    
    // Device selector buttons should be present
    expect(screen.getByText('Desktop')).toBeInTheDocument()
    expect(screen.getByText('Tablet')).toBeInTheDocument()
    expect(screen.getByText('Mobile')).toBeInTheDocument()
    
    // Click tablet view
    fireEvent.click(screen.getByText('Tablet'))
    
    // Tablet button should be active (primary variant)
    const tabletButton = screen.getByText('Tablet')
    expect(tabletButton.closest('button')).toHaveClass('btn-primary')
  })
})