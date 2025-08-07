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
  const [selectedHeading, setSelectedHeading] = useState('normal')
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
        if (editorRef.current) {
          // Set the content directly in the contentEditable div
          // Handle both empty and populated content
          const sanitizedContent = content ? DOMPurify.sanitize(content) : ''
          editorRef.current.innerHTML = sanitizedContent
          setEditorContent(content || '')
          hasSetContent.current = true
          
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
      }

      // Use requestAnimationFrame to wait for Modal animation
      requestAnimationFrame(() => {
        // Additional delay to ensure modal is fully rendered
        setTimeout(initializeContent, 50)
      })
    }
  }, [isOpen, content])

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
    if (editorRef.current) {
      const cleanedContent = DOMPurify.sanitize(editorRef.current.innerHTML)
      onSave(cleanedContent)
    }
  }

  const handleInput = () => {
    if (editorRef.current) {
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
          </ButtonGroup>
        </div>

        {/* Editor */}
        <div
          ref={editorRef}
          contentEditable
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