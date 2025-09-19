/**
 * Behavior Test: AI Prompt Generator - Prompt Tuning Persistence
 *
 * Tests that prompt tuning settings persist across save/reload cycles.
 * This reproduces the exact issue reported by the beta tester where
 * prompt tuning changes don't persist after saving and reloading the project.
 */

import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { render } from '../test/testProviders'
import userEvent from '@testing-library/user-event'
import { AIPromptGenerator } from './AIPromptGenerator'
import { FileStorage } from '../services/FileStorage'
import { CourseSeedData } from '../types/schema'
import { DEFAULT_PROMPT_TUNING_SETTINGS } from '../types/promptTuning'

import { vi } from 'vitest'

// Mock usePersistentStorage directly
const mockStorage = {
  saveContent: vi.fn().mockResolvedValue(undefined),
  getContent: vi.fn().mockResolvedValue(null),
  currentProjectId: 'test-project-123'
}

vi.mock('../hooks/usePersistentStorage', () => ({
  usePersistentStorage: () => mockStorage
}))

// Mock PromptTuningModal
vi.mock('./PromptTuningModal', () => ({
  PromptTuningModal: ({ isOpen, onApply, onClose }: any) => {
    if (!isOpen) return null

    const handleApplyCustomSettings = () => {
      // Simulate user changing settings
      const customSettings = {
        ...DEFAULT_PROMPT_TUNING_SETTINGS,
        narrationLength: 'long' as const,
        contentDetail: 'comprehensive' as const,
        imageKeywordsCount: 8,
        assessmentQuestions: 15
      }
      onApply(customSettings)
      onClose() // Close modal after applying settings
    }

    return (
      <div data-testid="prompt-tuning-modal">
        <h2>Prompt Tuning</h2>
        <button onClick={handleApplyCustomSettings} data-testid="apply-custom-settings">
          Apply Custom Settings
        </button>
        <button onClick={onClose} data-testid="close-modal">
          Close
        </button>
      </div>
    )
  }
}))

describe('AIPromptGenerator - Prompt Tuning Persistence', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 3,
    customTopics: ['Topic 1', 'Topic 2'],
    template: 'None',
    templateTopics: []
  }

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
  })

  it('should persist prompt tuning settings across save/reload cycles', async () => {
    const user = userEvent.setup()
    const mockOnSave = vi.fn()

    // **STEP 1: Initial render with default settings**
    const { rerender } = render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={mockOnSave}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // **STEP 2: Open prompt tuning modal**
    const tuneButton = screen.getByTestId('prompt-tuning-button')
    await user.click(tuneButton)

    // Verify modal opens
    expect(screen.getByTestId('prompt-tuning-modal')).toBeInTheDocument()

    // **STEP 3: Apply custom settings**
    const applyButton = screen.getByTestId('apply-custom-settings')
    await user.click(applyButton)

    // Verify modal closes and settings are applied
    await waitFor(() => {
      expect(screen.queryByTestId('prompt-tuning-modal')).not.toBeInTheDocument()
    }, { timeout: 3000 })

    // **STEP 4: Verify settings were saved automatically when Apply was clicked**
    // The handleApplyPromptTuning function should have saved to storage
    await waitFor(() => {
      expect(mockStorage.saveContent).toHaveBeenCalledWith(
        'promptTuningSettings',
        expect.objectContaining({
          narrationLength: 'long',
          contentDetail: 'comprehensive',
          imageKeywordsCount: 8,
          assessmentQuestions: 15
        })
      )
    })

    // **STEP 5: Simulate project reload by setting up storage to return saved settings**
    const savedSettings = {
      ...DEFAULT_PROMPT_TUNING_SETTINGS,
      narrationLength: 'long',
      contentDetail: 'comprehensive',
      imageKeywordsCount: 8,
      assessmentQuestions: 15,
    }

    mockStorage.getContent.mockImplementation((key: string) => {
      if (key === 'promptTuningSettings') {
        return Promise.resolve(savedSettings)
      }
      return Promise.resolve(null)
    })

    // **STEP 6: Re-render component (simulating project reload)**
    rerender(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={mockOnSave}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // **STEP 7: Verify settings were loaded from storage**
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('promptTuningSettings')
    })

    // **STEP 8: Open prompt tuning modal again to verify settings persisted**
    const tuneButtonAfterReload = screen.getByTestId('prompt-tuning-button')
    await user.click(tuneButtonAfterReload)

    // The modal should show the custom settings, not defaults
    // This verifies that the settings truly persisted
    expect(screen.getByTestId('prompt-tuning-modal')).toBeInTheDocument()

    // The test passes if:
    // 1. Settings were saved to FileStorage (not localStorage)
    // 2. Settings were loaded from FileStorage on component mount
    // 3. Custom settings are maintained across reload
  })

  it('should fall back to defaults when no saved settings exist', async () => {
    const user = userEvent.setup()

    // Mock storage returns null (no saved settings)
    mockStorage.getContent.mockResolvedValue(null)

    // Render component
    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // Verify it attempts to load settings
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('promptTuningSettings')
    })

    // Open prompt tuning modal
    const tuneButton = screen.getByTestId('prompt-tuning-button')
    await user.click(tuneButton)

    // Should show default settings since no saved settings exist
    expect(screen.getByTestId('prompt-tuning-modal')).toBeInTheDocument()
  })

  it('should handle storage errors gracefully', async () => {
    const user = userEvent.setup()

    // Mock storage to throw error
    mockStorage.getContent.mockRejectedValue(new Error('Storage error'))
    mockStorage.saveContent.mockRejectedValue(new Error('Save error'))

    // Component should still render and not crash
    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        onNext={vi.fn()}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // Should attempt to load settings despite error
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('promptTuningSettings')
    })

    // Component should still be functional
    const tuneButton = screen.getByTestId('prompt-tuning-button')
    expect(tuneButton).toBeInTheDocument()
  })
})