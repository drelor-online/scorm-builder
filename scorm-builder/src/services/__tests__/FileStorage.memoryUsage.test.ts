import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileStorage } from '../FileStorage'

// Mock Tauri's invoke function
const mockInvoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args)
}))

// Mock Tauri's dialog plugin
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

describe('FileStorage - Memory Usage Tests', () => {
  let fileStorage: FileStorage
  let arrayFromSpy: any

  beforeEach(async () => {
    fileStorage = new FileStorage()
    
    // Initialize and set up a mock project
    await fileStorage.initialize()
    
    // Mock the createProject response to set the current project ID
    mockInvoke.mockImplementation((cmd: string, args: any) => {
      if (cmd === 'create_project') {
        return Promise.resolve({
          id: 'test-project-id',
          name: 'Test Project',
          path: '/test/path',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString()
        })
      }
      return Promise.resolve(undefined)
    })
    
    // Create a project to set the current project ID
    await fileStorage.createProject('Test Project')
    
    mockInvoke.mockClear()
    
    // Spy on Array.from to detect if it's called with large data
    arrayFromSpy = vi.spyOn(Array, 'from')
  })

  afterEach(() => {
    if (arrayFromSpy) {
      arrayFromSpy.mockRestore()
    }
  })

  it('should not use Array.from() for large file data conversion', async () => {
    // Create a mock 50MB file
    const largeFileSize = 50 * 1024 * 1024 // 50MB
    const largeBuffer = new ArrayBuffer(largeFileSize)
    const mockLargeFile = new Blob([largeBuffer], { type: 'audio/wav' })
    
    // Mock the arrayBuffer method since it might not exist in test environment
    if (!mockLargeFile.arrayBuffer) {
      mockLargeFile.arrayBuffer = () => Promise.resolve(largeBuffer)
    }
    
    // Mock successful storage
    mockInvoke.mockResolvedValue(undefined)

    // Call storeMedia
    await fileStorage.storeMedia('test-media-id', mockLargeFile, 'audio', {
      page_id: 'test-page',
      original_name: 'large-audio.wav'
    })

    // Check that Array.from was NOT called with large data
    // This test will FAIL initially because the current implementation uses Array.from(bytes)
    const arrayFromCalls = arrayFromSpy.mock.calls
    const largeDataCalls = arrayFromCalls.filter(call => {
      const arg = call[0]
      return arg instanceof Uint8Array && arg.length > 1024 * 1024 // > 1MB
    })

    expect(largeDataCalls.length).toBe(0)
  })

  it('should send data to Tauri without causing memory issues', async () => {
    // Create a mock 50MB file
    const largeFileSize = 50 * 1024 * 1024 // 50MB
    const largeBuffer = new ArrayBuffer(largeFileSize)
    const mockLargeFile = new Blob([largeBuffer], { type: 'audio/wav' })
    
    // Mock the arrayBuffer method
    if (!mockLargeFile.arrayBuffer) {
      mockLargeFile.arrayBuffer = () => Promise.resolve(largeBuffer)
    }
    
    // Mock successful storage
    mockInvoke.mockResolvedValue(undefined)

    // Call storeMedia
    await fileStorage.storeMedia('test-media-id', mockLargeFile, 'audio', {
      page_id: 'test-page',
      original_name: 'large-audio.wav'
    })

    // Verify invoke was called with the base64 command
    expect(mockInvoke).toHaveBeenCalledWith('store_media_base64', expect.any(Object))
    
    const invokeArgs = mockInvoke.mock.calls[0][1]
    
    // Check that we're using the new base64 command
    expect(mockInvoke).toHaveBeenCalledWith('store_media_base64', expect.any(Object))
    
    // Check that data is sent as Base64 string, not array
    expect(invokeArgs.data).toBeUndefined()
    expect(invokeArgs.dataBase64).toBeDefined()
    expect(typeof invokeArgs.dataBase64).toBe('string')
    expect(invokeArgs.dataBase64.length).toBeGreaterThan(0)
  })

  it('should handle file conversion without exceeding memory limits', async () => {
    // Create a mock 100MB file (should still work)
    const veryLargeFileSize = 100 * 1024 * 1024 // 100MB
    const veryLargeBuffer = new ArrayBuffer(veryLargeFileSize)
    const mockVeryLargeFile = new Blob([veryLargeBuffer], { type: 'audio/wav' })
    
    // Mock the arrayBuffer method
    if (!mockVeryLargeFile.arrayBuffer) {
      mockVeryLargeFile.arrayBuffer = () => Promise.resolve(veryLargeBuffer)
    }
    
    // Track memory usage simulation
    let peakArraySize = 0
    arrayFromSpy.mockImplementation((input: any) => {
      if (input instanceof Uint8Array) {
        peakArraySize = Math.max(peakArraySize, input.length)
      }
      return Array.prototype.slice.call(input)
    })

    // Mock successful storage
    mockInvoke.mockResolvedValue(undefined)

    // This should not throw an error
    await expect(
      fileStorage.storeMedia('test-media-id', mockVeryLargeFile, 'audio', {
        page_id: 'test-page',
        original_name: 'very-large-audio.wav'
      })
    ).resolves.not.toThrow()

    // Verify we didn't try to convert huge arrays
    // This will FAIL initially because Array.from is called on the entire file
    expect(peakArraySize).toBeLessThan(1024 * 1024) // Should process in chunks < 1MB
  })
})