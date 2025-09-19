import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CourseSettingsWizard, type CourseSettings } from './CourseSettingsWizard'
import { AllTheProviders } from '../test/TestProviders'

describe('CourseSettingsWizard - Simple Import Test', () => {
  const mockCourseContent = {
    courseTitle: 'Test Course',
    topics: []
  }

  const mockCourseSeedData = {
    courseTitle: 'Test Course',
    courseDescription: 'Test Description'
  }

  it('should render CourseSettingsWizard without crashing', () => {
    render(
      <AllTheProviders>
        <CourseSettingsWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </AllTheProviders>
    )

    expect(screen.getByText('Course Settings')).toBeInTheDocument()
    console.log('✓ CourseSettingsWizard renders successfully')
  })

  it('should show the audio completion checkbox', () => {
    render(
      <AllTheProviders>
        <CourseSettingsWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </AllTheProviders>
    )

    const checkbox = screen.getByRole('checkbox', {
      name: /require audio completion/i
    })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
    console.log('✓ Audio completion checkbox is visible and unchecked by default')
  })
})