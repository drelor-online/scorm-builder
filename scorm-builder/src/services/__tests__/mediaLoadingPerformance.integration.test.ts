import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MediaStore } from '../MediaStore'
import * as tauriCore from '@tauri-apps/api/core'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

// Mock mediaUrl service
vi.mock('../mediaUrl', () => ({
  mediaUrlService: {
    getMediaUrl: vi.fn()
  }
}))

describe('Media Loading Performance - Integration', () => {
  let mediaStore: MediaStore
  let mockInvoke: ReturnType<typeof vi.fn>
  
  beforeEach(() => {
    mediaStore = new MediaStore()
    mockInvoke = vi.mocked(tauriCore.invoke)
    vi.clearAllMocks()
  })
  
  it('should demonstrate significant performance improvement with parallel loading', async () => {
    // Create test data with 50 media items (realistic scenario)
    const mediaList = Array(50).fill(null).map((_, i) => ({
      id: `media-${i}`,
      data: new Uint8Array(1024 * 10), // 10KB per item
      metadata: {
        page_id: `page-${Math.floor(i / 10)}`,
        type: i % 3 === 0 ? 'image' : i % 3 === 1 ? 'audio' : 'video',
        original_name: `file-${i}.jpg`,
        mime_type: 'image/jpeg'
      }
    }))
    
    mockInvoke.mockResolvedValue(mediaList)
    
    // Mock URL generation with realistic delay (20ms per item)
    const { mediaUrlService } = await import('../mediaUrl')
    let urlCallCount = 0
    const urlCallTimes: number[] = []
    
    vi.mocked(mediaUrlService.getMediaUrl).mockImplementation(async () => {
      const callTime = performance.now()
      urlCallTimes.push(callTime)
      urlCallCount++
      
      // Simulate network latency
      await new Promise(resolve => setTimeout(resolve, 20))
      return `scorm-media://test/media-${urlCallCount}`
    })
    
    const progressReports: Array<{ loaded: number; total: number; timestamp: number }> = []
    const startTime = performance.now()
    
    await mediaStore.loadProject('test-project', (loaded, total) => {
      progressReports.push({ loaded, total, timestamp: performance.now() })
    })
    
    const endTime = performance.now()
    const totalTime = endTime - startTime
    
    console.log(`=== Performance Results ===`)
    console.log(`Total items: 50`)
    console.log(`Total loading time: ${totalTime.toFixed(2)}ms`)
    console.log(`Average per item: ${(totalTime / 50).toFixed(2)}ms`)
    console.log(`Progress reports: ${progressReports.length}`)
    
    // Analyze parallelization
    const concurrentCalls = []
    for (let i = 1; i < urlCallTimes.length; i++) {
      const timeDiff = urlCallTimes[i] - urlCallTimes[i - 1]
      if (timeDiff < 5) { // Calls within 5ms are considered concurrent
        concurrentCalls.push(i)
      }
    }
    
    console.log(`Concurrent calls detected: ${concurrentCalls.length}`)
    
    // Performance expectations
    // Sequential loading would take 50 * 20ms = 1000ms minimum
    // Parallel loading with batch size 5 should take approximately 10 batches * 20ms = 200ms
    expect(totalTime).toBeLessThan(500) // Should be significantly faster than sequential
    
    // Should have multiple progress updates
    expect(progressReports.length).toBeGreaterThan(5)
    
    // Progress should be smooth
    for (let i = 1; i < progressReports.length; i++) {
      expect(progressReports[i].loaded).toBeGreaterThanOrEqual(progressReports[i - 1].loaded)
    }
    
    // Final progress should show all items loaded
    expect(progressReports[progressReports.length - 1]).toEqual({ 
      loaded: 50, 
      total: 50,
      timestamp: expect.any(Number)
    })
  })
  
  it('should provide real-time progress updates for better UX', async () => {
    // Smaller test with focus on progress granularity
    const mediaList = Array(20).fill(null).map((_, i) => ({
      id: `media-${i}`,
      data: new Uint8Array(1024),
      metadata: {
        page_id: `page-${i}`,
        type: 'image' as const,
        original_name: `file-${i}.jpg`
      }
    }))
    
    mockInvoke.mockResolvedValue(mediaList)
    
    const { mediaUrlService } = await import('../mediaUrl')
    vi.mocked(mediaUrlService.getMediaUrl).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10))
      return 'scorm-media://test/media'
    })
    
    const progressTimestamps: number[] = []
    let lastReportedProgress = 0
    
    await mediaStore.loadProject('test-project', (loaded, total) => {
      const now = performance.now()
      progressTimestamps.push(now)
      
      // Verify progress increases
      expect(loaded).toBeGreaterThanOrEqual(lastReportedProgress)
      lastReportedProgress = loaded
      
      // Verify total is correct
      expect(total).toBe(20)
    })
    
    // Should have multiple progress updates (at least one per batch)
    expect(progressTimestamps.length).toBeGreaterThanOrEqual(4) // 20 items / 5 batch size = 4 batches
    
    // Progress updates should be reasonably spaced
    // In test environment, updates might be very fast, but in real scenarios
    // they would be spaced out more due to actual network latency
    console.log(`Progress update intervals:`, progressTimestamps.map((t, i) => 
      i > 0 ? (t - progressTimestamps[i - 1]).toFixed(2) : 0
    ))
  })
})