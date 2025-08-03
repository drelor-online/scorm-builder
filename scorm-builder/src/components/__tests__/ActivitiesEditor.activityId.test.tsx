import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../test/testProviders'
import React from 'react'
import { ActivitiesEditor } from '../ActivitiesEditor'
import { generateActivityId } from '../../utils/idGenerator'

// Mock the idGenerator module
vi.mock('../../utils/idGenerator', () => ({
  generateActivityId: vi.fn(() => 'activity_550e8400-e29b-41d4-a716-446655440000')
}))

// Mock PersistentStorageContext
vi.mock('../../contexts/PersistentStorageContext', () => ({
  useStorage: () => ({
    storage: {
      saveCourseMetadata: vi.fn().mockResolvedValue(undefined),
      getCourseMetadata: vi.fn().mockResolvedValue(null),
      getContent: vi.fn().mockResolvedValue(null),
      saveContent: vi.fn().mockResolvedValue(undefined)
    }
  })
}))

// Mock StepNavigationContext
vi.mock('../../contexts/StepNavigationContext', () => ({
  useStepNavigation: () => ({
    currentStepIndex: 4,
    steps: [],
    progress: { completed: 3, total: 6 }
  })
}))

const mockGenerateActivityId = vi.mocked(generateActivityId)

describe('ActivitiesEditor - Activity ID Generation', () => {
  const mockOnNext = vi.fn()
  const mockOnBack = vi.fn()
  
  const legacyCourseContent = {
    topics: [],
    activities: [],
    quiz: {
      questions: [],
      passMark: 80
    }
  }
  
  beforeEach(() => {
    vi.clearAllMocks()
  })
  
  it('should use generateActivityId when adding a new activity', () => {
    render(
      <ActivitiesEditor
        courseContent={legacyCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )
    
    // Find and click the add activity button
    const addButton = screen.getByText('Add Activity')
    fireEvent.click(addButton)
    
    // Verify generateActivityId was called
    expect(mockGenerateActivityId).toHaveBeenCalled()
    
    // Verify the activity was added with the generated ID
    // Check that the Next button is enabled (activities exist)
    const nextButton = screen.getByText('Next →')
    expect(nextButton).not.toBeDisabled()
  })
  
  it('should use UUID-based activity IDs', () => {
    // Reset mock to return different IDs
    mockGenerateActivityId
      .mockReturnValueOnce('activity_11111111-1111-1111-1111-111111111111' as any)
      .mockReturnValueOnce('activity_22222222-2222-2222-2222-222222222222' as any)
    
    render(
      <ActivitiesEditor
        courseContent={legacyCourseContent}
        onNext={mockOnNext}
        onBack={mockOnBack}
      />
    )
    
    // Add multiple activities
    const addButton = screen.getByText('Add Activity')
    fireEvent.click(addButton)
    fireEvent.click(addButton)
    
    // Verify generateActivityId was called twice
    expect(mockGenerateActivityId).toHaveBeenCalledTimes(2)
    
    // Both activities should be present
    const activities = screen.getAllByText('New Activity')
    expect(activities).toHaveLength(2)
  })
})