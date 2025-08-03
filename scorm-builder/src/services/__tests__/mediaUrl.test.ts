import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MediaUrlService, mediaUrlService } from '../mediaUrl'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/'))
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}))

import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import { logger } from '../../utils/logger'

describe('MediaUrlService', () => {
  let service: MediaUrlService

  beforeEach(() => {
    vi.clearAllMocks()
    // Get a fresh instance by clearing the singleton
    // @ts-ignore - accessing private property for testing
    MediaUrlService.instance = undefined
    service = MediaUrlService.getInstance()
  })

  afterEach(() => {
    service.clearCache()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = MediaUrlService.getInstance()
      const instance2 = MediaUrlService.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should export singleton instance', () => {
      expect(mediaUrlService).toStrictEqual(MediaUrlService.getInstance())
    })
  })

  describe('getMediaUrl', () => {
    const projectId = 'test-project'
    const mediaId = 'test-media'

    it('should return cached URL if available', async () => {
      // Pre-populate cache
      const cachedUrl = 'cached://url'
      // @ts-ignore - accessing private property for testing
      service.urlCache.set(`${projectId}/${mediaId}`, cachedUrl)

      const url = await service.getMediaUrl(projectId, mediaId)
      
      expect(url).toBe(cachedUrl)
      expect(invoke).not.toHaveBeenCalled()
    })

    it('should generate data URL for SVG files', async () => {
      const svgContent = '<svg></svg>'
      const svgBytes = Array.from(svgContent, char => char.charCodeAt(0))
      const svgBase64 = btoa(svgContent)
      
      const mockMediaData = {
        id: mediaId,
        data: svgBytes,
        metadata: {
          page_id: 'welcome',
          type: 'image',
          original_name: 'test.svg',
          mime_type: 'image/svg+xml'
        }
      }
      
      vi.mocked(invoke).mockImplementation(async (cmd, args) => {
        if (cmd === 'get_media') {
          return mockMediaData
        }
        return ''
      })

      const url = await service.getMediaUrl(projectId, mediaId)
      
      expect(url).toBe(`data:image/svg+xml;base64,${svgBase64}`)
      expect(logger.info).toHaveBeenCalledWith('[MediaUrlService] Generated data URL for SVG', mediaId)
    })

    it('should handle SVG read errors', async () => {
      const metadata = { mime_type: 'image/svg+xml' }
      const metadataJson = btoa(JSON.stringify(metadata))
      
      vi.mocked(invoke).mockImplementation(async (cmd, args) => {
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.json`) {
          return metadataJson
        }
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.bin`) {
          throw new Error('Failed to read SVG')
        }
        return ''
      })

      const url = await service.getMediaUrl(projectId, mediaId)
      
      expect(url).toBeNull()
      expect(logger.error).toHaveBeenCalledWith('[MediaUrlService] Failed to read SVG file:', expect.any(Error))
    })

    it('should generate asset URL for non-SVG files', async () => {
      const projectsDir = '/projects'
      
      vi.mocked(invoke).mockImplementation(async (cmd, args) => {
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.json`) {
          throw new Error('No metadata') // Not an SVG
        }
        if (cmd === 'get_projects_dir') {
          return projectsDir
        }
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.bin`) {
          return 'file-content' // File exists
        }
        return ''
      })

      const url = await service.getMediaUrl(projectId, mediaId)
      
      const expectedPath = `${projectsDir}/${projectId}/media/${mediaId}.bin`
      expect(url).toBe(`asset://localhost/${expectedPath}`)
      expect(convertFileSrc).toHaveBeenCalledWith(expectedPath)
      expect(logger.info).toHaveBeenCalledWith('[MediaUrlService] Generated URL for', mediaId, ':', url)
      expect(logger.info).toHaveBeenCalledWith('[MediaUrlService] File path:', expectedPath)
    })

    it('should handle non-SVG files without metadata', async () => {
      const projectsDir = '/projects'
      
      vi.mocked(invoke).mockImplementation(async (cmd, args) => {
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.json`) {
          throw new Error('No metadata')
        }
        if (cmd === 'get_projects_dir') {
          return projectsDir
        }
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.bin`) {
          return 'file-content'
        }
        return ''
      })

      const url = await service.getMediaUrl(projectId, mediaId)
      
      expect(url).toBeTruthy()
      expect(url).toContain('asset://localhost/')
    })

    it('should return null when file does not exist', async () => {
      const projectsDir = '/projects'
      
      vi.mocked(invoke).mockImplementation(async (cmd, args) => {
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.json`) {
          throw new Error('No metadata')
        }
        if (cmd === 'get_projects_dir') {
          return projectsDir
        }
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.bin`) {
          throw new Error('File not found')
        }
        return ''
      })

      const url = await service.getMediaUrl(projectId, mediaId)
      
      expect(url).toBeNull()
      expect(logger.error).toHaveBeenCalledWith('[MediaUrlService] File does not exist:', expect.any(String))
    })

    it('should handle general errors', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('General error'))

      const url = await service.getMediaUrl(projectId, mediaId)
      
      expect(url).toBeNull()
      expect(logger.error).toHaveBeenCalledWith('[MediaUrlService] Failed to generate URL:', expect.any(Error))
    })

    it('should cache generated URLs', async () => {
      const projectsDir = '/projects'
      
      vi.mocked(invoke).mockImplementation(async (cmd, args) => {
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.json`) {
          throw new Error('No metadata')
        }
        if (cmd === 'get_projects_dir') {
          return projectsDir
        }
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.bin`) {
          return 'file-content'
        }
        return ''
      })

      // First call
      const url1 = await service.getMediaUrl(projectId, mediaId)
      expect(invoke).toHaveBeenCalledTimes(3) // metadata, get_projects_dir, file check

      // Second call should use cache
      vi.clearAllMocks()
      const url2 = await service.getMediaUrl(projectId, mediaId)
      
      expect(url2).toBe(url1)
      expect(invoke).not.toHaveBeenCalled()
    })

    it('should handle invalid metadata JSON', async () => {
      const projectsDir = '/projects'
      
      vi.mocked(invoke).mockImplementation(async (cmd, args) => {
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.json`) {
          return 'invalid-json'
        }
        if (cmd === 'get_projects_dir') {
          return projectsDir
        }
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.bin`) {
          return 'file-content'
        }
        return ''
      })

      const url = await service.getMediaUrl(projectId, mediaId)
      
      // Should fall back to non-SVG handling
      expect(url).toBeTruthy()
      expect(url).toContain('asset://localhost/')
    })

    it('should handle metadata with non-SVG mime type', async () => {
      const projectsDir = '/projects'
      const metadata = { mime_type: 'image/png' }
      const metadataJson = btoa(JSON.stringify(metadata))
      
      vi.mocked(invoke).mockImplementation(async (cmd, args) => {
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.json`) {
          return metadataJson
        }
        if (cmd === 'get_projects_dir') {
          return projectsDir
        }
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.bin`) {
          return 'file-content'
        }
        return ''
      })

      const url = await service.getMediaUrl(projectId, mediaId)
      
      // Should use asset protocol, not data URL
      expect(url).toContain('asset://localhost/')
      expect(url).not.toContain('data:')
    })
  })

  describe('clearCache', () => {
    it('should clear all cached URLs', async () => {
      const projectsDir = '/projects'
      
      vi.mocked(invoke).mockImplementation(async (cmd) => {
        if (cmd === 'get_projects_dir') return projectsDir
        if (cmd === 'read_file') return 'content'
        throw new Error('No metadata')
      })

      // Generate and cache a URL
      await service.getMediaUrl('project1', 'media1')
      
      // Clear mocks to track new calls
      vi.clearAllMocks()
      
      // Clear cache
      service.clearCache()
      
      // Same request should hit the service again
      await service.getMediaUrl('project1', 'media1')
      
      expect(invoke).toHaveBeenCalled()
    })
  })

  describe('Path Handling', () => {
    it('should use path.join for cross-platform compatibility', async () => {
      const projectsDir = '/projects'
      const projectId = 'test-project'
      const mediaId = 'test-media'
      
      vi.mocked(invoke).mockImplementation(async (cmd, args) => {
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.json`) {
          throw new Error('No metadata')
        }
        if (cmd === 'get_projects_dir') {
          return projectsDir
        }
        if (cmd === 'read_file' && args.relativePath === `media/${mediaId}.bin`) {
          return 'file-content'
        }
        return ''
      })

      await service.getMediaUrl(projectId, mediaId)
      
      expect(join).toHaveBeenCalledWith(projectsDir, projectId, 'media')
      expect(join).toHaveBeenCalledWith(`${projectsDir}/${projectId}/media`, `${mediaId}.bin`)
    })
  })
})