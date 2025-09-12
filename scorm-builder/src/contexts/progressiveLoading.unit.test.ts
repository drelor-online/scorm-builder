/**
 * Unit test for progressive loading prioritization algorithm
 */

import { describe, test, expect } from 'vitest'

// Mock MediaItem interface for testing
interface TestMediaItem {
  id: string
  type: 'image' | 'audio' | 'video' | 'caption'
  pageId: string
}

// Extract the prioritization logic for unit testing
function prioritizeMediaForLoading(remainingMedia: TestMediaItem[]): TestMediaItem[][] {
  const batches: TestMediaItem[][] = []
  
  // HIGH PRIORITY BATCH: Audio from welcome/objectives (immediate user needs)
  const highPriority = remainingMedia.filter(item => 
    item.type === 'audio' && 
    (item.pageId === 'welcome' || item.pageId === 'objectives')
  )
  if (highPriority.length > 0) batches.push(highPriority)
  
  // MEDIUM PRIORITY BATCH: Visual media from early topics (likely to be seen soon)
  const mediumPriority = remainingMedia.filter(item => 
    !highPriority.includes(item) &&
    (item.type === 'image' || item.type === 'video') &&
    item.pageId?.startsWith('topic-') &&
    getTopicNumber(item.pageId) <= 3 // First 3 topics
  )
  if (mediumPriority.length > 0) batches.push(mediumPriority)
  
  // AUDIO PRIORITY BATCH: Audio from early topics
  const audioPriority = remainingMedia.filter(item => 
    !highPriority.includes(item) &&
    item.type === 'audio' &&
    item.pageId?.startsWith('topic-') &&
    getTopicNumber(item.pageId) <= 5 // First 5 topics
  )
  if (audioPriority.length > 0) batches.push(audioPriority)
  
  // LOW PRIORITY BATCH: Everything else (later topics, captions, etc.)
  const lowPriority = remainingMedia.filter(item => 
    !highPriority.includes(item) &&
    !mediumPriority.includes(item) &&
    !audioPriority.includes(item)
  )
  if (lowPriority.length > 0) batches.push(lowPriority)
  
  return batches
}

function getTopicNumber(pageId: string): number {
  const match = pageId.match(/topic-(\d+)/)
  return match ? parseInt(match[1], 10) : 999
}

describe('Progressive Loading Prioritization', () => {
  test('should correctly prioritize media into intelligent batches', () => {
    console.log('[TEST] 🔍 Testing progressive loading prioritization algorithm...')
    
    // Setup test data representing a typical SCORM project
    const testMedia: TestMediaItem[] = [
      // High priority: Welcome/objectives audio
      { id: 'audio-0', type: 'audio', pageId: 'welcome' },
      { id: 'audio-1', type: 'audio', pageId: 'objectives' },
      
      // Medium priority: Visual media from early topics
      { id: 'image-topic-1', type: 'image', pageId: 'topic-1' },
      { id: 'video-topic-2', type: 'video', pageId: 'topic-2' },
      { id: 'image-topic-3', type: 'image', pageId: 'topic-3' },
      
      // Audio priority: Audio from early topics  
      { id: 'audio-2', type: 'audio', pageId: 'topic-1' },
      { id: 'audio-3', type: 'audio', pageId: 'topic-4' },
      
      // Low priority: Later topics and captions
      { id: 'video-topic-8', type: 'video', pageId: 'topic-8' },
      { id: 'caption-1', type: 'caption', pageId: 'topic-1' },
      { id: 'audio-10', type: 'audio', pageId: 'topic-10' },
    ]
    
    const prioritizedBatches = prioritizeMediaForLoading(testMedia)
    
    console.log(`[TEST] Generated ${prioritizedBatches.length} priority batches`)
    
    // VERIFY BATCH STRUCTURE
    expect(prioritizedBatches.length).toBeGreaterThan(0)
    
    // HIGH PRIORITY BATCH: Should contain welcome/objectives audio
    const highPriorityBatch = prioritizedBatches[0]
    expect(highPriorityBatch).toBeDefined()
    expect(highPriorityBatch.some(item => item.id === 'audio-0')).toBe(true) // welcome audio
    expect(highPriorityBatch.some(item => item.id === 'audio-1')).toBe(true) // objectives audio
    expect(highPriorityBatch.every(item => item.type === 'audio')).toBe(true)
    
    console.log(`[TEST] High Priority batch: ${highPriorityBatch.length} items`)
    
    // MEDIUM PRIORITY BATCH: Should contain visual media from topics 1-3
    if (prioritizedBatches.length > 1) {
      const mediumPriorityBatch = prioritizedBatches[1]
      expect(mediumPriorityBatch.some(item => item.id === 'image-topic-1')).toBe(true)
      expect(mediumPriorityBatch.some(item => item.id === 'video-topic-2')).toBe(true)
      expect(mediumPriorityBatch.some(item => item.id === 'image-topic-3')).toBe(true)
      expect(mediumPriorityBatch.every(item => item.type === 'image' || item.type === 'video')).toBe(true)
      
      console.log(`[TEST] Medium Priority batch: ${mediumPriorityBatch.length} items`)
    }
    
    // AUDIO PRIORITY BATCH: Should contain topic audio from early topics
    if (prioritizedBatches.length > 2) {
      const audioPriorityBatch = prioritizedBatches[2]
      expect(audioPriorityBatch.some(item => item.id === 'audio-2')).toBe(true) // topic-1 audio
      expect(audioPriorityBatch.some(item => item.id === 'audio-3')).toBe(true) // topic-4 audio
      expect(audioPriorityBatch.every(item => item.type === 'audio')).toBe(true)
      
      console.log(`[TEST] Audio Priority batch: ${audioPriorityBatch.length} items`)
    }
    
    // LOW PRIORITY BATCH: Should contain later topics and captions
    if (prioritizedBatches.length > 3) {
      const lowPriorityBatch = prioritizedBatches[3]
      expect(lowPriorityBatch.some(item => item.id === 'video-topic-8')).toBe(true)
      expect(lowPriorityBatch.some(item => item.id === 'caption-1')).toBe(true) 
      expect(lowPriorityBatch.some(item => item.id === 'audio-10')).toBe(true)
      
      console.log(`[TEST] Low Priority batch: ${lowPriorityBatch.length} items`)
    }
    
    // VERIFY NO DUPLICATES across batches
    const allBatchedItems = prioritizedBatches.flat()
    const uniqueIds = new Set(allBatchedItems.map(item => item.id))
    expect(allBatchedItems.length).toBe(uniqueIds.size)
    
    // VERIFY ALL ITEMS ARE INCLUDED
    expect(allBatchedItems.length).toBe(testMedia.length)
    
    console.log('[TEST] ✅ Progressive loading prioritization algorithm verified')
  })

  test('should handle edge cases correctly', () => {
    console.log('[TEST] 🔍 Testing progressive loading edge cases...')
    
    // Edge case: No media
    expect(prioritizeMediaForLoading([])).toEqual([])
    
    // Edge case: Only high priority media
    const highPriorityOnly: TestMediaItem[] = [
      { id: 'audio-0', type: 'audio', pageId: 'welcome' },
      { id: 'audio-1', type: 'audio', pageId: 'objectives' }
    ]
    const batches = prioritizeMediaForLoading(highPriorityOnly)
    expect(batches.length).toBe(1)
    expect(batches[0].length).toBe(2)
    
    // Edge case: No high priority media
    const noHighPriority: TestMediaItem[] = [
      { id: 'image-topic-1', type: 'image', pageId: 'topic-1' },
      { id: 'video-topic-8', type: 'video', pageId: 'topic-8' }
    ]
    const batchesNoHigh = prioritizeMediaForLoading(noHighPriority)
    expect(batchesNoHigh.length).toBeGreaterThan(0)
    
    console.log('[TEST] ✅ Edge cases handled correctly')
  })

  test('should correctly parse topic numbers', () => {
    expect(getTopicNumber('topic-1')).toBe(1)
    expect(getTopicNumber('topic-10')).toBe(10)
    expect(getTopicNumber('welcome')).toBe(999) // fallback
    expect(getTopicNumber('topic-abc')).toBe(999) // invalid format
  })
})