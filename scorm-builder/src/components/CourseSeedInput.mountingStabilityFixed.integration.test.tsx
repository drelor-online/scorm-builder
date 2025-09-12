/**
 * Integration test to verify the CourseSeedInput mounting stability fix
 * This test ensures the real component no longer has excessive mounting with callback changes
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import React, { useCallback, useState } from 'react'
import { CourseSeedInput } from './CourseSeedInput'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import type { CourseSeedData } from '../types/project'

// Mock external dependencies
vi.mock('../services/PersistentStorage', () => ({
  PersistentStorage: {
    getInstance: vi.fn().mockReturnValue({
      currentProjectId: 'test-project',
      isInitialized: true,
      saveCourseSeedData: vi.fn().mockResolvedValue(undefined),
      saveProject: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('../utils/debugLogger', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

describe('CourseSeedInput Mounting Stability - Integration Test', () => {
  const TestProviders = ({ children }: { children: React.ReactNode }) => (
    <NotificationProvider>
      <UnsavedChangesProvider>
        {children}
      </UnsavedChangesProvider>
    </NotificationProvider>
  )

  test('should not cause excessive auto-save triggers when parent re-renders with new callbacks', async () => {
    console.log('[INTEGRATION] 🔍 Testing real CourseSeedInput with callback recreation...')
    
    let autoSaveCount = 0
    let effectRunCount = 0
    
    // Track auto-save calls
    const originalConsoleLog = console.log
    console.log = vi.fn((message: string, ...args) => {
      if (typeof message === 'string') {
        if (message.includes('[CourseSeedInput] Auto-save completed successfully')) {
          autoSaveCount++
        }
        if (message.includes('[CourseSeedInput v2.0.4] Component mounted') || 
            message.includes('[CourseSeedInput v2.0.4] Component updated')) {
          effectRunCount++
        }
      }
      originalConsoleLog(message, ...args)
    })

    // Parent component that recreates callbacks on state changes (realistic scenario)
    const ParentWithDynamicCallbacks = () => {
      const [parentState, setParentState] = useState(0)
      
      // These would normally cause mounting instability before the fix
      const handleSave = useCallback((data: CourseSeedData) => {
        console.log('[PARENT] Save callback triggered')
      }, [parentState]) // Depends on state - would change on each state update
      
      const handleMarkDirty = useCallback((section: string) => {
        console.log('[PARENT] Mark dirty callback triggered')
      }, [parentState]) // Depends on state - would change on each state update
      
      return (
        <TestProviders>
          <div>
            <button 
              onClick={() => setParentState(prev => prev + 1)}
              data-testid="trigger-parent-update"
            >
              Update Parent State ({parentState})
            </button>
            <CourseSeedInput
              courseTitle="Integration Test Course"
              difficulty="intermediate"
              customTopics="Topic 1\nTopic 2"
              template="general"
              isSubmitting={false}
              onCourseUpdate={vi.fn()}
              onStepClick={vi.fn()}
              currentStep={1}
              onSave={handleSave}
              markDirty={handleMarkDirty}
            />
          </div>
        </TestProviders>
      )
    }

    const { getByTestId } = render(<ParentWithDynamicCallbacks />)
    
    // Wait for initial mount
    await waitFor(() => {
      expect(getByTestId('trigger-parent-update')).toBeInTheDocument()
    }, { timeout: 5000 })
    
    // Clear counters after initial mount
    autoSaveCount = 0
    effectRunCount = 0
    
    // Simulate parent state updates that recreate callbacks
    // This would previously cause mounting instability
    const updateButton = getByTestId('trigger-parent-update')
    
    // Trigger multiple parent updates
    for (let i = 0; i < 3; i++) {
      updateButton.click()
      await new Promise(resolve => setTimeout(resolve, 50)) // Allow time for effects
    }
    
    // Wait a bit more to ensure all effects have settled
    await new Promise(resolve => setTimeout(resolve, 200))
    
    // Restore console.log
    console.log = originalConsoleLog
    
    console.log(`[INTEGRATION] Auto-save count: ${autoSaveCount}`)
    console.log(`[INTEGRATION] Effect run count: ${effectRunCount}`)
    
    // ✅ CRITICAL ASSERTIONS: The fix should prevent excessive auto-saves and mounting
    // With the fix, parent callback recreation should NOT trigger auto-saves
    expect(autoSaveCount).toBeLessThanOrEqual(1) // Should be minimal or zero
    expect(effectRunCount).toBeLessThanOrEqual(2) // Should be minimal
    
    console.log('[INTEGRATION] ✅ CourseSeedInput mounting stability verified in real scenario')
  })

  test('should still trigger auto-save when actual form values change', async () => {
    console.log('[INTEGRATION] 🔍 Testing auto-save still works for real value changes...')
    
    let saveCallCount = 0
    
    const ParentWithStableCallbacks = () => {
      const [title, setTitle] = useState('Initial Title')
      
      // Stable callbacks (best practice)
      const handleSave = useCallback((data: CourseSeedData) => {
        saveCallCount++
        console.log('[PARENT] Save triggered by value change:', data.courseTitle)
      }, [])
      
      const handleMarkDirty = useCallback((section: string) => {
        console.log('[PARENT] Mark dirty triggered')
      }, [])
      
      return (
        <TestProviders>
          <div>
            <button 
              onClick={() => setTitle('Changed Title')}
              data-testid="change-title"
            >
              Change Title
            </button>
            <CourseSeedInput
              courseTitle={title}
              difficulty="intermediate"
              customTopics="Topic 1\nTopic 2"
              template="general"
              isSubmitting={false}
              onCourseUpdate={vi.fn()}
              onStepClick={vi.fn()}
              currentStep={1}
              onSave={handleSave}
              markDirty={handleMarkDirty}
            />
          </div>
        </TestProviders>
      )
    }

    const { getByTestId } = render(<ParentWithStableCallbacks />)
    
    await waitFor(() => {
      expect(getByTestId('change-title')).toBeInTheDocument()
    })
    
    // Clear save count after initial mount
    saveCallCount = 0
    
    // Trigger a real value change
    getByTestId('change-title').click()
    
    // Wait for auto-save debounce (5 seconds in the component)
    await new Promise(resolve => setTimeout(resolve, 5100))
    
    // ✅ Should still trigger auto-save for real value changes
    expect(saveCallCount).toBe(1)
    
    console.log('[INTEGRATION] ✅ Auto-save correctly triggered by value change')
  })
})