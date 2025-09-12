/**
 * Loading Coordination Fix - Integration Test
 * 
 * This test verifies that the coordinated loading fix resolves the issue where:
 * - Progress reporting completes at 100% before media loading is actually done
 * - Dashboard closes loading dialog prematurely
 * 
 * The fix ensures progress waits for critical media loading before reporting completion.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import React from 'react'
import { openProjectWithCoordination } from './utils/coordinatedProjectLoading'

// Mock the storage and media context
const mockStorage = {
  openProject: vi.fn(),
  currentProjectId: 'test-project-123'
}

const mockMediaContext = {
  setCriticalMediaLoadingCallback: vi.fn()
}

describe('Loading Coordination Fix - Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should coordinate progress reporting with critical media loading', async () => {
    console.log('[TEST] 🔧 Testing coordinated loading fix...')
    
    let progressUpdates: any[] = []
    let criticalMediaCallback: (() => void) | undefined
    
    // SIMULATE: Storage loading that completes quickly
    mockStorage.openProject.mockImplementation(async (projectId: string, onProgress: (progress: any) => void) => {
      console.log('[MOCK] Storage loading starting...')
      
      onProgress({ phase: 'loading', percent: 10, message: 'Reading project metadata...' })
      await new Promise(resolve => setTimeout(resolve, 50))
      
      onProgress({ phase: 'media', percent: 20, message: 'Initializing media store...' })
      await new Promise(resolve => setTimeout(resolve, 50))
      
      onProgress({ phase: 'content', percent: 80, message: 'Loading course structure...' })
      await new Promise(resolve => setTimeout(resolve, 50))
      
      onProgress({ phase: 'finalizing', percent: 95, message: 'Finalizing workspace setup...' })
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Storage would normally report 100% here
      onProgress({ phase: 'finalizing', percent: 100, message: 'Project ready!' })
      
      console.log('[MOCK] Storage loading completed')
    })
    
    // SIMULATE: Media context that captures the callback
    mockMediaContext.setCriticalMediaLoadingCallback.mockImplementation((callback?: () => void) => {
      console.log('[MOCK] Setting critical media loading callback')
      criticalMediaCallback = callback
    })
    
    // Start coordinated loading
    const loadingPromise = openProjectWithCoordination({
      projectId: 'test-project-123',
      storage: mockStorage as any,
      mediaContext: mockMediaContext as any,
      onProgress: (progress) => {
        console.log('[TEST] Progress update:', progress)
        progressUpdates.push(progress)
      }
    })
    
    // Wait a bit for storage loading to complete
    await new Promise(resolve => setTimeout(resolve, 300))
    
    // VERIFY: Progress should not yet be at 100% (waiting for media)
    const progressAfterStorage = progressUpdates[progressUpdates.length - 1]
    console.log('[TEST] Progress after storage loading:', progressAfterStorage)
    
    expect(progressAfterStorage.percent).toBeLessThan(100)
    expect(progressAfterStorage.message).toContain('Waiting for media loading')
    
    console.log('[TEST] ✅ Confirmed: Progress is waiting for media loading')
    
    // SIMULATE: Critical media loading completes
    if (criticalMediaCallback) {
      console.log('[TEST] Simulating critical media loading completion...')
      criticalMediaCallback()
    }
    
    // Wait for coordinated loading to complete
    await loadingPromise
    
    // VERIFY: Progress should now be at 100%
    const finalProgress = progressUpdates[progressUpdates.length - 1]
    console.log('[TEST] Final progress:', finalProgress)
    
    expect(finalProgress.percent).toBe(100)
    expect(finalProgress.message).toBe('Project ready!')
    
    console.log('[TEST] ✅ Coordinated loading completed successfully')
    
    // VERIFY: Media context callback was set and cleared
    expect(mockMediaContext.setCriticalMediaLoadingCallback).toHaveBeenCalledWith(expect.any(Function))
    expect(mockMediaContext.setCriticalMediaLoadingCallback).toHaveBeenLastCalledWith(undefined)
    
    console.log('[TEST] ✅ Media context callback lifecycle managed correctly')
    console.log('[TEST] 🎉 Loading coordination fix verified!')
  })

  test('should handle timeout if media loading takes too long', async () => {
    console.log('[TEST] ⏰ Testing media loading timeout handling...')
    
    let progressUpdates: any[] = []
    
    // SIMULATE: Storage loading that completes quickly
    mockStorage.openProject.mockImplementation(async (projectId: string, onProgress: (progress: any) => void) => {
      onProgress({ phase: 'finalizing', percent: 100, message: 'Project ready!' })
    })
    
    // SIMULATE: Media context that never calls the callback (simulating hung media loading)
    mockMediaContext.setCriticalMediaLoadingCallback.mockImplementation((callback?: () => void) => {
      // Don't call the callback - simulate hung media loading
      console.log('[MOCK] Media loading callback set but will not be called (simulating timeout)')
    })
    
    // Start coordinated loading with short timeout for testing
    const startTime = Date.now()
    
    await openProjectWithCoordination({
      projectId: 'test-project-123',
      storage: mockStorage as any,
      mediaContext: mockMediaContext as any,
      onProgress: (progress) => {
        progressUpdates.push(progress)
      }
    })
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    // VERIFY: Should complete within reasonable time (timeout mechanism working)
    expect(duration).toBeGreaterThan(4000) // Should wait for timeout
    expect(duration).toBeLessThan(6000) // Should not wait indefinitely
    
    // VERIFY: Should still complete with 100% despite timeout
    const finalProgress = progressUpdates[progressUpdates.length - 1]
    expect(finalProgress.percent).toBe(100)
    
    console.log('[TEST] ✅ Timeout mechanism working correctly')
    console.log(`[TEST] Duration: ${duration}ms (expected ~5000ms)`)
  })

  test('should handle case with no media context gracefully - complete storage flow', async () => {
    console.log('[TEST] 🚫 Testing no media context scenario (Dashboard phase)...')
    
    let progressUpdates: any[] = []
    let storageCompletedNormally = false
    
    // SIMULATE: Storage loading that goes through normal phases
    mockStorage.openProject.mockImplementation(async (projectId: string, onProgress?: (progress: any) => void) => {
      console.log('[MOCK] Storage loading with standard phases (full flow)...')
      
      if (onProgress) {
        onProgress({ phase: 'loading', percent: 10, message: 'Reading project metadata...' })
        await new Promise(resolve => setTimeout(resolve, 50))
        
        onProgress({ phase: 'media', percent: 20, message: 'Initializing media store...' })
        await new Promise(resolve => setTimeout(resolve, 50))
        
        onProgress({ phase: 'content', percent: 80, message: 'Loading course structure...' })
        await new Promise(resolve => setTimeout(resolve, 50))
        
        onProgress({ phase: 'finalizing', percent: 95, message: 'Finalizing workspace setup...' })
        await new Promise(resolve => setTimeout(resolve, 50))
        
        // Storage completes normally - this should NOT be intercepted when no media context
        onProgress({ phase: 'finalizing', percent: 100, message: 'Project ready!' })
      }
      
      // Simulate storage internal state management (like setCurrentProjectId)
      storageCompletedNormally = true
      console.log('[MOCK] ✅ Storage internal state management completed (e.g., setCurrentProjectId)')
    })
    
    // Test with null media context (typical during dashboard phase)
    const startTime = Date.now()
    
    await openProjectWithCoordination({
      projectId: 'test-project-123',
      storage: mockStorage as any,
      mediaContext: null,
      onProgress: (progress) => {
        console.log('[TEST] Progress:', progress)
        progressUpdates.push(progress)
      }
    })
    
    const endTime = Date.now()
    const duration = endTime - startTime
    
    console.log(`[TEST] Completed in ${duration}ms (should be fast without interception)`)
    
    // VERIFY: Should complete quickly without coordination delays
    expect(duration).toBeLessThan(500) // Should be even faster now without interception
    
    // VERIFY: Storage completed its full flow
    expect(storageCompletedNormally).toBe(true)
    
    // VERIFY: Should get ALL progress updates including the final 100%
    const finalProgress = progressUpdates[progressUpdates.length - 1]
    expect(finalProgress.percent).toBe(100)
    expect(finalProgress.message).toBe('Project ready!')
    
    // VERIFY: Should not show "Waiting for media loading..." message
    const hasWaitingMessage = progressUpdates.some(p => p.message?.includes('Waiting for media loading'))
    expect(hasWaitingMessage).toBe(false)
    
    // VERIFY: Should receive all progress updates from storage (not intercepted)
    const progressPercents = progressUpdates.map(p => p.percent)
    expect(progressPercents).toEqual([10, 20, 80, 95, 100])
    
    console.log('[TEST] ✅ No media context handled gracefully with complete storage flow')
  })
})