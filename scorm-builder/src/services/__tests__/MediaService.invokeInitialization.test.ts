import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock modules before importing MediaService
const mockInvoke = vi.fn()
let invokePromiseResolve: ((value: any) => void) | null = null

vi.mock('@tauri-apps/api/core', () => {
  // Create a promise that we can control when it resolves
  const invokePromise = new Promise((resolve) => {
    invokePromiseResolve = resolve
  })
  
  return invokePromise
})

vi.mock('../../utils/environment', () => ({
  hasTauriAPI: vi.fn().mockReturnValue(true),
  getStorageBackend: vi.fn().mockReturnValue('tauri')
}))

vi.mock('../../utils/idGenerator', () => ({
  generateMediaId: vi.fn((type, pageId) => `${type}-0-${pageId}`)
}))

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../../utils/performanceMonitor', () => ({
  performanceMonitor: {
    measureOperation: vi.fn((name, fn) => fn())
  }
}))

describe('MediaService - Invoke Initialization Race Condition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail to retrieve media when invoke is not yet initialized', async () => {
    // Import MediaService BEFORE the invoke promise resolves
    const { MediaService } = await import('../MediaService')
    
    // Clear and get instance
    MediaService.clearInstance('test-project')
    const mediaService = MediaService.getInstance({ projectId: 'test-project' })
    
    // Try to get media BEFORE invoke is initialized
    const result = await mediaService.getMedia('test-media-id')
    
    // This should fail because invoke is still null
    expect(result).toBeNull()
  })

  it('should work after invoke is initialized', async () => {
    // Import MediaService
    const { MediaService } = await import('../MediaService')
    
    // Now resolve the invoke promise
    if (invokePromiseResolve) {
      invokePromiseResolve({ invoke: mockInvoke })
    }
    
    // Wait a bit for the promise to settle
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Clear and get instance
    MediaService.clearInstance('test-project-2')
    const mediaService = MediaService.getInstance({ projectId: 'test-project-2' })
    
    // Mock the invoke response
    mockInvoke.mockResolvedValueOnce({
      data: Array.from(new Uint8Array([1, 2, 3, 4])),
      metadata: { mimeType: 'image/png' }
    })
    
    // Try to get media AFTER invoke is initialized
    const result = await mediaService.getMedia('test-media-id')
    
    // This still won't work because invoke is imported asynchronously
    // and there's no way for MediaService to wait for it
    expect(result).toBeNull() // This demonstrates the bug!
  })
})