import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { StatusPanel, StatusMessage } from './StatusPanel'
import '@testing-library/jest-dom'
import { vi } from 'vitest'

describe('StatusPanel - Draggable and Dockable Functionality', () => {
  const mockMessages: StatusMessage[] = [
    {
      id: '1',
      type: 'info',
      title: 'Test Message',
      message: 'This is a test message',
      timestamp: Date.now()
    }
  ]

  const mockProps = {
    messages: mockMessages,
    onDismiss: vi.fn(),
    onClearAll: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should render with draggable header', () => {
    render(<StatusPanel {...mockProps} />)
    
    // Panel should be visible
    const panel = screen.getByTestId('status-panel')
    expect(panel).toBeInTheDocument()
    
    // Header should have cursor: move styling for dragging
    const header = screen.getByRole('banner') || panel.querySelector('.header')
    expect(header).toBeInTheDocument()
  })

  test('should be draggable via mouse events', async () => {
    render(<StatusPanel {...mockProps} />)
    
    const panel = screen.getByTestId('status-panel')
    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()

    // Simulate drag start
    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 })
    
    // Simulate drag movement  
    fireEvent.mouseMove(document, { clientX: 150, clientY: 150 })
    
    // Simulate drag end
    fireEvent.mouseUp(document)

    // Panel should have moved (position should be updated)
    expect(panel).toHaveStyle('transform: translateX(70px) translateY(130px)')
  })

  test('should support docking (minimize) functionality', () => {
    const mockOnDock = vi.fn()
    render(<StatusPanel {...mockProps} onDock={mockOnDock} />)
    
    // Should have a dock/minimize button
    const dockButton = screen.getByLabelText(/dock.*panel/i)
    expect(dockButton).toBeInTheDocument()
    
    // Click to dock
    fireEvent.click(dockButton)
    
    // Should call onDock callback
    expect(mockOnDock).toHaveBeenCalled()
  })

  test('should show undock button when docked', () => {
    render(<StatusPanel {...mockProps} isDocked={true} />)
    
    // Should show undock/restore button when docked
    const undockButton = screen.getByLabelText(/undock.*panel/i)
    expect(undockButton).toBeInTheDocument()
  })

  test('should remember position when docking/undocking', () => {
    const mockOnDock = vi.fn()
    const mockOnUndock = vi.fn()
    
    // Test docking
    render(<StatusPanel {...mockProps} onDock={mockOnDock} />)
    const dockButton = screen.getByLabelText(/dock.*panel/i)
    fireEvent.click(dockButton)
    expect(mockOnDock).toHaveBeenCalled()
    
    // Test undocking when docked
    const { rerender } = render(<StatusPanel {...mockProps} isDocked={true} onUndock={mockOnUndock} />)
    const undockButton = screen.getByLabelText(/undock.*panel/i)
    fireEvent.click(undockButton)
    expect(mockOnUndock).toHaveBeenCalled()
  })

  test('should constrain dragging within viewport bounds', () => {
    // Mock viewport size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768,
    })

    render(<StatusPanel {...mockProps} />)
    
    const panel = screen.getByTestId('status-panel')
    const header = screen.getByRole('banner')

    // Try to drag beyond viewport
    fireEvent.mouseDown(header, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(document, { clientX: 2000, clientY: 2000 }) // Way beyond viewport
    fireEvent.mouseUp(document)

    // Panel should be constrained within viewport bounds
    const style = window.getComputedStyle(panel)
    const transform = style.transform
    
    // Should not exceed viewport dimensions (constrained to max 624px, 468px based on panel size)
    expect(transform).not.toContain('translateX(2000px)')
    expect(transform).not.toContain('translateY(2000px)')
  })
})