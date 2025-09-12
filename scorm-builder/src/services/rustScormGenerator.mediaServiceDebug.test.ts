/**
 * Debug test to investigate why MediaService.listAllMedia() returns empty array
 * for the user's actual project when the files clearly exist
 */

import { describe, it, expect } from 'vitest'
import { createMediaService } from './MediaService'

describe('MediaService Debug Investigation', () => {
  const PROJECT_ID = '1756944000180'
  const EXPECTED_FILES = ['image-0', 'image-3', 'image-4', 'image-5', 'video-1', 'video-2', 'video-6']
  
  it('should debug why listAllMedia returns empty for real project', async () => {
    console.log(`[DEBUG] Creating MediaService for project: ${PROJECT_ID}`)
    console.log(`[DEBUG] Expected files in: C:\\Users\\sierr\\Documents\\SCORM Projects\\${PROJECT_ID}\\media`)
    console.log(`[DEBUG] Expected files: ${EXPECTED_FILES.join(', ')}`)
    
    const mediaService = createMediaService(PROJECT_ID)
    
    // Test the listAllMedia method directly
    console.log(`[DEBUG] Calling listAllMedia()...`)
    const allMedia = await mediaService.listAllMedia()
    
    console.log(`[DEBUG] listAllMedia() returned:`, allMedia)
    console.log(`[DEBUG] Count: ${allMedia.length}`)
    console.log(`[DEBUG] IDs: [${allMedia.map(m => m.id).join(', ')}]`)
    
    if (allMedia.length === 0) {
      console.log(`[DEBUG] ❌ No media found! This explains the "only 1 media file" issue.`)
      console.log(`[DEBUG] Possible causes:`)
      console.log(`[DEBUG] 1. FileStorage not finding the project directory`)
      console.log(`[DEBUG] 2. Rust backend get_all_project_media_metadata failing`)
      console.log(`[DEBUG] 3. Project ID mismatch`)
      console.log(`[DEBUG] 4. MediaService cache is empty and file system read failed`)
    } else {
      console.log(`[DEBUG] ✅ Found ${allMedia.length} media items`)
      allMedia.forEach((item, i) => {
        console.log(`[DEBUG] Media ${i + 1}: ${item.id} (${item.type}) - ${item.fileName}`)
      })
    }
    
    // Now test if we can access individual media files
    for (const expectedFile of EXPECTED_FILES) {
      try {
        console.log(`[DEBUG] Attempting to getMedia('${expectedFile}')...`)
        const mediaData = await mediaService.getMedia(expectedFile)
        
        if (mediaData) {
          console.log(`[DEBUG] ✅ Successfully got ${expectedFile}: ${mediaData.data?.byteLength || 0} bytes, mime: ${mediaData.metadata?.mimeType}`)
        } else {
          console.log(`[DEBUG] ❌ getMedia('${expectedFile}') returned null/undefined`)
        }
      } catch (error) {
        console.log(`[DEBUG] ❌ getMedia('${expectedFile}') failed:`, error)
      }
    }
  })
  
  it('should test FileStorage directly', async () => {
    console.log(`[DEBUG] Testing FileStorage directly...`)
    
    // Import FileStorage to test it directly
    const { FileStorage } = await import('./FileStorage')
    const fileStorage = new FileStorage()
    
    // Check if project is open
    console.log(`[DEBUG] FileStorage current project ID:`, (fileStorage as any)._currentProjectId)
    console.log(`[DEBUG] FileStorage current project path:`, (fileStorage as any)._currentProjectPath)
    
    // Try to get all project media
    try {
      const allProjectMedia = await fileStorage.getAllProjectMedia()
      console.log(`[DEBUG] FileStorage.getAllProjectMedia() returned:`, allProjectMedia)
      console.log(`[DEBUG] Count: ${allProjectMedia.length}`)
      
      if (allProjectMedia.length === 0) {
        console.log(`[DEBUG] ❌ FileStorage also returns empty! This confirms the issue is in FileStorage/Rust backend.`)
      }
    } catch (error) {
      console.log(`[DEBUG] ❌ FileStorage.getAllProjectMedia() failed:`, error)
    }
  })
  
  it('should test if files exist on disk', async () => {
    console.log(`[DEBUG] Checking if project files actually exist on disk...`)
    
    // We know the files exist because we've seen them with ls commands
    // This test documents that the files are there but MediaService can't see them
    
    const expectedPath = `C:\\Users\\sierr\\Documents\\SCORM Projects\\${PROJECT_ID}\\media`
    console.log(`[DEBUG] Expected path: ${expectedPath}`)
    
    console.log(`[DEBUG] Files we know exist (from previous ls commands):`)
    const knownFiles = [
      'image-0.bin', 'image-0.json',
      'image-3.bin', 'image-3.json', 
      'image-4.bin', 'image-4.json',
      'image-5.bin', 'image-5.json',
      'video-1.bin', 'video-1.json',
      'video-2.bin', 'video-2.json', 
      'video-6.bin', 'video-6.json'
    ]
    
    knownFiles.forEach(file => {
      console.log(`[DEBUG] - ${file}`)
    })
    
    console.log(`[DEBUG] Total: ${knownFiles.length} files (${EXPECTED_FILES.length} media items)`)
    console.log(`[DEBUG] BUT: MediaService.listAllMedia() returns 0 items`)
    console.log(`[DEBUG] CONCLUSION: There's a disconnect between the file system and the MediaService`)
  })
})