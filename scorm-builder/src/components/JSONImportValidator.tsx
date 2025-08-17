import React, { useState, useEffect, useRef } from 'react'
import { CourseContent } from '../types/aiPrompt'
import { PageLayout } from './PageLayout'
import { 
  Button, 
  Card, 
  Input, 
  ButtonGroup,
  Section,
  Flex,
  Icon,
  Alert,
  Modal
} from './DesignSystem'
import { Toast } from './Toast'
import { ConfirmDialog } from './ConfirmDialog'
import { Clipboard, Trash2, CheckCircle, ChevronRight, ChevronDown, BookOpen, Target, FileQuestion, Award, Edit2, Check, X, Wand2 } from 'lucide-react'
// import { useUndoRedo } from '../hooks/useUndoRedo' // Removed undo/redo functionality
import { AutoSaveBadge } from './AutoSaveBadge'
import './DesignSystem/designSystem.css'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useStepNavigation } from '../contexts/StepNavigationContext'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import { smartAutoFixJSON } from '../utils/jsonAutoFixer'
import { SimpleJSONEditor } from './SimpleJSONEditor'
import { courseContentSchema } from '../schemas/courseContentSchema'
import { debugLogger } from '../utils/ultraSimpleLogger'
import styles from './JSONImportValidator.module.css'

interface JSONImportValidatorProps {
  onNext: (data: CourseContent) => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
}

// Custom Alert component removed - using DesignSystem Alert

export const JSONImportValidator: React.FC<JSONImportValidatorProps> = ({ 
  onNext, 
  onBack, 
  onSettingsClick, 
  onSave, 
  onOpen, 
  onHelp,
  onStepClick
}) => {
  const storage = useStorage()
  const navigation = useStepNavigation()
  const { markDirty, resetDirty } = useUnsavedChanges()
  
  // Logger for production-safe debugging
  const logger = debugLogger
  
  // Always start with empty JSON input - users should paste their own content
  const [jsonInput, setJsonInput] = useState('')
  
  const [validationResult, setValidationResult] = useState<any>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']))
  const [forceUpdateCounter, setForceUpdateCounter] = useState(0)
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Load persisted JSON import data on mount and when project changes
  useEffect(() => {
    const loadPersistedValidationState = async () => {
      if (storage && storage.isInitialized && storage.currentProjectId) {
        // Log project change
        logger.info('JSONValidator', 'Loading JSON for project', { 
          projectId: storage.currentProjectId 
        })
        
        try {
          // Clear state first when switching projects to prevent stale data
          setJsonInput('')
          setValidationResult(null)
          setIsLocked(false)
          
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
            
            logger.info('JSONValidator', 'Loaded saved JSON state', {
              hasJson: !!jsonImportData.rawJson,
              isLocked: jsonImportData.isLocked,
              hasValidation: !!jsonImportData.validationResult
            })
          } else {
            // Fallback to old format for backward compatibility
            const persistedValidation = await storage.getContent('json-validation-state')
            if (persistedValidation) {
              setValidationResult(persistedValidation)
              // If we have a valid validation result, lock the input
              if (persistedValidation.isValid) {
                setIsLocked(true)
              }
              
              logger.info('JSONValidator', 'Loaded legacy JSON validation state', {
                hasValidation: !!persistedValidation,
                isValid: persistedValidation.isValid
              })
            } else {
              logger.info('JSONValidator', 'No saved JSON state found for project', {
                projectId: storage.currentProjectId
              })
            }
          }
        } catch (error) {
          logger.error('JSONValidator', 'Error loading persisted validation state', { error: error instanceof Error ? error.message : String(error) })
          console.error('Error loading persisted validation state:', error)
        }
      }
    }
    
    loadPersistedValidationState()
  }, [storage?.isInitialized, storage?.currentProjectId, logger])
  
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
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
    }
  }, [])
  
  // State validation synchronization effect - ensures tree view shows when validation completes
  useEffect(() => {
    // Verify that when all conditions are met, the component will show the tree view
    if (isLocked && validationResult?.isValid && validationResult.data && !isValidating) {
      logger.info('JSONValidator', 'Tree view conditions met', {
        isLocked,
        isValid: validationResult?.isValid,
        hasData: !!validationResult?.data,
        isValidating,
        topicsCount: validationResult?.data?.topics?.length || 0
      })
      
      // Force a re-render to ensure the tree view shows
      // This is a safety mechanism for production builds where state batching might cause issues
      const timer = setTimeout(() => {
        // Use force update counter to trigger a guaranteed re-render
        setForceUpdateCounter(prev => prev + 1)
        logger.info('JSONValidator', 'Forced tree view re-render', { forceUpdateCounter })
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [isLocked, validationResult?.isValid, validationResult?.data, isValidating, logger, forceUpdateCounter])
  
  // Fallback mechanism to ensure tree view shows in production
  useEffect(() => {
    if (isLocked && validationResult?.isValid && validationResult?.data && !isValidating) {
      // Give React time to render, then check if tree view is showing
      const fallbackTimer = setTimeout(() => {
        logger.info('JSONValidator', 'Fallback check - ensuring tree view is visible', {
          isLocked,
          isValid: validationResult?.isValid,
          hasData: !!validationResult?.data,
          isValidating
        })
        
        // Force a final re-render by incrementing counter if needed
        setForceUpdateCounter(prev => {
          logger.info('JSONValidator', 'Fallback re-render triggered', { 
            previousCounter: prev,
            newCounter: prev + 1 
          })
          return prev + 1
        })
      }, 100) // Wait 100ms for normal render to complete
      
      return () => clearTimeout(fallbackTimer)
    }
  }, [isLocked, validationResult?.isValid, validationResult?.data, isValidating, logger])
  
  // Removed logic that would update jsonInput from initialData - users should paste their own content
  
  // JSON input state is tracked but not auto-saved to localStorage anymore

  const validateJSON = async () => {
    // Clear previous validation result
    setValidationResult(null)
    setIsValidating(true)
    
    let processedInput = jsonInput
    let wasAutoFixed = false
    
    try {
      
      if (!processedInput.trim()) {
        // Don't show error for empty input, just silently return
        setValidationResult(null)
        setIsValidating(false)
        return
      }
      
      // IMMEDIATE PRE-PROCESSING - Fix smart quotes and invisible characters before any other processing
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
        // Remove invisible Unicode characters that can break JSON parsing
        .replace(/\u200B/g, '')            // Zero-width space
        .replace(/\u00A0/g, ' ')           // Non-breaking space to regular space
        .replace(/\u200C/g, '')            // Zero-width non-joiner
        .replace(/\u200D/g, '')            // Zero-width joiner
        .replace(/\uFEFF/g, '')            // Zero-width no-break space (BOM)
        .replace(/\u2060/g, '')            // Word joiner
      
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
        
        // Update validation state with production-safe logging
        logger.info('JSONValidator', 'JSON validation successful (pre-processing)', {
          topicsCount: parsedData.topics?.length || 0,
          hasWelcomePage: !!parsedData.welcomePage,
          hasObjectivesPage: !!parsedData.learningObjectivesPage,
          hasAssessment: !!parsedData.assessment
        })
        
        // Update state synchronously to prevent race condition
        setValidationResult({
          isValid: true,
          data: parsedData,
          summary: `Successfully parsed! Contains ${parsedData.topics?.length || 0} topics.`
        })
        
        setToast({ 
          message: '✅ Valid JSON detected! Course structure loaded successfully.', 
          type: 'success' 
        })
        
        setIsLocked(true)
        setIsValidating(false)
        
        logger.info('JSONValidator', 'State updated after validation', {
          isLocked: true,
          isValidating: false,
          hasValidationResult: true
        })
        
        // Save the validated JSON data to storage after state updates
        if (storage && storage.isInitialized) {
          const jsonImportData = {
            rawJson: jsonInput,
            validationResult: {
              isValid: true,
              data: parsedData,
              summary: `Successfully parsed! Contains ${parsedData.topics?.length || 0} topics.`
            },
            isLocked: true
          }
          
          // Use a promise to handle async storage operation
          storage.saveContent('json-import-data', jsonImportData).then(() => {
            logger.info('JSONValidator', 'Saved JSON state to storage (pre-processing)', {
              projectId: storage.currentProjectId,
              hasRawJson: !!jsonImportData.rawJson,
              isLocked: jsonImportData.isLocked
            })
          }).catch((error) => {
            logger.error('JSONValidator', 'Failed to save JSON state to storage (pre-processing)', {
              error: error instanceof Error ? error.message : String(error)
            })
          })
        }
        return
      }
      
      // Apply our advanced auto-fix for unescaped quotes in string values
      console.log("Applying smart auto-fix for unescaped quotes...")
      fixedJson = smartAutoFixJSON(fixedJson)
      
      // Try to parse after smart fix
      try {
        const parsedData = JSON.parse(fixedJson) as CourseContent
        logger.info('JSONValidator', 'JSON validation successful (smart auto-fix)', {
          topicsCount: parsedData.topics?.length || 0,
          hasWelcomePage: !!parsedData.welcomePage,
          hasObjectivesPage: !!parsedData.learningObjectivesPage,
          hasAssessment: !!parsedData.assessment
        })
        
        // Update state synchronously to prevent race condition
        setValidationResult({
          isValid: true,
          data: parsedData,
          summary: `Successfully parsed! Contains ${parsedData.topics?.length || 0} topics.`
        })
        
        setToast({ 
          message: '🔧 JSON automatically fixed and validated! Course structure loaded.', 
          type: 'success' 
        })
        
        setIsLocked(true)
        setIsValidating(false)
        
        logger.info('JSONValidator', 'State updated after smart auto-fix', {
          isLocked: true,
          isValidating: false,
          hasValidationResult: true
        })
        
        // Persist validation state to storage after updating UI state
        if (storage?.currentProjectId) {
          const jsonImportData = {
            rawJson: fixedJson,
            validationResult: {
              isValid: true,
              data: parsedData,
              summary: `Successfully parsed! Contains ${parsedData.topics?.length || 0} topics.`
            },
            isLocked: true
          }
          
          // Use a promise to handle async storage operation
          storage.saveContent('json-import-data', jsonImportData).then(() => {
            logger.info('JSONValidator', 'Saved JSON state to storage (smart auto-fix)', {
              projectId: storage.currentProjectId,
              hasRawJson: !!jsonImportData.rawJson,
              isLocked: jsonImportData.isLocked
            })
          }).catch((error) => {
            logger.error('JSONValidator', 'Failed to save JSON state to storage (smart auto-fix)', {
              error: error instanceof Error ? error.message : String(error)
            })
          })
        }
        return
      } catch (e) {
        console.log("Smart auto-fix didn't fully resolve issues, continuing with other fixes...")
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
        setIsValidating(false)
        return
      }

      // Validate welcomePage
      if (!parsedData.welcomePage) {
        setValidationResult({ isValid: false, error: 'Missing required field: welcomePage' })
        setIsValidating(false)
        return
      }
      if (!parsedData.welcomePage.id || !parsedData.welcomePage.title || !parsedData.welcomePage.content || !parsedData.welcomePage.narration) {
        setValidationResult({ isValid: false, error: 'Missing required fields in welcomePage' })
        setIsValidating(false)
        return
      }

      // Validate learningObjectivesPage
      if (!parsedData.learningObjectivesPage) {
        setValidationResult({ isValid: false, error: 'Missing required field: learningObjectivesPage' })
        setIsValidating(false)
        return
      }
      if (!parsedData.learningObjectivesPage.id || !parsedData.learningObjectivesPage.title || 
          !parsedData.learningObjectivesPage.content || !parsedData.learningObjectivesPage.narration) {
        setValidationResult({ isValid: false, error: 'Missing required fields in learningObjectivesPage' })
        setIsValidating(false)
        return
      }

      // Validate topics
      if (!parsedData.topics || !Array.isArray(parsedData.topics)) {
        setValidationResult({ isValid: false, error: 'Missing required field: topics' })
        setIsValidating(false)
        return
      }

      for (const topic of parsedData.topics) {
        if (!topic.id || !topic.title || !topic.content || topic.narration === undefined) {
          setValidationResult({ isValid: false, error: 'Missing required fields in topic' })
          setIsValidating(false)
          return
        }
        // Check for old format
        if ('bulletPoints' in topic || Array.isArray(topic.narration)) {
          setValidationResult({ isValid: false, error: 'Invalid format: Topics should have single narration string, not array or bulletPoints' })
          setIsValidating(false)
          return
        }
      }

      // Validate assessment
      if (!parsedData.assessment || !parsedData.assessment.questions || !Array.isArray(parsedData.assessment.questions)) {
        setValidationResult({ isValid: false, error: 'Missing required field: assessment' })
        setIsValidating(false)
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
        markDirty('courseContent') // Mark dirty when formatting content
        setToast({ 
          message: `✨ Automatically fixed ${fixes.length} formatting issue(s)`, 
          type: 'success' 
        })
      }

      logger.info('JSONValidator', 'JSON validation successful (full validation)', {
        topicsCount: parsedData.topics.length,
        knowledgeCheckCount,
        assessmentQuestions: parsedData.assessment.questions.length,
        hasWelcomePage: !!parsedData.welcomePage,
        hasObjectivesPage: !!parsedData.learningObjectivesPage
      })

      // Update state synchronously to prevent race condition
      setValidationResult({
        isValid: true,
        data: parsedData,
        summary: `${parsedData.topics.length + 2} pages (including Welcome & Learning Objectives), ${knowledgeCheckCount} knowledge check questions, ${parsedData.assessment.questions.length} assessment questions`
      })
      
      // Lock the input after successful validation
      setIsLocked(true)
      setIsValidating(false)
      
      logger.info('JSONValidator', 'State updated after full validation', {
        isLocked: true,
        isValidating: false,
        hasValidationResult: true
      })
      
      // Persist validation state to storage after updating UI state
      if (storage?.currentProjectId) {
        const jsonImportData = {
          rawJson: jsonInput,
          validationResult: {
            isValid: true,
            data: parsedData,
            summary: `${parsedData.topics.length + 2} pages (including Welcome & Learning Objectives), ${knowledgeCheckCount} knowledge check questions, ${parsedData.assessment.questions.length} assessment questions`
          },
          isLocked: true
        }
        
        // Use a promise to handle async storage operation
        storage.saveContent('json-import-data', jsonImportData).then(() => {
          logger.info('JSONValidator', 'Saved JSON state to storage', {
            projectId: storage.currentProjectId,
            hasRawJson: !!jsonImportData.rawJson,
            isLocked: jsonImportData.isLocked
          })
        }).catch((error) => {
          logger.error('JSONValidator', 'Failed to save JSON state to storage', {
            error: error instanceof Error ? error.message : String(error)
          })
        })
      }
      
      // Show success message
      setToast({ 
        message: '✅ JSON validated successfully! Content is now locked. Click "Next" to proceed or "Clear JSON" to start over.', 
        type: 'success' 
      })
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
      
      // Try auto-fix if there's a parse error
      if (!wasAutoFixed) {
        const autoFixed = smartAutoFixJSON(processedInput)
        if (autoFixed !== processedInput) {
          wasAutoFixed = true
          setJsonInput(autoFixed)
          markDirty('courseContent') // Mark dirty when auto-fixing content
          setToast({ message: 'Applied auto-fixes, validating...', type: 'info' })
          // Try validation again with fixed JSON
          validationTimeoutRef.current = setTimeout(() => {
            validateJSON()
          }, 100)
          setIsValidating(false)
          return
        }
      }
      
      setValidationResult({ isValid: false, error: errorMessage })
      setIsValidating(false)
    }
  }

  const handlePasteFromClipboard = async () => {
    if (isLocked) {
      setToast({ message: 'Please clear the current course structure before pasting new content.', type: 'info' })
      return
    }
    
    try {
      const text = await navigator.clipboard.readText()
      setJsonInput(text)
      markDirty('courseContent') // Mark dirty when pasting content
      setToast({ message: 'Content pasted from clipboard!', type: 'success' })
      // Automatically validate immediately after pasting
      setTimeout(() => validateJSON(), 100)
    } catch (error) {
      setToast({ message: 'Failed to read clipboard. Please paste manually.', type: 'error' })
    }
  }


  const handleNext = () => {
    if (validationResult?.isValid && validationResult.data) {
      // Unlock all subsequent steps when JSON is validated successfully
      // Steps: 0=Seed, 1=Prompt, 2=JSON, 3=Media, 4=Audio, 5=Activities, 6=SCORM
      navigation.unlockSteps([3, 4, 5, 6])
      resetDirty('courseContent') // Reset dirty flag on successful next
      onNext(validationResult.data)
    }
    // Don't show alert - the disabled Next button provides sufficient feedback
  }

  // Removed keyboard shortcuts for undo/redo

  const handleClear = () => {
    setShowClearConfirm(true)
  }
  
  const handleConfirmClear = async () => {
    setJsonInput('')
    markDirty('courseContent') // Mark dirty when clearing content
    setValidationResult(null)
    setIsLocked(false)
    setToast({ message: 'JSON cleared. Data on following pages has been reset.', type: 'info' })
    
    // Clear persisted validation state (both old and new formats)
    if (storage && storage.isInitialized) {
      try {
        // Clear both old and new formats to ensure complete cleanup
        await storage.saveContent('json-validation-state', null)
        await storage.saveContent('json-import-data', null)
        
        logger.info('JSONValidator', 'Cleared JSON validation state', {
          projectId: storage.currentProjectId
        })
      } catch (error) {
        logger.error('JSONValidator', 'Error clearing persisted validation state', { error: error instanceof Error ? error.message : String(error) })
        console.error('Error clearing persisted validation state:', error)
      }
    }
    
    setShowClearConfirm(false)
  }
  
  const handleCancelClear = () => {
    setShowClearConfirm(false)
  }

  // Reset functionality moved to inline implementation where needed

  // Toggle tree node expansion
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes)
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId)
    } else {
      newExpanded.add(nodeId)
    }
    setExpandedNodes(newExpanded)
  }

  // Helper function to strip HTML tags and truncate text
  const stripHtmlAndTruncate = (html: string, maxLength: number = 150) => {
    const text = html.replace(/<[^>]*>/g, '').trim()
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // Helper function to get question type label
  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case 'multiple-choice': return 'Multiple Choice'
      case 'true-false': return 'True/False'
      case 'fill-in-the-blank': return 'Fill-in-the-blank'
      default: return type
    }
  }

  // Render tree view for validated content
  const renderTreeView = (data: CourseContent) => {
    const isExpanded = (nodeId: string) => expandedNodes.has(nodeId)
    
    return (
      <div className={`${styles.treeView} ${styles.treeViewDark}`}>
        {/* Welcome Page */}
        <div className={styles.treeNode}>
          <div 
            className={styles.treeNodeHeader}
            onClick={() => toggleNode('welcome')}
            style={{ cursor: 'pointer' }}
          >
            <Icon 
              icon={isExpanded('welcome') ? ChevronDown : ChevronRight} 
              size="sm" 
              className={styles.treeIcon} 
            />
            <Icon icon={BookOpen} size="sm" className={styles.treeIcon} />
            <span className={styles.treeNodeTitle}>Welcome Page</span>
            <div className={styles.treeNodeBadges}>
              {data.welcomePage.narration && (
                <span className={styles.badge}><Icon icon={Check} size="xs" /> Narration</span>
              )}
              <span className={styles.badge}>{data.welcomePage.duration || 2} min</span>
            </div>
          </div>
          {isExpanded('welcome') && (
            <div className={styles.expandedContent}>
              <div className={styles.contentSection}>
                <h4 className={styles.contentLabel}>Content:</h4>
                <p className={styles.contentPreview}>
                  {stripHtmlAndTruncate(data.welcomePage.content)}
                </p>
              </div>
              {data.welcomePage.narration && (
                <div className={styles.contentSection}>
                  <h4 className={styles.contentLabel}>Narration:</h4>
                  <p className={styles.narrationText}>
                    {stripHtmlAndTruncate(data.welcomePage.narration, 200)}
                  </p>
                </div>
              )}
              {data.welcomePage.imageKeywords && data.welcomePage.imageKeywords.length > 0 && (
                <div className={styles.contentSection}>
                  <h4 className={styles.contentLabel}>Image Keywords:</h4>
                  <div className={styles.tagList}>
                    {data.welcomePage.imageKeywords.map((keyword, idx) => (
                      <span key={idx} className={styles.tag}>{keyword}</span>
                    ))}
                  </div>
                </div>
              )}
              {data.welcomePage.imagePrompts && data.welcomePage.imagePrompts.length > 0 && (
                <div className={styles.contentSection}>
                  <h4 className={styles.contentLabel}>AI Image Prompts:</h4>
                  <div className={styles.tagList}>
                    {data.welcomePage.imagePrompts.map((prompt, idx) => (
                      <span key={idx} className={styles.tag}>{prompt}</span>
                    ))}
                  </div>
                </div>
              )}
              {data.welcomePage.videoSearchTerms && data.welcomePage.videoSearchTerms.length > 0 && (
                <div className={styles.contentSection}>
                  <h4 className={styles.contentLabel}>Video Search Terms:</h4>
                  <div className={styles.tagList}>
                    {data.welcomePage.videoSearchTerms.map((term, idx) => (
                      <span key={idx} className={styles.tag}>{term}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Learning Objectives */}
        <div className={styles.treeNode}>
          <div 
            className={styles.treeNodeHeader}
            onClick={() => toggleNode('objectives')}
            style={{ cursor: 'pointer' }}
          >
            <Icon 
              icon={isExpanded('objectives') ? ChevronDown : ChevronRight} 
              size="sm" 
              className={styles.treeIcon} 
            />
            <Icon icon={Target} size="sm" className={styles.treeIcon} />
            <span className={styles.treeNodeTitle}>Learning Objectives</span>
            <div className={styles.treeNodeBadges}>
              {data.learningObjectivesPage.narration && (
                <span className={styles.badge}><Icon icon={Check} size="xs" /> Narration</span>
              )}
              <span className={styles.badge}>{data.learningObjectivesPage.duration || 3} min</span>
            </div>
          </div>
          {isExpanded('objectives') && (
            <div className={styles.expandedContent}>
              <div className={styles.contentSection}>
                <h4 className={styles.contentLabel}>Objectives:</h4>
                <div className={styles.contentPreview} 
                     dangerouslySetInnerHTML={{ __html: data.learningObjectivesPage.content }} />
              </div>
              {data.learningObjectivesPage.narration && (
                <div className={styles.contentSection}>
                  <h4 className={styles.contentLabel}>Narration:</h4>
                  <p className={styles.narrationText}>
                    {stripHtmlAndTruncate(data.learningObjectivesPage.narration, 200)}
                  </p>
                </div>
              )}
              {data.learningObjectivesPage.imageKeywords && data.learningObjectivesPage.imageKeywords.length > 0 && (
                <div className={styles.contentSection}>
                  <h4 className={styles.contentLabel}>Image Keywords:</h4>
                  <div className={styles.tagList}>
                    {data.learningObjectivesPage.imageKeywords.map((keyword, idx) => (
                      <span key={idx} className={styles.tag}>{keyword}</span>
                    ))}
                  </div>
                </div>
              )}
              {data.learningObjectivesPage.imagePrompts && data.learningObjectivesPage.imagePrompts.length > 0 && (
                <div className={styles.contentSection}>
                  <h4 className={styles.contentLabel}>AI Image Prompts:</h4>
                  <div className={styles.tagList}>
                    {data.learningObjectivesPage.imagePrompts.map((prompt, idx) => (
                      <span key={idx} className={styles.tag}>{prompt}</span>
                    ))}
                  </div>
                </div>
              )}
              {data.learningObjectivesPage.videoSearchTerms && data.learningObjectivesPage.videoSearchTerms.length > 0 && (
                <div className={styles.contentSection}>
                  <h4 className={styles.contentLabel}>Video Search Terms:</h4>
                  <div className={styles.tagList}>
                    {data.learningObjectivesPage.videoSearchTerms.map((term, idx) => (
                      <span key={idx} className={styles.tag}>{term}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Topics */}
        <div className={styles.treeNode}>
          <div 
            className={styles.treeNodeHeader} 
            onClick={() => toggleNode('topics')}
            style={{ cursor: 'pointer' }}
          >
            <Icon 
              icon={isExpanded('topics') ? ChevronDown : ChevronRight} 
              size="sm" 
              className={styles.treeIcon} 
            />
            <Icon icon={BookOpen} size="sm" className={styles.treeIcon} />
            <span className={styles.treeNodeTitle}>Topics ({data.topics.length})</span>
          </div>
          {isExpanded('topics') && (
            <div className={styles.treeNodeChildren}>
              {data.topics.map((topic, index) => (
                <div key={topic.id} className={styles.treeNode}>
                  <div 
                    className={styles.treeNodeHeader}
                    onClick={() => toggleNode(`topic-${topic.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Icon 
                      icon={isExpanded(`topic-${topic.id}`) ? ChevronDown : ChevronRight} 
                      size="sm" 
                      className={styles.treeIcon} 
                    />
                    <span className={styles.treeNodeNumber}>{index + 1}.</span>
                    <span className={styles.treeNodeTitle}>{topic.title}</span>
                    <div className={styles.treeNodeBadges}>
                      {topic.narration && (
                        <span className={styles.badge}><Icon icon={Check} size="xs" /> Narration</span>
                      )}
                      {topic.knowledgeCheck && (
                        <span className={styles.badge}>
                          <Icon icon={FileQuestion} size="xs" /> {topic.knowledgeCheck.questions.length} questions
                        </span>
                      )}
                      <span className={styles.badge}>{topic.duration || 5} min</span>
                    </div>
                  </div>
                  {isExpanded(`topic-${topic.id}`) && (
                    <div className={styles.expandedContent}>
                      <div className={styles.contentSection}>
                        <h4 className={styles.contentLabel}>Content:</h4>
                        <p className={styles.contentPreview}>
                          {stripHtmlAndTruncate(topic.content)}
                        </p>
                      </div>
                      {topic.narration && (
                        <div className={styles.contentSection}>
                          <h4 className={styles.contentLabel}>Narration:</h4>
                          <p className={styles.narrationText}>
                            {stripHtmlAndTruncate(topic.narration, 200)}
                          </p>
                        </div>
                      )}
                      {topic.imageKeywords && topic.imageKeywords.length > 0 && (
                        <div className={styles.contentSection}>
                          <h4 className={styles.contentLabel}>Image Keywords:</h4>
                          <div className={styles.tagList}>
                            {topic.imageKeywords.map((keyword, idx) => (
                              <span key={idx} className={styles.tag}>{keyword}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {topic.imagePrompts && topic.imagePrompts.length > 0 && (
                        <div className={styles.contentSection}>
                          <h4 className={styles.contentLabel}>AI Image Prompts:</h4>
                          <div className={styles.tagList}>
                            {topic.imagePrompts.map((prompt, idx) => (
                              <span key={idx} className={styles.tag}>{prompt}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {topic.videoSearchTerms && topic.videoSearchTerms.length > 0 && (
                        <div className={styles.contentSection}>
                          <h4 className={styles.contentLabel}>Video Search Terms:</h4>
                          <div className={styles.tagList}>
                            {topic.videoSearchTerms.map((term, idx) => (
                              <span key={idx} className={styles.tag}>{term}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {topic.knowledgeCheck && topic.knowledgeCheck.questions.length > 0 && (
                        <div className={styles.contentSection}>
                          <h4 className={styles.contentLabel}>Knowledge Check Questions:</h4>
                          <div className={styles.questionList}>
                            {topic.knowledgeCheck.questions.map((q, qIdx) => (
                              <div key={q.id} className={styles.questionItem}>
                                <span className={styles.questionBadge}>
                                  {getQuestionTypeLabel(q.type)}
                                </span>
                                <span className={styles.questionText}>
                                  {q.question}
                                </span>
                                <span className={styles.answerText}>
                                  Answer: {q.correctAnswer}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Assessment */}
        <div className={styles.treeNode}>
          <div 
            className={styles.treeNodeHeader}
            onClick={() => toggleNode('assessment')}
            style={{ cursor: 'pointer' }}
          >
            <Icon 
              icon={isExpanded('assessment') ? ChevronDown : ChevronRight} 
              size="sm" 
              className={styles.treeIcon} 
            />
            <Icon icon={Award} size="sm" className={styles.treeIcon} />
            <span className={styles.treeNodeTitle}>Assessment</span>
            <div className={styles.treeNodeBadges}>
              <span className={styles.badge}>
                {data.assessment.questions.length} questions
              </span>
              <span className={styles.badge}>
                Pass: {data.assessment.passMark || 80}%
              </span>
            </div>
          </div>
          {isExpanded('assessment') && (
            <div className={styles.expandedContent}>
              <div className={styles.contentSection}>
                <h4 className={styles.contentLabel}>Assessment Questions:</h4>
                <div className={styles.questionList}>
                  {data.assessment.questions.map((q, idx) => (
                    <div key={q.id} className={styles.questionItem}>
                      <span className={styles.questionNumber}>{idx + 1}.</span>
                      <span className={styles.questionBadge}>
                        {getQuestionTypeLabel(q.type)}
                      </span>
                      <span className={styles.questionText}>
                        {q.question}
                      </span>
                      <span className={styles.answerText}>
                        Answer: {q.correctAnswer}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const autoSaveIndicator = (
    <AutoSaveBadge />
  )


  return (
    <PageLayout
      currentStep={2}
      title="JSON Import & Validation"
      description="Paste the JSON response from your AI chatbot below, or upload a JSON file."
      autoSaveIndicator={autoSaveIndicator}
      onSettingsClick={onSettingsClick}
      onSave={onSave}
      onBack={onBack}
      onNext={handleNext}
      nextDisabled={!validationResult?.isValid}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
    >
      {/* Instructions */}
      <div className={styles.sectionWrapper}>
        <h2 className={styles.sectionTitle}>Instructions</h2>
        <Card>
          <p style={{ lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 0 }}>
            Paste the AI chatbot's response from Step 2 below. The content will be automatically validated, 
            any formatting issues will be corrected, and the course structure will be created. 
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginTop: '0.75rem' }}>
              Note: You'll be able to edit and refine all content in the following steps, 
              so the AI response doesn't need to be perfect.
            </strong>
          </p>
        </Card>
      </div>

      <Section>
        {/* Show tree view when locked, editor when unlocked */}
        {(() => {
          const shouldShowTree = isLocked && validationResult?.isValid && validationResult.data
          logger.info('JSONValidator', 'Render decision', {
            isLocked,
            isValid: validationResult?.isValid,
            hasData: !!validationResult?.data,
            shouldShowTree,
            forceUpdateCounter
          })
          return shouldShowTree
        })() ? (
            <>
              {/* Course Structure */}
              <div className={styles.sectionWrapper}>
                <h2 className={styles.sectionTitle}>Course Structure</h2>
                <Card>
                  {renderTreeView(validationResult.data)}
                </Card>
              </div>
              
              {/* Clear button when locked */}
              <div style={{ marginTop: '1rem' }}>
                <Button 
                  variant="secondary"
                  onClick={handleClear}
                  data-testid="clear-json-button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Icon icon={Trash2} size="sm" />
                  Clear Course Structure
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Content Input */}
              <Card>
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>
                    Chatbot Response
                  </h3>
                  <SimpleJSONEditor
              value={jsonInput}
              onChange={(value) => {
                if (!isLocked) {
                  const prevLength = jsonInput.length
                  setJsonInput(value)
                  markDirty('courseContent') // Mark dirty when user changes JSON content
                  
                  // Clear error if input becomes empty
                  if (!value.trim()) {
                    setValidationResult(null)
                    return
                  }
                  
                  // Check if this is likely a paste operation (large content added at once)
                  const isProbablyPaste = value.length - prevLength > 50
                  
                  // Auto-validate after user stops typing (debounced) or immediately for paste
                  if (value && value.trim().length > 100) { // Only if there's substantial content
                    // Clear any existing timeout
                    if (validationTimeoutRef.current) {
                      clearTimeout(validationTimeoutRef.current)
                    }
                    
                    // Set timeout based on whether it's a paste or typing
                    const delayTime: number = isProbablyPaste ? 100 : 1500;
                    validationTimeoutRef.current = setTimeout(() => {
                      validateJSON()
                    }, delayTime)
                  }
                }
              }}
              onPaste={() => {
                // Handle paste event - validate immediately
                if (!isLocked && jsonInput && jsonInput.trim().length > 50) {
                  // Clear any existing timeout
                  if (validationTimeoutRef.current) {
                    clearTimeout(validationTimeoutRef.current)
                  }
                  
                  // Validate immediately on paste
                  validationTimeoutRef.current = setTimeout(() => {
                    validateJSON()
                  }, 50) // Very short delay to ensure pasted content is processed
                }
              }}
              onValidate={(isValid, errors) => {
                // Don't update validation state if already locked (successfully validated)
                if (isLocked) {
                  return
                }
                
                // If JSON is syntactically valid, automatically trigger full validation
                if (isValid && jsonInput.trim().length > 0) {
                  // Use a short delay to ensure the JSON content is fully processed
                  validationTimeoutRef.current = setTimeout(() => {
                    validateJSON()
                  }, 50)
                  return
                }
                
                // Only show syntax feedback for unlocked state with actual content
                if (!isLocked && errors && errors.length > 0) {
                  // Don't show error for empty input
                  const isEmptyError = errors.some(e => e.message === 'Empty input')
                  if (isEmptyError) {
                    // Clear any existing error for empty state
                    if (validationResult?.error) {
                      setValidationResult(null)
                    }
                    return
                  }
                  
                  // Show syntax errors but don't overwrite valid data
                  if (!validationResult?.isValid || !validationResult?.data) {
                    setValidationResult({
                      isValid: false,
                      error: `${errors.length} syntax error${errors.length > 1 ? 's' : ''} found`
                    })
                  }
                }
              }}
              height="400px"
              readOnly={isLocked}
              schema={courseContentSchema}
              theme="light"
            />
          </div>

                {/* Action Buttons */}
                <Flex justify="start" align="center" wrap gap="medium" style={{ marginBottom: '1rem' }}>
                  <Button 
                    variant="secondary"
                    onClick={handlePasteFromClipboard}
                    data-testid="paste-clipboard-button"
                    disabled={isValidating}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Icon icon={Clipboard} size="sm" />
                    Paste from Clipboard
                  </Button>
                  
                  {/* Show validation status */}
                  {isValidating && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                      <Icon icon={Wand2} size="sm" className={styles.animatePulse} />
                      <span>Validating and fixing content...</span>
                    </div>
                  )}
                </Flex>
              </Card>
            </>
          )}
        
        {/* Validation Result - Only show when successful and ready to import */}
        {validationResult && validationResult.isValid && isLocked && (
          <div style={{ marginTop: '1rem' }}>
            <Alert variant="success">
              <strong>Ready to Import</strong><br />
              {validationResult.summary}
            </Alert>
          </div>
        )}
        
        {/* Show error if validation failed */}
        {validationResult && !validationResult.isValid && validationResult.error && (
          <div style={{ marginTop: '1rem' }}>
            <Alert variant="error">
              <strong>Unable to Process Content</strong><br />
              {validationResult.error}<br />
              <span style={{ fontSize: '0.9em', marginTop: '0.5rem', display: 'block' }}>
                Please ensure you've copied the complete response from the AI chatbot.
              </span>
            </Alert>
          </div>
        )}
      </Section>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      {/* Clear Course Structure Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Course Structure"
        message="Warning: This will remove the current course structure and any content that hasn't been saved. Are you sure you want to continue?"
        confirmText="Clear"
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />

      {/* Removed validation alert - the disabled Next button provides sufficient feedback */}
    </PageLayout>
  )
}

export default JSONImportValidator;