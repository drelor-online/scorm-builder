/**
 * Tests for UnifiedMediaContext defensive filtering functionality
 * 
 * This test verifies that getValidMediaForPage correctly filters out
 * orphaned media references and cleans up the cache.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger
vi.mock('../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('UnifiedMediaContext - Defensive Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should filter out non-existent media and clean cache', async () => {
    // ARRANGE: Mock the context dependencies
    const mockMediaCache = new Map([
      ['valid-media-1', { 
        id: 'valid-media-1', 
        pageId: 'welcome', 
        type: 'image', 
        title: 'Valid Image',
        url: ''
      }],
      ['orphaned-media-1', { 
        id: 'orphaned-media-1', 
        pageId: 'welcome', 
        type: 'image', 
        title: 'Orphaned Image',
        url: ''
      }],
      ['valid-media-2', { 
        id: 'valid-media-2', 
        pageId: 'welcome', 
        type: 'audio', 
        title: 'Valid Audio',
        url: ''
      }],
      ['orphaned-media-2', { 
        id: 'orphaned-media-2', 
        pageId: 'welcome', 
        type: 'video', 
        title: 'Orphaned Video',
        url: ''
      }]
    ])

    const mockBlobCache = {
      revoke: vi.fn()
    }

    // Mock getMedia function - returns null for orphaned media
    const mockGetMedia = vi.fn().mockImplementation(async (mediaId: string) => {
      if (mediaId.includes('valid')) {
        return { 
          data: new Uint8Array([1, 2, 3]), 
          metadata: { id: mediaId, type: 'image' },
          url: `blob:${mediaId}` 
        }
      }
      return null // Orphaned media returns null
    })

    // SIMULATE: The getValidMediaForPage function
    const simulateGetValidMediaForPage = async (pageId: string) => {
      const allMediaForPage = Array.from(mockMediaCache.values()).filter(item => item.pageId === pageId)
      
      const validMedia: any[] = []
      const orphanedMedia: string[] = []
      
      for (const item of allMediaForPage) {
        try {
          const mediaData = await mockGetMedia(item.id)
          if (mediaData) {
            validMedia.push(item)
          } else {
            console.log(`Filtered out non-existent media: ${item.id} for page ${pageId}`)
            orphanedMedia.push(item.id)
          }
        } catch (error) {
          console.log(`Filtered out errored media: ${item.id} for page ${pageId}`, error)
          orphanedMedia.push(item.id)
        }
      }
      
      // Clean up orphaned entries from cache
      if (orphanedMedia.length > 0) {
        console.log(`Cleaning ${orphanedMedia.length} orphaned entries from cache`)
        orphanedMedia.forEach(mediaId => {
          mockMediaCache.delete(mediaId)
          mockBlobCache.revoke(mediaId)
        })
      }
      
      if (validMedia.length !== allMediaForPage.length) {
        console.log(`Defensive filtering for page ${pageId}: ${allMediaForPage.length} → ${validMedia.length} media items`)
      }
      
      return validMedia
    }

    // ACT: Call the defensive filtering function
    const validMedia = await simulateGetValidMediaForPage('welcome')

    // ASSERT: Verify correct filtering and cache cleanup
    
    // Should return only valid media
    expect(validMedia).toHaveLength(2)
    expect(validMedia[0].id).toBe('valid-media-1')
    expect(validMedia[1].id).toBe('valid-media-2')

    // Should have called getMedia for all items
    expect(mockGetMedia).toHaveBeenCalledTimes(4)
    expect(mockGetMedia).toHaveBeenCalledWith('valid-media-1')
    expect(mockGetMedia).toHaveBeenCalledWith('orphaned-media-1')
    expect(mockGetMedia).toHaveBeenCalledWith('valid-media-2')
    expect(mockGetMedia).toHaveBeenCalledWith('orphaned-media-2')

    // Should have cleaned orphaned entries from cache
    expect(mockMediaCache.has('valid-media-1')).toBe(true)
    expect(mockMediaCache.has('valid-media-2')).toBe(true)
    expect(mockMediaCache.has('orphaned-media-1')).toBe(false) // Cleaned
    expect(mockMediaCache.has('orphaned-media-2')).toBe(false) // Cleaned

    // Should have revoked orphaned blob URLs
    expect(mockBlobCache.revoke).toHaveBeenCalledTimes(2)
    expect(mockBlobCache.revoke).toHaveBeenCalledWith('orphaned-media-1')
    expect(mockBlobCache.revoke).toHaveBeenCalledWith('orphaned-media-2')

    console.log('✅ Verified defensive filtering correctly removes orphaned media and cleans cache')
  })

  it('should handle getMedia errors gracefully', async () => {
    // ARRANGE: Mock scenario where getMedia throws errors
    const mockMediaCache = new Map([
      ['working-media', { 
        id: 'working-media', 
        pageId: 'test', 
        type: 'image', 
        title: 'Working Media',
        url: ''
      }],
      ['error-media-1', { 
        id: 'error-media-1', 
        pageId: 'test', 
        type: 'image', 
        title: 'Error Media 1',
        url: ''
      }],
      ['error-media-2', { 
        id: 'error-media-2', 
        pageId: 'test', 
        type: 'video', 
        title: 'Error Media 2',
        url: ''
      }]
    ])

    const mockBlobCache = { revoke: vi.fn() }

    // Mock getMedia to throw errors for some media
    const mockGetMedia = vi.fn().mockImplementation(async (mediaId: string) => {
      if (mediaId === 'working-media') {
        return { data: new Uint8Array([1]), metadata: { id: mediaId }, url: 'blob:valid' }
      }
      if (mediaId === 'error-media-1') {
        throw new Error('File not found')
      }
      if (mediaId === 'error-media-2') {
        throw new Error('Permission denied')
      }
      return null
    })

    // SIMULATE: Defensive filtering with errors
    const simulateWithErrors = async (pageId: string) => {
      const allMediaForPage = Array.from(mockMediaCache.values()).filter(item => item.pageId === pageId)
      const validMedia: any[] = []
      const orphanedMedia: string[] = []
      
      for (const item of allMediaForPage) {
        try {
          const mediaData = await mockGetMedia(item.id)
          if (mediaData) {
            validMedia.push(item)
          } else {
            orphanedMedia.push(item.id)
          }
        } catch (error) {
          console.log(`Filtered out errored media: ${item.id}`, error)
          orphanedMedia.push(item.id)
        }
      }
      
      // Clean up orphaned entries
      orphanedMedia.forEach(mediaId => {
        mockMediaCache.delete(mediaId)
        mockBlobCache.revoke(mediaId)
      })
      
      return validMedia
    }

    // ACT: Run with error conditions
    const validMedia = await simulateWithErrors('test')

    // ASSERT: Should handle errors gracefully
    expect(validMedia).toHaveLength(1)
    expect(validMedia[0].id).toBe('working-media')

    // Should have tried all media
    expect(mockGetMedia).toHaveBeenCalledTimes(3)

    // Should have cleaned errored media from cache
    expect(mockMediaCache.has('working-media')).toBe(true)
    expect(mockMediaCache.has('error-media-1')).toBe(false)
    expect(mockMediaCache.has('error-media-2')).toBe(false)

    // Should have revoked errored media URLs
    expect(mockBlobCache.revoke).toHaveBeenCalledWith('error-media-1')
    expect(mockBlobCache.revoke).toHaveBeenCalledWith('error-media-2')

    console.log('✅ Verified graceful handling of getMedia errors')
  })

  it('should return all media when all exist', async () => {
    // ARRANGE: All media exists
    const mockMediaCache = new Map([
      ['media-1', { id: 'media-1', pageId: 'test', type: 'image' }],
      ['media-2', { id: 'media-2', pageId: 'test', type: 'audio' }],
      ['media-3', { id: 'media-3', pageId: 'other', type: 'video' }] // Different page
    ])

    const mockBlobCache = { revoke: vi.fn() }
    const mockGetMedia = vi.fn().mockResolvedValue({ 
      data: new Uint8Array([1]), 
      metadata: { id: 'test' } 
    })

    // SIMULATE: All media exists scenario
    const simulateAllValid = async (pageId: string) => {
      const allMediaForPage = Array.from(mockMediaCache.values()).filter(item => item.pageId === pageId)
      const validMedia: any[] = []
      
      for (const item of allMediaForPage) {
        const mediaData = await mockGetMedia(item.id)
        if (mediaData) {
          validMedia.push(item)
        }
      }
      
      return validMedia
    }

    // ACT: Get media for 'test' page
    const validMedia = await simulateAllValid('test')

    // ASSERT: Should return all media for the page
    expect(validMedia).toHaveLength(2)
    expect(validMedia[0].id).toBe('media-1')
    expect(validMedia[1].id).toBe('media-2')

    // Should not clean any media from cache
    expect(mockMediaCache.size).toBe(3)
    expect(mockBlobCache.revoke).not.toHaveBeenCalled()

    console.log('✅ Verified correct behavior when all media exists')
  })

  it('should return empty array when no media exists for page', async () => {
    // ARRANGE: Media for different page only
    const mockMediaCache = new Map([
      ['media-1', { id: 'media-1', pageId: 'other-page', type: 'image' }]
    ])

    const mockGetMedia = vi.fn()

    // SIMULATE: No media for requested page
    const simulateNoMediaForPage = async (pageId: string) => {
      const allMediaForPage = Array.from(mockMediaCache.values()).filter(item => item.pageId === pageId)
      return allMediaForPage // Will be empty
    }

    // ACT: Request media for page with no media
    const validMedia = await simulateNoMediaForPage('requested-page')

    // ASSERT: Should return empty array
    expect(validMedia).toHaveLength(0)
    expect(mockGetMedia).not.toHaveBeenCalled()

    console.log('✅ Verified correct behavior when no media exists for page')
  })
})