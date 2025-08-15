import { describe, it, expect } from 'vitest'
import { normalizeAssetUrl } from '../assetUrlHelper'

describe('Asset URL Helper', () => {
  describe('normalizeAssetUrl', () => {
    it('should return asset:// URLs unchanged when they are already correct', () => {
      const url = 'asset://localhost/1754743011163/media/audio-0.bin'
      expect(normalizeAssetUrl(url)).toBe(url)
    })

    it('should decode URL-encoded asset URLs', () => {
      // This is the problematic double-encoded URL from the logs
      const encodedUrl = 'asset%3A%2F%2Flocalhost%2F1754743011163%2Fmedia%2Faudio-0.bin'
      const expectedUrl = 'asset://localhost/1754743011163/media/audio-0.bin'
      expect(normalizeAssetUrl(encodedUrl)).toBe(expectedUrl)
    })

    it('should remove asset.localhost prefix and decode the rest', () => {
      // This is the double-prefixed and encoded URL causing 500 errors
      const doubleUrl = 'asset.localhost/asset%3A%2F%2Flocalhost%2F1754743011163%2Fmedia%2Faudio-0.bin'
      const expectedUrl = 'asset://localhost/1754743011163/media/audio-0.bin'
      expect(normalizeAssetUrl(doubleUrl)).toBe(expectedUrl)
    })

    it('should handle https://asset.localhost prefix', () => {
      const httpsUrl = 'https://asset.localhost/1754743011163/media/image-0.bin'
      const expectedUrl = 'asset://localhost/1754743011163/media/image-0.bin'
      expect(normalizeAssetUrl(httpsUrl)).toBe(expectedUrl)
    })

    it('should handle http://asset.localhost prefix', () => {
      const httpUrl = 'http://asset.localhost/1754743011163/media/image-0.bin'
      const expectedUrl = 'asset://localhost/1754743011163/media/image-0.bin'
      expect(normalizeAssetUrl(httpUrl)).toBe(expectedUrl)
    })

    it('should preserve blob: URLs unchanged', () => {
      const blobUrl = 'blob:http://localhost:3000/12345-67890'
      expect(normalizeAssetUrl(blobUrl)).toBe(blobUrl)
    })

    it('should preserve data: URLs unchanged', () => {
      const dataUrl = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0i...'
      expect(normalizeAssetUrl(dataUrl)).toBe(dataUrl)
    })

    it('should preserve http/https URLs unchanged', () => {
      const httpUrl = 'https://example.com/image.jpg'
      expect(normalizeAssetUrl(httpUrl)).toBe(httpUrl)
      
      const youtubeUrl = 'https://youtube.com/embed/12345'
      expect(normalizeAssetUrl(youtubeUrl)).toBe(youtubeUrl)
    })

    it('should handle empty strings', () => {
      expect(normalizeAssetUrl('')).toBe('')
    })

    it('should handle null/undefined gracefully', () => {
      expect(normalizeAssetUrl(null as any)).toBe('')
      expect(normalizeAssetUrl(undefined as any)).toBe('')
    })

    it('should handle complex double-encoded URLs', () => {
      // Sometimes URLs get double or triple encoded
      const complexUrl = 'https://asset.localhost/asset%253A%252F%252Flocalhost%252F1754743011163%252Fmedia%252Faudio-0.bin'
      const expectedUrl = 'asset://localhost/1754743011163/media/audio-0.bin'
      expect(normalizeAssetUrl(complexUrl)).toBe(expectedUrl)
    })

    it('should handle URLs with query parameters', () => {
      const urlWithParams = 'asset://localhost/1754743011163/media/audio-0.bin?t=123456'
      expect(normalizeAssetUrl(urlWithParams)).toBe(urlWithParams)
    })

    it('should fix malformed asset URLs missing localhost', () => {
      const malformedUrl = 'asset://1754743011163/media/audio-0.bin'
      const expectedUrl = 'asset://localhost/1754743011163/media/audio-0.bin'
      expect(normalizeAssetUrl(malformedUrl)).toBe(expectedUrl)
    })
  })
})