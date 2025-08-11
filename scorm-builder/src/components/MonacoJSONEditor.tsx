import React, { useRef, useEffect, useState } from 'react'
import Editor, { Monaco, OnMount } from '@monaco-editor/react'
import { smartAutoFixJSON } from '../utils/jsonAutoFixer'
import { Button, Alert } from './DesignSystem'
import { AlertCircle, CheckCircle, Wand2, FileCode } from 'lucide-react'

interface MonacoJSONEditorProps {
  value: string
  onChange: (value: string) => void
  onValidate?: (isValid: boolean, errors?: any[]) => void
  height?: string
  readOnly?: boolean
  schema?: any
  showMinimap?: boolean
  theme?: 'light' | 'dark'
}

interface ErrorMarker {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
  message: string
  severity: number
}

export const MonacoJSONEditor: React.FC<MonacoJSONEditorProps> = ({
  value,
  onChange,
  onValidate,
  height = '500px',
  readOnly = false,
  schema,
  showMinimap = false,
  theme = 'light'
}) => {
  const editorRef = useRef<any>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const [errors, setErrors] = useState<ErrorMarker[]>([])
  const [showAutoFixButton, setShowAutoFixButton] = useState(false)
  const [autoFixApplied, setAutoFixApplied] = useState(false)
  const [showFormatButton, setShowFormatButton] = useState(false)
  const [isFixingContent, setIsFixingContent] = useState(false)

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // Configure JSON language features with minimal interference
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemaValidation: 'error',
      comments: 'error',
      trailingCommas: 'error',
      allowComments: false,
      schemas: schema ? [{
        uri: 'http://internal/course-content-schema.json',
        fileMatch: ['*'],
        schema: schema
      }] : []
    })
    
    // Disable ALL formatting-related features
    monaco.languages.registerDocumentFormattingEditProvider('json', {
      provideDocumentFormattingEdits: () => []
    })
    
    monaco.languages.registerDocumentRangeFormattingEditProvider('json', {
      provideDocumentRangeFormattingEdits: () => []
    })
    
    monaco.languages.registerOnTypeFormattingEditProvider('json', {
      autoFormatTriggerCharacters: [],
      provideOnTypeFormattingEdits: () => []
    })
    
    // Override the format document command to do nothing
    if (monaco.KeyMod && monaco.KeyCode) {
      editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
        // Do nothing - formatting disabled
      })
    }

    // Set up model markers listener for error detection
    editor.onDidChangeModelDecorations(() => {
      const model = editor.getModel()
      if (model) {
        const markers = monaco.editor.getModelMarkers({ resource: model.uri })
        setErrors(markers)
        
        // Check if there are parse errors that might be auto-fixable
        const hasParseErrors = markers.some(m => 
          m.message.includes('Expected') || 
          m.message.includes('Invalid') ||
          m.message.includes('Unexpected')
        )
        setShowAutoFixButton(hasParseErrors && !autoFixApplied)
        
        // Show format button if JSON is valid
        if (markers.length === 0 && editor.getValue().trim()) {
          setShowFormatButton(true)
        } else {
          setShowFormatButton(false)
        }
        
        if (onValidate) {
          onValidate(markers.length === 0, markers)
        }
      }
    })

    // Don't auto-format on mount - let user control formatting
  }

  const handleAutoFix = () => {
    if (editorRef.current) {
      const currentValue = editorRef.current.getValue()
      const fixed = smartAutoFixJSON(currentValue)
      
      if (fixed !== currentValue) {
        editorRef.current.setValue(fixed)
        setAutoFixApplied(true)
        
        // Check if JSON is now valid and trigger validation
        try {
          const parsed = JSON.parse(fixed)
          // JSON is valid, trigger onChange to update parent and validate
          onChange(fixed)
          
          // Show success in UI
          setShowFormatButton(true)
          setShowAutoFixButton(false)
          
          // Notify parent that JSON is valid
          if (onValidate) {
            onValidate(true, [])
          }
        } catch {
          // Still has errors after auto-fix
          onChange(fixed)
        }
      }
    }
  }
  
  const handleFormat = () => {
    if (editorRef.current) {
      try {
        // Only format if JSON is valid
        const currentValue = editorRef.current.getValue()
        JSON.parse(currentValue)
        editorRef.current.getAction('editor.action.formatDocument')?.run()
        setShowFormatButton(false)
      } catch {
        // Don't format invalid JSON
      }
    }
  }

  const goToError = (error: ErrorMarker) => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(error.startLineNumber)
      editorRef.current.setPosition({
        lineNumber: error.startLineNumber,
        column: error.startColumn
      })
      editorRef.current.focus()
    }
  }

  // Reset auto-fix flag when content changes
  useEffect(() => {
    setAutoFixApplied(false)
  }, [value])

  return (
    <div className="monaco-json-editor-container">
      <div style={{ 
        border: '1px solid #e2e8f0', 
        borderRadius: '8px',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <Editor
          height={height}
          defaultLanguage="json"
          value={value}
          onChange={(val) => {
            // Skip processing if we're in the middle of fixing content
            if (isFixingContent) {
              return
            }
            
            // Check if the value has been incorrectly formatted with line breaks after colons
            if (val && val.match(/"[^"]*:\s*[\r\n]+[^"]*"/)) {
              // Set flag to prevent recursive calls
              setIsFixingContent(true)
              
              // Fix any line breaks that were added after colons in string values
              // Also clean up carriage returns
              const fixed = val
                .replace(/\r\n/g, '\n')  // Normalize line endings
                .replace(/\r/g, '\n')    // Remove standalone carriage returns
                .replace(/"([^"]*:\s*)[\n\r]+([^"]*)"/g, '"$1 $2"')  // Fix colon line breaks
              
              onChange(fixed)
              
              // Reset flag after a short delay
              setTimeout(() => setIsFixingContent(false), 10)
            } else {
              onChange(val || '')
            }
          }}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: showMinimap },
            readOnly,
            fontSize: 14,
            wordWrap: 'off',  // Disabled to prevent line breaking
            automaticLayout: true,
            scrollBeyondLastLine: false,
            folding: true,
            lineNumbers: 'on',
            glyphMargin: true,
            lineDecorationsWidth: 5,
            renderLineHighlight: 'all',
            quickSuggestions: {
              strings: false,  // Disabled in strings to prevent interference
              comments: false,
              other: true
            },
            formatOnPaste: false,  // Disabled to prevent breaking strings with colons
            formatOnType: false,   // Disabled to prevent breaking strings with colons
            autoClosingBrackets: 'never',  // Disabled to prevent interference
            autoClosingQuotes: 'never',    // Disabled to prevent interference
            autoIndent: 'none',  // Disabled to prevent auto-indentation after colons
            bracketPairColorization: {
              enabled: true
            },
            guides: {
              bracketPairs: true,
              indentation: true
            },
            // Additional settings to preserve string integrity
            acceptSuggestionOnEnter: 'off',  // Prevent Enter from accepting suggestions
            tabCompletion: 'off',  // Disable tab completion
            suggestOnTriggerCharacters: false,  // Don't trigger suggestions on special chars
            wrappingIndent: 'none',  // No indentation when wrapping
            wrappingStrategy: 'simple'  // Simple wrapping strategy
          }}
        />
        
        {/* Button overlay container */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 100,
          display: 'flex',
          gap: '8px',
          flexDirection: 'column',
          alignItems: 'flex-end'
        }}>
          {/* Auto-fix button */}
          {showAutoFixButton && (
            <Button
              variant="secondary"
              size="small"
              onClick={handleAutoFix}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #fbbf24',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <Wand2 size={16} />
              Auto-fix Issues
            </Button>
          )}
          
          {/* Format button */}
          {showFormatButton && (
            <Button
              variant="secondary"
              size="small"
              onClick={handleFormat}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #10b981',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <FileCode size={16} />
              Format JSON
            </Button>
          )}
        </div>
      </div>

      {/* Error panel */}
      {errors.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <Alert variant="error">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertCircle size={20} />
              <strong>{errors.length} {errors.length === 1 ? 'Error' : 'Errors'} Found</strong>
            </div>
            <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
              {errors.map((error, index) => (
                <div
                  key={index}
                  style={{
                    padding: '8px',
                    marginBottom: '4px',
                    backgroundColor: 'rgba(254, 226, 226, 0.5)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(254, 226, 226, 0.8)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(254, 226, 226, 0.5)'
                  }}
                  onClick={() => goToError(error)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 'bold', color: '#dc2626' }}>
                      Line {error.startLineNumber}, Column {error.startColumn}
                    </span>
                    <span style={{ fontSize: '11px', color: '#7f1d1d' }}>
                      Click to navigate
                    </span>
                  </div>
                  <div style={{ marginTop: '4px', color: '#991b1b' }}>
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
        <div style={{ marginTop: '1rem' }}>
          <Alert variant="success">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={20} />
              <strong>Valid JSON</strong>
            </div>
          </Alert>
        </div>
      )}
    </div>
  )
}