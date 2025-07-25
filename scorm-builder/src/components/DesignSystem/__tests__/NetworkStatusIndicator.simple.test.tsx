import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NetworkStatusIndicator } from '../NetworkStatusIndicator'

// Mock the useNetworkStatus hook
vi.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn()
}))

import { useNetworkStatus } from '../../../hooks/useNetworkStatus'

describe('NetworkStatusIndicator Component - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render when online', () => {
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: true,
      lastOnline: null
    })

    const { container } = render(<NetworkStatusIndicator />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should render offline indicator when offline', () => {
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: false,
      lastOnline: null
    })

    render(<NetworkStatusIndicator />)
    
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('No internet connection')).toBeInTheDocument()
  })

  it('should show last online time - just now', () => {
    const now = new Date()
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: false,
      lastOnline: now
    })

    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText(/Last online: just now/)).toBeInTheDocument()
  })

  it('should show last online time - 1 minute ago', () => {
    const oneMinuteAgo = new Date(Date.now() - 60000)
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: false,
      lastOnline: oneMinuteAgo
    })

    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText(/Last online: 1 minute ago/)).toBeInTheDocument()
  })

  it('should show last online time - minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000)
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: false,
      lastOnline: fiveMinutesAgo
    })

    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText(/Last online: 5 minutes ago/)).toBeInTheDocument()
  })

  it('should show last online time - 1 hour ago', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60000)
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: false,
      lastOnline: oneHourAgo
    })

    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText(/Last online: 1 hour ago/)).toBeInTheDocument()
  })

  it('should show last online time - hours ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60000)
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: false,
      lastOnline: threeHoursAgo
    })

    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText(/Last online: 3 hours ago/)).toBeInTheDocument()
  })

  it('should show last online time - 1 day ago', () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60000)
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: false,
      lastOnline: oneDayAgo
    })

    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText(/Last online: 1 day ago/)).toBeInTheDocument()
  })

  it('should show last online time - days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60000)
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: false,
      lastOnline: threeDaysAgo
    })

    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText(/Last online: 3 days ago/)).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: false,
      lastOnline: null
    })

    const { container } = render(
      <NetworkStatusIndicator className="custom-indicator" />
    )
    
    expect(container.firstChild).toHaveClass('custom-indicator')
  })

  it('should have proper aria attributes', () => {
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: false,
      lastOnline: null
    })

    render(<NetworkStatusIndicator />)
    
    const indicator = screen.getByRole('status')
    expect(indicator).toHaveAttribute('aria-live', 'polite')
  })

  it('should have offline class when offline', () => {
    vi.mocked(useNetworkStatus).mockReturnValue({
      isOnline: false,
      lastOnline: null
    })

    const { container } = render(<NetworkStatusIndicator />)
    
    expect(container.firstChild).toHaveClass('offline')
  })
})