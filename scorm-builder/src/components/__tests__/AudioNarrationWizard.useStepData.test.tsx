import React from 'react'
import { render } from '../../test/testProviders'
import { describe, test, expect, vi } from 'vitest'
import { AudioNarrationWizard } from '../AudioNarrationWizard'
// Mock console.error to catch the error
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

const mockCourseContent = {
  topics: [
    {
      id: 'topic1',
      title: 'Introduction',
      content: 'Topic content 1',
      narration: 'This is the narration for topic 1'
    }
  ],
  welcomePage: {
    id: 'welcome',
    title: 'Welcome',
    content: 'Welcome content',
    narration: 'Welcome narration'
  },
  learningObjectivesPage: {
    id: 'objectives',
    title: 'Learning Objectives',
    content: 'Objectives content',
    narration: 'Objectives narration'
  }
}

describe('AudioNarrationWizard - useStepData Usage', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()

  test('should throw error when useStepData is used incorrectly', () => {
    // The component should throw an error because it's using useStepData incorrectly
    expect(() => {
      render(<AudioNarrationWizard
                courseContent={mockCourseContent}
                onNext={mockOnNext}
                onBack={mockOnBack}
              />)
    }).toThrow()

    // Check that the error is about loadData not being a function
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load step data:'),
      expect.objectContaining({
        message: expect.stringContaining('loadData is not a function')
      })
    )
  })
})