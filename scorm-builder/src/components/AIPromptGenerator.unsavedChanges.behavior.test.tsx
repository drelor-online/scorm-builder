/**
 * Behavior Test: AI Prompt Generator - Unsaved Changes Integration
 *
 * Tests that AIPromptGenerator properly integrates with the unsaved changes system
 * when prompt tuning settings are modified.
 */

import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { render } from '../test/testProviders'
import userEvent from '@testing-library/user-event'
import { AIPromptGenerator } from './AIPromptGenerator'
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

// Mock useUnsavedChanges
const mockMarkDirty = vi.fn()
const mockResetDirty = vi.fn()

vi.mock('../contexts/UnsavedChangesContext', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useUnsavedChanges: () => ({
      markDirty: mockMarkDirty,
      resetDirty: mockResetDirty,
      hasUnsavedChanges: false
    })
  }
})

// Mock PromptTuningModal - simplified version that allows us to test the integration
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

describe('AIPromptGenerator - Unsaved Changes Integration', () => {
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

  it('should call markDirty when prompt tuning settings are applied', async () => {
    const user = userEvent.setup()
    const mockOnNext = vi.fn()

    render(
      <AIPromptGenerator
        courseSeedData={mockCourseSeedData}
        onNext={mockOnNext}
        onBack={vi.fn()}
        onSettingsClick={vi.fn()}
        onHelp={vi.fn()}
        onSave={vi.fn()}
        onOpen={vi.fn()}
        onStepClick={vi.fn()}
      />
    )

    // **STEP 1: Open prompt tuning modal**
    const tuneButton = screen.getByTestId('prompt-tuning-button')
    await user.click(tuneButton)

    // Verify modal opens
    expect(screen.getByTestId('prompt-tuning-modal')).toBeInTheDocument()

    // **STEP 2: Apply custom settings**
    const applyButton = screen.getByTestId('apply-custom-settings')
    await user.click(applyButton)

    // **STEP 3: Verify markDirty was called**
    await waitFor(() => {
      expect(mockMarkDirty).toHaveBeenCalledWith('promptTuning')
    })

    // Verify modal closes
    await waitFor(() => {
      expect(screen.queryByTestId('prompt-tuning-modal')).not.toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('should call resetDirty when component unmounts', () => {
    const { unmount } = render(
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

    // Unmount component
    unmount()

    // Should call resetDirty on unmount
    expect(mockResetDirty).toHaveBeenCalledWith('promptTuning')
  })

  it('should not call markDirty during initial load from storage', async () => {
    // Mock storage returns saved settings
    const savedSettings = {
      ...DEFAULT_PROMPT_TUNING_SETTINGS,
      narrationLength: 'long',
      contentDetail: 'comprehensive'
    }

    mockStorage.getContent.mockImplementation((key: string) => {
      if (key === 'promptTuningSettings') {
        return Promise.resolve(savedSettings)
      }
      return Promise.resolve(null)
    })

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

    // Wait for component to load settings
    await waitFor(() => {
      expect(mockStorage.getContent).toHaveBeenCalledWith('promptTuningSettings')
    })

    // Should NOT call markDirty during initial load
    expect(mockMarkDirty).not.toHaveBeenCalled()
  })

  it('should save settings to storage when applied', async () => {
    const user = userEvent.setup()

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

    // Open modal and apply settings
    const tuneButton = screen.getByTestId('prompt-tuning-button')
    await user.click(tuneButton)

    const applyButton = screen.getByTestId('apply-custom-settings')
    await user.click(applyButton)

    // Verify settings were saved to storage
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
  })
})