import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '../../test/testProviders'
import { MediaLoadingWrapper } from '../../App'
import { mediaStore } from '../../services/MediaStore'

// Mock the MediaStore
vi.mock('../../services/MediaStore', () => ({
  mediaStore: {
    loadProject: vi.fn(),
    cleanup: vi.fn(),
    getMediaUrl: vi.fn(),
    getMediaByPage: vi.fn(),
    storeMedia: vi.fn(),
    getAllCachedMedia: vi.fn()
  }
}))

describe('MediaLoadingWrapper - Finalizing Screen Issue', () => {
  const mockStorage = {
    isInitialized: true,
    currentProjectId: 'test-project',
    getContent: vi.fn(),
    saveContent: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show separate finalizing screen when media is loading', async () => {
    // This test demonstrates the current behavior (the bug)
    
    // Mock MediaStore to simulate delayed loading
    let resolveMediaLoad: () => void
    const mediaLoadPromise = new Promise<void>(resolve => {
      resolveMediaLoad = resolve
    })
    
    vi.mocked(mediaStore.loadProject).mockImplementation(async () => {
      await mediaLoadPromise
    })

    const TestContent = () => <div>Main App Content</div>

    const { rerender } = render(<MediaLoadingWrapper>
              <TestContent />
            </MediaLoadingWrapper>)

    // Initially, media is loading so we shouldn't see the main content
    expect(screen.queryByText('Main App Content')).not.toBeInTheDocument()
    
    // After 300ms delay, should show the finalizing screen
    await waitFor(() => {
      expect(screen.getByText('Finalizing project load...')).toBeInTheDocument()
      expect(screen.getByText('Loading media resources')).toBeInTheDocument()
    }, { timeout: 500 })

    // Complete the media loading
    resolveMediaLoad!()
    
    // Wait for the finalizing screen to disappear
    await waitFor(() => {
      expect(screen.queryByText('Finalizing project load...')).not.toBeInTheDocument()
      expect(screen.getByText('Main App Content')).toBeInTheDocument()
    })
  })

  it('should not show finalizing screen if media loads quickly', async () => {
    // Mock MediaStore to load quickly
    vi.mocked(mediaStore.loadProject).mockResolvedValue(undefined)

    const TestContent = () => <div>Main App Content</div>

    render(<MediaLoadingWrapper>
              <TestContent />
            </MediaLoadingWrapper>)

    // Should show main content immediately since media loads quickly
    await waitFor(() => {
      expect(screen.getByText('Main App Content')).toBeInTheDocument()
    })

    // Should never show the finalizing screen
    expect(screen.queryByText('Finalizing project load...')).not.toBeInTheDocument()
  })
})