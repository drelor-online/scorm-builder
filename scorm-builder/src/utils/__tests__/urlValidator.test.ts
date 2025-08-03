import { describe, it, expect, vi } from 'vitest'
import {
  validateExternalURL,
  validateYouTubeURL,
  validateImageURL,
  createURLValidator,
  URLValidators,
  URLValidationError
} from '../urlValidator'

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('urlValidator', () => {
  describe('validateExternalURL', () => {
    it('should validate HTTPS URLs', () => {
      const result = validateExternalURL('https://example.com/page')
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('https://example.com/page')
      expect(result.reason).toBeUndefined()
    })
    
    it('should validate HTTP URLs by default', () => {
      const result = validateExternalURL('http://example.com')
      expect(result.valid).toBe(true)
      expect(result.sanitized).toBe('http://example.com/')
    })
    
    it('should reject javascript: protocol', () => {
      const result = validateExternalURL('javascript:alert("XSS")')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Dangerous protocol: javascript:')
    })
    
    it('should reject vbscript: protocol', () => {
      const result = validateExternalURL('vbscript:msgbox("XSS")')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Dangerous protocol: vbscript:')
    })
    
    it('should reject file: protocol', () => {
      const result = validateExternalURL('file:///etc/passwd')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Dangerous protocol: file:')
    })
    
    it('should reject data: URLs by default', () => {
      const result = validateExternalURL('data:text/html,<script>alert("XSS")</script>')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Dangerous protocol: data:')
    })
    
    it('should allow safe data: URLs when enabled', () => {
      const result = validateExternalURL(
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVQI12P4DwABAQEAWk1v8QAAAABJRU5ErkJggg==',
        { allowDataURLs: true }
      )
      expect(result.valid).toBe(true)
    })
    
    it('should reject unsafe data: URLs even when enabled', () => {
      const result = validateExternalURL(
        'data:text/javascript,alert("XSS")',
        { allowDataURLs: true }
      )
      expect(result.valid).toBe(false)
    })
    
    it('should reject localhost by default', () => {
      const result = validateExternalURL('http://localhost:3000/api')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Internal hostname not allowed: localhost')
    })
    
    it('should reject 127.0.0.1', () => {
      const result = validateExternalURL('http://127.0.0.1/admin')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Internal hostname not allowed: 127.0.0.1')
    })
    
    it('should reject private IP ranges', () => {
      const privateIPs = [
        '10.0.0.1',
        '172.16.0.1',
        '192.168.1.1',
        '169.254.169.254' // AWS metadata
      ]
      
      privateIPs.forEach(ip => {
        const result = validateExternalURL(`http://${ip}/`)
        expect(result.valid).toBe(false)
        // The reason will contain either 'Private IP not allowed' or 'Internal hostname not allowed'
        expect(result.reason).toMatch(/Private IP not allowed|Internal hostname not allowed/)
      })
    })
    
    it('should allow localhost when option is set', () => {
      const result = validateExternalURL('http://localhost:3000', { allowLocalhost: true })
      expect(result.valid).toBe(true)
    })
    
    it('should enforce allowed domains when specified', () => {
      const options = { allowedDomains: ['example.com', 'trusted.org'] }
      
      // Should allow exact match
      let result = validateExternalURL('https://example.com/page', options)
      expect(result.valid).toBe(true)
      
      // Should allow subdomain
      result = validateExternalURL('https://api.example.com/v1', options)
      expect(result.valid).toBe(true)
      
      // Should reject other domains
      result = validateExternalURL('https://malicious.com/steal', options)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Domain not allowed: malicious.com')
    })
    
    it('should handle invalid URL formats', () => {
      const invalidUrls = [
        'not-a-url',
        'ftp://invalid-protocol.com',
        'http://',
        '://missing-protocol',
        'http://[invalid-ipv6',
        ''
      ]
      
      invalidUrls.forEach(url => {
        const result = validateExternalURL(url)
        expect(result.valid).toBe(false)
      })
    })
    
    it('should handle null and undefined inputs', () => {
      // @ts-ignore - Testing invalid input
      let result = validateExternalURL(null)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Invalid URL format')
      
      // @ts-ignore - Testing invalid input
      result = validateExternalURL(undefined)
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Invalid URL format')
    })
    
    it('should handle custom blocked domains', () => {
      const result = validateExternalURL('https://blocked.example.com', {
        blockedDomains: ['blocked.example.com']
      })
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Internal hostname not allowed: blocked.example.com')
    })
    
    it('should handle custom allowed protocols', () => {
      const result = validateExternalURL('ftp://files.example.com', {
        allowedProtocols: ['ftp:', 'https:']
      })
      expect(result.valid).toBe(true)
    })
  })
  
  describe('validateYouTubeURL', () => {
    it('should validate youtube.com watch URLs', () => {
      const result = validateYouTubeURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })
    
    it('should validate youtu.be short URLs', () => {
      const result = validateYouTubeURL('https://youtu.be/dQw4w9WgXcQ')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })
    
    it('should validate youtube.com embed URLs', () => {
      const result = validateYouTubeURL('https://www.youtube.com/embed/dQw4w9WgXcQ')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })
    
    it('should validate youtube-nocookie.com URLs', () => {
      const result = validateYouTubeURL('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })
    
    it('should handle URLs with additional parameters', () => {
      const result = validateYouTubeURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf&index=1')
      expect(result.valid).toBe(true)
      expect(result.videoId).toBe('dQw4w9WgXcQ')
    })
    
    it('should reject non-YouTube domains', () => {
      const result = validateYouTubeURL('https://vimeo.com/123456')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Domain not allowed: vimeo.com')
    })
    
    it('should reject YouTube URLs without video ID', () => {
      const result = validateYouTubeURL('https://www.youtube.com/channel/UC123456')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('No video ID found in YouTube URL')
    })
    
    it('should reject invalid video ID format', () => {
      const result = validateYouTubeURL('https://www.youtube.com/watch?v=invalid!')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Invalid YouTube video ID format')
    })
    
    it('should reject malformed YouTube URLs', () => {
      const result = validateYouTubeURL('https://youtube.com/watch?video=123')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('No video ID found in YouTube URL')
    })
  })
  
  describe('validateImageURL', () => {
    it('should allow data URLs for images by default', () => {
      const result = validateImageURL('data:image/png;base64,iVBORw0KGgo...')
      expect(result.valid).toBe(true)
    })
    
    it('should reject data URLs when explicitly disabled', () => {
      const result = validateImageURL('data:image/png;base64,iVBORw0KGgo...', { allowDataURLs: false })
      expect(result.valid).toBe(false)
    })
    
    it('should validate HTTPS image URLs', () => {
      const result = validateImageURL('https://example.com/image.png')
      expect(result.valid).toBe(true)
    })
    
    it('should inherit validation rules from validateExternalURL', () => {
      const result = validateImageURL('javascript:void(0)')
      expect(result.valid).toBe(false)
    })
  })
  
  describe('createURLValidator', () => {
    it('should create a validator with preset options', () => {
      const validator = createURLValidator({
        allowedProtocols: ['https:'],
        allowLocalhost: false
      })
      
      // Should reject HTTP
      let result = validator('http://example.com')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Protocol not allowed: http:')
      
      // Should allow HTTPS
      result = validator('https://example.com')
      expect(result.valid).toBe(true)
    })
    
    it('should allow overriding preset options', () => {
      const validator = createURLValidator({
        allowedProtocols: ['https:']
      })
      
      // Override to allow HTTP
      const result = validator('http://example.com', {
        allowedProtocols: ['http:', 'https:']
      })
      expect(result.valid).toBe(true)
    })
  })
  
  describe('URLValidators presets', () => {
    it('strict validator should only allow HTTPS', () => {
      const result = URLValidators.strict('http://example.com')
      expect(result.valid).toBe(false)
      expect(result.reason).toBe('Protocol not allowed: http:')
    })
    
    it('strict validator should reject data URLs', () => {
      const result = URLValidators.strict('data:image/png;base64,test')
      expect(result.valid).toBe(false)
    })
    
    it('standard validator should allow HTTP and HTTPS', () => {
      expect(URLValidators.standard('http://example.com').valid).toBe(true)
      expect(URLValidators.standard('https://example.com').valid).toBe(true)
    })
    
    it('standard validator should allow data URLs', () => {
      const result = URLValidators.standard('data:image/png;base64,test')
      expect(result.valid).toBe(true)
    })
    
    it('development validator should allow localhost', () => {
      const result = URLValidators.development('http://localhost:3000')
      expect(result.valid).toBe(true)
    })
  })
  
  describe('Private IP detection', () => {
    it('should detect various private IP formats', () => {
      const privateIPs = [
        '10.0.0.1',
        '10.255.255.255',
        '172.16.0.1',
        '172.31.255.255',
        '192.168.0.1',
        '192.168.255.255',
        '127.0.0.1',
        '127.255.255.255',
        '169.254.0.1',
        '169.254.255.255'
      ]
      
      privateIPs.forEach(ip => {
        const result = validateExternalURL(`http://${ip}/`)
        expect(result.valid).toBe(false)
        expect(result.reason).toContain('not allowed')
      })
      
      // Test IPv6 separately as they might fail differently
      const ipv6Addresses = ['::1', 'fe80::1', 'fc00::1', 'fd00::1']
      ipv6Addresses.forEach(ip => {
        const result = validateExternalURL(`http://[${ip}]/`)
        expect(result.valid).toBe(false)
      })
    })
    
    it('should allow public IPs', () => {
      const publicIPs = [
        '8.8.8.8',
        '1.1.1.1',
        '172.32.0.1', // Outside private range
        '192.169.0.1', // Outside private range
        '11.0.0.1'
      ]
      
      publicIPs.forEach(ip => {
        const result = validateExternalURL(`https://${ip}/`)
        expect(result.valid).toBe(true)
      })
    })
    
    it('should reject invalid IP formats', () => {
      const result = validateExternalURL('http://999.999.999.999/')
      // This will be caught as invalid URL format
      expect(result.valid).toBe(false)
    })
  })
})