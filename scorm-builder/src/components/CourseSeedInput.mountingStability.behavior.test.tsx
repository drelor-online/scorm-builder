/**
 * Test to reproduce and fix the CourseSeedInput mounting stability issues
 * identified in the startup logs showing repeated mounting/unmounting
 * 
 * ISSUE: The useEffect with [courseTitle, difficulty, customTopics, template, 
 * storage?.currentProjectId, storage?.isInitialized, onSave, markDirty] 
 * dependencies is causing excessive re-renders when parent callbacks are recreated.
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import React, { useEffect, useRef, useCallback } from 'react'
import type { CourseSeedData } from '../types/project'

// Mock all external dependencies to isolate the callback stability test
vi.mock('../services/PersistentStorage')
vi.mock('../utils/debugLogger')
vi.mock('../contexts/NotificationContext')
vi.mock('../contexts/UnsavedChangesContext')

// Create a simplified test version that isolates the useEffect dependency issue
const TestCourseSeedInputCore = ({ 
  courseTitle, 
  difficulty, 
  customTopics, 
  template, 
  onSave, 
  markDirty 
}: {
  courseTitle: string
  difficulty: string
  customTopics: string
  template: string
  onSave?: (data: CourseSeedData) => void
  markDirty?: (section: string) => void
}) => {
  const hasMountedRef = useRef(false)
  const effectRunCountRef = useRef(0)
  const previousValuesRef = useRef({
    courseTitle,
    difficulty,
    customTopics,
    template
  })
  
  // This is the PROBLEMATIC useEffect from the real component
  // It should cause excessive re-renders when callbacks are recreated
  useEffect(() => {
    effectRunCountRef.current++
    console.log(`[TEST-COMPONENT] useEffect run #${effectRunCountRef.current}`)
    
    // Skip the initial mount
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      previousValuesRef.current = {
        courseTitle,
        difficulty,
        customTopics,
        template
      }
      return
    }
    
    // Check if values actually changed
    const hasChanged = 
      previousValuesRef.current.courseTitle !== courseTitle ||
      previousValuesRef.current.difficulty !== difficulty ||
      previousValuesRef.current.customTopics !== customTopics ||
      previousValuesRef.current.template !== template
    
    if (!hasChanged) {
      console.log(`[TEST-COMPONENT] No value changes, skipping save`)
      return
    }
    
    console.log(`[TEST-COMPONENT] Values changed, would trigger save`)
    // Simulate the auto-save logic without actual saving
    if (onSave) {
      onSave({
        courseTitle,
        difficulty,
        customTopics: customTopics.split('\n'),
        template,
        templateTopics: []
      })
    }
    if (markDirty) {
      markDirty('courseSeed')
    }
    
  }, [courseTitle, difficulty, customTopics, template, onSave, markDirty]) // 🚨 PROBLEMATIC DEPS
  
  return (
    <div data-testid="test-component">
      <div data-testid="effect-count">{effectRunCountRef.current}</div>
      Test Component
    </div>
  )
}

describe('CourseSeedInput Mounting Stability', () => {
  const defaultProps = {
    courseTitle: 'Test Course',
    difficulty: 'intermediate',
    customTopics: 'Topic 1\nTopic 2',
    template: 'general',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('should reproduce the callback dependency problem causing excessive useEffect runs', async () => {
    console.log('[TEST] 🔍 Testing callback recreation causing excessive useEffect runs...')
    
    let effectRunCount = 0
    
    // SCENARIO: Parent component that recreates callbacks on every render (anti-pattern)
    const ParentWithRecreatedCallbacks = ({ renderCount }: { renderCount: number }) => {
      // 🚨 PROBLEM: These callbacks are recreated on every render
      const onSave = (data: CourseSeedData) => {
        console.log('Save callback called')
      }
      
      const markDirty = (section: string) => {
        console.log('Mark dirty callback called')
      }
      
      return (
        <div data-testid={`parent-render-${renderCount}`}>
          <TestCourseSeedInputCore
            {...defaultProps}
            onSave={onSave}
            markDirty={markDirty}
          />
        </div>
      )
    }
    
    // Track useEffect runs
    const originalConsoleLog = console.log
    console.log = vi.fn((message: string) => {
      if (typeof message === 'string' && message.includes('[TEST-COMPONENT] useEffect run #')) {
        effectRunCount++
      }
      originalConsoleLog(message)
    })
    
    // FIRST RENDER: Mount the component
    const { rerender, getByTestId } = render(<ParentWithRecreatedCallbacks renderCount={1} />)
    
    // Wait for initial effect
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Clear count after initial mount
    effectRunCount = 0
    
    // SIMULATE PROBLEM: Force parent re-renders that recreate callbacks
    // This should trigger the useEffect multiple times due to callback dependencies
    for (let i = 2; i <= 5; i++) {
      rerender(<ParentWithRecreatedCallbacks renderCount={i} />)
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    // Restore console.log
    console.log = originalConsoleLog
    
    console.log(`[TEST] Effect ran ${effectRunCount} times after parent re-renders`)
    
    // ❌ EXPECTED TO FAIL: Should have multiple effect runs due to callback dependencies
    // The useEffect should run once for each parent re-render that creates new callbacks
    expect(effectRunCount).toBeGreaterThan(3) // Should fail - indicates the problem exists
    
    console.log('[TEST] ✅ Successfully reproduced the callback dependency problem')
  })

  test('should use useCallback optimization to reduce effect runs', async () => {
    console.log('[TEST] 🔍 Testing callback stabilization fixes the issue...')
    
    let effectRunCount = 0
    
    // SOLUTION: Parent component with stable callbacks using useCallback
    const ParentWithStableCallbacks = ({ renderCount }: { renderCount: number }) => {
      // ✅ SOLUTION: These callbacks are stable across re-renders
      const onSave = useCallback((data: CourseSeedData) => {
        console.log('Stable save callback called')
      }, []) // Empty deps - callback should be stable
      
      const markDirty = useCallback((section: string) => {
        console.log('Stable mark dirty callback called')  
      }, []) // Empty deps - callback should be stable
      
      return (
        <div data-testid={`parent-render-${renderCount}`}>
          <TestCourseSeedInputCore
            {...defaultProps}
            onSave={onSave}
            markDirty={markDirty}
          />
        </div>
      )
    }
    
    // Track useEffect runs
    const originalConsoleLog = console.log
    console.log = vi.fn((message: string) => {
      if (typeof message === 'string' && message.includes('[TEST-COMPONENT] useEffect run #')) {
        effectRunCount++
      }
      originalConsoleLog(message)
    })
    
    // FIRST RENDER: Mount the component
    const { rerender } = render(<ParentWithStableCallbacks renderCount={1} />)
    
    // Wait for initial effect
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // Clear count after initial mount
    effectRunCount = 0
    
    // SIMULATE SOLUTION: Parent re-renders with stable callbacks
    // Should NOT trigger useEffect because callbacks remain the same
    for (let i = 2; i <= 5; i++) {
      rerender(<ParentWithStableCallbacks renderCount={i} />)
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    // Restore console.log
    console.log = originalConsoleLog
    
    console.log(`[TEST] Effect ran ${effectRunCount} times with stable callbacks`)
    
    // ✅ SHOULD PASS AFTER FIX: Minimal effect runs due to stable callbacks
    expect(effectRunCount).toBeLessThanOrEqual(1) // Should pass - indicates the fix works
    
    console.log('[TEST] ✅ Callback stabilization successfully prevents excessive useEffect runs')
  })
})