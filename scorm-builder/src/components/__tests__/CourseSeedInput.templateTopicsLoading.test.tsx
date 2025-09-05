import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { CourseSeedInput } from '../CourseSeedInput'
import { PersistentStorageProvider } from '../../contexts/PersistentStorageContext'
import { UnsavedChangesProvider } from '../../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../../contexts/NotificationContext'
import { StepNavigationProvider } from '../../contexts/StepNavigationContext'
import { MockFileStorage } from '../../services/MockFileStorage'
import { CourseSeedData } from '../../types/course'

const TestWrapper: React.FC<{ children: React.ReactNode; storage: MockFileStorage }> = ({ children, storage }) => (
  <NotificationProvider>
    <PersistentStorageProvider storage={storage}>
      <UnsavedChangesProvider>
        <StepNavigationProvider>
          {children}
        </StepNavigationProvider>
      </UnsavedChangesProvider>
    </PersistentStorageProvider>
  </NotificationProvider>
)

describe('CourseSeedInput - Template and Topics Loading', () => {
  let mockStorage: MockFileStorage
  
  beforeEach(async () => {
    vi.clearAllMocks()
    mockStorage = new MockFileStorage()
    await mockStorage.initialize()
    await mockStorage.createProject('Test Project')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should reproduce template and topics not loading from saved project', async () => {
    // Simulate saved project data with template and topics
    const savedData: CourseSeedData = {
      courseTitle: 'Natural Gas Safety',
      difficulty: 3,
      template: 'Safety',
      customTopics: [
        'Introduction to workplace safety',
        'Hazard identification techniques',
        'Personal protective equipment',
        'Emergency response procedures',
        'Incident reporting protocols'
      ],
      templateTopics: []
    }

    // First render - without initialData (simulating component mount before data loads)
    const { rerender } = render(
      <TestWrapper storage={mockStorage}>
        <CourseSeedInput
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />
      </TestWrapper>
    )

    // Verify initial state shows defaults
    await waitFor(() => {
      expect(screen.getByDisplayValue('Choose a template...')).toBeInTheDocument()
    })

    expect(screen.getByTestId('topics-textarea')).toHaveValue('')

    // Second render - with initialData (simulating data loading after component mount)
    rerender(
      <TestWrapper storage={mockStorage}>
        <CourseSeedInput
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          initialData={savedData}
        />
      </TestWrapper>
    )

    // The issue: Template and topics should load from initialData but they don't
    // This test should FAIL initially, demonstrating the race condition
    await waitFor(() => {
      expect(screen.getByDisplayValue('Safety')).toBeInTheDocument()
    }, { timeout: 5000 })

    await waitFor(() => {
      const topicsTextarea = screen.getByTestId('topics-textarea') as HTMLTextAreaElement
      expect(topicsTextarea.value).toContain('Introduction to workplace safety')
      expect(topicsTextarea.value).toContain('Hazard identification techniques')
      expect(topicsTextarea.value).toContain('Personal protective equipment')
      expect(topicsTextarea.value).toContain('Emergency response procedures')
      expect(topicsTextarea.value).toContain('Incident reporting protocols')
    }, { timeout: 5000 })
  })

  it('should handle race condition when component mounts before initialData is available', async () => {
    const savedData: CourseSeedData = {
      courseTitle: 'Test Course',
      difficulty: 4,
      template: 'Corporate',
      customTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
      templateTopics: []
    }

    // Simulate the real-world scenario: component mounts, then initialData arrives
    const { rerender } = render(
      <TestWrapper storage={mockStorage}>
        <CourseSeedInput
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          // No initialData initially
        />
      </TestWrapper>
    )

    // Wait a bit (simulating loading time)
    await new Promise(resolve => setTimeout(resolve, 100))

    // Now provide the initialData (simulating async data loading)
    rerender(
      <TestWrapper storage={mockStorage}>
        <CourseSeedInput
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          initialData={savedData}
        />
      </TestWrapper>
    )

    // Verify that the component properly syncs with the late-arriving initialData
    await waitFor(() => {
      expect(screen.getByDisplayValue('Corporate')).toBeInTheDocument()
    })

    await waitFor(() => {
      const topicsTextarea = screen.getByTestId('topics-textarea') as HTMLTextAreaElement
      expect(topicsTextarea.value).toBe('Topic 1\nTopic 2\nTopic 3')
    })

    // Verify other fields are also synced
    expect(screen.getByDisplayValue('Test Course')).toBeInTheDocument()
    
    // Check difficulty level (button with aria-pressed="true")
    const hardButton = screen.getByTestId('difficulty-4')
    expect(hardButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('should not override user changes with initialData', async () => {
    const savedData: CourseSeedData = {
      courseTitle: 'Saved Course',
      difficulty: 3,
      template: 'Technical',
      customTopics: ['Saved topic 1', 'Saved topic 2'],
      templateTopics: []
    }

    // Start with empty component
    const { rerender } = render(
      <TestWrapper storage={mockStorage}>
        <CourseSeedInput
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />
      </TestWrapper>
    )

    // User makes changes before initialData arrives
    const titleInput = screen.getByTestId('course-title-input')
    fireEvent.change(titleInput, { target: { value: 'User Modified Title' } })

    const topicsTextarea = screen.getByTestId('topics-textarea')
    fireEvent.change(topicsTextarea, { target: { value: 'User added topic\nAnother user topic' } })

    // Wait for changes to be processed
    await waitFor(() => {
      expect(screen.getByDisplayValue('User Modified Title')).toBeInTheDocument()
    })

    // Now initialData arrives (should NOT override user changes)
    rerender(
      <TestWrapper storage={mockStorage}>
        <CourseSeedInput
          onSubmit={vi.fn()}
          onBack={vi.fn()}
          initialData={savedData}
        />
      </TestWrapper>
    )

    // Wait for component to process the initialData
    await waitFor(() => {
      const allTopicsTextareas = screen.getAllByTestId('topics-textarea') as HTMLTextAreaElement[]
      
      // After fix: there should only be one textarea with user data preserved
      expect(allTopicsTextareas.length).toBe(1)
      expect(allTopicsTextareas[0].value).toBe('User added topic\nAnother user topic')
      
      // User title should also be preserved
      expect(screen.getByDisplayValue('User Modified Title')).toBeInTheDocument()
    })
  })
})