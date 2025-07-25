import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { CourseSeedInput } from '../CourseSeedInputRefactored'
import { CourseSeedData } from '../../types/course'

describe('CourseSeedInput Persistence', () => {
  it('should display initial data when provided', () => {
    const initialData: CourseSeedData = {
      courseTitle: 'Test Course',
      difficulty: 4,
      customTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
      template: 'Technical' as const,
      templateTopics: []
    }
    
    const mockOnSubmit = vi.fn()
    
    render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
        initialData={initialData}
      />
    )
    
    // Check course title
    const titleInput = screen.getByLabelText(/Course Title \*/i) as HTMLInputElement
    expect(titleInput.value).toBe('Test Course')
    
    // Check difficulty (the button group should show "Hard" as selected)
    const hardButton = screen.getByRole('button', { name: 'Set difficulty to Hard' })
    expect(hardButton).toHaveClass('btn-primary')
    
    // Check template
    const templateSelect = screen.getByLabelText(/Course Template/i) as HTMLSelectElement
    expect(templateSelect.value).toBe('Technical')
    
    // Check topics
    const topicsTextarea = screen.getByPlaceholderText(/List your course topics/i) as HTMLTextAreaElement
    expect(topicsTextarea.value).toBe('Topic 1\nTopic 2\nTopic 3')
  })
  
  it('should preserve form data when submitting', () => {
    const mockOnSubmit = vi.fn()
    
    render(
      <CourseSeedInput
        onSubmit={mockOnSubmit}
      />
    )
    
    // Fill in form
    fireEvent.change(screen.getByLabelText(/Course Title \*/i), {
      target: { value: 'My New Course' }
    })
    
    fireEvent.click(screen.getByRole('button', { name: 'Set difficulty to Expert' }))
    
    fireEvent.change(screen.getByLabelText(/Course Template/i), {
      target: { value: 'Safety' }
    })
    
    fireEvent.change(screen.getByPlaceholderText(/List your course topics/i), {
      target: { value: 'Safety Topic 1\nSafety Topic 2' }
    })
    
    // Submit form
    fireEvent.click(screen.getByText('Continue to AI Prompt →'))
    
    // Check that onSubmit was called with correct data
    expect(mockOnSubmit).toHaveBeenCalledWith({
      courseTitle: 'My New Course',
      difficulty: 5,
      customTopics: ['Safety Topic 1', 'Safety Topic 2'],
      template: 'Safety' as const,
      templateTopics: []
    })
  })
})