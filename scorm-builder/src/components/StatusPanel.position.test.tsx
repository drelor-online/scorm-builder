import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StatusPanel } from './StatusPanel'
import { StatusMessage } from './StatusPanel'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

describe('StatusPanel Position Persistence', () => {
  const createMockMessage = (): StatusMessage => ({
    id: 'msg-1',
    type: 'info',
    title: 'Test Message',
    message: 'Test message content',
    timestamp: Date.now(),
    dismissed: false
  })

  const defaultProps = {
    messages: [createMockMessage()],
    onDismiss: vi.fn(),
    onClearAll: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  it('should load saved position on component mount', () => {
    // Mock saved position
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify({ x: 100, y: 200 }))
    
    render(<StatusPanel {...defaultProps} />)
    
    const panel = screen.getByTestId('status-panel')
    expect(panel).toHaveStyle('transform: translateX(100px) translateY(200px)')
  })

  it('should use default position when no saved position exists', () => {
    mockLocalStorage.getItem.mockReturnValue(null)
    
    render(<StatusPanel {...defaultProps} />)
    
    const panel = screen.getByTestId('status-panel')
    expect(panel).toHaveStyle('transform: translateX(20px) translateY(80px)')
  })

  it('should save position to localStorage when component position changes', () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Position is saved on initial render and when dragging stops
    // The exact position will depend on drag calculations, but we just want to verify it saves to localStorage
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'statusPanel_position',
      expect.stringContaining('{"x":')
    )
  })

  it('should use statusPanel_position as localStorage key', () => {
    render(<StatusPanel {...defaultProps} />)
    
    // Should try to load from correct key
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('statusPanel_position')
  })

  it('should handle invalid saved position gracefully', () => {
    // Mock invalid JSON
    mockLocalStorage.getItem.mockReturnValue('invalid-json')
    
    render(<StatusPanel {...defaultProps} />)
    
    // Should fall back to default position
    const panel = screen.getByTestId('status-panel')
    expect(panel).toHaveStyle('transform: translateX(20px) translateY(80px)')
  })
})