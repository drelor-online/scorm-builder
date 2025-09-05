import React, { useState, useEffect, useRef, useCallback } from 'react'
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
import { ConfirmDialog } from './ConfirmDialog'
import { Clipboard, Trash2, CheckCircle, ChevronRight, ChevronDown, BookOpen, Target, FileQuestion, Award, Edit2, Check, X, Wand2, Eye } from 'lucide-react'
// import { useUndoRedo } from '../hooks/useUndoRedo' // Removed undo/redo functionality
import { AutoSaveBadge } from './AutoSaveBadge'
import './DesignSystem/designSystem.css'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useStepNavigation } from '../contexts/StepNavigationContext'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import { useNotifications } from '../contexts/NotificationContext'
import { smartAutoFixJSON } from '../utils/jsonAutoFixer'
import { SimpleJSONEditor } from './SimpleJSONEditor'
import { courseContentSchema } from '../schemas/courseContentSchema'
import { debugLogger } from '../utils/ultraSimpleLogger'
import { cleanupOrphanedMediaReferences, MediaExistsChecker } from '../utils/orphanedMediaCleaner'
import { cleanMediaReferencesFromCourseContent, hasMediaReferences } from '../utils/courseContentMediaCleaner'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
import styles from './JSONImportValidator.module.css'

interface JSONImportValidatorProps {
  onNext: (data: CourseContent) => void
  onBack: () => void
  onClearData?: () => void
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
  onClearData,
  onSettingsClick, 
  onSave, 
  onOpen, 
  onHelp,
  onStepClick
}) => {
  const storage = useStorage()
  const navigation = useStepNavigation()
  const { markDirty, resetDirty } = useUnsavedChanges()
  const { success, error: notifyError, info } = useNotifications()
  const { getMedia } = useUnifiedMedia()
  
  // Logger for production-safe debugging
  const logger = debugLogger
  
  // Media existence checker for orphaned media cleanup
  const mediaExistsChecker: MediaExistsChecker = async (mediaId: string): Promise<boolean> => {
    logger.debug('JSONImportValidator', `🔍 Checking existence of media: ${mediaId}`)
    try {
      const result = await getMedia(mediaId)
      const exists = result !== null
      
      // Enhanced debug logging
      if (result !== null) {
        logger.debug('JSONImportValidator', `✅ Media ${mediaId} EXISTS - result type: ${typeof result}, hasData: ${result?.data !== undefined}, hasMetadata: ${result?.metadata !== undefined}`)
      } else {
        logger.debug('JSONImportValidator', `❌ Media ${mediaId} DOES NOT EXIST - getMedia returned null`)
      }
      
      return exists
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.debug('JSONImportValidator', `💥 Media ${mediaId} ERROR during existence check: ${errorMsg}`)
      // If getMedia throws an error, the media doesn't exist
      return false
    }
  }
  
  // Helper function to apply orphaned media cleanup and show user feedback
  const applyMediaCleanup = async (parsedData: CourseContent, context: string = 'unknown'): Promise<CourseContent> => {
    logger.info('JSONImportValidator', `🔍 Starting orphaned media cleanup process from: ${context}`)
    
    // Enhanced media reference finder - checks multiple patterns and sources
    const findAllMediaIds = (obj: any, path: string = ''): string[] => {
      const mediaIds: string[] = []
      
      // Add debug logging for important paths
      if (path.includes('media') || path === '' || path.includes('welcomePage') || path.includes('learningObjectivesPage') || path.includes('topics')) {
        logger.debug('JSONImportValidator', `🔍 Checking path: ${path || 'root'} - type: ${typeof obj}, isArray: ${Array.isArray(obj)}`)
      }
      
      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          obj.forEach((item, index) => {
            mediaIds.push(...findAllMediaIds(item, `${path}[${index}]`))
          })
        } else {
          for (const [key, value] of Object.entries(obj)) {
            // Primary pattern: media arrays
            if (key === 'media' && Array.isArray(value)) {
              logger.debug('JSONImportValidator', `🎯 Found media array at ${path}.media with ${value.length} items`)
              value.forEach((mediaItem, index) => {
                logger.debug('JSONImportValidator', `🎯 Checking media item ${index}:`, mediaItem)
                if (mediaItem && typeof mediaItem === 'object' && mediaItem.id) {
                  mediaIds.push(mediaItem.id)
                  logger.info('JSONImportValidator', `📁 Found media reference: ${mediaItem.id} at ${path}.media[${index}]`)
                } else {
                  logger.debug('JSONImportValidator', `⚠️ Media item ${index} has no valid id:`, mediaItem)
                }
              })
            }
            // Additional patterns: look for any key containing 'id' that looks like media
            else if (typeof value === 'string' && (key.includes('id') || key.includes('Id')) && 
                     (value.startsWith('image-') || value.startsWith('audio-') || value.startsWith('video-'))) {
              logger.info('JSONImportValidator', `📁 Found potential media ID reference: ${value} at ${path}.${key}`)
              mediaIds.push(value)
            }
            // Continue recursive traversal
            else {
              mediaIds.push(...findAllMediaIds(value, path ? `${path}.${key}` : key))
            }
          }
        }
      }
      return mediaIds
    }

    try {
      // STEP 1: Clean the input JSON data (current behavior)
      const foundMediaIds = findAllMediaIds(parsedData)
      logger.info('JSONImportValidator', `📋 Found ${foundMediaIds.length} media references in INPUT JSON:`, foundMediaIds)
      
      // Log detailed structure to debug what content we're actually processing
      logger.debug('JSONImportValidator', '📄 INPUT JSON structure being processed:', {
        hasWelcomePage: !!parsedData.welcomePage,
        hasLearningObjectivesPage: !!parsedData.learningObjectivesPage,
        topicsCount: parsedData.topics?.length || 0,
        welcomePageMediaCount: parsedData.welcomePage?.media?.length || 0,
        learningObjectivesPageMediaCount: parsedData.learningObjectivesPage?.media?.length || 0,
        firstTopicMediaCount: parsedData.topics?.[0]?.media?.length || 0,
        rootKeys: Object.keys(parsedData)
      })
      
      const inputCleanupResult = await cleanupOrphanedMediaReferences(parsedData, mediaExistsChecker)
      logger.info('JSONImportValidator', '🎯 INPUT JSON cleanup completed', {
        totalFoundInJson: foundMediaIds.length,
        removedCount: inputCleanupResult.removedMediaIds.length,
        removedIds: Array.from(inputCleanupResult.removedMediaIds)
      })

      // STEP 2: Also check and clean existing course content from storage (CRITICAL FIX)
      let totalRemovedIds = new Set(inputCleanupResult.removedMediaIds)
      let finalCleanedContent = inputCleanupResult.cleanedContent

      if (storage && storage.isInitialized && storage.currentProjectId) {
        try {
          const existingCourseContent = await storage.getCourseContent()
          if (existingCourseContent) {
            logger.info('JSONImportValidator', '🔍 Also checking EXISTING STORAGE course content for orphaned media')
            
            const existingMediaIds = findAllMediaIds(existingCourseContent)
            logger.info('JSONImportValidator', `📋 Found ${existingMediaIds.length} media references in STORAGE:`, existingMediaIds)
            
            // Log storage structure for comparison
            logger.debug('JSONImportValidator', '📄 STORAGE structure being processed:', {
              hasWelcomePage: !!existingCourseContent.welcomePage,
              hasLearningObjectivesPage: !!existingCourseContent.learningObjectivesPage,
              topicsCount: existingCourseContent.topics?.length || 0,
              welcomePageMediaCount: existingCourseContent.welcomePage?.media?.length || 0,
              learningObjectivesPageMediaCount: existingCourseContent.learningObjectivesPage?.media?.length || 0,
              firstTopicMediaCount: existingCourseContent.topics?.[0]?.media?.length || 0
            })
            
            if (existingMediaIds.length > 0) {
              const storageCleanupResult = await cleanupOrphanedMediaReferences(existingCourseContent, mediaExistsChecker)
              logger.info('JSONImportValidator', '🎯 STORAGE cleanup completed', {
                totalFoundInStorage: existingMediaIds.length,
                removedCount: storageCleanupResult.removedMediaIds.length,
                removedIds: Array.from(storageCleanupResult.removedMediaIds)
              })
              
              // If we found orphaned references in storage, save the cleaned version
              if (storageCleanupResult.removedMediaIds.length > 0) {
                await storage.saveCourseContent(storageCleanupResult.cleanedContent)
                logger.info('JSONImportValidator', '✅ Saved cleaned storage content back to storage')
                
                // Add to total removed IDs
                storageCleanupResult.removedMediaIds.forEach(id => totalRemovedIds.add(id))
              }
            }
          }
        } catch (storageError) {
          logger.warn('JSONImportValidator', '⚠️ Could not check storage for orphaned media', {
            error: storageError instanceof Error ? storageError.message : String(storageError)
          })
        }
      }
      
      // STEP 3: Report combined results
      if (totalRemovedIds.size > 0) {
        info(`🧹 Cleaned up ${totalRemovedIds.size} orphaned media references that were pointing to deleted files.`)
        logger.info('JSONImportValidator', '✅ COMBINED orphaned media cleanup completed', {
          totalRemovedIds: Array.from(totalRemovedIds),
          count: totalRemovedIds.size
        })
      } else {
        logger.info('JSONImportValidator', '✅ No orphaned media references found in input JSON or storage')
      }
      
      // STEP 4: Apply course content media cleaning for final cleanup (removes ALL media references)
      // This is especially important for the "pre-onNext-final-cleanup" context after JSON clearing
      if (context === 'pre-onNext-final-cleanup') {
        logger.info('JSONImportValidator', '🔧 Applying final course content media cleaning to remove all media references')
        const mediaRefsBefore = hasMediaReferences(finalCleanedContent)
        if (mediaRefsBefore) {
          finalCleanedContent = cleanMediaReferencesFromCourseContent(finalCleanedContent) as CourseContent
          logger.info('JSONImportValidator', '✅ Final course content media cleaning completed - all media references removed')
        } else {
          logger.info('JSONImportValidator', '✅ No media references found in course content - no additional cleaning needed')
        }
      }
      
      return finalCleanedContent
      
    } catch (error) {
      logger.error('JSONImportValidator', '❌ Failed to clean up orphaned media references', {
        error: error instanceof Error ? error.message : String(error)
      })
      // Return original data if cleanup fails
      return parsedData
    }
  }
  
  // Always start with empty JSON input - users should paste their own content
  const [jsonInput, setJsonInput] = useState('')
  
  const [validationResult, setValidationResult] = useState<any>(null)
  const [isTreeVisible, setIsTreeVisible] = useState(false)
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState('')
  
  // Refs for focus and scroll management
  const treeViewRef = useRef<HTMLDivElement>(null)
  const jsonEditorRef = useRef<HTMLDivElement>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']))
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousProjectIdRef = useRef<string | null>(null)
  const isLoadingFromStorageRef = useRef(false)
  const isAutoFixingRef = useRef(false)
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false)
  
  // Load persisted JSON import data on mount and when project changes
  useEffect(() => {
    const loadPersistedValidationState = async () => {
      if (storage && storage.isInitialized && storage.currentProjectId) {
        // Check if this is a project change or initial mount
        const isProjectChange = previousProjectIdRef.current !== null && previousProjectIdRef.current !== storage.currentProjectId
        const isInitialMount = previousProjectIdRef.current === null
        const currentProjectId = storage.currentProjectId
        
        if (isProjectChange) {
          // Log project change and clear state
          logger.info('JSONValidator', 'Loading JSON for new project', { 
            previousProjectId: previousProjectIdRef.current,
            newProjectId: currentProjectId
          })
          
          // Clear state when switching projects to prevent stale data
          setJsonInput('')
          setValidationResult(null)
          setIsLocked(false)
          setIsTreeVisible(false)
          setHasLoadedInitialData(false) // Reset to allow loading for new project
          
          // Update the ref to track current project
          previousProjectIdRef.current = currentProjectId
          return // Don't try to load data for different project
        } else if (isInitialMount) {
          logger.info('JSONValidator', 'Initial mount - loading persisted JSON data', { 
            projectId: currentProjectId 
          })
        } else {
          // Same project - always try to load persisted state 
          // This handles navigation within the same project
          logger.info('JSONValidator', 'Same project navigation - loading persisted data', { 
            projectId: currentProjectId 
          })
        }
        
        // Update the ref to track current project (for non-project-change cases)
        previousProjectIdRef.current = currentProjectId
        
        try {
          // Set loading flag to prevent validation triggers during state restoration
          isLoadingFromStorageRef.current = true
          
          // Try to load the complete JSON import data
          const jsonImportData = await storage.getContent('json-import-data')
          logger.info('JSONValidator', 'Raw storage response for json-import-data', {
            projectId: currentProjectId,
            dataExists: !!jsonImportData,
            dataType: typeof jsonImportData,
            dataKeys: jsonImportData ? Object.keys(jsonImportData) : null,
            rawJsonExists: jsonImportData?.rawJson ? true : false,
            rawJsonLength: jsonImportData?.rawJson?.length || 0
          })
          
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
            // Restore tree view state, or auto-switch if data is locked and valid
            if (jsonImportData.isTreeVisible !== undefined) {
              setIsTreeVisible(jsonImportData.isTreeVisible)
            } else if (jsonImportData.isLocked && jsonImportData.validationResult?.isValid) {
              setIsTreeVisible(true)
            }
            
            logger.info('JSONValidator', 'Loaded saved JSON state', {
              hasJson: !!jsonImportData.rawJson,
              isLocked: jsonImportData.isLocked,
              hasValidation: !!jsonImportData.validationResult,
              jsonLength: jsonImportData.rawJson?.length || 0
            })
            
            setHasLoadedInitialData(true)
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
            
            setHasLoadedInitialData(true)
          }
        } catch (error) {
          logger.error('JSONValidator', 'Error loading persisted validation state', { error: error instanceof Error ? error.message : String(error) })
          console.error('Error loading persisted validation state:', error)
          setHasLoadedInitialData(true)
        } finally {
          // Clear loading flag after state restoration is complete
          isLoadingFromStorageRef.current = false
        }
      }
    }
    
    loadPersistedValidationState()
  }, [storage?.isInitialized, storage?.currentProjectId, logger])
  
  // State persistence is handled directly in validation success handlers and navigation handlers
  
  // Note: Validation state persistence is handled directly in validation success handlers
  // to avoid race conditions with async state updates
  
  // Cleanup timeouts on unmount and save final state
  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current)
      }
      
      // Save final state on unmount to ensure data isn't lost during navigation
      if (storage && storage.isInitialized && (jsonInput.trim() || validationResult)) {
        const jsonImportData = {
          rawJson: jsonInput,
          validationResult: validationResult,
          isLocked: isLocked,
          isTreeVisible: isTreeVisible
        }
        storage.saveContent('json-import-data', jsonImportData).catch((error) => {
          console.error('Error saving JSON data on unmount:', error)
        })
      }
    }
  }, [jsonInput, validationResult, isLocked, isTreeVisible, storage])
  
  // Handle screen reader announcements when toggling views (focus management removed to prevent unwanted focus stealing)
  useEffect(() => {
    if (isTreeVisible) {
      // When switching to tree view
      setScreenReaderAnnouncement('Switched to course tree view. Use Tab to navigate through course structure.')
    } else {
      // When switching back to JSON editor
      setScreenReaderAnnouncement('Switched to JSON editor view. You can edit the course content here.')
    }
    
    // Clear screen reader announcement after a delay
    if (screenReaderAnnouncement) {
      const timeout = setTimeout(() => {
        setScreenReaderAnnouncement('')
      }, 3000) // Clear after 3 seconds
      return () => clearTimeout(timeout)
    }
  }, [isTreeVisible, screenReaderAnnouncement])
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + T: Toggle JSON/tree view
      if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault()
        // Only toggle if validation result is valid
        if (validationResult?.isValid && validationResult?.data) {
          setIsTreeVisible(prev => !prev)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [validationResult])
  
  // Race condition eliminated by using user-controlled toggle view instead of timing-based logic
  
  // Removed logic that would update jsonInput from initialData - users should paste their own content
  
  // JSON input state is tracked but not auto-saved to localStorage anymore

  const validateJSON = async () => {
    // Prevent multiple simultaneous validations
    if (isValidating || isAutoFixingRef.current) {
      return
    }
    
    // Add timeout for extremely large JSON to prevent hanging
    const MAX_VALIDATION_TIME = 10000 // 10 seconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Validation timeout - JSON too large to process')), MAX_VALIDATION_TIME)
    })
    
    const validationPromise = (async () => {
      // Clear previous validation result
      setValidationResult(null)
      setIsValidating(true)
      
      let processedInput = jsonInput
      let wasAutoFixed = false
      
      // Check for escaped brackets before processing
      const hasEscapedBrackets = processedInput.includes('\\[') || processedInput.includes('\\]')
      if (hasEscapedBrackets) {
        console.log('INFO: Detected escaped brackets in JSON - will auto-fix')
      }
      
      try {
        // Check for extremely large input early
        if (processedInput.length > 500000) { // 500KB limit
          throw new Error('JSON file is too large (>500KB). Please reduce the content size.')
        }
      
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
        ['\u2014', 'em dash'],
        ['\\[', 'escaped opening bracket'],
        ['\\]', 'escaped closing bracket']
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
        
        // Clean up orphaned media references
        const cleanedData = await applyMediaCleanup(parsedData, 'pre-processing')
        
        // Update validation state with production-safe logging
        logger.info('JSONValidator', 'JSON validation successful (pre-processing)', {
          topicsCount: cleanedData.topics?.length || 0,
          hasWelcomePage: !!cleanedData.welcomePage,
          hasObjectivesPage: !!cleanedData.learningObjectivesPage,
          hasAssessment: !!cleanedData.assessment
        })

        // COMPREHENSIVE LOGGING: Track validation result creation (PRE-PROCESSING PATH)
        logger.info('JSONImportValidator', '📋 Creating validation result from CLEANED data (pre-processing)', {
          cleanedDataId: 'pre-processing-path',
          hasWelcomePage: !!cleanedData.welcomePage,
          hasObjectivesPage: !!cleanedData.learningObjectivesPage,
          topicsCount: cleanedData.topics?.length || 0,
          welcomePageHasMedia: !!cleanedData.welcomePage?.media,
          welcomePageMediaCount: cleanedData.welcomePage?.media?.length || 0,
          objectivesPageHasMedia: !!cleanedData.learningObjectivesPage?.media,
          objectivesPageMediaCount: cleanedData.learningObjectivesPage?.media?.length || 0,
          firstTopicHasMedia: !!cleanedData.topics?.[0]?.media,
          firstTopicMediaCount: cleanedData.topics?.[0]?.media?.length || 0
        })
        
        // Update state synchronously to prevent race condition
        setValidationResult({
          isValid: true,
          data: cleanedData,
          summary: `Successfully parsed! Contains ${cleanedData.topics?.length || 0} topics.`
        })
        
        success('✅ Valid JSON detected! Course structure loaded successfully.')
        
        setIsLocked(true)
        setIsValidating(false)
        setIsTreeVisible(true) // Auto-switch to tree view
        
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
              data: cleanedData,
              summary: `Successfully parsed! Contains ${cleanedData.topics?.length || 0} topics.`
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
        
        // Clean up orphaned media references
        const cleanedData = await applyMediaCleanup(parsedData, 'smart-auto-fix')
        
        logger.info('JSONValidator', 'JSON validation successful (smart auto-fix)', {
          topicsCount: cleanedData.topics?.length || 0,
          hasWelcomePage: !!cleanedData.welcomePage,
          hasObjectivesPage: !!cleanedData.learningObjectivesPage,
          hasAssessment: !!cleanedData.assessment
        })

        // COMPREHENSIVE LOGGING: Track validation result creation (SMART-AUTO-FIX PATH)
        logger.info('JSONImportValidator', '📋 Creating validation result from CLEANED data (smart-auto-fix)', {
          cleanedDataId: 'smart-auto-fix-path',
          hasWelcomePage: !!cleanedData.welcomePage,
          hasObjectivesPage: !!cleanedData.learningObjectivesPage,
          topicsCount: cleanedData.topics?.length || 0,
          welcomePageHasMedia: !!cleanedData.welcomePage?.media,
          welcomePageMediaCount: cleanedData.welcomePage?.media?.length || 0,
          objectivesPageHasMedia: !!cleanedData.learningObjectivesPage?.media,
          objectivesPageMediaCount: cleanedData.learningObjectivesPage?.media?.length || 0,
          firstTopicHasMedia: !!cleanedData.topics?.[0]?.media,
          firstTopicMediaCount: cleanedData.topics?.[0]?.media?.length || 0
        })
        
        // Update state synchronously to prevent race condition
        setValidationResult({
          isValid: true,
          data: cleanedData,
          summary: `Successfully parsed! Contains ${cleanedData.topics?.length || 0} topics.`
        })
        
        success('🔧 JSON automatically fixed and validated! Course structure loaded.')
        
        setIsLocked(true)
        setIsValidating(false)
        setIsTreeVisible(true) // Auto-switch to tree view
        
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
              data: cleanedData,
              summary: `Successfully parsed! Contains ${cleanedData.topics?.length || 0} topics.`
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
        setIsTreeVisible(false) // Hide tree view on error
        return
      }

      // Validate welcomePage
      if (!parsedData.welcomePage) {
        setValidationResult({ isValid: false, error: 'Missing required field: welcomePage' })
        setIsValidating(false)
        setIsTreeVisible(false) // Hide tree view on error
        return
      }
      if (!parsedData.welcomePage.id || !parsedData.welcomePage.title || !parsedData.welcomePage.content || !parsedData.welcomePage.narration) {
        setValidationResult({ isValid: false, error: 'Missing required fields in welcomePage' })
        setIsValidating(false)
        setIsTreeVisible(false) // Hide tree view on error
        return
      }

      // Validate learningObjectivesPage
      if (!parsedData.learningObjectivesPage) {
        setValidationResult({ isValid: false, error: 'Missing required field: learningObjectivesPage' })
        setIsValidating(false)
        setIsTreeVisible(false) // Hide tree view on error
        return
      }
      if (!parsedData.learningObjectivesPage.id || !parsedData.learningObjectivesPage.title || 
          !parsedData.learningObjectivesPage.content || !parsedData.learningObjectivesPage.narration) {
        setValidationResult({ isValid: false, error: 'Missing required fields in learningObjectivesPage' })
        setIsValidating(false)
        setIsTreeVisible(false) // Hide tree view on error
        return
      }

      // Validate topics
      if (!parsedData.topics || !Array.isArray(parsedData.topics)) {
        setValidationResult({ isValid: false, error: 'Missing required field: topics' })
        setIsValidating(false)
        setIsTreeVisible(false) // Hide tree view on error
        return
      }

      for (const topic of parsedData.topics) {
        if (!topic.id || !topic.title || !topic.content || topic.narration === undefined) {
          setValidationResult({ isValid: false, error: 'Missing required fields in topic' })
          setIsValidating(false)
          setIsTreeVisible(false) // Hide tree view on error
          return
        }
        // Check for old format
        if ('bulletPoints' in topic || Array.isArray(topic.narration)) {
          setValidationResult({ isValid: false, error: 'Invalid format: Topics should have single narration string, not array or bulletPoints' })
          setIsValidating(false)
          setIsTreeVisible(false) // Hide tree view on error
          return
        }
      }

      // Validate assessment
      if (!parsedData.assessment || !parsedData.assessment.questions || !Array.isArray(parsedData.assessment.questions)) {
        setValidationResult({ isValid: false, error: 'Missing required field: assessment' })
        setIsValidating(false)
        setIsTreeVisible(false) // Hide tree view on error
        return
      }

      // Auto-fix missing or null assessment narration
      if (!parsedData.assessment.narration) {
        parsedData.assessment.narration = null
        fixes.push('Added missing assessment narration')
      }

      // Auto-fix missing assessment passMark
      if (typeof parsedData.assessment.passMark !== 'number') {
        parsedData.assessment.passMark = 80
        fixes.push('Added missing assessment pass mark (80%)')
      }

      // Auto-fix missing fields in welcomePage
      if (!parsedData.welcomePage.narration) {
        parsedData.welcomePage.narration = ''
        fixes.push('Added missing welcome page narration')
      }
      if (!parsedData.welcomePage.imageKeywords) {
        parsedData.welcomePage.imageKeywords = []
        fixes.push('Added missing welcome page image keywords')
      }
      if (!parsedData.welcomePage.imagePrompts) {
        parsedData.welcomePage.imagePrompts = []
        fixes.push('Added missing welcome page image prompts')
      }
      if (!parsedData.welcomePage.videoSearchTerms) {
        parsedData.welcomePage.videoSearchTerms = []
        fixes.push('Added missing welcome page video search terms')
      }
      if (typeof parsedData.welcomePage.duration !== 'number') {
        parsedData.welcomePage.duration = 2
        fixes.push('Added missing welcome page duration (2 minutes)')
      }

      // Auto-fix missing fields in learningObjectivesPage
      if (!parsedData.learningObjectivesPage.imageKeywords) {
        parsedData.learningObjectivesPage.imageKeywords = []
        fixes.push('Added missing objectives page image keywords')
      }
      if (!parsedData.learningObjectivesPage.imagePrompts) {
        parsedData.learningObjectivesPage.imagePrompts = []
        fixes.push('Added missing objectives page image prompts')
      }
      if (!parsedData.learningObjectivesPage.videoSearchTerms) {
        parsedData.learningObjectivesPage.videoSearchTerms = []
        fixes.push('Added missing objectives page video search terms')
      }
      if (typeof parsedData.learningObjectivesPage.duration !== 'number') {
        parsedData.learningObjectivesPage.duration = 3
        fixes.push('Added missing objectives page duration (3 minutes)')
      }

      // Auto-fix missing fields in topics
      for (let i = 0; i < parsedData.topics.length; i++) {
        const topic = parsedData.topics[i]
        
        if (!topic.narration) {
          topic.narration = ''
          fixes.push(`Added missing narration for topic "${topic.title}"`)
        }
        if (!topic.imageKeywords) {
          topic.imageKeywords = []
          fixes.push(`Added missing image keywords for topic "${topic.title}"`)
        }
        if (!topic.imagePrompts) {
          topic.imagePrompts = []
          fixes.push(`Added missing image prompts for topic "${topic.title}"`)
        }
        if (!topic.videoSearchTerms) {
          topic.videoSearchTerms = []
          fixes.push(`Added missing video search terms for topic "${topic.title}"`)
        }
        if (typeof topic.duration !== 'number') {
          topic.duration = 5
          fixes.push(`Added missing duration for topic "${topic.title}" (5 minutes)`)
        }
        if (!topic.knowledgeCheck) {
          topic.knowledgeCheck = { questions: [] }
          fixes.push(`Added missing knowledge check for topic "${topic.title}"`)
        }
      }

      // Auto-fix missing question feedback
      for (let i = 0; i < parsedData.assessment.questions.length; i++) {
        const question = parsedData.assessment.questions[i]
        
        if (!question.feedback) {
          question.feedback = {
            correct: 'Correct!',
            incorrect: 'Incorrect. Please review the material and try again.'
          }
          fixes.push(`Added missing feedback for assessment question ${i + 1}`)
        }
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
        // Set flag to prevent re-validation loop during auto-fix
        isAutoFixingRef.current = true
        
        // Clear any pending validation timeouts to prevent conflicts
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current)
          validationTimeoutRef.current = null
        }
        
        // Format the fixed JSON nicely
        const formattedJson = JSON.stringify(parsedData, null, 2)
        setJsonInput(formattedJson)
        markDirty('courseContent') // Mark dirty when formatting content
        success(`✨ Automatically fixed ${fixes.length} formatting issue(s)`)
        
        // Reset flag after a brief delay to allow the input update to complete
        setTimeout(() => {
          isAutoFixingRef.current = false
        }, 200) // Increased delay to ensure completion
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
      setIsTreeVisible(true) // Auto-switch to tree view
      
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
      success('✅ JSON validated successfully! Content is now locked. Click "Next" to proceed or "Clear JSON" to start over.')
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
          // Set flag to prevent re-validation loop during auto-fix
          isAutoFixingRef.current = true
          setJsonInput(autoFixed)
          markDirty('courseContent') // Mark dirty when auto-fixing content
          info('Applied auto-fixes, validating...')
          // Try validation again with fixed JSON
          validationTimeoutRef.current = setTimeout(() => {
            validateJSON()
            // Reset flag after validation completes
            isAutoFixingRef.current = false
          }, 100)
          setIsValidating(false)
          return
        }
      }
      
      setValidationResult({ isValid: false, error: errorMessage })
      setIsValidating(false)
    }
    })() // End of validation promise
    
    // Race between validation and timeout
    try {
      await Promise.race([validationPromise, timeoutPromise])
    } catch (error) {
      setIsValidating(false)
      if (error instanceof Error && error.message.includes('timeout')) {
        setValidationResult({ 
          isValid: false, 
          error: 'Validation timeout: The JSON file is too large or complex to process. Please try with a smaller file or break your content into smaller sections.' 
        })
      } else {
        // Re-throw other errors to be handled by the normal error handling
        throw error
      }
    }
  }

  const handlePasteFromClipboard = async () => {
    if (isLocked) {
      // User should clear structure first - this is handled by the UI state
      return
    }
    
    try {
      const text = await navigator.clipboard.readText()
      setJsonInput(text)
      markDirty('courseContent') // Mark dirty when pasting content
      success('Content pasted from clipboard!')
      // Automatically validate immediately after pasting
      setTimeout(() => validateJSON(), 100)
    } catch (err) {
      notifyError('Failed to read clipboard. Please paste manually.')
    }
  }


  const handleNext = async () => {
    if (validationResult?.isValid && validationResult.data) {
      // Explicitly save JSON state before navigation
      try {
        if (storage?.currentProjectId) {
          const jsonImportData = {
            rawJson: jsonInput,
            validationResult: validationResult,
            isLocked: isLocked
          }
          await storage.saveContent('json-import-data', jsonImportData)
          logger.info('JSONValidator', 'Explicit save before navigation', {
            projectId: storage.currentProjectId,
            hasRawJson: !!jsonImportData.rawJson,
            isLocked: jsonImportData.isLocked
          })
        }
      } catch (error) {
        logger.error('JSONValidator', 'Failed to save before navigation', {
          error: error instanceof Error ? error.message : String(error)
        })
      }

      // CRITICAL FIX: Clean validation result data before passing to onNext
      // This ensures no orphaned media references get passed to the next step
      logger.info('JSONImportValidator', '🔧 Final cleanup of validation result data before onNext')
      
      try {
        const finalCleanedData = await applyMediaCleanup(validationResult.data, 'pre-onNext-final-cleanup')
        
        logger.info('JSONImportValidator', '✅ Final cleanup completed before onNext', {
          hasWelcomePage: !!finalCleanedData.welcomePage,
          hasObjectivesPage: !!finalCleanedData.learningObjectivesPage,
          topicsCount: finalCleanedData.topics?.length || 0,
          hasAssessment: !!finalCleanedData.assessment
        })
        
        // Unlock all subsequent steps when JSON is validated successfully
        // Steps: 0=Seed, 1=Prompt, 2=JSON, 3=Media, 4=Audio, 5=Activities, 6=SCORM
        navigation.unlockSteps([3, 4, 5, 6])
        resetDirty('courseContent') // Reset dirty flag on successful next
        
        // Pass the final cleaned data to onNext instead of the raw validation result
        onNext(finalCleanedData)
        
      } catch (cleanupError) {
        logger.error('JSONImportValidator', '❌ Failed to clean validation result data before onNext', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        })
        
        // Fallback: still proceed with original data to not break the user flow
        navigation.unlockSteps([3, 4, 5, 6])
        resetDirty('courseContent')
        onNext(validationResult.data)
      }
    }
    // Don't show alert - the disabled Next button provides sufficient feedback
  }

  const handleBack = async () => {
    // Explicitly save JSON state before navigation
    try {
      if (storage?.currentProjectId && (jsonInput || validationResult)) {
        const jsonImportData = {
          rawJson: jsonInput,
          validationResult: validationResult,
          isLocked: isLocked
        }
        await storage.saveContent('json-import-data', jsonImportData)
        logger.info('JSONValidator', 'Explicit save before back navigation', {
          projectId: storage.currentProjectId,
          hasRawJson: !!jsonImportData.rawJson,
          isLocked: jsonImportData.isLocked
        })
      }
    } catch (error) {
      logger.error('JSONValidator', 'Failed to save before back navigation', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
    
    onBack()
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
    setIsTreeVisible(false) // Reset to JSON editor view
    info('Course structure cleared. All pages have been reset and locked until new JSON is imported.')
    
    // Clear any existing validation timeout to prevent interference
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current)
      validationTimeoutRef.current = null
    }
    
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
    
    // Call the onClearData callback to clear course content in App.tsx
    if (onClearData) {
      onClearData()
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

  // Helper function to format answer display properly
  const formatAnswerDisplay = (correctAnswer: any) => {
    if (typeof correctAnswer === 'boolean') {
      return correctAnswer ? 'True' : 'False'
    }
    if (correctAnswer === null || correctAnswer === undefined) {
      return 'Not specified'
    }
    return String(correctAnswer)
  }

  // Render tree view for validated content
  const renderTreeView = (data: CourseContent) => {
    // Defensive check - ensure we have valid data structure
    if (!data || !data.welcomePage || !data.learningObjectivesPage || !data.topics || !data.assessment) {
      return (
        <div style={{ padding: '1rem', textAlign: 'center' }}>
          <p>Invalid or incomplete course data. Please check your JSON structure.</p>
        </div>
      )
    }
    
    const isExpanded = (nodeId: string) => expandedNodes.has(nodeId)
    
    return (
      <div className={`${styles.treeView} ${styles.treeViewDark}`} data-testid="json-tree-view">
        {/* Welcome Page */}
        <div className={styles.treeNode}>
          <div 
            className={styles.treeNodeHeader}
            onClick={() => toggleNode('welcome')}
            style={{ cursor: 'pointer' }}
            data-testid="json-tree-node-welcome"
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
            data-testid="json-tree-node-objectives"
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
            data-testid="json-tree-node-topics"
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
                    data-testid={`json-tree-node-topic-${topic.id}`}
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
                          <Icon icon={FileQuestion} size="xs" /> {topic.knowledgeCheck.questions.length} {topic.knowledgeCheck.questions.length === 1 ? 'question' : 'questions'}
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
                                  Answer: {formatAnswerDisplay(q.correctAnswer)}
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
            data-testid="json-tree-node-assessment"
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
                {data.assessment.questions.length} {data.assessment.questions.length === 1 ? 'question' : 'questions'}
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
                        Answer: {formatAnswerDisplay(q.correctAnswer)}
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
      description="Paste the JSON response from your AI chatbot below."
      autoSaveIndicator={autoSaveIndicator}
      onSettingsClick={onSettingsClick}
      onSave={onSave}
      onBack={handleBack}
      onNext={handleNext}
      nextDisabled={!isLocked && !validationResult?.isValid}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
    >
      {/* Screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0'
        }}
        role="status"
      >
        {screenReaderAnnouncement}
      </div>
      
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
        {/* Toggle button - visible when JSON has been successfully validated */}
        {isLocked && (
          <div style={{ marginBottom: '1rem' }}>
            <Button
              variant="primary"
              onClick={() => setIsTreeVisible(prev => !prev)}
              data-testid="toggle-view-button"
              aria-label={isTreeVisible ? 'Switch to JSON editor view (Ctrl+T)' : 'Switch to course tree view (Ctrl+T)'}
              title="Press Ctrl+T to toggle view"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Icon icon={Eye} size="sm" />
              {isTreeVisible ? 'Show JSON Editor' : 'Show Course Tree'}
            </Button>
          </div>
        )}

        {/* Show tree view when user chooses to, editor otherwise */}
        {isTreeVisible && isLocked ? (
            <div 
              ref={treeViewRef} 
              tabIndex={0}
              role="region"
              aria-label="Course structure tree view"
            >
              {/* Course Structure */}
              <div className={styles.sectionWrapper}>
                <h2 className={styles.sectionTitle}>Course Structure</h2>
                <Card>
                  {validationResult?.data ? 
                    renderTreeView(validationResult.data) : 
                    <div style={{ padding: '1rem', textAlign: 'center' }}>
                      <p>Course structure validated successfully, but data is temporarily unavailable.</p>
                      <p>Try switching back to JSON view and then to tree view again.</p>
                    </div>
                  }
                </Card>
              </div>
            </div>
          ) : (
            <>
              {/* Content Input */}
              <Card>
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: '600' }}>
                    Chatbot Response
                  </h3>
                  <div 
                    ref={jsonEditorRef} 
                    tabIndex={0}
                    role="region"
                    aria-label="JSON editor"
                  >
                    <SimpleJSONEditor
              value={jsonInput}
              onChange={(value) => {
                if (!isLocked && !isLoadingFromStorageRef.current) {
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
                if (!isLocked && !isLoadingFromStorageRef.current && jsonInput && jsonInput.trim().length > 50) {
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
                // Don't update validation state if already locked or loading from storage
                if (isLocked || isLoadingFromStorageRef.current) {
                  return
                }
                
                // If JSON is syntactically valid, automatically trigger full validation
                // Skip if we're currently auto-fixing to prevent infinite loops
                if (isValid && jsonInput.trim().length > 0 && !isAutoFixingRef.current) {
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
          </div>

                {/* Action Buttons */}
                <Flex justify="start" align="center" wrap gap="medium" style={{ marginBottom: '1rem' }}>
                  <Button 
                    variant="secondary"
                    onClick={handlePasteFromClipboard}
                    data-testid="paste-clipboard-button"
                    aria-label="Paste JSON content from clipboard"
                    disabled={isValidating}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <Icon icon={Clipboard} size="sm" />
                    Paste from Clipboard
                  </Button>
                  
                  {/* Show validation status */}
                  {isValidating && (
                    <div 
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}
                      role="status"
                      aria-live="polite"
                    >
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

        {/* Clear button - always available when there's content */}
        {jsonInput.trim().length > 0 && (
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
        )}
      </Section>

      
      {/* Clear Course Structure Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear Course Structure"
        message={
          <>
            <strong>Warning:</strong> This will remove the current course structure and <strong>all content</strong> from the following pages:
            <ul style={{ margin: '0.75rem 0', paddingLeft: '1.5rem' }}>
              <li>Media Enhancement</li>
              <li>Audio Narration</li>
              <li>Activities Editor</li>
              <li>SCORM Package Builder</li>
            </ul>
            These pages will be <strong>locked</strong> until you import new JSON data.
            <br /><br />
            <strong>Alternative:</strong> If you just want to edit course content, you can make changes on the individual pages above instead of clearing the JSON structure.
            <br /><br />
            Are you sure you want to clear the course structure?
          </>
        }
        confirmText="Clear Course Structure"
        cancelText="Keep Current Structure"
        variant="warning"
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />

      {/* Removed validation alert - the disabled Next button provides sufficient feedback */}
    </PageLayout>
  )
}

export default JSONImportValidator;