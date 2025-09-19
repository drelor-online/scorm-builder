/**
 * BEHAVIOR TEST: YouTube URL Validation and Preview Generation
 *
 * This test reproduces the YouTube preview errors reported by the user:
 * 1. CSP Style Violation: "Refused to apply inline style"
 * 2. X-Frame-Options Error: "Refused to display 'https://www.youtube.com/' in a frame"
 *
 * Following TDD: Write failing test first, then fix the issues.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { buildYouTubeEmbed } from '../services/mediaUrl'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`)
}))

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

// Mock storage
const mockStorage = {
  saveCourseSeedData: vi.fn(),
  saveProject: vi.fn(),
  saveBlob: vi.fn(),
  getAllProjects: vi.fn().mockResolvedValue([]),
  // Add other required methods
}

// Test wrapper with required providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <PersistentStorageProvider value={mockStorage}>
    <UnifiedMediaProvider>
      {children}
    </UnifiedMediaProvider>
  </PersistentStorageProvider>
)

// Mock course content with a page for testing
const mockCourseContent = {
  title: 'Test Course',
  description: 'Test course for YouTube validation',
  pages: [
    {
      id: '1',
      title: 'Test Page',
      content: 'Test page content',
      videoSearchTerms: ['test video']
    }
  ]
}

describe('MediaEnhancementWizard YouTube URL Validation (Behavior Test)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset console.error to capture CSP and iframe errors
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('URL Validation Edge Cases', () => {
    it('should handle invalid YouTube URLs that cause X-Frame-Options errors', () => {
      // Test case 1: Empty/invalid URL should not generate problematic iframe src
      const invalidUrls = [
        '',
        'https://www.youtube.com/', // This is what's causing the X-Frame-Options error
        'not-a-url',
        'https://example.com',
        null,
        undefined
      ]

      invalidUrls.forEach(url => {
        const embedUrl = buildYouTubeEmbed(url as string)

        // Should return safe fallback, never the problematic 'https://www.youtube.com/'
        expect(embedUrl).not.toBe('https://www.youtube.com/')
        expect(embedUrl).not.toBe('https://youtube.com/')

        // Should be either a proper embed URL or safe fallback
        if (embedUrl !== 'about:blank') {
          expect(embedUrl).toMatch(/^https:\/\/www\.youtube\.com\/embed\/[^\/]+/)
        }
      })
    })

    it('should validate YouTube ID extraction from various URL formats', () => {
      const testCases = [
        {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          expectedId: 'dQw4w9WgXcQ',
          description: 'Standard watch URL'
        },
        {
          url: 'https://youtu.be/dQw4w9WgXcQ',
          expectedId: 'dQw4w9WgXcQ',
          description: 'Short URL'
        },
        {
          url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          expectedId: 'dQw4w9WgXcQ',
          description: 'Embed URL'
        },
        {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
          expectedId: 'dQw4w9WgXcQ',
          description: 'URL with timestamp'
        }
      ]

      testCases.forEach(({ url, expectedId, description }) => {
        const embedUrl = buildYouTubeEmbed(url)
        expect(embedUrl).toContain(expectedId), `Failed for ${description}: ${url}`
        expect(embedUrl).toMatch(/^https:\/\/www\.youtube\.com\/embed\//)
      })
    })

    it('should generate proper embed URLs with clip timing', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

      // Test with start time
      const embedWithStart = buildYouTubeEmbed(url, 30)
      expect(embedWithStart).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=30')

      // Test with start and end time
      const embedWithBoth = buildYouTubeEmbed(url, 30, 90)
      expect(embedWithBoth).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ?start=30&end=90')

      // Test with negative start (should be converted to 0)
      const embedWithNegative = buildYouTubeEmbed(url, -5)
      expect(embedWithNegative).not.toContain('start=-5')
      expect(embedWithNegative).toContain('start=0')
    })
  })

  describe('Component Integration Tests', () => {
    it('should render without CSP style violations', async () => {
      const mockOnSave = vi.fn()
      const mockOnCancel = vi.fn()

      render(
        <TestWrapper>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            currentPageIndex={0}
            onSave={mockOnSave}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      )

      // Wait for component to fully render
      await waitFor(() => {
        expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
      })

      // Check that no CSP style errors were logged
      const consoleErrors = (console.error as any).mock.calls
      const cspStyleErrors = consoleErrors.filter((call: any[]) =>
        call.some(arg =>
          typeof arg === 'string' &&
          arg.includes('Content Security Policy directive') &&
          arg.includes('style-src')
        )
      )

      // This test will initially FAIL - that's expected for TDD
      expect(cspStyleErrors).toHaveLength(0),
        `Found CSP style violations: ${JSON.stringify(cspStyleErrors, null, 2)}`
    })

    it('should handle YouTube video preview without X-Frame-Options errors', async () => {
      const mockOnSave = vi.fn()
      const mockOnCancel = vi.fn()

      // Mock a YouTube search result
      const { invoke } = await import('@tauri-apps/api/core')
      const mockInvoke = vi.mocked(invoke)

      mockInvoke.mockResolvedValueOnce([
        {
          id: 'test-video-1',
          title: 'Test YouTube Video',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          isYouTube: true
        }
      ])

      render(
        <TestWrapper>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            currentPageIndex={0}
            onSave={mockOnSave}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      )

      // Search for videos
      const searchInput = screen.getByPlaceholderText(/search for videos/i)
      fireEvent.change(searchInput, { target: { value: 'test video' } })

      const searchButton = screen.getByRole('button', { name: /search/i })
      fireEvent.click(searchButton)

      // Wait for search results
      await waitFor(() => {
        expect(screen.getByText('Test YouTube Video')).toBeInTheDocument()
      }, { timeout: 5000 })

      // Click on the video to open preview
      const videoResult = screen.getByText('Test YouTube Video')
      fireEvent.click(videoResult)

      // Wait for lightbox to open
      await waitFor(() => {
        expect(screen.getByTestId('video-preview')).toBeInTheDocument()
      })

      // Check the iframe src attribute
      const iframe = screen.getByTestId('video-preview') as HTMLIFrameElement
      const iframeSrc = iframe.src

      // This should NOT be the problematic YouTube homepage URL
      expect(iframeSrc).not.toBe('https://www.youtube.com/')
      expect(iframeSrc).not.toBe('https://youtube.com/')

      // Should be either a proper embed URL or safe fallback
      if (iframeSrc !== 'about:blank') {
        expect(iframeSrc).toMatch(/^https:\/\/www\.youtube\.com\/embed\/[^\/]+/)
      }

      // Check that no X-Frame-Options errors were logged
      const consoleErrors = (console.error as any).mock.calls
      const xFrameErrors = consoleErrors.filter((call: any[]) =>
        call.some(arg =>
          typeof arg === 'string' &&
          (arg.includes('X-Frame-Options') || arg.includes('Refused to display'))
        )
      )

      // This test will initially FAIL - that's expected for TDD
      expect(xFrameErrors).toHaveLength(0),
        `Found X-Frame-Options errors: ${JSON.stringify(xFrameErrors, null, 2)}`
    })

    it('should not generate inline styles that violate CSP', async () => {
      const mockOnSave = vi.fn()
      const mockOnCancel = vi.fn()

      render(
        <TestWrapper>
          <MediaEnhancementWizard
            courseContent={mockCourseContent}
            currentPageIndex={0}
            onSave={mockOnSave}
            onCancel={mockOnCancel}
          />
        </TestWrapper>
      )

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText('Media Enhancement')).toBeInTheDocument()
      })

      // Check for problematic inline styles in the DOM
      const elementsWithInlineStyles = document.querySelectorAll('[style]')

      // Log any found inline styles for debugging
      elementsWithInlineStyles.forEach((element, index) => {
        console.log(`Inline style ${index + 1}:`, element.outerHTML)
      })

      // This test will initially FAIL if there are inline styles - that's expected for TDD
      expect(elementsWithInlineStyles.length).toBe(0),
        `Found ${elementsWithInlineStyles.length} elements with inline styles that may violate CSP`
    })
  })

  describe('Error Recovery', () => {
    it('should provide helpful error messages when YouTube URL validation fails', () => {
      const problematicUrls = [
        'https://www.youtube.com/', // Homepage without video ID
        'invalid-url',
        '',
        'https://example.com/fake-video'
      ]

      problematicUrls.forEach(url => {
        const embedUrl = buildYouTubeEmbed(url)

        // Should always return a safe fallback
        expect(embedUrl).toBe('about:blank')

        // Should have logged an error for debugging
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('[mediaUrl] buildYouTubeEmbed'),
          expect.any(String)
        )
      })
    })
  })
})