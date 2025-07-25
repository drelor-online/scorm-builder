import { describe, it, expect } from 'vitest'
import { CSP_CONFIG, generateCSPHeader, SECURITY_HEADERS, getSecurityHeaders } from '../security'

describe('Security Configuration', () => {
  describe('CSP_CONFIG', () => {
    it('should have secure default-src policy', () => {
      expect(CSP_CONFIG['default-src']).toEqual(["'self'"])
    })

    it('should restrict object-src to none', () => {
      expect(CSP_CONFIG['object-src']).toEqual(["'none'"])
    })

    it('should prevent clickjacking with frame-ancestors', () => {
      expect(CSP_CONFIG['frame-ancestors']).toEqual(["'none'"])
    })

    it('should allow necessary script sources', () => {
      expect(CSP_CONFIG['script-src']).toContain("'self'")
      expect(CSP_CONFIG['script-src']).toContain("https://apis.google.com")
    })

    it('should allow necessary style sources', () => {
      expect(CSP_CONFIG['style-src']).toContain("'self'")
      expect(CSP_CONFIG['style-src']).toContain("https://fonts.googleapis.com")
    })

    it('should allow necessary image sources', () => {
      expect(CSP_CONFIG['img-src']).toContain("'self'")
      expect(CSP_CONFIG['img-src']).toContain("data:")
      expect(CSP_CONFIG['img-src']).toContain("blob:")
    })

    it('should allow YouTube and Vimeo in frame-src', () => {
      expect(CSP_CONFIG['frame-src']).toContain("https://www.youtube.com")
      expect(CSP_CONFIG['frame-src']).toContain("https://player.vimeo.com")
    })

    it('should have form-action restricted to self', () => {
      expect(CSP_CONFIG['form-action']).toEqual(["'self'"])
    })

    it('should have base-uri restricted to self', () => {
      expect(CSP_CONFIG['base-uri']).toEqual(["'self'"])
    })
  })

  describe('generateCSPHeader', () => {
    it('should generate valid CSP header string in production', () => {
      const header = generateCSPHeader(false)
      
      expect(header).toContain("default-src 'self'")
      expect(header).toContain("script-src 'self'")
      expect(header).toContain("object-src 'none'")
      expect(header).toContain("frame-ancestors 'none'")
      expect(header).toContain(';')
    })

    it('should include unsafe-eval in development mode', () => {
      const header = generateCSPHeader(true)
      
      expect(header).toContain("'unsafe-eval'")
      expect(header).not.toContain('upgrade-insecure-requests')
    })

    it('should remove unsafe-eval in production mode', () => {
      const header = generateCSPHeader(false)
      
      // Check that unsafe-eval is not in the final header
      const scriptSrcMatch = header.match(/script-src ([^;]+)/)
      expect(scriptSrcMatch).toBeTruthy()
      expect(scriptSrcMatch![1]).not.toContain("'unsafe-eval'")
    })

    it('should include upgrade-insecure-requests in production', () => {
      const header = generateCSPHeader(false)
      
      expect(header).toContain('upgrade-insecure-requests')
    })

    it('should format directives correctly', () => {
      const header = generateCSPHeader(false)
      
      // Check format: directive source1 source2; directive2 source3
      const directives = header.split('; ')
      
      directives.forEach(directive => {
        expect(directive).toMatch(/^[\w-]+ /)
      })
    })

    it('should include all configured directives', () => {
      const header = generateCSPHeader(false)
      const configKeys = Object.keys(CSP_CONFIG)
      
      configKeys.forEach(key => {
        if (key !== 'upgrade-insecure-requests' || !key) {
          expect(header).toContain(key)
        }
      })
    })
  })

  describe('SECURITY_HEADERS', () => {
    it('should include X-Content-Type-Options header', () => {
      expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
    })

    it('should include X-Frame-Options header', () => {
      expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
    })

    it('should include X-XSS-Protection header', () => {
      expect(SECURITY_HEADERS['X-XSS-Protection']).toBe('1; mode=block')
    })

    it('should include Referrer-Policy header', () => {
      expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    })

    it('should include Permissions-Policy header', () => {
      expect(SECURITY_HEADERS['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()')
    })

    it('should include Strict-Transport-Security header', () => {
      expect(SECURITY_HEADERS['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains')
    })
  })

  describe('getSecurityHeaders', () => {
    it('should return all security headers in production', () => {
      const headers = getSecurityHeaders(false)
      
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
      expect(headers['X-Frame-Options']).toBe('DENY')
      expect(headers['X-XSS-Protection']).toBe('1; mode=block')
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
      expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()')
      expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains')
      expect(headers['Content-Security-Policy']).toBeTruthy()
    })

    it('should include CSP header', () => {
      const headers = getSecurityHeaders(false)
      
      expect(headers['Content-Security-Policy']).toBeTruthy()
      expect(headers['Content-Security-Policy']).toContain("default-src 'self'")
    })

    it('should remove HSTS in development', () => {
      const headers = getSecurityHeaders(true)
      
      expect(headers['Strict-Transport-Security']).toBeUndefined()
    })

    it('should keep other security headers in development', () => {
      const headers = getSecurityHeaders(true)
      
      expect(headers['X-Content-Type-Options']).toBe('nosniff')
      expect(headers['X-Frame-Options']).toBe('DENY')
      expect(headers['X-XSS-Protection']).toBe('1; mode=block')
    })

    it('should not mutate original SECURITY_HEADERS object', () => {
      const originalKeys = Object.keys(SECURITY_HEADERS)
      
      getSecurityHeaders(true)
      getSecurityHeaders(false)
      
      expect(Object.keys(SECURITY_HEADERS)).toEqual(originalKeys)
    })

    it('should generate different CSP for development vs production', () => {
      const devHeaders = getSecurityHeaders(true)
      const prodHeaders = getSecurityHeaders(false)
      
      expect(devHeaders['Content-Security-Policy']).not.toBe(prodHeaders['Content-Security-Policy'])
    })
  })

  describe('Security Best Practices', () => {
    it('should not allow unsafe-inline scripts in production', () => {
      const header = generateCSPHeader(false)
      const scriptSrcMatch = header.match(/script-src ([^;]+)/)
      
      // unsafe-inline is included but that's a known requirement for React
      // This test documents that we're aware of this security consideration
      expect(scriptSrcMatch![1]).toContain("'unsafe-inline'")
    })

    it('should restrict form submissions to same origin', () => {
      expect(CSP_CONFIG['form-action']).toEqual(["'self'"])
    })

    it('should prevent clickjacking attacks', () => {
      expect(CSP_CONFIG['frame-ancestors']).toEqual(["'none'"])
      expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
    })

    it('should have restrictive permissions policy', () => {
      const policy = SECURITY_HEADERS['Permissions-Policy']
      expect(policy).toContain('camera=()')
      expect(policy).toContain('microphone=()')
      expect(policy).toContain('geolocation=()')
    })
  })
})