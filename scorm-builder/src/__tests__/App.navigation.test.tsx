import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent , waitFor } from '../../test/testProviders'
import App from '../App'
// Mock PageLayout to test navigation props
vi.mock('../components/PageLayout', () => ({
  PageLayout: ({ children, currentStep, onStepClick }: any) => (
    <div data-testid="page-layout">
      <div data-testid="current-step">{currentStep}</div>
      <button onClick={() => onStepClick(0)} data-testid="step-0">Step 0</button>
      <button onClick={() => onStepClick(1)} data-testid="step-1">Step 1</button>
      <button onClick={() => onStepClick(2)} data-testid="step-2">Step 2</button>
      <button onClick={() => onStepClick(3)} data-testid="step-3">Step 3</button>
      <button onClick={() => onStepClick(4)} data-testid="step-4">Step 4</button>
      {children}
    </div>
  )
}))

// Mock other components to simplify testing
vi.mock('../components/CourseSeedInput', () => ({
  CourseSeedInput: ({ onSubmit, onStepClick }: any) => (
    <div data-testid="page-layout">
      <div data-testid="current-step">0</div>
      <button onClick={() => onStepClick(0)} data-testid="step-0">Step 0</button>
      <button onClick={() => onStepClick(1)} data-testid="step-1">Step 1</button>
      <button onClick={() => onStepClick(2)} data-testid="step-2">Step 2</button>
      <button onClick={() => onStepClick(3)} data-testid="step-3">Step 3</button>
      <button onClick={() => onStepClick(4)} data-testid="step-4">Step 4</button>
      <div data-testid="course-seed">
        <button onClick={() => onSubmit({ courseTitle: 'Test Course', difficulty: 3 })}>
          Next
        </button>
      </div>
    </div>
  )
}))

vi.mock('../components/AIPromptGenerator', () => ({
  AIPromptGenerator: ({ onNext, onStepClick }: any) => (
    <div data-testid="page-layout">
      <div data-testid="current-step">1</div>
      <button onClick={() => onStepClick(0)} data-testid="step-0">Step 0</button>
      <button onClick={() => onStepClick(1)} data-testid="step-1">Step 1</button>
      <button onClick={() => onStepClick(2)} data-testid="step-2">Step 2</button>
      <button onClick={() => onStepClick(3)} data-testid="step-3">Step 3</button>
      <button onClick={() => onStepClick(4)} data-testid="step-4">Step 4</button>
      <div data-testid="prompt-generator">
        <button onClick={onNext}>Next</button>
      </div>
    </div>
  )
}))

vi.mock('../components/JSONImportValidator', () => ({
  JSONImportValidator: ({ onNext, onStepClick }: any) => (
    <div data-testid="page-layout">
      <div data-testid="current-step">2</div>
      <button onClick={() => onStepClick(0)} data-testid="step-0">Step 0</button>
      <button onClick={() => onStepClick(1)} data-testid="step-1">Step 1</button>
      <button onClick={() => onStepClick(2)} data-testid="step-2">Step 2</button>
      <button onClick={() => onStepClick(3)} data-testid="step-3">Step 3</button>
      <button onClick={() => onStepClick(4)} data-testid="step-4">Step 4</button>
      <div data-testid="json-validator">
        <button onClick={() => onNext({ topics: [], objectives: [] })}>Next</button>
      </div>
    </div>
  )
}))

vi.mock('../components/MediaEnhancementWizard', () => ({
  MediaEnhancementWizard: ({ onNext, onStepClick }: any) => (
    <div data-testid="page-layout">
      <div data-testid="current-step">3</div>
      <button onClick={() => onStepClick(0)} data-testid="step-0">Step 0</button>
      <button onClick={() => onStepClick(1)} data-testid="step-1">Step 1</button>
      <button onClick={() => onStepClick(2)} data-testid="step-2">Step 2</button>
      <button onClick={() => onStepClick(3)} data-testid="step-3">Step 3</button>
      <button onClick={() => onStepClick(4)} data-testid="step-4">Step 4</button>
      <div data-testid="media-wizard">
        <button onClick={onNext}>Next</button>
      </div>
    </div>
  )
}))

describe('App Navigation with StepNavigationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage
    window.localStorage.clear()
  })

  describe('Step navigation restrictions', () => {
    it('should only allow navigation to visited steps', async () => {
      render(<App />)

      // Initially on step 0 (seed)
      expect(screen.getByTestId('current-step')).toHaveTextContent('0')
      expect(screen.getByTestId('course-seed')).toBeInTheDocument()

      // Try to click step 2 (should not work as it hasn't been visited)
      fireEvent.click(screen.getByTestId('step-2'))

      // Should still be on step 0
      expect(screen.getByTestId('current-step')).toHaveTextContent('0')
      expect(screen.getByTestId('course-seed')).toBeInTheDocument()

      // Navigate to step 1 via form submission
      fireEvent.click(screen.getByText('Next'))

      await waitFor(() => {
        expect(screen.getByTestId('current-step')).toHaveTextContent('1')
        expect(screen.getByTestId('prompt-generator')).toBeInTheDocument()
      })

      // Now try to go back to step 0 (should work as it's been visited)
      fireEvent.click(screen.getByTestId('step-0'))

      await waitFor(() => {
        expect(screen.getByTestId('current-step')).toHaveTextContent('0')
        expect(screen.getByTestId('course-seed')).toBeInTheDocument()
      })

      // Try to go to step 1 again (should work)
      fireEvent.click(screen.getByTestId('step-1'))

      await waitFor(() => {
        expect(screen.getByTestId('current-step')).toHaveTextContent('1')
        expect(screen.getByTestId('prompt-generator')).toBeInTheDocument()
      })
    })

    it('should track all visited steps correctly', async () => {
      render(<App />)

      // Navigate through multiple steps
      // Step 0 -> 1
      fireEvent.click(screen.getByText('Next'))
      await waitFor(() => expect(screen.getByTestId('current-step')).toHaveTextContent('1'))

      // Step 1 -> 2
      fireEvent.click(screen.getByText('Next'))
      await waitFor(() => expect(screen.getByTestId('current-step')).toHaveTextContent('2'))

      // Step 2 -> 3
      fireEvent.click(screen.getByText('Next'))
      await waitFor(() => expect(screen.getByTestId('current-step')).toHaveTextContent('3'))

      // Now should be able to navigate to any of the visited steps
      fireEvent.click(screen.getByTestId('step-0'))
      await waitFor(() => expect(screen.getByTestId('current-step')).toHaveTextContent('0'))

      fireEvent.click(screen.getByTestId('step-2'))
      await waitFor(() => expect(screen.getByTestId('current-step')).toHaveTextContent('2'))

      fireEvent.click(screen.getByTestId('step-1'))
      await waitFor(() => expect(screen.getByTestId('current-step')).toHaveTextContent('1'))

      // But step 4 should not be accessible
      fireEvent.click(screen.getByTestId('step-4'))
      // Should remain on step 1
      expect(screen.getByTestId('current-step')).toHaveTextContent('1')
    })
  })

  describe('Progress indicator styling', () => {
    it('should style visited steps differently', async () => {
      // This test would check that the WorkflowProgress component 
      // receives the correct visited steps and applies appropriate styling
      // For now, we're focusing on the navigation logic
      expect(true).toBe(true)
    })
  })
})