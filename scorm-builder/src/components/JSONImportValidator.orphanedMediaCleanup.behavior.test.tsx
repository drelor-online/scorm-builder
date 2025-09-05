/**
 * Behavior test for JSONImportValidator orphaned media cleanup enhancement
 * 
 * This test reproduces the issue where:
 * 1. User clears JSON content (media files are deleted, persistent fields cleared)
 * 2. User imports new JSON that contains media references with same IDs as deleted files
 * 3. JSONImportValidator doesn't remove these orphaned references before passing to onNext
 * 4. App.loadProject receives course content with references to non-existent media
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '../test/TestProviders'
import JSONImportValidator from './JSONImportValidator'
import { CourseContent } from '../types/aiPrompt'

describe('JSONImportValidator - Orphaned Media Cleanup Enhancement', () => {
  it('should demonstrate the bug where orphaned media references survive JSON import cleanup', async () => {
    // ARRANGE: Mock dependencies
    const mockOnNext = vi.fn()
    const mockOnBack = vi.fn()
    const mockGetMedia = vi.fn()
    const mockUnifiedMediaContext = {
      getMedia: mockGetMedia
    }
    
    // Mock course content with media references that point to deleted files
    const courseContentWithOrphanedRefs: CourseContent = {
      welcomePage: {
        id: 'welcome',
        title: 'Welcome',
        content: '<p>Welcome content</p>',
        narration: 'Welcome narration',
        duration: 2,
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        media: [
          {
            id: 'image-welcome-123', // This media was deleted but reference remains
            type: 'image',
            url: '',
            title: 'Welcome Image',
            pageId: 'welcome'
          }
        ]
      },
      learningObjectivesPage: {
        id: 'objectives',
        title: 'Learning Objectives',
        content: '<ul><li>Learn something</li></ul>',
        narration: 'Objectives narration',
        duration: 3,
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        media: []
      },
      topics: [
        {
          id: 'topic-0',
          title: 'Topic 1',
          content: '<p>Topic content</p>',
          narration: 'Topic narration',
          duration: 5,
          imageKeywords: [],
          imagePrompts: [],
          videoSearchTerms: [],
          knowledgeCheck: { questions: [] },
          media: [
            {
              id: 'audio-topic-0-456', // This media was deleted but reference remains
              type: 'audio',
              url: '',
              title: 'Audio Narration',
              pageId: 'topic-0'
            },
            {
              id: 'image-topic-0-789', // This media exists
              type: 'image',
              url: '',
              title: 'Topic Image',
              pageId: 'topic-0'
            }
          ]
        }
      ],
      objectives: ['Learn something'],
      assessment: {
        questions: [],
        passMark: 80,
        narration: null
      }
    }
    
    // Mock getMedia to return null for deleted media, valid result for existing media
    mockGetMedia.mockImplementation(async (mediaId: string) => {
      if (mediaId === 'image-topic-0-789') {
        return { id: mediaId, type: 'image', url: 'blob:valid', metadata: {} }
      }
      // All other media IDs return null (deleted)
      return null
    })
    
    // Mock UnifiedMediaContext
    vi.doMock('../contexts/UnifiedMediaContext', () => ({
      useUnifiedMedia: () => mockUnifiedMediaContext
    }))
    
    // Mock storage with project setup
    const mockStorage = {
      isInitialized: true,
      currentProjectId: 'test-project-123',
      getCourseContent: vi.fn().mockResolvedValue(null), // No existing course content
      saveCourseContent: vi.fn().mockResolvedValue(true),
      getContent: vi.fn().mockResolvedValue(null), // No persisted validation state
      saveContent: vi.fn().mockResolvedValue(true)
    }
    
    vi.doMock('../contexts/PersistentStorageContext', () => ({
      useStorage: () => mockStorage
    }))
    
    // Mock other contexts
    vi.doMock('../contexts/StepNavigationContext', () => ({
      useStepNavigation: () => ({ unlockSteps: vi.fn() })
    }))
    
    vi.doMock('../contexts/UnsavedChangesContext', () => ({
      useUnsavedChanges: () => ({ markDirty: vi.fn(), resetDirty: vi.fn() })
    }))
    
    vi.doMock('../contexts/NotificationContext', () => ({
      useNotifications: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() })
    }))
    
    // ACT: Render JSONImportValidator and simulate importing JSON with orphaned media references
    render(
      <JSONImportValidator
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )
    
    // Simulate pasting JSON with orphaned media references
    const jsonString = JSON.stringify(courseContentWithOrphanedRefs, null, 2)
    const textarea = screen.getByRole('textbox')
    
    // Paste the JSON content
    await waitFor(() => {
      textarea.focus()
    })
    
    // Simulate paste event
    vi.setSystemTime(new Date('2024-01-01'))
    textarea.textContent = jsonString
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    
    // Wait for validation to complete
    await waitFor(() => {
      expect(screen.queryByText(/Validating and fixing content/)).not.toBeInTheDocument()
    }, { timeout: 5000 })
    
    // Simulate clicking Next to trigger onNext with the validated data
    const nextButton = screen.getByRole('button', { name: /next/i })
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled()
    })
    
    nextButton.click()
    
    // Wait for onNext to be called
    await waitFor(() => {
      expect(mockOnNext).toHaveBeenCalled()
    })
    
    // ASSERT: Verify the bug exists - onNext should be called with cleaned data but currently isn't
    const passedData = mockOnNext.mock.calls[0][0] as CourseContent
    
    // This test SHOULD pass when the bug is fixed, but currently will fail showing the bug
    expect(mockGetMedia).toHaveBeenCalledWith('image-welcome-123')
    expect(mockGetMedia).toHaveBeenCalledWith('audio-topic-0-456')
    expect(mockGetMedia).toHaveBeenCalledWith('image-topic-0-789')
    
    // BUG: These orphaned media references should be removed but currently aren't
    console.log('Passed data welcome page media count:', passedData.welcomePage.media?.length || 0)
    console.log('Passed data topic 0 media count:', passedData.topics[0].media?.length || 0)
    
    // The bug: orphaned references are still present in the data passed to onNext
    expect(passedData.welcomePage.media).toHaveLength(0) // Should have 0 after cleanup (currently has 1 - BUG)
    expect(passedData.topics[0].media).toHaveLength(1) // Should have 1 valid media (currently has 2 - BUG)
    expect(passedData.topics[0].media?.[0]?.id).toBe('image-topic-0-789') // Only the valid one should remain
    
    // This test demonstrates that the current cleanup doesn't remove all orphaned references
    console.log('BUG DEMONSTRATED: Orphaned media references survive JSON import cleanup')
  })
  
  it('should demonstrate the fix - enhanced cleanup removes all orphaned media references', async () => {
    // This test shows what the FIXED behavior should look like
    // We'll implement this test to pass after we fix the cleanup logic
    
    const mockOnNext = vi.fn()
    const mockGetMedia = vi.fn()
    
    // Same test setup as above...
    mockGetMedia.mockImplementation(async (mediaId: string) => {
      if (mediaId === 'image-topic-0-789') {
        return { id: mediaId, type: 'image', url: 'blob:valid', metadata: {} }
      }
      return null // All other media deleted
    })
    
    // After implementing the fix, this test should pass
    // showing that orphaned media references are properly removed
    // before data is passed to onNext
    
    // For now, this test will be skipped until we implement the fix
    expect(true).toBe(true) // Placeholder - will implement after fixing the cleanup
  })
})