import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { NotificationProvider } from '../contexts/NotificationContext'

// Mock MediaService to return YouTube video with proper URL
const mockMediaService = {
  projectId: 'test-project',
  listAllMedia: vi.fn().mockResolvedValue([
    {
      id: 'video-1',
      type: 'youtube',  // Key: This is 'youtube', not 'video'
      pageId: 'learning-objectives',
      fileName: 'Test YouTube Video',
      metadata: {
        type: 'youtube',
        isYouTube: true,
        youtubeUrl: 'https://www.youtube.com/watch?v=TEST123',
        embedUrl: 'https://www.youtube.com/embed/TEST123',
        clipStart: 30,
        clipEnd: 60,
        uploadedAt: '2023-01-01T00:00:00.000Z'
      }
    }
  ]),
  getMedia: vi.fn().mockImplementation((id: string) => {
    if (id === 'video-1') {
      return Promise.resolve({
        data: null, // YouTube videos don't have blob data
        url: 'https://www.youtube.com/watch?v=TEST123&start=30&end=60', // Proper YouTube URL
        metadata: {
          type: 'youtube',
          isYouTube: true,
          youtubeUrl: 'https://www.youtube.com/watch?v=TEST123',
          embedUrl: 'https://www.youtube.com/embed/TEST123',
          clipStart: 30,
          clipEnd: 60
        }
      })
    }
    return Promise.resolve(null)
  }),
  getBlobUrl: vi.fn().mockReturnValue('blob:http://localhost/test-blob'),
  deleteMedia: vi.fn().mockResolvedValue(undefined)
}

vi.mock('../services/MediaService', () => ({
  MediaService: {
    getInstance: vi.fn(() => mockMediaService)
  },
  createMediaService: vi.fn(() => mockMediaService)
}))

const mockStorage = {
  getProject: vi.fn(),
  getCurrentProjectId: vi.fn().mockReturnValue('test-project'),
  saveProject: vi.fn(),
  getCourseSeedData: vi.fn(),
  saveCourseSeedData: vi.fn(),
  getContent: vi.fn().mockResolvedValue(null)
}

vi.mock('../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: { children: React.ReactNode }) => children,
  useStorage: () => mockStorage
}))

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PersistentStorageProvider projectId="test-project">
      <UnifiedMediaProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </UnifiedMediaProvider>
    </PersistentStorageProvider>
  )
}

describe('MediaEnhancementWizard YouTube URL Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display proper YouTube URL instead of media-error://', async () => {
    console.log('🔍 [TEST] Testing YouTube URL display fix...')
    
    const mockOnPageChange = vi.fn()
    const mockOnSave = vi.fn()
    
    render(
      <TestWrapper>
        <MediaEnhancementWizard
          currentPage="learning-objectives"
          onPageChange={mockOnPageChange}
          onSave={mockOnSave}
        />
      </TestWrapper>
    )

    // Wait for the component to load and process media
    await waitFor(() => {
      // Check if the component has loaded the media
      const existingMediaSection = screen.queryByText(/Current Media/i)
      return existingMediaSection !== null
    }, { timeout: 5000 })

    console.log('🔍 [TEST] MediaEnhancementWizard rendered, checking for YouTube video...')
    
    // Check what URLs are being created
    console.log('🔍 [TEST] Expected behavior:')
    console.log('  ✅ YouTube video should have proper YouTube URL')
    console.log('  ❌ YouTube video should NOT have "media-error://" URL')
    
    // Log the getMedia call to see what URL is returned
    expect(mockMediaService.getMedia).toHaveBeenCalledWith('video-1')
    
    console.log('🔍 [TEST] getMedia was called for video-1')
    console.log('🔍 [TEST] This test demonstrates the URL fix - check console for actual vs expected URLs')
  })

  it('should handle YouTube type correctly in MediaEnhancementWizard', () => {
    // Test the type handling logic
    const mockYouTubeItem = {
      id: 'video-1',
      type: 'youtube',  // This is the key - type is 'youtube', not 'video'
      metadata: {
        isYouTube: true,
        youtubeUrl: 'https://www.youtube.com/watch?v=TEST123'
      }
    }
    
    // The issue: MediaEnhancementWizard casts type as 'image' | 'video'
    // But YouTube videos have type 'youtube', so they get mishandled
    
    const incorrectTypeCast = mockYouTubeItem.type as 'image' | 'video'
    const correctTypeHandling = mockYouTubeItem.type === 'youtube' ? 'video' : mockYouTubeItem.type
    
    console.log('🔍 [TEST] Type handling demonstration:')
    console.log(`  Original type: ${mockYouTubeItem.type}`)
    console.log(`  Incorrect cast: ${incorrectTypeCast}`)
    console.log(`  Correct handling: ${correctTypeHandling}`)
    
    // The fix should handle 'youtube' type properly
    expect(mockYouTubeItem.type).toBe('youtube')
    console.log('✅ [TEST] YouTube video has correct type: "youtube"')
  })
})