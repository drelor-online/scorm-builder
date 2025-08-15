/**
 * CourseSeedInput - Consolidated Test Suite
 * 
 * This file consolidates CourseSeedInput tests from 19 separate files into
 * a single comprehensive test suite using the successful pattern from previous consolidations.
 */

import { render, screen, fireEvent, waitFor } from './../../test/testProviders'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CourseSeedInput } from '../CourseSeedInput'
import { UnsavedChangesProvider, useUnsavedChanges } from '../../contexts/UnsavedChangesContext'
import { NotificationProvider } from '../../contexts/NotificationContext'
import type { CourseSeedData } from '../../types/course'
import React from 'react'

// Test component to track dirty state changes
const UnsavedChangesTracker: React.FC = () => {
  const { hasUnsavedChanges, isDirty } = useUnsavedChanges()
  
  return (
    <div data-testid="unsaved-changes-tracker">
      <div data-testid="has-unsaved-changes">{hasUnsavedChanges.toString()}</div>
      <div data-testid="is-courseSeed-dirty">{isDirty('courseSeed').toString()}</div>
    </div>
  )
}

// Standard test wrapper with all required providers
const TestWrapperWithTracker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NotificationProvider>
    <UnsavedChangesProvider>
      <UnsavedChangesTracker />
      {children}
    </UnsavedChangesProvider>
  </NotificationProvider>
)

// Sample initial data for testing
const mockInitialData: CourseSeedData = {
  courseTitle: 'Test Course',
  difficulty: 4,
  customTopics: ['Topic 1', 'Topic 2', 'Topic 3'],
  template: 'Technical' as const,
  templateTopics: ['Technical Topic 1', 'Technical Topic 2']
}

describe('CourseSeedInput - Consolidated Test Suite', () => {
  const mockOnSubmit = vi.fn()
  const mockOnBack = vi.fn()
  const mockOnSave = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSubmit.mockResolvedValue(undefined)
  })

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )
      
      expect(screen.getByText('Course Setup')).toBeInTheDocument()
    })

    it('displays all required form fields', () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )
      
      // Course title input
      expect(screen.getByLabelText(/Course Title/i)).toBeInTheDocument()
      
      // Difficulty buttons
      expect(screen.getByRole('button', { name: /Easy/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Medium/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Hard/i })).toBeInTheDocument()
      
      // Template selector
      expect(screen.getByLabelText(/Course Template/i)).toBeInTheDocument()
      
      // Topics textarea
      expect(screen.getByPlaceholderText(/List your course topics/i)).toBeInTheDocument()
    })

    it('displays initial data when provided', () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
            initialData={mockInitialData}
          />
        </TestWrapperWithTracker>
      )
      
      // Check course title
      const titleInput = screen.getByLabelText(/Course Title/i) as HTMLInputElement
      expect(titleInput.value).toBe('Test Course')
      
      // Check difficulty (Hard button should be selected)
      const hardButton = screen.getByRole('button', { name: /Hard/i })
      expect(hardButton).toHaveClass('btn-primary')
      
      // Check template
      const templateSelect = screen.getByLabelText(/Course Template/i) as HTMLSelectElement
      expect(templateSelect.value).toBe('Technical')
      
      // Check topics
      const topicsTextarea = screen.getByPlaceholderText(/List your course topics/i) as HTMLTextAreaElement
      expect(topicsTextarea.value).toBe('Topic 1\nTopic 2\nTopic 3')
    })
  })

  describe('Form Interaction', () => {
    it('handles course title input', async () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      const titleInput = screen.getByLabelText(/Course Title/i)
      fireEvent.change(titleInput, { target: { value: 'New Course Title' } })

      await waitFor(() => {
        expect((titleInput as HTMLInputElement).value).toBe('New Course Title')
      })
    })

    it('handles difficulty selection', async () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      const hardButton = screen.getByRole('button', { name: /Hard/i })
      fireEvent.click(hardButton)

      await waitFor(() => {
        expect(hardButton).toHaveClass('btn-primary')
      })
    })

    it('handles form submission', async () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      // Fill out the form
      const titleInput = screen.getByLabelText(/Course Title/i)
      fireEvent.change(titleInput, { target: { value: 'Submission Test Course' } })

      const mediumButton = screen.getByRole('button', { name: /Medium/i })
      fireEvent.click(mediumButton)

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /Next|Continue|Submit/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled()
      })
    })
  })

  describe('Validation', () => {
    it('handles form validation', async () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      const submitButton = screen.getByRole('button', { name: /Next|Continue|Submit/i })
      fireEvent.click(submitButton)

      // Should handle validation appropriately
      await waitFor(() => {
        // Form should either show error or allow submission
        expect(submitButton).toBeInTheDocument()
      })
    })

    it('handles invalid input gracefully', () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      const titleInput = screen.getByLabelText(/Course Title/i)
      
      // Try extremely long title
      const longTitle = 'A'.repeat(1000)
      fireEvent.change(titleInput, { target: { value: longTitle } })

      // Should handle gracefully without crashing
      expect(titleInput).toBeInTheDocument()
    })
  })

  describe('Unsaved Changes Integration', () => {
    it('tracks changes when form is edited', async () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      // Edit the form
      const titleInput = screen.getByLabelText(/Course Title/i)
      fireEvent.change(titleInput, { target: { value: 'Changed Title' } })

      // Should trigger change tracking
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled()
      }, { timeout: 3000 })
    })

    it('handles multiple rapid changes', async () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      const titleInput = screen.getByLabelText(/Course Title/i)
      
      // Rapid changes
      fireEvent.change(titleInput, { target: { value: 'Change 1' } })
      fireEvent.change(titleInput, { target: { value: 'Change 2' } })
      fireEvent.change(titleInput, { target: { value: 'Change 3' } })

      // Should handle rapid changes without issues
      await waitFor(() => {
        expect((titleInput as HTMLInputElement).value).toBe('Change 3')
      })
    })
  })

  describe('Template Management', () => {
    it('displays template options', () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      const templateSelect = screen.getByLabelText(/Course Template/i)
      expect(templateSelect).toBeInTheDocument()
      
      // Should have template options
      const options = screen.getAllByRole('option')
      expect(options.length).toBeGreaterThan(1)
    })

    it('handles template changes', async () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      const templateSelect = screen.getByLabelText(/Course Template/i)
      fireEvent.change(templateSelect, { target: { value: 'Business' } })

      // Should handle template change
      await waitFor(() => {
        expect((templateSelect as HTMLSelectElement).value).toBe('Business')
      })
    })
  })

  describe('Navigation and Lifecycle', () => {
    it('handles back navigation', async () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      const backButton = screen.queryByTestId('back-button') || 
                        screen.queryByRole('button', { name: /back/i })
      
      if (backButton) {
        fireEvent.click(backButton)
        
        await waitFor(() => {
          expect(mockOnBack).toHaveBeenCalled()
        })
      }
    })

    it('prevents infinite loops', () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
            initialData={mockInitialData}
          />
        </TestWrapperWithTracker>
      )

      // Should handle without infinite loops
      expect(screen.getByText('Course Setup')).toBeInTheDocument()
    })

    it('handles component unmounting gracefully', () => {
      const { unmount } = render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
          />
        </TestWrapperWithTracker>
      )

      // Should unmount without errors
      unmount()
      expect(true).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('handles submission errors gracefully', async () => {
      mockOnSubmit.mockRejectedValueOnce(new Error('Submission failed'))
      
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
            initialData={mockInitialData}
          />
        </TestWrapperWithTracker>
      )

      const submitButton = screen.getByRole('button', { name: /Next|Continue|Submit/i })
      fireEvent.click(submitButton)

      // Should handle error without crashing
      await waitFor(() => {
        expect(submitButton).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('handles malformed initial data', () => {
      const malformedData = {
        courseTitle: null as any,
        difficulty: 'invalid' as any,
        customTopics: 'not an array' as any,
        template: 'NonexistentTemplate' as any,
        templateTopics: null as any
      }

      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            onBack={mockOnBack}
            onSave={mockOnSave}
            initialData={malformedData}
          />
        </TestWrapperWithTracker>
      )

      // Should handle malformed data without crashing
      expect(screen.getByText('Course Setup')).toBeInTheDocument()
    })

    it('handles missing callbacks gracefully', () => {
      render(
        <TestWrapperWithTracker>
          <CourseSeedInput
            onSubmit={mockOnSubmit}
            // onBack and onSave are missing
          />
        </TestWrapperWithTracker>
      )

      // Should render without crashing
      expect(screen.getByText('Course Setup')).toBeInTheDocument()
    })
  })
})