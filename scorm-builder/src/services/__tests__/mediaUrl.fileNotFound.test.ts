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

describe('MediaUrlService - file not found errors', () => {
  let service: MediaUrlService
  
  beforeEach(() => {
    vi.clearAllMocks()
    service = MediaUrlService.getInstance()
    service.clearCache()
  })

  it('should fail when media file with .bin extension does not exist', async () => {
    const projectId = '57624712-fdf1-44fe-984e-609a22dfa9ce'
    const mediaId = 'welcome-audio-0'
    
    // Mock get_projects_dir
    mockInvoke.mockImplementationOnce(async () => {
      return 'C:\\Users\\sierr\\Documents\\SCORM Projects'
    })
    
    // Mock read_file to fail (file not found)
    mockInvoke.mockImplementationOnce(async (command, args) => {
      expect(command).toBe('read_file')
      expect(args.relativePath).toBe(`media/${mediaId}.bin`)
      throw new Error('File not found')
    })
    
    const url = await service.getMediaUrl(projectId, mediaId)
    
    expect(url).toBeNull()
  })

  it('should look for files with .bin extension', async () => {
    const projectId = 'test-project'
    const mediaId = 'test-media'
    
    let readFileCalled = false
    
    mockInvoke.mockImplementation(async (command, args) => {
      if (command === 'get_projects_dir') {
        return '/projects'
      }
      if (command === 'read_file') {
        readFileCalled = true
        // Verify it's looking for .bin files
        expect(args.relativePath).toMatch(/\.bin$/)
        throw new Error('File not found')
      }
      return null
    })
    
    await service.getMediaUrl(projectId, mediaId)
    
    expect(readFileCalled).toBe(true)
  })
})