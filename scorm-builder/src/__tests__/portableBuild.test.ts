import { describe, test, expect, vi, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'

describe('Portable Build Configuration', () => {
  
  test('should load assets without external dependencies', () => {
    // Simulate portable build environment (no internet)
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error - no internet in portable build'))
    global.fetch = mockFetch
    
    // Parse the built index.html to check for external dependencies
    const fs = require('fs')
    const path = require('path')
    const indexPath = path.join(__dirname, '../../dist/index.html')
    
    // This should fail if dist/index.html doesn't exist (build issue)
    expect(() => {
      const indexContent = fs.readFileSync(indexPath, 'utf-8')
      return indexContent
    }).not.toThrow()
    
    const indexContent = fs.readFileSync(indexPath, 'utf-8')
    
    // Check for external CDN dependencies that would cause black screen in offline mode
    expect(indexContent).not.toContain('fonts.googleapis.com') // Google Fonts CDN
    expect(indexContent).not.toContain('cdn.jsdelivr.net') // html2canvas CDN
    expect(indexContent).not.toContain('https://') // No external HTTPS resources
  })

  test('should use relative paths for all assets', () => {
    const fs = require('fs')
    const path = require('path')
    const indexPath = path.join(__dirname, '../../dist/index.html')
    
    const indexContent = fs.readFileSync(indexPath, 'utf-8')
    const dom = new JSDOM(indexContent)
    const document = dom.window.document
    
    // Check script tags use relative paths
    const scripts = document.querySelectorAll('script[src]')
    scripts.forEach(script => {
      const src = script.getAttribute('src')
      if (src) {
        // Should start with ./ for relative paths or be absolute paths starting with /
        expect(src.startsWith('./') || src.startsWith('/')).toBe(true)
        expect(src.startsWith('http')).toBe(false) // No external URLs
      }
    })
    
    // Check link tags use relative paths
    const links = document.querySelectorAll('link[href]')
    links.forEach(link => {
      const href = link.getAttribute('href')
      if (href && link.getAttribute('rel') === 'stylesheet') {
        expect(href.startsWith('./') || href.startsWith('/')).toBe(true)
        expect(href.startsWith('http')).toBe(false) // No external URLs
      }
    })
  })

  test('should have all referenced assets exist in dist folder', () => {
    const fs = require('fs')
    const path = require('path')
    const indexPath = path.join(__dirname, '../../dist/index.html')
    const distPath = path.join(__dirname, '../../dist')
    
    const indexContent = fs.readFileSync(indexPath, 'utf-8')
    const dom = new JSDOM(indexContent)
    const document = dom.window.document
    
    // Check all script files exist
    const scripts = document.querySelectorAll('script[src]')
    scripts.forEach(script => {
      const src = script.getAttribute('src')
      if (src && src.startsWith('./')) {
        const assetPath = path.join(distPath, src.substring(2)) // Remove ./
        expect(fs.existsSync(assetPath)).toBe(true)
      }
    })
    
    // Check all CSS files exist
    const links = document.querySelectorAll('link[rel="stylesheet"]')
    links.forEach(link => {
      const href = link.getAttribute('href')
      if (href && href.startsWith('./')) {
        const assetPath = path.join(distPath, href.substring(2)) // Remove ./
        expect(fs.existsSync(assetPath)).toBe(true)
      }
    })
  })

  test('should include local font fallbacks', () => {
    const fs = require('fs')
    const path = require('path')
    const indexPath = path.join(__dirname, '../../dist/index.html')
    
    const indexContent = fs.readFileSync(indexPath, 'utf-8')
    
    // Should include fallback fonts that work offline
    const hasSystemFontFallbacks = 
      indexContent.includes('-apple-system') ||
      indexContent.includes('BlinkMacSystemFont') ||
      indexContent.includes('sans-serif') ||
      indexContent.includes('system-ui')
    
    expect(hasSystemFontFallbacks).toBe(true)
  })

  test('should work in offline environment', async () => {
    // Mock offline environment
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    })
    
    // Mock fetch to always fail (simulating no internet)
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    
    // App should still be able to initialize without external resources
    const { setupMockTauri } = await import('../mocks/mockTauriAPI')
    
    // This should not throw even in offline mode
    expect(() => {
      setupMockTauri()
    }).not.toThrow()
  })

  test('should not depend on development-only features', () => {
    const fs = require('fs')
    const path = require('path')
    
    // Check that HMR and other dev features are not in production build
    const indexPath = path.join(__dirname, '../../dist/index.html')
    const indexContent = fs.readFileSync(indexPath, 'utf-8')
    
    expect(indexContent).not.toContain('/@vite/client') // Vite dev client
    expect(indexContent).not.toContain('localhost:') // Dev server references
    expect(indexContent).not.toContain('HMR') // Hot module replacement
  })
})