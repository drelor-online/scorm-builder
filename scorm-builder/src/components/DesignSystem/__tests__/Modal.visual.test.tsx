import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Modal } from '../Modal'
import './setupTests'

describe('Modal Visual Enhancements', () => {
  const defaultProps = {
    isOpen: true,
    onClose: () => {},
    title: 'Test Modal'
  }

  it('should have proper backdrop blur and opacity', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <p>Modal content</p>
      </Modal>
    )
    
    const backdrop = container.querySelector('.modal-backdrop')
    const styles = window.getComputedStyle(backdrop!)
    
    // Backdrop should have semi-transparent black background
    expect(styles.backgroundColor).toMatch(/rgba\(0, 0, 0,/)
    // Should have backdrop blur for better focus
    expect(styles.backdropFilter).toBe('blur(4px)')
  })

  it('should have elevated modal content with shadow', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <p>Modal content</p>
      </Modal>
    )
    
    const modalContent = container.querySelector('.modal-content')
    const styles = window.getComputedStyle(modalContent!)
    
    // Modal should have elevated shadow
    expect(styles.boxShadow).toMatch(/0 20px 25px/)
    // Should have rounded corners
    expect(styles.borderRadius).toBe('12px')
    // Should have proper border
    expect(styles.border).toBe('1px solid rgba(63, 63, 70, 0.5)')
  })

  it('should have smooth entry and exit animations', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <p>Modal content</p>
      </Modal>
    )
    
    const modalContent = container.querySelector('.modal-content')
    const backdrop = container.querySelector('.modal-backdrop')
    
    const contentStyles = window.getComputedStyle(modalContent!)
    const backdropStyles = window.getComputedStyle(backdrop!)
    
    // Both should have transition animations
    expect(contentStyles.transition).toMatch(/all|transform|opacity/)
    expect(backdropStyles.transition).toMatch(/opacity/)
  })

  it('should have proper header styling with divider', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <p>Modal content</p>
      </Modal>
    )
    
    const header = container.querySelector('.modal-header')
    const styles = window.getComputedStyle(header!)
    
    // Header should have bottom border
    expect(styles.borderBottom).toBe('1px solid rgba(63, 63, 70, 0.3)')
    // Proper padding
    expect(styles.paddingBottom).toBe('16px')
    expect(styles.marginBottom).toBe('24px')
  })

  it('should have accessible close button with hover state', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <p>Modal content</p>
      </Modal>
    )
    
    const closeButton = container.querySelector('.modal-close')
    expect(closeButton).toBeTruthy()
    
    const styles = window.getComputedStyle(closeButton!)
    
    // Close button should be properly styled
    expect(styles.width).toBe('32px')
    expect(styles.height).toBe('32px')
    expect(styles.borderRadius).toBe('8px')
    expect(styles.cursor).toBe('pointer')
    
    // Should have ARIA label
    expect(closeButton?.getAttribute('aria-label')).toBe('Close modal')
  })

  it('should have proper focus management', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <input type="text" placeholder="Test input" />
        <button>Test button</button>
      </Modal>
    )
    
    const modalContent = container.querySelector('.modal-content')
    expect(modalContent?.getAttribute('role')).toBe('dialog')
    expect(modalContent?.getAttribute('aria-modal')).toBe('true')
    expect(modalContent?.getAttribute('aria-labelledby')).toBeTruthy()
  })

  it('should have appropriate max dimensions and scrolling', () => {
    const { container } = render(
      <Modal {...defaultProps}>
        <div style={{ height: '2000px' }}>Very tall content</div>
      </Modal>
    )
    
    const modalContent = container.querySelector('.modal-content')
    const modalBody = container.querySelector('.modal-body')
    
    const contentStyles = window.getComputedStyle(modalContent!)
    const bodyStyles = window.getComputedStyle(modalBody!)
    
    // Modal should have max height
    expect(contentStyles.maxHeight).toBe('90vh')
    expect(contentStyles.maxWidth).toBe('600px')
    
    // Body should be scrollable
    expect(bodyStyles.overflowY).toBe('auto')
  })

  it('should support different modal sizes', () => {
    const { container: smallContainer } = render(
      <Modal {...defaultProps} size="small">
        <p>Small modal</p>
      </Modal>
    )
    
    const { container: largeContainer } = render(
      <Modal {...defaultProps} size="large">
        <p>Large modal</p>
      </Modal>
    )
    
    const smallModal = smallContainer.querySelector('.modal-content')
    const largeModal = largeContainer.querySelector('.modal-content')
    
    const smallStyles = window.getComputedStyle(smallModal!)
    const largeStyles = window.getComputedStyle(largeModal!)
    
    expect(smallStyles.maxWidth).toBe('400px')
    expect(largeStyles.maxWidth).toBe('800px')
  })
})