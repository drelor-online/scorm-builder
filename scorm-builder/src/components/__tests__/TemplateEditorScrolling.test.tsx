import { vi } from 'vitest'
// Removed unused React import
import { render, screen } from '../../test/testProviders'

import { TemplateEditor } from '../TemplateEditor'
import { Modal } from '../DesignSystem/Modal'

describe('Template Editor Scrolling', () => {
  it('should render within a scrollable modal', () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title="Template Editor"
        size="large"
      >
        <TemplateEditor
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </Modal>
    )
    
    // Check that modal is rendered
    const modal = screen.getByRole('dialog')
    expect(modal).toBeInTheDocument()
    
    // Check that modal has proper scrolling classes
    const modalBody = modal.querySelector('.modal-body')
    expect(modalBody).toBeInTheDocument()
    
    // Check computed styles for overflow
    if (modalBody) {
      const styles = window.getComputedStyle(modalBody)
      expect(styles.overflowY).toBe('auto')
    }
  })

  it('should have proper max-height constraints', () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title="Template Editor"
        size="large"
      >
        <TemplateEditor
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </Modal>
    )
    
    const modalContent = document.querySelector('.modal-content')
    expect(modalContent).toBeInTheDocument()
    
    if (modalContent) {
      const styles = window.getComputedStyle(modalContent)
      expect(styles.maxHeight).toBe('90vh')
      expect(styles.display).toBe('flex')
      expect(styles.flexDirection).toBe('column')
    }
  })

  it('should have flex layout in TemplateEditor component', () => {
    render(
      <TemplateEditor
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )
    
    // Find the main container with flex styles
    const flexContainer = container.querySelector('div[style*="flex"]')
    expect(flexContainer).toBeInTheDocument()
    
    if (flexContainer) {
      expect(flexContainer).toHaveStyle({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '0'
      })
    }
  })

  it('should render template list view properly', () => {
    render(
      <TemplateEditor
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )
    
    // Check that the custom templates section is rendered
    expect(screen.getByText('Custom Templates')).toBeInTheDocument()
    expect(screen.getByText('Add New Template')).toBeInTheDocument()
  })

  it('should have proper scrolling structure in modal body', () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title="Template Editor"
        size="large"
      >
        <TemplateEditor
          onClose={vi.fn()}
          onSave={vi.fn()}
        />
      </Modal>
    )
    
    const modalBody = document.querySelector('.modal-body')
    expect(modalBody).toBeInTheDocument()
    
    if (modalBody) {
      // Check inline styles
      const bodyElement = modalBody as HTMLElement
      // flex can be '1', '1 1 0%', etc - just check it contains '1'
      expect(bodyElement.style.flex).toContain('1')
      expect(bodyElement.style.overflowY).toBe('auto')
      expect(bodyElement.style.overflowX).toBe('hidden')
      expect(bodyElement.style.minHeight).toBe('0')
      expect(bodyElement.style.maxHeight).toBe('100%')
    }
  })

  it('should maintain content visibility when scrolling', () => {
    render(
      <TemplateEditor
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    )
    
    // Check that the scrollable content area exists
    const scrollableArea = container.querySelector('div[style*="overflow: auto"]')
    expect(scrollableArea).toBeInTheDocument()
    
    // Verify content is within the scrollable area
    const contentSection = screen.getByText('Custom Templates').closest('section')
    expect(contentSection).toBeInTheDocument()
    
    // Check that it's within a scrollable container
    const scrollParent = contentSection?.parentElement
    expect(scrollParent).toHaveStyle({ overflow: 'auto' })
  })
})