/**
 * Test that properly opens the project before accessing media
 * This should fix the issue where MediaService returns empty array
 */

import { describe, it, expect } from 'vitest'
import { convertToRustFormat } from './rustScormGenerator'
import type { CourseContent } from '../types/project'

describe('Fixed Media Access - Project Opening', () => {
  const PROJECT_ID = '1756944000180'
  const PROJECT_PATH = `C:\\Users\\sierr\\Documents\\SCORM Projects\\Complex_Projects_-_1_-_49_CFR_192_${PROJECT_ID}.scormproj`
  
  it('should access media after properly opening the project', async () => {
    console.log(`[FIX TEST] Testing media access with proper project opening`)
    console.log(`[FIX TEST] Project ID: ${PROJECT_ID}`)
    console.log(`[FIX TEST] Project File: ${PROJECT_PATH}`)
    
    // First, let's manually open the project using FileStorage
    const { FileStorage } = await import('./FileStorage')
    const fileStorage = new FileStorage()
    
    try {
      console.log(`[FIX TEST] Opening project: ${PROJECT_PATH}`)
      await fileStorage.openProject(PROJECT_PATH)
      console.log(`[FIX TEST] ✅ Project opened successfully`)
      
      // Check that the project is now open
      console.log(`[FIX TEST] Current project ID:`, (fileStorage as any)._currentProjectId)
      console.log(`[FIX TEST] Current project path:`, (fileStorage as any)._currentProjectPath)
      
      // Now try to get all project media
      const allProjectMedia = await fileStorage.getAllProjectMedia()
      console.log(`[FIX TEST] FileStorage.getAllProjectMedia() returned: ${allProjectMedia.length} items`)
      
      allProjectMedia.forEach((media, i) => {
        console.log(`[FIX TEST] Media ${i + 1}: ${media.id} (${media.mediaType})`)
      })
      
      if (allProjectMedia.length === 7) {
        console.log(`[FIX TEST] 🎉 SUCCESS! Found all 7 expected media items`)
        
        // Verify we have the expected items
        const expectedIds = ['image-0', 'image-3', 'image-4', 'image-5', 'video-1', 'video-2', 'video-6']
        const foundIds = allProjectMedia.map(m => m.id)
        const missingIds = expectedIds.filter(id => !foundIds.includes(id))
        const extraIds = foundIds.filter(id => !expectedIds.includes(id))
        
        console.log(`[FIX TEST] Expected: [${expectedIds.join(', ')}]`)
        console.log(`[FIX TEST] Found: [${foundIds.join(', ')}]`)
        console.log(`[FIX TEST] Missing: [${missingIds.join(', ')}]`)
        console.log(`[FIX TEST] Extra: [${extraIds.join(', ')}]`)
        
        expect(allProjectMedia.length).toBe(7)
        expect(missingIds.length).toBe(0)
        
      } else {
        console.log(`[FIX TEST] ❌ Still getting wrong count: ${allProjectMedia.length}`)
      }
      
    } catch (error) {
      console.error(`[FIX TEST] ❌ Failed to open project:`, error)
      throw error
    }
  })
  
  it('should generate SCORM with correct media when project is open', async () => {
    console.log(`[FIX TEST] Testing full SCORM generation with open project`)
    
    // Open project first
    const { FileStorage } = await import('./FileStorage')
    const fileStorage = new FileStorage()
    
    try {
      await fileStorage.openProject(PROJECT_PATH)
      console.log(`[FIX TEST] Project opened for SCORM generation`)
      
      // Now create MediaService with the opened project
      const { createMediaService } = await import('./MediaService')
      const mediaService = createMediaService(PROJECT_ID)
      
      // Test MediaService directly
      console.log(`[FIX TEST] Testing MediaService.listAllMedia()...`)
      const allMedia = await mediaService.listAllMedia()
      console.log(`[FIX TEST] MediaService found: ${allMedia.length} items`)
      
      if (allMedia.length > 0) {
        console.log(`[FIX TEST] 🎉 MediaService now working! Found media items:`)
        allMedia.forEach(item => {
          console.log(`[FIX TEST] - ${item.id} (${item.type})`)
        })
      }
      
      // Now test SCORM generation
      const mockCourseContent: CourseContent = {
        welcome: { heading: 'Welcome' },
        objectives: { heading: 'Learning Objectives' },
        topics: [
          { heading: 'Topic 1' },
          { heading: 'Topic 2' },
          { heading: 'Topic 3' },
          { heading: 'Topic 4' },
          { heading: 'Topic 5' }
        ]
      }
      
      console.log(`[FIX TEST] Running convertToRustFormat with open project...`)
      const result = await convertToRustFormat(mockCourseContent, PROJECT_ID)
      
      console.log(`[FIX TEST] SCORM generation result:`)
      console.log(`[FIX TEST] - Total mediaFiles: ${result.mediaFiles.length}`)
      console.log(`[FIX TEST] - Media filenames:`, result.mediaFiles.map(f => f.filename))
      
      // Count media types
      const images = result.mediaFiles.filter(f => f.filename.includes('image-'))
      const videos = result.mediaFiles.filter(f => f.filename.includes('video-'))
      
      console.log(`[FIX TEST] - Images: ${images.length}`)
      console.log(`[FIX TEST] - Videos: ${videos.length}`)
      
      // With the fix, we should get 4 image files
      // (YouTube videos should be skipped from mediaFiles and handled as URLs)
      expect(result.mediaFiles.length).toBe(4)
      expect(images.length).toBe(4)
      expect(videos.length).toBe(0) // Videos should NOT be in mediaFiles
      
      // Verify specific images are present
      expect(result.mediaFiles.some(f => f.filename.includes('image-0'))).toBe(true)
      expect(result.mediaFiles.some(f => f.filename.includes('image-3'))).toBe(true)
      expect(result.mediaFiles.some(f => f.filename.includes('image-4'))).toBe(true)
      expect(result.mediaFiles.some(f => f.filename.includes('image-5'))).toBe(true)
      
      console.log(`[FIX TEST] ✅ SUCCESS: Fixed SCORM generation with all media files!`)
      
    } catch (error) {
      console.error(`[FIX TEST] ❌ Failed during SCORM generation:`, error)
      throw error
    }
  })
})