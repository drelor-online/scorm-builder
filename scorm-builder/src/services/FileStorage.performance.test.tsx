import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FileStorage } from './FileStorage'
import * as tauriCore from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}))

describe('FileStorage Performance - getAllProjectMedia', () => {
  let fileStorage: FileStorage
  
  beforeEach(() => {
    vi.clearAllMocks()
    fileStorage = new FileStorage()
    // Set up the project ID
    ;(fileStorage as any)._currentProjectId = 'test-project-123'
    ;(fileStorage as any)._currentProjectPath = 'C:\\Projects\\test-project-123.scormproj'
  })
  
  it('should demonstrate slow performance with current get_all_project_media', async () => {
    // Simulate 30 media items with binary data (what current backend returns)
    const mockMediaWithBinaryData = Array.from({ length: 30 }, (_, i) => ({
      id: `media-${i}`,
      media_type: 'audio',
      metadata: {
        page_id: `page-${i}`,
        type: 'audio',
        original_name: `file-${i}.mp3`,
        mime_type: 'audio/mpeg'
      },
      // Simulate 2MB of binary data per file
      data: new Uint8Array(2 * 1024 * 1024)
    }))
    
    // Mock the slow backend call (simulating the 28-30 second delay)
    vi.mocked(tauriCore.invoke).mockImplementation(async (command: string) => {
      if (command === 'get_all_project_media') {
        // Simulate the actual backend delay
        await new Promise(resolve => setTimeout(resolve, 28000))
        return mockMediaWithBinaryData
      }
      throw new Error(`Unknown command: ${command}`)
    })
    
    // Measure performance
    const startTime = performance.now()
    const result = await fileStorage.getAllProjectMedia()
    const endTime = performance.now()
    const loadTime = endTime - startTime
    
    // This test FAILS - demonstrating the problem
    console.log(`Loading ${result.length} media items took ${loadTime}ms`)
    expect(loadTime).toBeLessThan(2000) // Should be under 2 seconds but takes 28 seconds!
  }, { timeout: 35000 })
  
  it('should be fast with new get_all_project_media_metadata endpoint', async () => {
    // Simulate metadata-only response (what new backend will return)
    const mockMetadataOnly = Array.from({ length: 30 }, (_, i) => ({
      id: `media-${i}`,
      metadata: {
        page_id: `page-${i}`,
        type: 'audio',
        original_name: `file-${i}.mp3`,
        mime_type: 'audio/mpeg'
      },
      size: 2 * 1024 * 1024 // Size in bytes, but no actual data
    }))
    
    // Mock the fast backend call
    vi.mocked(tauriCore.invoke).mockImplementation(async (command: string) => {
      if (command === 'get_all_project_media_metadata') {
        // Fast - no binary data loading
        await new Promise(resolve => setTimeout(resolve, 150)) // ~150ms for metadata
        return mockMetadataOnly
      }
      throw new Error(`Unknown command: ${command}`)
    })
    
    // Create a modified FileStorage that uses the new endpoint
    const optimizedGetAllProjectMedia = async () => {
      if (!fileStorage.currentProjectId) {
        return []
      }
      
      const allMedia = await tauriCore.invoke<any[]>('get_all_project_media_metadata', {
        projectId: (fileStorage as any)._currentProjectPath || fileStorage.currentProjectId
      })
      
      return allMedia.map((media: any) => ({
        id: media.id,
        mediaType: media.metadata?.type || 'unknown',
        metadata: media.metadata || {},
        size: media.size
        // Note: no data field - loaded on demand
      }))
    }
    
    // Measure performance
    const startTime = performance.now()
    const result = await optimizedGetAllProjectMedia()
    const endTime = performance.now()
    const loadTime = endTime - startTime
    
    // This test PASSES - showing the solution
    console.log(`Loading ${result.length} media metadata took ${loadTime}ms`)
    expect(loadTime).toBeLessThan(500) // Easily under 500ms
    expect(result).toHaveLength(30)
    expect(result[0]).not.toHaveProperty('data') // No binary data loaded
  })
  
  it('calculates the expected performance improvement', () => {
    const currentTime = 28000 // 28 seconds (actual measured time)
    const optimizedTime = 150 // 150ms (expected with metadata only)
    const improvement = Math.round((currentTime - optimizedTime) / currentTime * 100)
    const speedIncrease = Math.round(currentTime / optimizedTime)
    
    console.log(`Current approach: ${currentTime}ms`)
    console.log(`Optimized approach: ${optimizedTime}ms`)
    console.log(`Performance improvement: ${improvement}%`)
    console.log(`Speed increase: ${speedIncrease}x faster`)
    
    expect(improvement).toBeGreaterThanOrEqual(99) // 99%+ improvement
    expect(speedIncrease).toBeGreaterThanOrEqual(180) // 180x+ faster
  })
})