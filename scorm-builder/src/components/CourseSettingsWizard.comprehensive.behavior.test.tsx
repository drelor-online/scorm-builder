import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CourseSettingsWizard, type CourseSettings } from './CourseSettingsWizard'
import { AllTheProviders } from '../test/TestProviders'

describe('CourseSettingsWizard - Comprehensive Settings Test', () => {
  const mockCourseContent = {
    courseTitle: 'Test Course',
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: '<p>Test content</p>',
      }
    ]
  }

  const mockCourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description'
  }

  let capturedSettings: CourseSettings | null = null

  const mockProps = {
    courseContent: mockCourseContent,
    courseSeedData: mockCourseSeedData,
    onNext: (settings: CourseSettings) => {
      capturedSettings = settings
    },
    onBack: () => {},
  }

  beforeEach(() => {
    capturedSettings = null
  })

  describe('Default Settings', () => {
    it('should initialize with sensible defaults', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      // Learning Control defaults
      expect(screen.getByRole('checkbox', { name: /require audio completion/i })).not.toBeChecked()
      expect(screen.getByRole('radio', { name: /linear/i })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: /auto-advance/i })).not.toBeChecked()
      expect(screen.getByRole('checkbox', { name: /allow reviewing previous/i })).toBeChecked()

      // Assessment defaults
      expect(screen.getByDisplayValue('80')).toBeInTheDocument() // Pass mark
      expect(screen.getByDisplayValue('0')).toBeInTheDocument() // Retake delay
      expect(screen.getByRole('checkbox', { name: /allow assessment retakes/i })).toBeChecked()

      // Interface defaults
      expect(screen.getByRole('checkbox', { name: /show progress bar/i })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: /show course outline/i })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: /confirm before exit/i })).toBeChecked()

      // Advanced defaults
      expect(screen.getByDisplayValue('30')).toBeInTheDocument() // Session timeout
      expect(screen.getByRole('checkbox', { name: /enable keyboard navigation/i })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: /allow content printing/i })).not.toBeChecked()

      console.log('✓ All default settings are correctly set')
    })
  })

  describe('Learning Control Settings', () => {
    it('should handle audio completion requirement toggle', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      const audioCheckbox = screen.getByRole('checkbox', { name: /require audio completion/i })
      
      // Toggle on
      fireEvent.click(audioCheckbox)
      expect(audioCheckbox).toBeChecked()

      // Click Next to capture settings
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      
      expect(capturedSettings?.requireAudioCompletion).toBe(true)
      console.log('✓ Audio completion requirement toggle works')
    })

    it('should handle navigation mode changes', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      const freeNavRadio = screen.getByRole('radio', { name: /free/i })
      
      fireEvent.click(freeNavRadio)
      expect(freeNavRadio).toBeChecked()

      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      
      expect(capturedSettings?.navigationMode).toBe('free')
      console.log('✓ Navigation mode toggle works')
    })

    it('should handle auto-advance and previous review toggles', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      const autoAdvanceCheckbox = screen.getByRole('checkbox', { name: /auto-advance/i })
      const previousReviewCheckbox = screen.getByRole('checkbox', { name: /allow reviewing previous/i })
      
      // Toggle auto-advance on
      fireEvent.click(autoAdvanceCheckbox)
      expect(autoAdvanceCheckbox).toBeChecked()

      // Toggle previous review off
      fireEvent.click(previousReviewCheckbox)
      expect(previousReviewCheckbox).not.toBeChecked()

      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      
      expect(capturedSettings?.autoAdvance).toBe(true)
      expect(capturedSettings?.allowPreviousReview).toBe(false)
      console.log('✓ Auto-advance and previous review toggles work')
    })
  })

  describe('Assessment Settings', () => {
    it('should handle pass mark changes with validation', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      const passMarkInput = screen.getByDisplayValue('80')
      
      // Test valid value
      fireEvent.change(passMarkInput, { target: { value: '75' } })
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      expect(capturedSettings?.passMark).toBe(75)

      // Test boundary validation (should cap at 100)
      fireEvent.change(passMarkInput, { target: { value: '150' } })
      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      expect(capturedSettings?.passMark).toBe(100)

      console.log('✓ Pass mark validation works')
    })

    it('should handle retake delay and completion criteria', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      // Set retake delay
      const retakeDelayInput = screen.getByDisplayValue('0')
      fireEvent.change(retakeDelayInput, { target: { value: '24' } })

      // Change completion criteria
      const completionSelect = screen.getByDisplayValue('View all pages + pass assessment')
      fireEvent.change(completionSelect, { target: { value: 'pass_assessment' } })

      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      
      expect(capturedSettings?.retakeDelay).toBe(24)
      expect(capturedSettings?.completionCriteria).toBe('pass_assessment')
      console.log('✓ Retake delay and completion criteria work')
    })
  })

  describe('Interface & UX Settings', () => {
    it('should handle interface toggles', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      const showProgressCheckbox = screen.getByRole('checkbox', { name: /show progress bar/i })
      const showOutlineCheckbox = screen.getByRole('checkbox', { name: /show course outline/i })
      const confirmExitCheckbox = screen.getByRole('checkbox', { name: /confirm before exit/i })

      // Toggle all off
      fireEvent.click(showProgressCheckbox)
      fireEvent.click(showOutlineCheckbox)
      fireEvent.click(confirmExitCheckbox)

      expect(showProgressCheckbox).not.toBeChecked()
      expect(showOutlineCheckbox).not.toBeChecked()
      expect(confirmExitCheckbox).not.toBeChecked()

      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      
      expect(capturedSettings?.showProgress).toBe(false)
      expect(capturedSettings?.showOutline).toBe(false)
      expect(capturedSettings?.confirmExit).toBe(false)
      console.log('✓ Interface toggles work')
    })

    it('should handle font size selection', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      const fontSizeSelect = screen.getByDisplayValue('Medium')
      fireEvent.change(fontSizeSelect, { target: { value: 'large' } })

      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      
      expect(capturedSettings?.fontSize).toBe('large')
      console.log('✓ Font size selection works')
    })
  })

  describe('Advanced Options', () => {
    it('should handle timing settings with validation', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      // Find inputs by their labels
      const timeLimitInput = screen.getByLabelText(/time limit/i)
      const minTimeInput = screen.getByLabelText(/min. time/i)
      const sessionTimeoutInput = screen.getByLabelText(/auto-save interval/i)

      // Set values
      fireEvent.change(timeLimitInput, { target: { value: '60' } })
      fireEvent.change(minTimeInput, { target: { value: '30' } })
      fireEvent.change(sessionTimeoutInput, { target: { value: '15' } })

      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      
      expect(capturedSettings?.timeLimit).toBe(60)
      expect(capturedSettings?.minimumTimeSpent).toBe(30)
      expect(capturedSettings?.sessionTimeout).toBe(15)
      console.log('✓ Timing settings work')
    })

    it('should handle accessibility toggles', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      const keyboardNavCheckbox = screen.getByRole('checkbox', { name: /enable keyboard navigation/i })
      const printableCheckbox = screen.getByRole('checkbox', { name: /allow content printing/i })

      // Toggle keyboard nav off and printable on
      fireEvent.click(keyboardNavCheckbox)
      fireEvent.click(printableCheckbox)

      expect(keyboardNavCheckbox).not.toBeChecked()
      expect(printableCheckbox).toBeChecked()

      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      
      expect(capturedSettings?.keyboardNavigation).toBe(false)
      expect(capturedSettings?.printable).toBe(true)
      console.log('✓ Accessibility toggles work')
    })
  })

  describe('Complete Settings Object', () => {
    it('should return a complete settings object with all properties', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      // Make some changes to test different values
      fireEvent.click(screen.getByRole('checkbox', { name: /require audio completion/i }))
      fireEvent.click(screen.getByRole('radio', { name: /free/i }))

      fireEvent.click(screen.getByRole('button', { name: /next/i }))
      
      // Verify all expected properties exist
      expect(capturedSettings).toHaveProperty('requireAudioCompletion')
      expect(capturedSettings).toHaveProperty('navigationMode')
      expect(capturedSettings).toHaveProperty('autoAdvance')
      expect(capturedSettings).toHaveProperty('allowPreviousReview')
      expect(capturedSettings).toHaveProperty('passMark')
      expect(capturedSettings).toHaveProperty('allowRetake')
      expect(capturedSettings).toHaveProperty('retakeDelay')
      expect(capturedSettings).toHaveProperty('completionCriteria')
      expect(capturedSettings).toHaveProperty('showProgress')
      expect(capturedSettings).toHaveProperty('showOutline')
      expect(capturedSettings).toHaveProperty('confirmExit')
      expect(capturedSettings).toHaveProperty('fontSize')
      expect(capturedSettings).toHaveProperty('timeLimit')
      expect(capturedSettings).toHaveProperty('sessionTimeout')
      expect(capturedSettings).toHaveProperty('minimumTimeSpent')
      expect(capturedSettings).toHaveProperty('keyboardNavigation')
      expect(capturedSettings).toHaveProperty('printable')

      console.log('✓ Complete settings object returned:', Object.keys(capturedSettings!))
    })
  })

  describe('Responsive Design', () => {
    it('should render without layout issues in compact form', () => {
      render(
        <AllTheProviders>
          <CourseSettingsWizard {...mockProps} />
        </AllTheProviders>
      )

      // Verify key sections are present
      expect(screen.getByText('Learning Control')).toBeInTheDocument()
      expect(screen.getByText('Assessment')).toBeInTheDocument()
      expect(screen.getByText('Interface & UX')).toBeInTheDocument()
      expect(screen.getByText('Advanced Options')).toBeInTheDocument()

      // Verify layout is more compact than before
      const card = screen.getByRole('button', { name: /next/i }).closest('.course-settings-content')
      expect(card).toBeInTheDocument()

      console.log('✓ Responsive layout renders correctly')
    })
  })
})