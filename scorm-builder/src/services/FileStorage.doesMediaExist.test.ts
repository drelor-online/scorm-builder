/**
 * Test for FileStorage.doesMediaExist method
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { FileStorage } from './FileStorage'

// Mock Tauri
const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args)
}))

// Mock logger
vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

describe('FileStorage.doesMediaExist', () => {
  let fileStorage: FileStorage

  beforeEach(() => {
    vi.clearAllMocks()

    fileStorage = new FileStorage()

    // Mock project setup
    Object.defineProperty(fileStorage, '_currentProjectId', {
      value: 'test-project',
      writable: true
    })
  })

  test('should return true when media exists', async () => {
    // Mock getMedia to return a media object
    mockInvoke.mockResolvedValueOnce({
      id: 'image-1',
      type: 'image',
      filename: 'test.jpg'
    })

    const exists = await fileStorage.doesMediaExist('image-1')

    expect(exists).toBe(true)
    expect(mockInvoke).toHaveBeenCalledWith('get_media', {
      projectId: 'test-project',
      mediaId: 'image-1'
    })
  })

  test('should return false when media does not exist', async () => {
    // Mock getMedia to return null (media not found)
    mockInvoke.mockResolvedValueOnce(null)

    const exists = await fileStorage.doesMediaExist('nonexistent-media')

    expect(exists).toBe(false)
    expect(mockInvoke).toHaveBeenCalledWith('get_media', {
      projectId: 'test-project',
      mediaId: 'nonexistent-media'
    })
  })

  test('should return false when no project is open', async () => {
    // Set currentProjectId to null
    Object.defineProperty(fileStorage, '_currentProjectId', {
      value: null,
      writable: true
    })

    const exists = await fileStorage.doesMediaExist('image-1')

    expect(exists).toBe(false)
    expect(mockInvoke).not.toHaveBeenCalled()
  })

  test('should return false when getMedia throws an error', async () => {
    // Mock getMedia to throw an error
    mockInvoke.mockRejectedValueOnce(new Error('Backend error'))

    const exists = await fileStorage.doesMediaExist('image-1')

    expect(exists).toBe(false)
    expect(mockInvoke).toHaveBeenCalledWith('get_media', {
      projectId: 'test-project',
      mediaId: 'image-1'
    })
  })

  test('should handle empty string media ID', async () => {
    mockInvoke.mockResolvedValueOnce(null)

    const exists = await fileStorage.doesMediaExist('')

    expect(exists).toBe(false)
    expect(mockInvoke).toHaveBeenCalledWith('get_media', {
      projectId: 'test-project',
      mediaId: ''
    })
  })
})