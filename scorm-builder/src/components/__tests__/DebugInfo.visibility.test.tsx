import { render, screen } from '../../test/testProviders'
import { DebugInfo } from '../DebugInfo'
import { vi } from 'vitest'

// Mock the logger to control debug mode state
let mockIsDebugMode = false
vi.mock('../../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    isDebugMode: () => mockIsDebugMode,
    getPerformanceMetrics: () => null,
    debug: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    clearOperationTracking: vi.fn()
  }
}))

describe('DebugInfo visibility control', () => {
  beforeEach(() => {
    mockIsDebugMode = false
  })

  it('should NOT show DEBUG MODE ACTIVE when debug mode is disabled', () => {
    mockIsDebugMode = false
    
    render(<DebugInfo />)
    
    // Should not find the debug mode text
    expect(screen.queryByText('DEBUG MODE ACTIVE')).not.toBeInTheDocument()
  })

  it('should show DEBUG MODE ACTIVE when debug mode is enabled', () => {
    mockIsDebugMode = true
    
    render(<DebugInfo />)
    
    // Should find the debug mode text
    expect(screen.getByText('DEBUG MODE ACTIVE')).toBeInTheDocument()
  })

  it('should not show debug info by default in production', () => {
    // In production, isDebugMode should return false by default
    mockIsDebugMode = false
    
    const { container } = render(<DebugInfo />)
    
    // Container should be empty when debug mode is off
    expect(container.firstChild).toBeNull()
  })
})