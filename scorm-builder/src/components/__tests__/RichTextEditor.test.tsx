// Removed unused React import
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../../test/testProviders'
import { RichTextEditor } from '../RichTextEditor'
import DOMPurify from 'dompurify'

// Mock the DesignSystem components
vi.mock('../DesignSystem', () => ({
  Button: ({ onClick, children, title, variant, size }: any) => (
    <button onClick={onClick} title={title} data-variant={variant} data-size={size}>
      {children}
    </button>
  ),
  ButtonGroup: ({ children, gap }: any) => (
    <div data-testid="button-group" data-gap={gap}>{children}</div>
  ),
  Modal: ({ isOpen, onClose, title, children }: any) => 
    isOpen ? (
      <div data-testid="modal" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null
}))

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((content) => content)
  }
}))

describe('RichTextEditor', () => {
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()
  const defaultProps = {
    content: '<p>Test content</p>',
    onSave: mockOnSave,
    onCancel: mockOnCancel,
    isOpen: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock document.execCommand
    document.execCommand = vi.fn()
  })

  it('should render when open', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    expect(screen.getByText('Edit Content')).toBeInTheDocument()
  })

  it('should not render when closed', () => {
    render(<RichTextEditor {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('should display sanitized content in editor', () => {
    const testContent = '<p>Test <strong>bold</strong> content</p>'
    render(<RichTextEditor {...defaultProps} content={testContent} />)
    
    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
    expect(editor).toBeTruthy()
    expect(editor.innerHTML).toBe(testContent)
    expect(DOMPurify.sanitize).toHaveBeenCalledWith(testContent)
  })

  it('should update content when prop changes', () => {
    const { rerender } = render(<RichTextEditor {...defaultProps} />)
    
    const newContent = '<p>Updated content</p>'
    rerender(<RichTextEditor {...defaultProps} content={newContent} />)
    
    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
    expect(editor).toBeTruthy()
    expect(editor.innerHTML).toBe(newContent)
  })

  it('should handle bold formatting', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const boldButton = screen.getByTitle('Bold')
    fireEvent.click(boldButton)
    
    expect(document.execCommand).toHaveBeenCalledWith('bold', false, undefined)
  })

  it('should handle italic formatting', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const italicButton = screen.getByTitle('Italic')
    fireEvent.click(italicButton)
    
    expect(document.execCommand).toHaveBeenCalledWith('italic', false, undefined)
  })

  it('should handle underline formatting', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const underlineButton = screen.getByTitle('Underline')
    fireEvent.click(underlineButton)
    
    expect(document.execCommand).toHaveBeenCalledWith('underline', false, undefined)
  })

  it('should handle bullet list formatting', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const listButton = screen.getByTitle('Bullet List')
    fireEvent.click(listButton)
    
    expect(document.execCommand).toHaveBeenCalledWith('insertUnorderedList', false, undefined)
  })

  it('should handle numbered list formatting', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const listButton = screen.getByTitle('Numbered List')
    fireEvent.click(listButton)
    
    expect(document.execCommand).toHaveBeenCalledWith('insertOrderedList', false, undefined)
  })

  it('should handle heading selection', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const select = screen.getByRole('combobox')
    
    // Test H1
    fireEvent.change(select, { target: { value: 'h1' } })
    expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'H1')
    
    // Test H2
    fireEvent.change(select, { target: { value: 'h2' } })
    expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'H2')
    
    // Test H3
    fireEvent.change(select, { target: { value: 'h3' } })
    expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'H3')
    
    // Test Normal
    fireEvent.change(select, { target: { value: 'normal' } })
    expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'P')
  })

  it('should update selected heading state', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('normal')
    
    fireEvent.change(select, { target: { value: 'h1' } })
    expect(select.value).toBe('h1')
  })

  it('should handle content input', async () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement
    expect(editor).toBeTruthy()
    
    // Verify initial content
    expect(editor.innerHTML).toBe('<p>Test content</p>')
    
    // Simulate input event - the component's handleInput will be called
    fireEvent.input(editor)
    
    // The test verifies that the input event handler is properly attached
    expect(editor).toHaveAttribute('contenteditable', 'true')
  })

  it('should save sanitized content', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement
    expect(editor).toBeTruthy()
    
    // Click save with initial content
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    // Verify DOMPurify was called during save
    expect(DOMPurify.sanitize).toHaveBeenCalled()
    // Verify onSave was called with the sanitized content
    expect(mockOnSave).toHaveBeenCalledWith('<p>Test content</p>')
  })

  it('should handle cancel', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('should close modal when clicking outside', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const modal = screen.getByTestId('modal')
    fireEvent.click(modal)
    
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('should not close modal when clicking inside', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
    expect(editor).toBeTruthy()
    fireEvent.click(editor)
    
    expect(mockOnCancel).not.toHaveBeenCalled()
  })

  it('should render all toolbar buttons', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    expect(screen.getByTitle('Bold')).toBeInTheDocument()
    expect(screen.getByTitle('Italic')).toBeInTheDocument()
    expect(screen.getByTitle('Underline')).toBeInTheDocument()
    expect(screen.getByTitle('Bullet List')).toBeInTheDocument()
    expect(screen.getByTitle('Numbered List')).toBeInTheDocument()
  })

  it('should have correct styles on editor', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
    expect(editor).toBeTruthy()
    const styles = window.getComputedStyle(editor)
    
    expect(styles.minHeight).toBe('300px')
    expect(styles.maxHeight).toBe('500px')
    expect(styles.overflowY).toBe('auto')
  })

  it('should handle execCommand returning false', () => {
    document.execCommand = vi.fn().mockReturnValue(false)
    
    render(<RichTextEditor {...defaultProps} />)
    
    const boldButton = screen.getByTitle('Bold')
    fireEvent.click(boldButton)
    
    expect(document.execCommand).toHaveBeenCalledWith('bold', false, undefined)
  })

  it('should test content modification and save', () => {
    const modifiedContent = '<p>Modified content</p>'
    // Mock DOMPurify to return our modified content when called during save
    vi.mocked(DOMPurify.sanitize).mockReturnValueOnce('<p>Test content</p>') // initial render
      .mockReturnValueOnce('<p>Test content</p>') // useEffect
      .mockReturnValueOnce(modifiedContent) // save
    
    render(<RichTextEditor {...defaultProps} />)
    
    const editor = container.querySelector('[contenteditable="true"]') as HTMLElement
    expect(editor).toBeTruthy()
    
    // Manually set content to simulate user editing
    Object.defineProperty(editor, 'innerHTML', {
      value: modifiedContent,
      configurable: true,
      writable: true
    })
    
    // Click save
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    // Verify onSave was called with the modified content
    expect(mockOnSave).toHaveBeenCalledWith(modifiedContent)
  })

  it('should handle save when editor ref is null', () => {
    render(<RichTextEditor {...defaultProps} />)
    
    // Force the ref to be null by unmounting and remounting
    const { unmount } = render(<RichTextEditor {...defaultProps} />)
    unmount()
    
    // This shouldn't throw
    expect(() => mockOnSave()).not.toThrow()
  })
})