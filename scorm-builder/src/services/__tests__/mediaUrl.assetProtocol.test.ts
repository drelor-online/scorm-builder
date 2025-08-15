import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaUrlService } from '../mediaUrl'
import { invoke } from '@tauri-apps/api/core'
import { convertFileSrc } from '@tauri-apps/api/core'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn()
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/'))
}))

describe('MediaUrlService - Asset Protocol', () => {
  let service: MediaUrlService
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset singleton
    MediaUrlService['instance'] = null as any
    service = MediaUrlService.getInstance()
  })

  it('should generate asset protocol URLs for regular media files', async () => {
    const projectId = '1754444630422' // Just the ID, not a path
    const mediaId = 'image-123'
    
    // Mock get_media to return non-SVG media
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'get_media') {
        return Promise.resolve({
          data: new Uint8Array([1, 2, 3]),
          metadata: {
            mime_type: 'image/png',
            size: 3
          }
        })
      }
      if (cmd === 'get_projects_dir') {
        return Promise.resolve('C:/Users/sierr/Documents/SCORM Projects')
      }
      return Promise.reject('Unknown command')
    })
    
    // Mock convertFileSrc to return asset URL
    vi.mocked(convertFileSrc).mockReturnValue('asset://localhost/C:/Users/sierr/Documents/SCORM Projects/1754444630422/media/image-123.bin')
    
    const url = await service.getMediaUrl(projectId, mediaId)
    
    expect(url).toBe('asset://localhost/C:/Users/sierr/Documents/SCORM Projects/1754444630422/media/image-123.bin')
    expect(invoke).toHaveBeenCalledWith('get_media', {
      projectId: '1754444630422',
      mediaId: 'image-123'
    })
    expect(convertFileSrc).toHaveBeenCalled()
  })

  it('should handle project IDs extracted from paths', async () => {
    // This tests that the service works correctly when given just the ID
    // (after UnifiedMediaContext has extracted it from a full path)
    const projectId = '1754444630422'
    const mediaId = 'audio-456'
    
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'get_media') {
        return Promise.resolve({
          data: new Uint8Array([4, 5, 6]),
          metadata: {
            mime_type: 'audio/mp3',
            size: 3
          }
        })
      }
      if (cmd === 'get_projects_dir') {
        return Promise.resolve('C:/Users/sierr/Documents/SCORM Projects')
      }
      return Promise.reject('Unknown command')
    })
    
    vi.mocked(convertFileSrc).mockReturnValue('asset://localhost/C:/Users/sierr/Documents/SCORM Projects/1754444630422/media/audio-456.bin')
    
    const url = await service.getMediaUrl(projectId, mediaId)
    
    expect(url).toBe('asset://localhost/C:/Users/sierr/Documents/SCORM Projects/1754444630422/media/audio-456.bin')
    expect(invoke).toHaveBeenCalledWith('get_media', {
      projectId: '1754444630422',
      mediaId: 'audio-456'
    })
  })

  it('should return data URLs for SVG files', async () => {
    const projectId = '1754444630422'
    const mediaId = 'svg-789'
    
    // Mock get_media to return SVG media
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'get_media') {
        return Promise.resolve({
          data: Array.from('<svg>test</svg>').map(c => c.charCodeAt(0)),
          metadata: {
            mime_type: 'image/svg+xml',
            size: 15
          }
        })
      }
      return Promise.reject('Unknown command')
    })
    
    const url = await service.getMediaUrl(projectId, mediaId)
    
    expect(url).toContain('data:image/svg+xml;base64,')
    expect(invoke).toHaveBeenCalledWith('get_media', {
      projectId: '1754444630422',
      mediaId: 'svg-789'
    })
    // Should not call convertFileSrc for SVG
    expect(convertFileSrc).not.toHaveBeenCalled()
  })

  it('should cache URLs to avoid repeated backend calls', async () => {
    const projectId = '1754444630422'
    const mediaId = 'cached-123'
    
    vi.mocked(invoke).mockImplementation((cmd: string) => {
      if (cmd === 'get_media') {
        return Promise.resolve({
          data: new Uint8Array([7, 8, 9]),
          metadata: {
            mime_type: 'image/jpeg',
            size: 3
          }
        })
      }
      if (cmd === 'get_projects_dir') {
        return Promise.resolve('C:/Users/sierr/Documents/SCORM Projects')
      }
      return Promise.reject('Unknown command')
    })
    
    vi.mocked(convertFileSrc).mockReturnValue('asset://localhost/cached-url')
    
    // First call
    const url1 = await service.getMediaUrl(projectId, mediaId)
    expect(url1).toBe('asset://localhost/cached-url')
    expect(invoke).toHaveBeenCalledTimes(2) // get_media + get_projects_dir
    
    // Second call should use cache
    const url2 = await service.getMediaUrl(projectId, mediaId)
    expect(url2).toBe('asset://localhost/cached-url')
    expect(invoke).toHaveBeenCalledTimes(2) // No additional calls
  })

  it('should return null for non-existent media', async () => {
    const projectId = '1754444630422'
    const mediaId = 'non-existent'
    
    vi.mocked(invoke).mockRejectedValue(new Error('Media not found'))
    
    const url = await service.getMediaUrl(projectId, mediaId)
    
    expect(url).toBeNull()
    expect(invoke).toHaveBeenCalledWith('get_media', {
      projectId: '1754444630422',
      mediaId: 'non-existent'
    })
  })
})