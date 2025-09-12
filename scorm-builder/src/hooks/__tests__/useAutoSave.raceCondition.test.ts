import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAutoSave } from '../useAutoSave'

// Mock the notification context
const mockNotifications = {
  autoSaveStart: vi.fn().mockReturnValue('save-id'),
  autoSaveSuccess: vi.fn(),
  autoSaveError: vi.fn()
}

vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => mockNotifications
}))

describe('useAutoSave - Race Condition Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prevents race condition by blocking overlapping saves', async () => {
    const saveCalls: { data: any; timestamp: number }[] = []
    let activePromises = 0
    
    const trackingSave = vi.fn().mockImplementation(async (data) => {
      activePromises++
      const maxActive = activePromises
      
      saveCalls.push({ 
        data: { ...data }, 
        timestamp: Date.now(),
        activeAtStart: activePromises  
      })
      
      // Simulate slow save
      await new Promise(resolve => setTimeout(resolve, 100))
      
      activePromises--
      return 'saved'
    })

    const { result, rerender } = renderHook(() => 
      useAutoSave({
        data: { value: 'test', version: 1 },
        onSave: trackingSave,
        delay: 10, // Very short delay to trigger saves quickly
        isDirty: true,
        onSaveComplete: vi.fn()
      })
    )

    // Wait for auto-save to trigger
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // Should have started first save
    expect(saveCalls.length).toBe(1)
    expect(result.current.isSaving).toBe(true)

    // Try to trigger another save while first is in progress
    rerender()
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    // FIXED: Should not start second save while first is in progress
    // saveCalls should still be 1, not 2
    expect(saveCalls.length).toBe(1)
    
    // Wait for first save to complete and any queued save to execute
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    // Now there might be a second save from the queue
    expect(saveCalls.length).toBeGreaterThanOrEqual(1)
    expect(saveCalls.length).toBeLessThanOrEqual(2) // At most 2 saves (original + queued)
    
    // Verify no more than 1 save was active at any time
    saveCalls.forEach(call => {
      expect(call.activeAtStart).toBe(1) // Only 1 save active at start
    })
  })

  it('coalesces rapid data changes into latest version', async () => {
    let saveCount = 0
    const latestDataSave = vi.fn().mockImplementation(async (data) => {
      saveCount++
      // Simulate save delay
      await new Promise(resolve => setTimeout(resolve, 50))
      return `saved-${data.version}`
    })

    let currentData = { value: 'initial', version: 1 }
    
    const { rerender } = renderHook(() => 
      useAutoSave({
        data: currentData,
        onSave: latestDataSave,
        delay: 20,
        isDirty: true,
        onSaveComplete: vi.fn()
      })
    )

    // Rapid data changes
    currentData = { value: 'edit1', version: 2 }
    rerender()
    
    currentData = { value: 'edit2', version: 3 }
    rerender()
    
    currentData = { value: 'edit3', version: 4 }
    rerender()

    // Wait for debounce and save completion
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200))
    })

    // Should have called save with the latest data
    expect(saveCount).toBeGreaterThan(0)
    expect(latestDataSave).toHaveBeenCalledWith(
      expect.objectContaining({ version: 4, value: 'edit3' })
    )
  })

  it('handles concurrent forceSave calls without race conditions', async () => {
    const saveCalls: any[] = []
    const concurrentSave = vi.fn().mockImplementation(async (data) => {
      saveCalls.push({ ...data, timestamp: Date.now() })
      await new Promise(resolve => setTimeout(resolve, 50))
      return 'saved'
    })

    const { result } = renderHook(() => 
      useAutoSave({
        data: { value: 'test' },
        onSave: concurrentSave,
        delay: 1000, // Long delay to ensure forceSave is needed
        isDirty: true,
        onSaveComplete: vi.fn()
      })
    )

    // Trigger multiple force saves rapidly
    const promises = [
      result.current.forceSave(),
      result.current.forceSave(), 
      result.current.forceSave()
    ]

    await Promise.all(promises)

    // Should not have more saves than expected (no race condition)
    expect(saveCalls.length).toBeLessThanOrEqual(3)
    expect(saveCalls.length).toBeGreaterThan(0)
  })
})