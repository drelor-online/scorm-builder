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
import { extractProjectId } from './projectIdExtraction'

export async function openProjectWithCoordination({
  projectId,
  storage,
  mediaContext,
  onProgress
}: CoordinatedLoadingOptions): Promise<void> {
  console.log('[CoordinatedLoading] 🚀 Starting coordinated project loading...')

  // CRITICAL FIX: Extract the actual project ID from path if needed
  const expectedProjectId = extractProjectId(projectId)
  console.log('[CoordinatedLoading] 🔧 ID extraction:', {
    originalProjectId: projectId,
    extractedProjectId: expectedProjectId,
    wasPath: projectId.includes('.scormproj')
  })

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
      // WITHOUT media context: Let storage complete but ensure state synchronization
      console.log('[CoordinatedLoading] 💨 No media coordination needed - but ensuring state sync')
      await storage.openProject(projectId, onProgress)
      console.log('[CoordinatedLoading] ✅ Storage completed normally without coordination')

      // SYNCHRONIZATION FIX: Don't return early - continue to ensure state is properly synchronized
      // The early return was causing React state updates to be missed in dashboard loading
    }
    
    console.log('[CoordinatedLoading] ✅ Storage loading completed, checking media status...')

    // IMPROVED SYNCHRONIZATION: Check both React state and FileStorage instance
    console.log('[CoordinatedLoading] 🔄 Ensuring React state synchronization...')

    // Wait for React state updates to flush
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify synchronization using both sources
    const verifyAttempts = 15 // Increased attempts
    for (let i = 0; i < verifyAttempts; i++) {
      const reactProjectId = storage.currentProjectId;
      const fileStorageProjectId = storage.fileStorage?.currentProjectId;

      // Primary check: FileStorage has the correct project ID (most important)
      // CRITICAL FIX: Compare extracted ID to extracted ID, not path to ID
      if (fileStorageProjectId === expectedProjectId) {
        console.log('[CoordinatedLoading] ✅ FileStorage state verified successfully', {
          reactState: reactProjectId,
          fileStorageState: fileStorageProjectId,
          expected: expectedProjectId,
          originalProjectId: projectId,
          reactSynced: reactProjectId === expectedProjectId
        });

        // If React state is also synced, great! If not, the polling will handle it
        if (reactProjectId === expectedProjectId) {
          console.log('[CoordinatedLoading] ✅ Both React and FileStorage are synchronized');
        } else {
          console.log('[CoordinatedLoading] ⏳ FileStorage ready, React state will sync via polling');
        }
        break;
      }

      console.log(`[CoordinatedLoading] ⏳ Waiting for FileStorage sync... (${i + 1}/${verifyAttempts})`, {
        reactState: reactProjectId,
        fileStorageState: fileStorageProjectId,
        expected: expectedProjectId,
        originalProjectId: projectId
      });
      await new Promise(resolve => setTimeout(resolve, 100)); // Increased delay
    }

    // Final verification
    const finalReactProjectId = storage.currentProjectId;
    const finalFileStorageProjectId = storage.fileStorage?.currentProjectId;

    // CRITICAL FIX: Compare extracted IDs, not path vs ID
    if (finalReactProjectId !== expectedProjectId && finalFileStorageProjectId !== expectedProjectId) {
      console.warn('[CoordinatedLoading] ⚠️ WARNING: Neither React state nor FileStorage is synchronized properly', {
        reactState: finalReactProjectId,
        fileStorageState: finalFileStorageProjectId,
        expected: expectedProjectId,
        originalProjectId: projectId
      });
    } else {
      console.log('[CoordinatedLoading] ✅ Final verification successful', {
        reactState: finalReactProjectId,
        fileStorageState: finalFileStorageProjectId,
        expected: expectedProjectId,
        originalProjectId: projectId,
        reactSynced: finalReactProjectId === expectedProjectId,
        fileStorageSynced: finalFileStorageProjectId === expectedProjectId
      });
    }

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
      console.log('[CoordinatedLoading] ✅ No media coordination needed, reporting completion')
      // Ensure we report completion even without media context
      onProgress?.({
        phase: 'finalizing',
        percent: 100,
        message: 'Project ready!'
      })
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