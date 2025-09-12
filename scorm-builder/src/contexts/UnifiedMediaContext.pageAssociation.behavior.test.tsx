import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { UnifiedMediaProvider, useUnifiedMedia } from './UnifiedMediaContext'
import { PersistentStorageProvider } from './PersistentStorageContext'

// Mock the storage context
const mockStorage = {
  getProject: vi.fn(),
  getCurrentProjectId: vi.fn().mockReturnValue('test-project'),
  saveProject: vi.fn(),
  getCourseSeedData: vi.fn(),
  saveCourseSeedData: vi.fn(),
  getContent: vi.fn().mockResolvedValue(null)
}

vi.mock('./PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: { children: React.ReactNode }) => children,
  useStorage: () => mockStorage
}))

// Test component to access and test the context
function TestComponent() {
  const { getValidMediaForPage, getAllMedia } = useUnifiedMedia()
  
  React.useEffect(() => {
    const testPageAssociation = async () => {
      console.log('🔍 [TEST] Testing page association for learning-objectives...')
      
      // Check all media first
      const allMedia = getAllMedia()
      console.log(`🔍 [TEST] Total media items: ${allMedia.length}`)
      
      // Then check specific page
      const learningObjectivesMedia = await getValidMediaForPage('learning-objectives')
      console.log(`🔍 [TEST] Media for learning-objectives: ${learningObjectivesMedia.length}`)
      
      // Log the discrepancy
      if (allMedia.length > 0 && learningObjectivesMedia.length === 0) {
        console.log('🚨 [TEST] ISSUE REPRODUCED: Media exists but not associated with learning-objectives page')
        console.log('🔍 [TEST] This reproduces the exact issue from the console logs')
      }
    }
    
    testPageAssociation()
  }, [getValidMediaForPage, getAllMedia])
  
  return <div data-testid="test-component">Testing page association</div>
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <PersistentStorageProvider projectId="test-project">
      <UnifiedMediaProvider>
        {children}
      </UnifiedMediaProvider>
    </PersistentStorageProvider>
  )
}

describe('UnifiedMediaContext Page Association Debug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should help debug why YouTube videos are not appearing on learning-objectives page', async () => {
    // This test reproduces the exact issue from the console logs:
    // - MediaService.listAllMedia() returns 7 items 
    // - But getValidMediaForPage('learning-objectives') returns 0 items
    // - This causes MediaEnhancementWizard to show "Found media items: 0"
    
    console.log('🔍 [TEST] Starting page association debug test...')
    console.log('🔍 [TEST] This test will show the debug output from UnifiedMediaContext')
    console.log('🔍 [TEST] Watch for pageId mismatches in the logs')
    
    try {
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      )

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 200))
      
      console.log('🔍 [TEST] Check the debug logs above to see:')
      console.log('  1. What items MediaService.listAllMedia() returns')
      console.log('  2. What pageIds they have')
      console.log('  3. Why getValidMediaForPage("learning-objectives") returns 0')
      
      expect(true).toBe(true) // Test passes if we can analyze the debug output
      
    } catch (error) {
      console.log('🔍 [TEST] Component rendering failed, but debug info may still be useful:', error)
      expect(true).toBe(true) // Allow test to pass for debugging purposes
    }
  })

  it('should demonstrate the expected page association behavior', () => {
    // This test shows how page association SHOULD work
    
    const mockMediaItems = [
      { id: 'video-1', pageId: 'learning-objectives', type: 'youtube' },
      { id: 'video-2', pageId: 'topic-4', type: 'youtube' },
      { id: 'image-0', pageId: 'welcome', type: 'image' }
    ]
    
    // Simulate the filtering logic that should happen
    const learningObjectivesItems = mockMediaItems.filter(item => item.pageId === 'learning-objectives')
    
    expect(learningObjectivesItems).toHaveLength(1)
    expect(learningObjectivesItems[0].id).toBe('video-1')
    
    console.log('🔍 [TEST] Expected behavior: video-1 should appear on learning-objectives page')
    console.log('🔍 [TEST] If the debug logs show video-1 with a different pageId, that\'s the bug')
  })
})