import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../../test/testProviders'
import { Modal } from '../Modal'

describe('Modal Component - Simple Tests', () => {
  it('should not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    )

    expect(screen.queryByText('Modal content')).not.toBeInTheDocument()
  })

  it('should render when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    )

    expect(screen.getByText('Modal content')).toBeInTheDocument()
  })

  it('should render with title', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Modal">
        <p>Modal body</p>
      </Modal>
    )

    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal body')).toBeInTheDocument()
  })

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        Content
      </Modal>
    )

    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose}>
        Content
      </Modal>
    )

    const overlay = container.querySelector('.modal-overlay')
    fireEvent.click(overlay!)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should not close when modal content is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose}>
        <div data-testid="modal-content">Content</div>
      </Modal>
    )

    const content = screen.getByTestId('modal-content')
    fireEvent.click(content)

    expect(onClose).not.toHaveBeenCalled()
  })

  it('should apply size classes', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={() => {}} size="small">
        Small modal
      </Modal>
    )

    let modal = screen.getByRole('dialog')
    expect(modal).toHaveClass('max-w-md')

    rerender(
      <Modal isOpen={true} onClose={() => {}} size="medium">
        Medium modal
      </Modal>
    )
    modal = screen.getByRole('dialog')
    expect(modal).toHaveClass('max-w-2xl')

    rerender(
      <Modal isOpen={true} onClose={() => {}} size="large">
        Large modal
      </Modal>
    )
    modal = screen.getByRole('dialog')
    expect(modal).toHaveClass('max-w-4xl')
  })

  it('should not show close button when showCloseButton is false', () => {
    render(
      <Modal 
        isOpen={true} 
        onClose={() => {}}
        showCloseButton={false}
        title="No close button"
      >
        Modal without close button
      </Modal>
    )

    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })

  it('should handle escape key press', () => {
    const onClose = vi.fn()
    render(
      <Modal isOpen={true} onClose={onClose}>
        Content
      </Modal>
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('should apply custom className', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} className="custom-modal">
        Custom modal
      </Modal>
    )

    const modal = screen.getByRole('dialog')
    expect(modal).toHaveClass('custom-modal')
  })

  it('should apply xlarge size', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} size="xlarge">
        XLarge modal
      </Modal>
    )

    const modal = screen.getByRole('dialog')
    expect(modal).toHaveClass('max-w-6xl')
  })
})