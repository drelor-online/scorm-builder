import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadExternalImage, isExternalUrl, downloadIfExternal, isKnownCorsRestrictedDomain } from '../externalImageDownloader'
import { invoke } from '@tauri-apps/api/core'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock fetch
global.fetch = vi.fn()

describe('ExternalImageDownloader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isExternalUrl', () => {
    it('should identify external URLs', () => {
      expect(isExternalUrl('https://example.com/image.jpg')).toBe(true)
      expect(isExternalUrl('http://example.com/image.jpg')).toBe(true)
      expect(isExternalUrl('blob:http://localhost/123')).toBe(false)
      expect(isExternalUrl('data:image/png;base64,123')).toBe(false)
      expect(isExternalUrl('/local/path/image.jpg')).toBe(false)
    })
  })

  describe('downloadExternalImage', () => {
    it('should download image through Tauri command', async () => {
      const mockResponse = {
        base64_data: 'aGVsbG8=', // "hello" in base64
        content_type: 'image/jpeg'
      }
      vi.mocked(invoke).mockResolvedValue(mockResponse)

      const blob = await downloadExternalImage('https://example.com/image.jpg')

      expect(invoke).toHaveBeenCalledWith('download_image', {
        url: 'https://example.com/image.jpg'
      })
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('image/jpeg')
      expect(blob.size).toBeGreaterThan(0)
    })

    it('should fallback to direct fetch when Tauri command fails', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Command not found'))
      
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' })
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        blob: async () => mockBlob
      } as Response)

      const blob = await downloadExternalImage('https://example.com/image.jpg')

      expect(fetch).toHaveBeenCalledWith('https://example.com/image.jpg')
      expect(blob).toBe(mockBlob)
    })

    it('should use CORS proxy as last resort', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Command not found'))
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('CORS error'))
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => new Blob(['proxy'], { type: 'image/jpeg' })
        } as Response)

      const blob = await downloadExternalImage('https://example.com/image.jpg')

      expect(fetch).toHaveBeenLastCalledWith('https://corsproxy.io/?https%3A%2F%2Fexample.com%2Fimage.jpg')
      expect(blob).toBeInstanceOf(Blob)
    })
  })

  describe('downloadIfExternal', () => {
    it('should download external URLs', async () => {
      const mockResponse = {
        base64_data: 'aGVsbG8=',
        content_type: 'image/jpeg'
      }
      vi.mocked(invoke).mockResolvedValue(mockResponse)

      const blob = await downloadIfExternal('https://example.com/image.jpg')
      
      expect(blob).toBeInstanceOf(Blob)
      expect(invoke).toHaveBeenCalled()
    })

    it('should return null for non-external URLs', async () => {
      const blob = await downloadIfExternal('blob:http://localhost/123')
      
      expect(blob).toBeNull()
      expect(invoke).not.toHaveBeenCalled()
    })
  })

  describe('isKnownCorsRestrictedDomain', () => {
    it('should identify known CORS-restricted domains', () => {
      expect(isKnownCorsRestrictedDomain('https://media.sciencephoto.com/image/123')).toBe(true)
      expect(isKnownCorsRestrictedDomain('https://www.gettyimages.com/detail/photo/123')).toBe(true)
      expect(isKnownCorsRestrictedDomain('https://shutterstock.com/image/456')).toBe(true)
      expect(isKnownCorsRestrictedDomain('https://example.com/image.jpg')).toBe(false)
      expect(isKnownCorsRestrictedDomain('https://wikipedia.org/image.jpg')).toBe(false)
    })

    it('should handle invalid URLs gracefully', () => {
      expect(isKnownCorsRestrictedDomain('not-a-url')).toBe(false)
      expect(isKnownCorsRestrictedDomain('')).toBe(false)
    })
  })
})