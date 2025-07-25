import { useState, useRef } from 'react'

interface UseFormChangesOptions {
  initialValues?: Record<string, any>
  onNavigationAttempt?: () => void
}

export function useFormChanges(options: UseFormChangesOptions = {}) {
  const { initialValues = {}, onNavigationAttempt } = options
  const [hasChanges, setHasChanges] = useState(false)
  const [showNavigationWarning, setShowNavigationWarning] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null)
  const valuesRef = useRef(initialValues)

  // Track if form values have changed
  const checkForChanges = (currentValues: Record<string, any>) => {
    const hasFormChanges = Object.keys(currentValues).some(key => {
      const currentValue = currentValues[key]
      const initialValue = valuesRef.current[key]
      
      // Handle arrays
      if (Array.isArray(currentValue) && Array.isArray(initialValue)) {
        return currentValue.length !== initialValue.length || 
               currentValue.some((val, idx) => val !== initialValue[idx])
      }
      
      return currentValue !== initialValue
    })
    
    setHasChanges(hasFormChanges)
    return hasFormChanges
  }

  // Attempt navigation with guard
  const attemptNavigation = (navigationCallback: () => void) => {
    if (hasChanges) {
      const shouldNavigate = window.confirm('You have unsaved changes. Are you sure you want to leave?')
      if (shouldNavigate) {
        navigationCallback()
      }
      if (onNavigationAttempt) {
        onNavigationAttempt()
      }
    } else {
      navigationCallback()
    }
  }

  // Handle user confirmation
  const confirmNavigation = () => {
    if (pendingNavigation) {
      pendingNavigation()
      setPendingNavigation(null)
    }
    setShowNavigationWarning(false)
    setHasChanges(false)
  }

  // Handle user cancellation
  const cancelNavigation = () => {
    setPendingNavigation(null)
    setShowNavigationWarning(false)
  }

  // Reset tracking
  const resetChanges = () => {
    setHasChanges(false)
    valuesRef.current = {}
  }

  // Update initial values (useful after save)
  const updateInitialValues = (newValues: Record<string, any>) => {
    valuesRef.current = newValues
    setHasChanges(false)
  }

  return {
    hasChanges,
    showNavigationWarning,
    checkForChanges,
    attemptNavigation,
    confirmNavigation,
    cancelNavigation,
    resetChanges,
    updateInitialValues
  }
}