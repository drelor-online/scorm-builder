import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Tauri API first
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path) => `asset://localhost/${path}`)
}))

import { MediaUrlService } from '../mediaUrl'
import { invoke } from '@tauri-apps/api/core'

const mockInvoke = vi.mocked(invoke)

// Mock path
vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts) => parts.join('/'))
}))

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}))

describe('MediaUrlService - using get_media command', () => {
  let service: MediaUrlService
  
  beforeEach(() => {
    vi.clearAllMocks()
    service = MediaUrlService.getInstance()
    service.clearCache()
  })

  it('should fail when trying to use non-existent read_file command', async () => {
    const projectId = 'test-project'
    const mediaId = 'test-media'
    
    // Mock get_projects_dir
    mockInvoke.mockImplementationOnce(async () => {
      return '/projects'
    })
    
    // Mock read_file to fail (command doesn't exist)
    mockInvoke.mockImplementationOnce(async (command) => {
      expect(command).toBe('read_file')
      throw new Error('Unknown command: read_file')
    })
    
    const url = await service.getMediaUrl(projectId, mediaId)
    
    expect(url).toBeNull()
  })

  it('should use get_media command to retrieve media', async () => {
    const projectId = 'test-project'
    const mediaId = 'test-media'
    
    // Mock the backend response for get_media
    const mockMediaData = {
      id: mediaId,
      data: [1, 2, 3, 4], // byte array
      metadata: {
        page_id: 'welcome',
        type: 'image',
        original_name: 'test.jpg',
        mime_type: 'image/jpeg'
      }
    }
    
    mockInvoke.mockImplementation(async (command, args) => {
      if (command === 'get_projects_dir') {
        return '/projects'
      }
      if (command === 'get_media') {
        expect(args).toEqual({ projectId, mediaId })
        return mockMediaData
      }
      throw new Error(`Unknown command: ${command}`)
    })
    
    // After fixing, this should work
    const url = await service.getMediaUrl(projectId, mediaId)
    
    // Should return a valid URL
    expect(url).toBeTruthy()
    expect(url).toContain('asset://localhost')
  })
})