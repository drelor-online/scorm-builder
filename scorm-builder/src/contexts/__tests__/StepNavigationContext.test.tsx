import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React, { useContext } from 'react'
import { StepNavigationProvider, useStepNavigation } from '../StepNavigationContext'

describe('StepNavigationContext', () => {
  describe('Step Navigation State Management', () => {
    it('should track the current step', () => {
      const TestComponent = () => {
        const { currentStep } = useStepNavigation()
        return <div>Current Step: {currentStep}</div>
      }

      render(
        <StepNavigationProvider initialStep={2}>
          <TestComponent />
        </StepNavigationProvider>
      )

      expect(screen.getByText('Current Step: 2')).toBeInTheDocument()
    })

    it('should track visited steps', () => {
      const TestComponent = () => {
        const { visitedSteps } = useStepNavigation()
        return <div>Visited: {visitedSteps.join(',')}</div>
      }

      render(
        <StepNavigationProvider initialStep={0}>
          <TestComponent />
        </StepNavigationProvider>
      )

      expect(screen.getByText('Visited: 0')).toBeInTheDocument()
    })

    it('should update visited steps when navigating to new step', () => {
      let navigateToStep: (step: number) => void
      
      const TestComponent = () => {
        const { visitedSteps, navigateToStep: navigate } = useStepNavigation()
        navigateToStep = navigate
        return <div>Visited: {visitedSteps.join(',')}</div>
      }

      render(
        <StepNavigationProvider initialStep={0}>
          <TestComponent />
        </StepNavigationProvider>
      )

      act(() => {
        navigateToStep(2)
      })

      expect(screen.getByText('Visited: 0,2')).toBeInTheDocument()
    })

    it('should not duplicate visited steps', () => {
      let navigateToStep: (step: number) => void
      
      const TestComponent = () => {
        const { visitedSteps, navigateToStep: navigate } = useStepNavigation()
        navigateToStep = navigate
        return <div>Visited: {visitedSteps.join(',')}</div>
      }

      render(
        <StepNavigationProvider initialStep={0}>
          <TestComponent />
        </StepNavigationProvider>
      )

      act(() => {
        navigateToStep(2)
        navigateToStep(2) // Navigate to same step again
        navigateToStep(0) // Go back
      })

      expect(screen.getByText('Visited: 0,2')).toBeInTheDocument()
    })

    it('should allow navigation only to visited steps', () => {
      let canNavigateToStep: (step: number) => boolean
      
      const TestComponent = () => {
        const { canNavigateToStep: canNavigate, navigateToStep } = useStepNavigation()
        canNavigateToStep = canNavigate
        
        // Visit step 1
        React.useEffect(() => {
          navigateToStep(1)
        }, [])
        
        return (
          <div>
            Can navigate to 0: {canNavigate(0) ? 'yes' : 'no'}
            Can navigate to 1: {canNavigate(1) ? 'yes' : 'no'}
            Can navigate to 2: {canNavigate(2) ? 'yes' : 'no'}
          </div>
        )
      }

      render(
        <StepNavigationProvider initialStep={0}>
          <TestComponent />
        </StepNavigationProvider>
      )

      expect(screen.getByText(/Can navigate to 0: yes/)).toBeInTheDocument()
      expect(screen.getByText(/Can navigate to 1: yes/)).toBeInTheDocument()
      expect(screen.getByText(/Can navigate to 2: no/)).toBeInTheDocument()
    })

    it('should trigger step change handlers when navigating', () => {
      const stepChangeHandler = vi.fn()
      let navigateToStep: (step: number) => void
      
      const TestComponent = () => {
        const { navigateToStep: navigate, onStepChange } = useStepNavigation()
        navigateToStep = navigate
        
        React.useEffect(() => {
          return onStepChange((newStep, oldStep) => {
            stepChangeHandler(newStep, oldStep)
          })
        }, [])
        
        return <div>Test</div>
      }

      render(
        <StepNavigationProvider initialStep={0}>
          <TestComponent />
        </StepNavigationProvider>
      )

      act(() => {
        navigateToStep(2)
      })

      expect(stepChangeHandler).toHaveBeenCalledWith(2, 0)
    })

    it('should handle multiple step change handlers', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      let navigateToStep: (step: number) => void
      
      const TestComponent = () => {
        const { navigateToStep: navigate, onStepChange } = useStepNavigation()
        navigateToStep = navigate
        
        React.useEffect(() => {
          const unsubscribe1 = onStepChange(handler1)
          const unsubscribe2 = onStepChange(handler2)
          
          return () => {
            unsubscribe1()
            unsubscribe2()
          }
        }, [])
        
        return <div>Test</div>
      }

      render(
        <StepNavigationProvider initialStep={0}>
          <TestComponent />
        </StepNavigationProvider>
      )

      act(() => {
        navigateToStep(1)
      })

      expect(handler1).toHaveBeenCalledWith(1, 0)
      expect(handler2).toHaveBeenCalledWith(1, 0)
    })

    it('should unsubscribe handlers correctly', () => {
      const handler = vi.fn()
      let navigateToStep: (step: number) => void
      let unsubscribe: () => void
      
      const TestComponent = () => {
        const { navigateToStep: navigate, onStepChange } = useStepNavigation()
        navigateToStep = navigate
        
        React.useEffect(() => {
          unsubscribe = onStepChange(handler)
        }, [])
        
        return <div>Test</div>
      }

      render(
        <StepNavigationProvider initialStep={0}>
          <TestComponent />
        </StepNavigationProvider>
      )

      act(() => {
        unsubscribe()
        navigateToStep(1)
      })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('Error handling', () => {
    it('should throw error when useStepNavigation is used outside provider', () => {
      const TestComponent = () => {
        const context = useStepNavigation()
        return <div>Test</div>
      }

      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      expect(() => {
        render(<TestComponent />)
      }).toThrow('useStepNavigation must be used within a StepNavigationProvider')

      console.error = originalError
    })
  })
})