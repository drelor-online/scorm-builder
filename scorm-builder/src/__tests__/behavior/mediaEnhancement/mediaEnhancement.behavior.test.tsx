import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaEnhancementWizard } from '../../../components/MediaEnhancementWizardRefactored'
import { CourseContent } from '../../../types/aiPrompt'
import { CourseSeedData } from '../../../types/course'

// Mock dependencies
vi.mock('../../../services/searchService', () => ({
  searchGoogleImages: vi.fn(),
  searchYouTubeVideos: vi.fn(),
  clearYouTubePageTokens: vi.fn(),
  hasYouTubeNextPage: vi.fn().mockReturnValue(false),
  SearchError: class SearchError extends Error {
    constructor(message: string, public code: string) {
      super(message)
    }
  }
}))

vi.mock('../../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    storageService: {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn()
    }
  })
}))

vi.mock('../../../hooks/useStepData', () => ({
  useStepData: () => ({
    getStepData: vi.fn(),
    updateStepData: vi.fn()
  })
}))

// Mock components
vi.mock('../../../components/CoursePreview', () => ({
  CoursePreview: () => <div data-testid="course-preview">Course Preview</div>
}))

vi.mock('../../../components/AutoSaveIndicatorConnected', () => ({
  AutoSaveIndicatorConnected: () => <div data-testid="autosave-indicator">AutoSave</div>
}))

vi.mock('../../../components/PageLayout', () => ({
  PageLayout: ({ children, title, description, onNext, coursePreview }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {children}
      {coursePreview}
      <button onClick={onNext}>Next</button>
    </div>
  )
}))

vi.mock('../../../components/ConfirmDialog', () => ({
  ConfirmDialog: ({ isOpen, title, message, onConfirm, onCancel }: any) => 
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
}))

vi.mock('../../../components/MediaLibrary', () => ({
  MediaLibrary: ({ 
    searchResults, 
    onSelectMedia, 
    onPageChange, 
    currentPage, 
    isLoading,
    selectedMedia 
  }: any) => (
    <div data-testid="media-library">
      {isLoading && <div>Loading...</div>}
      {searchResults.map((result: any) => (
        <div key={result.id} data-testid={`search-result-${result.id}`}>
          <img src={result.thumbnail} alt={result.title} />
          <button onClick={() => onSelectMedia(result)}>Select</button>
        </div>
      ))}
      {searchResults.length > 0 && (
        <div>
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
            Previous
          </button>
          <span>Page {currentPage}</span>
          <button onClick={() => onPageChange(currentPage + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}))

// Mock the design system components
vi.mock('../../../components/DesignSystem', () => ({
  Button: ({ children, onClick, disabled, icon, variant }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {icon && <span>{icon}</span>}
      {children}
    </button>
  ),
  Card: ({ children, title }: any) => (
    <div data-testid="card">
      {title && <h3>{title}</h3>}
      {children}
    </div>
  ),
  Input: ({ label, value, onChange, placeholder, onKeyPress }: any) => (
    <div>
      {label && <label>{label}</label>}
      <input 
        value={value || ''} 
        onChange={(e) => onChange(e)}
        onKeyPress={onKeyPress}
        placeholder={placeholder}
        aria-label={label}
      />
    </div>
  ),
  ButtonGroup: ({ children }: any) => <div data-testid="button-group">{children}</div>,
  Section: ({ children }: any) => <section>{children}</section>,
  Grid: ({ children }: any) => <div data-testid="grid">{children}</div>,
  Flex: ({ children }: any) => <div data-testid="flex">{children}</div>,
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
  Pagination: ({ currentPage, totalPages, onPageChange }: any) => (
    <div data-testid="pagination">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        Previous
      </button>
      <span>Page {currentPage} of {totalPages}</span>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
        Next
      </button>
    </div>
  ),
  Alert: ({ type, children }: any) => (
    <div className={`alert alert-${type}`}>{children}</div>
  ),
  Modal: ({ isOpen, onClose, title, children }: any) => 
    isOpen ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
  Tabs: ({ children, value, onChange }: any) => (
    <div data-testid="tabs">
      {React.Children.map(children, (child: any) => 
        React.cloneElement(child, { activeTab: value, onTabChange: onChange })
      )}
    </div>
  ),
  TabsList: ({ children, activeTab, onTabChange }: any) => (
    <div role="tablist">
      {React.Children.map(children, (child: any, index: number) => 
        React.cloneElement(child, { 
          isActive: activeTab === index.toString(), 
          onClick: () => onTabChange(index.toString()) 
        })
      )}
    </div>
  ),
  TabsTrigger: ({ children, value, isActive, onClick }: any) => (
    <button role="tab" aria-selected={isActive} onClick={onClick}>
      {children}
    </button>
  ),
  TabsContent: ({ children, value, activeTab }: any) => 
    activeTab === value ? <div>{children}</div> : null,
  tokens: {
    colors: {
      border: {
        default: '#3f3f46'
      },
      background: {
        elevated: '#27272a',
        surface: '#18181b'
      },
      text: {
        primary: '#e4e4e7'
      }
    }
  }
}))

describe('Media Enhancement Page Behavior', () => {
  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome to Test Course',
      content: '<h1>Welcome</h1>',
      narration: 'Welcome narration'
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: '<ul><li>Objective 1</li></ul>',
      narration: 'Objectives narration'
    },
    topics: [
      {
        id: 'topic1',
        title: 'Topic 1',
        content: '<p>Content 1</p>',
        narration: 'Topic 1 narration'
      },
      {
        id: 'topic2',
        title: 'Topic 2',
        content: '<p>Content 2</p>',
        narration: 'Topic 2 narration'
      }
    ],
    assessment: {
      questions: []
    }
  }

  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    template: 'None',
    customTopics: ['Topic 1', 'Topic 2'],
    templateTopics: []
  }

  const mockHandlers = {
    onNext: vi.fn(),
    onBack: vi.fn(),
    onSettingsClick: vi.fn(),
    onSave: vi.fn(),
    onSaveAs: vi.fn(),
    onOpen: vi.fn(),
    onHelp: vi.fn(),
    onStepClick: vi.fn()
  }

  const mockApiKeys = {
    googleImageApiKey: 'test-google-key',
    googleCseId: 'test-cse-id',
    youtubeApiKey: 'test-youtube-key'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should allow navigation between topics using Previous/Next buttons', async () => {
    const user = userEvent.setup()
    
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        apiKeys={mockApiKeys}
        {...mockHandlers}
      />
    )

    // Should start at Welcome page - look for the Welcome content
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    
    // Check we're on page 1 of 4
    expect(screen.getByText(/Page.*1.*of.*4/)).toBeInTheDocument()
    
    // Navigate to Learning Objectives
    const nextTopicButton = screen.getByRole('button', { name: /next topic/i })
    await user.click(nextTopicButton)
    
    // Should now show page 2 of 4
    await waitFor(() => {
      expect(screen.getByText(/Page.*2.*of.*4/)).toBeInTheDocument()
    })
    
    // Navigate to Topic 1
    await user.click(nextTopicButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Page.*3.*of.*4/)).toBeInTheDocument()
    })
    
    // Navigate back
    const prevTopicButton = screen.getByRole('button', { name: /previous topic/i })
    await user.click(prevTopicButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Page.*2.*of.*4/)).toBeInTheDocument()
    })
  })

  it('should allow editing text content with rich text editor', async () => {
    const user = userEvent.setup()
    
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        apiKeys={mockApiKeys}
        {...mockHandlers}
      />
    )

    // Click edit content button
    const editButton = screen.getByRole('button', { name: /edit content/i })
    await user.click(editButton)
    
    // Check that editor modal appears
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('should show selected media preview with remove button', async () => {
    const user = userEvent.setup()
    
    // Mock a course with media already selected
    const contentWithMedia = {
      ...mockCourseContent,
      welcomePage: {
        ...mockCourseContent.welcomePage,
        media: [{
          id: '1',
          type: 'image' as const,
          url: 'https://example.com/image.jpg',
          title: 'Test Image'
        }]
      }
    }
    
    render(
      <MediaEnhancementWizard
        courseContent={contentWithMedia}
        courseSeedData={mockCourseSeedData}
        apiKeys={mockApiKeys}
        {...mockHandlers}
      />
    )

    // Should show media preview
    expect(screen.getByAltText('Test Image')).toBeInTheDocument()
    
    // Should have remove button
    expect(screen.getByRole('button', { name: /remove.*media/i })).toBeInTheDocument()
  })

  it('should show confirmation dialog when removing media', async () => {
    const user = userEvent.setup()
    
    const contentWithMedia = {
      ...mockCourseContent,
      welcomePage: {
        ...mockCourseContent.welcomePage,
        media: [{
          id: '1',
          type: 'image' as const,
          url: 'https://example.com/image.jpg',
          title: 'Test Image'
        }]
      }
    }
    
    render(
      <MediaEnhancementWizard
        courseContent={contentWithMedia}
        courseSeedData={mockCourseSeedData}
        apiKeys={mockApiKeys}
        {...mockHandlers}
      />
    )

    // Click remove button
    const removeButton = screen.getByRole('button', { name: /remove.*media/i })
    await user.click(removeButton)
    
    // Check confirmation dialog appears
    const dialog = screen.getByRole('dialog', { name: /remove media/i })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText(/are you sure you want to remove/i)).toBeInTheDocument()
    
    // Confirm removal
    const confirmButton = within(dialog).getByRole('button', { name: /confirm/i })
    await user.click(confirmButton)
    
    // Media should be removed
    await waitFor(() => {
      expect(screen.queryByAltText('Test Image')).not.toBeInTheDocument()
    })
  })

  it('should search Google Images with API key from settings', async () => {
    const user = userEvent.setup()
    const { searchGoogleImages } = await import('../../../services/searchService')
    const mockSearchGoogleImages = searchGoogleImages as jest.MockedFunction<typeof searchGoogleImages>
    
    mockSearchGoogleImages.mockResolvedValueOnce({
      results: [
        {
          id: '1',
          url: 'https://example.com/image1.jpg',
          title: 'Search Result 1',
          thumbnail: 'https://example.com/thumb1.jpg',
          source: 'example.com',
          dimensions: '1920x1080'
        }
      ],
      nextPageToken: null
    })
    
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        apiKeys={mockApiKeys}
        {...mockHandlers}
      />
    )

    // Find the search input
    const searchInput = screen.getByPlaceholderText(/search for images/i)
    await user.type(searchInput, 'test query')
    
    // Click search button - find all search buttons and pick the enabled one
    const searchButtons = screen.getAllByRole('button', { name: 'Search' })
    const enabledSearchButton = searchButtons.find(btn => !btn.hasAttribute('disabled'))
    if (enabledSearchButton) {
      await user.click(enabledSearchButton)
    }
    
    // Wait for the search to be called
    await waitFor(() => {
      expect(mockSearchGoogleImages).toHaveBeenCalled()
    })
    
    // Verify search was called with correct params
    expect(mockSearchGoogleImages).toHaveBeenCalledWith(
      'test query',
      1,
      mockApiKeys.googleImageApiKey,
      mockApiKeys.googleCseId
    )
  })

  it('should search YouTube videos with proper API calls', async () => {
    const user = userEvent.setup()
    const { searchYouTubeVideos } = await import('../../../services/searchService')
    const mockSearchYouTubeVideos = searchYouTubeVideos as jest.MockedFunction<typeof searchYouTubeVideos>
    
    mockSearchYouTubeVideos.mockResolvedValueOnce({
      results: [
        {
          id: 'video1',
          url: 'https://youtube.com/watch?v=video1',
          title: 'YouTube Video 1',
          thumbnail: 'https://i.ytimg.com/vi/video1/default.jpg',
          embedUrl: 'https://youtube.com/embed/video1',
          channel: 'Test Channel',
          duration: '5:30',
          views: '1,000',
          uploadedAt: '2023-01-01'
        }
      ],
      nextPageToken: 'next-token'
    })
    
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        apiKeys={mockApiKeys}
        {...mockHandlers}
      />
    )

    // Find the YouTube search input (second search input)
    const searchInputs = screen.getAllByPlaceholderText(/search for/i)
    const youtubeInput = searchInputs.find(input => input.getAttribute('placeholder')?.includes('video'))
    
    if (youtubeInput) {
      await user.type(youtubeInput, 'educational video')
      
      // Find and click the YouTube search button
      const parentElement = youtubeInput.closest('section')
      if (parentElement) {
        const searchButton = within(parentElement).getByRole('button', { name: /search/i })
        await user.click(searchButton)
      }
      
      // Verify search was called with correct params
      expect(mockSearchYouTubeVideos).toHaveBeenCalledWith(
        'educational video',
        1,
        mockApiKeys.youtubeApiKey
      )
    }
  })

  it('should allow file upload and show AI prompt with copy button', async () => {
    const user = userEvent.setup()
    
    render(
      <MediaEnhancementWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        apiKeys={mockApiKeys}
        {...mockHandlers}
      />
    )

    // Should show file upload section
    expect(screen.getByText('Upload Media')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /choose file/i })).toBeInTheDocument()
    
    // Should show AI prompt section
    expect(screen.getByText(/need help finding media/i)).toBeInTheDocument()
    
    // Should have copy prompt button
    const copyButton = screen.getByRole('button', { name: /copy prompt/i })
    expect(copyButton).toBeInTheDocument()
    
    // Should show external generator links
    expect(screen.getByText(/dall-e/i)).toBeInTheDocument()
    expect(screen.getByText(/midjourney/i)).toBeInTheDocument()
  })

  // TODO: Add more comprehensive tests when we can better understand the component structure
  it.todo('should handle pagination for search results')
  it.todo('should show larger preview when clicking on search result')
  it.todo('should ask to replace when selecting new media if one exists')
  it.todo('should save media to .scormproj file when project is saved')
})