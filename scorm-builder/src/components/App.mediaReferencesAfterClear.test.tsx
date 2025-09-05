/**
 * Test for media references persistence issue after clearing JSON
 * 
 * Issue: When clearing JSON via JSONImportValidator, media files are deleted
 * but the course content JSON structure still contains references to those
 * deleted media files. This causes MediaEnhancementWizard to show errors
 * when trying to load non-existent media files.
 * 
 * Expected behavior: When clearing JSON, BOTH the media files AND their
 * references in the course content should be removed completely.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../test/testProviders'
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

// Mock ApiKeyStorage to prevent API key loading errors
vi.mock('../services/ApiKeyStorage', () => ({
  ApiKeyStorage: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue({
      googleImageApiKey: 'mock-api-key',
      googleImageCxKey: 'mock-cx-key'
    }),
    save: vi.fn().mockResolvedValue(undefined),
    keys: {
      googleImageApiKey: 'mock-api-key',
      googleImageCxKey: 'mock-cx-key'
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

describe('App Media References After Clear', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockStorage.store.clear()
    
    // Default Tauri responses - set up existing project
    mockStorage.setItem('currentProjectId', 'test-project-123')
    
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      switch (cmd) {
        case 'load_project':
          return Promise.resolve({
            id: 'test-project-123',
            name: 'Test Project',
            courseData: {
              courseTitle: 'Test Course',
              topics: ['Basic topic']
            },
            currentStep: 2 // Start at JSON Import step to skip course setup
          })
        case 'save_project_data':
          return Promise.resolve({ success: true })
        case 'check_unsaved_changes':
          return Promise.resolve(false)
        case 'get_all_project_media':
          // Initially return empty media list
          return Promise.resolve([])
        case 'delete_media':
          // Mock successful deletion
          return Promise.resolve(true)
        case 'get_media':
          // This should fail after media is deleted
          return Promise.reject(new Error('Failed to read metadata: The system cannot find the file specified. (os error 2)'))
        default:
          return Promise.resolve(null)
      }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should remove media references from course content when clearing JSON', async () => {
    render(<App />)

    // Step 1: App should load directly at JSON Import step
    await waitFor(() => {
      expect(screen.getByText(/JSON Import/i)).toBeInTheDocument()
    })

    // Step 2: Import course content JSON that includes media references
    const courseContentWithMedia = {
      "welcomePage": {
        "title": "Welcome",
        "content": "Welcome to the course",
        "media": [
          {
            "id": "image-0",
            "url": "blob:http://localhost:1420/fake-blob-url-0",
            "type": "image",
            "alt": "Test image 0"
          }
        ]
      },
      "topics": [
        {
          "id": 1,
          "title": "Topic 1",
          "content": "Content with media",
          "media": [
            {
              "id": "image-1", 
              "url": "blob:http://localhost:1420/fake-blob-url-1",
              "type": "image",
              "alt": "Test image 1"
            }
          ]
        }
      ],
      "assessment": {
        "questions": []
      }
    }

    // Mock media files exist initially
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      switch (cmd) {
        case 'get_all_project_media':
          return Promise.resolve([
            { id: 'image-0', filename: 'image-0.jpg', type: 'image' },
            { id: 'image-1', filename: 'image-1.jpg', type: 'image' }
          ])
        case 'get_media':
          // Mock that media exists and can be retrieved
          return Promise.resolve({
            id: args.mediaId,
            data: new Uint8Array([1, 2, 3]),
            metadata: { filename: `${args.mediaId}.jpg`, type: 'image' }
          })
        case 'delete_media':
          return Promise.resolve(true)
        case 'save_project_data':
          return Promise.resolve({ success: true })
        default:
          return Promise.resolve(null)
      }
    })

    const jsonTextarea = screen.getByRole('textbox', { name: /course content json/i })
    await user.clear(jsonTextarea)
    await user.type(jsonTextarea, JSON.stringify(courseContentWithMedia, null, 2))

    // Import the JSON
    const importButton = screen.getByRole('button', { name: /import course content/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(screen.getByText(/successfully imported/i)).toBeInTheDocument()
    })

    // Verify course content was imported with media references
    expect(mockInvoke).toHaveBeenCalledWith('save_project_data', 
      expect.objectContaining({
        courseContent: expect.objectContaining({
          welcomePage: expect.objectContaining({
            media: expect.arrayContaining([
              expect.objectContaining({ id: 'image-0' })
            ])
          }),
          topics: expect.arrayContaining([
            expect.objectContaining({
              media: expect.arrayContaining([
                expect.objectContaining({ id: 'image-1' })
              ])
            })
          ])
        })
      })
    )

    // Step 4: Clear the JSON - this should remove BOTH media files AND references
    const clearButton = screen.getByRole('button', { name: /clear/i })
    
    // Mock the media deletion scenario
    let mediaDeleted = false
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      switch (cmd) {
        case 'get_all_project_media':
          return mediaDeleted 
            ? Promise.resolve([]) // After deletion
            : Promise.resolve([   // Before deletion
                { id: 'image-0', filename: 'image-0.jpg', type: 'image' },
                { id: 'image-1', filename: 'image-1.jpg', type: 'image' }
              ])
        case 'delete_media':
          mediaDeleted = true
          return Promise.resolve(true)
        case 'get_media':
          // After deletion, media should not be found
          return mediaDeleted 
            ? Promise.reject(new Error('Failed to read metadata: The system cannot find the file specified. (os error 2)'))
            : Promise.resolve({
                id: args.mediaId,
                data: new Uint8Array([1, 2, 3]),
                metadata: { filename: `${args.mediaId}.jpg`, type: 'image' }
              })
        case 'save_project_data':
          return Promise.resolve({ success: true })
        default:
          return Promise.resolve(null)
      }
    })
    
    await user.click(clearButton)

    // Wait for clear confirmation
    await waitFor(() => {
      expect(screen.getByText(/course content cleared/i)).toBeInTheDocument()
    })

    // Step 5: Verify that media references were removed from course content
    // The course content should be null/empty after clearing
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_project_data', 
        expect.objectContaining({
          courseContent: null  // Course content should be completely cleared
        })
      )
    })

    // Step 6: Navigate to media enhancement page to verify no orphaned references
    // Since course content was cleared, we shouldn't be able to navigate to media step
    // OR if we can navigate, there should be no media references trying to load

    // Try to navigate forward - should not be able to go to media enhancement
    // since course content is cleared
    const nextButtons = screen.queryAllByRole('button', { name: /next/i })
    if (nextButtons.length > 0) {
      await user.click(nextButtons[0])
      
      // Should either:
      // 1. Stay on JSON step because course content is cleared, OR
      // 2. Go to next step but show no media references
      
      // Wait for any navigation
      await waitFor(() => {}, { timeout: 1000 })

      // If we're on media enhancement page, there should be no attempts to load deleted media
      const mediaEnhancementElements = screen.queryAllByText(/media enhancement/i)
      if (mediaEnhancementElements.length > 0) {
        // If we're on media enhancement page, verify no error attempts to load media
        // The get_media calls should not be made for non-existent media IDs
        
        // Wait a bit to see if any media loading attempts are made
        await waitFor(() => {}, { timeout: 2000 })
        
        // Check that get_media was not called with the deleted media IDs
        const getMediaCalls = mockInvoke.mock.calls.filter(call => call[0] === 'get_media')
        const deletedMediaIds = ['image-0', 'image-1']
        
        for (const mediaId of deletedMediaIds) {
          const callsForThisMedia = getMediaCalls.filter(call => 
            call[1] && call[1].mediaId === mediaId
          )
          expect(callsForThisMedia).toHaveLength(0)
        }
      }
    }

    // Verify that delete_media was called for all media files
    expect(mockInvoke).toHaveBeenCalledWith('delete_media', 
      expect.objectContaining({ mediaId: 'image-0' })
    )
    expect(mockInvoke).toHaveBeenCalledWith('delete_media', 
      expect.objectContaining({ mediaId: 'image-1' })
    )
  })

  it('should handle media deletion errors gracefully while still clearing references', async () => {
    render(<App />)

    // App should load directly at JSON Import step
    await waitFor(() => {
      expect(screen.getByText(/JSON Import/i)).toBeInTheDocument()
    })

    // Import content with media references
    const courseContent = {
      "topics": [
        {
          "id": 1,
          "title": "Topic 1", 
          "content": "Content",
          "media": [
            {
              "id": "image-error",
              "url": "blob:http://localhost:1420/fake-blob-url",
              "type": "image"
            }
          ]
        }
      ],
      "assessment": { "questions": [] }
    }

    const jsonTextarea = screen.getByRole('textbox', { name: /course content json/i })
    await user.clear(jsonTextarea)
    await user.type(jsonTextarea, JSON.stringify(courseContent, null, 2))

    const importButton = screen.getByRole('button', { name: /import course content/i })
    await user.click(importButton)

    await waitFor(() => {
      expect(screen.getByText(/successfully imported/i)).toBeInTheDocument()
    })

    // Mock media deletion failure
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      switch (cmd) {
        case 'get_all_project_media':
          return Promise.resolve([
            { id: 'image-error', filename: 'image-error.jpg', type: 'image' }
          ])
        case 'delete_media':
          // Mock deletion failure
          return Promise.reject(new Error('Failed to delete media file'))
        case 'save_project_data':
          return Promise.resolve({ success: true })
        default:
          return Promise.resolve(null)
      }
    })

    // Clear the JSON - should clear references even if file deletion fails
    const clearButton = screen.getByRole('button', { name: /clear/i })
    await user.click(clearButton)

    await waitFor(() => {
      expect(screen.getByText(/course content cleared/i)).toBeInTheDocument()
    })

    // Even though media deletion failed, course content should still be cleared
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('save_project_data', 
        expect.objectContaining({
          courseContent: null
        })
      )
    })

    // Deletion should have been attempted
    expect(mockInvoke).toHaveBeenCalledWith('delete_media', 
      expect.objectContaining({ mediaId: 'image-error' })
    )
  })
})