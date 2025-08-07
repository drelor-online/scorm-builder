import React, { useState, useEffect } from 'react'
import { CourseContent } from '../types/aiPrompt'
import { PageLayout } from './PageLayout'
import { 
  Button, 
  Card, 
  Input, 
  ButtonGroup,
  Section,
  Flex,
  Icon
} from './DesignSystem'
import { Toast } from './Toast'
import { ConfirmDialog } from './ConfirmDialog'
import { Clipboard, FileText, Trash2, CheckCircle } from 'lucide-react'
// import { useUndoRedo } from '../hooks/useUndoRedo' // Removed undo/redo functionality
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected'
import './DesignSystem/designSystem.css'
import { useStorage } from '../contexts/PersistentStorageContext'

interface JSONImportValidatorProps {
  onNext: (data: CourseContent) => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
}

// Alert component for validation results
const Alert: React.FC<{ 
  type: 'error' | 'success'
  title: string
  children: React.ReactNode 
}> = ({ type, title, children }) => (
  <div className={`alert alert-${type}`} style={{
    backgroundColor: type === 'success' ? '#16a34a' : '#dc2626',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    color: '#ffffff', // Pure white for maximum contrast
    marginBottom: '1.5rem', // Add proper spacing from buttons below
    marginTop: '1rem'
  }}>
    <h3 style={{
      fontSize: '1.125rem',
      fontWeight: 600,
      margin: '0 0 0.5rem 0',
      color: '#ffffff' // Ensure heading is also white
    }}>
      {title}
    </h3>
    <div style={{ margin: 0, color: '#ffffff' }}>
      {typeof children === 'string' && children.includes('\n') ? (
        <pre style={{ 
          margin: 0, 
          fontFamily: 'monospace',
          fontSize: '0.875rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: '#ffffff' // Ensure pre text is white
        }}>
          {children}
        </pre>
      ) : (
        <p style={{ margin: 0, color: '#ffffff' }}>
          {children}
        </p>
      )}
    </div>
  </div>
)

export const JSONImportValidator: React.FC<JSONImportValidatorProps> = ({ 
  onNext, 
  onBack, 
  onSettingsClick, 
  onSave, 
  onSaveAs,
  onOpen, 
  onHelp,
  onStepClick
}) => {
  const storage = useStorage()
  // Always start with empty JSON input - users should paste their own content
  const [jsonInput, setJsonInput] = useState('')
  
  const [validationResult, setValidationResult] = useState<any>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  
  // Load persisted JSON import data on mount
  useEffect(() => {
    const loadPersistedValidationState = async () => {
      if (storage && storage.isInitialized) {
        try {
          // Try to load the complete JSON import data
          const jsonImportData = await storage.getContent('json-import-data')
          if (jsonImportData) {
            // Restore all state from the saved data
            if (jsonImportData.rawJson) {
              setJsonInput(jsonImportData.rawJson)
            }
            if (jsonImportData.validationResult) {
              setValidationResult(jsonImportData.validationResult)
            }
            if (jsonImportData.isLocked !== undefined) {
              setIsLocked(jsonImportData.isLocked)
            }
          } else {
            // Fallback to old format for backward compatibility
            const persistedValidation = await storage.getContent('json-validation-state')
            if (persistedValidation) {
              setValidationResult(persistedValidation)
              // If we have a valid validation result, lock the input
              if (persistedValidation.isValid) {
                setIsLocked(true)
              }
            }
          }
        } catch (error) {
          console.error('Error loading persisted validation state:', error)
        }
      }
    }
    
    loadPersistedValidationState()
  }, [storage?.isInitialized])
  
  // Persist validation state AND raw JSON when it changes
  useEffect(() => {
    const persistValidationState = async () => {
      if (storage && storage.isInitialized) {
        try {
          // Save both the validation result and the raw JSON input
          const jsonImportData = {
            rawJson: jsonInput,
            validationResult: validationResult,
            isLocked: isLocked
          }
          await storage.saveContent('json-import-data', jsonImportData)
        } catch (error) {
          console.error('Error persisting validation state:', error)
        }
      }
    }
    
    persistValidationState()
  }, [jsonInput, validationResult, isLocked, storage?.isInitialized])
  
  // Removed logic that would update jsonInput from initialData - users should paste their own content
  
  // JSON input state is tracked but not auto-saved to localStorage anymore
  
  const handlePasteFromClipboard = async () => {
    if (isLocked) {
      setToast({ message: 'Please clear the current JSON before pasting new content.', type: 'info' })
      return
    }
    
    try {
      const text = await navigator.clipboard.readText()
      setJsonInput(text)
      setToast({ message: 'Pasted from clipboard!', type: 'success' })
    } catch (err) {
      // Show user-friendly error without console.error
      setToast({ message: 'Failed to read from clipboard. Please paste manually or check browser permissions.', type: 'error' })
    }
  }

  const validateJSON = () => {
    // Clear previous validation result
    setValidationResult(null)
    
    let processedInput = jsonInput
    
    try {
      
      if (!processedInput.trim()) {
        setValidationResult({ isValid: false, error: 'Please enter JSON data' })
        return
      }
      
      // IMMEDIATE PRE-PROCESSING - Fix smart quotes before any other processing
      const originalLength = processedInput.length
      processedInput = processedInput
        .replace(/'/g, "'")  // Left smart apostrophe
        .replace(/'/g, "'")  // Right smart apostrophe
        .replace(/"/g, '"')  // Left smart quote
        .replace(/"/g, '"')  // Right smart quote
        .replace(/…/g, '...')  // Ellipsis
        .replace(/–/g, '-')    // En dash
        .replace(/—/g, '--')   // Em dash
        // Unicode replacements
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
        .replace(/[\u2026]/g, '...')
        .replace(/[\u2013]/g, '-')
        .replace(/[\u2014]/g, '--')
      
      if (processedInput.length !== originalLength || processedInput !== jsonInput) {
        console.log('Pre-processed input to fix smart quotes')
        setJsonInput(processedInput) // Update the input field immediately
      }
      
      // Early detection of problematic characters
      const problematicChars: Array<[string, string]> = [
        ['\u2018', 'left smart apostrophe'],
        ['\u2019', 'right smart apostrophe'], 
        ['\u201C', 'left smart quote'],
        ['\u201D', 'right smart quote'],
        ['\u2026', 'ellipsis'],
        ['\u2013', 'en dash'],
        ['\u2014', 'em dash']
      ]
      
      for (const [char, name] of problematicChars) {
        if (processedInput.includes(char)) {
          console.log(`WARNING: Still found ${name} (${char}) after pre-processing!`)
        }
      }

      // Attempt to auto-fix common issues
      let fixedJson = processedInput
      let fixes: string[] = []
      
      // CRITICAL: Check for the specific error we're seeing
      console.log("=== JSON Validation Debug ===")
      console.log("Original input length:", jsonInput.length)
      console.log("Processed input length:", processedInput.length)
      
      // First, try to parse the processed JSON to see if it's valid
      let originalError: Error | null = null
      try {
        JSON.parse(processedInput)
        console.log("Processed JSON is valid after smart quote fixes!")
      } catch (e) {
        originalError = e as Error
        console.log("Processed JSON parse error:", originalError.message)
        
        // Extract position from error if available
        const posMatch = originalError.message.match(/position (\d+)/)
        if (posMatch) {
          const errorPos = parseInt(posMatch[1])
          console.log(`Error at position ${errorPos}:`)
          console.log(`Character: "${processedInput.charAt(errorPos)}" (code: ${processedInput.charCodeAt(errorPos)})`)
          console.log(`Context: ...${processedInput.substring(Math.max(0, errorPos - 20), Math.min(processedInput.length, errorPos + 20))}...`)
        }
      }
      
      // Early return if pre-processing fixed everything
      if (!originalError) {
        // The JSON is valid after pre-processing
        const parsedData = JSON.parse(processedInput) as CourseContent
        setValidationResult({
          isValid: true,
          data: parsedData,
          summary: `Successfully parsed! Contains ${parsedData.topics?.length || 0} topics.`
        })
        setToast({ 
          message: 'JSON automatically fixed and validated successfully!', 
          type: 'success' 
        })
        setIsLocked(true)
        return
      }
      
      // Fix smart quotes automatically - be very aggressive
      const smartQuotesBefore = fixedJson
      
      // First pass - replace common smart quotes
      fixedJson = fixedJson
        .replace(/'/g, "'")  // Replace all left smart apostrophes
        .replace(/'/g, "'")  // Replace all right smart apostrophes  
        .replace(/"/g, '"')  // Replace all left smart quotes
        .replace(/"/g, '"')  // Replace all right smart quotes
        .replace(/…/g, '...')  // Replace ellipsis character with three dots
        .replace(/–/g, '-')    // Replace en dash with hyphen
        .replace(/—/g, '--')   // Replace em dash with double hyphen
        
      // Second pass - catch any Unicode apostrophes and quotes
      // Unicode ranges for various quote characters
      fixedJson = fixedJson
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'") // Various apostrophes
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"') // Various quotes
        .replace(/[\u2026]/g, '...') // Ellipsis
        .replace(/[\u2013]/g, '-')   // En dash
        .replace(/[\u2014]/g, '--')  // Em dash
      
      if (fixedJson !== smartQuotesBefore) {
        fixes.push('Fixed smart quotes and special characters')
        
        // Log what was fixed for debugging
        const replacements = []
        if (smartQuotesBefore.includes('\u2018') || smartQuotesBefore.includes('\u2019')) replacements.push('smart apostrophes')
        if (smartQuotesBefore.includes('\u201C') || smartQuotesBefore.includes('\u201D')) replacements.push('smart quotes')
        if (smartQuotesBefore.includes('\u2026')) replacements.push('ellipsis')
        if (smartQuotesBefore.includes('\u2013') || smartQuotesBefore.includes('\u2014')) replacements.push('dashes')
        console.log('Fixed characters:', replacements.join(', '))
      }
      
      // Fix trailing commas
      const trailingCommaRegex = /,\s*([}\]])/g
      if (trailingCommaRegex.test(fixedJson)) {
        fixedJson = fixedJson.replace(trailingCommaRegex, '$1')
        fixes.push('Removed trailing commas')
      }
      
      // Fix single quotes to double quotes
      const singleQuoteRegex = /'([^']*)'/g
      if (singleQuoteRegex.test(fixedJson)) {
        fixedJson = fixedJson.replace(singleQuoteRegex, '"$1"')
        fixes.push('Converted single quotes to double quotes')
      }
      
      // Fix backslash issues more comprehensively
      const backslashBefore = fixedJson
      
      // First, fix obvious LaTeX patterns that are not properly escaped
      // Common LaTeX commands that should be double-escaped in JSON
      const latexCommands = ['times', 'Omega', 'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'mu', 'pi', 'sigma', 'tau', 'phi', 'omega']
      
      // Log when we find Omega specifically since that's causing the error
      if (fixedJson.includes('$\\Omega$')) {
        console.log('Found LaTeX Omega expression that needs fixing')
      }
      
      for (const cmd of latexCommands) {
        // Look for single backslash followed by the command
        const singleBackslashPattern = new RegExp(`(\\$[^$]*?)(\\\\${cmd})([^$]*?\\$)`, 'g')
        fixedJson = fixedJson.replace(singleBackslashPattern, (match, before, command, after) => {
          // Check if it's already double-escaped
          if (!match.includes(`\\\\\\\\${cmd}`)) {
            console.log(`Fixing LaTeX command: \\${cmd} to \\\\${cmd}`)
            return before + '\\\\' + command + after
          }
          return match
        })
      }
      
      // More targeted approach - find all LaTeX expressions and fix them
      const latexPattern = /\$([^$]+)\$/g
      fixedJson = fixedJson.replace(latexPattern, (match, content) => {
        // Check if the content has single backslashes
        if (content.includes('\\') && !content.includes('\\\\')) {
          console.log(`Fixing LaTeX expression: ${match}`)
          // Double all backslashes in the LaTeX content
          const fixedContent = content.replace(/\\/g, '\\\\')
          return `$${fixedContent}$`
        }
        return match
      })
      
      // Also handle backslashes before quotes
      fixedJson = fixedJson.replace(/\\"/g, '\\\\"')
      
      if (fixedJson !== backslashBefore) {
        fixes.push('Fixed backslash escaping issues')
      }
      
      // Fix common JSON syntax issues
      // Remove comments (// and /* */)
      const commentsBefore = fixedJson
      fixedJson = fixedJson
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
        .replace(/\/\/.*$/gm, '') // Remove line comments
      
      if (fixedJson !== commentsBefore) {
        fixes.push('Removed comments')
      }
      
      // Fix missing commas between array elements or object properties
      // This is tricky but we can try to detect patterns like }{
      const missingCommaBefore = fixedJson
      fixedJson = fixedJson
        .replace(/}\s*{/g, '},{') // Fix missing comma between objects
        .replace(/]\s*\[/g, '],[') // Fix missing comma between arrays
        .replace(/("[^"]*")\s+("[^"]*":)/g, '$1,$2') // Fix missing comma between properties
      
      if (fixedJson !== missingCommaBefore) {
        fixes.push('Added missing commas')
      }

      // Try to parse with our fixes
      let parsedData: CourseContent
      let parseError: Error | null = null
      
      try {
        parsedData = JSON.parse(fixedJson) as CourseContent
      } catch (error) {
        parseError = error as Error
        
        // If parsing still fails, try more aggressive fixes:
        // 1. Remove any non-printable characters
        const cleanedJson = fixedJson.replace(/[\x00-\x1F\x7F-\x9F]/g, '')
        if (cleanedJson !== fixedJson) {
          fixes.push('Removed non-printable characters')
          fixedJson = cleanedJson
        }
        
        // 2. Try to fix common HTML entity issues
        const htmlFixedJson = fixedJson
          .replace(/&quot;/g, '\\"') // Replace HTML quote entities
          .replace(/&apos;/g, "'") // Replace HTML apostrophe entities
          .replace(/&amp;/g, '&') // Replace HTML ampersand entities
          .replace(/&lt;/g, '<') // Replace HTML less than entities
          .replace(/&gt;/g, '>') // Replace HTML greater than entities
        
        if (htmlFixedJson !== fixedJson) {
          fixes.push('Fixed HTML entities')
          fixedJson = htmlFixedJson
        }
        
        // 3. Try a more comprehensive fix for HTML content with quotes
        // The issue often occurs when HTML content contains attributes or text with quotes/apostrophes
        // We need to properly escape the content inside JSON string values
        
        // First, let's try to fix the most common issue: HTML content in JSON strings
        // This regex attempts to find JSON string values that contain HTML
        let quotesFixedJson = fixedJson
        
        // Step 1: Find and fix string values that might contain problematic content
        // This is a more careful approach that handles nested quotes
        const stringValueRegex = /("(?:content|narration|title|text|description)"\s*:\s*")([^"]*(?:"[^"]*)*)("(?:\s*[,}\]]))/g
        
        quotesFixedJson = fixedJson.replace(stringValueRegex, (_match, keyPart, valuePart, endPart) => {
          // Check if this looks like it has unescaped quotes
          let fixedValue = valuePart
          
          // Check if value contains any quotes
          if (valuePart.includes('"')) {
            // Escape any quotes that aren't already escaped
            // First, temporarily replace already escaped quotes
            const temp = valuePart.replace(/\\"/g, '\u0000ESCAPED_QUOTE\u0000')
            // Then escape all remaining quotes
            const escaped = temp.replace(/"/g, '\\"')
            // Finally, restore the already escaped quotes
            fixedValue = escaped.replace(/\u0000ESCAPED_QUOTE\u0000/g, '\\"')
            fixes.push('Escaped quotes in content')
          }
          
          return keyPart + fixedValue + endPart
        })
        
        if (quotesFixedJson !== fixedJson) {
          fixedJson = quotesFixedJson
        }
        
        // 4. Additional fix: Sometimes JSON is broken because a string isn't properly closed
        // Let's try to detect and fix unclosed strings
        // Look for patterns where we have a key-value pair but the value string isn't closed
        const unclosedStringRegex = /("[^"]+"\s*:\s*")([^"]*?)(\s*[,}\]])/g
        const unclosedFixed = fixedJson.replace(unclosedStringRegex, (match, keyPart, valuePart, endPart) => {
          // Check if this looks like an unclosed string (no closing quote before comma/brace)
          if (!match.includes('"' + endPart) && !valuePart.endsWith('"')) {
            fixes.push('Fixed unclosed string value')
            return keyPart + valuePart + '"' + endPart
          }
          return match
        })
        
        if (unclosedFixed !== fixedJson) {
          fixedJson = unclosedFixed
        }
        
        // Try parsing again with all fixes
        try {
          parsedData = JSON.parse(fixedJson) as CourseContent
          parseError = null // Clear error if successful
        } catch (finalError) {
          // Log the exact position and character causing the issue
          const errorMsg = (parseError as Error).message
          const posMatch = errorMsg.match(/position (\d+)/)
          if (posMatch) {
            const pos = parseInt(posMatch[1])
            console.log(`Parse error at position ${pos}`)
            console.log(`Character at position: "${fixedJson.charAt(pos)}" (code: ${fixedJson.charCodeAt(pos)})`)
            console.log(`Context: ...${fixedJson.substring(Math.max(0, pos - 20), Math.min(fixedJson.length, pos + 20))}...`)
          }
          
          // One last attempt - try to find and fix the specific issue
          // Sometimes the error is due to newlines in string values
          const newlineFixed = fixedJson.replace(
            /("[^"]+"\s*:\s*")([^"]*)(")/g,
            (match, key, value, endQuote) => {
              // Replace actual newlines with \n
              const fixed = value
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t')
              if (fixed !== value) {
                fixes.push('Fixed newlines in string values')
                return key + fixed + endQuote
              }
              return match
            }
          )
          
          if (newlineFixed !== fixedJson) {
            fixedJson = newlineFixed
            try {
              parsedData = JSON.parse(fixedJson) as CourseContent
              parseError = null
            } catch (newlineError) {
              // If it still fails, throw the original error with our enhancements
              throw parseError
            }
          } else {
            throw parseError
          }
        }
      }
      
      // Check for old format indicators
      if ('activities' in parsedData || 'quiz' in parsedData) {
        setValidationResult({ isValid: false, error: 'Invalid format: This appears to be the old JSON format. Please use the new format with welcomePage, learningObjectivesPage, and assessment.' })
        return
      }

      // Validate welcomePage
      if (!parsedData.welcomePage) {
        setValidationResult({ isValid: false, error: 'Missing required field: welcomePage' })
        return
      }
      if (!parsedData.welcomePage.id || !parsedData.welcomePage.title || !parsedData.welcomePage.content || !parsedData.welcomePage.narration) {
        setValidationResult({ isValid: false, error: 'Missing required fields in welcomePage' })
        return
      }

      // Validate learningObjectivesPage
      if (!parsedData.learningObjectivesPage) {
        setValidationResult({ isValid: false, error: 'Missing required field: learningObjectivesPage' })
        return
      }
      if (!parsedData.learningObjectivesPage.id || !parsedData.learningObjectivesPage.title || 
          !parsedData.learningObjectivesPage.content || !parsedData.learningObjectivesPage.narration) {
        setValidationResult({ isValid: false, error: 'Missing required fields in learningObjectivesPage' })
        return
      }

      // Validate topics
      if (!parsedData.topics || !Array.isArray(parsedData.topics)) {
        setValidationResult({ isValid: false, error: 'Missing required field: topics' })
        return
      }

      for (const topic of parsedData.topics) {
        if (!topic.id || !topic.title || !topic.content || topic.narration === undefined) {
          setValidationResult({ isValid: false, error: 'Missing required fields in topic' })
          return
        }
        // Check for old format
        if ('bulletPoints' in topic || Array.isArray(topic.narration)) {
          setValidationResult({ isValid: false, error: 'Invalid format: Topics should have single narration string, not array or bulletPoints' })
          return
        }
      }

      // Validate assessment
      if (!parsedData.assessment || !parsedData.assessment.questions || !Array.isArray(parsedData.assessment.questions)) {
        setValidationResult({ isValid: false, error: 'Missing required field: assessment' })
        return
      }

      // Count knowledge check questions
      let knowledgeCheckCount = 0
      for (const topic of parsedData.topics) {
        if (topic.knowledgeCheck && topic.knowledgeCheck.questions) {
          knowledgeCheckCount += topic.knowledgeCheck.questions.length
        }
      }

      // If we made any fixes, update the input and notify the user
      if (fixes.length > 0 && !parseError) {
        // Format the fixed JSON nicely
        const formattedJson = JSON.stringify(parsedData, null, 2)
        setJsonInput(formattedJson)
        setToast({ 
          message: `✨ Automatically fixed ${fixes.length} formatting issue(s)`, 
          type: 'success' 
        })
      }

      setValidationResult({
        isValid: true,
        data: parsedData,
        summary: `${parsedData.topics.length + 2} pages (including Welcome & Learning Objectives), ${knowledgeCheckCount} knowledge check questions, ${parsedData.assessment.questions.length} assessment questions`
      })
      
      // Lock the input after successful validation
      setIsLocked(true)
    } catch (error) {
      let errorMessage = 'Invalid JSON syntax'
      if (error instanceof Error) {
        errorMessage = error.message
        
        // Provide more helpful error messages
        if (errorMessage.includes('Unexpected token') || errorMessage.includes('JSON at position')) {
          // Try to extract the position and show context
          const match = errorMessage.match(/position (\d+)/)
          if (match) {
            const position = parseInt(match[1])
            const lines = processedInput.split('\n')
            let currentPos = 0
            let lineNumber = 0
            let columnNumber = 0
            
            // Find line and column of error
            for (let i = 0; i < lines.length; i++) {
              const lineLength = lines[i].length + 1 // +1 for newline
              if (currentPos + lineLength > position) {
                lineNumber = i + 1
                columnNumber = position - currentPos + 1
                break
              }
              currentPos += lineLength
            }
            
            // Get context lines
            const startLine = Math.max(0, lineNumber - 3)
            const endLine = Math.min(lines.length, lineNumber + 2)
            const contextLines = []
            
            for (let i = startLine; i < endLine; i++) {
              const lineNum = i + 1
              const prefix = lineNum === lineNumber ? '→ ' : '  '
              contextLines.push(`${prefix}${lineNum}: ${lines[i]}`)
              
              // Add error indicator on the error line
              if (lineNum === lineNumber) {
                const spaces = ' '.repeat(prefix.length + lineNum.toString().length + 2 + columnNumber - 1)
                contextLines.push(spaces + '^')
              }
            }
            
            errorMessage = `JSON parsing error at line ${lineNumber}, column ${columnNumber}:\n${error.message}\n\n${contextLines.join('\n')}`
          } else {
            errorMessage = `JSON parsing error: ${errorMessage}. This often means there's a syntax error like a missing quote, comma, or bracket.`
          }
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      setValidationResult({ isValid: false, error: errorMessage })
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) {
      setToast({ message: 'Please clear the current JSON before uploading a new file.', type: 'info' })
      event.target.value = '' // Reset the file input
      return
    }
    
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setJsonInput(content)
        setToast({ message: 'File loaded successfully!', type: 'success' })
      }
      reader.readAsText(file)
    }
  }

  const handleNext = () => {
    if (validationResult?.isValid && validationResult.data) {
      onNext(validationResult.data)
    }
  }

  // Removed keyboard shortcuts for undo/redo

  const handleClear = () => {
    setShowClearConfirm(true)
  }
  
  const handleConfirmClear = async () => {
    setJsonInput('')
    setValidationResult(null)
    setIsLocked(false)
    setToast({ message: 'JSON cleared. Data on following pages has been reset.', type: 'info' })
    
    // Clear persisted validation state
    if (storage && storage.isInitialized) {
      try {
        await storage.saveContent('json-validation-state', null)
      } catch (error) {
        console.error('Error clearing persisted validation state:', error)
      }
    }
    
    setShowClearConfirm(false)
  }
  
  const handleCancelClear = () => {
    setShowClearConfirm(false)
  }

  // Reset functionality moved to inline implementation where needed

  const autoSaveIndicator = (
    <AutoSaveIndicatorConnected />
  )


  return (
    <PageLayout
      currentStep={2}
      title="JSON Import & Validation"
      description="Paste the JSON response from your AI chatbot below, or upload a JSON file."
      autoSaveIndicator={autoSaveIndicator}
      onSettingsClick={onSettingsClick}
      onSave={onSave}
      onSaveAs={onSaveAs}
      onBack={onBack}
      onNext={handleNext}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
    >
      <Section>
        <Card>
          {/* JSON Input */}
          <div style={{ marginBottom: '2rem' }}>
            <Input
              label="JSON Input"
              data-testid="json-input-textarea"
              multiline
              rows={15}
              value={jsonInput}
              onChange={(e) => !isLocked && setJsonInput(e.target.value as string)}
              placeholder="Paste your JSON data here..."
              fullWidth
              className="textarea"
              disabled={isLocked}
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
              }}
            />
          </div>

          {/* Action Buttons */}
          <Flex justify="space-between" align="center" wrap gap="medium" style={{ marginBottom: '2rem' }}>
            <ButtonGroup gap="medium">
              <Button 
                variant="secondary"
                onClick={handlePasteFromClipboard}
                data-testid="paste-clipboard-button"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Icon icon={Clipboard} size="sm" />
                Paste from Clipboard
              </Button>
              
              <Button
                variant="secondary"
                onClick={() => document.getElementById('json-file')?.click()}
                data-testid="choose-file-button"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Icon icon={FileText} size="sm" />
                Choose File
              </Button>
              <input
                id="json-file"
                data-testid="json-file-input"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                aria-label="Upload JSON file"
                style={{ display: 'none' }}
              />
            </ButtonGroup>
            
            <Button 
              variant="primary"
              onClick={validateJSON} 
              disabled={!jsonInput.trim() || isLocked}
              data-testid="validate-json-button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Icon icon={CheckCircle} size="sm" />
              Validate JSON
            </Button>
          </Flex>
          
          {/* Clear button when JSON is locked */}
          {isLocked && (
            <div style={{ marginTop: '1rem' }}>
              <Button 
                variant="secondary"
                onClick={handleClear}
                data-testid="clear-json-button"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Icon icon={Trash2} size="sm" />
                Clear JSON
              </Button>
            </div>
          )}

          {/* Validation Result */}
          {validationResult && (
            validationResult.isValid ? (
              <Alert type="success" title="Valid JSON Structure">
                {validationResult.summary}
              </Alert>
            ) : (
              <Alert type="error" title="Validation Error">
                {validationResult.error}
              </Alert>
            )
          )}
        </Card>
      </Section>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Clear JSON Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear JSON Data"
        message="Warning: Clearing the JSON will delete all data on the following pages. Are you sure you want to continue?"
        confirmText="Clear"
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />
    </PageLayout>
  )
}

export default JSONImportValidator;