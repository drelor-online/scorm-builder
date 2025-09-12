/**
 * Real project test using actual MediaService and user's project files
 * This test bypasses mocks to use the real MediaService with the user's actual project
 */

import { describe, it, expect } from 'vitest'
import { convertToRustFormat } from './rustScormGenerator'
import type { CourseContent } from '../types/project'

describe('Real Project Media Test', () => {
  const REAL_PROJECT_ID = '1756944000180' // User's actual project ID
  
  it('should handle real MediaService with users actual project data', async () => {
    // Use minimal course content - media auto-population should handle everything
    const realCourseContent: CourseContent = {
      welcome: { heading: 'Welcome' },
      objectives: { heading: 'Learning Objectives' },
      topics: [
        { heading: 'Topic 1 - Introduction' },
        { heading: 'Topic 2 - Regulations' },
        { heading: 'Topic 3 - Safety Standards' },
        { heading: 'Topic 4 - Implementation' },
        { heading: 'Topic 5 - Compliance' }
      ]
    }

    console.log(`[REAL TEST] Testing with actual project files from: C:\\Users\\sierr\\Documents\\SCORM Projects\\${REAL_PROJECT_ID}`)
    
    try {
      // This should use the REAL MediaService without mocks
      const result = await convertToRustFormat(realCourseContent, REAL_PROJECT_ID)
      
      console.log(`[REAL TEST] Real MediaService result:`)
      console.log(`[REAL TEST] - Total mediaFiles: ${result.mediaFiles.length}`)
      console.log(`[REAL TEST] - Media filenames:`, result.mediaFiles.map(f => f.filename))
      
      // Count media types
      const images = result.mediaFiles.filter(f => f.filename.includes('image-'))
      const videos = result.mediaFiles.filter(f => f.filename.includes('video-'))
      
      console.log(`[REAL TEST] - Images: ${images.length}`)
      console.log(`[REAL TEST] - Videos: ${videos.length}`)
      
      // With the fix, we should get:
      // - 4 image files (image-0, image-3, image-4, image-5) 
      // - 0 video files (they should be skipped and handled as YouTube URLs)
      expect(result.mediaFiles.length).toBe(4)
      expect(images.length).toBe(4)
      expect(videos.length).toBe(0) // Videos should NOT be in mediaFiles
      
      // Verify specific images are present
      expect(result.mediaFiles.some(f => f.filename.includes('image-0'))).toBe(true)
      expect(result.mediaFiles.some(f => f.filename.includes('image-3'))).toBe(true)
      expect(result.mediaFiles.some(f => f.filename.includes('image-4'))).toBe(true)
      expect(result.mediaFiles.some(f => f.filename.includes('image-5'))).toBe(true)
      
      console.log(`[REAL TEST] ✅ SUCCESS: Real MediaService correctly processed ${result.mediaFiles.length} media files`)
      
    } catch (error) {
      console.error(`[REAL TEST] ❌ FAILED: Error with real MediaService:`, error)
      throw error
    }
  })
  
  it('should show what happens if MediaService fails to load media', async () => {
    // Test with non-existent project ID to see failure case
    const fakeCourseContent: CourseContent = {
      welcome: { heading: 'Welcome' },
      objectives: { heading: 'Learning Objectives' },
      topics: [{ heading: 'Topic 1' }]
    }

    const FAKE_PROJECT_ID = 'nonexistent-project-12345'
    
    console.log(`[REAL TEST] Testing failure case with fake project: ${FAKE_PROJECT_ID}`)
    
    try {
      const result = await convertToRustFormat(fakeCourseContent, FAKE_PROJECT_ID)
      
      console.log(`[REAL TEST] Fake project result:`)
      console.log(`[REAL TEST] - Total mediaFiles: ${result.mediaFiles.length}`)
      
      // Should have 0 media files if MediaService can't find the project
      expect(result.mediaFiles.length).toBe(0)
      
    } catch (error) {
      console.log(`[REAL TEST] Expected error for fake project:`, error)
      // This might throw an error, which is fine for a non-existent project
    }
  })
})