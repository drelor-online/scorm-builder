import { describe, it, expect, vi } from 'vitest'
import * as path from 'path'
import {
  sanitizePath,
  safeJoin,
  createPathSanitizer,
  PathSanitizers,
  sanitizeFilename,
  isPathWithinDirectory,
  PathTraversalError
} from '../pathSanitizer'

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('pathSanitizer', () => {
  const testBaseDir = '/test/base/dir'
  
  describe('sanitizePath', () => {
    it('should allow safe relative paths', () => {
      const result = sanitizePath('subfolder/file.txt', { baseDir: testBaseDir })
      expect(result.safe).toBe(true)
      expect(result.sanitized).toBe('subfolder/file.txt')
      expect(result.reason).toBeUndefined()
    })
    
    it('should detect directory traversal attempts', () => {
      const traversalPaths = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        'folder/../../../etc/passwd',
        './../../secret.txt',
        'legitimate/../../../etc/passwd'
      ]
      
      traversalPaths.forEach(dangerousPath => {
        const result = sanitizePath(dangerousPath)
        expect(result.safe).toBe(false)
        // The reason will be either 'Directory traversal attempt detected' or 'Path escapes base directory'
        expect(result.reason).toMatch(/Directory traversal attempt detected|Path escapes base directory/)
      })
    })
    
    it('should detect URL encoded traversal attempts', () => {
      const encodedPaths = [
        '%2e%2e/etc/passwd',
        '%2e%2e%2f%2e%2e%2fpasswd',
        '%252e%252e/passwd',
        'folder/%2e%2e/secret'
      ]
      
      encodedPaths.forEach(encodedPath => {
        const result = sanitizePath(encodedPath)
        expect(result.safe).toBe(false)
        expect(result.reason).toBe('Directory traversal attempt detected')
      })
    })
    
    it('should reject null bytes', () => {
      const nullBytePaths = [
        'file.txt\0.jpg',
        'folder\x00/file.txt',
        'test\u0000file'
      ]
      
      nullBytePaths.forEach(nullPath => {
        const result = sanitizePath(nullPath)
        expect(result.safe).toBe(false)
        expect(result.reason).toBe('Null byte in path')
      })
    })
    
    it('should reject absolute paths by default', () => {
      const absolutePaths = [
        '/etc/passwd',
        'C:\\Windows\\System32',
        '\\\\server\\share\\file',
        'D:/secret/file.txt'
      ]
      
      absolutePaths.forEach(absPath => {
        const result = sanitizePath(absPath)
        expect(result.safe).toBe(false)
        // Absolute paths might be caught by different checks
        expect(result.reason).toMatch(/Absolute paths not allowed|Directory traversal attempt detected/)
      })
    })
    
    it('should allow absolute paths when option is set', () => {
      const result = sanitizePath('/allowed/absolute/path', {
        allowAbsolute: true,
        baseDir: '/'
      })
      expect(result.safe).toBe(true)
    })
    
    it('should enforce maximum depth', () => {
      const deepPath = 'a/b/c/d/e/f/g/h/file.txt'
      const result = sanitizePath(deepPath, { maxDepth: 3 })
      expect(result.safe).toBe(false)
      expect(result.reason).toBe('Path depth exceeds maximum of 3')
    })
    
    it('should allow paths within max depth', () => {
      const result = sanitizePath('a/b/file.txt', { maxDepth: 3 })
      expect(result.safe).toBe(true)
    })
    
    it('should reject dot files by default', () => {
      const dotFiles = [
        '.env',
        'folder/.gitignore',
        '.hidden/file.txt',
        'path/to/.secret'
      ]
      
      dotFiles.forEach(dotFile => {
        const result = sanitizePath(dotFile)
        expect(result.safe).toBe(false)
        expect(result.reason).toBe('Dot files not allowed')
      })
    })
    
    it('should allow dot files when option is set', () => {
      const result = sanitizePath('.config/settings.json', { allowDotFiles: true })
      expect(result.safe).toBe(true)
    })
    
    it('should enforce allowed extensions', () => {
      const options = { allowedExtensions: ['.txt', '.pdf', '.doc'] }
      
      // Should allow
      let result = sanitizePath('document.pdf', options)
      expect(result.safe).toBe(true)
      
      // Should reject
      result = sanitizePath('script.exe', options)
      expect(result.safe).toBe(false)
      expect(result.reason).toBe('File extension not allowed: .exe')
    })
    
    it('should handle paths without extensions when extensions are restricted', () => {
      const result = sanitizePath('README', { allowedExtensions: ['.txt'] })
      expect(result.safe).toBe(true) // No extension is allowed
    })
    
    it('should detect blocked patterns', () => {
      const sensitivePaths = [
        'node_modules/package/index.js',
        '.git/config',
        'secrets/api.key',
        'private/data.json',
        'credentials.pem',
        'server.key',
        'certificate.crt'
      ]
      
      sensitivePaths.forEach(sensitivePath => {
        const result = sanitizePath(sensitivePath)
        expect(result.safe).toBe(false)
        // .git is a dot file, so it might be caught by that check first
        expect(result.reason).toMatch(/Path matches blocked pattern|Dot files not allowed/)
      })
    })
    
    it('should handle custom blocked patterns', () => {
      const result = sanitizePath('test/custom-blocked/file.txt', {
        blockedPatterns: [/custom-blocked/]
      })
      expect(result.safe).toBe(false)
      expect(result.reason).toBe('Path matches blocked pattern')
    })
    
    it('should prevent escaping base directory', () => {
      const result = sanitizePath('../outside/file.txt', {
        baseDir: '/safe/directory',
        allowAbsolute: false
      })
      expect(result.safe).toBe(false)
    })
    
    it('should handle empty and invalid inputs', () => {
      // @ts-ignore - Testing invalid input
      expect(sanitizePath(null).safe).toBe(false)
      // @ts-ignore - Testing invalid input
      expect(sanitizePath(undefined).safe).toBe(false)
      expect(sanitizePath('').safe).toBe(false)
      // @ts-ignore - Testing invalid input
      expect(sanitizePath(123).safe).toBe(false)
    })
    
    it('should normalize path separators', () => {
      const mixedPath = 'folder\\subfolder/file.txt'
      const result = sanitizePath(mixedPath)
      expect(result.safe).toBe(true)
      expect(result.sanitized).toBe('folder/subfolder/file.txt')
    })
  })
  
  describe('safeJoin', () => {
    it('should join path segments safely', () => {
      const joined = safeJoin('/base', 'folder', 'subfolder', 'file.txt')
      expect(joined).toBe(path.resolve('/base/folder/subfolder/file.txt'))
    })
    
    it('should throw on traversal attempts in segments', () => {
      expect(() => {
        safeJoin('/base', 'folder', '../../../etc', 'passwd')
      }).toThrow(PathTraversalError)
    })
    
    it('should throw if result escapes base directory', () => {
      expect(() => {
        safeJoin('/base/dir', '..', '..', '..', 'escape')
      }).toThrow('Path escapes base directory after joining')
    })
    
    it('should handle empty segments', () => {
      const joined = safeJoin('/base', '', 'folder', '', 'file.txt')
      expect(joined).toBe(path.resolve('/base/folder/file.txt'))
    })
  })
  
  describe('createPathSanitizer', () => {
    it('should create sanitizer with preset options', () => {
      const customSanitizer = createPathSanitizer({
        allowDotFiles: true,
        maxDepth: 5
      })
      
      // Should use preset options
      let result = customSanitizer('.config/file.txt')
      expect(result.safe).toBe(true)
      
      // Should respect depth limit
      result = customSanitizer('a/b/c/d/e/f/g/file.txt')
      expect(result.safe).toBe(false)
    })
    
    it('should allow overriding preset options', () => {
      const customSanitizer = createPathSanitizer({
        maxDepth: 3
      })
      
      const result = customSanitizer('a/b/c/d/e/file.txt', { maxDepth: 10 })
      expect(result.safe).toBe(true)
    })
  })
  
  describe('PathSanitizers presets', () => {
    it('uploads sanitizer should be very restrictive', () => {
      // Should reject deep paths
      expect(PathSanitizers.uploads('a/b/c/d/file.jpg').safe).toBe(false)
      
      // Should reject non-allowed extensions
      expect(PathSanitizers.uploads('file.exe').safe).toBe(false)
      
      // Should allow valid uploads
      expect(PathSanitizers.uploads('uploads/images/photo.jpg').safe).toBe(true)
    })
    
    it('media sanitizer should allow media files', () => {
      const validMedia = [
        'images/photo.jpg',
        'videos/clip.mp4',
        'audio/song.mp3',
        'graphics/icon.svg'
      ]
      
      validMedia.forEach(media => {
        expect(PathSanitizers.media(media).safe).toBe(true)
      })
      
      // Should reject non-media
      expect(PathSanitizers.media('document.pdf').safe).toBe(false)
    })
    
    it('project sanitizer should allow project files', () => {
      const validProject = [
        'src/components/App.tsx',
        'config/settings.json',
        'public/index.html',
        'styles/main.css'
      ]
      
      validProject.forEach(file => {
        expect(PathSanitizers.project(file).safe).toBe(true)
      })
      
      // Should reject executables
      expect(PathSanitizers.project('bin/app.exe').safe).toBe(false)
    })
    
    it('general sanitizer should be less restrictive', () => {
      // Should allow deeper paths
      const deepPath = Array(15).fill('folder').join('/') + '/file.txt'
      expect(PathSanitizers.general(deepPath).safe).toBe(true)
      
      // Should still block dangerous patterns
      expect(PathSanitizers.general('../escape').safe).toBe(false)
    })
  })
  
  describe('sanitizeFilename', () => {
    it('should remove path components', () => {
      expect(sanitizeFilename('/path/to/file.txt')).toBe('file.txt')
      expect(sanitizeFilename('C:\\Users\\file.txt')).toBe('file.txt')
    })
    
    it('should remove dangerous characters', () => {
      expect(sanitizeFilename('file<>:"|?*.txt')).toBe('file.txt')
      expect(sanitizeFilename('file\x00\x1f.txt')).toBe('file.txt')
    })
    
    it('should remove leading and trailing dots', () => {
      expect(sanitizeFilename('...file...')).toBe('file')
      expect(sanitizeFilename('.hidden.txt')).toBe('hidden.txt')
    })
    
    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('my file name.txt')).toBe('my_file_name.txt')
    })
    
    it('should keep only safe characters', () => {
      expect(sanitizeFilename('file@#$%^&.txt')).toBe('file.txt')
      expect(sanitizeFilename('file-name_2023.txt')).toBe('file-name_2023.txt')
    })
    
    it('should handle empty filenames', () => {
      expect(sanitizeFilename('')).toBe('unnamed')
      expect(sanitizeFilename('...')).toBe('unnamed')
      expect(sanitizeFilename('***')).toBe('unnamed')
    })
    
    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.txt'
      const sanitized = sanitizeFilename(longName)
      expect(sanitized.length).toBeLessThanOrEqual(255)
      expect(sanitized.endsWith('.txt')).toBe(true)
    })
    
    it('should handle invalid inputs', () => {
      // @ts-ignore - Testing invalid input
      expect(sanitizeFilename(null)).toBe('unnamed')
      // @ts-ignore - Testing invalid input
      expect(sanitizeFilename(undefined)).toBe('unnamed')
      // @ts-ignore - Testing invalid input
      expect(sanitizeFilename(123)).toBe('unnamed')
    })
  })
  
  describe('isPathWithinDirectory', () => {
    it('should return true for paths within directory', () => {
      expect(isPathWithinDirectory('/base/dir/file.txt', '/base')).toBe(true)
      expect(isPathWithinDirectory('/base/dir/sub/file.txt', '/base/dir')).toBe(true)
    })
    
    it('should return false for paths outside directory', () => {
      expect(isPathWithinDirectory('/other/file.txt', '/base')).toBe(false)
      expect(isPathWithinDirectory('/base/../outside/file.txt', '/base')).toBe(false)
    })
    
    it('should handle relative paths', () => {
      expect(isPathWithinDirectory('./subdir/file.txt', '.')).toBe(true)
      expect(isPathWithinDirectory('../outside/file.txt', '.')).toBe(false)
    })
    
    it('should handle same directory', () => {
      expect(isPathWithinDirectory('/base/dir', '/base/dir')).toBe(true)
    })
  })
})