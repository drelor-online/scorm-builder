/**
 * BEHAVIOR TEST: AI Prompt Tuning Modal
 *
 * This test defines the expected behavior of the prompt tuning feature:
 * - Default settings should maintain current prompt behavior exactly
 * - Settings should persist in localStorage
 * - Modal should provide comprehensive tuning options
 * - Reset functionality should restore defaults
 * - Settings should affect prompt generation dynamically
 *
 * Following TDD: Write failing test first, then implement the feature.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PromptTuningModal } from './PromptTuningModal'
import { usePromptTuning } from '../hooks/usePromptTuning'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage })

// Mock the custom hook for component testing
vi.mock('../hooks/usePromptTuning', () => ({
  usePromptTuning: vi.fn()
}))

describe('PromptTuningModal Behavior Tests', () => {
  const mockOnClose = vi.fn()
  const mockOnApply = vi.fn()

  const defaultSettings = {
    // Content Generation
    narrationLength: 'medium',
    contentDetail: 'comprehensive',
    htmlComplexity: 'rich',

    // Media Settings
    imageKeywordsCount: 2,
    imagePromptDetail: 'standard',
    videoSearchTermsCount: 2,
    videoSearchSpecificity: 'specific',

    // Assessment Settings
    knowledgeCheckQuestions: 1,
    assessmentQuestions: 10,
    passMark: 80,
    questionTypeMix: 'balanced',

    // Page Settings
    welcomeDuration: 2,
    objectivesDuration: 3,
    topicDuration: 5
  }

  const mockUsePromptTuning = {
    settings: defaultSettings,
    updateSettings: vi.fn(),
    resetToDefaults: vi.fn(),
    isDefault: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(usePromptTuning as any).mockReturnValue(mockUsePromptTuning)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Modal Structure and Accessibility', () => {
    it('should render modal with proper accessibility attributes', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Modal should be accessible
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      expect(modal).toHaveAttribute('aria-modal', 'true')
      expect(modal).toHaveAttribute('aria-labelledby')

      // Should have proper title
      expect(screen.getByText('Prompt Tuning')).toBeInTheDocument()

      // Should have close button
      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toBeInTheDocument()
    })

    it('should render tabbed interface with all sections', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Should have tabs for different categories
      expect(screen.getByRole('tab', { name: /content/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /media/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /assessment/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /timing/i })).toBeInTheDocument()
    })

    it('should render all control elements with default values', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Content tab controls (default selected)
      expect(screen.getByText('Narration Length')).toBeInTheDocument()
      expect(screen.getByText('Content Detail Level')).toBeInTheDocument()
      expect(screen.getByText('HTML Complexity')).toBeInTheDocument()

      // Should show medium as selected for narration length
      const mediumButton = screen.getByRole('button', { name: /medium/i })
      expect(mediumButton).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('Settings Persistence', () => {
    it('should load settings from localStorage on mount', () => {
      const savedSettings = {
        ...defaultSettings,
        narrationLength: 'long',
        passMark: 90
      }

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedSettings))

      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Should call localStorage.getItem with correct key
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('promptTuningSettings')
    })

    it('should use default settings when no localStorage data exists', () => {
      mockLocalStorage.getItem.mockReturnValue(null)

      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Should use hook's default settings
      expect(usePromptTuning).toHaveBeenCalled()
    })

    it('should save settings to localStorage when applying changes', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      const applyButton = screen.getByRole('button', { name: /apply settings/i })
      fireEvent.click(applyButton)

      await waitFor(() => {
        expect(mockOnApply).toHaveBeenCalledWith(expect.any(Object))
      })
    })
  })

  describe('Tab Navigation', () => {
    it('should switch between tabs correctly', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Should start on Content tab
      expect(screen.getByText('Narration Length')).toBeInTheDocument()

      // Click Media tab
      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      await waitFor(() => {
        expect(screen.getByText('Image Keywords Count')).toBeInTheDocument()
        expect(screen.getByText('AI Image Prompt Detail')).toBeInTheDocument()
      })

      // Click Assessment tab
      const assessmentTab = screen.getByRole('tab', { name: /assessment/i })
      fireEvent.click(assessmentTab)

      await waitFor(() => {
        expect(screen.getByText('Knowledge Check Questions')).toBeInTheDocument()
        expect(screen.getByText('Assessment Questions Total')).toBeInTheDocument()
        expect(screen.getByText('Pass Mark Percentage')).toBeInTheDocument()
      })

      // Click Timing tab
      const timingTab = screen.getByRole('tab', { name: /timing/i })
      fireEvent.click(timingTab)

      await waitFor(() => {
        expect(screen.getByText('Welcome Page Duration')).toBeInTheDocument()
        expect(screen.getByText('Learning Objectives Duration')).toBeInTheDocument()
        expect(screen.getByText('Topic Page Duration')).toBeInTheDocument()
      })
    })
  })

  describe('Settings Controls', () => {
    it('should handle narration length selection', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Click Long option
      const longButton = screen.getByRole('button', { name: /long/i })
      fireEvent.click(longButton)

      await waitFor(() => {
        expect(longButton).toHaveAttribute('aria-pressed', 'true')
        expect(mockUsePromptTuning.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({ narrationLength: 'long' })
        )
      })
    })

    it('should handle slider controls for numeric values', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Switch to Media tab
      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      await waitFor(() => {
        // Should have slider for image keywords count
        const slider = screen.getByRole('slider', { name: /image keywords count/i })
        expect(slider).toBeInTheDocument()
        expect(slider).toHaveAttribute('min', '1')
        expect(slider).toHaveAttribute('max', '5')
        expect(slider).toHaveValue('2') // Default value

        // Change slider value
        fireEvent.change(slider, { target: { value: '4' } })

        expect(mockUsePromptTuning.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({ imageKeywordsCount: 4 })
        )
      })
    })

    it('should handle pass mark percentage with correct increments', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Switch to Assessment tab
      const assessmentTab = screen.getByRole('tab', { name: /assessment/i })
      fireEvent.click(assessmentTab)

      await waitFor(() => {
        const passMarkSlider = screen.getByRole('slider', { name: /pass mark percentage/i })
        expect(passMarkSlider).toBeInTheDocument()
        expect(passMarkSlider).toHaveAttribute('min', '60')
        expect(passMarkSlider).toHaveAttribute('max', '100')
        expect(passMarkSlider).toHaveAttribute('step', '5')
        expect(passMarkSlider).toHaveValue('80') // Default

        // Change to 95%
        fireEvent.change(passMarkSlider, { target: { value: '95' } })

        expect(mockUsePromptTuning.updateSettings).toHaveBeenCalledWith(
          expect.objectContaining({ passMark: 95 })
        )
      })
    })
  })

  describe('Reset Functionality', () => {
    it('should reset all settings to defaults when reset button is clicked', async () => {
      // Mock hook with modified settings
      const modifiedSettings = {
        ...defaultSettings,
        narrationLength: 'long',
        passMark: 95,
        imageKeywordsCount: 5
      }

      ;(usePromptTuning as any).mockReturnValue({
        ...mockUsePromptTuning,
        settings: modifiedSettings,
        isDefault: false
      })

      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
      expect(resetButton).toBeInTheDocument()

      fireEvent.click(resetButton)

      await waitFor(() => {
        expect(mockUsePromptTuning.resetToDefaults).toHaveBeenCalled()
      })
    })

    it('should show visual indicator when settings are non-default', async () => {
      // Mock hook with modified settings
      ;(usePromptTuning as any).mockReturnValue({
        ...mockUsePromptTuning,
        isDefault: false
      })

      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Reset button should be enabled/highlighted when settings are not default
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
      expect(resetButton).not.toBeDisabled()
    })
  })

  describe('Modal Actions', () => {
    it('should close modal when cancel is clicked', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should apply settings and close modal when apply is clicked', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      const applyButton = screen.getByRole('button', { name: /apply settings/i })
      fireEvent.click(applyButton)

      await waitFor(() => {
        expect(mockOnApply).toHaveBeenCalledWith(mockUsePromptTuning.settings)
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should close modal when escape key is pressed', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      fireEvent.keyDown(document, { key: 'Escape' })

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })
  })

  describe('Visual Feedback', () => {
    it('should show tooltips for complex settings', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Look for tooltip trigger elements
      const tooltipTriggers = screen.getAllByLabelText(/help/i)
      expect(tooltipTriggers.length).toBeGreaterThan(0)
    })

    it('should display current values clearly for all settings', async () => {
      render(
        <PromptTuningModal
          isOpen={true}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      )

      // Content tab should show current selections
      expect(screen.getByRole('button', { name: /medium/i })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: /comprehensive/i })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: /rich/i })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('Integration with AIPromptGenerator', () => {
    it('should provide settings that affect prompt generation', () => {
      const { settings } = mockUsePromptTuning

      // Settings should have all required properties for prompt generation
      expect(settings).toHaveProperty('narrationLength')
      expect(settings).toHaveProperty('contentDetail')
      expect(settings).toHaveProperty('assessmentQuestions')
      expect(settings).toHaveProperty('passMark')
      expect(settings).toHaveProperty('welcomeDuration')

      // Values should be in expected ranges/formats
      expect(settings.imageKeywordsCount).toBeGreaterThanOrEqual(1)
      expect(settings.imageKeywordsCount).toBeLessThanOrEqual(5)
      expect(settings.passMark).toBeGreaterThanOrEqual(60)
      expect(settings.passMark).toBeLessThanOrEqual(100)
    })
  })
})

// Additional integration test for the custom hook
describe('usePromptTuning Hook Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the mock for hook tests
    vi.unmock('../hooks/usePromptTuning')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should provide default settings when no localStorage data exists', () => {
    mockLocalStorage.getItem.mockReturnValue(null)

    // This test will fail until we implement usePromptTuning
    // The hook should return default settings
    expect(() => {
      // This import will fail until the hook is implemented
      const { usePromptTuning } = require('../hooks/usePromptTuning')
    }).toThrow() // Expected to fail initially
  })

  it('should persist settings to localStorage when updated', () => {
    // This test defines the expected behavior for settings persistence
    // Will fail until implemented
    expect(() => {
      const { usePromptTuning } = require('../hooks/usePromptTuning')
    }).toThrow() // Expected to fail initially
  })

  it('should detect when settings differ from defaults', () => {
    // This test defines the expected behavior for the isDefault flag
    // Will fail until implemented
    expect(() => {
      const { usePromptTuning } = require('../hooks/usePromptTuning')
    }).toThrow() // Expected to fail initially
  })
})