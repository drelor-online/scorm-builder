/**
 * Test for resolveImageUrl function logging behavior
 * 
 * This verifies the convertToRustFormat function doesn't log 
 * "resolveImageUrl called with: undefined" for topics without images
 */

import { vi } from 'vitest'
import type { CourseContent } from '../types/scorm'

describe('resolveImageUrl Logging Behavior', () => {
  // Mock the console.log to check if it's called with undefined
  let consoleSpy: any
  
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  
  afterEach(() => {
    consoleSpy.mockRestore()
  })

  test('should not log "resolveImageUrl called with: undefined" for topics without images', async () => {
    // ARRANGE
    const { convertToRustFormat } = await import('../services/rustScormGenerator')
    
    // Create course content with topics that have no images (undefined imageUrl)
    const courseContent: CourseContent = {
      courseTitle: 'Test Course',
      passMark: 80,
      topics: [
        {
          id: 'topic-1',
          title: 'Topic Without Image',
          content: 'Content here',
          // No imageUrl property - should be undefined
        },
        {
          id: 'topic-2', 
          title: 'Topic With Null Image',
          content: 'Content here',
          imageUrl: null as any
        }
      ]
    }
    
    // ACT - Convert to Rust format which internally calls resolveImageUrl
    await convertToRustFormat(courseContent, 'test-project')
    
    // ASSERT - Should not log undefined values
    const undefinedLogs = consoleSpy.mock.calls.filter((call: any[]) => 
      call[0] === '[Rust SCORM] resolveImageUrl called with:' && 
      (call[1] === undefined || call[1] === null)
    )
    
    expect(undefinedLogs).toHaveLength(0)
  })

  test('should log when resolveImageUrl is called with valid media ID', async () => {
    // ARRANGE
    const { convertToRustFormat } = await import('../services/rustScormGenerator')
    
    const courseContent: CourseContent = {
      courseTitle: 'Test Course',
      passMark: 80,
      topics: [
        {
          id: 'topic-1',
          title: 'Topic With Image',
          content: 'Content here',
          imageUrl: 'image-123' // Use a media ID instead of external URL to avoid download timeout
        }
      ]
    }
    
    // ACT
    await convertToRustFormat(courseContent, 'test-project')
    
    // ASSERT - Should log for valid media IDs
    expect(consoleSpy).toHaveBeenCalledWith(
      '[Rust SCORM] resolveImageUrl called with:',
      'image-123'
    )
  })

  test('should not log for empty string imageUrl', async () => {
    // ARRANGE
    const { convertToRustFormat } = await import('../services/rustScormGenerator')
    
    const courseContent: CourseContent = {
      courseTitle: 'Test Course',
      passMark: 80,
      topics: [
        {
          id: 'topic-1',
          title: 'Topic With Empty Image',
          content: 'Content here',
          imageUrl: ''
        }
      ]
    }
    
    // ACT
    await convertToRustFormat(courseContent, 'test-project')
    
    // ASSERT - Should not log empty strings
    const emptyStringLogs = consoleSpy.mock.calls.filter((call: any[]) => 
      call[0] === '[Rust SCORM] resolveImageUrl called with:' && call[1] === ''
    )
    
    expect(emptyStringLogs).toHaveLength(0)
  })
})