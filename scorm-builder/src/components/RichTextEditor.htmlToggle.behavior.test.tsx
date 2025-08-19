import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { RichTextEditor } from './RichTextEditor'

describe('RichTextEditor HTML Toggle Behavior', () => {
  const mockProps = {
    content: '<p>Test content</p>',
    onSave: vi.fn(),
    onCancel: vi.fn(),
    isOpen: true
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('should show HTML/Rich Text toggle button in toolbar', () => {
    render(<RichTextEditor {...mockProps} />)
    
    const htmlToggle = screen.getByRole('button', { name: /html/i })
    expect(htmlToggle).toBeInTheDocument()
  })

  test('should start in Rich Text mode by default', () => {
    render(<RichTextEditor {...mockProps} />)
    
    // Should show rich text editor (contentEditable div)
    const richEditor = screen.getByRole('textbox')
    expect(richEditor).toBeInTheDocument()
    expect(richEditor).toHaveAttribute('contenteditable', 'true')

    // HTML toggle should show "HTML" (meaning we're in Rich Text mode)
    const htmlToggle = screen.getByRole('button', { name: /html/i })
    expect(htmlToggle).toHaveTextContent('HTML')
  })

  test('should switch to HTML mode when toggle is clicked', async () => {
    render(<RichTextEditor {...mockProps} />)
    
    const htmlToggle = screen.getByRole('button', { name: /html/i })
    
    // Click to switch to HTML mode
    fireEvent.click(htmlToggle)
    
    // Should now show textarea with HTML content
    const htmlEditor = screen.getByRole('textbox')
    expect(htmlEditor.tagName.toLowerCase()).toBe('textarea')
    
    // Wait for content to be set in textarea
    await waitFor(() => {
      expect(htmlEditor).toHaveValue('<p>Test content</p>')
    })
    
    // Toggle should now show "Rich Text" (meaning we're in HTML mode)
    expect(htmlToggle).toHaveTextContent('Rich Text')
  })

  test('should hide formatting toolbar when in HTML mode', () => {
    render(<RichTextEditor {...mockProps} />)
    
    // Initially should show formatting buttons
    const boldButton = screen.getByTitle('Bold')
    expect(boldButton).toBeInTheDocument()
    
    // Switch to HTML mode
    const htmlToggle = screen.getByRole('button', { name: /html/i })
    fireEvent.click(htmlToggle)
    
    // Formatting buttons should be hidden
    expect(screen.queryByTitle('Bold')).not.toBeInTheDocument()
  })

  test('should preserve content when switching modes', async () => {
    render(<RichTextEditor {...mockProps} />)
    
    const htmlToggle = screen.getByRole('button', { name: /html/i })
    
    // Switch to HTML mode
    fireEvent.click(htmlToggle)
    
    const htmlEditor = screen.getByRole('textbox') as HTMLTextAreaElement
    await waitFor(() => {
      expect(htmlEditor.value).toContain('<p>Test content</p>')
    })
    
    // Switch back to Rich Text mode
    fireEvent.click(htmlToggle)
    
    const richEditor = screen.getByRole('textbox')
    await waitFor(() => {
      expect(richEditor.innerHTML).toContain('<p>Test content</p>')
    })
  })
})