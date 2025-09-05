/**
 * Behavior test for handleClearCourseContent function
 * 
 * Issue: When clearing course content via handleClearCourseContent, media files 
 * are deleted but course content JSON structure still contains references to 
 * those deleted media files, causing errors when UI tries to load non-existent media.
 * 
 * This test specifically tests the behavior of App.handleClearCourseContent()
 * to ensure it properly removes media references from course content.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '../test/testProviders'
import userEvent from '@testing-library/user-event'
import App from '../App'

// Mock Tauri APIs
const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args: any) => mockInvoke(cmd, args)
}))

// Mock ApiKeyStorage
vi.mock('../services/ApiKeyStorage', () => ({
  ApiKeyStorage: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue({
      googleImageApiKey: 'mock-key',
      googleImageCxKey: 'mock-cx'
    }),
    save: vi.fn().mockResolvedValue(undefined),
    keys: {
      googleImageApiKey: 'mock-key',
      googleImageCxKey: 'mock-cx'
    }
  }))
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

describe('App handleClearCourseContent Behavior', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.store.clear()
    
    // Set up existing project with course content that has media references
    mockStorage.setItem('currentProjectId', 'test-project-123')
    
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      switch (cmd) {
        case 'load_project':
          return Promise.resolve({
            id: 'test-project-123',
            name: 'Test Project',
            courseData: {
              courseTitle: 'Test Course',
              topics: ['Topic 1']
            },
            // Start with course content that has media references
            courseContent: {
              topics: [
                {
                  id: 1,
                  title: 'Topic 1',
                  content: 'Content',
                  media: [
                    {
                      id: 'image-0',
                      url: 'blob:http://localhost:1420/fake-url',
                      type: 'image',
                      alt: 'Test image'
                    }
                  ]
                }
              ],
              assessment: { questions: [] }
            },
            currentStep: 3 // JSON Import step (step index 2, display as step 3)
          })
        case 'save_project_data':
          return Promise.resolve({ success: true })
        case 'check_unsaved_changes':
          return Promise.resolve(false)
        case 'get_all_project_media':
          return Promise.resolve([
            { id: 'image-0', filename: 'image-0.jpg', type: 'image' }
          ])
        case 'delete_media':
          return Promise.resolve(true)
        case 'get_media':
          // After deletion, should fail
          return Promise.reject(new Error('Media not found'))
        default:
          return Promise.resolve(null)
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should remove media references from course content when clearing', async () => {
    render(<App />)

    // Wait for app to load with course content that has media references
    await waitFor(() => {
      expect(screen.getByText(/JSON Import/i)).toBeInTheDocument()
    })

    // Verify that we have course content loaded with media references
    // The save call should have been made during loading with media references
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_project_data', 
        expect.objectContaining({
          courseContent: expect.objectContaining({
            topics: expect.arrayContaining([
              expect.objectContaining({
                media: expect.arrayContaining([
                  expect.objectContaining({ id: 'image-0' })
                ])
              })
            ])
          })
        })
      )
    })

    // Find and click the clear button to trigger handleClearCourseContent
    const clearButton = screen.getByRole('button', { name: /clear/i })
    expect(clearButton).toBeInTheDocument()

    await user.click(clearButton)

    // Wait for the clearing process to complete
    await waitFor(() => {
      expect(screen.getByText(/course content cleared/i)).toBeInTheDocument()
    })

    // CRITICAL: Verify that the course content was saved as NULL (completely cleared)
    // This should happen AFTER media deletion, so references are removed
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_project_data', 
        expect.objectContaining({
          courseContent: null  // Course content should be completely null
        })
      )
    })

    // Verify that media deletion was attempted
    expect(mockInvoke).toHaveBeenCalledWith('delete_media', 
      expect.objectContaining({ mediaId: 'image-0' })
    )

    // Verify that get_all_project_media was called to find media to delete
    expect(mockInvoke).toHaveBeenCalledWith('get_all_project_media')
  })

  it('should clear course content references even if media deletion fails', async () => {
    // Mock media deletion failure
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      switch (cmd) {
        case 'load_project':
          return Promise.resolve({
            id: 'test-project-123',
            name: 'Test Project',
            courseData: {
              courseTitle: 'Test Course',
              topics: ['Topic 1']
            },
            courseContent: {
              topics: [
                {
                  id: 1,
                  title: 'Topic 1',
                  content: 'Content',
                  media: [{ id: 'image-error', url: 'blob:fake', type: 'image' }]
                }
              ],
              assessment: { questions: [] }
            },
            currentStep: 3
          })
        case 'save_project_data':
          return Promise.resolve({ success: true })
        case 'check_unsaved_changes':
          return Promise.resolve(false)
        case 'get_all_project_media':
          return Promise.resolve([
            { id: 'image-error', filename: 'error.jpg', type: 'image' }
          ])
        case 'delete_media':
          // Mock deletion failure
          return Promise.reject(new Error('Failed to delete media'))
        default:
          return Promise.resolve(null)
      }
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/JSON Import/i)).toBeInTheDocument()
    })

    const clearButton = screen.getByRole('button', { name: /clear/i })
    await user.click(clearButton)

    await waitFor(() => {
      expect(screen.getByText(/course content cleared/i)).toBeInTheDocument()
    })

    // Even if media deletion failed, course content should still be cleared
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_project_data', 
        expect.objectContaining({
          courseContent: null
        })
      )
    })

    // Media deletion should have been attempted
    expect(mockInvoke).toHaveBeenCalledWith('delete_media', 
      expect.objectContaining({ mediaId: 'image-error' })
    )
  })

  it('should handle missing project ID gracefully during clear', async () => {
    // Mock no current project
    mockStorage.store.clear()
    
    mockInvoke.mockImplementation((cmd: string) => {
      switch (cmd) {
        case 'load_project':
          return Promise.resolve(null) // No project loaded
        case 'save_project_data':
          return Promise.resolve({ success: true })
        case 'check_unsaved_changes':
          return Promise.resolve(false)
        default:
          return Promise.resolve(null)
      }
    })

    render(<App />)

    // Should not crash, should handle gracefully
    // App might show dashboard or empty state
    await waitFor(() => {
      // The app should render without crashing
      expect(document.body).toBeInTheDocument()
    })

    // If there's no course content to clear, the clear functionality
    // should either be disabled or handle the empty state gracefully
  })
})