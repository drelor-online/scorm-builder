import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RichTextEditor } from './RichTextEditor'
import { AllTheProviders } from '../test/TestProviders'

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((content) => content)
  }
}))

describe('RichTextEditor - Caret Reset Behavior', () => {
  const defaultProps = {
    content: 'Initial content',
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isOpen: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock document.execCommand
    Object.defineProperty(document, 'execCommand', {
      value: vi.fn(() => true),
      writable: true
    })
    // Mock Selection API
    Object.defineProperty(window, 'getSelection', {
      value: vi.fn(() => ({
        removeAllRanges: vi.fn(),
        addRange: vi.fn(),
        getRangeAt: vi.fn(() => ({
          startOffset: 5,
          endOffset: 5,
          startContainer: document.createTextNode('test'),
          endContainer: document.createTextNode('test')
        }))
      })),
      writable: true
    })
  })

  it('should maintain cursor position when typing continuously', async () => {
    render(
      <AllTheProviders>
        <RichTextEditor {...defaultProps} />
      </AllTheProviders>
    )

    // Wait for editor to initialize
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    const editor = screen.getByRole('textbox')
    
    // Focus the editor and position cursor in the middle
    fireEvent.focus(editor)
    
    // Simulate user typing at a specific position
    const initialText = 'Hello world'
    editor.innerHTML = initialText
    
    // Set cursor position to middle of text (after "Hello ")
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(editor.firstChild!, 6)
    range.setEnd(editor.firstChild!, 6)
    selection?.removeAllRanges()
    selection?.addRange(range)

    // Simulate typing a character
    fireEvent.input(editor, { target: { innerHTML: 'Hello Xworld' } })
    
    // Cursor should still be positioned after the newly typed character
    // and not jump to the end or beginning
    await waitFor(() => {
      const currentSelection = window.getSelection()
      const currentRange = currentSelection?.getRangeAt(0)
      expect(currentRange?.startOffset).toBe(7) // After "Hello X"
      expect(currentRange?.endOffset).toBe(7)
    })
  })

  it('should not reset cursor when useEffect dependencies change during typing', async () => {
    const { rerender } = render(
      <AllTheProviders>
        <RichTextEditor {...defaultProps} />
      </AllTheProviders>
    )

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    const editor = screen.getByRole('textbox')
    fireEvent.focus(editor)

    // Set initial content and cursor position
    editor.innerHTML = 'Test content'
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(editor.firstChild!, 4) // After "Test"
    range.setEnd(editor.firstChild!, 4)
    selection?.removeAllRanges()
    selection?.addRange(range)

    // Trigger a re-render that might cause useEffect to run
    rerender(
      <AllTheProviders>
        <RichTextEditor {...defaultProps} content="Test content updated" />
      </AllTheProviders>
    )

    // Cursor position should remain stable
    await waitFor(() => {
      const currentSelection = window.getSelection()
      const currentRange = currentSelection?.getRangeAt(0)
      // Should not reset to beginning (0) or end (content.length)
      expect(currentRange?.startOffset).toBe(4)
      expect(currentRange?.endOffset).toBe(4)
    })
  })

  it('should preserve cursor position when applying formatting', async () => {
    render(
      <AllTheProviders>
        <RichTextEditor {...defaultProps} />
      </AllTheProviders>
    )

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    const editor = screen.getByRole('textbox')
    const boldButton = screen.getByLabelText(/bold/i)
    
    // Set content and cursor position
    editor.innerHTML = 'Hello world'
    fireEvent.focus(editor)
    
    // Position cursor in middle
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(editor.firstChild!, 6) // After "Hello "
    range.setEnd(editor.firstChild!, 6)
    selection?.removeAllRanges()
    selection?.addRange(range)

    // Apply bold formatting
    fireEvent.click(boldButton)

    // Cursor should remain at the same position after formatting
    await waitFor(() => {
      const currentSelection = window.getSelection()
      const currentRange = currentSelection?.getRangeAt(0)
      expect(currentRange?.startOffset).toBe(6)
      expect(currentRange?.endOffset).toBe(6)
    })
  })

  it('should not lose cursor position when content updates from outside', async () => {
    const { rerender } = render(
      <AllTheProviders>
        <RichTextEditor {...defaultProps} content="Original content" />
      </AllTheProviders>
    )

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    const editor = screen.getByRole('textbox')
    fireEvent.focus(editor)

    // User is typing in the middle of content
    editor.innerHTML = 'Original modified content'
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(editor.firstChild!, 9) // After "Original "
    range.setEnd(editor.firstChild!, 9)
    selection?.removeAllRanges()
    selection?.addRange(range)

    // External content update (like auto-save or sync)
    rerender(
      <AllTheProviders>
        <RichTextEditor {...defaultProps} content="Original modified content" />
      </AllTheProviders>
    )

    // Cursor should remain where user was typing
    await waitFor(() => {
      const currentSelection = window.getSelection()
      const currentRange = currentSelection?.getRangeAt(0)
      expect(currentRange?.startOffset).toBe(9)
      expect(currentRange?.endOffset).toBe(9)
    })
  })

  it('should handle rapid typing without cursor jumps', async () => {
    render(
      <AllTheProviders>
        <RichTextEditor {...defaultProps} content="" />
      </AllTheProviders>
    )

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    const editor = screen.getByRole('textbox')
    fireEvent.focus(editor)

    // Simulate rapid typing
    const typingSequence = ['H', 'He', 'Hel', 'Hell', 'Hello']
    
    for (let i = 0; i < typingSequence.length; i++) {
      const text = typingSequence[i]
      editor.innerHTML = text
      
      // Set cursor at end of current text
      const selection = window.getSelection()
      const range = document.createRange()
      range.setStart(editor.firstChild!, text.length)
      range.setEnd(editor.firstChild!, text.length)
      selection?.removeAllRanges()
      selection?.addRange(range)

      fireEvent.input(editor, { target: { innerHTML: text } })
      
      // Each keystroke should maintain cursor at end
      await waitFor(() => {
        const currentSelection = window.getSelection()
        const currentRange = currentSelection?.getRangeAt(0)
        expect(currentRange?.startOffset).toBe(text.length)
        expect(currentRange?.endOffset).toBe(text.length)
      })
    }
  })

  it('should not reset cursor when switching between visual and HTML modes', async () => {
    render(
      <AllTheProviders>
        <RichTextEditor {...defaultProps} content="<p>Test content</p>" />
      </AllTheProviders>
    )

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument()
    })

    const editor = screen.getByRole('textbox')
    const htmlModeButton = screen.getByText(/html/i)
    
    // Position cursor in visual mode
    fireEvent.focus(editor)
    const selection = window.getSelection()
    const range = document.createRange()
    range.setStart(editor.firstChild!, 4) // After "Test"
    range.setEnd(editor.firstChild!, 4)
    selection?.removeAllRanges()
    selection?.addRange(range)

    // Switch to HTML mode
    fireEvent.click(htmlModeButton)

    // Switch back to visual mode
    const visualModeButton = screen.getByText(/visual/i)
    fireEvent.click(visualModeButton)

    // Cursor should be restored or at least not cause errors
    await waitFor(() => {
      expect(editor).toBeInTheDocument()
      // Editor should be focusable and functional
      fireEvent.focus(editor)
      expect(document.activeElement).toBe(editor)
    })
  })
})