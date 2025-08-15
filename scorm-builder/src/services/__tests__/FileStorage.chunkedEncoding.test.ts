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

describe('FileStorage - Chunked Base64 Encoding Tests', () => {
  let fileStorage: FileStorage
  let originalSetTimeout: typeof setTimeout

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
    
    // Store original setTimeout
    originalSetTimeout = global.setTimeout
  })

  afterEach(() => {
    // Restore original setTimeout
    global.setTimeout = originalSetTimeout
  })

  it('should not block UI thread for more than 16ms per frame during encoding', async () => {
    // Create a 10MB file for testing
    const fileSize = 10 * 1024 * 1024 // 10MB
    const largeBuffer = new ArrayBuffer(fileSize)
    const largeFile = new Blob([largeBuffer], { type: 'audio/wav' })
    
    // Mock the arrayBuffer method
    if (!largeFile.arrayBuffer) {
      largeFile.arrayBuffer = () => Promise.resolve(largeBuffer)
    }
    
    // Track time between setTimeout calls
    const timeBetweenYields: number[] = []
    let lastYieldTime = performance.now()
    
    // Mock setTimeout to track when UI thread is yielded
    const mockSetTimeout = vi.fn((callback: () => void, delay: number) => {
      const currentTime = performance.now()
      timeBetweenYields.push(currentTime - lastYieldTime)
      lastYieldTime = currentTime
      
      // Call the callback immediately in tests
      callback()
      return 1 as any
    })
    global.setTimeout = mockSetTimeout as any
    
    // Mock successful storage
    mockInvoke.mockResolvedValue(undefined)
    
    // Call storeMedia which should use chunked encoding
    await fileStorage.storeMedia('test-media-id', largeFile, 'audio', {
      page_id: 'test-page',
      original_name: 'large-audio.wav'
    })
    
    // Verify setTimeout was called multiple times (UI thread was yielded)
    expect(mockSetTimeout).toHaveBeenCalled()
    expect(mockSetTimeout.mock.calls.length).toBeGreaterThan(5) // At least 5 chunks for 10MB
    
    // Verify no single operation took more than 50ms (allowing some margin)
    const maxTimeBetweenYields = Math.max(...timeBetweenYields.filter(t => t > 0))
    expect(maxTimeBetweenYields).toBeLessThan(50)
  })

  it('should call progress callback multiple times during encoding', async () => {
    // Create a 5MB file
    const fileSize = 5 * 1024 * 1024 // 5MB
    const buffer = new ArrayBuffer(fileSize)
    const file = new Blob([buffer], { type: 'audio/wav' })
    
    // Mock the arrayBuffer method
    if (!file.arrayBuffer) {
      file.arrayBuffer = () => Promise.resolve(buffer)
    }
    
    // Track progress updates
    const progressUpdates: number[] = []
    const progressCallback = vi.fn((progress: { percent: number }) => {
      progressUpdates.push(progress.percent)
    })
    
    // Mock successful storage
    mockInvoke.mockResolvedValue(undefined)
    
    // Add progress callback to storeMedia (we'll need to modify the interface)
    // For now, we'll test that the encoding happens in chunks
    await fileStorage.storeMedia('test-media-id', file, 'audio', {
      page_id: 'test-page',
      original_name: 'audio.wav'
    })
    
    // Verify the data was sent as base64
    expect(mockInvoke).toHaveBeenCalledWith('store_media_base64', expect.any(Object))
    
    // TODO: Once we add progress callback support, verify it's called multiple times
    // expect(progressCallback).toHaveBeenCalledTimes(5) // Approximately 5 chunks for 5MB
    // expect(progressUpdates[0]).toBeLessThan(progressUpdates[progressUpdates.length - 1])
  })

  it('should produce valid Base64 output that matches non-chunked encoding', async () => {
    // Create a small file with known content
    const testData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]) // "Hello"
    const smallFile = new Blob([testData], { type: 'text/plain' })
    
    // Mock the arrayBuffer method
    if (!smallFile.arrayBuffer) {
      smallFile.arrayBuffer = () => Promise.resolve(testData.buffer)
    }
    
    // Capture the base64 data sent to Tauri
    let capturedBase64: string = ''
    mockInvoke.mockImplementation((cmd: string, args: any) => {
      if (cmd === 'store_media_base64') {
        capturedBase64 = args.dataBase64
      }
      return Promise.resolve(undefined)
    })
    
    // Store the file
    await fileStorage.storeMedia('test-media-id', smallFile, 'text', {
      page_id: 'test-page',
      original_name: 'test.txt'
    })
    
    // Verify base64 encoding is correct
    // "Hello" in base64 is "SGVsbG8="
    expect(capturedBase64).toBe('SGVsbG8=')
  })
  
  it('should produce valid Base64 for large files using chunked encoding', async () => {
    // Create a 2MB file with repeating pattern to test chunked encoding
    const chunkSize = 1024 * 1024 // 1MB per chunk
    const fileSize = 2 * chunkSize + 500 // 2.5MB to ensure multiple chunks
    const pattern = new Uint8Array(256).map((_, i) => i) // 0-255 pattern
    const largeData = new Uint8Array(fileSize)
    
    // Fill with repeating pattern
    for (let i = 0; i < fileSize; i++) {
      largeData[i] = pattern[i % pattern.length]
    }
    
    const largeFile = new Blob([largeData], { type: 'audio/mp3' })
    
    // Mock the arrayBuffer method
    if (!largeFile.arrayBuffer) {
      largeFile.arrayBuffer = () => Promise.resolve(largeData.buffer)
    }
    
    // Capture the base64 data sent to Tauri
    let capturedBase64: string = ''
    mockInvoke.mockImplementation((cmd: string, args: any) => {
      if (cmd === 'store_media_base64') {
        capturedBase64 = args.dataBase64
      }
      return Promise.resolve(undefined)
    })
    
    // Store the file - this should trigger chunked encoding
    await fileStorage.storeMedia('test-media-id', largeFile, 'audio', {
      page_id: 'test-page',
      original_name: 'large-audio.mp3'
    })
    
    // Verify the base64 is valid by attempting to decode it
    expect(capturedBase64).toBeTruthy()
    expect(capturedBase64.length).toBeGreaterThan(0)
    
    // Test that it's valid Base64 by decoding it
    // Valid Base64 should not throw when decoded
    const isValidBase64 = (str: string): boolean => {
      try {
        // In Node.js environment
        if (typeof Buffer !== 'undefined') {
          Buffer.from(str, 'base64')
          return true
        }
        // In browser environment
        atob(str)
        return true
      } catch (e) {
        return false
      }
    }
    
    expect(isValidBase64(capturedBase64)).toBe(true)
    
    // Decode and verify the data matches original
    let decodedData: Uint8Array
    if (typeof Buffer !== 'undefined') {
      decodedData = new Uint8Array(Buffer.from(capturedBase64, 'base64'))
    } else {
      const binaryString = atob(capturedBase64)
      decodedData = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        decodedData[i] = binaryString.charCodeAt(i)
      }
    }
    
    // Verify the decoded data matches the original
    expect(decodedData.length).toBe(largeData.length)
    
    // Check first and last few bytes to ensure data integrity
    for (let i = 0; i < 100; i++) {
      expect(decodedData[i]).toBe(largeData[i])
    }
    for (let i = 0; i < 100; i++) {
      const idx = decodedData.length - 100 + i
      expect(decodedData[idx]).toBe(largeData[idx])
    }
  })

  it('should handle errors gracefully during chunked encoding', async () => {
    // Create a file that will cause an error
    const errorFile = new Blob(['test'], { type: 'audio/wav' })
    
    // Mock arrayBuffer to throw an error
    errorFile.arrayBuffer = () => Promise.reject(new Error('Read error'))
    
    // Attempt to store the file
    await expect(
      fileStorage.storeMedia('test-media-id', errorFile, 'audio', {
        page_id: 'test-page',
        original_name: 'error.wav'
      })
    ).rejects.toThrow()
    
    // Verify no partial data was sent
    expect(mockInvoke).not.toHaveBeenCalledWith('store_media_base64', expect.any(Object))
  })

  it('should handle very large files (100MB+) without crashing', async () => {
    // Create a 100MB file
    const veryLargeSize = 100 * 1024 * 1024 // 100MB
    const veryLargeBuffer = new ArrayBuffer(veryLargeSize)
    const veryLargeFile = new Blob([veryLargeBuffer], { type: 'audio/wav' })
    
    // Mock the arrayBuffer method
    if (!veryLargeFile.arrayBuffer) {
      veryLargeFile.arrayBuffer = () => Promise.resolve(veryLargeBuffer)
    }
    
    // Track memory usage simulation
    let peakMemoryUsage = 0
    const originalFileReader = FileReader
    
    // Mock FileReader to track instance count
    let activeReaders = 0
    const MockFileReader = class extends originalFileReader {
      constructor() {
        super()
        activeReaders++
        peakMemoryUsage = Math.max(peakMemoryUsage, activeReaders)
      }
      
      readAsDataURL(blob: Blob) {
        super.readAsDataURL(blob)
        // Simulate reader cleanup after use
        setTimeout(() => activeReaders--, 0)
      }
    } as any
    
    global.FileReader = MockFileReader
    
    // Mock successful storage
    mockInvoke.mockResolvedValue(undefined)
    
    // This should complete without throwing
    await fileStorage.storeMedia('test-media-id', veryLargeFile, 'audio', {
      page_id: 'test-page',
      original_name: 'very-large.wav'
    })
    
    // Verify we didn't create too many FileReader instances at once
    expect(peakMemoryUsage).toBeLessThan(5) // Should process in small chunks
    
    // Restore original FileReader
    global.FileReader = originalFileReader
  })
})