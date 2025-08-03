import React, { lazy, Suspense } from 'react'
import { render, screen, waitFor } from '../../test/testProviders'
import { describe, test, expect } from 'vitest'

describe('PerformanceDashboard lazy loading', () => {
  test('should fail to lazy load without default export', async () => {
    // This test reproduces the error: "Element type is invalid. Received a promise that resolves to: undefined"
    const LazyPerformanceDashboard = lazy(() => 
      import('../PerformanceDashboard').then(m => ({ default: m.PerformanceDashboard }))
    )

    const TestComponent = () => (
      <Suspense fallback={<div>Loading...</div>}>
        <LazyPerformanceDashboard show={true} />
      </Suspense>
    )

    render(<TestComponent />)
    
    // Wait for lazy loading to complete
    await waitFor(() => {
      expect(screen.getByText(/Performance Monitor/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})