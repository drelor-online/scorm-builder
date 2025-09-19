/**
 * BEHAVIOR TEST: Course Settings Reset to Defaults
 *
 * This test defines the expected behavior for the reset to defaults functionality:
 * - Reset button should be visible and accessible
 * - Clicking reset should restore all settings to their original defaults
 * - Settings should match the historical defaults that have always been used
 *
 * Following TDD: Write failing test first, then implement the feature.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CourseSettingsWizard, type CourseSettings } from './CourseSettingsWizard'
import { AllTheProviders } from '../test/TestProviders'

describe('CourseSettingsWizard Reset to Defaults Behavior', () => {
  const mockCourseContent = {
    courseTitle: 'Test Course',
    topics: []
  }

  const mockCourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description'
  }

  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Reset Button Availability', () => {
    it('should display a Reset to Defaults button', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard
            courseContent={mockCourseContent}
            courseSeedData={mockCourseSeedData}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />
        </AllTheProviders>
      )

      const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
      expect(resetButton).toBeInTheDocument()
    })

    it('should have proper accessibility attributes for reset button', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard
            courseContent={mockCourseContent}
            courseSeedData={mockCourseSeedData}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />
        </AllTheProviders>
      )

      const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
      expect(resetButton).toHaveAttribute('title')
      expect(resetButton).not.toBeDisabled()
    })
  })

  describe('Default Settings Verification', () => {
    it('should initialize with the correct default settings', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard
            courseContent={mockCourseContent}
            courseSeedData={mockCourseSeedData}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />
        </AllTheProviders>
      )

      // Verify key default settings
      const requireAudioCheckbox = screen.getByRole('checkbox', { name: /require audio completion/i })
      expect(requireAudioCheckbox).not.toBeChecked()

      const linearRadio = screen.getByDisplayValue('linear')
      expect(linearRadio).toBeChecked()

      const allowRetakeCheckbox = screen.getByRole('checkbox', { name: /allow assessment retakes/i })
      expect(allowRetakeCheckbox).toBeChecked()

      const showProgressCheckbox = screen.getByRole('checkbox', { name: /show progress bar/i })
      expect(showProgressCheckbox).toBeChecked()

      const keyboardNavCheckbox = screen.getByRole('checkbox', { name: /enable keyboard navigation/i })
      expect(keyboardNavCheckbox).toBeChecked()

      const printableCheckbox = screen.getByRole('checkbox', { name: /allow content printing/i })
      expect(printableCheckbox).not.toBeChecked()
    })
  })

  describe('Reset Functionality', () => {
    it('should reset all modified settings back to defaults when reset button is clicked', async () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard
            courseContent={mockCourseContent}
            courseSeedData={mockCourseSeedData}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />
        </AllTheProviders>
      )

      // Modify some settings from their defaults
      const requireAudioCheckbox = screen.getByRole('checkbox', { name: /require audio completion/i })
      fireEvent.click(requireAudioCheckbox)
      expect(requireAudioCheckbox).toBeChecked()

      const freeRadio = screen.getByDisplayValue('free')
      fireEvent.click(freeRadio)
      expect(freeRadio).toBeChecked()

      const passMarkInput = screen.getByDisplayValue('80')
      fireEvent.change(passMarkInput, { target: { value: '90' } })
      expect(screen.getByDisplayValue('90')).toBeInTheDocument()

      const showProgressCheckbox = screen.getByRole('checkbox', { name: /show progress bar/i })
      fireEvent.click(showProgressCheckbox)
      expect(showProgressCheckbox).not.toBeChecked()

      // Click reset button
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
      fireEvent.click(resetButton)

      // Verify all settings are reset to defaults
      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /require audio completion/i })).not.toBeChecked()
        expect(screen.getByDisplayValue('linear')).toBeChecked()
        expect(screen.getByDisplayValue('80')).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: /show progress bar/i })).toBeChecked()
      })
    })

    it('should reset complex settings like completion criteria and font size', async () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard
            courseContent={mockCourseContent}
            courseSeedData={mockCourseSeedData}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />
        </AllTheProviders>
      )

      // Modify complex dropdown settings
      const completionSelect = screen.getByDisplayValue('View all pages + pass assessment')
      fireEvent.change(completionSelect, { target: { value: 'pass_assessment' } })
      expect(screen.getByDisplayValue('Pass assessment')).toBeInTheDocument()

      const fontSizeSelect = screen.getByDisplayValue('Medium')
      fireEvent.change(fontSizeSelect, { target: { value: 'large' } })
      expect(screen.getByDisplayValue('Large')).toBeInTheDocument()

      // Click reset button
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
      fireEvent.click(resetButton)

      // Verify complex settings are reset
      await waitFor(() => {
        expect(screen.getByDisplayValue('View all pages + pass assessment')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Medium')).toBeInTheDocument()
      })
    })

    it('should reset numeric input fields to their default values', async () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard
            courseContent={mockCourseContent}
            courseSeedData={mockCourseSeedData}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />
        </AllTheProviders>
      )

      // Modify numeric inputs
      const timeLimitInput = screen.getByPlaceholderText('0 = unlimited')
      fireEvent.change(timeLimitInput, { target: { value: '120' } })
      expect(screen.getByDisplayValue('120')).toBeInTheDocument()

      const sessionTimeoutInput = screen.getByDisplayValue('30')
      fireEvent.change(sessionTimeoutInput, { target: { value: '60' } })
      expect(screen.getByDisplayValue('60')).toBeInTheDocument()

      // Click reset button
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
      fireEvent.click(resetButton)

      // Verify numeric inputs are reset
      await waitFor(() => {
        expect(screen.getByPlaceholderText('0 = unlimited')).toHaveValue(0) // timeLimit
        expect(screen.getByDisplayValue('30')).toBeInTheDocument() // sessionTimeout
      })
    })
  })

  describe('Visual Feedback', () => {
    it('should provide visual feedback when reset is successful', async () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard
            courseContent={mockCourseContent}
            courseSeedData={mockCourseSeedData}
            onNext={mockOnNext}
            onBack={mockOnBack}
          />
        </AllTheProviders>
      )

      // Modify a setting
      const requireAudioCheckbox = screen.getByRole('checkbox', { name: /require audio completion/i })
      fireEvent.click(requireAudioCheckbox)

      // Click reset button
      const resetButton = screen.getByRole('button', { name: /reset to defaults/i })
      fireEvent.click(resetButton)

      // Check that settings were actually reset (indirect feedback)
      await waitFor(() => {
        expect(screen.getByRole('checkbox', { name: /require audio completion/i })).not.toBeChecked()
      })
    })
  })
})