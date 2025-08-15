import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileStorage } from '../FileStorage'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

import { invoke } from '@tauri-apps/api/core'

describe('FileStorage - Media Data Retrieval', () => {
  let fileStorage: FileStorage
  
  beforeEach(() => {
    vi.clearAllMocks()
    fileStorage = new FileStorage()
    // Set up test project
    fileStorage['_currentProjectId'] = 'test-project'
  })

  it('should return actual media data bytes when getting media', async () => {
    // Create test image data (small PNG)
    const testImageData = new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
      0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52  // IHDR chunk start
    ])

    // Mock Tauri invoke to return media with data
    vi.mocked(invoke).mockResolvedValueOnce({
      id: 'image-0-welcome',
      metadata: {
        type: 'image',
        mime_type: 'image/png',
        page_id: 'welcome'
      },
      data: Array.from(testImageData) // Tauri returns as array
    })

    const result = await fileStorage.getMedia('image-0-welcome')
    
    // This test should FAIL initially if data is not being returned properly
    expect(result).not.toBeNull()
    expect(result?.data).toBeDefined()
    expect(result?.data).toBeInstanceOf(ArrayBuffer)
    expect(result?.data?.byteLength).toBeGreaterThan(0)
    expect(result?.data?.byteLength).toBe(16) // Our test data is 16 bytes
    
    // Verify the actual bytes are correct
    const resultBytes = new Uint8Array(result!.data!)
    expect(resultBytes[0]).toBe(0x89) // PNG magic number first byte
    expect(resultBytes[1]).toBe(0x50) // P
    expect(resultBytes[2]).toBe(0x4E) // N
    expect(resultBytes[3]).toBe(0x47) // G
  })

  it('should handle empty media data gracefully', async () => {
    // Mock Tauri invoke to return media without data
    vi.mocked(invoke).mockResolvedValueOnce({
      id: 'image-0-welcome',
      metadata: {
        type: 'image',
        mime_type: 'image/png'
      },
      data: null
    })

    const result = await fileStorage.getMedia('image-0-welcome')
    
    expect(result).not.toBeNull()
    // Should have metadata but no data
    expect(result?.metadata).toBeDefined()
    expect(result?.data).toBeDefined() // Should still be defined but might be empty
  })

  it('should convert base64 encoded data correctly', async () => {
    // Create test data and encode as base64
    const testData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]) // "Hello"
    const base64Data = btoa(String.fromCharCode(...testData))

    vi.mocked(invoke).mockResolvedValueOnce({
      id: 'test-media',
      metadata: {
        type: 'image',
        mime_type: 'image/jpeg'
      },
      data: base64Data // Some backends might return base64
    })

    const result = await fileStorage.getMedia('test-media')
    
    expect(result).not.toBeNull()
    expect(result?.data).toBeDefined()
    expect(result?.data?.byteLength).toBe(5)
    
    const resultBytes = new Uint8Array(result!.data!)
    expect(resultBytes[0]).toBe(0x48) // H
    expect(resultBytes[1]).toBe(0x65) // e
    expect(resultBytes[2]).toBe(0x6C) // l
    expect(resultBytes[3]).toBe(0x6C) // l
    expect(resultBytes[4]).toBe(0x6F) // o
  })

  it('should create valid blob URLs from media data', async () => {
    const testImageData = new Uint8Array([
      0xFF, 0xD8, 0xFF, 0xE0, // JPEG header
      0x00, 0x10, 0x4A, 0x46
    ])

    vi.mocked(invoke).mockResolvedValueOnce({
      id: 'image-test',
      metadata: {
        type: 'image',
        mime_type: 'image/jpeg'
      },
      data: Array.from(testImageData)
    })

    const mediaUrl = await fileStorage.getMediaUrl('image-test')
    
    // This test verifies blob URL creation
    expect(mediaUrl).not.toBeNull()
    expect(mediaUrl).toMatch(/^blob:/) // Should be a blob URL
  })
})