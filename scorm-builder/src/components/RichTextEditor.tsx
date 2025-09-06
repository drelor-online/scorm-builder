import React, { useState, useRef, useEffect } from 'react'
import { Button, ButtonGroup, Modal } from './DesignSystem'
import { tokens } from './DesignSystem/designTokens'
import DOMPurify from 'dompurify'

interface RichTextEditorProps {
  content: string
  onSave: (content: string) => void
  onCancel: () => void
  isOpen: boolean
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onSave,
  onCancel,
  isOpen
}) => {
  const [editorContent, setEditorContent] = useState(content)
  const editorRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [selectedHeading, setSelectedHeading] = useState('normal')
  const [isHtmlMode, setIsHtmlMode] = useState(false)
  const hasSetContent = useRef(false)

  useEffect(() => {
    // Reset flag when modal opens/closes
    if (!isOpen) {
      hasSetContent.current = false
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen && !hasSetContent.current) {
      // Wait for modal animation and DOM to be ready
      const initializeContent = () => {
        const sanitizedContent = content ? DOMPurify.sanitize(content) : ''
        setEditorContent(content || '')
        hasSetContent.current = true
        
        if (editorRef.current) {
          editorRef.current.innerHTML = sanitizedContent
          
          // Force the browser to recognize the content change
          if (content) {
            // Move cursor to end of content after a brief delay
            setTimeout(() => {
              if (editorRef.current) {
                editorRef.current.focus()
                // Move cursor to end of content
                const range = document.createRange()
                const sel = window.getSelection()
                if (editorRef.current.childNodes.length > 0) {
                  range.selectNodeContents(editorRef.current)
                  range.collapse(false)
                } else {
                  range.setStart(editorRef.current, 0)
                  range.setEnd(editorRef.current, 0)
                }
                sel?.removeAllRanges()
                sel?.addRange(range)
                editorRef.current.blur()
              }
            }, 50)
          }
        }
        
        if (textareaRef.current) {
          textareaRef.current.value = sanitizedContent
        }
      }

      // Use requestAnimationFrame to wait for Modal animation
      requestAnimationFrame(() => {
        // Additional delay to ensure modal is fully rendered
        setTimeout(initializeContent, 50)
      })
    }
  }, [isOpen]) // Remove content dependency to prevent cursor resets during typing

  // Sync content when mode changes (but not during active editing)
  useEffect(() => {
    if (isHtmlMode && textareaRef.current) {
      textareaRef.current.value = editorContent
    } else if (!isHtmlMode && editorRef.current && hasSetContent.current) {
      // Only update if the content is different to avoid cursor resets
      const currentContent = editorRef.current.innerHTML
      const sanitizedContent = DOMPurify.sanitize(editorContent)
      if (currentContent !== sanitizedContent) {
        // Store cursor position before update
        const selection = window.getSelection()
        let cursorOffset = 0
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          cursorOffset = range.startOffset
        }
        
        editorRef.current.innerHTML = sanitizedContent
        
        // Restore cursor position after update
        if (cursorOffset > 0 && editorRef.current.firstChild) {
          try {
            const newRange = document.createRange()
            const sel = window.getSelection()
            newRange.setStart(editorRef.current.firstChild, Math.min(cursorOffset, editorRef.current.firstChild.textContent?.length || 0))
            newRange.setEnd(editorRef.current.firstChild, Math.min(cursorOffset, editorRef.current.firstChild.textContent?.length || 0))
            sel?.removeAllRanges()
            sel?.addRange(newRange)
          } catch (e) {
            // If cursor restoration fails, just continue without it
            console.warn('Failed to restore cursor position:', e)
          }
        }
      }
    }
  }, [isHtmlMode]) // Remove editorContent dependency to prevent cursor resets

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    if (editorRef.current) {
      setEditorContent(editorRef.current.innerHTML)
    }
  }

  const handleFormat = (format: string) => {
    switch (format) {
      case 'h1':
      case 'h2':
      case 'h3':
        execCommand('formatBlock', format.toUpperCase())
        setSelectedHeading(format)
        break
      case 'normal':
        execCommand('formatBlock', 'P')
        setSelectedHeading('normal')
        break
      default:
        execCommand(format)
    }
  }

  const handleSave = () => {
    let content: string
    if (isHtmlMode && textareaRef.current) {
      content = DOMPurify.sanitize(textareaRef.current.value)
    } else if (editorRef.current) {
      content = DOMPurify.sanitize(editorRef.current.innerHTML)
    } else {
      content = editorContent
    }
    onSave(content)
  }

  const handleToggleMode = () => {
    if (isHtmlMode) {
      // Switching from HTML to Rich Text
      if (textareaRef.current) {
        const htmlContent = textareaRef.current.value
        setEditorContent(htmlContent)
        // The content will be set in the contentEditable div when it renders
      }
    } else {
      // Switching from Rich Text to HTML
      if (editorRef.current) {
        const richContent = editorRef.current.innerHTML
        setEditorContent(richContent)
        // The content will be set in the textarea when it renders
      }
    }
    setIsHtmlMode(!isHtmlMode)
  }

  const handleInput = () => {
    if (isHtmlMode && textareaRef.current) {
      setEditorContent(textareaRef.current.value)
    } else if (editorRef.current) {
      setEditorContent(editorRef.current.innerHTML)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Edit Content"
      size="large"
    >
      <div style={{ padding: '1rem' }}>
        {/* Toolbar */}
        <div style={{
          borderBottom: `1px solid ${tokens.colors.border.default}`,
          paddingBottom: '0.5rem',
          marginBottom: '1rem'
        }}>
          <ButtonGroup gap="small">
            {/* HTML/Rich Text Toggle */}
            <Button
              onClick={handleToggleMode}
              variant={isHtmlMode ? "primary" : "secondary"}
              size="small"
              title={isHtmlMode ? "Switch to Rich Text mode" : "Switch to HTML mode"}
            >
              {isHtmlMode ? "Rich Text" : "HTML"}
            </Button>
            
            {/* Formatting tools - only show in Rich Text mode */}
            {!isHtmlMode && (
              <>
                <select
                  value={selectedHeading}
                  onChange={(e) => handleFormat(e.target.value)}
                  style={{
                    backgroundColor: tokens.colors.background.secondary,
                    color: tokens.colors.text.primary,
                    border: `1px solid ${tokens.colors.border.default}`,
                    borderRadius: '0.375rem',
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="normal">Normal</option>
                  <option value="h1">Heading 1</option>
                  <option value="h2">Heading 2</option>
                  <option value="h3">Heading 3</option>
                </select>
                
                <Button
                  onClick={() => handleFormat('bold')}
                  variant="secondary"
                  size="small"
                  title="Bold"
                >
                  <strong>B</strong>
                </Button>
                
                <Button
                  onClick={() => handleFormat('italic')}
                  variant="secondary"
                  size="small"
                  title="Italic"
                >
                  <em>I</em>
                </Button>
                
                <Button
                  onClick={() => handleFormat('underline')}
                  variant="secondary"
                  size="small"
                  title="Underline"
                >
                  <u>U</u>
                </Button>
                
                <Button
                  onClick={() => handleFormat('insertUnorderedList')}
                  variant="secondary"
                  size="small"
                  title="Bullet List"
                >
                  • List
                </Button>
                
                <Button
                  onClick={() => handleFormat('insertOrderedList')}
                  variant="secondary"
                  size="small"
                  title="Numbered List"
                >
                  1. List
                </Button>
              </>
            )}
          </ButtonGroup>
        </div>

        {/* Editor */}
        {isHtmlMode ? (
          <textarea
            ref={textareaRef}
            onChange={handleInput}
            style={{
              minHeight: '400px',
              maxHeight: '700px',
              width: '100%',
              backgroundColor: tokens.colors.background.tertiary,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: '0.375rem',
              padding: '1rem',
              fontSize: '1rem',
              lineHeight: '1.6',
              color: tokens.colors.text.primary,
              outline: 'none',
              fontFamily: 'monospace',
              resize: 'vertical'
            }}
            placeholder="Enter HTML content..."
          />
        ) : (
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            onInput={handleInput}
            style={{
              minHeight: '400px',
              maxHeight: '700px',
              overflowY: 'auto',
              backgroundColor: tokens.colors.background.tertiary,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: '0.375rem',
              padding: '1rem',
              fontSize: '1rem',
              lineHeight: '1.6',
              color: tokens.colors.text.primary,
              outline: 'none'
            }}
          />
        )}

        {/* Actions */}
        <div style={{
          marginTop: '1.5rem',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <Button onClick={onCancel} variant="secondary">
            Cancel
          </Button>
          <Button onClick={handleSave} variant="primary">
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}