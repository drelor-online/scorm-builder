/**
 * Coordinated Project Loading Utility
 * 
 * This utility coordinates the project loading between usePersistentStorage 
 * and UnifiedMediaContext to prevent loading hangs where the progress
 * reports 100% but media is still loading.
 */

import type { UnifiedMediaContextType } from '../contexts/UnifiedMediaContext'

export interface CoordinatedLoadingProgress {
  phase: 'loading' | 'media' | 'content' | 'finalizing'
  percent: number
  message: string
  itemsLoaded?: number
  totalItems?: number
}

export interface CoordinatedLoadingOptions {
  projectId: string
  storage: any // PersistentStorageContextValue type
  mediaContext: UnifiedMediaContextType | null
  onProgress?: (progress: CoordinatedLoadingProgress) => void
}

/**
 * LOADING COORDINATION FIX
 * 
 * This function coordinates the loading between:
 * 1. usePersistentStorage.openProject() - handles project file loading
 * 2. UnifiedMediaContext critical media preloading - handles essential media
 * 
 * The fix ensures progress doesn't report 100% until both are complete.
 */
export async function openProjectWithCoordination({
  projectId,
  storage,
  mediaContext,
  onProgress
}: CoordinatedLoadingOptions): Promise<void> {
  console.log('[CoordinatedLoading] 🚀 Starting coordinated project loading...')
  
  try {
    let criticalMediaLoadingComplete = false
    
    // Set up callback to track critical media loading completion
    if (mediaContext) {
      mediaContext.setCriticalMediaLoadingCallback(() => {
        console.log('[CoordinatedLoading] ✅ Critical media loading completed')
        criticalMediaLoadingComplete = true
      })
    } else {
      console.log('[CoordinatedLoading] ⚠️ No media context - proceeding without media coordination')
      criticalMediaLoadingComplete = true // Skip media coordination if no context
    }
    
    // Start storage loading with appropriate progress handling
    if (mediaContext) {
      // WITH media context: Intercept 100% progress to wait for coordination
      await storage.openProject(projectId, (progress: CoordinatedLoadingProgress) => {
        // Pass through all progress except the final 100%
        if (progress.percent < 100) {
          onProgress?.(progress)
        } else {
          // Don't report 100% yet - wait for media coordination
          onProgress?.({ 
            ...progress, 
            percent: 95, 
            message: 'Waiting for media loading...'
          })
        }
      })
    } else {
      // WITHOUT media context: Let storage complete normally without interception
      console.log('[CoordinatedLoading] 💨 No media coordination needed - letting storage complete normally')
      await storage.openProject(projectId, onProgress)
      console.log('[CoordinatedLoading] ✅ Storage completed normally without coordination')
      return // Exit early - storage handled everything including currentProjectId
    }
    
    console.log('[CoordinatedLoading] ✅ Storage loading completed, checking media status...')
    
    // Only wait for media loading if we have a media context
    if (mediaContext) {
      // Wait for critical media loading to complete (with timeout)
      const mediaLoadingTimeout = 5000 // 5 second timeout
      const startTime = Date.now()
      
      while (!criticalMediaLoadingComplete && (Date.now() - startTime) < mediaLoadingTimeout) {
        await new Promise(resolve => setTimeout(resolve, 50)) // Check every 50ms
      }
      
      if (!criticalMediaLoadingComplete) {
        console.warn('[CoordinatedLoading] ⏰ Media loading timed out, proceeding anyway')
      }
      
      // Now report actual completion (only needed when we waited for media)
      onProgress?.({ 
        phase: 'finalizing', 
        percent: 100, 
        message: 'Project ready!' 
      })
    } else {
      console.log('[CoordinatedLoading] ✅ No media coordination needed, already at 100%')
    }
    
    console.log('[CoordinatedLoading] 🎉 Coordinated loading completed successfully')
    
  } catch (error) {
    console.error('[CoordinatedLoading] ❌ Coordinated loading failed:', error)
    throw error
  } finally {
    // Clean up callback (only if we have a media context)
    if (mediaContext) {
      mediaContext.setCriticalMediaLoadingCallback(undefined)
    }
  }
}