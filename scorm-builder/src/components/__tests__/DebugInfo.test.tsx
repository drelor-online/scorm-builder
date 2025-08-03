// Removed unused React import
import { describe, it, expect, act, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '../../test/testProviders'
import { DebugInfo } from '../DebugInfo'

// Mock debugLogger
const mockIsDebugMode = vi.fn()
const mockGetPerformanceMetrics = vi.fn()

vi.mock('../../utils/debugLogger', () => ({
  debugLogger: {
    isDebugMode: () => mockIsDebugMode(),
    getPerformanceMetrics: () => mockGetPerformanceMetrics()
  }
}))

describe('DebugInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not render when debug mode is disabled', () => {
    mockIsDebugMode.mockReturnValue(false)
    
    render(<DebugInfo />)
    
    expect(container.firstChild).toBeNull()
  })

  it('should render when debug mode is enabled', () => {
    mockIsDebugMode.mockReturnValue(true)
    mockGetPerformanceMetrics.mockReturnValue({
      memoryUsage: { usedJSHeapSize: 50 * 1048576 }, // 50MB
      domNodes: 1234
    })
    
    render(<DebugInfo />)
    
    expect(screen.getByText('DEBUG MODE ACTIVE')).toBeInTheDocument()
  })

  it('should update metrics every 2 seconds', () => {
    mockIsDebugMode.mockReturnValue(true)
    mockGetPerformanceMetrics
      .mockReturnValueOnce({
        memoryUsage: { usedJSHeapSize: 50 * 1048576 },
        domNodes: 1000
      })
      .mockReturnValueOnce({
        memoryUsage: { usedJSHeapSize: 60 * 1048576 },
        domNodes: 1200
      })
    
    render(<DebugInfo />)
    
    // Initial render
    expect(screen.queryByText(/Memory:/)).not.toBeInTheDocument()
    
    // After first interval
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    expect(screen.getByText('Memory: 50.0MB')).toBeInTheDocument()
    expect(screen.getByText('DOM Nodes: 1000')).toBeInTheDocument()
    
    // After second interval
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    expect(screen.getByText('Memory: 60.0MB')).toBeInTheDocument()
    expect(screen.getByText('DOM Nodes: 1200')).toBeInTheDocument()
  })

  it('should handle missing memory usage data', () => {
    mockIsDebugMode.mockReturnValue(true)
    mockGetPerformanceMetrics.mockReturnValue({
      memoryUsage: {},
      domNodes: 500
    })
    
    render(<DebugInfo />)
    
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    expect(screen.getByText('Memory: N/A')).toBeInTheDocument()
    expect(screen.getByText('DOM Nodes: 500')).toBeInTheDocument()
  })

  it('should display keyboard shortcut hint', () => {
    mockIsDebugMode.mockReturnValue(true)
    mockGetPerformanceMetrics.mockReturnValue({
      memoryUsage: { usedJSHeapSize: 0 },
      domNodes: 0
    })
    
    render(<DebugInfo />)
    
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    expect(screen.getByText('Press Ctrl+Shift+D to toggle panel')).toBeInTheDocument()
  })

  it('should apply correct styles', () => {
    mockIsDebugMode.mockReturnValue(true)
    
    render(<DebugInfo />)
    const debugDiv = container.firstChild as HTMLElement
    
    expect(debugDiv).toHaveStyle({
      position: 'fixed',
      top: '0.5rem',
      left: '0.5rem',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#00ff00',
      padding: '0.5rem',
      fontSize: '0.75rem',
      fontFamily: 'monospace',
      borderRadius: '0.25rem',
      zIndex: 9999,
      pointerEvents: 'none'
    })
  })

  it('should cleanup interval on unmount', () => {
    mockIsDebugMode.mockReturnValue(true)
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
    
    const { unmount } = render(<DebugInfo />)
    
    unmount()
    
    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('should not set up interval when debug mode is disabled', () => {
    mockIsDebugMode.mockReturnValue(false)
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    
    render(<DebugInfo />)
    
    expect(setIntervalSpy).not.toHaveBeenCalled()
  })

  it('should format memory usage with one decimal place', () => {
    mockIsDebugMode.mockReturnValue(true)
    mockGetPerformanceMetrics.mockReturnValue({
      memoryUsage: { usedJSHeapSize: 52.7 * 1048576 }, // 52.7MB
      domNodes: 100
    })
    
    render(<DebugInfo />)
    
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    
    expect(screen.getByText('Memory: 52.7MB')).toBeInTheDocument()
  })
})