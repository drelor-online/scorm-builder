/**
 * Test for orphaned media references cleanup during JSON import
 * 
 * This test reproduces the issue where:
 * 1. User clears course content (which deletes media files) 
 * 2. User imports JSON that contains references to those deleted media files
 * 3. Components fail trying to load non-existent media files
 * 
 * The fix should clean up orphaned media references during JSON import.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../test/testProviders'
import userEvent from '@testing-library/user-event'
import React from 'react'
import JSONImportValidator from './JSONImportValidator'

// Mock Tauri APIs
const mockInvoke = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: any) => mockInvoke(cmd, args)
}))

// Mock MediaService
const mockMediaService = {
  getMedia: vi.fn(),
  deleteAllMedia: vi.fn()
}

vi.mock('../services/MediaService', () => ({
  MediaService: vi.fn().mockImplementation(() => mockMediaService)
}))

// Mock UnifiedMediaContext
const mockUnifiedMediaContext = {
  getMedia: mockMediaService.getMedia,
  deleteAllMedia: vi.fn()
}

vi.mock('../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => mockUnifiedMediaContext,
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}))

// Sample JSON with media references that will be deleted
const JSON_WITH_MEDIA_REFERENCES = {
  "welcomePage": {
    "title": "Welcome to Complex Projects - 12 - Electrical Power Design",
    "content": "This course covers electrical power design...",
    "media": [
      {
        "id": "image-0",
        "type": "image",
        "url": "blob:http://localhost:1420/fake-url-1", 
        "originalName": "deleted-image.jpg"
      }
    ]
  },
  "learningObjectives": {
    "title": "Learning Objectives",
    "objectives": ["Understand electrical systems"],
    "media": [
      {
        "id": "image-1", 
        "type": "image",
        "url": "blob:http://localhost:1420/fake-url-2",
        "originalName": "another-deleted-image.jpg"
      }
    ]
  },
  "topics": [
    {
      "id": "topic-1",
      "title": "Load List Development",
      "content": "Develop load lists...",
      "media": [
        {
          "id": "image-0",
          "type": "image", 
          "url": "blob:http://localhost:1420/fake-url-1",
          "originalName": "deleted-image.jpg"
        }
      ]
    }
  ],
  "assessment": {
    "questions": []
  }
}

describe('JSONImportValidator Orphaned Media References Fix', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock successful project loading
    mockInvoke.mockImplementation((cmd: string, args?: any) => {
      switch (cmd) {
        case 'load_project':
          return Promise.resolve({
            id: 'test-project-123',
            name: 'Test Project',
            course_content: null // Content was cleared
          })
        case 'check_media_exists':
          // Simulate that media files were deleted
          if (args?.mediaId === 'image-0' || args?.mediaId === 'image-1') {
            return Promise.resolve(false) // Media doesn't exist
          }
          return Promise.resolve(true)
        default:
          return Promise.resolve(null)
      }
    })
    
    // Mock MediaService to simulate deleted files
    mockMediaService.getMedia.mockImplementation(async (mediaId: string) => {
      if (mediaId === 'image-0' || mediaId === 'image-1') {
        throw new Error(`Failed to read metadata: The system cannot find the file specified. (os error 2)`)
      }
      return { id: mediaId, data: new ArrayBuffer(100) }
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should fail with current implementation - orphaned media references cause errors', async () => {
    const mockOnValidJSON = vi.fn()
    
    render(
      <JSONImportValidator 
        onValidJSON={mockOnValidJSON}
        projectId="test-project-123"
      />
    )

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByTestId('json-textarea')).toBeInTheDocument()
    })

    const textarea = screen.getByTestId('json-textarea')
    
    // Import JSON with orphaned media references
    fireEvent.change(textarea, { 
      target: { value: JSON.stringify(JSON_WITH_MEDIA_REFERENCES, null, 2) }
    })

    // Trigger validation
    const validateButton = screen.getByText(/validate/i)
    await user.click(validateButton)

    // Wait for validation to complete
    await waitFor(() => {
      expect(mockOnValidJSON).toHaveBeenCalled()
    })

    // Get the validated JSON that was passed to onValidJSON
    const validatedJSON = mockOnValidJSON.mock.calls[0][0]
    
    // CURRENT BEHAVIOR: Orphaned media references are NOT cleaned up
    // This test should FAIL showing the problem exists
    
    // Check that welcome page still has orphaned media reference
    expect(validatedJSON.welcomePage.media).toBeDefined()
    expect(validatedJSON.welcomePage.media).toHaveLength(1)
    expect(validatedJSON.welcomePage.media[0].id).toBe('image-0')
    
    // Check that learning objectives still has orphaned media reference  
    expect(validatedJSON.learningObjectives.media).toBeDefined()
    expect(validatedJSON.learningObjectives.media).toHaveLength(1)
    expect(validatedJSON.learningObjectives.media[0].id).toBe('image-1')
    
    // Check that topic still has orphaned media reference
    expect(validatedJSON.topics[0].media).toBeDefined()
    expect(validatedJSON.topics[0].media).toHaveLength(1) 
    expect(validatedJSON.topics[0].media[0].id).toBe('image-0')

    // This demonstrates the current behavior - orphaned references persist
    console.log('❌ CURRENT: Orphaned media references are preserved, will cause errors later')
  })

  it('should clean up orphaned media references during validation (desired behavior)', async () => {
    const mockOnValidJSON = vi.fn()
    
    render(
      <JSONImportValidator 
        onValidJSON={mockOnValidJSON}
        projectId="test-project-123"
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('json-textarea')).toBeInTheDocument()
    })

    const textarea = screen.getByTestId('json-textarea')
    
    // Import JSON with orphaned media references
    fireEvent.change(textarea, { 
      target: { value: JSON.stringify(JSON_WITH_MEDIA_REFERENCES, null, 2) }
    })

    // Trigger validation
    const validateButton = screen.getByText(/validate/i)
    await user.click(validateButton)

    await waitFor(() => {
      expect(mockOnValidJSON).toHaveBeenCalled()
    })

    const validatedJSON = mockOnValidJSON.mock.calls[0][0]
    
    // DESIRED BEHAVIOR: Orphaned media references should be cleaned up
    // This test will FAIL until we implement the fix
    
    // Welcome page media references should be cleaned up
    expect(validatedJSON.welcomePage.media).toEqual([])
    
    // Learning objectives media references should be cleaned up
    expect(validatedJSON.learningObjectives.media).toEqual([])
    
    // Topic media references should be cleaned up  
    expect(validatedJSON.topics[0].media).toEqual([])

    console.log('✅ DESIRED: Orphaned media references are automatically cleaned up')
  })

  it('should preserve valid media references and only clean up orphaned ones', async () => {
    const mockOnValidJSON = vi.fn()
    
    // Mock one media file as existing, one as deleted
    mockMediaService.getMedia.mockImplementation(async (mediaId: string) => {
      if (mediaId === 'image-0') {
        throw new Error('Failed to read metadata: The system cannot find the file specified. (os error 2)')
      }
      if (mediaId === 'image-1') {
        return { id: mediaId, data: new ArrayBuffer(100) } // This one exists
      }
      throw new Error('Unknown media')
    })

    const mixedJSON = {
      ...JSON_WITH_MEDIA_REFERENCES,
      welcomePage: {
        ...JSON_WITH_MEDIA_REFERENCES.welcomePage,
        media: [
          JSON_WITH_MEDIA_REFERENCES.welcomePage.media[0], // image-0 (orphaned)
          { id: 'image-1', type: 'image', url: 'blob:valid', originalName: 'valid.jpg' } // valid
        ]
      }
    }
    
    render(
      <JSONImportValidator 
        onValidJSON={mockOnValidJSON}
        projectId="test-project-123"
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('json-textarea')).toBeInTheDocument()
    })

    const textarea = screen.getByTestId('json-textarea')
    
    fireEvent.change(textarea, { 
      target: { value: JSON.stringify(mixedJSON, null, 2) }
    })

    const validateButton = screen.getByText(/validate/i)
    await user.click(validateButton)

    await waitFor(() => {
      expect(mockOnValidJSON).toHaveBeenCalled()
    })

    const validatedJSON = mockOnValidJSON.mock.calls[0][0]
    
    // Should keep valid media (image-1) and remove orphaned media (image-0)
    expect(validatedJSON.welcomePage.media).toHaveLength(1)
    expect(validatedJSON.welcomePage.media[0].id).toBe('image-1')
    
    // Other pages should have all orphaned references cleaned up
    expect(validatedJSON.learningObjectives.media).toEqual([])
    expect(validatedJSON.topics[0].media).toEqual([])

    console.log('✅ DESIRED: Valid media preserved, orphaned media cleaned up')
  })

  it('should show user feedback when orphaned media references are cleaned up', async () => {
    const mockOnValidJSON = vi.fn()
    
    render(
      <JSONImportValidator 
        onValidJSON={mockOnValidJSON}
        projectId="test-project-123"
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('json-textarea')).toBeInTheDocument()
    })

    const textarea = screen.getByTestId('json-textarea')
    
    fireEvent.change(textarea, { 
      target: { value: JSON.stringify(JSON_WITH_MEDIA_REFERENCES, null, 2) }
    })

    const validateButton = screen.getByText(/validate/i)
    await user.click(validateButton)

    await waitFor(() => {
      expect(mockOnValidJSON).toHaveBeenCalled()
    })
    
    // Should show a warning/info message about cleaned up media references
    await waitFor(() => {
      expect(screen.getByText(/cleaned up.*orphaned media references/i)).toBeInTheDocument()
    })

    console.log('✅ DESIRED: User gets feedback about orphaned media cleanup')
  })
})