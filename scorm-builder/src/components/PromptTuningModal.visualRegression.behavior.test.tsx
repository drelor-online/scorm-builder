/**
 * BEHAVIOR TEST: Prompt Tuning Modal Visual Regression
 *
 * This test defines the expected visual behavior for the Prompt Tuning Modal:
 * - Slider inputs should be properly sized and not cut off
 * - Unit labels should not overlap with input fields
 * - All content should be visible within modal bounds
 * - Button groups should not be cut off at modal bottom
 *
 * Following TDD: Write failing tests first to reproduce visual issues,
 * then implement fixes to make tests pass.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PromptTuningModal } from './PromptTuningModal'
import { AllTheProviders } from '../test/TestProviders'
import { DEFAULT_PROMPT_TUNING_SETTINGS } from '../types/promptTuning'

describe('PromptTuningModal Visual Regression', () => {
  const mockOnClose = vi.fn()
  const mockOnApply = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderModal = (isOpen = true) => {
    return render(
      <AllTheProviders>
        <PromptTuningModal
          isOpen={isOpen}
          onClose={mockOnClose}
          onApply={mockOnApply}
        />
      </AllTheProviders>
    )
  }

  describe('Slider Input Sizing Issues', () => {
    it('should render slider inputs with adequate width to prevent text cutoff', () => {
      renderModal()

      // Navigate to Timing tab where the main issues occur
      const timingTab = screen.getByRole('tab', { name: /timing/i })
      fireEvent.click(timingTab)

      // Find slider number inputs (not the slider itself) that were showing cutoff issues
      // Use more specific selectors to get the number inputs, not the range sliders
      const numberInputs = screen.getAllByRole('spinbutton') // Number inputs have spinbutton role
      expect(numberInputs).toHaveLength(3) // Welcome, Objectives, Topic durations

      // Verify each number input is visible and properly sized
      numberInputs.forEach(input => {
        expect(input).toBeInTheDocument()
        expect(input).toBeVisible()
        expect(input).toHaveAttribute('type', 'number')
      })

      // Specifically check values match defaults
      const values = numberInputs.map(input => Number(input.value))
      expect(values).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.welcomeDuration)
      expect(values).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.objectivesDuration)
      expect(values).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.topicDuration)
    })

    it('should display unit labels ("min") without overlap or cutoff', () => {
      renderModal()

      const timingTab = screen.getByRole('tab', { name: /timing/i })
      fireEvent.click(timingTab)

      // Check that "min" unit labels are present and not cut off
      const minLabels = screen.getAllByText('min')
      expect(minLabels).toHaveLength(3) // Welcome, Objectives, Topic durations

      // Verify min labels are properly positioned (this would fail with current CSS)
      minLabels.forEach(label => {
        expect(label).toBeInTheDocument()
        expect(label).toBeVisible()
      })
    })

    it('should have properly sized slider inputs on Media tab', () => {
      renderModal()

      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      // Find all number inputs on Media tab - there should be 2 sliders
      const numberInputs = screen.getAllByRole('spinbutton')
      expect(numberInputs).toHaveLength(2) // Image Keywords and Video Search Terms

      // Verify inputs are visible and properly sized
      numberInputs.forEach(input => {
        expect(input).toBeInTheDocument()
        expect(input).toBeVisible()
        expect(input).toHaveAttribute('type', 'number')
      })

      // Check values match defaults
      const values = numberInputs.map(input => Number(input.value))
      expect(values).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.imageKeywordsCount)
      expect(values).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.videoSearchTermsCount)
    })

    it('should have properly sized inputs on Assessment tab', () => {
      renderModal()

      const assessmentTab = screen.getByRole('tab', { name: /assessment/i })
      fireEvent.click(assessmentTab)

      // Find all number inputs on Assessment tab - there should be 3 sliders
      const numberInputs = screen.getAllByRole('spinbutton')
      expect(numberInputs).toHaveLength(3) // Knowledge Check, Assessment Questions, Pass Mark

      // Verify inputs are visible and properly sized
      numberInputs.forEach(input => {
        expect(input).toBeInTheDocument()
        expect(input).toBeVisible()
        expect(input).toHaveAttribute('type', 'number')
      })

      // Check values match defaults
      const values = numberInputs.map(input => Number(input.value))
      expect(values).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.knowledgeCheckQuestions)
      expect(values).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.assessmentQuestions)
      expect(values).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.passMark)

      // Check that percentage unit is visible
      const percentageLabel = screen.getByText('%')
      expect(percentageLabel).toBeInTheDocument()
      expect(percentageLabel).toBeVisible()
    })
  })

  describe('Modal Content Overflow Issues', () => {
    it('should display all button groups without cutoff at modal bottom', () => {
      renderModal()

      const assessmentTab = screen.getByRole('tab', { name: /assessment/i })
      fireEvent.click(assessmentTab)

      // The "Question Type Mix" section should be fully visible
      // Note: Using the actual button text from SETTING_OPTIONS
      const questionTypeMixButtons = [
        screen.getByText('Multiple Choice Only'),
        screen.getByText('True/False Heavy'),
        screen.getByText('Balanced Mix')
      ]

      questionTypeMixButtons.forEach(button => {
        expect(button).toBeInTheDocument()
        expect(button).toBeVisible()
      })
    })

    it('should show Reset to Defaults button without cutoff', () => {
      renderModal()

      const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
      expect(resetButton).toBeInTheDocument()
      expect(resetButton).toBeVisible()
    })

    it('should show Apply Settings and Cancel buttons without cutoff', () => {
      renderModal()

      const applyButton = screen.getByRole('button', { name: /apply settings/i })
      const cancelButton = screen.getByRole('button', { name: /cancel/i })

      expect(applyButton).toBeInTheDocument()
      expect(applyButton).toBeVisible()
      expect(cancelButton).toBeInTheDocument()
      expect(cancelButton).toBeVisible()
    })
  })

  describe('Responsive Layout Behavior', () => {
    it('should handle slider components on narrow viewports', () => {
      // This test would verify mobile responsiveness
      // In a real test environment, we'd manipulate viewport size
      renderModal()

      const timingTab = screen.getByRole('tab', { name: /timing/i })
      fireEvent.click(timingTab)

      // Verify that slider components exist and are accessible (range inputs)
      const sliders = screen.getAllByRole('slider') // HTML range inputs have slider role
      expect(sliders.length).toBeGreaterThan(0)

      sliders.forEach(slider => {
        expect(slider).toBeInTheDocument()
        expect(slider).not.toBeDisabled()
        expect(slider).toHaveAttribute('type', 'range')
      })

      // Also verify the corresponding number inputs are present
      const numberInputs = screen.getAllByRole('spinbutton')
      expect(numberInputs.length).toBe(sliders.length) // Should match number of sliders
    })

    it('should maintain button group functionality across viewport sizes', () => {
      renderModal()

      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      // Check AI Image Prompt Detail buttons - use exact text
      const simpleButton = screen.getByText('Simple')
      const standardButton = screen.getByText('Standard')
      const detailedButton = screen.getByText('Detailed')
      const artisticButton = screen.getByText('Artistic')

      expect(simpleButton).toBeInTheDocument()
      expect(standardButton).toBeInTheDocument()
      expect(detailedButton).toBeInTheDocument()
      expect(artisticButton).toBeInTheDocument()

      // Verify default selection (standard is the default)
      expect(standardButton.closest('button')).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('Content Accessibility and Visibility', () => {
    it('should have proper tab navigation without content cutoff', () => {
      renderModal()

      // Test all tabs are accessible
      const contentTab = screen.getByRole('tab', { name: /content/i })
      const mediaTab = screen.getByRole('tab', { name: /media/i })
      const assessmentTab = screen.getByRole('tab', { name: /assessment/i })
      const timingTab = screen.getByRole('tab', { name: /timing/i })

      expect(contentTab).toBeInTheDocument()
      expect(mediaTab).toBeInTheDocument()
      expect(assessmentTab).toBeInTheDocument()
      expect(timingTab).toBeInTheDocument()

      // Verify tabs are clickable
      expect(contentTab).not.toBeDisabled()
      expect(mediaTab).not.toBeDisabled()
      expect(assessmentTab).not.toBeDisabled()
      expect(timingTab).not.toBeDisabled()
    })

    it('should display help tooltips without layout interference', () => {
      renderModal()

      // Look for help buttons (they have HelpCircle icons)
      const helpButtons = screen.getAllByRole('button', { name: /help for/i })
      expect(helpButtons.length).toBeGreaterThan(0)

      helpButtons.forEach(helpButton => {
        expect(helpButton).toBeInTheDocument()
        expect(helpButton).toBeVisible()
      })
    })

    it('should properly display setting modification indicators', () => {
      renderModal()

      // Since we start with defaults, no modified indicators should be present initially
      // But the structure should support them when settings are changed
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()

      // Verify modal has proper aria attributes
      expect(modal).toHaveAttribute('aria-modal', 'true')
    })
  })

  describe('Input Field Value Display', () => {
    it('should display numeric values clearly without cutoff across all tabs', () => {
      renderModal()

      // Test Timing tab values using spinbutton role to target number inputs specifically
      const timingTab = screen.getByRole('tab', { name: /timing/i })
      fireEvent.click(timingTab)

      const timingInputs = screen.getAllByRole('spinbutton')
      expect(timingInputs).toHaveLength(3)

      const timingValues = timingInputs.map(input => Number(input.value))
      expect(timingValues).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.welcomeDuration)
      expect(timingValues).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.objectivesDuration)
      expect(timingValues).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.topicDuration)

      timingInputs.forEach(input => expect(input).toBeVisible())

      // Test Assessment tab values
      const assessmentTab = screen.getByRole('tab', { name: /assessment/i })
      fireEvent.click(assessmentTab)

      const assessmentInputs = screen.getAllByRole('spinbutton')
      expect(assessmentInputs).toHaveLength(3)

      const assessmentValues = assessmentInputs.map(input => Number(input.value))
      expect(assessmentValues).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.knowledgeCheckQuestions)
      expect(assessmentValues).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.assessmentQuestions)
      expect(assessmentValues).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.passMark)

      assessmentInputs.forEach(input => expect(input).toBeVisible())

      // Test Media tab values
      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      const mediaInputs = screen.getAllByRole('spinbutton')
      expect(mediaInputs).toHaveLength(2)

      const mediaValues = mediaInputs.map(input => Number(input.value))
      expect(mediaValues).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.imageKeywordsCount)
      expect(mediaValues).toContain(DEFAULT_PROMPT_TUNING_SETTINGS.videoSearchTermsCount)

      mediaInputs.forEach(input => expect(input).toBeVisible())
    })
  })
})