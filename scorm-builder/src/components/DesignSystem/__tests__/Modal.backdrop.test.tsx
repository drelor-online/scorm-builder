import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Modal } from '../Modal'

describe('Modal - Backdrop Blur', () => {
  it('should have backdrop blur effect when modal is open', () => {
    render(
      <>
        <div data-testid="navigation">Navigation Content</div>
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <div>Modal Content</div>
        </Modal>
      </>
    )
    
    // Find the modal backdrop/overlay
    const backdrop = document.querySelector('.modal-backdrop, .modal-overlay, [class*="overlay"]')
    expect(backdrop).toBeTruthy()
    
    if (backdrop) {
      const styles = window.getComputedStyle(backdrop)
      
      // Should have backdrop filter for blur
      expect(styles.backdropFilter || styles.webkitBackdropFilter).toContain('blur')
      
      // Should have semi-transparent background
      expect(styles.backgroundColor).toMatch(/rgba.*0\.\d+\)/)
      
      // Should be positioned to cover the viewport
      expect(styles.position).toBe('fixed')
      expect(styles.top).toBe('0px')
      expect(styles.left).toBe('0px')
      expect(styles.right).toBe('0px')
      expect(styles.bottom).toBe('0px')
      
      // Should have high z-index to be above navigation
      const zIndex = parseInt(styles.zIndex || '0')
      expect(zIndex).toBeGreaterThan(100)
    }
  })
  
  it('should not have backdrop when modal is closed', () => {
    render(
      <>
        <div data-testid="navigation">Navigation Content</div>
        <Modal isOpen={false} onClose={() => {}} title="Test Modal">
          <div>Modal Content</div>
        </Modal>
      </>
    )
    
    // Should not find any backdrop
    const backdrop = document.querySelector('.modal-backdrop, .modal-overlay, [class*="overlay"]')
    expect(backdrop).toBeFalsy()
  })
  
  it('should blur background content including navigation', () => {
    const { container } = render(
      <>
        <div data-testid="navigation" className="navigation">Navigation Content</div>
        <div data-testid="main-content">Main Content</div>
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <div>Modal Content</div>
        </Modal>
      </>
    )
    
    // The modal should create a backdrop that visually blurs content behind it
    const backdrop = container.querySelector('[class*="modal"], [class*="overlay"]')
    expect(backdrop).toBeTruthy()
    
    // Check that backdrop is positioned to cover all content
    if (backdrop) {
      const backdropRect = backdrop.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Backdrop should cover the full viewport
      expect(backdropRect.width).toBeGreaterThanOrEqual(viewportWidth)
      expect(backdropRect.height).toBeGreaterThanOrEqual(viewportHeight)
    }
  })
})