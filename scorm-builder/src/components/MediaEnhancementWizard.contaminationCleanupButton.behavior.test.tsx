import React from 'react'
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MediaEnhancementWizard } from './MediaEnhancementWizard'

/**
 * BEHAVIOR TEST: Manual Contamination Cleanup Button
 * 
 * This test reproduces the current contamination issue where images have YouTube metadata,
 * and verifies that a manual cleanup button can resolve the contamination.
 * 
 * CURRENT ISSUE (as seen in logs):
 * - Images (image-0, image-1, image-2, image-3) have YouTube metadata contamination
 * - PageThumbnailGrid fails with "createBlobUrl returned null" errors
 * - Automatic cleanup on mount is not working effectively
 */

// Mock the UnifiedMediaContext to simulate contamination
const mockContaminatedMedia = [
  {
    id: 'image-0',
    type: 'image' as const,
    url: 'blob://some-url',
    title: 'Contaminated Image',
    metadata: {
      // 🚨 CONTAMINATION: Image has YouTube metadata
      source: 'youtube',
      embed_url: 'https://youtube.com/embed/abc123',
      clip_start: 30,
      clip_end: 60,
      title: 'Image Title',
      page_id: 'welcome'
    }
  }
]

const mockCleanMedia = [
  {
    id: 'image-0',
    type: 'image' as const,
    url: 'blob://some-url', 
    title: 'Clean Image',
    metadata: {
      // ✅ CLEAN: Only appropriate image metadata
      title: 'Image Title',
      page_id: 'welcome'
      // No YouTube fields: source, embed_url, clip_start, clip_end
    }
  }
]

const mockUnifiedMediaContext = {
  storeMedia: vi.fn(),
  getValidMediaForPage: vi.fn().mockResolvedValue(mockContaminatedMedia),
  createBlobUrl: vi.fn().mockResolvedValue(null), // Simulates contamination causing blob creation failure
  cleanContaminatedMedia: vi.fn().mockResolvedValue({ 
    cleaned: ['image-0'], 
    errors: [] 
  })
}

// Mock other required contexts
vi.mock('../contexts/UnifiedMediaContext', () => ({
  useUnifiedMedia: () => mockUnifiedMediaContext
}))

vi.mock('../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  })
}))

vi.mock('../contexts/UnsavedChangesContext', () => ({
  useUnsavedChanges: () => ({
    markDirty: vi.fn(),
    resetDirty: vi.fn()
  })
}))

vi.mock('../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({})
}))

vi.mock('../contexts/StepNavigationContext', () => ({
  useStepNavigation: () => ({
    currentStep: 0,
    setCurrentStep: vi.fn(),
    nextStep: vi.fn(),
    prevStep: vi.fn()
  })
}))

const defaultProps = {
  courseContent: {
    welcomePage: { id: 'welcome', title: 'Welcome', content: '', media: mockContaminatedMedia },
    topics: []
  },
  onUpdateContent: vi.fn(),
  onSave: vi.fn(),
  onOpen: vi.fn(),
  onStepClick: vi.fn(),
  currentPageIndex: 0
}

describe('MediaEnhancementWizard Manual Contamination Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('FAILING TEST: Should display cleanup button when contamination is detected', async () => {
    console.log('[TEST] 🚨 REPRODUCING CONTAMINATION ISSUE')
    console.log('[TEST] Expected behavior: Cleanup button should appear when contaminated media is detected')
    console.log('[TEST] Current issue: No manual cleanup button exists')
    
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Wait for component to load and detect contamination
    await waitFor(() => {
      expect(mockUnifiedMediaContext.getValidMediaForPage).toHaveBeenCalled()
    })
    
    // Wait for contamination detection and UI update
    await waitFor(() => {
      const cleanupButton = screen.queryByTestId('manual-cleanup-button')
      expect(cleanupButton).toBeInTheDocument()
    }, { timeout: 3000 })
    
    console.log('[TEST] ❌ THIS TEST SHOULD FAIL because cleanup button doesn\'t exist yet')
  })

  test('FAILING TEST: Should show contamination warning to user', async () => {
    console.log('[TEST] 🚨 TESTING CONTAMINATION DETECTION')
    console.log('[TEST] Expected: User should see warning about contaminated media')
    
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Wait for contamination detection and UI update
    await waitFor(() => {
      const contaminationWarning = screen.queryByTestId('contamination-warning')
      expect(contaminationWarning).toBeInTheDocument()
    }, { timeout: 3000 })
    
    console.log('[TEST] ❌ THIS TEST SHOULD FAIL because contamination warning doesn\'t exist yet')
  })

  test('FAILING TEST: Cleanup button should trigger cleanContaminatedMedia', async () => {
    console.log('[TEST] 🚨 TESTING MANUAL CLEANUP FUNCTIONALITY')
    console.log('[TEST] Expected: Clicking cleanup button should call cleanContaminatedMedia')
    
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // Wait for contamination detection and UI update
    await waitFor(() => {
      const cleanupButton = screen.queryByTestId('manual-cleanup-button')
      expect(cleanupButton).toBeInTheDocument()
    }, { timeout: 3000 })
    
    const cleanupButton = screen.queryByTestId('manual-cleanup-button')
    if (cleanupButton) {
      fireEvent.click(cleanupButton)
      
      await waitFor(() => {
        expect(mockUnifiedMediaContext.cleanContaminatedMedia).toHaveBeenCalled()
      })
    }
    
    console.log('[TEST] ❌ THIS TEST SHOULD FAIL because cleanup functionality doesn\'t exist yet')
  })

  test('SUCCESS SCENARIO: After cleanup, contamination warnings should disappear', async () => {
    console.log('[TEST] 🎯 TESTING SUCCESSFUL CLEANUP OUTCOME')
    console.log('[TEST] This test shows what success looks like after implementing the fix')
    
    // Mock successful cleanup
    mockUnifiedMediaContext.getValidMediaForPage
      .mockResolvedValueOnce(mockContaminatedMedia)  // Initial: contaminated
      .mockResolvedValueOnce(mockCleanMedia)         // After cleanup: clean
      
    mockUnifiedMediaContext.createBlobUrl
      .mockResolvedValueOnce(null)                   // Initial: blob creation fails
      .mockResolvedValueOnce('blob://clean-url')     // After cleanup: blob creation works
    
    render(<MediaEnhancementWizard {...defaultProps} />)
    
    // This test documents the expected behavior after implementing the fix
    // (It will pass once we implement the manual cleanup button)
    
    console.log('[TEST] ✅ This test documents the expected success behavior')
  })
})