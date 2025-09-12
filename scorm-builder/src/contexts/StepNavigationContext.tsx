import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { useStorage } from './PersistentStorageContext'

type StepChangeHandler = (newStep: number, oldStep: number) => void

interface StepNavigationContextType {
  currentStep: number
  visitedSteps: number[]
  navigateToStep: (step: number) => void
  canNavigateToStep: (step: number) => boolean
  onStepChange: (handler: StepChangeHandler) => () => void
  unlockSteps: (steps: number[]) => void
}

const StepNavigationContext = createContext<StepNavigationContextType | undefined>(undefined)

export function useStepNavigation() {
  const context = useContext(StepNavigationContext)
  if (!context) {
    throw new Error('useStepNavigation must be used within a StepNavigationProvider')
  }
  return context
}

interface StepNavigationProviderProps {
  children: React.ReactNode
  initialStep?: number
}

export function StepNavigationProvider({ children, initialStep = 0 }: StepNavigationProviderProps) {
  const storage = useStorage()
  const [currentStep, setCurrentStep] = useState(initialStep)
  const [visitedSteps, setVisitedSteps] = useState<number[]>([initialStep])
  const [isLoaded, setIsLoaded] = useState(false)
  const stepChangeHandlersRef = useRef<Set<StepChangeHandler>>(new Set())
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Load visited steps from storage when the context mounts
  useEffect(() => {
    if (storage.isInitialized && storage.currentProjectId && !isLoaded) {
      storage.getContent('visitedSteps').then((data) => {
        if (data && Array.isArray(data.steps)) {
          setVisitedSteps(data.steps)
        }
        setIsLoaded(true)
      }).catch(() => {
        // If no saved visited steps, that's fine
        setIsLoaded(true)
      })
    }
  }, [storage.isInitialized, storage.currentProjectId, isLoaded])
  
  // Save visited steps when they change (debounced)
  useEffect(() => {
    if (storage.isInitialized && storage.currentProjectId && isLoaded && visitedSteps.length > 0) {
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      
      // Set new timeout to debounce saves
      saveTimeoutRef.current = setTimeout(() => {
        storage.saveContent('visitedSteps', { steps: visitedSteps }).catch((error) => {
          console.error('Failed to save visited steps:', error)
        })
      }, 1000) // Debounce for 1 second
      
      // Cleanup function
      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
      }
    }
  }, [visitedSteps, storage.isInitialized, storage.currentProjectId, isLoaded])

  const navigateToStep = useCallback((step: number) => {
    const oldStep = currentStep
    setCurrentStep(step)
    
    // Backfill visited steps: ensure all steps 0 through 'step' are marked as visited
    // This fixes the SCORM jump bug where users can load directly into step N but 
    // can't navigate back to intermediate steps
    setVisitedSteps(prev => {
      const maxVisitedStep = Math.max(...prev, step)
      const allStepsToTarget = Array.from({ length: step + 1 }, (_, i) => i)
      
      // Merge existing visited steps with backfilled steps, ensuring no duplicates
      const mergedSteps = [...new Set([...prev, ...allStepsToTarget])]
      
      // Keep any steps beyond the current target that were previously visited
      const higherSteps = prev.filter(s => s > step)
      const finalSteps = [...new Set([...mergedSteps, ...higherSteps])]
      
      return finalSteps.sort((a, b) => a - b)
    })

    // Notify all handlers
    stepChangeHandlersRef.current.forEach(handler => {
      handler(step, oldStep)
    })
  }, [currentStep])

  const canNavigateToStep = useCallback((step: number) => {
    return visitedSteps.includes(step)
  }, [visitedSteps])

  const onStepChange = useCallback((handler: StepChangeHandler) => {
    stepChangeHandlersRef.current.add(handler)
    
    // Return unsubscribe function
    return () => {
      stepChangeHandlersRef.current.delete(handler)
    }
  }, [])

  const unlockSteps = useCallback((steps: number[]) => {
    setVisitedSteps(prev => {
      const newSteps = [...new Set([...prev, ...steps])].sort((a, b) => a - b)
      return newSteps
    })
  }, [])

  const value: StepNavigationContextType = {
    currentStep,
    visitedSteps,
    navigateToStep,
    canNavigateToStep,
    onStepChange,
    unlockSteps
  }

  return (
    <StepNavigationContext.Provider value={value}>
      {children}
    </StepNavigationContext.Provider>
  )
}