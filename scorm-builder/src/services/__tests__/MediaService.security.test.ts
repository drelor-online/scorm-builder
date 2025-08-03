import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MediaService } from '../MediaService'
import { invoke } from '@tauri-apps/api/core'

// Mock the Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({})
}))

describe('MediaService Security Features', () => {
  let mediaService: MediaService
  
  beforeEach(() => {
    vi.clearAllMocks()
    mediaService = new MediaService({ projectId: 'test-project' })
  })
  
  describe('URL Validation', () => {
    it('should reject URLs with dangerous protocols', () => {
      const dangerousUrls = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'file:///etc/passwd',
        'ftp://example.com/file',
        'vbscript:msgbox("XSS")'
      ]
      
      dangerousUrls.forEach(url => {
        expect(mediaService.validateExternalUrl(url)).toBe(false)
      })
    })
    
    it('should reject URLs pointing to local addresses', () => {
      const localUrls = [
        'http://localhost/api',
        'http://127.0.0.1:8080',
        'https://0.0.0.0/internal',
        'http://[::1]/ipv6',
        'http://169.254.169.254/', // AWS metadata
        'http://10.0.0.1/private',
        'http://192.168.1.1/router',
        'http://172.16.0.1/internal'
      ]
      
      localUrls.forEach(url => {
        expect(mediaService.validateExternalUrl(url)).toBe(false)
      })
    })
    
    it('should accept valid external URLs', () => {
      const validUrls = [
        'https://example.com/image.jpg',
        'https://cdn.example.com/media/video.mp4',
        'https://youtube.com/watch?v=abc123',
        'https://vimeo.com/123456789',
        'https://images.unsplash.com/photo.jpg',
        'http://example.com/file.pdf' // HTTP allowed but will warn
      ]
      
      validUrls.forEach(url => {
        expect(mediaService.validateExternalUrl(url)).toBe(true)
      })
    })
    
    it('should handle malformed URLs gracefully', () => {
      const malformedUrls = [
        '',
        'not-a-url',
        '//no-protocol.com',
        'ht!tp://bad-protocol.com',
        'https://',
        'https://user:pass@[malformed'
      ]
      
      malformedUrls.forEach(url => {
        expect(mediaService.validateExternalUrl(url)).toBe(false)
      })
    })
  })
  
  describe('Path Traversal Protection', () => {
    it('should reject paths with directory traversal attempts', () => {
      const dangerousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        'uploads/../../../sensitive.txt',
        'media/../../config.json',
        './././../config',
        'uploads%2F..%2F..%2Fetc%2Fpasswd', // URL encoded
        'uploads/./../../etc/passwd',
        '\\\\server\\share\\..\\..\\sensitive'
      ]
      
      dangerousPaths.forEach(path => {
        expect(mediaService.sanitizePath(path)).not.toContain('..')
        expect(mediaService.sanitizePath(path)).not.toMatch(/^[\/\\]/)
      })
    })
    
    it('should reject absolute paths', () => {
      const absolutePaths = [
        '/etc/passwd',
        'C:\\Windows\\System32\\config',
        '\\\\server\\share\\file.txt',
        '/var/www/html/index.php'
      ]
      
      absolutePaths.forEach(path => {
        const sanitized = mediaService.sanitizePath(path)
        expect(sanitized).not.toMatch(/^[\/\\]/)
        expect(sanitized).not.toMatch(/^[A-Za-z]:[\/\\]/)
      })
    })
    
    it('should allow safe relative paths', () => {
      const safePaths = [
        'media/image.jpg',
        'uploads/2024/12/file.pdf',
        'documents/report.docx',
        'audio/narration.mp3'
      ]
      
      safePaths.forEach(path => {
        expect(mediaService.sanitizePath(path)).toBe(path)
      })
    })
    
    it('should normalize path separators', () => {
      const paths = [
        { input: 'media\\subfolder\\file.jpg', expected: 'media/subfolder/file.jpg' },
        { input: 'uploads//double//slashes', expected: 'uploads/double/slashes' },
        { input: 'mixed\\path/separators\\file', expected: 'mixed/path/separators/file' }
      ]
      
      paths.forEach(({ input, expected }) => {
        expect(mediaService.sanitizePath(input)).toBe(expected)
      })
    })
  })
  
  describe('Content Security', () => {
    it('should strip sensitive data from metadata', () => {
      const sensitiveMetadata = {
        apiKey: 'sk-1234567890',
        api_key: 'secret',
        password: 'p@ssw0rd',
        token: 'bearer xyz',
        secret: 'confidential',
        privateKey: '-----BEGIN PRIVATE KEY-----',
        uploadedAt: '2024-01-01',
        fileName: 'safe.jpg'
      }
      
      const cleaned = mediaService.stripSensitiveData(sensitiveMetadata)
      
      expect(cleaned).not.toHaveProperty('apiKey')
      expect(cleaned).not.toHaveProperty('api_key')
      expect(cleaned).not.toHaveProperty('password')
      expect(cleaned).not.toHaveProperty('token')
      expect(cleaned).not.toHaveProperty('secret')
      expect(cleaned).not.toHaveProperty('privateKey')
      expect(cleaned).toHaveProperty('uploadedAt')
      expect(cleaned).toHaveProperty('fileName')
    })
    
    it('should validate media type matches file extension', () => {
      const tests = [
        { filename: 'image.jpg', type: 'image', valid: true },
        { filename: 'audio.mp3', type: 'audio', valid: true },
        { filename: 'video.mp4', type: 'video', valid: true },
        { filename: 'image.mp3', type: 'image', valid: false },
        { filename: 'audio.jpg', type: 'audio', valid: false },
        { filename: 'script.js', type: 'image', valid: false }
      ]
      
      tests.forEach(({ filename, type, valid }) => {
        expect(mediaService.validateMediaType(filename, type as any)).toBe(valid)
      })
    })
  })
  
  describe('Security Integration', () => {
    it('should reject YouTube videos with dangerous URLs', async () => {
      const dangerousUrls = [
        'javascript:alert("XSS")',
        'data:text/html,<script>alert("XSS")</script>',
        'file:///etc/passwd',
        'http://localhost/video'
      ]
      
      for (const url of dangerousUrls) {
        await expect(
          mediaService.storeYouTubeVideo(url, url, 'test-page')
        ).rejects.toThrow(/Invalid YouTube URL/)
      }
    })
    
    it('should accept valid YouTube URLs', async () => {
      const validUrls = [
        { youtube: 'https://youtube.com/watch?v=abc123', embed: 'https://youtube.com/embed/abc123' },
        { youtube: 'https://www.youtube.com/watch?v=xyz789', embed: 'https://www.youtube.com/embed/xyz789' },
        { youtube: 'https://youtu.be/def456', embed: 'https://youtube.com/embed/def456' }
      ]
      
      for (const { youtube, embed } of validUrls) {
        const result = await mediaService.storeYouTubeVideo(youtube, embed, 'test-page')
        expect(result).toBeDefined()
        expect(result.metadata.youtubeUrl).toBe(youtube)
        expect(result.metadata.embedUrl).toBe(embed)
      }
    })
    
    it('should strip sensitive data from YouTube video metadata', async () => {
      const metadata = {
        title: 'Test Video',
        apiKey: 'secret-key',
        api_key: 'another-secret',
        password: 'should-not-store'
      }
      
      const result = await mediaService.storeYouTubeVideo(
        'https://youtube.com/watch?v=test',
        'https://youtube.com/embed/test',
        'test-page',
        metadata
      )
      
      expect(result.metadata.title).toBe('Test Video')
      expect(result.metadata).not.toHaveProperty('apiKey')
      expect(result.metadata).not.toHaveProperty('api_key')
      expect(result.metadata).not.toHaveProperty('password')
    })
    
    it('should sanitize file paths in storeMedia', async () => {
      const maliciousFilenames = [
        '../../../etc/passwd.jpg',
        '..\\..\\windows\\system32\\config.png',
        'uploads/../../../sensitive.jpg'
      ]
      
      for (const filename of maliciousFilenames) {
        // Create a file-like object with arrayBuffer method
        const fileContent = new TextEncoder().encode('test')
        const buffer = fileContent.buffer
        
        // Create a mock File with arrayBuffer method
        const file = {
          name: filename,
          type: 'image/jpeg',
          size: fileContent.length,
          arrayBuffer: vi.fn().mockResolvedValue(buffer),
          slice: vi.fn(),
          stream: vi.fn(),
          text: vi.fn()
        } as unknown as File
        
        // Mock the invoke function to simulate successful storage
        vi.mocked(invoke).mockResolvedValueOnce({})
        
        const result = await mediaService.storeMedia(file, 'test-page', 'image')
        
        // Filename should be sanitized
        expect(result.fileName).not.toContain('..')
        expect(result.fileName).not.toMatch(/^[\\/]/)
        expect(result.metadata.originalName).not.toContain('..')
      }
    })
  })
})