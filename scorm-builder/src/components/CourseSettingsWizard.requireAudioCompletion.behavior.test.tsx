import React from 'react'
import { render, screen } from '../test/testProviders'
import { describe, it, expect } from 'vitest'
import { CourseSettingsWizard } from './CourseSettingsWizard'
import type { CourseSeedData } from '../types/course'
import type { CourseContent } from '../types/aiPrompt'

describe('CourseSettingsWizard - Require Audio Completion Feature', () => {
  const mockCourseSeedData: CourseSeedData = {
    courseTitle: 'Test Course',
    difficulty: 1,
    customTopics: ['Topic 1'],
    template: 'Corporate',
    templateTopics: []
  }

  const mockCourseContent: CourseContent = {
    welcomePage: {
      id: 'welcome',
      title: 'Welcome',
      content: 'Test content',
      narration: 'Test narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 60
    },
    learningObjectivesPage: {
      id: 'objectives',
      title: 'Learning Objectives',
      content: 'Test objectives',
      narration: 'Test narration',
      imageKeywords: [],
      imagePrompts: [],
      videoSearchTerms: [],
      duration: 60
    },
    topics: [],
    assessment: {
      questions: [],
      passMark: 80,
      narration: 'Test narration'
    }
  }

  const mockHandlers = {
    onNext: () => {},
    onBack: () => {},
    onSettingsClick: () => {},
    onHelp: () => {},
    onSave: () => {},
    onOpen: () => {},
    onStepClick: () => {}
  }

  it('should render CourseSettingsWizard component', () => {
    // This test should fail initially because CourseSettingsWizard doesn't exist yet
    expect(() => {
      render(
        <CourseSettingsWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          {...mockHandlers}
        />
      )
    }).not.toThrow()
  })

  it('should display Audio Settings section', () => {
    render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Should have an Audio Settings section
    expect(screen.getByText(/audio settings/i)).toBeInTheDocument()
  })

  it('should display "Require audio completion before page navigation" checkbox', () => {
    render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
      />
    )

    // Should have the specific checkbox for audio completion requirement
    expect(screen.getByRole('checkbox', { 
      name: /require audio completion before page navigation/i 
    })).toBeInTheDocument()
  })

  it('should call onNext with course settings when proceeding', () => {
    let capturedSettings: any = null
    const mockOnNext = (settings: any) => {
      capturedSettings = settings
    }

    render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
        onNext={mockOnNext}
      />
    )

    // Find and click the Next button
    const nextButton = screen.getByRole('button', { name: /next/i })
    nextButton.click()

    // Should have called onNext with settings object that includes requireAudioCompletion
    expect(capturedSettings).toBeDefined()
    expect(capturedSettings).toHaveProperty('requireAudioCompletion')
    expect(typeof capturedSettings.requireAudioCompletion).toBe('boolean')
  })

  it('should default requireAudioCompletion to false', () => {
    let capturedSettings: any = null
    const mockOnNext = (settings: any) => {
      capturedSettings = settings
    }

    render(
      <CourseSettingsWizard
        courseContent={mockCourseContent}
        courseSeedData={mockCourseSeedData}
        {...mockHandlers}
        onNext={mockOnNext}
      />
    )

    // Click next without changing settings
    const nextButton = screen.getByRole('button', { name: /next/i })
    nextButton.click()

    expect(capturedSettings.requireAudioCompletion).toBe(false)
  })
})