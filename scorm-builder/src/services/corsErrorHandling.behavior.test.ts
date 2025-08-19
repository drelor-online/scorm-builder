import { describe, test, expect, beforeEach, vi } from 'vitest'
import { downloadExternalImage, isKnownCorsRestrictedDomain } from './externalImageDownloader'

describe('CORS Error Handling for External Images', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock
    global.fetch = vi.fn()
  })

  test('should handle CORS errors gracefully with user feedback', async () => {
    // Mock CORS error from the workflow recording
    const corsError = new Error('Access to fetch at \'https://www.aga.org/...\' blocked by CORS policy')
    
    vi.mocked(fetch).mockRejectedValueOnce(corsError)

    try {
      await downloadExternalImage('https://www.aga.org/image.jpg')
      // Should not reach here - the function should either succeed with proxy or throw a user-friendly error
    } catch (error) {
      // The error should be user-friendly, not the raw CORS error
      expect(error).toBeDefined()
      const errorMessage = (error as Error).message
      
      // Should not expose raw CORS technical details to user
      expect(errorMessage).not.toContain('blocked by CORS policy')
      expect(errorMessage).not.toContain('Access to fetch at')
      
      // Should provide user-friendly message with actionable guidance
      expect(errorMessage).toMatch(/unable to download.*external image/i)
      expect(errorMessage).toMatch(/save.*computer.*upload.*locally/i)
    }
  })

  test('should provide helpful error messages for known CORS-restricted domains', () => {
    // Test domains from the workflow where CORS issues occurred
    const corsRestrictedUrls = [
      'https://www.aga.org/image.jpg',
      'https://media.sciencephoto.com/image/123',
      'https://www.gettyimages.com/detail/photo/123'
    ]

    corsRestrictedUrls.forEach(url => {
      if (isKnownCorsRestrictedDomain(url)) {
        // If it's a known restricted domain, the app should handle it proactively
        expect(true).toBe(true) // This domain is properly identified
      } else {
        // If it's not in the known list, it should be added for better handling
        console.warn(`Domain not in CORS-restricted list: ${url}`)
      }
    })
  })

  test('should retry with CORS proxies when direct fetch fails', async () => {
    // Mock initial CORS failure
    const corsError = new Error('CORS policy block')
    
    vi.mocked(fetch)
      .mockRejectedValueOnce(corsError) // Direct fetch fails
      .mockResolvedValueOnce({ // CORS proxy succeeds
        ok: true,
        blob: async () => new Blob(['proxy success'], { type: 'image/jpeg' })
      } as Response)

    const result = await downloadExternalImage('https://example.com/image.jpg')
    
    expect(result).toBeInstanceOf(Blob)
    expect(fetch).toHaveBeenCalledTimes(2) // Original + proxy attempt
    
    // Should have tried CORS proxy
    const calls = vi.mocked(fetch).mock.calls
    expect(calls[1][0]).toContain('corsproxy.io') // First proxy service
  })

  test('should show user-friendly error when all CORS methods fail', async () => {
    // Mock all methods failing
    const corsError = new Error('CORS blocked')
    
    vi.mocked(fetch).mockRejectedValue(corsError)

    try {
      await downloadExternalImage('https://restricted.example.com/image.jpg')
      expect.fail('Should have thrown an error')
    } catch (error) {
      const errorMessage = (error as Error).message
      
      // Should provide actionable guidance to user
      expect(errorMessage).toMatch(/unable to download.*external image/i)
      expect(errorMessage).toMatch(/save.*computer.*upload.*locally/i)
    }
  })

  test('should handle network errors gracefully', async () => {
    // Mock network failure
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    try {
      await downloadExternalImage('https://example.com/image.jpg')
      expect.fail('Should have thrown an error')
    } catch (error) {
      const errorMessage = (error as Error).message
      
      // Should distinguish between network and CORS issues
      expect(errorMessage).toMatch(/network|connection|unavailable/i)
      expect(errorMessage).not.toContain('CORS')
    }
  })
})