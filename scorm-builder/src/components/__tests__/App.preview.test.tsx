import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from './../../test/testProviders'
import '@testing-library/jest-dom'
import App from '../../App'
import React from 'react'

// Mock PersistentStorageContext
vi.mock('../../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: any) => children,
  useStorage: () => ({
    isInitialized: true,
    currentProjectId: 'test-project',
    getCourseMetadata: vi.fn().mockResolvedValue({
      title: 'Test Course',
      topics: ['topic-1']
    }),
    getContent: vi.fn().mockResolvedValue({
      topicId: 'topic-1',
      title: 'Test Topic',
      content: 'Test content'
    }),
    getMedia: vi.fn().mockResolvedValue(null),
    getMediaForTopic: vi.fn().mockResolvedValue([])
  })
}))

// Mock RealTimePreview
vi.mock('../RealTimePreview', () => ({
  RealTimePreview: () => <div data-testid="real-time-preview">Real Time Preview</div>
}))

// Mock CoursePreview to avoid circular dependencies
vi.mock('../CoursePreview', () => ({
  CoursePreview: () => {
    const [isOpen, setIsOpen] = React.useState(false)
    return (
      <>
        <button onClick={() => setIsOpen(true)}>Preview Course</button>
        {isOpen && (
          <div data-testid="course-preview-modal">
            <div data-testid="real-time-preview">Real Time Preview</div>
          </div>
        )}
      </>
    )
  }
}))

// Mock other components
vi.mock('../CourseSeedInput', () => ({
  CourseSeedInput: ({ onSubmit }: any) => (
    <div>
      <button onClick={() => onSubmit({ courseTitle: 'Test', difficulty: 1, customTopics: [], template: 'None', templateTopics: [] })}>
        Next
      </button>
    </div>
  )
}))

vi.mock('../AIPromptGenerator', () => ({
  AIPromptGenerator: ({ onNext }: any) => (
    <div>
      <button onClick={() => onNext({ title: 'Test Course', topics: [], welcomePage: { title: 'Welcome', content: 'Welcome content' }, objectives: [] })}>
        Generate
      </button>
    </div>
  )
}))

vi.mock('../JSONImportValidator', () => ({
  JSONImportValidator: ({ onNext, initialData }: any) => {
    const { CoursePreview } = require('../CoursePreview')
    
    // Simulate having valid course content
    const courseContent = initialData || {
      title: 'Test Course',
      welcomePage: { title: 'Welcome', content: 'Welcome content' },
      objectives: ['Objective 1'],
      topics: [{
        id: 'topic-1',
        title: 'Topic 1',
        content: 'Topic content'
      ,
        duration: 5
      }]
    }
    
    return (
      <div>
        JSON Import Validator
        <CoursePreview 
          courseContent={courseContent}
          courseSeedData={{
            courseTitle: 'Test Course',
            difficulty: 3,
            customTopics: [],
            template: 'None',
            templateTopics: []
          }}
        />
        <button onClick={() => onNext(courseContent)}>Next</button>
      </div>
    )
  }
}))

describe('App - Preview Integration Tests', () => {
  it('should show preview button after JSON step', async () => {
    // Intent: Preview becomes available once we have course content
    render(<App />)
    
    // Navigate to prompt step
    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByText('Generate')).toBeInTheDocument()
    })
    
    // Generate content
    fireEvent.click(screen.getByText('Generate'))
    
    // Should move to JSON step with preview available
    await waitFor(() => {
      expect(screen.getByText('JSON Import Validator')).toBeInTheDocument()
      expect(screen.getByText('Preview Course')).toBeInTheDocument()
    })
  })
  
  it('should open preview modal when preview button is clicked', async () => {
    // Intent: Clicking preview button shows the preview
    render(<App />)
    
    // Navigate through steps
    fireEvent.click(screen.getByText('Next'))
    await waitFor(() => screen.getByText('Generate'))
    fireEvent.click(screen.getByText('Generate'))
    
    await waitFor(() => {
      const previewButton = screen.getByText('Preview Course')
      fireEvent.click(previewButton)
    })
    
    // Check that preview modal opens
    await waitFor(() => {
      expect(screen.getByTestId('real-time-preview')).toBeInTheDocument()
    })
  })
  
  it('should update preview when content changes', async () => {
    // Intent: Preview reflects current state of the course
    render(<App />)
    
    // Navigate to content step
    fireEvent.click(screen.getByText('Next'))
    await waitFor(() => screen.getByText('Generate'))
    fireEvent.click(screen.getByText('Generate'))
    
    // The preview should be available
    await waitFor(() => {
      expect(screen.getByText('Preview Course')).toBeInTheDocument()
    })
    
    // Click on preview
    fireEvent.click(screen.getByText('Preview Course'))
    
    // Preview should show
    await waitFor(() => {
      expect(screen.getByTestId('course-preview-modal')).toBeInTheDocument()
    })
  })
  
  it('should keep preview available across all steps after JSON', async () => {
    // Intent: Once course content exists, preview stays accessible
    render(<App />)
    
    // Navigate to JSON step
    fireEvent.click(screen.getByText('Next'))
    await waitFor(() => screen.getByText('Generate'))
    fireEvent.click(screen.getByText('Generate'))
    
    // Check preview is available
    await waitFor(() => {
      expect(screen.getByText('Preview Course')).toBeInTheDocument()
    })
    
    // Navigate to media step - preview should still be there
    const nextToMedia = screen.getAllByText(/Next/)[0]
    fireEvent.click(nextToMedia)
    
    await waitFor(() => {
      expect(screen.getByText('Preview Course')).toBeInTheDocument()
    })
  })
})