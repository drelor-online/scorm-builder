/**
 * App User Journeys - Comprehensive Test Suite
 * 
 * This test consolidates App behavior tests into user-focused scenarios:
 * - Complete course creation workflow
 * - Project recovery scenarios  
 * - Data persistence across sessions
 * - Error handling and edge cases
 * 
 * Replaces individual behavior tests:
 * - App.currentStepSave.behavior.test.tsx
 * - App.infiniteLoop.behavior.test.tsx
 * - App.missingFields.behavior.test.tsx
 * - App.titlePersistence.test.tsx
 * - App.windowClose.test.tsx
 * - App.recovery.test.tsx
 * - App.recoveryDialog.test.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

// Mock Tauri APIs
const mockInvoke = vi.fn()
const mockOpen = vi.fn()
const mockSave = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args)
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (options?: any) => mockOpen(options),
  save: (options?: any) => mockSave(options)
}))

// Mock localStorage
const mockStorage = {
  store: new Map<string, string>(),
  getItem: vi.fn((key: string) => mockStorage.store.get(key) || null),
  setItem: vi.fn((key: string, value: string) => mockStorage.store.set(key, value)),
  removeItem: vi.fn((key: string) => mockStorage.store.delete(key)),
  clear: vi.fn(() => mockStorage.store.clear())
}

Object.defineProperty(window, 'localStorage', {
  value: mockStorage
})

// Mock window.beforeunload
const mockBeforeUnload = vi.fn()
Object.defineProperty(window, 'addEventListener', {
  value: vi.fn((event: string, handler: Function) => {
    if (event === 'beforeunload') {
      mockBeforeUnload.mockImplementation(handler)
    }
  })
})

describe('App User Journeys', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.store.clear()
    
    // Default Tauri responses
    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'load_project':
          return Promise.resolve(null)
        case 'save_project_data':
          return Promise.resolve({ success: true })
        case 'check_unsaved_changes':
          return Promise.resolve(false)
        default:
          return Promise.resolve(null)
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Complete Course Creation Journey', () => {
    it('should guide user through entire course creation process', async () => {
      render(<App />)

      // Step 1: Start with dashboard
      expect(screen.getByText(/SCORM Builder/)).toBeInTheDocument()
      
      // Click Create New Project
      const createButton = screen.getByRole('button', { name: /create new project/i })
      await user.click(createButton)

      // Step 2: Enter project details
      await waitFor(() => {
        expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
      })
      
      const projectNameInput = screen.getByLabelText(/project name/i)
      await user.type(projectNameInput, 'Test Course')
      
      const createProjectButton = screen.getByRole('button', { name: /create/i })
      await user.click(createProjectButton)

      // Step 3: Course Seed Input
      await waitFor(() => {
        expect(screen.getByLabelText(/course title/i)).toBeInTheDocument()
      })
      
      const titleInput = screen.getByLabelText(/course title/i)
      await user.type(titleInput, 'Introduction to Testing')
      
      const topicsTextarea = screen.getByLabelText(/topics/i)
      await user.type(topicsTextarea, 'Unit Testing\nIntegration Testing\nE2E Testing')
      
      // Verify current step is saved correctly as number
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('save_project_data', 
          expect.objectContaining({
            currentStep: expect.any('number')
          })
        )
      })

      // Navigate to next step
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      // Verify step progression
      await waitFor(() => {
        expect(screen.getByText(/AI Prompt Generator/i)).toBeInTheDocument()
      })
    })

    it('should prevent infinite loops during step navigation', async () => {
      // Mock infinite loop scenario
      let callCount = 0
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'save_project_data') {
          callCount++
          if (callCount > 10) {
            throw new Error('Infinite loop detected in test')
          }
        }
        return Promise.resolve({ success: true })
      })

      render(<App />)

      // Rapidly navigate between steps
      const createButton = screen.getByRole('button', { name: /create new project/i })
      await user.click(createButton)

      // Wait for form and fill basic data
      await waitFor(() => {
        expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
      })
      
      await user.type(screen.getByLabelText(/project name/i), 'Test')
      await user.click(screen.getByRole('button', { name: /create/i }))

      // Rapid navigation shouldn't cause infinite loops
      for (let i = 0; i < 5; i++) {
        const nextBtn = screen.queryByRole('button', { name: /next/i })
        if (nextBtn && !nextBtn.hasAttribute('disabled')) {
          await user.click(nextBtn)
          await waitFor(() => {}, { timeout: 100 })
        }
      }

      // Should not have excessive save calls
      expect(callCount).toBeLessThan(10)
    })

    it('should handle missing required fields gracefully', async () => {
      render(<App />)

      // Start project creation
      const createButton = screen.getByRole('button', { name: /create new project/i })
      await user.click(createButton)

      // Try to proceed without required fields
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
      })
      
      const createProjectButton = screen.getByRole('button', { name: /create/i })
      await user.click(createProjectButton)

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText(/project name is required/i)).toBeInTheDocument()
      })

      // Fill minimum required field
      const nameInput = screen.getByLabelText(/project name/i)
      await user.type(nameInput, 'Valid Project')
      await user.click(createProjectButton)

      // Should proceed to course setup
      await waitFor(() => {
        expect(screen.getByLabelText(/course title/i)).toBeInTheDocument()
      })

      // Try to proceed without course title
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      // Should show course validation error
      await waitFor(() => {
        expect(screen.getByText(/course title is required/i)).toBeInTheDocument()
      })
    })
  })

  describe('Data Persistence and Recovery', () => {
    it('should persist data across browser sessions', async () => {
      // First session - create and save data
      mockStorage.setItem('currentProjectId', 'test-project-123')
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'load_project') {
          return Promise.resolve({
            id: 'test-project-123',
            name: 'Persisted Project',
            courseData: {
              title: 'Persisted Course Title',
              topics: ['Topic 1', 'Topic 2']
            },
            currentStep: 2
          })
        }
        return Promise.resolve(null)
      })

      render(<App />)

      // Should automatically load persisted project
      await waitFor(() => {
        expect(screen.getByDisplayValue('Persisted Course Title')).toBeInTheDocument()
      })

      // Verify we're on the correct step
      expect(screen.getByText(/AI Prompt Generator/i)).toBeInTheDocument()

      // Modify the title
      const titleInput = screen.getByDisplayValue('Persisted Course Title')
      await user.clear(titleInput)
      await user.type(titleInput, 'Updated Course Title')

      // Navigate back to verify persistence
      const backButton = screen.getByRole('button', { name: /back/i })
      await user.click(backButton)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Updated Course Title')).toBeInTheDocument()
      })
    })

    it('should handle project recovery scenarios', async () => {
      // Mock unsaved changes
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'check_unsaved_changes') {
          return Promise.resolve(true)
        }
        if (cmd === 'load_backup') {
          return Promise.resolve({
            courseData: {
              title: 'Recovered Course',
              topics: ['Recovered Topic']
            }
          })
        }
        return Promise.resolve(null)
      })

      render(<App />)

      // Should show recovery dialog
      await waitFor(() => {
        expect(screen.getByText(/unsaved changes detected/i)).toBeInTheDocument()
      })

      // Choose to recover
      const recoverButton = screen.getByRole('button', { name: /recover/i })
      await user.click(recoverButton)

      // Should load recovered data
      await waitFor(() => {
        expect(screen.getByDisplayValue('Recovered Course')).toBeInTheDocument()
      })
    })

    it('should handle window close with unsaved changes', async () => {
      render(<App />)

      // Create some content
      const createButton = screen.getByRole('button', { name: /create new project/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
      })
      
      await user.type(screen.getByLabelText(/project name/i), 'Test Project')
      await user.click(screen.getByRole('button', { name: /create/i }))

      // Add unsaved content
      await waitFor(() => {
        expect(screen.getByLabelText(/course title/i)).toBeInTheDocument()
      })
      
      await user.type(screen.getByLabelText(/course title/i), 'Unsaved Course')

      // Mock unsaved changes
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'check_unsaved_changes') {
          return Promise.resolve(true)
        }
        return Promise.resolve(null)
      })

      // Trigger beforeunload
      const event = new Event('beforeunload')
      const result = mockBeforeUnload(event)

      // Should prevent default close if there are unsaved changes
      expect(mockInvoke).toHaveBeenCalledWith('check_unsaved_changes')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle save errors gracefully', async () => {
      // Mock save failure
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'save_project_data') {
          return Promise.reject(new Error('Save failed'))
        }
        return Promise.resolve(null)
      })

      render(<App />)

      // Create project
      const createButton = screen.getByRole('button', { name: /create new project/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
      })
      
      await user.type(screen.getByLabelText(/project name/i), 'Test Project')
      await user.click(screen.getByRole('button', { name: /create/i }))

      // Try to add content (which will trigger save)
      await waitFor(() => {
        expect(screen.getByLabelText(/course title/i)).toBeInTheDocument()
      })
      
      await user.type(screen.getByLabelText(/course title/i), 'Test Course')

      // Should show error notification
      await waitFor(() => {
        expect(screen.getByText(/failed to save/i)).toBeInTheDocument()
      })
    })

    it('should handle rapid state changes without corruption', async () => {
      render(<App />)

      // Create project
      const createButton = screen.getByRole('button', { name: /create new project/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
      })
      
      await user.type(screen.getByLabelText(/project name/i), 'Rapid Test')
      await user.click(screen.getByRole('button', { name: /create/i }))

      // Rapid state changes
      await waitFor(() => {
        expect(screen.getByLabelText(/course title/i)).toBeInTheDocument()
      })
      
      const titleInput = screen.getByLabelText(/course title/i)
      
      // Type and clear rapidly
      for (let i = 0; i < 5; i++) {
        await user.type(titleInput, `Title ${i}`)
        await user.clear(titleInput)
      }
      
      await user.type(titleInput, 'Final Title')

      // State should be consistent
      expect(titleInput).toHaveValue('Final Title')
    })

    it('should handle navigation during data loading', async () => {
      // Mock slow loading
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === 'load_project') {
          return new Promise(resolve => {
            setTimeout(() => resolve(null), 1000)
          })
        }
        return Promise.resolve(null)
      })

      render(<App />)

      // Should show loading state
      expect(screen.getByText(/loading/i)).toBeInTheDocument()

      // Try to navigate during loading
      const buttons = screen.queryAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeDisabled()
      })

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('Accessibility and User Experience', () => {
    it('should maintain focus management during navigation', async () => {
      render(<App />)

      // Create project with keyboard
      const createButton = screen.getByRole('button', { name: /create new project/i })
      createButton.focus()
      await user.keyboard('{Enter}')

      // Focus should move to first input
      await waitFor(() => {
        expect(screen.getByLabelText(/project name/i)).toHaveFocus()
      })

      await user.type(screen.getByLabelText(/project name/i), 'Accessible Project')
      await user.keyboard('{Tab}')  // Tab to Create button
      await user.keyboard('{Enter}')

      // Focus should move to course title
      await waitFor(() => {
        expect(screen.getByLabelText(/course title/i)).toHaveFocus()
      })
    })

    it('should provide screen reader announcements for state changes', async () => {
      render(<App />)

      // Create project
      const createButton = screen.getByRole('button', { name: /create new project/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
      })
      
      await user.type(screen.getByLabelText(/project name/i), 'Screen Reader Test')
      await user.click(screen.getByRole('button', { name: /create/i }))

      // Should have ARIA live region for status updates
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument()
      })

      // Fill form and navigate
      await waitFor(() => {
        expect(screen.getByLabelText(/course title/i)).toBeInTheDocument()
      })
      
      await user.type(screen.getByLabelText(/course title/i), 'SR Test Course')
      
      const nextButton = screen.getByRole('button', { name: /next/i })
      await user.click(nextButton)

      // Status should announce step change
      await waitFor(() => {
        const status = screen.getByRole('status')
        expect(status).toHaveTextContent(/step 2/i)
      })
    })
  })
})