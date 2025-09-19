/**
 * TDD Test: Loading Timeout Behavior
 *
 * This test addresses the user's issue where media loading gets stuck indefinitely.
 * We need to implement a timeout mechanism that automatically resets the loading
 * state after a reasonable amount of time to prevent users from being stuck.
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { UnifiedMediaProvider, useUnifiedMedia } from './UnifiedMediaContext'
import { PersistentStorageProvider } from './PersistentStorageContext'
import { MockFileStorage } from '../services/MockFileStorage'

// Mock the MediaService to control loading behavior
const mockMediaService = {
  listAllMedia: vi.fn(),
  loadMediaFromDisk: vi.fn(),
  projectId: 'test-project'
}

vi.mock('../services/MediaService', () => ({
  MediaService: {
    create: vi.fn(() => mockMediaService)
  },
  createMediaService: vi.fn(() => mockMediaService)
}))

// Test component to trigger loading and observe state
const TestLoadingComponent: React.FC<{ onLoadingStateChange?: (isLoading: boolean) => void }> = ({
  onLoadingStateChange
}) => {
  const { isLoading, refreshMedia } = useUnifiedMedia()

  React.useEffect(() => {
    onLoadingStateChange?.(isLoading)
  }, [isLoading, onLoadingStateChange])

  return (
    <div>
      <div data-testid="loading-state">{isLoading ? 'loading' : 'not-loading'}</div>
      <button onClick={refreshMedia} data-testid="trigger-load">
        Load Media
      </button>
    </div>
  )
}

describe('UnifiedMediaContext Loading Timeout', () => {
  let mockFileStorage: MockFileStorage
  let loadingStateChanges: boolean[]
  let onLoadingStateChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    mockFileStorage = new MockFileStorage()
    loadingStateChanges = []
    onLoadingStateChange = vi.fn((isLoading: boolean) => {
      loadingStateChanges.push(isLoading)
    })

    // Reset mocks
    mockMediaService.listAllMedia.mockReset()
    mockMediaService.loadMediaFromDisk.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should timeout stuck loading after 30 seconds', async () => {
    // Arrange - Make loadMediaFromDisk hang indefinitely (simulating the stuck scenario)
    let resolveLoading: () => void
    const hangingPromise = new Promise<void>((resolve) => {
      resolveLoading = resolve
    })
    mockMediaService.loadMediaFromDisk.mockReturnValue(hangingPromise)

    // Act - Render component and trigger loading
    const { getByTestId } = render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider projectId="test-project">
          <TestLoadingComponent onLoadingStateChange={onLoadingStateChange} />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Trigger loading
    await act(async () => {
      getByTestId('trigger-load').click()
    })

    // Verify loading started
    await waitFor(() => {
      expect(getByTestId('loading-state')).toHaveTextContent('loading')
    })

    // Fast-forward to just before timeout (29 seconds)
    await act(async () => {
      vi.advanceTimersByTime(29000)
    })

    // Should still be loading
    expect(getByTestId('loading-state')).toHaveTextContent('loading')

    // Fast-forward past timeout (30 seconds total)
    await act(async () => {
      vi.advanceTimersByTime(2000) // 31 seconds total
    })

    // Assert - Loading should be automatically reset due to timeout
    await waitFor(() => {
      expect(getByTestId('loading-state')).toHaveTextContent('not-loading')
    })

    // Verify we got the expected loading state changes: false -> true -> false (timeout)
    expect(loadingStateChanges).toEqual([false, true, false])

    // Clean up the hanging promise
    resolveLoading!()
  })

  it('should not timeout if loading completes normally', async () => {
    // Arrange - Make loadMediaFromDisk complete after 5 seconds
    mockMediaService.loadMediaFromDisk.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(resolve, 5000)
      })
    })

    // Act - Render and trigger loading
    const { getByTestId } = render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider projectId="test-project">
          <TestLoadingComponent onLoadingStateChange={onLoadingStateChange} />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    await act(async () => {
      getByTestId('trigger-load').click()
    })

    // Verify loading started
    await waitFor(() => {
      expect(getByTestId('loading-state')).toHaveTextContent('loading')
    })

    // Fast-forward 5 seconds (normal completion)
    await act(async () => {
      vi.advanceTimersByTime(5000)
    })

    // Should complete normally
    await waitFor(() => {
      expect(getByTestId('loading-state')).toHaveTextContent('not-loading')
    })

    // Fast-forward past timeout point to ensure no timeout reset
    await act(async () => {
      vi.advanceTimersByTime(30000)
    })

    // Should still be not-loading (no timeout reset)
    expect(getByTestId('loading-state')).toHaveTextContent('not-loading')

    // Verify normal completion: false -> true -> false (completion)
    expect(loadingStateChanges).toEqual([false, true, false])
  })

  it('should clear timeout when component unmounts', async () => {
    // Arrange - Hanging loading
    const hangingPromise = new Promise(() => {}) // Never resolves
    mockMediaService.loadMediaFromDisk.mockReturnValue(hangingPromise)

    // Act - Render, trigger loading, then unmount
    const { getByTestId, unmount } = render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider projectId="test-project">
          <TestLoadingComponent onLoadingStateChange={onLoadingStateChange} />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    await act(async () => {
      getByTestId('trigger-load').click()
    })

    await waitFor(() => {
      expect(getByTestId('loading-state')).toHaveTextContent('loading')
    })

    // Unmount before timeout
    unmount()

    // Fast-forward past timeout
    await act(async () => {
      vi.advanceTimersByTime(35000)
    })

    // No crash should occur (timeout should be cleaned up)
    // This test passes if no errors are thrown
    expect(true).toBe(true)
  })

  it('should allow setting custom timeout duration', async () => {
    // This test will verify we can configure the timeout duration
    // For now, we'll test with a shorter timeout for faster testing

    const hangingPromise = new Promise(() => {}) // Never resolves
    mockMediaService.loadMediaFromDisk.mockReturnValue(hangingPromise)

    // Act - We'll configure a 5-second timeout via props
    const { getByTestId } = render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider
          projectId="test-project"
          loadingTimeout={5000} // 5 second timeout instead of default 30
        >
          <TestLoadingComponent onLoadingStateChange={onLoadingStateChange} />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    await act(async () => {
      getByTestId('trigger-load').click()
    })

    await waitFor(() => {
      expect(getByTestId('loading-state')).toHaveTextContent('loading')
    })

    // Fast-forward past custom timeout (6 seconds)
    await act(async () => {
      vi.advanceTimersByTime(6000)
    })

    // Should timeout after 5 seconds
    await waitFor(() => {
      expect(getByTestId('loading-state')).toHaveTextContent('not-loading')
    })
  })

  it('should show timeout error message to user', async () => {
    // Arrange - Hanging loading
    const hangingPromise = new Promise(() => {}) // Never resolves
    mockMediaService.loadMediaFromDisk.mockReturnValue(hangingPromise)

    const TestErrorComponent: React.FC = () => {
      const { error } = useUnifiedMedia()
      return <div data-testid="error-message">{error?.message || 'no-error'}</div>
    }

    const { getByTestId } = render(
      <PersistentStorageProvider>
        <UnifiedMediaProvider projectId="test-project">
          <TestLoadingComponent onLoadingStateChange={onLoadingStateChange} />
          <TestErrorComponent />
        </UnifiedMediaProvider>
      </PersistentStorageProvider>
    )

    // Trigger loading
    await act(async () => {
      getByTestId('trigger-load').click()
    })

    // Fast-forward past timeout
    await act(async () => {
      vi.advanceTimersByTime(31000)
    })

    // Should show timeout error
    await waitFor(() => {
      expect(getByTestId('error-message')).toHaveTextContent(/timeout|timed out/i)
    })
  })
})