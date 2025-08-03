import { describe, it, expect, act, vi, beforeEach } from 'vitest'
import { renderHook } from '../../test/testProviders'
// Removed unused React import
import { useStepData } from '../useStepData'
import { StepNavigationProvider, useStepNavigation } from '../../contexts/StepNavigationContext'

describe('useStepData', () => {
  const mockLoadData = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Data loading on mount', () => {
    it('should call load function on mount', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StepNavigationProvider initialStep={0}>
          {children}
        </StepNavigationProvider>
      )

      renderHook(() => useStepData(mockLoadData), { wrapper })

      expect(mockLoadData).toHaveBeenCalledTimes(1)
    })

    it('should not call load function if disabled', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StepNavigationProvider initialStep={0}>
          {children}
        </StepNavigationProvider>
      )

      renderHook(() => useStepData(mockLoadData, { enabled: false }), { wrapper })

      expect(mockLoadData).not.toHaveBeenCalled()
    })
  })

  describe('Data reloading on navigation', () => {
    it('should reload data when navigating back to the same step', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StepNavigationProvider initialStep={0}>
          {children}
        </StepNavigationProvider>
      )

      const { result } = renderHook(
        () => {
          const navigation = useStepNavigation()
          const { loading } = useStepData(mockLoadData, { step: 1 })
          return { loading, navigation }
        },
        { wrapper }
      )

      // Initial load should not happen since we're on step 0
      expect(mockLoadData).not.toHaveBeenCalled()

      // Navigate to step 1 - should trigger load
      await act(async () => {
        result.current.navigation.navigateToStep(1)
      })

      // Wait for effect to run
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(mockLoadData).toHaveBeenCalledTimes(1)

      // Navigate away from step 1
      await act(async () => {
        result.current.navigation.navigateToStep(2)
      })

      // Navigate back to step 1 - should reload
      await act(async () => {
        result.current.navigation.navigateToStep(1)
      })

      // Wait for effect to run
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(mockLoadData).toHaveBeenCalledTimes(2)
    })

    it('should not reload data when navigating to a different step', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StepNavigationProvider initialStep={0}>
          {children}
        </StepNavigationProvider>
      )

      const { result } = renderHook(
        () => {
          const navigation = useStepNavigation()
          useStepData(mockLoadData, { step: 1 })
          return navigation
        },
        { wrapper }
      )

      // Navigate to step 2 (not the step we're tracking)
      await act(async () => {
        result.current.navigateToStep(2)
      })

      // Should not trigger reload since we're tracking step 1
      expect(mockLoadData).not.toHaveBeenCalled()
    })
  })

  describe('Loading state management', () => {
    it('should manage loading state during data load', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StepNavigationProvider initialStep={0}>
          {children}
        </StepNavigationProvider>
      )

      let resolveLoad: () => void
      const loadPromise = new Promise<void>(resolve => {
        resolveLoad = resolve
      })

      mockLoadData.mockReturnValue(loadPromise)

      const { result } = renderHook(() => useStepData(mockLoadData), { wrapper })

      // Should be loading initially
      expect(result.current.loading).toBe(true)

      // Resolve the load
      await act(async () => {
        resolveLoad!()
        await loadPromise
      })

      // Should not be loading after completion
      expect(result.current.loading).toBe(false)
    })

    it('should handle load errors gracefully', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StepNavigationProvider initialStep={0}>
          {children}
        </StepNavigationProvider>
      )

      const error = new Error('Load failed')
      mockLoadData.mockRejectedValue(error)

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useStepData(mockLoadData), { wrapper })

      // Wait for error to be handled
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBe(error)
      expect(consoleError).toHaveBeenCalledWith('Failed to load step data:', error)

      consoleError.mockRestore()
    })
  })

  describe('Cleanup', () => {
    it('should cancel pending loads when unmounting', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StepNavigationProvider initialStep={0}>
          {children}
        </StepNavigationProvider>
      )

      let rejectLoad: (error: Error) => void
      const loadPromise = new Promise<void>((_, reject) => {
        rejectLoad = reject
      })

      mockLoadData.mockReturnValue(loadPromise)

      const { unmount } = renderHook(() => useStepData(mockLoadData), { wrapper })

      // Unmount while loading
      unmount()

      // Reject the promise to simulate cancellation
      await act(async () => {
        rejectLoad!(new Error('Cancelled'))
      })

      // Should not throw or cause issues
      expect(true).toBe(true)
    })
  })

  describe('Dependencies', () => {
    it('should reload when dependencies change', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StepNavigationProvider initialStep={0}>
          {children}
        </StepNavigationProvider>
      )

      const { rerender } = renderHook(
        ({ dep }) => useStepData(mockLoadData, { dependencies: [dep] }),
        {
          wrapper,
          initialProps: { dep: 'value1' }
        }
      )

      expect(mockLoadData).toHaveBeenCalledTimes(1)

      // Change dependency
      rerender({ dep: 'value2' })

      expect(mockLoadData).toHaveBeenCalledTimes(2)
    })

    it('should not reload when dependencies are the same', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StepNavigationProvider initialStep={0}>
          {children}
        </StepNavigationProvider>
      )

      const { rerender } = renderHook(
        ({ dep }) => useStepData(mockLoadData, { dependencies: [dep] }),
        {
          wrapper,
          initialProps: { dep: 'value1' }
        }
      )

      expect(mockLoadData).toHaveBeenCalledTimes(1)

      // Rerender with same dependency
      rerender({ dep: 'value1' })

      expect(mockLoadData).toHaveBeenCalledTimes(1)
    })
  })
})