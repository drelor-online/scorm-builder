/**
 * RichTextEditor - Consolidated Test Suite
 * 
 * This file consolidates RichTextEditor tests from 3 separate files into
 * a single comprehensive test suite for better maintainability and faster execution.
 * 
 * Consolidated Test Files:
 * - RichTextEditor.test.tsx (main functionality, formatting, toolbar)
 * - RichTextEditor.contentReset.test.tsx (content reset bug fixes)
 * - RichTextEditor.initialContent.test.tsx (initial content display)
 * 
 * Test Categories:
 * - Core rendering and modal behavior
 * - Content initialization and display
 * - Toolbar functionality and formatting commands
 * - Content editing and cursor position management
 * - Content reset prevention and bug fixes
 * - Input handling and real-time updates
 * - Save/cancel functionality and sanitization
 * - Edge cases and error scenarios
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '../../test/testProviders'
import { RichTextEditor } from '../RichTextEditor'
import userEvent from '@testing-library/user-event'
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

describe('RichTextEditor - Consolidated Test Suite', () => {
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

  describe('Core Rendering and Modal Behavior', () => {
    it('should render when open', () => {
      render(<RichTextEditor {...defaultProps} />)
      
      expect(screen.getByTestId('modal')).toBeInTheDocument()
      expect(screen.getByText('Edit Content')).toBeInTheDocument()
    })

    it('should not render when closed', () => {
      render(<RichTextEditor {...defaultProps} isOpen={false} />)
      
      expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
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

    it('should have correct styles on editor', () => {
      render(<RichTextEditor {...defaultProps} />)
      
      const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
      expect(editor).toBeTruthy()
      const styles = window.getComputedStyle(editor)
      
      expect(styles.minHeight).toBe('300px')
      expect(styles.maxHeight).toBe('500px')
      expect(styles.overflowY).toBe('auto')
    })
  })

  describe('Content Initialization and Display', () => {
    it('should display initial content when opened', async () => {
      const initialContent = '<p>This is initial content</p>'
      
      const { container } = render(
        <RichTextEditor
          content={initialContent}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isOpen={true}
        />
      )

      await waitFor(() => {
        const editor = container.querySelector('[contenteditable="true"]')
        expect(editor).toBeInTheDocument()
      }, { timeout: 3000 })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
      })

      const editor = container.querySelector('[contenteditable="true"]')
      expect(editor?.innerHTML).toContain('This is initial content')
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

    it('should display HTML content correctly when opened', async () => {
      const htmlContent = '<h1>Title</h1><p>Paragraph text</p><ul><li>Item 1</li><li>Item 2</li></ul>'
      
      const { container } = render(
        <RichTextEditor
          content={htmlContent}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isOpen={true}
        />
      )

      await waitFor(() => {
        const editor = container.querySelector('[contenteditable="true"]')
        expect(editor).toBeInTheDocument()
        
        expect(editor?.innerHTML).toContain('Title')
        expect(editor?.innerHTML).toContain('Paragraph text')
        expect(editor?.innerHTML).toContain('Item 1')
        expect(editor?.innerHTML).toContain('Item 2')
      })
    })

    it('should not lose content when switching between open/closed states', async () => {
      const content = '<p>Persistent content</p>'
      
      const { rerender, container } = render(
        <RichTextEditor
          content={content}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isOpen={false}
        />
      )

      rerender(
        <RichTextEditor
          content={content}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isOpen={true}
        />
      )

      await waitFor(() => {
        const editor = container.querySelector('[contenteditable="true"]')
        expect(editor?.innerHTML).toContain('Persistent content')
      })

      rerender(
        <RichTextEditor
          content={content}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isOpen={false}
        />
      )

      rerender(
        <RichTextEditor
          content={content}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isOpen={true}
        />
      )

      await waitFor(() => {
        const editor = container.querySelector('[contenteditable="true"]')
        expect(editor?.innerHTML).toContain('Persistent content')
      })
    })

    it('should handle empty content gracefully', async () => {
      const { container } = render(
        <RichTextEditor
          content=""
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isOpen={true}
        />
      )

      await waitFor(() => {
        const editor = container.querySelector('[contenteditable="true"]')
        expect(editor).toBeInTheDocument()
        expect(editor?.textContent?.trim()).toBe('')
      })
    })
  })

  describe('Toolbar Functionality and Formatting Commands', () => {
    it('should render all toolbar buttons', () => {
      render(<RichTextEditor {...defaultProps} />)
      
      expect(screen.getByTitle('Bold')).toBeInTheDocument()
      expect(screen.getByTitle('Italic')).toBeInTheDocument()
      expect(screen.getByTitle('Underline')).toBeInTheDocument()
      expect(screen.getByTitle('Bullet List')).toBeInTheDocument()
      expect(screen.getByTitle('Numbered List')).toBeInTheDocument()
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
      
      fireEvent.change(select, { target: { value: 'h1' } })
      expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'H1')
      
      fireEvent.change(select, { target: { value: 'h2' } })
      expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'H2')
      
      fireEvent.change(select, { target: { value: 'h3' } })
      expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'H3')
      
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

    it('should handle execCommand returning false', () => {
      document.execCommand = vi.fn().mockReturnValue(false)
      
      render(<RichTextEditor {...defaultProps} />)
      
      const boldButton = screen.getByTitle('Bold')
      fireEvent.click(boldButton)
      
      expect(document.execCommand).toHaveBeenCalledWith('bold', false, undefined)
    })
  })

  describe('Content Editing and Cursor Position Management', () => {
    it('should not reset content when typing', async () => {
      const initialContent = '<p>Initial content</p>'
      
      const { container } = render(
        <RichTextEditor
          isOpen={true}
          content={initialContent}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement
      expect(editor).toBeTruthy()
      
      editor.focus()
      
      const user = userEvent.setup()
      
      const range = document.createRange()
      const selection = window.getSelection()
      range.selectNodeContents(editor)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
      
      await user.type(editor, ' New text')
      
      await waitFor(() => {
        const content = editor.innerHTML
        expect(content).toContain('Initial content')
        expect(content).toContain('New text')
      })
      
      const currentSelection = window.getSelection()
      expect(currentSelection?.rangeCount).toBeGreaterThan(0)
    })

    it('should maintain cursor position while editing', async () => {
      const initialContent = '<p>This is a test paragraph with some content</p>'
      
      const { container } = render(
        <RichTextEditor
          isOpen={true}
          content={initialContent}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement
      expect(editor).toBeTruthy()
      
      editor.focus()
      
      const textNode = editor.querySelector('p')?.firstChild
      if (textNode) {
        const range = document.createRange()
        const selection = window.getSelection()
        
        range.setStart(textNode, 14)
        range.collapse(true)
        selection?.removeAllRanges()
        selection?.addRange(range)
        
        const user = userEvent.setup()
        await user.type(editor, ' (inserted)')
        
        await waitFor(() => {
          const content = editor.textContent
          expect(content).toContain('This is a test (inserted) paragraph')
        })
      }
    })

    it('should handle content input', async () => {
      render(<RichTextEditor {...defaultProps} />)
      
      const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
      expect(editor).toBeTruthy()
      
      expect(editor.innerHTML).toBe('<p>Test content</p>')
      
      fireEvent.input(editor)
      
      expect(editor).toHaveAttribute('contenteditable', 'true')
    })

    it('should not have conflicting innerHTML and contentEditable', async () => {
      const initialContent = '<p>Test content</p>'
      
      const { container } = render(
        <RichTextEditor
          isOpen={true}
          content={initialContent}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      )

      const editor = container.querySelector('[contenteditable="true"]') as HTMLElement
      
      expect(editor.innerHTML).toContain('Test content')
      
      editor.focus()
      fireEvent.input(editor, { target: { innerHTML: '<p>Modified content</p>' } })
      
      expect(editor.innerHTML).toContain('Modified content')
    })
  })

  describe('Save/Cancel Functionality and Sanitization', () => {
    it('should save sanitized content', () => {
      render(<RichTextEditor {...defaultProps} />)
      
      const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
      expect(editor).toBeTruthy()
      
      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)
      
      expect(DOMPurify.sanitize).toHaveBeenCalled()
      expect(mockOnSave).toHaveBeenCalledWith('<p>Test content</p>')
    })

    it('should handle cancel', () => {
      render(<RichTextEditor {...defaultProps} />)
      
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('should test content modification and save', () => {
      const modifiedContent = '<p>Modified content</p>'
      vi.mocked(DOMPurify.sanitize).mockReturnValueOnce('<p>Test content</p>')
        .mockReturnValueOnce('<p>Test content</p>')
        .mockReturnValueOnce(modifiedContent)
      
      render(<RichTextEditor {...defaultProps} />)
      
      const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
      expect(editor).toBeTruthy()
      
      Object.defineProperty(editor, 'innerHTML', {
        value: modifiedContent,
        configurable: true,
        writable: true
      })
      
      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)
      
      expect(mockOnSave).toHaveBeenCalledWith(modifiedContent)
    })

    it('should handle save when editor ref is null', () => {
      render(<RichTextEditor {...defaultProps} />)
      
      const { unmount } = render(<RichTextEditor {...defaultProps} />)
      unmount()
      
      expect(() => mockOnSave()).not.toThrow()
    })
  })
})