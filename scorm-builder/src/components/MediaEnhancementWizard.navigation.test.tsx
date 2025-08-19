import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'

// Mock the unified media context
vi.mock('../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: any) => children,
  useUnifiedMedia: () => ({
    storeMedia: vi.fn(),
    storeYouTubeVideo: vi.fn(),
    getMedia: vi.fn(),
    deleteMedia: vi.fn(),
    getMediaForPage: vi.fn().mockReturnValue([]),
    createBlobUrl: vi.fn(),
    revokeBlobUrl: vi.fn()
  })
}))

// Mock the storage context
vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    save: vi.fn(),
    load: vi.fn(),
    listProjects: vi.fn()
  })
}))

describe('MediaEnhancementWizard - Page Navigation with Different ID Formats', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnUpdateContent = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('should navigate correctly with standard IDs (welcome, learning-objectives)', () => {
    const courseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome to Test Course',
        content: 'Welcome content',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3
      },
      learningObjectivesPage: {
        id: 'learning-objectives',
        title: 'Learning Objectives',
        content: 'Objectives content',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic One',
          content: 'Topic content',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 5
        }
      ]
    }
    
    const { container } = render(
      <UnifiedMediaProvider>
        <MediaEnhancementWizard
          courseContent={courseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
          onUpdateContent={mockOnUpdateContent}
        />
      </UnifiedMediaProvider>
    )
    
    // Should start on welcome page
    expect(screen.getByText('Welcome to Test Course')).toBeInTheDocument()
    
    // Click on learning objectives page thumbnail
    const objectivesThumbnail = container.querySelector('[data-testid="page-thumbnail-learning-objectives"]')
    expect(objectivesThumbnail).toBeInTheDocument()
    fireEvent.click(objectivesThumbnail!)
    
    // Should navigate to objectives page
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
  })
  
  it('should navigate correctly with old IDs (content-0, content-1)', () => {
    const courseContent = {
      welcomePage: {
        id: 'content-0', // Old format
        title: 'Welcome to Test Course',
        content: 'Welcome content',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3
      },
      learningObjectivesPage: {
        id: 'content-1', // Old format
        title: 'Learning Objectives',
        content: 'Objectives content',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic One',
          content: 'Topic content',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 5
        }
      ]
    }
    
    const { container } = render(
      <UnifiedMediaProvider>
        <MediaEnhancementWizard
          courseContent={courseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
          onUpdateContent={mockOnUpdateContent}
        />
      </UnifiedMediaProvider>
    )
    
    // Should start on welcome page
    expect(screen.getByText('Welcome to Test Course')).toBeInTheDocument()
    
    // Click on learning objectives page thumbnail
    const objectivesThumbnail = container.querySelector('[data-testid="page-thumbnail-content-1"]')
    expect(objectivesThumbnail).toBeInTheDocument()
    fireEvent.click(objectivesThumbnail!)
    
    // Should navigate to objectives page
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
  })
  
  it('should navigate correctly with mixed ID formats', () => {
    const courseContent = {
      welcomePage: {
        id: 'content-0', // Old format
        title: 'Welcome to Test Course',
        content: 'Welcome content',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3
      },
      learningObjectivesPage: {
        id: 'learning-objectives', // New format
        title: 'Learning Objectives',
        content: 'Objectives content',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 3
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic One',
          content: 'Topic content',
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          duration: 5
        }
      ]
    }
    
    const { container } = render(
      <UnifiedMediaProvider>
        <MediaEnhancementWizard
          courseContent={courseContent}
          onNext={mockOnNext}
          onBack={mockOnBack}
          onUpdateContent={mockOnUpdateContent}
        />
      </UnifiedMediaProvider>
    )
    
    // Click on welcome page thumbnail
    const welcomeThumbnail = container.querySelector('[data-testid="page-thumbnail-content-0"]')
    expect(welcomeThumbnail).toBeInTheDocument()
    fireEvent.click(welcomeThumbnail!)
    
    // Should be on welcome page
    expect(screen.getByText('Welcome to Test Course')).toBeInTheDocument()
    
    // Click on objectives page
    const objectivesThumbnail = container.querySelector('[data-testid="page-thumbnail-learning-objectives"]')
    expect(objectivesThumbnail).toBeInTheDocument()
    fireEvent.click(objectivesThumbnail!)
    
    // Should navigate to objectives page
    expect(screen.getByText('Learning Objectives')).toBeInTheDocument()
  })
})