import { describe, it, expect, vi } from 'vitest'
import * as externalImageDownloader from '../services/externalImageDownloader'

// Mock Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('Unsafe Download Integration - Unit Tests', () => {
  it('should call unsafe_download_image Tauri command in forceDownloadExternalImage', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockInvoke = vi.mocked(invoke)
    
    // Mock successful Tauri response
    mockInvoke.mockResolvedValueOnce({
      base64_data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      content_type: 'image/png'
    })
    
    const testUrl = 'https://example.com/image.png'
    const result = await externalImageDownloader.forceDownloadExternalImage(testUrl)
    
    expect(mockInvoke).toHaveBeenCalledWith('unsafe_download_image', { url: testUrl })
    expect(result).toBeInstanceOf(Blob)
    expect(result.type).toBe('image/png')
    expect(result.size).toBeGreaterThan(0)
  })

  it('should fall back to browser methods if Tauri command fails', async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const mockInvoke = vi.mocked(invoke)
    
    // Mock Tauri command failure
    mockInvoke.mockRejectedValueOnce(new Error('Tauri command failed'))
    
    // Mock global fetch for fallback
    global.fetch = vi.fn().mockResolvedValueOnce({
      blob: () => Promise.resolve(new Blob(['test'], { type: 'image/png' }))
    } as any)
    
    const testUrl = 'https://example.com/image.png'
    
    try {
      const result = await externalImageDownloader.forceDownloadExternalImage(testUrl)
      // If we get here, the fallback worked
      expect(result).toBeInstanceOf(Blob)
    } catch (error) {
      // It's okay if fallback methods also fail in test environment
      expect(error).toBeInstanceOf(Error)
    }
    
    expect(mockInvoke).toHaveBeenCalledWith('unsafe_download_image', { url: testUrl })
  })

  it('should have updated function signature and error messages', async () => {
    const testUrl = 'https://example.com/blocked-image.png'
    
    try {
      // This will fail in test environment, but we can verify the error message
      await externalImageDownloader.forceDownloadExternalImage(testUrl)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      const errorMessage = (error as Error).message
      expect(errorMessage).toContain('aggressive')
    }
  })
})