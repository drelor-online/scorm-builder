import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CourseSettingsWizard, type CourseSettings } from './CourseSettingsWizard'
import { TestProviders } from '../test/TestProviders'

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
      <TestProviders>
        <CourseSettingsWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestProviders>
    )

    expect(screen.getByText('Course Settings')).toBeInTheDocument()
    console.log('✓ CourseSettingsWizard renders successfully')
  })

  it('should show the audio completion checkbox', () => {
    render(
      <TestProviders>
        <CourseSettingsWizard
          courseContent={mockCourseContent}
          courseSeedData={mockCourseSeedData}
          onNext={() => {}}
          onBack={() => {}}
        />
      </TestProviders>
    )

    const checkbox = screen.getByRole('checkbox', {
      name: /require audio completion before page navigation/i
    })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
    console.log('✓ Audio completion checkbox is visible and unchecked by default')
  })
})