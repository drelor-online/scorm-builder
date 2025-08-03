import { render, screen } from '../../test/testProviders'
import { describe, it, expect, vi } from 'vitest'
import { Modal } from '../DesignSystem/Modal'

describe('Modal Scrolling', () => {
  it('should have proper scrolling setup', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <div style={{ height: '2000px' }}>
          <p>Very tall content that requires scrolling</p>
        </div>
      </Modal>
    )

    const modalBody = screen.getByRole('dialog').querySelector('.modal-body')
    expect(modalBody).toBeInTheDocument()
    
    // Check that modal body has overflow-y: auto
    const styles = window.getComputedStyle(modalBody!)
    expect(styles.overflowY).toBe('auto')
  })

  it('should constrain modal height to viewport', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <div>Content</div>
      </Modal>
    )

    const modalContent = screen.getByRole('dialog')
    const styles = window.getComputedStyle(modalContent)
    
    // Should have max-height constraint
    expect(styles.maxHeight).toBe('90vh')
  })

  it('should use flexbox layout for proper height distribution', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <div>Content</div>
      </Modal>
    )

    const modalContent = screen.getByRole('dialog')
    const styles = window.getComputedStyle(modalContent)
    
    // Should use flexbox
    expect(styles.display).toBe('flex')
    expect(styles.flexDirection).toBe('column')
  })

  it('should ensure modal body can grow within constraints', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <div>Content</div>
      </Modal>
    )

    const modalBody = screen.getByRole('dialog').querySelector('.modal-body')
    const styles = window.getComputedStyle(modalBody!)
    
    // Should have flex: 1 to fill available space
    expect(styles.flex).toBe('1 1 0%')
  })
})