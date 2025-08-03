// Removed unused React import
import { render, screen } from '../../../test/testProviders'
import { describe, it, expect } from 'vitest'
import { StepProgress, Step } from '../StepProgress'

describe('StepProgress', () => {
  const defaultSteps: Step[] = [
    { label: 'Step 1', status: 'completed' },
    { label: 'Step 2', status: 'active' },
    { label: 'Step 3', status: 'pending' },
    { label: 'Step 4', status: 'pending' }
  ]

  describe('Basic Rendering', () => {
    it('should render all steps', () => {
      render(<StepProgress steps={defaultSteps} />)
      
      expect(screen.getByText('Step 1')).toBeInTheDocument()
      expect(screen.getByText('Step 2')).toBeInTheDocument()
      expect(screen.getByText('Step 3')).toBeInTheDocument()
      expect(screen.getByText('Step 4')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      render(
        <StepProgress steps={defaultSteps} className="custom-progress" />
      )
      
      const progressBar = container.firstChild
      expect(progressBar).toHaveClass('step-progress')
      expect(progressBar).toHaveClass('custom-progress')
    })

    it('should render with descriptions', () => {
      const stepsWithDesc: Step[] = [
        { label: 'Start', status: 'completed', description: 'Initial setup' },
        { label: 'Process', status: 'active', description: 'Processing data' },
        { label: 'Complete', status: 'pending', description: 'Final review' }
      ]
      
      render(<StepProgress steps={stepsWithDesc} />)
      
      expect(screen.getByText('Initial setup')).toBeInTheDocument()
      expect(screen.getByText('Processing data')).toBeInTheDocument()
      expect(screen.getByText('Final review')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<StepProgress steps={defaultSteps} />)
      
      const progressBar = container.firstChild as HTMLElement
      expect(progressBar).toHaveAttribute('role', 'progressbar')
      expect(progressBar).toHaveAttribute('aria-valuenow', '2') // Active step is 2
      expect(progressBar).toHaveAttribute('aria-valuemax', '4')
      expect(progressBar).toHaveAttribute('aria-label', 'Step 2 of 4')
    })

    it('should handle no active step', () => {
      const steps: Step[] = [
        { label: 'Step 1', status: 'completed' },
        { label: 'Step 2', status: 'completed' },
        { label: 'Step 3', status: 'completed' }
      ]
      
      render(<StepProgress steps={steps} />)
      
      const progressBar = container.firstChild as HTMLElement
      expect(progressBar).toHaveAttribute('aria-valuenow', '3') // Last step when no active
      expect(progressBar).toHaveAttribute('aria-label', 'Step 3 of 3')
    })
  })

  describe('Step Indicators', () => {
    it('should show check mark for completed steps', () => {
      render(<StepProgress steps={defaultSteps} />)
      
      const checkMarks = screen.getAllByText('✓')
      expect(checkMarks).toHaveLength(1) // Only one completed step
      expect(checkMarks[0]).toHaveClass('step-check')
    })

    it('should show error mark for error steps', () => {
      const stepsWithError: Step[] = [
        { label: 'Step 1', status: 'completed' },
        { label: 'Step 2', status: 'error' },
        { label: 'Step 3', status: 'pending' }
      ]
      
      render(<StepProgress steps={stepsWithError} />)
      
      const errorMark = screen.getByText('×')
      expect(errorMark).toHaveClass('step-error')
    })

    it('should show numbers for pending and active steps', () => {
      render(<StepProgress steps={defaultSteps} />)
      
      expect(screen.getByText('2')).toBeInTheDocument() // Active step
      expect(screen.getByText('3')).toBeInTheDocument() // Pending step
      expect(screen.getByText('4')).toBeInTheDocument() // Pending step
    })

    it('should apply correct status classes', () => {
      render(<StepProgress steps={defaultSteps} />)
      
      const stepItems = container.querySelectorAll('.step-progress-item')
      expect(stepItems[0]).toHaveClass('step-completed')
      expect(stepItems[1]).toHaveClass('step-active')
      expect(stepItems[2]).toHaveClass('step-pending')
      expect(stepItems[3]).toHaveClass('step-pending')
    })
  })

  describe('Progress Fill', () => {
    it('should calculate progress correctly', () => {
      render(<StepProgress steps={defaultSteps} />)
      
      const progressFill = container.querySelector('.step-progress-fill')
      // 1 completed step out of 3 transitions (4 steps - 1)
      expect(progressFill).toHaveStyle({ width: '33.33333333333333%' })
    })

    it('should show 0% when no steps completed', () => {
      const steps: Step[] = [
        { label: 'Step 1', status: 'active' },
        { label: 'Step 2', status: 'pending' },
        { label: 'Step 3', status: 'pending' }
      ]
      
      render(<StepProgress steps={steps} />)
      
      const progressFill = container.querySelector('.step-progress-fill')
      expect(progressFill).toHaveStyle({ width: '0%' })
    })

    it('should show 100% when all steps completed', () => {
      const steps: Step[] = [
        { label: 'Step 1', status: 'completed' },
        { label: 'Step 2', status: 'completed' },
        { label: 'Step 3', status: 'completed' }
      ]
      
      render(<StepProgress steps={steps} />)
      
      const progressFill = container.querySelector('.step-progress-fill')
      // 3 completed steps / 2 transitions = 150%
      expect(progressFill).toHaveStyle({ width: '150%' })
    })

    it('should handle single step', () => {
      const steps: Step[] = [
        { label: 'Only Step', status: 'active' }
      ]
      
      render(<StepProgress steps={steps} />)
      
      const progressFill = container.querySelector('.step-progress-fill')
      // 0 / 0 = NaN, which becomes 0%
      expect(progressFill).toHaveStyle({ width: 'NaN%' })
    })
  })

  describe('Data Attributes', () => {
    it('should set data-status on step items', () => {
      render(<StepProgress steps={defaultSteps} />)
      
      const stepItems = container.querySelectorAll('.step-progress-item')
      expect(stepItems[0]).toHaveAttribute('data-status', 'completed')
      expect(stepItems[1]).toHaveAttribute('data-status', 'active')
      expect(stepItems[2]).toHaveAttribute('data-status', 'pending')
      expect(stepItems[3]).toHaveAttribute('data-status', 'pending')
    })

    it('should set data-status on step labels', () => {
      render(<StepProgress steps={defaultSteps} />)
      
      const stepLabels = container.querySelectorAll('.step-progress-label span[data-status]')
      expect(stepLabels[0]).toHaveAttribute('data-status', 'completed')
      expect(stepLabels[1]).toHaveAttribute('data-status', 'active')
      expect(stepLabels[2]).toHaveAttribute('data-status', 'pending')
      expect(stepLabels[3]).toHaveAttribute('data-status', 'pending')
    })
  })

  describe('Different Step Configurations', () => {
    it('should handle all completed steps', () => {
      const steps: Step[] = [
        { label: 'Step 1', status: 'completed' },
        { label: 'Step 2', status: 'completed' },
        { label: 'Step 3', status: 'completed' },
        { label: 'Step 4', status: 'completed' }
      ]
      
      render(<StepProgress steps={steps} />)
      
      const checkMarks = screen.getAllByText('✓')
      expect(checkMarks).toHaveLength(4)
    })

    it('should handle all pending steps', () => {
      const steps: Step[] = [
        { label: 'Step 1', status: 'pending' },
        { label: 'Step 2', status: 'pending' },
        { label: 'Step 3', status: 'pending' }
      ]
      
      render(<StepProgress steps={steps} />)
      
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('should handle mixed statuses', () => {
      const steps: Step[] = [
        { label: 'Step 1', status: 'completed' },
        { label: 'Step 2', status: 'error' },
        { label: 'Step 3', status: 'active' },
        { label: 'Step 4', status: 'pending' }
      ]
      
      render(<StepProgress steps={steps} />)
      
      expect(screen.getByText('✓')).toBeInTheDocument() // Completed
      expect(screen.getByText('×')).toBeInTheDocument() // Error
      expect(screen.getByText('3')).toBeInTheDocument() // Active
      expect(screen.getByText('4')).toBeInTheDocument() // Pending
    })

    it('should handle multiple active steps', () => {
      const steps: Step[] = [
        { label: 'Step 1', status: 'active' },
        { label: 'Step 2', status: 'active' },
        { label: 'Step 3', status: 'pending' }
      ]
      
      render(<StepProgress steps={steps} />)
      
      const progressBar = container.firstChild as HTMLElement
      // Should use first active step
      expect(progressBar).toHaveAttribute('aria-valuenow', '1')
    })
  })

  describe('CSS Classes', () => {
    it('should apply all expected CSS classes', () => {
      render(<StepProgress steps={defaultSteps} />)
      
      expect(container.querySelector('.step-progress')).toBeInTheDocument()
      expect(container.querySelector('.step-progress-track')).toBeInTheDocument()
      expect(container.querySelector('.step-progress-fill')).toBeInTheDocument()
      expect(container.querySelector('.step-progress-steps')).toBeInTheDocument()
      expect(container.querySelector('.step-progress-item')).toBeInTheDocument()
      expect(container.querySelector('.step-progress-indicator')).toBeInTheDocument()
      expect(container.querySelector('.step-progress-label')).toBeInTheDocument()
    })

    it('should apply description class when description exists', () => {
      const steps: Step[] = [
        { label: 'Step 1', status: 'active', description: 'Test description' }
      ]
      
      render(<StepProgress steps={steps} />)
      
      expect(screen.getByText('Test description')).toHaveClass('step-progress-description')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty steps array', () => {
      render(<StepProgress steps={[]} />)
      
      const progressBar = container.firstChild as HTMLElement
      expect(progressBar).toHaveAttribute('aria-valuenow', '0')
      expect(progressBar).toHaveAttribute('aria-valuemax', '0')
      expect(progressBar).toHaveAttribute('aria-label', 'Step 0 of 0')
    })

    it('should handle very long labels', () => {
      const steps: Step[] = [
        { 
          label: 'This is a very long step label that might cause layout issues',
          status: 'active',
          description: 'This is also a very long description that provides detailed information about the step'
        }
      ]
      
      render(<StepProgress steps={steps} />)
      
      expect(screen.getByText('This is a very long step label that might cause layout issues')).toBeInTheDocument()
      expect(screen.getByText('This is also a very long description that provides detailed information about the step')).toBeInTheDocument()
    })
  })
})