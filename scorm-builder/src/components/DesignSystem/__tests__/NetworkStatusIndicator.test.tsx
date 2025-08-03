import { render, screen } from '../../../test/testProviders'
import { describe, it, expect, vi } from 'vitest'
import { NetworkStatusIndicator } from './NetworkStatusIndicator'

// Mock the useNetworkStatus hook
vi.mock('../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn()
}))

import { useNetworkStatus } from '../../hooks/useNetworkStatus'

describe('NetworkStatusIndicator', () => {
  const mockedUseNetworkStatus = useNetworkStatus as ReturnType<typeof vi.fn>

  it('should not render when online', () => {
    mockedUseNetworkStatus.mockReturnValue({
      isOnline: true,
      lastOnline: null
    })

    render(<NetworkStatusIndicator />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should render offline message when offline', () => {
    mockedUseNetworkStatus.mockReturnValue({
      isOnline: false,
      lastOnline: new Date('2024-01-01T12:00:00Z')
    })

    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText(/No internet connection/i)).toBeInTheDocument()
  })

  it('should show last online time when available', () => {
    const lastOnline = new Date('2024-01-01T12:00:00Z')
    mockedUseNetworkStatus.mockReturnValue({
      isOnline: false,
      lastOnline
    })

    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText(/Last online:/i)).toBeInTheDocument()
  })

  it('should apply offline styles', () => {
    mockedUseNetworkStatus.mockReturnValue({
      isOnline: false,
      lastOnline: null
    })

    render(<NetworkStatusIndicator />)
    const indicator = container.firstChild as HTMLElement
    
    expect(indicator).toHaveClass('network-status-indicator')
    expect(indicator).toHaveClass('offline')
  })

  it('should have appropriate ARIA attributes', () => {
    mockedUseNetworkStatus.mockReturnValue({
      isOnline: false,
      lastOnline: null
    })

    render(<NetworkStatusIndicator />)
    
    const indicator = screen.getByRole('status')
    expect(indicator).toHaveAttribute('aria-live', 'polite')
  })

  it('should format time properly', () => {
    // Mock current time
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T12:05:00Z'))

    const lastOnline = new Date('2024-01-01T12:00:00Z')
    mockedUseNetworkStatus.mockReturnValue({
      isOnline: false,
      lastOnline
    })

    render(<NetworkStatusIndicator />)
    
    expect(screen.getByText(/5 minutes ago/i)).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('should support custom className', () => {
    mockedUseNetworkStatus.mockReturnValue({
      isOnline: false,
      lastOnline: null
    })

    render(<NetworkStatusIndicator className="custom-class" />)
    const indicator = container.firstChild as HTMLElement
    
    expect(indicator).toHaveClass('custom-class')
  })
})