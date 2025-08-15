import React from 'react'
import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import { CourseSeedInput } from '../CourseSeedInput'
import { CourseSeedData } from '../../types/course'

describe('CourseSeedInput - Template Button Visibility', () => {
  const mockOnSubmit = vi.fn().mockResolvedValue(void 0)
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should show Add Template Topics button when template is selected', async () => {
    // Start with no initial data
    render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={undefined}
      />
    )

    // Initially, no button should be visible (template is 'None')
    expect(screen.queryByTestId('add-template-topics')).not.toBeInTheDocument()

    // Select a template
    const templateSelect = screen.getByTestId('template-select')
    fireEvent.change(templateSelect, { target: { value: 'Safety' } })

    // BUG: The button should appear after selecting a template, but it doesn't
    // due to the useEffect resetting the template back to 'None'
    await waitFor(() => {
      expect(screen.getByTestId('add-template-topics')).toBeInTheDocument()
    })

    // Verify the button text is correct
    expect(screen.getByTestId('add-template-topics')).toHaveTextContent('+ Add Template Topics')
  })

  test('should persist template selection after component re-renders', async () => {
    const testInitialData: CourseSeedData = {
      courseTitle: 'Test Course',
      customTopics: [],
      difficulty: 3,
      template: 'None',
      templateTopics: []
    }

    const { rerender } = render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={testInitialData}
      />
    )

    // Select a template
    const templateSelect = screen.getByTestId('template-select')
    fireEvent.change(templateSelect, { target: { value: 'Technical' } })

    // Button should appear
    await waitFor(() => {
      expect(screen.getByTestId('add-template-topics')).toBeInTheDocument()
    })

    // Force a re-render with same initialData
    rerender(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={testInitialData}
      />
    )

    // BUG: The template selection should persist, but it gets reset by useEffect
    await waitFor(() => {
      expect(templateSelect).toHaveValue('Technical')
      expect(screen.getByTestId('add-template-topics')).toBeInTheDocument()
    })
  })

  test('should not show button when template is None', async () => {
    render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={undefined}
      />
    )

    // Template should default to 'None'
    const templateSelect = screen.getByTestId('template-select')
    expect(templateSelect).toHaveValue('None')

    // No button should be visible
    expect(screen.queryByTestId('add-template-topics')).not.toBeInTheDocument()

    // Select a template, then select 'None' again
    fireEvent.change(templateSelect, { target: { value: 'Corporate' } })
    
    // Button should appear briefly
    await waitFor(() => {
      expect(screen.getByTestId('add-template-topics')).toBeInTheDocument()
    })

    // Select 'None' again
    fireEvent.change(templateSelect, { target: { value: 'None' } })

    // Button should disappear
    await waitFor(() => {
      expect(screen.queryByTestId('add-template-topics')).not.toBeInTheDocument()
    })
  })

  test('should handle template selection with loaded project data', async () => {
    const loadedProjectData: CourseSeedData = {
      courseTitle: 'Loaded Project',
      customTopics: ['Topic 1', 'Topic 2'],
      difficulty: 4,
      template: 'Safety', // Project was saved with Safety template
      templateTopics: []
    }

    render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        onSave={mockOnSave}
        initialData={loadedProjectData}
      />
    )

    // Should load with Safety template and show button
    await waitFor(() => {
      const templateSelect = screen.getByTestId('template-select')
      expect(templateSelect).toHaveValue('Safety')
      expect(screen.getByTestId('add-template-topics')).toBeInTheDocument()
    })

    // Should be able to change to a different template
    const templateSelect = screen.getByTestId('template-select')
    fireEvent.change(templateSelect, { target: { value: 'Technical' } })

    // Should update and keep the button visible
    await waitFor(() => {
      expect(templateSelect).toHaveValue('Technical')
      expect(screen.getByTestId('add-template-topics')).toBeInTheDocument()
    })
  })
})