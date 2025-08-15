import React from 'react'
import { render, screen, waitFor } from '../../test/testProviders'
import { CourseSeedInput } from '../CourseSeedInput'
import { CourseSeedData } from '../../types/course'

describe('CourseSeedInput - Async Data Loading', () => {
  const mockOnSubmit = vi.fn().mockResolvedValue(void 0)
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should display form data when initialData changes from undefined to defined', async () => {
    // Simulate the real-world scenario where component mounts before data loads
    const testData: CourseSeedData = {
      courseTitle: 'Natural Gas Safety',
      customTopics: ['Safety Fundamentals', 'Hazard Identification'],
      difficulty: 3,
      template: 'Safety',
      templateTopics: []
    }

    // First render with no initial data (simulating app startup)
    const { rerender } = render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={undefined} // Initially no data
      />
    )

    // Verify form fields are empty initially
    const titleInput = screen.getByDisplayValue('')
    expect(titleInput).toBeInTheDocument()

    // Re-render with data (simulating async data loading completion)
    rerender(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={testData} // Data now available
      />
    )

    // BUG: This test should fail because CourseSeedInput doesn't update state when initialData changes
    await waitFor(() => {
      const updatedTitleInput = screen.getByDisplayValue('Natural Gas Safety')
      expect(updatedTitleInput).toBeInTheDocument()
    })

    // Verify all form fields are populated
    expect(screen.getByDisplayValue('Natural Gas Safety')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Safety Fundamentals\nHazard Identification')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Safety')).toBeInTheDocument()
    
    // Verify difficulty slider is set to 3
    const difficultySlider = screen.getByDisplayValue('3')
    expect(difficultySlider).toBeInTheDocument()
  })

  test('should handle multiple initialData updates correctly', async () => {
    const initialData: CourseSeedData = {
      courseTitle: 'First Course',
      customTopics: ['Topic 1'],
      difficulty: 2,
      template: 'None',
      templateTopics: []
    }

    const updatedData: CourseSeedData = {
      courseTitle: 'Updated Course',
      customTopics: ['Topic 1', 'Topic 2'],
      difficulty: 4,
      template: 'Safety',
      templateTopics: []
    }

    // First render with initial data
    const { rerender } = render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={initialData}
      />
    )

    // Verify initial data is displayed
    await waitFor(() => {
      expect(screen.getByDisplayValue('First Course')).toBeInTheDocument()
    })

    // Update with new data
    rerender(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={updatedData}
      />
    )

    // BUG: This should fail because component doesn't react to initialData changes
    await waitFor(() => {
      expect(screen.getByDisplayValue('Updated Course')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Topic 1\nTopic 2')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Safety')).toBeInTheDocument()
      expect(screen.getByDisplayValue('4')).toBeInTheDocument()
    })
  })

  test('should not trigger unsaved changes warning for loaded data', async () => {
    const testData: CourseSeedData = {
      courseTitle: 'Test Course',
      customTopics: ['Topic 1'],
      difficulty: 3,
      template: 'None',
      templateTopics: []
    }

    render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={testData}
      />
    )

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Course')).toBeInTheDocument()
    })

    // The form should not be marked as having unsaved changes just because data was loaded
    // This is more of an integration test with the UnsavedChangesContext
    // The specific assertion would depend on how unsaved changes are visually indicated
  })
})