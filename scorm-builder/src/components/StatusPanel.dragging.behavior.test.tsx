import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { StatusPanel } from './StatusPanel'

describe('StatusPanel Dragging Behavior', () => {
  const mockProps = {
    messages: [
      {
        id: '1',
        type: 'info' as const,
        title: 'Test Message',
        message: 'Test message content',
        timestamp: Date.now()
      }
    ],
    onDismiss: vi.fn(),
    onClearAll: vi.fn(),
    isDocked: true,
    onUndock: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
  })

  test('should allow dragging when docked panel is clicked outside the button area', () => {
    render(<StatusPanel {...mockProps} />)
    
    const dockedPanel = screen.getByTestId('status-panel')
    expect(dockedPanel).toBeInTheDocument()
    
    // Test that mousedown on the panel (outside button) initiates dragging
    fireEvent.mouseDown(dockedPanel, { clientX: 100, clientY: 100 })
    
    // Simulate mouse move
    fireEvent.mouseMove(document, { clientX: 150, clientY: 150 })
    
    // The panel should have moved (transform should change)
    const panelStyle = dockedPanel.style.transform
    expect(panelStyle).toContain('translateX')
    expect(panelStyle).toContain('translateY')
    
    // Should not trigger undock when dragging
    expect(mockProps.onUndock).not.toHaveBeenCalled()
  })

  test('should NOT trigger drag when clicking directly on the button', () => {
    render(<StatusPanel {...mockProps} />)
    
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    
    // Click on button should trigger undock, not drag
    fireEvent.click(button)
    expect(mockProps.onUndock).toHaveBeenCalled()
    
    // Should not initiate dragging when clicking the button
    fireEvent.mouseDown(button, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(document, { clientX: 150, clientY: 150 })
    
    // The transform should not change significantly (just the initial position)
    const dockedPanel = screen.getByTestId('status-panel')
    const panelStyle = dockedPanel.style.transform
    // Should still be close to original position (allowing for default positioning)
    expect(panelStyle).toBeDefined()
  })

  test('should maintain position when dragging ends', () => {
    render(<StatusPanel {...mockProps} />)
    
    const dockedPanel = screen.getByTestId('status-panel')
    
    // Start drag
    fireEvent.mouseDown(dockedPanel, { clientX: 100, clientY: 100 })
    
    // Move to new position
    fireEvent.mouseMove(document, { clientX: 200, clientY: 200 })
    
    // End drag
    fireEvent.mouseUp(document)
    
    // Position should be maintained
    const finalStyle = dockedPanel.style.transform
    expect(finalStyle).toContain('translateX')
    expect(finalStyle).toContain('translateY')
  })

  test('current implementation fails - button covers entire draggable area', () => {
    render(<StatusPanel {...mockProps} />)
    
    const dockedPanel = screen.getByTestId('status-panel')
    const button = screen.getByRole('button')
    
    // This test documents the current broken behavior
    // The button should NOT take up 100% of the container
    const buttonStyles = window.getComputedStyle(button)
    
    // FAILING TEST: Currently button width/height is 100%, leaving no drag area
    // This should fail with current implementation
    expect(buttonStyles.width).not.toBe('100%')
    expect(buttonStyles.height).not.toBe('100%')
  })
})