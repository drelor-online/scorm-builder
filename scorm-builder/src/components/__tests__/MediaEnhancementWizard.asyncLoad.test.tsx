import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MediaEnhancementWizard } from '../MediaEnhancementWizard'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'

// Mock dependencies
vi.mock('../../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => ({
    storeMedia: vi.fn(),
    storeYouTubeVideo: vi.fn(),
    getMedia: vi.fn(),
    deleteMedia: vi.fn(),
    getMediaForPage: vi.fn().mockResolvedValue([]),
    createBlobUrl: vi.fn(),
    revokeBlobUrl: vi.fn()
  })
}))

vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    currentProjectId: 'test-project',
    storage: {
      getContent: vi.fn()
    }
  })
}))

describe('MediaEnhancementWizard - Async Loading', () => {
  const mockCourseContent = {
    welcome: {
      title: 'Welcome',
      content: '<p>Welcome content</p>',
      narration: 'Welcome narration',
      topicId: 'welcome'
    },
    objectives: {
      title: 'Objectives',
      content: '<p>Objectives content</p>',
      narration: 'Objectives narration',
      topicId: 'objectives'
    },
    topics: [{
      id: 'topic-1',
      title: 'Topic 1',
      content: '<p>Topic content</p>',
      narration: 'Topic narration',
      topicId: 'topic-1'
    }],
    assessment: {
      topicId: 'assessment',
      questions: []
    }
  }

  const defaultProps = {
    courseContent: mockCourseContent,
    onNext: vi.fn(),
    onBack: vi.fn(),
    onUpdateContent: vi.fn()
  }

  it('should load existing media asynchronously without errors', async () => {
    // This test verifies that the async media loading in useEffect works correctly
    const { container } = render(
      <BrowserRouter>
        <MediaEnhancementWizard {...defaultProps} />
      </BrowserRouter>
    )

    // Wait for async operations to complete
    await waitFor(() => {
      // Should not have any errors
      expect(container.querySelector('.error')).not.toBeInTheDocument()
    })

    // Component should render successfully
    expect(screen.getByText(/enhance with media/i)).toBeInTheDocument()
  })

  it('should handle media loading for current page', async () => {
    const mockGetMediaForPage = vi.fn().mockResolvedValue([
      {
        id: 'media-1',
        type: 'image',
        url: 'test.jpg',
        title: 'Test Image'
      }
    ])

    vi.mocked(useUnifiedMedia).mockReturnValue({
      storeMedia: vi.fn(),
      storeYouTubeVideo: vi.fn(),
      getMedia: vi.fn(),
      deleteMedia: vi.fn(),
      getMediaForPage: mockGetMediaForPage,
      createBlobUrl: vi.fn(),
      revokeBlobUrl: vi.fn()
    })

    render(
      <BrowserRouter>
        <MediaEnhancementWizard {...defaultProps} />
      </BrowserRouter>
    )

    // Wait for media to load
    await waitFor(() => {
      expect(mockGetMediaForPage).toHaveBeenCalled()
    })
  })
})