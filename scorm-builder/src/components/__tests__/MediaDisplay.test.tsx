// Removed unused React import
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from './../../test/testProviders'
import { MediaDisplay } from '../MediaDisplay'

// Mock the MediaContext
const mockGetMediaUrl = vi.fn()
const mockGetMedia = vi.fn()
const mockStore = {
  getMedia: mockGetMedia
}
let mockIsLoading = false

vi.mock('../../contexts/MediaContext', () => ({
  useMedia: () => ({
    getMediaUrl: mockGetMediaUrl,
    isLoading: mockIsLoading,
    store: mockStore
  })
}))

// Mock LoadingSpinner
vi.mock('../DesignSystem', () => ({
  LoadingSpinner: ({ text }: any) => <div data-testid="loading-spinner">{text}</div>
}))

describe('MediaDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockIsLoading = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return fallback when no mediaId', () => {
    render(<MediaDisplay mediaId={undefined} fallback={<div>No media</div>} />)
    
    expect(screen.getByText('No media')).toBeInTheDocument()
  })

  it('should return null when no mediaId and no fallback', () => {
    render(<MediaDisplay mediaId={undefined} />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should show loading spinner when isLoading', () => {
    mockIsLoading = true
    
    render(<MediaDisplay mediaId="test-id" />)
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.getByText('Loading media...')).toBeInTheDocument()
  })

  it('should show fallback when no URL found', () => {
    mockGetMediaUrl.mockReturnValue(null)
    
    render(<MediaDisplay mediaId="test-id" fallback={<div>Custom fallback</div>} />)
    
    expect(console.warn).toHaveBeenCalledWith('[MediaDisplay] No URL found for media ID:', 'test-id')
    expect(screen.getByText('Custom fallback')).toBeInTheDocument()
  })

  it('should show default message when no URL and no fallback', () => {
    mockGetMediaUrl.mockReturnValue(null)
    
    render(<MediaDisplay mediaId="test-id" />)
    
    expect(screen.getByText('Media not found')).toBeInTheDocument()
  })

  it('should show fallback when media not found in store', () => {
    mockGetMediaUrl.mockReturnValue('http://example.com/media.jpg')
    mockGetMedia.mockReturnValue(null)
    
    render(<MediaDisplay mediaId="test-id" fallback={<div>Media missing</div>} />)
    
    expect(screen.getByText('Media missing')).toBeInTheDocument()
  })

  it('should show default message when media not found and no fallback', () => {
    mockGetMediaUrl.mockReturnValue('http://example.com/media.jpg')
    mockGetMedia.mockReturnValue(null)
    
    render(<MediaDisplay mediaId="test-id" />)
    
    expect(screen.getByText('Media not found')).toBeInTheDocument()
  })

  describe('Media type rendering', () => {
    it('should render image', () => {
      mockGetMediaUrl.mockReturnValue('http://example.com/image.jpg')
      mockGetMedia.mockReturnValue({
        metadata: {
          type: 'image',
          title: 'Test Image'
        }
      })
      
      render(<MediaDisplay mediaId="test-id" className="test-class" />)
      
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('src', 'http://example.com/image.jpg')
      expect(img).toHaveAttribute('alt', 'Test Image')
      expect(img).toHaveClass('test-class')
    })

    it('should use alt prop over metadata title', () => {
      mockGetMediaUrl.mockReturnValue('http://example.com/image.jpg')
      mockGetMedia.mockReturnValue({
        metadata: {
          type: 'image',
          title: 'Metadata Title'
        }
      })
      
      render(<MediaDisplay mediaId="test-id" alt="Custom Alt" />)
      
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('alt', 'Custom Alt')
    })

    it('should render YouTube video with iframe', () => {
      mockGetMediaUrl.mockReturnValue('http://example.com/video.mp4')
      mockGetMedia.mockReturnValue({
        metadata: {
          type: 'video',
          title: 'YouTube Video',
          embed_url: 'https://www.youtube.com/embed/abc123'
        }
      })
      
      render(<MediaDisplay mediaId="test-id" style={{ width: '100%' }} />)
      
      const iframe = screen.getByTitle('YouTube Video')
      expect(iframe.tagName).toBe('IFRAME')
      expect(iframe).toHaveAttribute('src', 'https://www.youtube.com/embed/abc123')
      expect(iframe).toHaveAttribute('allowFullScreen')
      expect(iframe).toHaveStyle({ width: '100%' })
    })

    it('should render regular video', () => {
      mockGetMediaUrl.mockReturnValue('http://example.com/video.mp4')
      mockGetMedia.mockReturnValue({
        metadata: {
          type: 'video',
          title: 'Test Video'
        }
      })
      
      render(<MediaDisplay mediaId="test-id" className="video-class" />)
      
      const video = screen.getByTitle('Test Video')
      expect(video.tagName).toBe('VIDEO')
      expect(video).toHaveAttribute('src', 'http://example.com/video.mp4')
      expect(video).toHaveAttribute('controls')
      expect(video).toHaveClass('video-class')
    })

    it('should render audio', () => {
      mockGetMediaUrl.mockReturnValue('http://example.com/audio.mp3')
      mockGetMedia.mockReturnValue({
        metadata: {
          type: 'audio',
          title: 'Test Audio'
        }
      })
      
      render(<MediaDisplay mediaId="test-id" />)
      
      const audio = screen.getByTitle('Test Audio')
      expect(audio.tagName).toBe('AUDIO')
      expect(audio).toHaveAttribute('src', 'http://example.com/audio.mp3')
      expect(audio).toHaveAttribute('controls')
    })

    it('should use fallback alt text when no metadata title', () => {
      mockGetMediaUrl.mockReturnValue('http://example.com/image.jpg')
      mockGetMedia.mockReturnValue({
        metadata: {
          type: 'image'
        }
      })
      
      render(<MediaDisplay mediaId="test-id" />)
      
      const img = screen.getByRole('img')
      expect(img).toHaveAttribute('alt', 'Image')
    })

    it('should render unknown media type with fallback', () => {
      mockGetMediaUrl.mockReturnValue('http://example.com/unknown')
      mockGetMedia.mockReturnValue({
        metadata: {
          type: 'document'
        }
      })
      
      render(<MediaDisplay mediaId="test-id" fallback={<div>Unknown type fallback</div>} />)
      
      expect(screen.getByText('Unknown type fallback')).toBeInTheDocument()
    })

    it('should render unknown media type with default message', () => {
      mockGetMediaUrl.mockReturnValue('http://example.com/unknown')
      mockGetMedia.mockReturnValue({
        metadata: {
          type: 'document'
        }
      })
      
      render(<MediaDisplay mediaId="test-id" />)
      
      expect(screen.getByText('Unknown media type')).toBeInTheDocument()
    })
  })

  describe('Style and className props', () => {
    it('should apply style to loading spinner container', () => {
      mockIsLoading = true
      
      render(
        <MediaDisplay 
          mediaId="test-id" 
          style={{ width: 200, height: 100 }} 
        />
      )
      
      const loadingContainer = container.firstChild as HTMLElement
      expect(loadingContainer).toHaveStyle({ 
        width: '200px', 
        height: '100px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      })
    })

    it('should apply className and style to all media types', () => {
      const mediaTypes = [
        { type: 'image', tagName: 'IMG' },
        { type: 'video', tagName: 'VIDEO' },
        { type: 'audio', tagName: 'AUDIO' }
      ]

      mediaTypes.forEach(({ type, tagName }) => {
        mockGetMediaUrl.mockReturnValue(`http://example.com/media.${type}`)
        mockGetMedia.mockReturnValue({
          metadata: {
            type,
            title: `Test ${type}`
          }
        })
        
        render(
          <MediaDisplay 
            mediaId={`${type}-id`} 
            className={`${type}-class`}
            style={{ border: '1px solid red' }}
          />
        )
        
        const element = container.querySelector(tagName.toLowerCase())
        expect(element).toHaveClass(`${type}-class`)
        expect(element).toHaveStyle({ border: '1px solid red' })
      })
    })
  })
})