import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Alert } from './DesignSystem'
import { AlertCircle, CheckCircle, Wand2, FileCode } from 'lucide-react'
import { smartAutoFixJSON } from '../utils/jsonAutoFixer'
import { ConfirmDialog } from './ConfirmDialog'
import './SimpleJSONEditor.css'

interface SimpleJSONEditorProps {
  value: string
  onChange: (value: string) => void
  onValidate?: (isValid: boolean, errors?: any[]) => void
  height?: string
  readOnly?: boolean
  schema?: any
  showMinimap?: boolean
  theme?: 'light' | 'dark'
}

interface ValidationError {
  line: number
  column: number
  message: string
}

export const SimpleJSONEditor: React.FC<SimpleJSONEditorProps> = ({
  value,
  onChange,
  onValidate,
  height = '500px',
  readOnly = false,
  schema,
  showMinimap,
  theme = 'light'
}) => {
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [showAutoFixButton, setShowAutoFixButton] = useState(false)
  const [autoFixApplied, setAutoFixApplied] = useState(false)
  const [showFormatButton, setShowFormatButton] = useState(false)
  const [showAutoFixDialog, setShowAutoFixDialog] = useState(false)
  const [hasShownDialogForSession, setHasShownDialogForSession] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lineNumbersRef = useRef<HTMLDivElement>(null)

  // Calculate line numbers
  const lineCount = value.split('\n').length
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1)

  const validateJSON = useCallback(() => {
    if (!value.trim()) {
      setErrors([])
      setShowAutoFixButton(false)
      setShowFormatButton(false)
      setShowAutoFixDialog(false)
      // Don't call onValidate for empty input - let the parent handle empty state
      return
    }

    try {
      // Try to parse the JSON
      JSON.parse(value)
      
      // JSON is valid
      setErrors([])
      setShowAutoFixButton(false)
      setShowFormatButton(true)
      setShowAutoFixDialog(false)
      setHasShownDialogForSession(false) // Reset for new valid JSON
      
      if (onValidate) {
        onValidate(true, [])
      }
    } catch (error) {
      // JSON has errors
      const errorMessage = (error as Error).message
      const errorInfo = parseJSONError(errorMessage, value)
      
      setErrors([errorInfo])
      setShowAutoFixButton(true)
      setShowFormatButton(false)
      
      // Show auto-fix dialog if we haven't shown it for this session yet
      if (!hasShownDialogForSession && !readOnly) {
        setShowAutoFixDialog(true)
        setHasShownDialogForSession(true)
      }
      
      if (onValidate) {
        onValidate(false, [errorInfo])
      }
    }
  }, [value, onValidate, hasShownDialogForSession, readOnly])

  // Validate JSON whenever value changes
  useEffect(() => {
    if (value) {
      validateJSON()
    }
  }, [value, validateJSON])

  // Parse JSON error message to extract line and column
  const parseJSONError = (errorMessage: string, json: string): ValidationError => {
    // Try to extract position from error message
    const posMatch = errorMessage.match(/position (\d+)/)
    
    if (posMatch) {
      const position = parseInt(posMatch[1])
      const lines = json.split('\n')
      let currentPos = 0
      let lineNumber = 1
      let columnNumber = 1
      
      // Find line and column from position
      for (let i = 0; i < lines.length; i++) {
        const lineLength = lines[i].length + 1 // +1 for newline
        if (currentPos + lineLength > position) {
          lineNumber = i + 1
          columnNumber = position - currentPos + 1
          break
        }
        currentPos += lineLength
      }
      
      return {
        line: lineNumber,
        column: columnNumber,
        message: errorMessage
      }
    }
    
    // Fallback if we can't parse the position
    return {
      line: 1,
      column: 1,
      message: errorMessage
    }
  }

  const handleAutoFix = () => {
    const fixed = smartAutoFixJSON(value)
    
    if (fixed !== value) {
      onChange(fixed)
      setAutoFixApplied(true)
      
      // Check if JSON is now valid
      try {
        JSON.parse(fixed)
        setShowFormatButton(true)
        setShowAutoFixButton(false)
      } catch {
        // Still has errors after auto-fix
      }
    }
    
    // Close dialog after fixing
    setShowAutoFixDialog(false)
  }
  
  const handleCancelAutoFix = () => {
    setShowAutoFixDialog(false)
  }

  const handleFormat = () => {
    try {
      // Parse and format the JSON
      const parsed = JSON.parse(value)
      const formatted = JSON.stringify(parsed, null, 2)
      onChange(formatted)
      setShowFormatButton(false)
    } catch {
      // Don't format invalid JSON
    }
  }

  const goToError = (error: ValidationError) => {
    if (textareaRef.current) {
      // Find the position in the text
      const lines = value.split('\n')
      let position = 0
      
      for (let i = 0; i < error.line - 1 && i < lines.length; i++) {
        position += lines[i].length + 1 // +1 for newline
      }
      position += error.column - 1
      
      // Set cursor position
      textareaRef.current.setSelectionRange(position, position)
      textareaRef.current.focus()
      
      // Scroll to make the error visible
      const lineHeight = 20 // Approximate line height
      const scrollTop = (error.line - 5) * lineHeight
      textareaRef.current.scrollTop = Math.max(0, scrollTop)
    }
  }

  // Sync scroll between textarea and line numbers
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }

  // Handle tab key for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && !readOnly) {
      e.preventDefault()
      const start = e.currentTarget.selectionStart
      const end = e.currentTarget.selectionEnd
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      onChange(newValue)
      
      // Set cursor position after the inserted spaces
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2
          textareaRef.current.selectionEnd = start + 2
        }
      }, 0)
    }
  }

  // Reset auto-fix flag when content changes
  useEffect(() => {
    setAutoFixApplied(false)
  }, [value])

  return (
    <div className={`simple-json-editor ${theme}`}>
      <div className="editor-container" style={{ height }}>
        <div className="editor-wrapper">
          {/* Line numbers */}
          <div 
            ref={lineNumbersRef}
            className="line-numbers"
            aria-hidden="true"
          >
            {lineNumbers.map(num => (
              <div key={num} className="line-number">
                {num}
              </div>
            ))}
          </div>
          
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className="json-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            readOnly={readOnly}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            placeholder="Paste the AI chatbot's response here..."
            aria-label="JSON editor"
            data-testid="json-textarea"
          />
        </div>
        
        {/* Button overlay */}
        {!readOnly && (
          <div className="editor-buttons">
            {/* Format button */}
            {showFormatButton && (
              <Button
                variant="secondary"
                size="small"
                onClick={handleFormat}
                className="format-button"
              >
                <FileCode size={16} />
                Format JSON
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Error panel */}
      {errors.length > 0 && (
        <div className="error-panel">
          <Alert variant="error">
            <div className="error-header">
              <AlertCircle size={20} />
              <strong>{errors.length} {errors.length === 1 ? 'Error' : 'Errors'} Found</strong>
            </div>
            <div className="error-list">
              {errors.map((error, index) => (
                <div
                  key={index}
                  className="error-item"
                  onClick={() => goToError(error)}
                >
                  <div className="error-location">
                    <span className="error-position">
                      Line {error.line}, Column {error.column}
                    </span>
                    <span className="error-hint">
                      Click to navigate
                    </span>
                  </div>
                  <div className="error-message">
                    {error.message}
                  </div>
                </div>
              ))}
            </div>
          </Alert>
        </div>
      )}

      {/* Success message when valid */}
      {errors.length === 0 && value.trim() && (
        <div className="success-panel">
          <Alert variant="success">
            <div className="success-header">
              <CheckCircle size={20} />
              <strong>Valid JSON</strong>
            </div>
          </Alert>
        </div>
      )}
      
      {/* Auto-fix Dialog */}
      <ConfirmDialog
        isOpen={showAutoFixDialog}
        title="JSON Formatting Issues Detected"
        message="There were issues found in the JSON content. Would you like to attempt to fix these issues automatically?"
        confirmText="Fix Automatically"
        cancelText="Cancel"
        variant="info"
        onConfirm={handleAutoFix}
        onCancel={handleCancelAutoFix}
      />
    </div>
  )
}