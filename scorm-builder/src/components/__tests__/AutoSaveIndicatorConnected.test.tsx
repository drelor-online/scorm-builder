import { render, screen, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AutoSaveIndicatorConnected } from '../AutoSaveIndicatorConnected'

// Mock the AutoSaveContext
const mockAutoSaveState = {
  isSaving: false,
  lastSaved: null as Date | null
}

vi.mock('../../contexts/AutoSaveContext', () => ({
  useAutoSaveState: () => mockAutoSaveState
}))

// Mock the AutoSaveIndicator component
vi.mock('../AutoSaveIndicator', () => ({
  AutoSaveIndicator: ({ isSaving, hasDraft, timeSinceLastSave }: any) => (
    <div data-testid="auto-save-indicator">
      <span data-testid="saving-status">{isSaving ? 'Saving...' : 'Saved'}</span>
      <span data-testid="has-draft">{hasDraft ? 'Has draft' : 'No draft'}</span>
      <span data-testid="time-since-save">{timeSinceLastSave}</span>
    </div>
  )
}))

describe('AutoSaveIndicatorConnected', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Reset mock state
    mockAutoSaveState.isSaving = false
    mockAutoSaveState.lastSaved = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should render with "Never" when lastSaved is null', () => {
    render(<AutoSaveIndicatorConnected />)
    
    expect(screen.getByTestId('time-since-save')).toHaveTextContent('Never')
    expect(screen.getByTestId('has-draft')).toHaveTextContent('No draft')
    expect(screen.getByTestId('saving-status')).toHaveTextContent('Saved')
  })

  it('should show "Saving..." when isSaving is true', () => {
    mockAutoSaveState.isSaving = true
    
    render(<AutoSaveIndicatorConnected />)
    
    expect(screen.getByTestId('saving-status')).toHaveTextContent('Saving...')
  })

  it('should show "just now" for saves less than 10 seconds ago', () => {
    mockAutoSaveState.lastSaved = new Date()
    
    render(<AutoSaveIndicatorConnected />)
    
    expect(screen.getByTestId('time-since-save')).toHaveTextContent('just now')
    expect(screen.getByTestId('has-draft')).toHaveTextContent('Has draft')
  })

  it('should show seconds for saves less than 60 seconds ago', () => {
    const now = new Date()
    mockAutoSaveState.lastSaved = new Date(now.getTime() - 30 * 1000) // 30 seconds ago
    
    render(<AutoSaveIndicatorConnected />)
    
    expect(screen.getByTestId('time-since-save')).toHaveTextContent('30s ago')
  })

  it('should show minutes for saves less than 60 minutes ago', () => {
    const now = new Date()
    mockAutoSaveState.lastSaved = new Date(now.getTime() - 15 * 60 * 1000) // 15 minutes ago
    
    render(<AutoSaveIndicatorConnected />)
    
    expect(screen.getByTestId('time-since-save')).toHaveTextContent('15m ago')
  })

  it('should show hours for saves more than 60 minutes ago', () => {
    const now = new Date()
    mockAutoSaveState.lastSaved = new Date(now.getTime() - 2 * 60 * 60 * 1000) // 2 hours ago
    
    render(<AutoSaveIndicatorConnected />)
    
    expect(screen.getByTestId('time-since-save')).toHaveTextContent('2h ago')
  })

  it('should update time dynamically', () => {
    const now = new Date()
    mockAutoSaveState.lastSaved = new Date(now.getTime() - 5 * 1000) // 5 seconds ago
    
    const { rerender } = render(<AutoSaveIndicatorConnected />)
    
    expect(screen.getByTestId('time-since-save')).toHaveTextContent('just now')
    
    // Fast-forward 10 seconds
    act(() => {
      vi.advanceTimersByTime(10 * 1000)
    })
    
    // Force re-render to trigger the interval update
    rerender(<AutoSaveIndicatorConnected />)
    
    // Should now show 15s ago
    expect(screen.getByTestId('time-since-save')).toHaveTextContent('15s ago')
  })

  it('should handle edge case of exactly 60 seconds', () => {
    const now = new Date()
    mockAutoSaveState.lastSaved = new Date(now.getTime() - 60 * 1000) // Exactly 60 seconds ago
    
    render(<AutoSaveIndicatorConnected />)
    
    expect(screen.getByTestId('time-since-save')).toHaveTextContent('1m ago')
  })

  it('should handle edge case of exactly 60 minutes', () => {
    const now = new Date()
    mockAutoSaveState.lastSaved = new Date(now.getTime() - 60 * 60 * 1000) // Exactly 60 minutes ago
    
    render(<AutoSaveIndicatorConnected />)
    
    expect(screen.getByTestId('time-since-save')).toHaveTextContent('1h ago')
  })

  it('should clean up interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval')
    mockAutoSaveState.lastSaved = new Date()
    
    const { unmount } = render(<AutoSaveIndicatorConnected />)
    
    unmount()
    
    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('should handle changing from null to a date', () => {
    const { rerender } = render(<AutoSaveIndicatorConnected />)
    
    expect(screen.getByTestId('time-since-save')).toHaveTextContent('Never')
    expect(screen.getByTestId('has-draft')).toHaveTextContent('No draft')
    
    // Update the mock state
    mockAutoSaveState.lastSaved = new Date()
    
    rerender(<AutoSaveIndicatorConnected />)
    
    expect(screen.getByTestId('time-since-save')).toHaveTextContent('just now')
    expect(screen.getByTestId('has-draft')).toHaveTextContent('Has draft')
  })

  it('should update every second', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval')
    mockAutoSaveState.lastSaved = new Date()
    
    render(<AutoSaveIndicatorConnected />)
    
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000)
  })
})