import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { blobUrlManager } from '../blobUrlManager'

describe('BlobURLManager - Lifecycle Management', () => {
  let revokeObjectURLSpy: any
  let createObjectURLSpy: any

  let blobCounter = 0
  
  beforeEach(() => {
    blobCounter = 0
    // Mock URL.createObjectURL and URL.revokeObjectURL
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      return `blob:http://localhost/test-${Date.now()}-${++blobCounter}`
    })
    
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    
    // Clear any existing URLs
    blobUrlManager.cleanup()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    blobUrlManager.cleanup()
  })

  it('should create a blob URL when requested', () => {
    const blob = new Blob(['test data'], { type: 'text/plain' })
    const url = blobUrlManager.getOrCreateUrl('test-key', blob)
    
    expect(url).toBeTruthy()
    expect(url).toContain('blob:')
    expect(createObjectURLSpy).toHaveBeenCalledWith(blob)
  })

  it('should reuse existing blob URL for same key', () => {
    const blob = new Blob(['test data'], { type: 'text/plain' })
    
    const url1 = blobUrlManager.getOrCreateUrl('test-key', blob)
    const url2 = blobUrlManager.getOrCreateUrl('test-key', blob)
    
    expect(url1).toBe(url2)
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1) // Only called once
  })

  it('should increment reference count when URL is reused', () => {
    const blob = new Blob(['test data'], { type: 'text/plain' })
    
    const url1 = blobUrlManager.getOrCreateUrl('test-key', blob)
    const url2 = blobUrlManager.getOrCreateUrl('test-key', blob)
    const url3 = blobUrlManager.getOrCreateUrl('test-key', blob)
    
    // Release twice - should not revoke yet
    blobUrlManager.revokeUrl('test-key')
    blobUrlManager.revokeUrl('test-key')
    
    expect(revokeObjectURLSpy).not.toHaveBeenCalled()
    
    // Third release should revoke
    blobUrlManager.revokeUrl('test-key')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(url1)
  })

  it('should not revoke URL while references exist', () => {
    const blob = new Blob(['test data'], { type: 'text/plain' })
    const url = blobUrlManager.getOrCreateUrl('test-key', blob)
    
    // Get reference again (simulating another component using it)
    blobUrlManager.getOrCreateUrl('test-key', blob)
    
    // Release once - should not revoke
    blobUrlManager.revokeUrl('test-key')
    expect(revokeObjectURLSpy).not.toHaveBeenCalled()
    
    // URL should still be accessible
    const urlAgain = blobUrlManager.getUrl('test-key')
    expect(urlAgain).toBe(url)
  })

  it('should revoke URL when reference count reaches zero', () => {
    const blob = new Blob(['test data'], { type: 'text/plain' })
    const url = blobUrlManager.getOrCreateUrl('test-key', blob)
    
    // Release the only reference
    blobUrlManager.revokeUrl('test-key')
    
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(url)
    
    // URL should no longer be accessible
    const urlAgain = blobUrlManager.getUrl('test-key')
    expect(urlAgain).toBeNull()
  })

  it('should handle multiple different URLs independently', () => {
    const blob1 = new Blob(['data1'], { type: 'text/plain' })
    const blob2 = new Blob(['data2'], { type: 'text/plain' })
    
    const url1 = blobUrlManager.getOrCreateUrl('key1', blob1)
    const url2 = blobUrlManager.getOrCreateUrl('key2', blob2)
    
    expect(url1).not.toBe(url2)
    
    // Release first URL
    blobUrlManager.revokeUrl('key1')
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(url1)
    expect(revokeObjectURLSpy).not.toHaveBeenCalledWith(url2)
    
    // Second URL should still exist
    const url2Again = blobUrlManager.getUrl('key2')
    expect(url2Again).toBe(url2)
  })

  it('should cleanup all URLs when cleanup is called', () => {
    const blob1 = new Blob(['data1'], { type: 'text/plain' })
    const blob2 = new Blob(['data2'], { type: 'text/plain' })
    const blob3 = new Blob(['data3'], { type: 'text/plain' })
    
    const url1 = blobUrlManager.getOrCreateUrl('key1', blob1)
    const url2 = blobUrlManager.getOrCreateUrl('key2', blob2)
    const url3 = blobUrlManager.getOrCreateUrl('key3', blob3)
    
    // Get additional references
    blobUrlManager.getOrCreateUrl('key1', blob1)
    blobUrlManager.getOrCreateUrl('key2', blob2)
    
    // Cleanup should revoke all URLs regardless of ref count
    blobUrlManager.cleanup()
    
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(url1)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(url2)
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(url3)
    
    // All URLs should be gone
    expect(blobUrlManager.getUrl('key1')).toBeNull()
    expect(blobUrlManager.getUrl('key2')).toBeNull()
    expect(blobUrlManager.getUrl('key3')).toBeNull()
  })

  it('should track metadata with blob URLs', () => {
    const blob = new Blob(['test data'], { type: 'image/jpeg' })
    const metadata = {
      mediaId: 'image-123',
      projectId: 'project-456',
      size: blob.size
    }
    
    const url = blobUrlManager.getOrCreateUrl('test-key', blob, metadata)
    
    expect(url).toBeTruthy()
    // Metadata is stored internally and used for debugging/tracking
  })

  it('should handle rapid mount/unmount cycles', () => {
    const blob = new Blob(['test data'], { type: 'text/plain' })
    
    // Simulate rapid component mount/unmount
    for (let i = 0; i < 10; i++) {
      // Mount - get URL
      const url = blobUrlManager.getOrCreateUrl('test-key', blob)
      expect(url).toBeTruthy()
      
      // Unmount - release URL
      blobUrlManager.revokeUrl('test-key')
    }
    
    // Should have created and revoked URL 10 times
    expect(createObjectURLSpy).toHaveBeenCalledTimes(10)
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(10)
  })

  it('should not revoke URL if key does not exist', () => {
    // Try to revoke non-existent URL
    blobUrlManager.revokeUrl('non-existent-key')
    
    // Should not throw and should not call revokeObjectURL
    expect(revokeObjectURLSpy).not.toHaveBeenCalled()
  })
})