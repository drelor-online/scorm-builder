import { useEffect, useState, useRef, useCallback } from 'react'
import { useStepNavigation } from '../contexts/StepNavigationContext'

interface UseStepDataOptions {
  enabled?: boolean
  step?: number
  dependencies?: any[]
}

interface UseStepDataReturn {
  loading: boolean
  error: Error | null
}

export function useStepData(
  loadData: () => void | Promise<void>,
  options: UseStepDataOptions = {}
): UseStepDataReturn {
  const { enabled = true, step, dependencies = [] } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { currentStep, onStepChange } = useStepNavigation()
  const isMountedRef = useRef(true)
  const previousDepsRef = useRef<any[]>(undefined)

  const load = useCallback(async () => {
    if (!enabled || !isMountedRef.current) return

    setLoading(true)
    setError(null)

    try {
      await loadData()
    } catch (err) {
      if (isMountedRef.current) {
        const error = err instanceof Error ? err : new Error('Unknown error')
        setError(error)
        console.error('Failed to load step data:', error)
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [loadData, enabled])

  // Load on mount if on the correct step
  useEffect(() => {
    if (step === undefined || currentStep === step) {
      load()
    }
  }, [load, step, currentStep])

  // Reload when navigating back to this step
  useEffect(() => {
    if (step === undefined) return

    const unsubscribe = onStepChange((newStep, oldStep) => {
      // If we're navigating TO this component's step
      if (newStep === step && oldStep !== step) {
        load()
      }
    })

    return unsubscribe
  }, [step, onStepChange, load])

  // Reload when dependencies change
  useEffect(() => {
    // Skip initial mount
    if (previousDepsRef.current === undefined) {
      previousDepsRef.current = dependencies
      return
    }

    // Check if dependencies actually changed
    const depsChanged = dependencies.some(
      (dep, index) => dep !== previousDepsRef.current![index]
    )

    if (depsChanged) {
      previousDepsRef.current = dependencies
      load()
    }
  }, dependencies)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return { loading, error }
}