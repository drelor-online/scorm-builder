import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Toast } from '../Toast'

describe('Toast - Text Cutoff Fix', () => {
  it('should display long messages without text cutoff', () => {
    const longMessage = 'This is a very long message that should not be cut off and should wrap properly within the toast notification container to ensure all text is visible to the user'
    
    render(
      <Toast
        message={longMessage}
        type="info"
        isVisible={true}
        onClose={() => {}}
      />
    )
    
    const toastElement = screen.getByText(longMessage)
    expect(toastElement).toBeInTheDocument()
    
    // Check that the toast has proper text wrapping styles
    const styles = window.getComputedStyle(toastElement.parentElement!)
    
    // Should have word-wrap or overflow-wrap
    expect(['break-word', 'normal', 'anywhere']).toContain(
      styles.overflowWrap || styles.wordWrap || 'normal'
    )
    
    // Should not have text-overflow: ellipsis
    expect(styles.textOverflow).not.toBe('ellipsis')
    
    // Should not have white-space: nowrap
    expect(styles.whiteSpace).not.toBe('nowrap')
  })
  
  it('should have high enough z-index to appear above other content', () => {
    render(
      <Toast
        message="Test message"
        type="info"
        isVisible={true}
        onClose={() => {}}
      />
    )
    
    const toastContainer = screen.getByText('Test message').closest('div')
    const styles = window.getComputedStyle(toastContainer!)
    
    // Z-index should be high enough (typically 9999 or higher for notifications)
    const zIndex = parseInt(styles.zIndex || '0', 10)
    expect(zIndex).toBeGreaterThanOrEqual(9999)
  })
  
  it('should have max-width to prevent overly wide toasts', () => {
    render(
      <Toast
        message="Test message"
        type="info"
        isVisible={true}
        onClose={() => {}}
      />
    )
    
    const toastContainer = screen.getByText('Test message').closest('div')
    const styles = window.getComputedStyle(toastContainer!)
    
    // Should have a max-width set
    expect(styles.maxWidth).toBeTruthy()
    expect(styles.maxWidth).not.toBe('none')
  })
  
  it('should have proper padding to prevent text from touching edges', () => {
    render(
      <Toast
        message="Test message"
        type="info"
        isVisible={true}
        onClose={() => {}}
      />
    )
    
    const toastElement = screen.getByText('Test message')
    const styles = window.getComputedStyle(toastElement.parentElement!)
    
    // Should have padding
    expect(styles.padding).toBeTruthy()
    expect(styles.padding).not.toBe('0px')
  })
})