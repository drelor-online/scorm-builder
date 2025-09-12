/**
 * Direct test of Rust media loading function to diagnose MediaService issue
 */

import { describe, it, expect } from 'vitest'
import { invoke } from '@tauri-apps/api/core'

describe('Direct Rust Media Loading Test', () => {
  const PROJECT_ID = '1756944000180' // Project we know has media files on disk
  
  it('should call get_all_project_media_metadata directly from Rust backend', async () => {
    console.log(`[DIRECT TEST] 🔧 Calling Rust get_all_project_media_metadata directly for project: ${PROJECT_ID}`)
    
    try {
      // Call Rust function directly to bypass MediaService
      const result = await invoke('get_all_project_media_metadata', {
        projectId: PROJECT_ID
      })
      
      console.log(`[DIRECT TEST] 📊 Rust function returned:`, result)
      console.log(`[DIRECT TEST] 📊 Result type:`, typeof result)
      console.log(`[DIRECT TEST] 📊 Is array:`, Array.isArray(result))
      console.log(`[DIRECT TEST] 📊 Result JSON:`, JSON.stringify(result, null, 2))
      
      if (Array.isArray(result)) {
        console.log(`[DIRECT TEST] 📊 Array length:`, result.length)
        
        if (result.length > 0) {
          console.log(`[DIRECT TEST] 📊 First item:`, result[0])
          console.log(`[DIRECT TEST] 📊 All media IDs:`, result.map((item: any) => item.id))
          
          // Check if we get our expected media files
          const expectedIds = ['image-3', 'image-4', 'image-5', 'video-6']
          const foundIds = result.map((item: any) => item.id)
          
          expectedIds.forEach(expectedId => {
            const found = foundIds.includes(expectedId)
            console.log(`[DIRECT TEST] ${found ? '✅' : '❌'} ${expectedId}: ${found ? 'FOUND' : 'MISSING'}`)
          })
          
          expect(result.length).toBeGreaterThan(0)
        } else {
          console.log(`[DIRECT TEST] ⚠️  Rust function returned empty array - media directory may not exist or be readable`)
        }
      }
      
    } catch (error) {
      console.error(`[DIRECT TEST] ❌ Direct Rust call failed:`, error)
      console.error(`[DIRECT TEST] ❌ Error details:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      
      // Don't fail the test - we want to see what the error is
      console.log(`[DIRECT TEST] 🔍 This error suggests the issue is in the Rust backend media loading`)
    }
  })
  
  it('should check if project directory exists via Rust', async () => {
    console.log(`[DIRECT TEST] 📁 Checking if project directory exists for: ${PROJECT_ID}`)
    
    try {
      const projectsDir = await invoke('get_projects_directory')
      console.log(`[DIRECT TEST] 📁 Projects directory:`, projectsDir)
      
      const expectedProjectPath = `${projectsDir}\\${PROJECT_ID}`
      console.log(`[DIRECT TEST] 📁 Expected project path:`, expectedProjectPath)
      
      const expectedMediaPath = `${expectedProjectPath}\\media`
      console.log(`[DIRECT TEST] 📁 Expected media path:`, expectedMediaPath)
      
    } catch (error) {
      console.error(`[DIRECT TEST] ❌ Failed to get projects directory:`, error)
    }
  })
})