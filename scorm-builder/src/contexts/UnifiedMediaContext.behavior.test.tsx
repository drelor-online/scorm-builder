import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { UnifiedMediaProvider, useUnifiedMedia } from './UnifiedMediaContext'
import { PersistentStorageProvider } from './PersistentStorageContext'
import React from 'react'

// Mock PersistentStorageContext
vi.mock('./PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: any) => children,
  useStorage: () => ({
    currentProjectId: 'test-project',
    isInitialized: true,
    performSave: vi.fn(),
    getContent: vi.fn(),
    saveContent: vi.fn()
  })
}))

// Mock MediaService
vi.mock('../services/MediaService', () => ({
  MediaService: vi.fn().mockImplementation(() => ({
    getMedia: vi.fn(),
    storeMedia: vi.fn(),
    deleteMedia: vi.fn(),
    getMediaForPage: vi.fn(),
    listAllMedia: vi.fn().mockResolvedValue([])
  })),
  createMediaService: vi.fn().mockImplementation(() => ({
    getMedia: vi.fn(),
    storeMedia: vi.fn(),
    deleteMedia: vi.fn(),
    getMediaForPage: vi.fn(),
    listAllMedia: vi.fn().mockResolvedValue([])
  }))
}))

// Test component to access context
const TestComponent = ({ testFn }: { testFn: (context: any) => void }) => {
  const context = useUnifiedMedia()
  React.useEffect(() => {
    testFn(context)
  }, [context, testFn])
  return <div>Test Component</div>
}

// Import createMediaService mock
import { createMediaService } from '../services/MediaService'

describe('UnifiedMediaContext - Blob URL Management', () => {
  let revokeObjectURLSpy: any
  let createObjectURLSpy: any
  
  beforeEach(() => {
    // Mock URL methods
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:test-url')
    vi.clearAllMocks()
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })
  
  it('should not reuse blob URLs after media is deleted', async () => {
    const mediaService = {
      getMedia: vi.fn().mockResolvedValueOnce({
        id: 'image-1',
        url: null,
        data: new Uint8Array([1, 2, 3, 4]), // Use Uint8Array instead of Blob
        metadata: { type: 'image', mimeType: 'image/jpeg' }
      }).mockResolvedValueOnce(null), // After deletion
      deleteMedia: vi.fn().mockResolvedValue(true),
      storeMedia: vi.fn(),
      getMediaForPage: vi.fn(),
      listAllMedia: vi.fn().mockResolvedValue([])
    }
    
    // Update the mock to return our service
    ;(createMediaService as any).mockReturnValue(mediaService)
    
    let contextApi: any
    
    render(
      <UnifiedMediaProvider>
        <TestComponent testFn={(ctx) => { contextApi = ctx }} />
      </UnifiedMediaProvider>
    )
    
    // First call - should create a blob URL
    const url1 = await contextApi.createBlobUrl('image-1')
    expect(url1).toBe('blob:test-url')
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    
    // Delete the media
    await contextApi.deleteMedia('image-1')
    
    // Second call after deletion - should return null, not reuse old URL
    const url2 = await contextApi.createBlobUrl('image-1')
    expect(url2).toBeNull()
    
    // Should not have created another blob URL since media doesn't exist
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
  })
  
  it('should generate fresh blob URLs when media is re-added', async () => {
    let callCount = 0
    createObjectURLSpy.mockImplementation(() => `blob:test-url-${++callCount}`)
    
    const mediaService = {
      getMedia: vi.fn()
        .mockResolvedValueOnce({
          id: 'image-1',
          url: null,
          data: new Uint8Array([1, 2, 3, 4]),
          metadata: { type: 'image', mimeType: 'image/jpeg' }
        })
        .mockResolvedValueOnce(null) // After deletion
        .mockResolvedValueOnce({
          id: 'image-1',
          url: null,
          data: new Uint8Array([5, 6, 7, 8]),
          metadata: { type: 'image', mimeType: 'image/jpeg' }
        }),
      deleteMedia: vi.fn().mockResolvedValue(true),
      storeMedia: vi.fn(),
      getMediaForPage: vi.fn(),
      listAllMedia: vi.fn().mockResolvedValue([])
    }
    
    ;(createMediaService as any).mockReturnValue(mediaService)
    
    let contextApi: any
    
    render(
      <UnifiedMediaProvider>
        <TestComponent testFn={(ctx) => { contextApi = ctx }} />
      </UnifiedMediaProvider>
    )
    
    // First media add
    const url1 = await contextApi.createBlobUrl('image-1')
    expect(url1).toBe('blob:test-url-1')
    
    // Delete media
    await contextApi.deleteMedia('image-1')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url-1')
    
    // Re-add media with same ID
    const url2 = await contextApi.createBlobUrl('image-1')
    expect(url2).toBe('blob:test-url-2')
    
    // Should have created 2 different blob URLs
    expect(createObjectURLSpy).toHaveBeenCalledTimes(2)
    expect(url1).not.toBe(url2)
  })
  
  it('should clear blob URL cache when media is deleted', async () => {
    const mediaService = {
      getMedia: vi.fn().mockResolvedValue({
        id: 'image-1',
        url: null,
        data: new Uint8Array([1, 2, 3, 4]),
        metadata: { type: 'image', mimeType: 'image/jpeg' }
      }),
      deleteMedia: vi.fn().mockResolvedValue(true),
      storeMedia: vi.fn(),
      getMediaForPage: vi.fn(),
      listAllMedia: vi.fn().mockResolvedValue([])
    }
    
    ;(createMediaService as any).mockReturnValue(mediaService)
    
    let contextApi: any
    
    render(
      <UnifiedMediaProvider>
        <TestComponent testFn={(ctx) => { contextApi = ctx }} />
      </UnifiedMediaProvider>
    )
    
    // Create blob URL
    const url1 = await contextApi.createBlobUrl('image-1')
    expect(url1).toBe('blob:test-url')
    
    // Second call should reuse cached URL
    const url2 = await contextApi.createBlobUrl('image-1')
    expect(url2).toBe('blob:test-url')
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1) // Only called once due to cache
    
    // Delete media
    await contextApi.deleteMedia('image-1')
    
    // Cache should be cleared, so next call should try to get media again
    mediaService.getMedia.mockResolvedValueOnce(null)
    const url3 = await contextApi.createBlobUrl('image-1')
    expect(url3).toBeNull()
    
    // Blob URL should have been revoked
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url')
  })
})