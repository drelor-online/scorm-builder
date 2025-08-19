import { describe, it, expect } from 'vitest'
import { generateCSPHeader, CSP_CONFIG } from './security'

describe('Content Security Policy Configuration', () => {
  describe('YouTube iframe embedding', () => {
    it('should not block YouTube from being embedded with frame-ancestors directive', () => {
      // frame-ancestors controls who can embed THIS page, not what THIS page can embed
      // Setting it to 'none' can cause issues with YouTube's embed checks
      
      // Check that frame-ancestors is not set to 'none'
      expect(CSP_CONFIG['frame-ancestors']).not.toEqual(["'none'"])
      
      // It should either be undefined, ['self'], or allow specific origins
      if (CSP_CONFIG['frame-ancestors']) {
        expect(CSP_CONFIG['frame-ancestors']).not.toContain("'none'")
      }
    })

    it('should allow YouTube domains in frame-src directive', () => {
      // frame-src controls what THIS page can embed in iframes
      expect(CSP_CONFIG['frame-src']).toContain('https://www.youtube.com')
      expect(CSP_CONFIG['frame-src']).toContain('https://youtube.com')
      expect(CSP_CONFIG['frame-src']).toContain('https://www.youtube-nocookie.com')
    })

    it('should generate correct CSP header for production', () => {
      const cspHeader = generateCSPHeader(false) // production mode
      
      // Should not have frame-ancestors set to none
      expect(cspHeader).not.toContain("frame-ancestors 'none'")
      
      // Should allow YouTube in frame-src
      expect(cspHeader).toContain('frame-src')
      expect(cspHeader).toContain('https://www.youtube.com')
    })

    it('should generate correct CSP header for development', () => {
      const cspHeader = generateCSPHeader(true) // development mode
      
      // Should not have frame-ancestors set to none
      expect(cspHeader).not.toContain("frame-ancestors 'none'")
      
      // Should allow YouTube in frame-src
      expect(cspHeader).toContain('frame-src')
      expect(cspHeader).toContain('https://www.youtube.com')
    })
  })
})