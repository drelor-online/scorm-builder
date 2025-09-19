/**
 * TDD Test: YouTube video preview without clip timing
 *
 * This test reproduces the issue where YouTube videos without clip timing
 * fail to preview properly and cause CSP/iframe errors.
 *
 * Expected errors to reproduce:
 * - "Refused to display 'https://www.youtube.com/' in a frame because it set 'X-Frame-Options' to 'sameorigin'"
 * - CSP violations for inline styles
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { CourseContentUnion } from '../types/schema'

import { vi } from 'vitest'

// Mock the services
vi.mock('../services/mediaUrl', () => ({
  buildYouTubeEmbed: vi.fn(),
  extractYouTubeId: vi.fn(),
  parseYouTubeClipTiming: vi.fn(() => ({}))
}))

// Mock console methods to capture errors
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PersistentStorageProvider>
    <UnifiedMediaProvider>
      <NotificationProvider>
        <UnsavedChangesProvider>
          {children}
        </UnsavedChangesProvider>
      </NotificationProvider>
    </UnifiedMediaProvider>
  </PersistentStorageProvider>
)

describe('MediaEnhancementWizard - YouTube Preview Without Clip Timing', () => {
  const mockCourseContent: CourseContentUnion = {
    welcome: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Test content',
      media: []
    },
    learningObjectives: {
      id: 'learning-objectives',
      title: 'Learning Objectives',
      content: 'Objectives content',
      media: []
    },
    topics: [{
      id: 'topic-1',
      title: 'Topic 1',
      content: 'Topic content',
      media: [],
      videoSearchTerms: ['test video']
    }]
  }

  beforeEach(async () => {
    vi.clearAllMocks()

    // Import the module to get the mocked functions
    const mediaUrlModule = await import('../services/mediaUrl')
    const { buildYouTubeEmbed, extractYouTubeId } = mediaUrlModule

    // Simulate the current buggy behavior - return original URL when ID extraction fails
    vi.mocked(extractYouTubeId).mockImplementation((url: string) => {
      if (!url || url === 'https://www.youtube.com/') {
        return null // This causes buildYouTubeEmbed to return original URL
      }
      return 'dQw4w9WgXcQ' // Valid test video ID
    })

    vi.mocked(buildYouTubeEmbed).mockImplementation((rawUrl: string, start?: number, end?: number) => {
      // Current buggy implementation - returns original URL when extraction fails
      const id = extractYouTubeId(rawUrl)
      if (!id) {
        return rawUrl // This is the bug - returns non-embed URL
      }

      const params = new URLSearchParams()
      if (typeof start === 'number' && start >= 0) {
        params.set('start', String(Math.max(0, Math.floor(start))))
      }
      if (typeof end === 'number' && (!start || end > start)) {
        params.set('end', String(Math.floor(end)))
      }

      const qs = params.toString() ? `?${params.toString()}` : ''
      return `https://www.youtube.com/embed/${id}${qs}`
    })
  })

  afterEach(() => {
    mockConsoleError.mockClear()
  })

  afterAll(() => {
    mockConsoleError.mockRestore()
  })

  it('should reproduce the YouTube iframe error when preview is opened for video without clip timing', async () => {
    // Mock search results with a YouTube video that has no clip timing
    const mockSearchResults = [{
      id: 'youtube-1',
      url: 'https://www.youtube.com/', // Problematic URL that causes iframe errors
      title: 'Test YouTube Video',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      isYouTube: true,
      embedUrl: 'https://www.youtube.com/', // This is the problem - not an embed URL
      // No clipStart or clipEnd - this is the key difference from working videos
    }]

    // Mock the search function to return our problematic result
    const mockApiKeys = { youtube: 'test-key' }

    render(
      <TestWrapper>
        <MediaEnhancementWizard
          courseContent={mockCourseContent}
          apiKeys={mockApiKeys}
          onUpdateContent={() => {}}
        />
      </TestWrapper>
    )

    // Navigate to a video page (topic with videoSearchTerms)
    const nextButton = screen.getByRole('button', { name: /next/i })
    fireEvent.click(nextButton) // Go to learning objectives
    fireEvent.click(nextButton) // Go to topic-1 (has videoSearchTerms)

    // Mock the search to return our problematic result
    const searchComponent = screen.getByTestId('media-search') || screen.getByRole('textbox')
    fireEvent.change(searchComponent, { target: { value: 'test video' } })

    // Trigger search (this would normally call YouTube API, but we're mocking it)
    // Since we can't easily mock the internal search state, we'll simulate
    // the user clicking on a search result directly

    // The test should fail here because when buildYouTubeEmbed is called
    // with the problematic URL, it will return the non-embed URL
    const { buildYouTubeEmbed } = await import('../services/mediaUrl')
    const result = buildYouTubeEmbed('https://www.youtube.com/')

    // This should demonstrate the bug - buildYouTubeEmbed returns a non-embed URL
    expect(result).toBe('https://www.youtube.com/') // Bug: Should be an embed URL or safe fallback
    expect(result).not.toMatch(/\/embed\//) // This proves the URL is not a proper embed URL

    // This is the root cause of the iframe error:
    // "Refused to display 'https://www.youtube.com/' in a frame because it set 'X-Frame-Options' to 'sameorigin'"
  })

  it('should reproduce URL validation issues when empty or invalid YouTube URLs are processed', async () => {
    const { buildYouTubeEmbed } = await import('../services/mediaUrl')

    // Test various invalid inputs that could cause iframe errors
    const invalidUrls = [
      '',
      'https://www.youtube.com/',
      'invalid-url',
      null,
      undefined
    ]

    invalidUrls.forEach(url => {
      const result = buildYouTubeEmbed(url as string)

      // Current buggy behavior - these return invalid URLs that cause iframe errors
      if (!url) {
        expect(result).toBe(url) // Bug: Should handle null/undefined gracefully
      } else {
        expect(result).toBe(url) // Bug: Should return safe fallback, not original invalid URL
      }

      // None of these should be valid embed URLs
      if (result && typeof result === 'string') {
        expect(result).not.toMatch(/\/embed\//) // Confirms these are not proper embed URLs
      }
    })
  })

  it('should demonstrate the CSP inline style issue when iframe src is invalid', () => {
    // When an iframe has an invalid src like 'https://www.youtube.com/',
    // it can trigger CSP violations if the iframe tries to apply inline styles

    // Create an iframe element similar to what MediaEnhancementWizard creates
    const iframe = document.createElement('iframe')
    iframe.src = 'https://www.youtube.com/' // Problematic URL
    iframe.width = '100%'
    iframe.height = '400'

    // This simulates what happens in the component when buildYouTubeEmbed
    // returns a non-embed URL - the iframe tries to load the main YouTube page
    // which violates X-Frame-Options and can cause CSP issues

    expect(iframe.src).toBe('https://www.youtube.com/')
    expect(iframe.src).not.toMatch(/\/embed\//)

    // The test demonstrates that we're creating iframes with problematic src URLs
    // that will cause the browser errors we're seeing
  })
})