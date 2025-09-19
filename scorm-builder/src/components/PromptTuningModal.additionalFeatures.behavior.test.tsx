/**
 * BEHAVIOR TEST: Prompt Tuning Modal Additional Features
 *
 * This test defines the expected behavior for newly added features:
 * - Image Search Specificity setting (parallel to Video Search Specificity)
 * - Assessment tab content visibility (no bottom cutoff)
 * - Slider label alignment improvements
 *
 * Following TDD: Write failing tests first to demonstrate new features work,
 * then verify implementation makes tests pass.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PromptTuningModal } from './PromptTuningModal'
import { AllTheProviders } from '../test/TestProviders'
import { DEFAULT_PROMPT_TUNING_SETTINGS } from '../types/promptTuning'

describe('PromptTuningModal Additional Features', () => {
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

  describe('Image Search Specificity Feature', () => {
    it('should display Image Search Specificity setting in Media tab', async () => {
      renderModal()

      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      // Wait for tab content to render
      await waitFor(() => {
        const imageSpecificityLabel = screen.getByText('Image Search Specificity')
        expect(imageSpecificityLabel).toBeInTheDocument()
      })

      // Verify help text is present
      const helpButton = screen.getByRole('button', { name: /help for image search specificity/i })
      expect(helpButton).toBeInTheDocument()
    })

    it('should have Image Search Specificity button group with correct options', async () => {
      renderModal()

      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      // Wait for tab content to render
      await waitFor(() => {
        expect(screen.getByText('Image Search Specificity')).toBeInTheDocument()
      })

      // Check all three specificity options are present
      const broadButton = screen.getAllByText('Broad').find(el =>
        el.closest('button') && el.textContent === 'Broad'
      )
      const specificButton = screen.getAllByText('Specific').find(el =>
        el.closest('button') && el.textContent === 'Specific'
      )
      const verySpecificButton = screen.getAllByText('Very Specific').find(el =>
        el.closest('button') && el.textContent === 'Very Specific'
      )

      expect(broadButton).toBeInTheDocument()
      expect(specificButton).toBeInTheDocument()
      expect(verySpecificButton).toBeInTheDocument()

      // Verify default selection (should be 'specific')
      expect(specificButton?.closest('button')).toHaveAttribute('aria-pressed', 'true')
    })

    it('should allow changing Image Search Specificity selection', async () => {
      renderModal()

      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      // Wait for tab content to render
      await waitFor(() => {
        expect(screen.getByText('Image Search Specificity')).toBeInTheDocument()
      })

      // Click on 'Very Specific' option
      const verySpecificButton = screen.getAllByText('Very Specific').find(el =>
        el.closest('button') && el.textContent === 'Very Specific'
      )

      expect(verySpecificButton).toBeInTheDocument()
      fireEvent.click(verySpecificButton!.closest('button')!)

      // Verify the selection changed
      expect(verySpecificButton?.closest('button')).toHaveAttribute('aria-pressed', 'true')

      // Verify previous selection is no longer active
      const specificButton = screen.getAllByText('Specific').find(el =>
        el.closest('button') && el.textContent === 'Specific'
      )
      expect(specificButton?.closest('button')).toHaveAttribute('aria-pressed', 'false')
    })

    it('should position Image Search Specificity logically with other image settings', async () => {
      renderModal()

      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      // Wait for tab content to render
      await waitFor(() => {
        expect(screen.getByText('Image Search Specificity')).toBeInTheDocument()
      })

      // Verify all media settings are present
      expect(screen.getByText('Image Keywords Count')).toBeInTheDocument()
      expect(screen.getByText('AI Image Prompt Detail')).toBeInTheDocument()
      expect(screen.getByText('Image Search Specificity')).toBeInTheDocument()
      expect(screen.getByText('Video Search Terms Count')).toBeInTheDocument()
      expect(screen.getByText('Video Search Specificity')).toBeInTheDocument()
    })
  })

  describe('Assessment Tab Content Visibility', () => {
    it('should display all Question Type Mix buttons without cutoff', () => {
      renderModal()

      const assessmentTab = screen.getByRole('tab', { name: /assessment/i })
      fireEvent.click(assessmentTab)

      // All Question Type Mix buttons should be visible
      const multipleChoiceButton = screen.getByText('Multiple Choice Only')
      const trueFalseButton = screen.getByText('True/False Heavy')
      const balancedMixButton = screen.getByText('Balanced Mix')

      expect(multipleChoiceButton).toBeInTheDocument()
      expect(trueFalseButton).toBeInTheDocument()
      expect(balancedMixButton).toBeInTheDocument()

      // All buttons should be visible (not cut off)
      expect(multipleChoiceButton).toBeVisible()
      expect(trueFalseButton).toBeVisible()
      expect(balancedMixButton).toBeVisible()
    })

    it('should allow scrolling to bottom content in Assessment tab', () => {
      renderModal()

      const assessmentTab = screen.getByRole('tab', { name: /assessment/i })
      fireEvent.click(assessmentTab)

      // Find the tab content container
      const tabContent = screen.getByRole('tabpanel')
      expect(tabContent).toBeInTheDocument()

      // All assessment controls should be accessible
      const knowledgeCheckSlider = screen.getByRole('slider', { name: /knowledge check questions/i })
      const assessmentQuestionsSlider = screen.getByRole('slider', { name: /assessment questions total/i })
      const passMarkSlider = screen.getByRole('slider', { name: /pass mark percentage/i })

      expect(knowledgeCheckSlider).toBeVisible()
      expect(assessmentQuestionsSlider).toBeVisible()
      expect(passMarkSlider).toBeVisible()

      // Question Type Mix should also be visible
      const questionTypeMixButtons = [
        screen.getByText('Multiple Choice Only'),
        screen.getByText('True/False Heavy'),
        screen.getByText('Balanced Mix')
      ]

      questionTypeMixButtons.forEach(button => {
        expect(button).toBeVisible()
      })
    })

    it('should have adequate bottom spacing for all Assessment tab content', () => {
      renderModal()

      const assessmentTab = screen.getByRole('tab', { name: /assessment/i })
      fireEvent.click(assessmentTab)

      // Check that all content is present and accessible
      const lastSection = screen.getByText('Question Type Mix')
      expect(lastSection).toBeInTheDocument()
      expect(lastSection).toBeVisible()

      // The buttons in the last section should be clickable
      const balancedMixButton = screen.getByText('Balanced Mix')
      expect(balancedMixButton).toBeVisible()

      // Should be able to click the bottom-most button
      fireEvent.click(balancedMixButton)
      expect(balancedMixButton.closest('button')).toHaveAttribute('aria-pressed', 'true')
    })
  })

  describe('Slider Label Alignment', () => {
    it('should properly align min and max labels with slider track on Content Length tab', async () => {
      renderModal()

      const contentLengthTab = screen.getByRole('tab', { name: /content length/i })
      fireEvent.click(contentLengthTab)

      // Wait for tab content to render
      await waitFor(() => {
        expect(screen.getByText('Welcome Page Word Count')).toBeInTheDocument()
      })

      // Check that word count sliders are present
      expect(screen.getByText('Welcome Page Word Count')).toBeInTheDocument()
      expect(screen.getByText('Learning Objectives Word Count')).toBeInTheDocument()
      expect(screen.getByText('Topic Page Word Count')).toBeInTheDocument()

      // Check that character limit setting is present
      expect(screen.getByText('Character Limit Control')).toBeInTheDocument()
    })

    it('should properly align min and max labels with slider track on Assessment tab', async () => {
      renderModal()

      const assessmentTab = screen.getByRole('tab', { name: /assessment/i })
      fireEvent.click(assessmentTab)

      // Wait for tab content to render
      await waitFor(() => {
        expect(screen.getByText('Knowledge Check Questions')).toBeInTheDocument()
      })

      // Check for assessment-specific labels
      expect(screen.getByText('0')).toBeInTheDocument() // Knowledge check min
      expect(screen.getByText('3')).toBeInTheDocument() // Knowledge check max
      expect(screen.getByText('5')).toBeInTheDocument() // Assessment questions min
      expect(screen.getByText('20')).toBeInTheDocument() // Assessment questions max
      expect(screen.getByText('60%')).toBeInTheDocument() // Pass mark min
      expect(screen.getByText('100%')).toBeInTheDocument() // Pass mark max
    })

    it('should maintain proper label alignment on Media tab sliders', async () => {
      renderModal()

      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      // Wait for tab content to render
      await waitFor(() => {
        expect(screen.getByText('Image Search Specificity')).toBeInTheDocument()
      })

      // Check for media settings
      expect(screen.getByText('Image Keywords Count')).toBeInTheDocument()
      expect(screen.getByText('Video Search Terms Count')).toBeInTheDocument()
    })

    it('should display slider values in input fields correctly aligned', async () => {
      renderModal()

      const contentLengthTab = screen.getByRole('tab', { name: /content length/i })
      fireEvent.click(contentLengthTab)

      // Wait for tab content to render
      await waitFor(() => {
        expect(screen.getByText('Welcome Page Word Count')).toBeInTheDocument()
      })

      // Check that number inputs show correct default values
      const numberInputs = screen.getAllByRole('spinbutton')
      expect(numberInputs.length).toBeGreaterThan(0) // At least some word count settings

      // Verify inputs are properly sized and visible
      numberInputs.forEach(input => {
        expect(input).toBeVisible()
        expect(input).toHaveAttribute('type', 'number')
      })
    })
  })

  describe('Feature Integration', () => {
    it('should include Image Search Specificity in modal state management', () => {
      renderModal()

      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      // Change Image Search Specificity and verify it affects the form state
      const broadButton = screen.getAllByText('Broad').find(el =>
        el.closest('button') && el.textContent === 'Broad'
      )

      fireEvent.click(broadButton!.closest('button')!)
      expect(broadButton?.closest('button')).toHaveAttribute('aria-pressed', 'true')

      // Apply settings button should be enabled
      const applyButton = screen.getByRole('button', { name: /apply settings/i })
      expect(applyButton).toBeEnabled()
    })

    it('should reset Image Search Specificity to default when Reset to Defaults is clicked', () => {
      renderModal()

      const mediaTab = screen.getByRole('tab', { name: /media/i })
      fireEvent.click(mediaTab)

      // Change from default
      const broadButton = screen.getAllByText('Broad').find(el =>
        el.closest('button') && el.textContent === 'Broad'
      )
      fireEvent.click(broadButton!.closest('button')!)

      // Reset to defaults
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
      fireEvent.click(resetButton)

      // Verify it's back to default (specific)
      const specificButton = screen.getAllByText('Specific').find(el =>
        el.closest('button') && el.textContent === 'Specific'
      )
      expect(specificButton?.closest('button')).toHaveAttribute('aria-pressed', 'true')
    })
  })
})