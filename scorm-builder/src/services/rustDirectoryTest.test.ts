/**
 * Test to isolate the directory resolution issue in Rust backend
 */

import { describe, it, expect } from 'vitest'
import { invoke } from '@tauri-apps/api/core'

describe('Rust Directory Resolution Test', () => {
  it('should troubleshoot directory resolution with catch blocks', async () => {
    console.log(`[DIRECTORY TEST] 🔍 Testing Rust directory functions with error handling`)
    
    try {
      console.log(`[DIRECTORY TEST] 📁 Attempting to call get_projects_directory...`)
      const result = await invoke('get_projects_directory')
      
      console.log(`[DIRECTORY TEST] 📁 get_projects_directory result:`, result)
      console.log(`[DIRECTORY TEST] 📁 Result type:`, typeof result)
      console.log(`[DIRECTORY TEST] 📁 Result JSON:`, JSON.stringify(result, null, 2))
      
      if (typeof result === 'string') {
        console.log(`[DIRECTORY TEST] ✅ SUCCESS: Projects directory is: ${result}`)
      } else {
        console.log(`[DIRECTORY TEST] ❌ ERROR: Expected string, got:`, typeof result)
        console.log(`[DIRECTORY TEST] This indicates the Rust function returned an Err(String) which was serialized as empty object`)
      }
    } catch (error) {
      // This shouldn't happen since Tauri converts Err to {} instead of throwing
      console.error(`[DIRECTORY TEST] 💥 Unexpected JavaScript error:`, error)
    }
  })

  it('should test media metadata function in detail', async () => {
    const PROJECT_ID = '1756944000180'
    console.log(`[DIRECTORY TEST] 📊 Testing get_all_project_media_metadata with: ${PROJECT_ID}`)
    
    try {
      const result = await invoke('get_all_project_media_metadata', {
        projectId: PROJECT_ID
      })
      
      console.log(`[DIRECTORY TEST] 📊 get_all_project_media_metadata result:`, result)
      console.log(`[DIRECTORY TEST] 📊 Result type:`, typeof result)
      console.log(`[DIRECTORY TEST] 📊 Is array:`, Array.isArray(result))
      
      if (Array.isArray(result)) {
        console.log(`[DIRECTORY TEST] ✅ SUCCESS: Found ${result.length} media items`)
        if (result.length > 0) {
          console.log(`[DIRECTORY TEST] Sample item:`, result[0])
        }
      } else {
        console.log(`[DIRECTORY TEST] ❌ ERROR: Expected array, got:`, typeof result)
        console.log(`[DIRECTORY TEST] This indicates the Rust function returned an Err(String)`)
      }
    } catch (error) {
      console.error(`[DIRECTORY TEST] 💥 Unexpected JavaScript error:`, error)
    }
  })
  
  it('should test if we can invoke any simple Rust function', async () => {
    console.log(`[DIRECTORY TEST] 🔧 Testing if Rust backend is responding at all`)
    
    try {
      // Test the simplest function to see if Rust is working
      const result = await invoke('greet', { name: 'Test' })
      console.log(`[DIRECTORY TEST] 🔧 greet function result:`, result)
      console.log(`[DIRECTORY TEST] ✅ Rust backend is responding`)
    } catch (error) {
      console.error(`[DIRECTORY TEST] 💥 Rust backend not responding:`, error)
    }
  })
})