import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JSONImportValidator } from './JSONImportValidator'
import { StepNavigationProvider, useStepNavigation } from '../contexts/StepNavigationContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'

// Test component to access navigation context
const NavigationTester = () => {
  const navigation = useStepNavigation()
  return (
    <div>
      <div data-testid="visited-steps">{JSON.stringify(navigation.visitedSteps)}</div>
      <div data-testid="can-navigate-4">{navigation.canNavigateToStep(4).toString()}</div>
      <div data-testid="can-navigate-5">{navigation.canNavigateToStep(5).toString()}</div>
      <div data-testid="can-navigate-6">{navigation.canNavigateToStep(6).toString()}</div>
    </div>
  )
}

describe('JSONImportValidator - Step Navigation Unlocking', () => {
  const validJSON = {
    welcomePage: {
      title: 'Welcome',
      narration: 'Welcome text'
    },
    learningObjectivesPage: {
      title: 'Objectives',
      narration: 'Objectives text'
    },
    topics: [
      {
        title: 'Topic 1',
        narration: 'Topic 1 text'
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should unlock all subsequent steps (3-6) after successful JSON validation', async () => {
    const mockOnNext = vi.fn()
    
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider initialStep={2}>
          <JSONImportValidator
            onNext={mockOnNext}
            onBack={vi.fn()}
            onSettingsClick={vi.fn()}
            onHelp={vi.fn()}
            onSave={vi.fn()}
            onOpen={vi.fn()}
          />
          <NavigationTester />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Initially, steps 3-6 should be locked
    expect(screen.getByTestId('can-navigate-4')).toHaveTextContent('false')
    expect(screen.getByTestId('can-navigate-5')).toHaveTextContent('false')
    expect(screen.getByTestId('can-navigate-6')).toHaveTextContent('false')

    // Find and fill the JSON textarea
    const jsonTextarea = screen.getByPlaceholderText(/paste.*json/i)
    fireEvent.change(jsonTextarea, { target: { value: JSON.stringify(validJSON) } })

    // Click validate button
    const validateButton = screen.getByRole('button', { name: /validate/i })
    fireEvent.click(validateButton)

    // Wait for validation to complete
    await waitFor(() => {
      expect(screen.getByText(/validation successful/i)).toBeInTheDocument()
    })

    // Click the Next button to proceed
    const nextButton = screen.getByRole('button', { name: /next/i })
    fireEvent.click(nextButton)

    // After successful validation and proceeding, all steps should be unlocked
    await waitFor(() => {
      expect(screen.getByTestId('can-navigate-4')).toHaveTextContent('true')
      expect(screen.getByTestId('can-navigate-5')).toHaveTextContent('true')
      expect(screen.getByTestId('can-navigate-6')).toHaveTextContent('true')
    })

    // Visited steps should include 3-6
    const visitedSteps = JSON.parse(screen.getByTestId('visited-steps').textContent!)
    expect(visitedSteps).toContain(3) // Media
    expect(visitedSteps).toContain(4) // Audio
    expect(visitedSteps).toContain(5) // Activities
    expect(visitedSteps).toContain(6) // SCORM
  })

  it('should keep steps unlocked after page reload if JSON was validated', async () => {
    // This tests persistence of unlocked steps
    const mockStorage = {
      getContent: vi.fn().mockResolvedValue({ steps: [0, 1, 2, 3, 4, 5, 6] }),
      saveContent: vi.fn().mockResolvedValue(undefined)
    }

    render(
      <PersistentStorageProvider initialStorage={mockStorage}>
        <StepNavigationProvider initialStep={2}>
          <NavigationTester />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // After loading saved visited steps, all should be unlocked
    await waitFor(() => {
      expect(screen.getByTestId('can-navigate-4')).toHaveTextContent('true')
      expect(screen.getByTestId('can-navigate-5')).toHaveTextContent('true')
      expect(screen.getByTestId('can-navigate-6')).toHaveTextContent('true')
    })
  })

  it('should NOT unlock steps if JSON validation fails', async () => {
    render(
      <PersistentStorageProvider>
        <StepNavigationProvider initialStep={2}>
          <JSONImportValidator
            onNext={vi.fn()}
            onBack={vi.fn()}
            onSettingsClick={vi.fn()}
            onHelp={vi.fn()}
            onSave={vi.fn()}
            onOpen={vi.fn()}
          />
          <NavigationTester />
        </StepNavigationProvider>
      </PersistentStorageProvider>
    )

    // Submit invalid JSON
    const jsonTextarea = screen.getByPlaceholderText(/paste.*json/i)
    fireEvent.change(jsonTextarea, { target: { value: '{ invalid json' } })

    const validateButton = screen.getByRole('button', { name: /validate/i })
    fireEvent.click(validateButton)

    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })

    // Steps should remain locked
    expect(screen.getByTestId('can-navigate-4')).toHaveTextContent('false')
    expect(screen.getByTestId('can-navigate-5')).toHaveTextContent('false')
    expect(screen.getByTestId('can-navigate-6')).toHaveTextContent('false')
  })
})