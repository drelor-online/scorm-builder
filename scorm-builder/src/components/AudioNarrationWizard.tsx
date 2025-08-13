import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { CourseContentUnion, Media } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'
import JSZip from 'jszip'
import { PageLayout } from './PageLayout'
import { ConfirmDialog } from './ConfirmDialog'
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected'
import { 
  Button, 
  Card, 
  ButtonGroup,
  Grid,
  Alert,
  Modal,
  Icon,
  ProgressBar
} from './DesignSystem'
import { FileAudio, FileText, Eye, Mic, Circle, Save, Upload, Play, Square, CheckCircle, ChevronDown, ChevronUp, Volume2, Pause, X } from 'lucide-react'
import { TauriAudioPlayer } from './TauriAudioPlayer'
import './DesignSystem/designSystem.css'
import { tokens } from './DesignSystem/designTokens'
import styles from './AudioNarrationWizard.module.css'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useStepData } from '../hooks/useStepData'
// Removed blobUrlManager - now using asset URLs from MediaService
import { generateAudioRecordingId } from '../utils/idGenerator'
import { logger } from '../utils/logger'
import { debugLogger } from '../utils/ultraSimpleLogger'

// Debounce helper
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null
  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}

// Page ID normalization helper
function normalizePageId(pageId: string): string {
  // Normalize welcome page variations
  if (pageId === 'welcomePage' || pageId === 'welcome-page') {
    return 'welcome'
  }
  // Normalize objectives page variations
  if (pageId === 'learningObjectivesPage' || pageId === 'learning-objectives' || pageId === 'objectives-page' || pageId === 'learningObjectives') {
    return 'objectives'
  }
  // Keep topic IDs as-is
  if (pageId.includes('topic')) {
    return pageId
  }
  return pageId
}

interface AudioNarrationWizardProps {
  courseContent: CourseContentUnion
  courseSeedData?: CourseSeedData
  onNext: (enhancedContent: CourseContentUnion) => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: (content?: any, silent?: boolean) => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
}

interface AudioFile {
  blockNumber: string
  file: File
  url?: string  // Now optional since asset URLs may not be immediately available
  mediaId?: string // MediaRegistry ID
}

interface CaptionFile {
  blockNumber: string
  content: string
  mediaId?: string // MediaRegistry ID
}

// Unified narration block structure for internal use
interface UnifiedNarrationBlock {
  id: string
  text: string
  blockNumber: string
  pageId: string
  pageTitle: string
}

// Convert course content to unified narration blocks for easier handling
function extractNarrationBlocks(content: CourseContentUnion): UnifiedNarrationBlock[] {
  const blocks: UnifiedNarrationBlock[] = []
  let blockCounter = 1

  // Handle null or undefined content
  if (!content) {
    return blocks
  }

  // Check if it has new format pages
  const hasNewPages = 'welcomePage' in content && 'learningObjectivesPage' in content
  
  if (hasNewPages) {
    // Add welcome page narration
    const anyContent = content as any
    if (anyContent.welcomePage?.narration) {
      blocks.push({
        id: `welcome-narration`,
        text: anyContent.welcomePage.narration,
        blockNumber: String(blockCounter++).padStart(4, '0'),
        // Always use 'welcome' for consistency with media ID generation
        pageId: 'welcome',
        pageTitle: anyContent.welcomePage.title
      })
    }

    // Add learning objectives page narration
    if (anyContent.learningObjectivesPage?.narration) {
      blocks.push({
        id: `objectives-narration`,
        text: anyContent.learningObjectivesPage.narration,
        blockNumber: String(blockCounter++).padStart(4, '0'),
        // Always use 'objectives' for consistency with media ID generation
        pageId: 'objectives',
        pageTitle: anyContent.learningObjectivesPage.title
      })
    }
  }

  // Process topics (both formats)
  if (content.topics && Array.isArray(content.topics)) {
    content.topics.forEach(topic => {
      const anyTopic = topic as any
      if (anyTopic.narration) {
        blocks.push({
          id: `${anyTopic.id}-narration`,
          text: anyTopic.narration,
          blockNumber: String(blockCounter++).padStart(4, '0'),
          pageId: anyTopic.id,
          pageTitle: anyTopic.title
        })
      }
    })
  }

  return blocks
}

export function AudioNarrationWizard({
  courseContent,
  onNext,
  onBack,
  onSettingsClick,
  onSave,
  onOpen,
  onHelp,
  onStepClick
}: AudioNarrationWizardProps) {
  const storage = useStorage()
  const { 
    storeMedia,
    getMedia,
    getMediaForPage,
    createBlobUrl,
    revokeBlobUrl,
    getAllMedia,
    deleteMedia,
    hasAudioCached,
    getCachedAudio,
    clearAudioFromCache
  } = useUnifiedMedia()
  const { success, error: notifyError, info } = useNotifications()
  
  // Extract narration blocks
  const initialBlocks = extractNarrationBlocks(courseContent)
  logger.log('[AudioNarrationWizard] Initial narration blocks:', initialBlocks.map(b => ({
    blockNumber: b.blockNumber,
    pageId: b.pageId,
    pageTitle: b.pageTitle
  })))
  
  // Log the objectives page details specifically
  const objectivesBlock = initialBlocks.find(b => b.pageTitle?.toLowerCase().includes('objective') || b.pageId.includes('objective'))
  if (objectivesBlock) {
    logger.log('[AudioNarrationWizard] Objectives block details:', {
      blockNumber: objectivesBlock.blockNumber,
      pageId: objectivesBlock.pageId,
      pageTitle: objectivesBlock.pageTitle,
      id: objectivesBlock.id
    })
  }
  
  const [narrationBlocks, setNarrationBlocks] = useState<UnifiedNarrationBlock[]>(initialBlocks)
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [captionFiles, setCaptionFiles] = useState<CaptionFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  // Use refs to persist state across renders and prevent race conditions
  const audioFilesRef = useRef<AudioFile[]>([])
  const captionFilesRef = useRef<CaptionFile[]>([])
  const tempBlobUrlsRef = useRef<Set<string>>(new Set())
  const hasBulkUploadedRef = useRef<boolean>(false) // Track if we have bulk uploaded files
  const narrationBlocksRef = useRef<UnifiedNarrationBlock[]>(initialBlocks)
  
  // Keep refs in sync with state
  audioFilesRef.current = audioFiles
  captionFilesRef.current = captionFiles
  narrationBlocksRef.current = narrationBlocks
  const [playingBlockNumber, setPlayingBlockNumber] = useState<string | null>(null)
  const [audioVersionMap, setAudioVersionMap] = useState<Map<string, number>>(new Map())
  const [audioUploaded, setAudioUploaded] = useState(false)
  const [captionsUploaded, setCaptionsUploaded] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string
    percent: number
  } | null>(null)
  
  // Media loading cache to prevent redundant reads
  const mediaCache = useRef<Map<string, any>>(new Map())
  
  // Track when we last loaded data to prevent excessive reloads
  const lastLoadTime = useRef<number>(0)
  const MIN_RELOAD_INTERVAL = 2000 // 2 seconds minimum between reloads
  
  // Loading state for persisted data
  const [isLoadingPersistedData, setIsLoadingPersistedData] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [previewBlockId, setPreviewBlockId] = useState<string | null>(null)
  const [blockToReplaceAudio, setBlockToReplaceAudio] = useState<UnifiedNarrationBlock | null>(null)
  const [showReplaceAudioModal, setShowReplaceAudioModal] = useState<UnifiedNarrationBlock | null>(null)
  const [showBulkUpload, setShowBulkUpload] = useState(false) // Collapsible bulk upload section
  const [showInstructions, setShowInstructions] = useState(false) // Collapsible instructions
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false) // Clear all confirmation dialog
  const [isBulkAudioUploading, setIsBulkAudioUploading] = useState(false) // Track bulk audio upload separately
  const [isBulkOperationActive, setIsBulkOperationActive] = useState(false) // Track ANY bulk operation
  
  // Confirmation dialog states for audio/caption removal
  const [showRemoveAudioConfirm, setShowRemoveAudioConfirm] = useState(false)
  const [showRemoveCaptionConfirm, setShowRemoveCaptionConfirm] = useState(false)
  const [pendingRemoveBlockNumber, setPendingRemoveBlockNumber] = useState<string | null>(null)
  
  // Version tracking no longer needed with arrays
  
  // Consolidated recording state for better performance
  interface RecordingState {
    showModal: boolean
    blockId: string | null
    isRecording: boolean
    mediaRecorder: MediaRecorder | null
    audioChunks: Blob[]
    time: number
    error: string | null
    previewUrl: string | null
  }
  
  const [recordingState, setRecordingState] = useState<RecordingState>({
    showModal: false,
    blockId: null,
    isRecording: false,
    mediaRecorder: null,
    audioChunks: [],
    time: 0,
    error: null,
    previewUrl: null
  })
  
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  // Helper functions for recording state updates (to minimize migration changes)
  const showRecordingModal = recordingState.showModal
  const recordingBlockId = recordingState.blockId
  const isRecording = recordingState.isRecording
  const mediaRecorder = recordingState.mediaRecorder
  const audioChunks = recordingState.audioChunks
  const recordingTime = recordingState.time
  const recordingError = recordingState.error
  const recordingPreviewUrl = recordingState.previewUrl
  
  const setShowRecordingModal = (value: boolean) => 
    setRecordingState(prev => ({ ...prev, showModal: value }))
  const setRecordingBlockId = (value: string | null) => 
    setRecordingState(prev => ({ ...prev, blockId: value }))
  const setIsRecording = (value: boolean) => 
    setRecordingState(prev => ({ ...prev, isRecording: value }))
  const setMediaRecorder = (value: MediaRecorder | null) => 
    setRecordingState(prev => ({ ...prev, mediaRecorder: value }))
  const setAudioChunks = (value: Blob[] | ((prev: Blob[]) => Blob[])) => 
    setRecordingState(prev => ({ 
      ...prev, 
      audioChunks: typeof value === 'function' ? value(prev.audioChunks) : value 
    }))
  const setRecordingTime = (value: number | ((prev: number) => number)) => 
    setRecordingState(prev => ({ 
      ...prev, 
      time: typeof value === 'function' ? value(prev.time) : value 
    }))
  const setRecordingError = (value: string | null) => 
    setRecordingState(prev => ({ ...prev, error: value }))
  const setRecordingPreviewUrl = (value: string | null) => 
    setRecordingState(prev => ({ ...prev, previewUrl: value }))
  
  // Track blob URLs for cleanup
  const blobUrlsRef = useRef<string[]>([])
  
  // Track if we have any active operations to prevent auto-save and reloads
  const activeOperationsRef = useRef<Set<string>>(new Set())
  
  // Auto-save batching
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingSaveRef = useRef<boolean>(false)
  const SAVE_BATCH_DELAY = 500 // Batch saves within 500ms window
  
  // Memoized component for narration block items to prevent re-renders
  const NarrationBlockItem = memo(({ 
    block, 
    hasAudio, 
    hasCaption, 
    isEditing,
    onEdit,
    onUpdate,
    onCancel,
    onPlayAudio,
    onUploadAudio,
    onRemoveAudio,
    onPreviewCaption,
    onToggleRecording,
    onReplaceAudio,
    onRemoveCaption,
    isRecording,
    recordingId,
    isPlaying
  }: {
    block: any,
    hasAudio: boolean,
    hasCaption: boolean,
    isEditing: boolean,
    onEdit: () => void,
    onUpdate: (text: string) => void,
    onCancel: () => void,
    onPlayAudio: () => void,
    onUploadAudio: (e: React.ChangeEvent<HTMLInputElement>) => void,
    onRemoveAudio: () => void,
    onPreviewCaption: () => void,
    onToggleRecording: () => void,
    onReplaceAudio: () => void,
    onRemoveCaption: () => void,
    isRecording: boolean,
    recordingId: string | null,
    isPlaying: boolean
  }) => {
    // FIX: Use a proper React ref for each textarea instead of querySelector
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    
    return (
    <Card>
      <div className={styles.narrationBlockContainer}>
        <div className={styles.blockNumber}>
          {block.blockNumber}
        </div>
        <div className={styles.blockContent}>
          <div className={styles.pageTitle}>
            {block.pageTitle}
          </div>
          {isEditing ? (
            <div className={styles.editContainer}>
              <textarea
                ref={textareaRef}
                defaultValue={block.text}
                className={styles.editTextarea}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    onCancel()
                  }
                }}
              />
              <div className={styles.editActions}>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
                <Button
                  size="small"
                  variant="primary"
                  onClick={() => {
                    // FIX: Use the specific textarea ref instead of global querySelector
                    if (textareaRef.current) {
                      onUpdate(textareaRef.current.value)
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <div 
              className={styles.narrationText}
              onClick={onEdit}
            >
              {block.text}
            </div>
          )}
          <div className={styles.actionButtons}>
            {/* Audio controls when audio exists */}
            {hasAudio ? (
              <>
                <Button
                  size="small"
                  variant={isPlaying ? "primary" : "secondary"}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onPlayAudio()
                  }}
                >
                  {isPlaying ? (<><Square size={16} /> Stop</>) : (<><Play size={16} /> Play</>)}
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={onReplaceAudio}
                >
                  <Upload size={16} /> Replace Audio
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={onRemoveAudio}
                >
                  Remove Audio
                </Button>
              </>
            ) : (
              <>
                {/* Audio upload/record options when no audio exists */}
                <input
                  type="file"
                  accept="audio/*"
                  className={styles.hiddenInput}
                  id={`audio-upload-${block.blockNumber}`}
                  onChange={onUploadAudio}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <label htmlFor={`audio-upload-${block.blockNumber}`} className={styles.uploadLabel}>
                  <span className={styles.uploadLabelSpan}>
                    <Button
                      size="small"
                      variant="secondary"
                      className={styles.uploadButtonDisabled}
                      style={{ pointerEvents: 'none' }}
                      tabIndex={-1}
                    >
                      <Upload size={16} /> Upload Audio
                    </Button>
                  </span>
                </label>
                
                <Button
                  size="small"
                  variant="secondary"
                  onClick={onToggleRecording}
                >
                  <Mic size={16} /> Record Audio
                </Button>
              </>
            )}
            
            {/* Caption controls */}
            {hasCaption ? (
              <>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={onPreviewCaption}
                >
                  <Eye size={16} /> Preview Caption
                </Button>
                <input
                  type="file"
                  accept=".vtt,.srt,.txt"
                  id={`caption-replace-${block.id}`}
                  className={styles.hiddenInput}
                  onChange={(e) => handleCaptionFileChange(e, block)}
                />
                <label htmlFor={`caption-replace-${block.id}`} className={styles.uploadLabel}>
                  <span className={styles.uploadLabelSpan}>
                    <Button
                      size="small"
                      variant="secondary"
                      className={styles.uploadButtonDisabled}
                      style={{ pointerEvents: 'none' }}
                      tabIndex={-1}
                    >
                      <FileText size={16} /> Replace Caption
                    </Button>
                  </span>
                </label>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={onRemoveCaption}
                >
                  Remove Caption
                </Button>
              </>
            ) : (
              <>
                <input
                  type="file"
                  accept=".vtt,.srt,.txt"
                  id={`caption-upload-${block.id}`}
                  className={styles.hiddenInput}
                  onChange={(e) => handleCaptionFileChange(e, block)}
                />
                <label htmlFor={`caption-upload-${block.id}`} className={styles.uploadLabel}>
                  <span className={styles.uploadLabelSpan}>
                    <Button
                      size="small"
                      variant="secondary"
                      className={styles.uploadButtonDisabled}
                      style={{ pointerEvents: 'none' }}
                      tabIndex={-1}
                    >
                      <FileText size={16} /> Upload Caption
                    </Button>
                  </span>
                </label>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
  }, (prevProps, nextProps) => {
    // Custom comparison function for memo - only re-render when needed
    return (
      prevProps.block.id === nextProps.block.id &&
      prevProps.block.text === nextProps.block.text &&
      prevProps.hasAudio === nextProps.hasAudio &&
      prevProps.hasCaption === nextProps.hasCaption &&
      prevProps.isEditing === nextProps.isEditing &&
      prevProps.isRecording === nextProps.isRecording &&
      prevProps.recordingId === nextProps.recordingId &&
      prevProps.isPlaying === nextProps.isPlaying
    )
  })
  NarrationBlockItem.displayName = 'NarrationBlockItem'
  
  // Cleanup only temporary recording preview URLs on unmount
  // Do NOT cleanup media blob URLs as they're needed by other components
  useEffect(() => {
    return () => {
      // Only cleanup the temporary recording preview URL if it exists
      // Media blob URLs are managed by MediaService/BlobURLManager
      if (recordingPreviewUrl && recordingPreviewUrl.startsWith('blob:')) {
        logger.log('[AudioNarrationWizard] Cleaning up temporary recording preview URL')
        try {
          URL.revokeObjectURL(recordingPreviewUrl)
        } catch (e) {
          logger.warn('[AudioNarrationWizard] Failed to revoke recording preview URL:', e)
        }
      }
      // Clear the refs but don't revoke the URLs - they're still needed
      blobUrlsRef.current = []
    }
  }, [recordingPreviewUrl])
  
  // Helper to track operations
  const startOperation = (operationId: string) => {
    activeOperationsRef.current.add(operationId)
    logger.log(`[AudioNarrationWizard] Started operation: ${operationId}`)
  }
  
  const endOperation = (operationId: string) => {
    activeOperationsRef.current.delete(operationId)
    logger.log(`[AudioNarrationWizard] Ended operation: ${operationId}`)
    
    // If no more operations, trigger a single save
    if (activeOperationsRef.current.size === 0) {
      logger.log('[AudioNarrationWizard] All operations complete, triggering save')
      autoSaveToCourseContent()
    }
  }
  
  const hasActiveOperations = () => activeOperationsRef.current.size > 0

  // Create preview URL when audioChunks change and recording is stopped
  useEffect(() => {
    logger.log('[AudioNarrationWizard] Preview URL effect:', {
      isRecording,
      audioChunksLength: audioChunks.length,
      showRecordingModal
    })
    if (!isRecording && audioChunks.length > 0 && showRecordingModal) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
      // Note: We use a temporary blob URL for live recording preview only
      // This is cleaned up immediately after use and not stored long-term
      // For recording preview, we still need a blob URL since the audio isn't saved yet
      const url = URL.createObjectURL(audioBlob)
      logger.log('[AudioNarrationWizard] Setting temporary preview URL:', url)
      setRecordingPreviewUrl(url)
      // Track for cleanup
      if (!tempBlobUrlsRef.current) {
        tempBlobUrlsRef.current = new Set()
      }
      tempBlobUrlsRef.current.add(url)
    }
  }, [isRecording, audioChunks, showRecordingModal])
  
  // Cleanup on unmount - asset URLs don't need cleanup
  useEffect(() => {
    return () => {
      // Clean up recording preview URL if exists (this is still a blob URL)
      if (recordingPreviewUrl) {
        URL.revokeObjectURL(recordingPreviewUrl)
      }
      // Clean up any temporary blob URLs
      if (tempBlobUrlsRef.current.size > 0) {
        tempBlobUrlsRef.current.forEach(url => {
          URL.revokeObjectURL(url)
        })
        tempBlobUrlsRef.current.clear()
      }
      // Reset saving flag on unmount
      setIsSaving(false)
    }
  }, [])

  // Base load persisted data function
  const loadPersistedDataBase = useCallback(async () => {
    // Check if saving is in progress
    if (isSaving) {
      logger.log('[AudioNarrationWizard] Skipping loadPersistedData - save in progress')
      return
    }
    
    // Check if we have bulk uploaded files that shouldn't be overwritten
    if (hasBulkUploadedRef.current && audioFilesRef.current.length > 0) {
      logger.log('[AudioNarrationWizard] Skipping loadPersistedData - bulk uploaded files present', {
        audioFiles: audioFilesRef.current.length
      })
      return
    }
    
    // Check if enough time has passed since last load
    const now = Date.now()
    const timeSinceLastLoad = now - lastLoadTime.current
    
    // Skip if already loading or loaded too recently
    if (isLoadingPersistedData || timeSinceLastLoad < MIN_RELOAD_INTERVAL) {
      logger.log('[AudioNarrationWizard] Skipping loadPersistedData - already loading or loaded recently', {
        isLoading: isLoadingPersistedData,
        timeSinceLastLoad,
        minInterval: MIN_RELOAD_INTERVAL
      })
      return
    }
    
    // Skip loading if we have any active operations
    if (hasActiveOperations()) {
      logger.log('[AudioNarrationWizard] Skipping loadPersistedData - operations in progress:', 
        Array.from(activeOperationsRef.current))
      return
    }
    
    setIsLoadingPersistedData(true)
    lastLoadTime.current = now

    try {
      logger.log('[AudioNarrationWizard] Loading persisted data...')
      
      // First check if course content already has audioId/captionId fields
      const audioIdsInContent: (string | null)[] = []
      const captionIdsInContent: (string | null)[] = []
      
      // Check welcome page - push null if no media to maintain index alignment
      if ('welcomePage' in courseContent) {
        const welcomeAudio = courseContent.welcomePage.media?.find(m => m.type === 'audio')
        audioIdsInContent.push(welcomeAudio?.id || null)
        // Look for captions in media array too
        const welcomeCaption = courseContent.welcomePage.media?.find((m: any) => m.type === 'caption')
        captionIdsInContent.push(welcomeCaption?.id || null)
      }
      
      // Check objectives page - push null if no media to maintain index alignment
      if ('learningObjectivesPage' in courseContent) {
        const objAudio = courseContent.learningObjectivesPage.media?.find(m => m.type === 'audio')
        audioIdsInContent.push(objAudio?.id || null)
        // Look for captions in media array too
        const objCaption = courseContent.learningObjectivesPage.media?.find((m: any) => m.type === 'caption')
        captionIdsInContent.push(objCaption?.id || null)
      }
      
      // Check topics - push null if no media to maintain index alignment
      if ('topics' in courseContent && Array.isArray(courseContent.topics)) {
        courseContent.topics.forEach((topic: any) => {
          const topicAudio = topic.media?.find((m: any) => m.type === 'audio')
          audioIdsInContent.push(topicAudio?.id || null)
          // Look for captions in media array too
          const topicCaption = topic.media?.find((m: any) => m.type === 'caption')
          captionIdsInContent.push(topicCaption?.id || null)
        })
      }
      
      logger.log('[AudioNarrationWizard] Found in course content:', audioIdsInContent.length, 'audio IDs,', captionIdsInContent.length, 'caption IDs')
      
      // Check if we have any non-null audio IDs in content
      const hasValidAudioIds = audioIdsInContent.some(id => id !== null)
      const hasValidCaptionIds = captionIdsInContent.some(id => id !== null)
      const totalToLoad = audioIdsInContent.filter(id => id !== null).length + 
                          captionIdsInContent.filter(id => id !== null).length
      
      // Set loading progress
      setLoadingProgress({ current: 0, total: totalToLoad })
      
      // If we have audio IDs in content, try to load from MediaRegistry
      if (hasValidAudioIds) {
        logger.log('[AudioNarrationWizard] Starting to load audio from course content...')
        const audioLoadStart = Date.now()
        
        // Use Promise.all with map to avoid race conditions
        const audioLoadPromises = audioIdsInContent.map(async (audioId, index) => {
          const block = narrationBlocks[index]
          
          if (!block || !audioId) {
            if (block && !audioId) {
              logger.log(`[AudioNarrationWizard] No audio ID for block ${block.blockNumber} (${block.pageTitle})`)
            }
            return null
          }
          
          const cacheKey = `audio_${audioId}`
          
          // Check cache first - use asset URLs directly
          if (mediaCache.current.has(cacheKey)) {
            logger.log(`[AudioNarrationWizard] Using cached audio for ${audioId}`)
            const cachedData = mediaCache.current.get(cacheKey)
            
            // If we have cached media data, use it
            if (cachedData?.mediaData || cachedData?.url) {
              const playableUrl = cachedData.url
              
              logger.log(`[AudioNarrationWizard] Cached URL for ${audioId}:`, playableUrl)
              
              // Track blob URLs for cleanup (including those from MediaService)
              if (playableUrl && playableUrl.startsWith('blob:')) {
                blobUrlsRef.current.push(playableUrl)
                logger.log(`[AudioNarrationWizard] Tracking blob URL for cleanup: ${playableUrl}`)
              }
              
              const audioFile: AudioFile = {
                blockNumber: block.blockNumber,
                file: cachedData.file || new File([], cachedData.fileName || `${block.blockNumber}-Block.mp3`),
                url: playableUrl || undefined,
                mediaId: audioId
              }
              
              // Update progress
              setLoadingProgress(prev => ({ ...prev, current: prev.current + 1 }))
              
              return audioFile
            }
          }
          
          try {
            // PERFORMANCE: Check if audio is already cached in MediaService first
            if (hasAudioCached && hasAudioCached(audioId)) {
              logger.log(`[AudioNarrationWizard] Audio already cached in MediaService for ${audioId}`)
              const cachedAudio = getCachedAudio ? getCachedAudio(audioId) : null
              
              if (cachedAudio) {
                const fileName = cachedAudio.metadata?.original_name || cachedAudio.metadata?.originalName || `${block.blockNumber}-Block.mp3`
                
                // Create blob URL from cached data
                let playableUrl: string | undefined
                try {
                  // Create a new Uint8Array with a proper ArrayBuffer to ensure Blob compatibility
                  // This avoids TypeScript's SharedArrayBuffer vs ArrayBuffer type issues
                  const uint8Array = new Uint8Array(cachedAudio.data.length)
                  uint8Array.set(cachedAudio.data)
                  
                  const blob = new Blob([uint8Array], { 
                    type: cachedAudio.metadata?.mimeType || cachedAudio.metadata?.mime_type || 'audio/mpeg' 
                  })
                  playableUrl = URL.createObjectURL(blob)
                  
                  // Track blob URL for cleanup
                  if (playableUrl) {
                    blobUrlsRef.current.push(playableUrl)
                    logger.log(`[AudioNarrationWizard] Created blob URL from cached audio: ${playableUrl}`)
                  }
                } catch (e) {
                  logger.error(`[AudioNarrationWizard] Failed to create blob URL from cached audio:`, e)
                }
                
                const file = new File([], fileName, { type: cachedAudio.metadata?.mimeType || 'audio/mpeg' })
                
                const audioFile: AudioFile = {
                  blockNumber: block.blockNumber,
                  file: file,
                  url: playableUrl,
                  mediaId: audioId
                }
                
                // Cache locally for component use
                mediaCache.current.set(cacheKey, {
                  mediaData: cachedAudio,
                  fileName: fileName,
                  file: file,
                  url: playableUrl
                })
                
                logger.log(`[AudioNarrationWizard] Used cached audio from MediaService: ${audioId} for block ${block.blockNumber}`)
                
                // Update progress
                setLoadingProgress(prev => ({ ...prev, current: prev.current + 1 }))
                
                return audioFile
              }
            }
            
            // Not cached - load from disk (will be cached by MediaService)
            logger.log(`[AudioNarrationWizard] Audio not cached, loading from disk: ${audioId}`)
            
            // Get media from UnifiedMedia - use asset URL directly
            const mediaData = await getMedia(audioId)
            
            if (mediaData) {
              const fileName = mediaData.metadata?.original_name || mediaData.metadata?.originalName || `${block.blockNumber}-Block.mp3`
              
              // Normalize the URL to fix double-encoding issues
              const playableUrl = mediaData.url
              
              logger.log(`[AudioNarrationWizard] Got media URL for ${audioId}:`, playableUrl)
              
              // Track blob URLs for cleanup (including those from MediaService)
              if (playableUrl && playableUrl.startsWith('blob:')) {
                // Track existing blob URLs for cleanup
                blobUrlsRef.current.push(playableUrl)
                logger.log(`[AudioNarrationWizard] Tracking blob URL for cleanup: ${playableUrl}`)
              }
              
              // Create a placeholder file for UI consistency (no actual data needed)
              const file = new File([], fileName, { type: mediaData.metadata?.mimeType || 'audio/mpeg' })
              
              const audioFile: AudioFile = {
                blockNumber: block.blockNumber,
                file: file,
                url: playableUrl || undefined,
                mediaId: audioId
              }
              
              // Cache the media data with playable URL
              mediaCache.current.set(cacheKey, {
                mediaData: mediaData,
                fileName: fileName,
                file: file,
                url: playableUrl || undefined
              })
              
              logger.log(`[AudioNarrationWizard] Loaded audio from MediaRegistry: ${audioId} for block ${block.blockNumber}`)
              
              // Update progress after successful load
              setLoadingProgress(prev => ({ ...prev, current: prev.current + 1 }))
              
              return audioFile
            }
          } catch (error) {
            logger.error(`[AudioNarrationWizard] Failed to load audio ${audioId}:`, error)
            // Clear cache on error
            mediaCache.current.delete(cacheKey)
          }
          
          return null
        })
        
        // Wait for all audio to load in parallel and filter out nulls
        const audioResults = await Promise.all(audioLoadPromises)
        const newAudioFiles = audioResults.filter((file): file is AudioFile => file !== null && file !== undefined)
        
        logger.log('[AudioNarrationWizard] Audio loading completed:', {
          duration: Date.now() - audioLoadStart,
          expectedCount: audioIdsInContent.filter(id => id !== null).length,
          loadedCount: newAudioFiles.length,
          failed: audioIdsInContent.filter(id => id !== null).length - newAudioFiles.length
        })
        
        // Use Promise.all with map for captions too
        const captionLoadPromises = captionIdsInContent.map(async (captionId, index) => {
          const block = narrationBlocks[index]
          
          if (!block || !captionId) {
            if (block && !captionId) {
              logger.log(`[AudioNarrationWizard] No caption ID for block ${block.blockNumber} (${block.pageTitle})`)
            }
            return null
          }
          
          const cacheKey = `caption_${captionId}`
          
          // Check cache first
          if (mediaCache.current.has(cacheKey)) {
            logger.log(`[AudioNarrationWizard] Using cached caption for ${captionId}`)
            // Update progress for cached caption
            setLoadingProgress(prev => ({ ...prev, current: prev.current + 1 }))
            return mediaCache.current.get(cacheKey)
          }
          
          try {
            // Get caption content from MediaService
            const mediaData = await getMedia(captionId)
            
            if (mediaData) {
              // Track blob URLs for cleanup (captions might also use blob URLs)
              if (mediaData.url && mediaData.url.startsWith('blob:')) {
                blobUrlsRef.current.push(mediaData.url)
                logger.debug('[AudioNarrationWizard] Tracking caption blob URL for cleanup:', mediaData.url)
              }
              
              // Handle case where data might be undefined or content might be in metadata
              let content = ''
              if (mediaData.data) {
                content = new TextDecoder().decode(mediaData.data)
              } else if (mediaData.metadata?.content) {
                // Caption content might be stored in metadata
                content = mediaData.metadata.content
              }
              
              // Also check if content is directly in the media array in course content
              if (!content) {
                // Check the corresponding page in courseContent for embedded caption content
                if (index === 0 && 'welcomePage' in courseContent) {
                  const welcomeCaption = courseContent.welcomePage.media?.find((m: any) => m.id === captionId && m.type === 'caption') as any
                  if (welcomeCaption?.content) {
                    content = welcomeCaption.content
                  }
                } else if (index === 1 && 'learningObjectivesPage' in courseContent) {
                  const objCaption = courseContent.learningObjectivesPage.media?.find((m: any) => m.id === captionId && m.type === 'caption') as any
                  if (objCaption?.content) {
                    content = objCaption.content
                  }
                } else if ('topics' in courseContent && courseContent.topics[index - 2]) {
                  const topicCaption = courseContent.topics[index - 2].media?.find((m: any) => m.id === captionId && m.type === 'caption') as any
                  if (topicCaption?.content) {
                    content = topicCaption.content
                  }
                }
              }
              
              if (content) {
                const captionFile = {
                  blockNumber: block.blockNumber,
                  content: content,
                  mediaId: captionId
                }
                
                // Cache the data
                mediaCache.current.set(cacheKey, captionFile)
                logger.log(`[AudioNarrationWizard] Loaded caption from MediaRegistry: ${captionId} for block ${block.blockNumber}`)
                
                // Update progress after successful caption load
                setLoadingProgress(prev => ({ ...prev, current: prev.current + 1 }))
                
                return captionFile
              } else {
                logger.warn(`[AudioNarrationWizard] No caption content found for ${captionId}`)
              }
            }
          } catch (error) {
            logger.error(`[AudioNarrationWizard] Failed to load caption ${captionId}:`, error)
            // Clear cache on error
            mediaCache.current.delete(cacheKey)
          }
          
          return null
        })
        
        // Wait for all captions to load in parallel and filter out nulls
        const captionResults = await Promise.all(captionLoadPromises)
        const newCaptionFiles = captionResults.filter((file): file is CaptionFile => file !== null)
        
        // Only update if we successfully loaded some data
        // Don't replace existing files with incomplete data during save cycles
        logger.log('[AudioNarrationWizard] Comparing loaded vs existing files:', {
          newAudioCount: newAudioFiles.length,
          existingAudioCount: audioFiles.length,
          newCaptionCount: newCaptionFiles.length,
          existingCaptionCount: captionFiles.length
        })
        
        // Merge loaded audio files with existing ones (use ref for latest state)
        // Only add files that don't already exist (check by blockNumber)
        setAudioFiles(prev => {
          const existingBlocks = new Set(prev.map(f => f.blockNumber))
          const newFilesToAdd = newAudioFiles.filter(f => !existingBlocks.has(f.blockNumber))
          if (newFilesToAdd.length > 0) {
            logger.log('[AudioNarrationWizard] Adding loaded audio files:', newFilesToAdd.length)
            return [...prev, ...newFilesToAdd]
          }
          // If we have no existing files, use the loaded ones
          if (prev.length === 0 && newAudioFiles.length > 0) {
            logger.log('[AudioNarrationWizard] Setting initial audio files from loaded data')
            return newAudioFiles
          }
          return prev
        })
        
        if (newAudioFiles.length < audioFilesRef.current.length) {
          logger.warn('[AudioNarrationWizard] Loaded fewer files than existing', {
            loaded: newAudioFiles.length,
            existing: audioFiles.length
          })
        }
        
        // Merge loaded caption files with existing ones
        setCaptionFiles(prev => {
          const existingBlocks = new Set(prev.map(f => f.blockNumber))
          const newFilesToAdd = newCaptionFiles.filter(f => !existingBlocks.has(f.blockNumber))
          if (newFilesToAdd.length > 0) {
            logger.log('[AudioNarrationWizard] Adding loaded caption files:', newFilesToAdd.length)
            return [...prev, ...newFilesToAdd]
          }
          // If we have no existing files, use the loaded ones
          if (prev.length === 0 && newCaptionFiles.length > 0) {
            logger.log('[AudioNarrationWizard] Setting initial caption files from loaded data')
            return newCaptionFiles
          }
          return prev
        })
        
        if (newCaptionFiles.length < captionFilesRef.current.length) {
          logger.warn('[AudioNarrationWizard] Loaded fewer caption files than existing', {
            loaded: newCaptionFiles.length,
            existing: captionFiles.length
          })
        }
        
        logger.log('[AudioNarrationWizard] Loaded from course content:', newAudioFiles.length, 'audio files,', newCaptionFiles.length, 'caption files')
        
        // Don't return early - continue to check getAllMedia as fallback
        // This ensures we catch any media that wasn't in the course content arrays
      } else {
        logger.log('[AudioNarrationWizard] No valid audio IDs in course content, will check getAllMedia')
      }
      
      // Always check getAllMedia as a fallback to catch media not in course content  
      let allMediaItems: any[] = []
      
      try {
        const mediaResult = getAllMedia ? getAllMedia() : []
        
        // Ensure allMediaItems is an array
        if (Array.isArray(mediaResult)) {
          allMediaItems = mediaResult
          logger.log('[AudioNarrationWizard] Total media items:', allMediaItems.length)
          allMediaItems.forEach(item => {
            logger.log('[AudioNarrationWizard] Media item:', item.id, item.type, item.pageId)
          })
        } else {
          logger.warn('[AudioNarrationWizard] getAllMedia did not return an array:', mediaResult)
          logger.log('[AudioNarrationWizard] Using empty array for media items')
        }
      } catch (err) {
        logger.error('[AudioNarrationWizard] Error calling getAllMedia:', err)
        logger.log('[AudioNarrationWizard] Using empty array for media items')
      }
      
      let allAudioItems = allMediaItems.filter(item => item && item.type === 'audio')
      let allCaptionItems = allMediaItems.filter(item => item && item.type === 'caption')
      
      logger.log('[AudioNarrationWizard] Found media items:', allAudioItems.length, 'audio,', allCaptionItems.length, 'caption')
      
      // Load audio files from media items
      const loadedAudioFiles: AudioFile[] = []
      for (const item of allAudioItems) {
        // Find the corresponding narration block
        const normalizedPageId = normalizePageId(item.pageId)
        const block = narrationBlocks.find(b => b.pageId === normalizedPageId)
        if (block) {
          // Use createBlobUrl for proper blob URL management
          let url: string | undefined
          try {
            const blobUrl = await createBlobUrl(item.id)
            url = blobUrl || undefined
            if (url && !blobUrlsRef.current) {
              blobUrlsRef.current = []
            }
            if (url) {
              blobUrlsRef.current.push(url)
            }
          } catch (e) {
            logger.error(`[AudioNarrationWizard] Failed to create blob URL for ${item.id}:`, e)
            // Don't fallback - if blob URL creation fails, there's a real problem
            url = undefined
          }
          
          if (url) {
            // Create a placeholder file for UI consistency  
            const fileName = item.metadata?.fileName || item.fileName || 'audio.mp3'
            const file = new File([], fileName, { type: item.metadata?.mimeType || 'audio/mpeg' })
            
            loadedAudioFiles.push({
              blockNumber: block.blockNumber,
              file,
              url,
              mediaId: item.id
            })
            logger.log(`[AudioNarrationWizard] Loaded audio from getAllMedia: ${item.id} for block ${block.blockNumber} with URL: ${url}`)
          }
        } else {
          logger.warn('[AudioNarrationWizard] No narration block found for media item:', item.id, 'with pageId:', item.pageId)
        }
      }
      
      // Merge with existing audio files instead of replacing
      if (loadedAudioFiles.length > 0) {
        setAudioFiles(prev => {
          const existingBlocks = new Set(prev.map(f => f.blockNumber))
          const newFilesToAdd = loadedAudioFiles.filter(f => !existingBlocks.has(f.blockNumber))
          if (newFilesToAdd.length > 0) {
            logger.log('[AudioNarrationWizard] Adding audio files from getAllMedia:', newFilesToAdd.length)
            return [...prev, ...newFilesToAdd]
          }
          // If we have no existing files, use the loaded ones
          if (prev.length === 0) {
            logger.log('[AudioNarrationWizard] Setting initial audio files from getAllMedia')
            return loadedAudioFiles
          }
          return prev
        })
      }
      
      // Load caption files
      const loadedCaptionFiles: CaptionFile[] = []
      for (const item of allCaptionItems) {
        // Find the corresponding narration block
        const normalizedPageId = normalizePageId(item.pageId)
        const block = narrationBlocks.find(b => b.pageId === normalizedPageId)
        if (block) {
          const mediaData = await getMedia(item.id)
          if (mediaData) {
            // Handle case where data might be undefined or in metadata
            let content = ''
            if (mediaData.data) {
              content = new TextDecoder().decode(mediaData.data)
            } else if (mediaData.metadata?.content) {
              // Caption content might be stored in metadata
              content = mediaData.metadata.content
            }
            
            if (content) {
              loadedCaptionFiles.push({
                blockNumber: block.blockNumber,
                content,
                mediaId: item.id
              })
              logger.log(`[AudioNarrationWizard] Loaded caption from media: ${item.id} for block ${block.blockNumber}`)
            } else {
              logger.warn(`[AudioNarrationWizard] No caption content found for ${item.id}`)
            }
          }
        }
      }
      
      // Merge with existing caption files instead of replacing
      if (loadedCaptionFiles.length > 0) {
        setCaptionFiles(prev => {
          const existingBlocks = new Set(prev.map(f => f.blockNumber))
          const newFilesToAdd = loadedCaptionFiles.filter(f => !existingBlocks.has(f.blockNumber))
          if (newFilesToAdd.length > 0) {
            logger.log('[AudioNarrationWizard] Adding caption files from getAllMedia:', newFilesToAdd.length)
            return [...prev, ...newFilesToAdd]
          }
          // If we have no existing files, use the loaded ones
          if (prev.length === 0) {
            logger.log('[AudioNarrationWizard] Setting initial caption files from getAllMedia')
            return loadedCaptionFiles
          }
          return prev
        })
      }
      
      logger.log('[AudioNarrationWizard] Loaded from MediaRegistry:', loadedAudioFiles.length, 'audio files,', loadedCaptionFiles.length, 'caption files')
    } catch (error) {
      logger.error('[AudioNarrationWizard] Error loading existing media:', error)
      setError('Failed to load saved data. Please check your browser storage settings.')
      // Reset last load time on error to allow retry
      lastLoadTime.current = 0
    } finally {
      setIsLoadingPersistedData(false)
    }
  }, [getMedia, getAllMedia, narrationBlocks, courseContent, isSaving])
  
  // Create debounced version of loadPersistedData
  const loadPersistedData = useMemo(
    () => debounce(loadPersistedDataBase, 500),
    [loadPersistedDataBase]
  )

  // Use useStepData to load data when the audio step (step 4) becomes active
  useStepData(loadPersistedData, { 
    step: 4,
    dependencies: []
  })
  
  // Also load persisted data when course content is available
  // This handles cases where the component mounts with existing content
  useEffect(() => {
    if (courseContent && narrationBlocks.length > 0 && !isLoadingPersistedData) {
      // Check if we have media in the course content that needs to be loaded
      // Check for new format
      let hasAudioInContent = false
      let hasCaptionInContent = false
      
      if ('welcomePage' in courseContent) {
        hasAudioInContent = 
          courseContent.welcomePage?.media?.some((m: Media) => m.type === 'audio') ||
          courseContent.learningObjectivesPage?.media?.some((m: Media) => m.type === 'audio') ||
          courseContent.topics?.some(t => t.media?.some((m: Media) => m.type === 'audio')) || false
        
        hasCaptionInContent =
          courseContent.welcomePage?.media?.some((m: any) => m.type === 'caption') ||
          courseContent.learningObjectivesPage?.media?.some((m: any) => m.type === 'caption') ||
          courseContent.topics?.some(t => t.media?.some((m: any) => m.type === 'caption')) || false
      }
      
      // If we have media in content but no files loaded yet, trigger load
      if ((hasAudioInContent || hasCaptionInContent) && audioFiles.length === 0 && captionFiles.length === 0) {
        logger.log('[AudioNarrationWizard] Detected media in course content, loading persisted data')
        loadPersistedData()
      }
    }
  }, [courseContent, narrationBlocks.length, isLoadingPersistedData, audioFiles.length, captionFiles.length, loadPersistedData])

  // Watch for changes in audioFiles map and update upload state
  // Using array conversion for proper dependency tracking in production
  useEffect(() => {
    const hasAudio = audioFiles.length > 0
    logger.log('[AudioNarrationWizard] Audio effect triggered:', { 
      size: audioFiles.length, 
      hasAudio, 
      currentState: audioUploaded
    })
    
    // Debug logging for production issues
    if (debugLogger.isDebugMode()) {
      logger.log('[AudioNarrationWizard] Debug: Audio state effect triggered', {
        arraySize: audioFiles.length,
        hasAudio,
        previousState: audioUploaded,
        willUpdate: hasAudio !== audioUploaded,
        blockNumbers: audioFiles.map(f => f.blockNumber)
      })
    }
    
    // Only update audioUploaded if we're not in the middle of ANY bulk operation
    // This prevents the UI from flickering when uploads are happening
    if (!isBulkOperationActive && !isUploading) {
      setAudioUploaded(hasAudio)
    }
  }, [audioFiles, isBulkOperationActive, isUploading])

  // Watch for changes in captionFiles array and update upload state
  useEffect(() => {
    const hasCaptions = captionFiles.length > 0
    logger.log('[AudioNarrationWizard] Caption effect triggered:', { 
      size: captionFiles.length, 
      hasCaptions, 
      currentState: captionsUploaded
    })
    
    // Debug logging for production issues
    if (debugLogger.isDebugMode()) {
      logger.log('[AudioNarrationWizard] Debug: Caption state effect triggered', {
        arraySize: captionFiles.length,
        hasCaptions,
        previousState: captionsUploaded,
        willUpdate: hasCaptions !== captionsUploaded,
        blockNumbers: captionFiles.map(f => f.blockNumber)
      })
    }
    
    setCaptionsUploaded(hasCaptions)
  }, [captionFiles])

  // Track last save time to prevent overlapping saves (isSaving already declared above)
  const lastSaveTime = useRef(0)
  const SAVE_RATE_LIMIT_MS = 2000 // Minimum 2 seconds between saves

  // Auto-save function to update course content with audio IDs
  // Using useRef to avoid recreating this function and causing infinite loops
  const autoSaveToCourseContentRef = useRef<(() => Promise<void>) | null>(null)
  
  autoSaveToCourseContentRef.current = async () => {
    if (!onSave) return
    
    // Skip if already saving
    if (isSaving) {
      logger.log('[AudioNarrationWizard] Skipping auto-save - already saving')
      return
    }
    
    // Skip if any operations are in progress to prevent excessive saves
    if (hasActiveOperations()) {
      logger.log('[AudioNarrationWizard] Skipping auto-save during active operations')
      return
    }
    
    // Rate limiting - don't save too frequently
    const now = Date.now()
    const timeSinceLastSave = now - lastSaveTime.current
    if (timeSinceLastSave < SAVE_RATE_LIMIT_MS) {
      // Silently skip - too noisy
      // logger.log('[AudioNarrationWizard] Skipping auto-save - rate limited', {
      //   timeSinceLastSave,
      //   rateLimit: SAVE_RATE_LIMIT_MS
      // })
      return
    }
    
    // Create enhanced content with MediaRegistry IDs
    // Only skip if we have nothing at all to save
    // We now save even if only narration text has changed
    if (audioFiles.length === 0 && captionFiles.length === 0 && narrationBlocks.length === 0) {
      return
    }
    
    setIsSaving(true)
    lastSaveTime.current = now
    
    const contentWithAudio = JSON.parse(JSON.stringify(courseContent))
    
    // Sync edited narration text back to course content during autosave
    // Process welcome page
    if ('welcomePage' in contentWithAudio) {
      const welcomeBlock = narrationBlocks.find(b => b.pageId === 'welcome')
      if (welcomeBlock) {
        // Update narration text
        contentWithAudio.welcomePage.narration = welcomeBlock.text
        
        const audioFile = audioFiles.find(f => f.blockNumber === welcomeBlock.blockNumber)
        const captionFile = captionFiles.find(f => f.blockNumber === welcomeBlock.blockNumber)
        
        // CRITICAL FIX: Sync caption text to course content during autosave
        if (captionFile) {
          contentWithAudio.welcomePage.caption = captionFile.content
        }
        
        if (audioFile?.mediaId) {
          // ONLY add to media array for persistence (no audioId field)
          if (!contentWithAudio.welcomePage.media) {
            contentWithAudio.welcomePage.media = []
          }
          // Remove any existing audio from media array
          contentWithAudio.welcomePage.media = contentWithAudio.welcomePage.media.filter((m: any) => m.type !== 'audio')
          // Add the new audio (without URL to prevent invalid blob URLs)
          contentWithAudio.welcomePage.media.push({
            id: audioFile.mediaId,
            type: 'audio',
            storageId: audioFile.mediaId,
            title: '' // Required by Rust SCORM generator
          })
          logger.log('[AudioNarrationWizard] Added welcome audio to media array:', audioFile.mediaId)
        }
        if (captionFile?.mediaId) {
          // ONLY add captions to media array (no captionId field)
          if (!contentWithAudio.welcomePage.media) {
            contentWithAudio.welcomePage.media = []
          }
          // Remove any existing caption from media array
          contentWithAudio.welcomePage.media = contentWithAudio.welcomePage.media.filter((m: any) => m.type !== 'caption')
          // Add the new caption
          contentWithAudio.welcomePage.media.push({
            id: captionFile.mediaId,
            type: 'caption',
            content: captionFile.content,
            storageId: captionFile.mediaId,
            title: '' // Required by Rust SCORM generator
          })
        }
      }
    }
    
    // Process objectives page
    if ('learningObjectivesPage' in contentWithAudio) {
      const objectivesBlock = narrationBlocks.find(b => 
        b.pageId === 'objectives' || 
        b.pageId === 'learningObjectives' || 
        b.pageId === 'learning-objectives' ||
        b.pageTitle?.toLowerCase().includes('objective')
      )
      
      if (objectivesBlock) {
        // Update narration text
        contentWithAudio.learningObjectivesPage.narration = objectivesBlock.text
        
        const audioFile = audioFiles.find(f => f.blockNumber === objectivesBlock.blockNumber)
        const captionFile = captionFiles.find(f => f.blockNumber === objectivesBlock.blockNumber)
        
        // CRITICAL FIX: Sync caption text to course content during autosave
        if (captionFile) {
          contentWithAudio.learningObjectivesPage.caption = captionFile.content
        }
        
        if (audioFile?.mediaId) {
          logger.log('[AudioNarrationWizard] Adding objectives audio to media array:', audioFile.mediaId)
          // ONLY add to media array for persistence (no audioId field)
          if (!contentWithAudio.learningObjectivesPage.media) {
            contentWithAudio.learningObjectivesPage.media = []
          }
          // Remove any existing audio from media array
          contentWithAudio.learningObjectivesPage.media = contentWithAudio.learningObjectivesPage.media.filter((m: any) => m.type !== 'audio')
          // Add the new audio (without URL to prevent invalid blob URLs)
          contentWithAudio.learningObjectivesPage.media.push({
            id: audioFile.mediaId,
            type: 'audio',
            storageId: audioFile.mediaId,
            title: '' // Required by Rust SCORM generator
          })
        }
        if (captionFile?.mediaId) {
          // ONLY add captions to media array (no captionId field)
          if (!contentWithAudio.learningObjectivesPage.media) {
            contentWithAudio.learningObjectivesPage.media = []
          }
          // Remove any existing caption from media array
          contentWithAudio.learningObjectivesPage.media = contentWithAudio.learningObjectivesPage.media.filter((m: any) => m.type !== 'caption')
          // Add the new caption
          contentWithAudio.learningObjectivesPage.media.push({
            id: captionFile.mediaId,
            type: 'caption',
            content: captionFile.content,
            storageId: captionFile.mediaId,
            title: '' // Required by Rust SCORM generator
          })
        }
      }
    }
    
    // Process topics
    contentWithAudio.topics.forEach((topic: any) => {
      const topicBlock = narrationBlocks.find(b => b.pageId === topic.id)
      if (topicBlock) {
        // Update narration text
        topic.narration = topicBlock.text
        
        const audioFile = audioFiles.find(f => f.blockNumber === topicBlock.blockNumber)
        const captionFile = captionFiles.find(f => f.blockNumber === topicBlock.blockNumber)
        
        // CRITICAL FIX: Sync caption text to course content during autosave
        if (captionFile) {
          topic.caption = captionFile.content
        }
        
        if (audioFile?.mediaId) {
          // ONLY add to media array for persistence (no audioId field)
          if (!topic.media) {
            topic.media = []
          }
          // Remove any existing audio from media array
          topic.media = topic.media.filter((m: any) => m.type !== 'audio')
          // Add the new audio
          topic.media.push({
            id: audioFile.mediaId,
            type: 'audio',
            storageId: audioFile.mediaId,
            title: '' // Required by Rust SCORM generator
          })
        }
        if (captionFile?.mediaId) {
          // ONLY add captions to media array (no captionId field)
          if (!topic.media) {
            topic.media = []
          }
          // Remove any existing caption from media array
          topic.media = topic.media.filter((m: any) => m.type !== 'caption')
          // Add the new caption
          topic.media.push({
            id: captionFile.mediaId,
            type: 'caption',
            content: captionFile.content,
            storageId: captionFile.mediaId,
            title: '' // Required by Rust SCORM generator
          })
        }
      }
    })
    
    logger.log('[AudioNarrationWizard] Auto-saving to course content')
    logger.log('[AudioNarrationWizard] Welcome media:', contentWithAudio.welcomePage?.media)
    logger.log('[AudioNarrationWizard] Objectives media:', contentWithAudio.learningObjectivesPage?.media)
    // Store in context and trigger save callback
    // Wrap save operations in try-finally to ensure isSaving is reset
    try {
      if (storage && storage.currentProjectId) {
        storage.saveContent('audioNarration', contentWithAudio)
        
        // Update metadata flag to indicate we have audio narration
        const metadata = await storage.getCourseMetadata() || {}
        await storage.saveCourseMetadata({
          ...metadata,
          hasAudioNarration: true
        })
      }
      if (onSave) {
        // Pass the updated content to parent so it updates its state
        onSave(contentWithAudio, true) // Pass silent=true to avoid double save
        
        // Reset bulk upload flag after successful save
        // The data is now persisted to the parent
        hasBulkUploadedRef.current = false
      }
    } finally {
      // Always reset isSaving flag after a short delay
      setTimeout(() => setIsSaving(false), 100)
    }
  }
  
  // Create stable callback that doesn't change
  const autoSaveToCourseContent = useCallback(() => {
    // Mark that we need to save
    pendingSaveRef.current = true
    
    // Clear existing timer if any
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    
    // Set new timer to batch saves
    saveTimerRef.current = setTimeout(() => {
      if (pendingSaveRef.current && autoSaveToCourseContentRef.current) {
        logger.debug('[AudioNarrationWizard] Executing batched save')
        autoSaveToCourseContentRef.current()
        pendingSaveRef.current = false
      }
    }, SAVE_BATCH_DELAY)
  }, [])

  // Auto-save whenever audio, caption files, or narration text changes
  useEffect(() => {
    // Skip if already saving
    if (isSaving) {
      return
    }
    
    // Skip auto-save completely if any operations are in progress
    if (hasActiveOperations()) {
      logger.log('[AudioNarrationWizard] Skipping auto-save - operations in progress')
      return
    }
    
    // Don't auto-save if we don't have any content to save
    // Note: We now save even if just narration text has changed
    if (audioFiles.length === 0 && captionFiles.length === 0 && narrationBlocks.length === 0) {
      return
    }
    
    // Debounce the save to avoid rapid successive saves
    const saveTimer = setTimeout(() => {
      logger.log('[AudioNarrationWizard] Auto-saving after changes')
      autoSaveToCourseContent()
    }, 500)
    
    return () => clearTimeout(saveTimer)
  }, [audioFiles.length, captionFiles.length, narrationBlocks]) // Include narrationBlocks to trigger on text edits

  const handleNext = async () => {
    // Save one more time before navigating to ensure all media is in media arrays
    autoSaveToCourseContent()
    
    // Create enhanced content for navigation (media is already in media arrays)
    const contentWithAudio = JSON.parse(JSON.stringify(courseContent))
    
    // Sync edited narration text back to course content
    // Update welcome page narration and caption
    if (contentWithAudio.welcomePage) {
      const welcomeBlock = narrationBlocks.find(b => b.pageId === 'welcome' || b.pageId === contentWithAudio.welcomePage?.id)
      if (welcomeBlock) {
        contentWithAudio.welcomePage.narration = welcomeBlock.text
        
        // CRITICAL FIX: Sync caption text to course content
        const welcomeCaption = captionFiles.find(f => f.blockNumber === welcomeBlock.blockNumber)
        if (welcomeCaption) {
          contentWithAudio.welcomePage.caption = welcomeCaption.content
        }
      }
    }
    
    // Update learning objectives page narration and caption
    if (contentWithAudio.learningObjectivesPage) {
      const objectivesBlock = narrationBlocks.find(b => b.pageId === 'objectives' || b.pageId === contentWithAudio.learningObjectivesPage?.id)
      if (objectivesBlock) {
        contentWithAudio.learningObjectivesPage.narration = objectivesBlock.text
        
        // CRITICAL FIX: Sync caption text to course content
        const objectivesCaption = captionFiles.find(f => f.blockNumber === objectivesBlock.blockNumber)
        if (objectivesCaption) {
          contentWithAudio.learningObjectivesPage.caption = objectivesCaption.content
        }
      }
    }
    
    // Process topics - update both narration and media
    contentWithAudio.topics.forEach((topic: any) => {
      const topicBlock = narrationBlocks.find(b => b.pageId === topic.id)
      if (topicBlock) {
        // Update narration text
        topic.narration = topicBlock.text
        
        const audioFile = audioFiles.find(f => f.blockNumber === topicBlock.blockNumber)
        const captionFile = captionFiles.find(f => f.blockNumber === topicBlock.blockNumber)
        
        // CRITICAL FIX: Sync caption text to course content
        if (captionFile) {
          topic.caption = captionFile.content
        }
        
        if (audioFile?.mediaId) {
          // ONLY add to media array for persistence (no audioId field)
          if (!topic.media) {
            topic.media = []
          }
          // Remove any existing audio from media array
          topic.media = topic.media.filter((m: any) => m.type !== 'audio')
          // Add the new audio
          topic.media.push({
            id: audioFile.mediaId,
            type: 'audio',
            storageId: audioFile.mediaId,
            title: '' // Required by Rust SCORM generator
          })
        }
        if (captionFile?.mediaId) {
          // ONLY add captions to media array (no captionId field)
          if (!topic.media) {
            topic.media = []
          }
          // Remove any existing caption from media array
          topic.media = topic.media.filter((m: any) => m.type !== 'caption')
          // Add the new caption
          topic.media.push({
            id: captionFile.mediaId,
            type: 'caption',
            content: captionFile.content,
            storageId: captionFile.mediaId,
            title: '' // Required by Rust SCORM generator
          })
        }
      }
    })
    
    logger.log('[AudioNarrationWizard] Final content with audio:', {
      welcomeMedia: contentWithAudio.welcomePage?.media?.filter((m: any) => m.type === 'audio'),
      objectivesMedia: contentWithAudio.learningObjectivesPage?.media?.filter((m: any) => m.type === 'audio'),
      topicMedia: contentWithAudio.topics?.map((t: any) => ({ 
        id: t.id, 
        audioMedia: t.media?.filter((m: any) => m.type === 'audio') 
      }))
    })
    
    onNext(contentWithAudio)
  }

  // Handle file uploads using MediaRegistry
  const handleAudioFileChange = async (event: React.ChangeEvent<HTMLInputElement>, block: UnifiedNarrationBlock) => {
    
    const file = event.target.files?.[0]
    if (!file) return
    
    // Validate file size (50MB limit for individual audio files)
    const MAX_AUDIO_SIZE = 50 * 1024 * 1024 // 50MB
    if (file.size > MAX_AUDIO_SIZE) {
      setError(`Audio file is too large. Maximum size is 50MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB`)
      event.target.value = '' // Reset file input
      return Promise.resolve() // Return resolved promise for async consistency
    }
    
    // Start operation tracking
    const operationId = `audio-upload-${block.blockNumber}-${Date.now()}`
    startOperation(operationId)
    
    try {
      // First, delete any existing audio for this block from storage
      const existingAudio = audioFiles.find(f => f.blockNumber === block.blockNumber)
      if (existingAudio?.mediaId && deleteMedia) {
        try {
          // Clear from cache first to ensure fresh replacement
          clearAudioFromCache(existingAudio.mediaId)
          await deleteMedia(existingAudio.mediaId)
          logger.log(`[AudioNarrationWizard] Deleted old audio before replacement: ${existingAudio.mediaId}`)
        } catch (error) {
          logger.error(`[AudioNarrationWizard] Failed to delete old audio: ${existingAudio.mediaId}`, error)
        }
      }
      
      // Register with MediaRegistry
      logger.log('[AudioNarrationWizard] Registering audio with MediaRegistry:', block.pageId, 'audio')
      const storedItem = await storeMedia(file, block.pageId, 'audio', {
        blockNumber: block.blockNumber,
        fileName: file.name
      }, (progress) => {
        setUploadProgress({
          fileName: file.name,
          percent: progress.percent
        })
      })
      logger.log('[AudioNarrationWizard] Audio stored successfully:', storedItem.id)
      
      // Create a fresh blob URL for the uploaded audio
      let url: string | undefined
      try {
        const blobUrl = await createBlobUrl(storedItem.id)
        if (blobUrl) {
          url = blobUrl
          // Track the blob URL for cleanup
          if (!blobUrlsRef.current) {
            blobUrlsRef.current = []
          }
          blobUrlsRef.current.push(url)
          logger.log(`[AudioNarrationWizard] Created blob URL for uploaded audio: ${url}`)
        } else {
          logger.error(`[AudioNarrationWizard] Failed to create blob URL for uploaded audio: ${storedItem.id}`)
        }
      } catch (error) {
        logger.error(`[AudioNarrationWizard] Error creating blob URL for uploaded audio:`, error)
      }
      
      setAudioFiles(prev => {
        // Find and revoke old blob URL if it exists
        const oldAudio = prev.find(f => f.blockNumber === block.blockNumber)
        if (oldAudio?.url) {
          // If we're currently playing this audio, stop it
          if (playingBlockNumber === block.blockNumber) {
            logger.log(`[AudioNarrationWizard] Stopping currently playing audio before replacement`)
            setPlayingBlockNumber(null)
          }
          
          // Revoke old blob URL if it's a blob
          if (oldAudio.url.startsWith('blob:')) {
            try {
              URL.revokeObjectURL(oldAudio.url)
              logger.log(`[AudioNarrationWizard] Revoked old blob URL: ${oldAudio.url}`)
            } catch (e) {
              logger.warn(`[AudioNarrationWizard] Failed to revoke old blob URL:`, e)
            }
          }
        }
        
        // Remove any existing audio for this block
        const filtered = prev.filter(f => f.blockNumber !== block.blockNumber)
        
        // Increment version for this block to force TauriAudioPlayer remount
        setAudioVersionMap(prev => {
          const newMap = new Map(prev)
          const currentVersion = newMap.get(block.blockNumber) || 0
          newMap.set(block.blockNumber, currentVersion + 1)
          logger.log(`[AudioNarrationWizard] Incremented audio version for block ${block.blockNumber} to ${currentVersion + 1}`)
          return newMap
        })
        
        // Add the new audio with fresh URL
        return [...filtered, {
          blockNumber: block.blockNumber,
          file,
          url, // This is the fresh blob URL created above
          mediaId: storedItem.id
        }]
      })
      
      // Clear upload progress
      setUploadProgress(null)
      
      logger.log(`[AudioNarrationWizard] Stored audio ${storedItem.id} for block ${block.blockNumber}`)
      
      // Operation will complete and trigger save via endOperation
      logger.log('[AudioNarrationWizard] Audio upload operation complete')
    } catch (error) {
      logger.error('Error registering audio:', error)
      setError(`Failed to upload audio: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      // Reset the file input to allow selecting the same file again
      if (event.target) {
        event.target.value = ''
      }
      // End the operation which will trigger save if no other operations are active
      endOperation(operationId)
    }
  }

  const handleCaptionFileChange = async (event: React.ChangeEvent<HTMLInputElement>, block: UnifiedNarrationBlock) => {
    
    const file = event.target.files?.[0]
    if (!file) return
    
    // Start operation tracking
    const operationId = `caption-upload-${block.blockNumber}-${Date.now()}`
    startOperation(operationId)
    
    try {
      // Read file content - handle browsers that don't support File.text()
      const content = await new Promise<string>((resolve, reject) => {
        if (file.text) {
          file.text().then(resolve).catch(reject)
        } else {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsText(file)
        }
      })
      
      // Register with MediaRegistry
      const storedItem = await storeMedia(file, block.pageId, 'caption', {
        blockNumber: block.blockNumber
      })
      
      setCaptionFiles(prev => {
        // Remove any existing caption for this block
        const filtered = prev.filter(f => f.blockNumber !== block.blockNumber)
        // Add the new caption
        return [...filtered, {
          blockNumber: block.blockNumber,
          content,
          mediaId: storedItem.id
        }]
      })
      
      logger.log(`[AudioNarrationWizard] Stored caption ${storedItem.id} for block ${block.blockNumber}`)
      
      // Operation will complete and trigger save via endOperation
      logger.log('[AudioNarrationWizard] Caption upload operation complete')
    } catch (error) {
      logger.error('Error registering caption:', error)
    } finally {
      // End the operation which will trigger save if no other operations are active
      endOperation(operationId)
    }
  }

  // Play audio for a specific block
  // FIX: Use TauriAudioPlayer instead of new Audio() for asset:// URL compatibility
  const playAudio = async (blockNumber: string) => {
    // Save current scroll position before any state changes
    const scrollY = window.scrollY
    const scrollX = window.scrollX
    
    const audioFile = audioFiles.find(f => f.blockNumber === blockNumber)
    if (!audioFile) {
      logger.warn('[AudioNarrationWizard] No audio file found for block:', blockNumber)
      return
    }
    
    logger.log('[AudioNarrationWizard] playAudio called for block:', blockNumber, 'audioFile:', audioFile)
    
    // Always prefer the URL from state as it's the most up-to-date after replacement
    let url = audioFile.url || undefined
    
    // If we have an asset:// URL, use it directly! Tauri can handle these natively
    if (url && (url.startsWith('asset://') || url.includes('asset.localhost'))) {
      logger.log('[AudioNarrationWizard] Using asset URL directly for playback:', url)
      // Asset URLs can be played directly by the audio element
    }
    // If no URL, we need to get one
    else if (!url && audioFile.mediaId) {
      logger.log('[AudioNarrationWizard] No URL, getting from media service for:', audioFile.mediaId)
      
      try {
        const mediaData = await getMedia(audioFile.mediaId)
        if (mediaData?.url) {
          url = mediaData.url
          logger.log('[AudioNarrationWizard] Got URL from media service:', url)
          // Update the audioFile with the new URL
          setAudioFiles(prev => prev.map(f => 
            f.mediaId === audioFile.mediaId ? { ...f, url } : f
          ))
        }
      } catch (e) {
        logger.error('[AudioNarrationWizard] Failed to get media URL:', e)
      }
    }
    // If we have a blob URL (from recording), use it directly
    else if (url && url.startsWith('blob:')) {
      logger.log('[AudioNarrationWizard] Using blob URL directly (recording):', url)
    }
    
    if (url) {
      // Check if we're playing the same block (not just same URL)
      // Add timestamp to force cache invalidation when playing replaced audio
      const urlWithTimestamp = `${url}#t=${Date.now()}`
      
      // If already playing the same audio block, stop it
      if (playingBlockNumber === blockNumber) {
        logger.log('[AudioNarrationWizard] Stopping audio for block:', blockNumber)
        setPlayingBlockNumber(null)
        info(`Stopped audio for block ${blockNumber}`)
        return
      }
      
      // Store the block number to track what's playing
      // This survives URL changes when audio is replaced
      logger.log('[AudioNarrationWizard] Playing audio for block:', blockNumber, 'URL:', urlWithTimestamp)
      setPlayingBlockNumber(blockNumber)
      info(`Playing audio for block ${blockNumber}`)
      
      // Restore scroll position after state change
      requestAnimationFrame(() => {
        window.scrollTo(scrollX, scrollY)
      })
    } else {
      logger.error('[AudioNarrationWizard] Could not get audio URL for block:', blockNumber)
      // Show user feedback
      setError('Unable to play audio. Please try uploading the file again.')
    }
  }

  // Handler to show confirmation dialog for audio removal
  const handleRemoveAudioClick = (blockNumber: string) => {
    setPendingRemoveBlockNumber(blockNumber)
    setShowRemoveAudioConfirm(true)
  }

  // Remove audio for a specific block (after confirmation)
  const removeAudio = async (blockNumber: string) => {
    // Find the file to remove
    const fileToRemove = audioFiles.find(f => f.blockNumber === blockNumber)
    
    if (fileToRemove) {
      // Delete from media storage if it has a mediaId
      if (fileToRemove.mediaId && deleteMedia) {
        try {
          await deleteMedia(fileToRemove.mediaId)
          logger.log(`[AudioNarrationWizard] Deleted audio media: ${fileToRemove.mediaId}`)
        } catch (error) {
          logger.error(`[AudioNarrationWizard] Failed to delete audio media: ${fileToRemove.mediaId}`, error)
        }
      }
      
      // Clean up blob URL if it exists
      if (fileToRemove.url) {
        try {
          if (fileToRemove.url.startsWith('blob:')) {
            URL.revokeObjectURL(fileToRemove.url)
          } else if (revokeBlobUrl) {
            // Use UnifiedMediaContext to revoke if it's a managed URL
            revokeBlobUrl(fileToRemove.mediaId || '')
          }
        } catch (e) {
          logger.warn('Error revoking URL:', e)
        }
      }
    }
    
    // Update state to remove the file
    setAudioFiles(prev => prev.filter(f => f.blockNumber !== blockNumber))
  }
  
  // Confirm audio removal
  const confirmRemoveAudio = async () => {
    if (pendingRemoveBlockNumber) {
      await removeAudio(pendingRemoveBlockNumber)
      setShowRemoveAudioConfirm(false)
      setPendingRemoveBlockNumber(null)
    }
  }
  
  // Cancel audio removal
  const cancelRemoveAudio = () => {
    setShowRemoveAudioConfirm(false)
    setPendingRemoveBlockNumber(null)
  }

  // Generate caption for a specific block
  // Caption generation removed - requires audio timing data to properly sync captions

  // Handler to show confirmation dialog for caption removal
  const handleRemoveCaptionClick = (blockNumber: string) => {
    setPendingRemoveBlockNumber(blockNumber)
    setShowRemoveCaptionConfirm(true)
  }

  // Remove caption for a specific block (after confirmation)
  const removeCaption = async (blockNumber: string) => {
    // Find the caption to remove
    const captionToRemove = captionFiles.find(f => f.blockNumber === blockNumber)
    
    if (captionToRemove) {
      // Delete from media storage if it has a mediaId
      if (captionToRemove.mediaId && deleteMedia) {
        try {
          await deleteMedia(captionToRemove.mediaId)
          logger.log(`[AudioNarrationWizard] Deleted caption media: ${captionToRemove.mediaId}`)
        } catch (error) {
          logger.error(`[AudioNarrationWizard] Failed to delete caption media: ${captionToRemove.mediaId}`, error)
        }
      }
    }
    
    // Update state to remove the caption
    setCaptionFiles(prev => prev.filter(f => f.blockNumber !== blockNumber))
  }
  
  // Confirm caption removal
  const confirmRemoveCaption = async () => {
    if (pendingRemoveBlockNumber) {
      await removeCaption(pendingRemoveBlockNumber)
      setShowRemoveCaptionConfirm(false)
      setPendingRemoveBlockNumber(null)
    }
  }
  
  // Cancel caption removal
  const cancelRemoveCaption = () => {
    setShowRemoveCaptionConfirm(false)
    setPendingRemoveBlockNumber(null)
  }

  // Recording functions
  const handleRecordClick = (block: UnifiedNarrationBlock) => {
    const hasExistingAudio = audioFiles.some(f => f.blockNumber === block.blockNumber)
    if (hasExistingAudio) {
      setBlockToReplaceAudio(block)
    } else {
      setRecordingBlockId(block.id)
      setShowRecordingModal(true)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data])
        }
      }
      
      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      setRecordingError(null)
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (error) {
      logger.error('Error accessing microphone:', error)
      setRecordingError('Unable to access microphone. Please check your permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
      mediaRecorder.stream.getTracks().forEach(track => track.stop())
      setIsRecording(false)
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }
    }
  }

  const saveRecording = async () => {
    if (audioChunks.length === 0 || !recordingBlockId) return
    
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' })
    const audioFile = new File([audioBlob], generateAudioRecordingId(), { type: 'audio/wav' })
    
    const block = narrationBlocks.find(n => n.id === recordingBlockId)
    if (block) {
      // Start operation tracking
      const operationId = `audio-recording-${block.blockNumber}-${Date.now()}`
      startOperation(operationId)
      
      try {
        // Register with MediaRegistry
        const storedItem = await storeMedia(audioFile, block.pageId, 'audio', {
          blockNumber: block.blockNumber,
          fileName: audioFile.name,
          recordedAt: new Date().toISOString()
        }, (progress) => {
          setUploadProgress({
            fileName: 'Recording',
            percent: progress.percent
          })
        })
        
        // Create a fresh blob URL for the recorded audio
        let url: string | undefined
        try {
          const blobUrl = await createBlobUrl(storedItem.id)
          if (blobUrl) {
            url = blobUrl
            // Track the blob URL for cleanup
            if (!blobUrlsRef.current) {
              blobUrlsRef.current = []
            }
            blobUrlsRef.current.push(url)
            logger.log(`[AudioNarrationWizard] Created blob URL for recording: ${url}`)
          } else {
            logger.error(`[AudioNarrationWizard] Failed to create blob URL for recording: ${storedItem.id}`)
          }
        } catch (error) {
          logger.error(`[AudioNarrationWizard] Error creating blob URL for recording:`, error)
        }
        
        setAudioFiles(prev => {
          // Find and revoke old blob URL if it exists
          const oldAudio = prev.find(f => f.blockNumber === block.blockNumber)
          if (oldAudio?.url) {
            // If we're currently playing this audio, stop it
            if (playingBlockNumber === block.blockNumber) {
              logger.log(`[AudioNarrationWizard] Stopping currently playing audio before recording replacement`)
              setPlayingBlockNumber(null)
            }
            
            // Revoke old blob URL if it's a blob
            if (oldAudio.url.startsWith('blob:')) {
              try {
                URL.revokeObjectURL(oldAudio.url)
                logger.log(`[AudioNarrationWizard] Revoked old blob URL before recording: ${oldAudio.url}`)
              } catch (e) {
                logger.warn(`[AudioNarrationWizard] Failed to revoke old blob URL:`, e)
              }
            }
          }
          
          // Remove any existing audio for this block
          const filtered = prev.filter(f => f.blockNumber !== block.blockNumber)
          
          // Log the URL change for debugging
          const oldUrl = oldAudio?.url || 'none'
          logger.log(`[AudioNarrationWizard] Replacing audio URL for block ${block.blockNumber}:`)
          logger.log(`  Old URL: ${oldUrl}`)
          logger.log(`  New URL: ${url}`)
          
          // Increment version for this block to force TauriAudioPlayer remount
          setAudioVersionMap(prev => {
            const newMap = new Map(prev)
            const currentVersion = newMap.get(block.blockNumber) || 0
            newMap.set(block.blockNumber, currentVersion + 1)
            logger.log(`[AudioNarrationWizard] Incremented audio version for block ${block.blockNumber} to ${currentVersion + 1}`)
            return newMap
          })
          
          // Add the new audio with fresh URL
          const newAudioEntry = {
            blockNumber: block.blockNumber,
            file: audioFile,
            url, // This is the fresh blob URL created above
            mediaId: storedItem.id
          }
          
          return [...filtered, newAudioEntry]
        })
        
        logger.log(`[AudioNarrationWizard] Stored recorded audio ${storedItem.id} for block ${block.blockNumber} with URL: ${url}`)
        
        // Show success notification
        success(`Audio recorded for block ${block.blockNumber}`)
        
        // Operation will complete and trigger save via endOperation
        logger.log('[AudioNarrationWizard] Recording operation complete')
      } catch (error) {
        logger.error('Error saving recorded audio:', error)
      } finally {
        // End the operation which will trigger save if no other operations are active
        endOperation(operationId)
      }
    }
    
    // Reset recording state
    setShowRecordingModal(false)
    setRecordingBlockId(null)
    setAudioChunks([])
    setRecordingTime(0)
    if (recordingPreviewUrl) {
      URL.revokeObjectURL(recordingPreviewUrl)
      setRecordingPreviewUrl(null)
    }
  }

  const cancelRecording = () => {
    if (isRecording) {
      stopRecording()
    }
    
    setShowRecordingModal(false)
    setRecordingBlockId(null)
    setAudioChunks([])
    setRecordingTime(0)
    setRecordingError(null)
    
    if (recordingPreviewUrl) {
      URL.revokeObjectURL(recordingPreviewUrl)
      setRecordingPreviewUrl(null)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Bulk upload functions
  const downloadNarrationFile = () => {
    const narrationText = narrationBlocks
      .map(block => block.text)
      .join('\n\n')
    
    const blob = new Blob([narrationText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'narration-blocks.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // Clean up blob URL immediately after download
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  const handleAudioZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    debugLogger.info('AudioNarrationWizard.handleAudioZipUpload', 'Starting bulk audio upload')
    logger.log('[AudioNarrationWizard] handleAudioZipUpload called')
    const file = event.target.files?.[0]
    if (!file) {
      debugLogger.warn('AudioNarrationWizard.handleAudioZipUpload', 'No file selected')
      logger.warn('[AudioNarrationWizard] No file selected')
      return
    }
    
    // Clean up previously created blob URLs to prevent memory leaks
    if (blobUrlsRef.current && blobUrlsRef.current.length > 0) {
      logger.log('[AudioNarrationWizard] Cleaning up previous blob URLs before bulk upload')
      blobUrlsRef.current.forEach(url => {
        try {
          URL.revokeObjectURL(url)
        } catch (e) {
          logger.warn('[AudioNarrationWizard] Error revoking blob URL:', e)
        }
      })
      blobUrlsRef.current = []
    }
    
    // Declare newAudioFiles outside try block so it's accessible in finally
    let newAudioFiles: AudioFile[] = []
    
    debugLogger.info('AudioNarrationWizard.handleAudioZipUpload', 'File selected', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(2)
    })
    logger.log(`[AudioNarrationWizard] File selected: ${file.name}, size: ${file.size} bytes`)
    
    // Validate file type
    if (!file.name.endsWith('.zip')) {
      debugLogger.warn('AudioNarrationWizard.handleAudioZipUpload', 'Invalid file type', {
        fileName: file.name
      })
      setError('Please upload a ZIP file containing audio files')
      event.target.value = '' // Reset file input
      logger.warn('[AudioNarrationWizard] File is not a ZIP file')
      return
    }
    
    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      debugLogger.warn('AudioNarrationWizard.handleAudioZipUpload', 'File too large', {
        fileSize: file.size,
        maxSize,
        fileSizeMB: (file.size / 1024 / 1024).toFixed(2)
      })
      setError('ZIP file is too large. Maximum size is 100MB')
      event.target.value = '' // Reset file input
      return
    }
    
    // Start operation tracking
    const operationId = `bulk-audio-upload-${Date.now()}`
    startOperation(operationId)
    setIsUploading(true)
    setIsBulkAudioUploading(true) // Track audio upload specifically
    setIsBulkOperationActive(true) // Track bulk operation
    setError(null)
    
    try {
      debugLogger.debug('AudioNarrationWizard.handleAudioZipUpload', 'Creating JSZip instance')
      logger.log('[AudioNarrationWizard] Creating JSZip instance...')
      const zip = new JSZip()
      
      debugLogger.debug('AudioNarrationWizard.handleAudioZipUpload', 'Loading ZIP file')
      logger.log('[AudioNarrationWizard] Loading ZIP file...')
      const contents = await zip.loadAsync(file)
      
      debugLogger.info('AudioNarrationWizard.handleAudioZipUpload', 'ZIP loaded successfully', {
        fileCount: Object.keys(contents.files).length
      })
      logger.log('[AudioNarrationWizard] ZIP loaded successfully')
      // newAudioFiles already declared outside try block
      const skippedFiles: { filename: string; reason: string }[] = []
      
      debugLogger.debug('AudioNarrationWizard.handleAudioZipUpload', 'Processing ZIP contents', {
        files: Object.keys(contents.files),
        narrationBlockNumbers: narrationBlocks.map(b => b.blockNumber)
      })
      logger.log('[AudioNarrationWizard] Processing ZIP with files:', Object.keys(contents.files))
      logger.log('[AudioNarrationWizard] Current narration blocks:', narrationBlocks.map(b => b.blockNumber))
      
      // Limit number of files to process
      const maxFiles = 50
      let processedCount = 0
      
      // Process each file in the ZIP
      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (zipEntry.dir) continue // Skip directories
        
        // Check if it's an audio file
        if (!/\.(mp3|wav|m4a|ogg)$/i.test(filename)) {
          debugLogger.debug('AudioNarrationWizard.handleAudioZipUpload', `Skipping non-audio file: ${filename}`)
          logger.log(`[AudioNarrationWizard] Skipping non-audio file: ${filename}`)
          continue
        }
        
        // Extract block number (expecting format like 0001-Block.mp3)
        const blockNumber = filename.match(/(\d{4})/)?.[1]
        if (!blockNumber) {
          logger.warn(`[AudioNarrationWizard] Skipping ${filename}: no 4-digit block number found (expected format: 0001-Block.mp3)`)
          skippedFiles.push({ filename, reason: 'No 4-digit block number found' })
          continue
        }
        
        // Check if we have a narration block for this number
        const block = narrationBlocks.find(n => n.blockNumber === blockNumber)
        if (!block) {
          logger.warn(`[AudioNarrationWizard] Skipping ${filename}: no narration block found for number ${blockNumber}`)
          skippedFiles.push({ filename, reason: `No narration block for ${blockNumber}` })
          continue
        }
        
        // Check file count limit
        if (processedCount >= maxFiles) {
          logger.warn(`[AudioNarrationWizard] Reached max file limit (${maxFiles}), skipping remaining files`)
          break
        }
        
        try {
          debugLogger.debug('AudioNarrationWizard.handleAudioZipUpload', 'Processing audio file', {
            filename,
            blockNumber,
            pageId: block.pageId
          })
          logger.log(`[AudioNarrationWizard] Processing audio file: ${filename} for block ${blockNumber}`)
          const arrayBuffer = await zipEntry.async('arraybuffer')
          const blob = new Blob([arrayBuffer], { type: 'audio/*' })
          const audioFile = new File([blob], filename, { type: 'audio/*' })
          
          // Register with MediaRegistry
          const storedItem = await storeMedia(audioFile, block.pageId, 'audio', {
            originalName: filename,
            blockNumber: blockNumber
          }, (progress) => {
            setUploadProgress({
              fileName: filename,
              percent: progress.percent
            })
          })
          
          debugLogger.debug('AudioNarrationWizard.handleAudioZipUpload', 'Audio stored successfully', {
            mediaId: storedItem.id,
            blockNumber,
            filename
          })
          logger.log(`[AudioNarrationWizard] Successfully stored audio ${storedItem.id} for block ${blockNumber}`)
          
          // Always ensure we get a valid URL for playback
          let url: string | undefined
          
          // Use createBlobUrl - this is the canonical way to get blob URLs
          try {
            const blobUrl = await createBlobUrl(storedItem.id)
            if (blobUrl) {
              url = blobUrl
              logger.log(`[AudioNarrationWizard] Got blob URL for audio ${storedItem.id}:`, url)
              // Track blob URL for cleanup
              if (!blobUrlsRef.current) {
                blobUrlsRef.current = []
              }
              blobUrlsRef.current.push(url)
            } else {
              logger.error(`[AudioNarrationWizard] No blob URL returned for ${storedItem.id}`)
            }
          } catch (e) {
            logger.error('[AudioNarrationWizard] Failed to create blob URL:', e)
          }
          
          // Don't use fallbacks - if createBlobUrl fails, there's a real issue
          // The mediaUrlService fallback doesn't work anyway (asset:// protocol not registered)
          if (!url && storage?.currentProjectId) {
            try {
              const { mediaUrlService } = await import('../services/mediaUrl')
              const assetUrl = await mediaUrlService.getMediaUrl(storage.currentProjectId, storedItem.id)
              if (assetUrl) {
                url = assetUrl
                logger.log(`[AudioNarrationWizard] Got asset URL via mediaUrlService for ${storedItem.id}:`, assetUrl)
              }
            } catch (e) {
              logger.error('[AudioNarrationWizard] Failed to generate URL using mediaUrlService:', e)
            }
          }
          
          // If still no URL, create an asset URL as placeholder that will be converted on playback
          if (!url) {
            // Create a fallback asset URL that TauriAudioPlayer can handle
            url = `asset://localhost/${storage?.currentProjectId || 'project'}/media/${storedItem.id}.bin`
            logger.warn(`[AudioNarrationWizard] Using fallback asset URL for ${storedItem.id}: ${url}`)
          }
          
          newAudioFiles.push({
            blockNumber,
            file: audioFile,
            url,
            mediaId: storedItem.id
          })
          
          processedCount++
        } catch (fileError) {
          debugLogger.error('AudioNarrationWizard.handleAudioZipUpload', `Error processing file ${filename}`, {
            filename,
            blockNumber,
            error: fileError
          })
          logger.error(`[AudioNarrationWizard] Error processing file ${filename}:`, fileError)
          skippedFiles.push({ filename, reason: `Processing error: ${fileError}` })
          // Continue with next file
        }
      }
      
      // Replace all existing audio files using immutable update
      setAudioFiles(prev => {
        // Clear existing files for this bulk upload (replace, not merge)
        logger.log('[AudioNarrationWizard] Replacing audio files with bulk upload:', newAudioFiles.length)
        return [...newAudioFiles]
      })
      
      // Force immediate state update for audioUploaded
      if (newAudioFiles.length > 0) {
        setAudioUploaded(true)
        hasBulkUploadedRef.current = true // Mark that we have bulk uploaded files
      }
      
      // Log success for debugging
      debugLogger.info('AudioNarrationWizard.handleAudioZipUpload', 'Bulk upload complete', {
        filesProcessed: newAudioFiles.length,
        skippedCount: skippedFiles.length,
        totalNarrationBlocks: narrationBlocks.length,
        blockNumbers: newAudioFiles.map(f => f.blockNumber),
        skippedFiles: skippedFiles.map(f => f.filename)
      })
      logger.log('[AudioNarrationWizard] Audio bulk upload complete:', {
        filesProcessed: newAudioFiles.length,
        skippedCount: skippedFiles.length,
        blockNumbers: newAudioFiles.map(f => f.blockNumber),
        skippedFiles: skippedFiles
      })
      
      // Debug logging for beta testers
      if (debugLogger.isDebugMode()) {
        logger.log('[AudioNarrationWizard] Debug: Bulk audio upload completed', {
          filesProcessed: newAudioFiles.length,
          skipped: skippedFiles,
          blockNumbers: newAudioFiles.map(f => f.blockNumber),
          fileDetails: newAudioFiles.map(file => ({
            blockNumber: file.blockNumber,
            fileName: file.file.name,
            fileSize: file.file.size,
            mediaId: file.mediaId
          }))
        })
      }
      
      // Provide detailed user feedback
      if (newAudioFiles.length === 0 && skippedFiles.length > 0) {
        const sampleReasons = skippedFiles.slice(0, 3).map(f => `  • ${f.filename}: ${f.reason}`).join('\n')
        const moreCount = skippedFiles.length > 3 ? `\n  ...and ${skippedFiles.length - 3} more files` : ''
        setError(`No audio files were processed. Files must be named like 0001-Block.mp3.\n\nSkipped files:\n${sampleReasons}${moreCount}`)
      } else if (newAudioFiles.length === 0) {
        setError('No valid audio files found in the ZIP. Files must be named like 0001-Block.mp3')
      } else if (skippedFiles.length > 0) {
        // Some files processed, some skipped
        logger.warn(`[AudioNarrationWizard] Some files were skipped:`, skippedFiles)
      }
      
      event.target.value = '' // Reset file input
    } catch (error) {
      debugLogger.error('AudioNarrationWizard.handleAudioZipUpload', 'Failed to process ZIP', {
        error,
        fileName: file.name
      })
      logger.error('[AudioNarrationWizard] Error processing audio ZIP:', error)
      setError(`Failed to process audio ZIP file: ${error}`)
    } finally {
      setIsUploading(false)
      setIsBulkAudioUploading(false) // Clear the audio upload flag
      setIsBulkOperationActive(false) // Clear bulk operation flag
      setUploadProgress(null)
      debugLogger.debug('AudioNarrationWizard.handleAudioZipUpload', 'Upload operation finished')
      
      // End the operation which will trigger save if no other operations are active
      endOperation(operationId)
      
      // Manually trigger save after bulk upload completes
      // This ensures the parent component gets updated with the new media
      if (newAudioFiles.length > 0) {
        setTimeout(() => {
          logger.log('[AudioNarrationWizard] Triggering auto-save after bulk audio upload')
          autoSaveToCourseContent()
          
          // DO NOT reload persisted data after bulk upload - it will overwrite the just-uploaded files!
          // The files are already in state and will be saved to the parent
        }, 200)
      }
    }
  }

  const handleCaptionZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    debugLogger.info('AudioNarrationWizard.handleCaptionZipUpload', 'Starting bulk caption upload')
    const file = event.target.files?.[0]
    if (!file) {
      debugLogger.warn('AudioNarrationWizard.handleCaptionZipUpload', 'No file selected')
      return
    }
    
    // Declare newCaptionFiles outside try block so it's accessible in finally
    let newCaptionFiles: CaptionFile[] = []
    
    debugLogger.info('AudioNarrationWizard.handleCaptionZipUpload', 'File selected', {
      fileName: file.name,
      fileSize: file.size,
      fileSizeMB: (file.size / 1024 / 1024).toFixed(2)
    })
    
    // Validate file type
    if (!file.name.endsWith('.zip')) {
      debugLogger.warn('AudioNarrationWizard.handleCaptionZipUpload', 'Invalid file type', {
        fileName: file.name
      })
      setError('Please upload a ZIP file containing caption files')
      event.target.value = '' // Reset file input
      return
    }
    
    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      debugLogger.warn('AudioNarrationWizard.handleCaptionZipUpload', 'File too large', {
        fileSize: file.size,
        maxSize,
        fileSizeMB: (file.size / 1024 / 1024).toFixed(2)
      })
      setError('ZIP file is too large. Maximum size is 100MB')
      event.target.value = '' // Reset file input
      return
    }
    
    // Start operation tracking
    const operationId = `bulk-caption-upload-${Date.now()}`
    startOperation(operationId)
    setIsUploading(true)
    setIsBulkOperationActive(true) // Track bulk operation
    setError(null)
    
    try {
      debugLogger.debug('AudioNarrationWizard.handleCaptionZipUpload', 'Loading ZIP file')
      const zip = new JSZip()
      const contents = await zip.loadAsync(file)
      // newCaptionFiles already declared outside try block
      
      debugLogger.info('AudioNarrationWizard.handleCaptionZipUpload', 'ZIP loaded', {
        fileCount: Object.keys(contents.files).length
      })
      
      // Count valid files first
      let fileCount = 0
      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (!zipEntry.dir && /\.(vtt|srt)$/i.test(filename)) {
          fileCount++
        }
      }
      
      // Validate file count
      if (fileCount > 50) {
        debugLogger.warn('AudioNarrationWizard.handleCaptionZipUpload', 'Too many files in ZIP', {
          fileCount,
          maxAllowed: 50
        })
        setError('ZIP contains too many files. Maximum 50 caption files allowed')
        event.target.value = '' // Reset file input
        return
      }
      
      debugLogger.debug('AudioNarrationWizard.handleCaptionZipUpload', 'Processing caption files', {
        validFileCount: fileCount
      })
      
      let processedCount = 0
      // Process each file in the ZIP
      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (!zipEntry.dir && /\.(vtt|srt)$/i.test(filename)) {
          const blockNumber = filename.match(/(\d{4})/)?.[1]
          if (blockNumber) {
            try {
              debugLogger.debug('AudioNarrationWizard.handleCaptionZipUpload', 'Processing caption file', {
                filename,
                blockNumber
              })
              
              const content = await zipEntry.async('text')
              
              // Register with MediaRegistry
              const block = narrationBlocks.find(n => n.blockNumber === blockNumber)
              if (block) {
                const blob = new Blob([content], { type: 'text/vtt' })
                const captionFile = new File([blob], filename, { type: 'text/vtt' })
                
                const storedItem = await storeMedia(captionFile, block.pageId, 'caption', {
                  originalName: filename
                })
                
                // Retrieve the stored caption to ensure we have the content
                let captionContent = content
                try {
                  const storedCaption = await getMedia(storedItem.id)
                  if (storedCaption?.data) {
                    // Convert Uint8Array back to string
                    const decoder = new TextDecoder()
                    captionContent = decoder.decode(storedCaption.data)
                    logger.log(`[AudioNarrationWizard] Retrieved caption content for ${storedItem.id}`)
                  }
                } catch (e) {
                  logger.warn(`[AudioNarrationWizard] Could not retrieve caption content for ${storedItem.id}`, e)
                }
                
                newCaptionFiles.push({
                  blockNumber,
                  content: captionContent,
                  mediaId: storedItem.id
                })
                processedCount++
                
                debugLogger.debug('AudioNarrationWizard.handleCaptionZipUpload', 'Caption stored', {
                  blockNumber,
                  mediaId: storedItem.id,
                  filename
                })
              }
            } catch (error) {
              // Log error for individual file but continue processing others
              debugLogger.error('AudioNarrationWizard.handleCaptionZipUpload', `Error processing file ${filename}`, {
                filename,
                blockNumber,
                error
              })
              logger.error(`[AudioNarrationWizard] Error processing caption file ${filename}:`, error)
            }
          }
        }
      }
      
      // Replace all existing caption files using immutable update
      setCaptionFiles(prev => {
        // Clear existing files for this bulk upload (replace, not merge)
        logger.log('[AudioNarrationWizard] Replacing caption files with bulk upload:', newCaptionFiles.length)
        return [...newCaptionFiles]
      })
      
      // Force immediate state update for captionsUploaded
      if (newCaptionFiles.length > 0) {
        setCaptionsUploaded(true)
        hasBulkUploadedRef.current = true // Mark that we have bulk uploaded files
      }
      
      // Log success for debugging
      debugLogger.info('AudioNarrationWizard.handleCaptionZipUpload', 'Bulk caption upload complete', {
        filesProcessed: newCaptionFiles.length,
        totalBlocks: narrationBlocks.length,
        blockNumbers: newCaptionFiles.map(f => f.blockNumber)
      })
      logger.log('[AudioNarrationWizard] Caption bulk upload complete:', {
        filesProcessed: newCaptionFiles.length,
        blockNumbers: newCaptionFiles.map(f => f.blockNumber)
      })
      
      // Debug logging for beta testers
      if (debugLogger.isDebugMode()) {
        logger.log('[AudioNarrationWizard] Debug: Bulk caption upload completed', {
          filesProcessed: newCaptionFiles.length,
          blockNumbers: newCaptionFiles.map(f => f.blockNumber),
          fileDetails: newCaptionFiles.map(file => ({
            blockNumber: file.blockNumber,
            mediaId: file.mediaId
          }))
        })
      }
      
      event.target.value = '' // Reset file input
    } catch (error) {
      debugLogger.error('AudioNarrationWizard.handleCaptionZipUpload', 'Failed to process caption ZIP', {
        error,
        fileName: file.name
      })
      logger.error('Error processing caption ZIP:', error)
      setError('Failed to process caption ZIP file')
    } finally {
      setIsUploading(false)
      setIsBulkOperationActive(false) // Clear bulk operation flag
      debugLogger.debug('AudioNarrationWizard.handleCaptionZipUpload', 'Caption upload operation finished')
      
      // End the operation which will trigger save if no other operations are active
      endOperation(operationId)
      
      // Manually trigger save after bulk upload completes
      // This ensures the parent component gets updated with the new media
      if (newCaptionFiles.length > 0) {
        setTimeout(() => {
          logger.log('[AudioNarrationWizard] Triggering auto-save after bulk caption upload')
          autoSaveToCourseContent()
          
          // DO NOT reload persisted data after bulk upload - it will overwrite the just-uploaded files!
          // The files are already in state and will be saved to the parent
        }, 200)
      }
    }
  }

  // Render
  return (
    <PageLayout
      currentStep={4}
      title="Audio Narration"
      description="Add audio narration and captions to your course"
      autoSaveIndicator={<AutoSaveIndicatorConnected />}
      onNext={handleNext}
      onBack={onBack}
      onSave={onSave}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
      onSettingsClick={onSettingsClick}
    >
      {/* Loading indicator */}
      {isLoadingPersistedData && (
        <div className={styles.loadingOverlay} data-testid="audio-loading-overlay">
          <Card variant="default" className={styles.loadingCard}>
            <div className={styles.loadingContent}>
              <div className={styles.spinner} data-testid="loading-spinner" />
              <div className={styles.loadingText}>
                <h3>Loading audio files...</h3>
                {loadingProgress.total > 0 && (
                  <p className={styles.loadingSubtext}>
                    Loading {loadingProgress.current} of {loadingProgress.total} files...
                  </p>
                )}
                {loadingProgress.total === 0 && (
                  <p className={styles.loadingSubtext}>Please wait while we load your saved audio and caption files</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
      
      <div className={styles.mainContainer}>
        {/* Left Sidebar Navigation */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h3 className={styles.sidebarTitle}>Page Navigation</h3>
            <div className={styles.progressSummary}>
              <div className={styles.progressStat}>
                <Volume2 size={16} />
                <span>{audioFiles.length}/{narrationBlocks.length} Audio</span>
              </div>
              <div className={styles.progressStat}>
                <FileText size={16} />
                <span>{captionFiles.length}/{narrationBlocks.length} Captions</span>
              </div>
            </div>
          </div>
          
          <ul className={styles.navList}>
            {narrationBlocks.map((block) => {
              const hasAudio = audioFiles.some(f => f.blockNumber === block.blockNumber)
              const hasCaption = captionFiles.some(f => f.blockNumber === block.blockNumber)
              const isActive = editingBlockId === block.id || playingBlockNumber === block.blockNumber
              
              return (
                <li 
                  key={block.id}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                  onClick={() => {
                    // Scroll to the block in main content
                    const blockElement = document.getElementById(`block-${block.blockNumber}`)
                    blockElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }}
                >
                  <div className={styles.navItemHeader}>
                    <span className={styles.navItemTitle}>{block.pageTitle}</span>
                    <div className={styles.navItemStatus}>
                      <span className={`${styles.statusIcon} ${hasAudio ? styles.audio : styles.empty}`}>
                        {hasAudio ? <CheckCircle size={12} /> : <Circle size={12} />}
                      </span>
                      <span className={`${styles.statusIcon} ${hasCaption ? styles.caption : styles.empty}`}>
                        {hasCaption ? <CheckCircle size={12} /> : <Circle size={12} />}
                      </span>
                    </div>
                  </div>
                  <div className={styles.navItemPreview}>
                    {typeof block.text === 'string' ? block.text.substring(0, 50) : String(block.text || '').substring(0, 50)}...
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Main Content Area */}
        <div className={styles.mainContent}>
          {/* Show error if any */}
          {error && (
            <Alert variant="error">
              {error}
            </Alert>
          )}

          {/* Stats Bar */}
          <div className={styles.statsBar}>
            <div className={styles.statsLeft}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Blocks</span>
                <span className={styles.statValue}>{narrationBlocks.length}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Duration</span>
                <span className={styles.statValue}>
                  {audioFiles.length > 0 ? `${Math.floor(audioFiles.length * 1.5)} min` : '--'}
                </span>
              </div>
            </div>
            
            <div className={styles.progressBarContainer}>
              <div className={styles.progressLabel}>Overall Completion</div>
              <div className={styles.progressBar}>
                <div 
                  className={styles.progressFill} 
                  style={{ width: `${Math.round((audioFiles.length / narrationBlocks.length) * 100)}%` }}
                />
              </div>
            </div>
            
            <div className={styles.quickActions}>
              <Button
                size="small"
                variant="secondary"
                onClick={() => setShowBulkUpload(true)}
              >
                <Upload size={16} />
                Bulk Upload
              </Button>
              <Button
                size="small"
                variant="secondary"
                onClick={downloadNarrationFile}
              >
                <Save size={16} />
                Download Narration Text
              </Button>
              {audioFiles.length > 0 && (
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => setShowClearAllConfirm(true)}
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>

          {/* Narration Blocks Container */}
          <div className={styles.narrationBlocksContainer}>
            {/* Group blocks by page */}
            {(() => {
              const pageGroups: { [key: string]: UnifiedNarrationBlock[] } = {}
              narrationBlocks.forEach(block => {
                if (!pageGroups[block.pageTitle]) {
                  pageGroups[block.pageTitle] = []
                }
                pageGroups[block.pageTitle].push(block)
              })
              
              return Object.entries(pageGroups).map(([pageTitle, blocks]) => (
                <div key={pageTitle} className={styles.pageGroup}>
                  <div className={styles.pageGroupHeader}>
                    <div className={styles.pageIndicator} />
                    {pageTitle}
                  </div>
                  
                  {blocks.map((block) => {
                    const hasAudio = audioFiles.some(f => f.blockNumber === block.blockNumber)
                    const hasCaption = captionFiles.some(f => f.blockNumber === block.blockNumber)
                    const isEditing = editingBlockId === block.id
                    
                    const audioFile = audioFiles.find(f => f.blockNumber === block.blockNumber)
                    const isCurrentlyPlaying = playingBlockNumber === block.blockNumber
                    
                    return (
                      <div key={block.id} id={`block-${block.blockNumber}`}>
                        <NarrationBlockItem
                          block={block}
                          hasAudio={hasAudio}
                          hasCaption={hasCaption}
                          isEditing={isEditing}
                          onEdit={() => {
                            setEditingBlockId(block.id)
                            setEditingText(block.text)
                          }}
                          onUpdate={(text) => {
                            setNarrationBlocks(prev => prev.map(b =>
                              b.id === block.id ? { ...b, text } : b
                            ))
                            setEditingBlockId(null)
                          }}
                          onCancel={() => setEditingBlockId(null)}
                          onPlayAudio={() => playAudio(block.blockNumber)}
                          onUploadAudio={(e) => handleAudioFileChange(e, block)}
                          onRemoveAudio={() => handleRemoveAudioClick(block.blockNumber)}
                          onPreviewCaption={() => {
                            setPreviewBlockId(block.id)
                            setShowPreview(true)
                          }}
                          onToggleRecording={() => handleRecordClick(block)}
                          onReplaceAudio={() => setShowReplaceAudioModal(block)}
                          onRemoveCaption={() => handleRemoveCaptionClick(block.blockNumber)}
                          isRecording={recordingBlockId === block.id}
                          recordingId={recordingBlockId}
                          isPlaying={isCurrentlyPlaying}
                        />
                      </div>
                    )
                  })}
                </div>
              ))
            })()}
          </div>
        </div>
      </div>

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <Modal
          isOpen={showBulkUpload}
          onClose={() => setShowBulkUpload(false)}
          title="Bulk Audio Upload (Murf.ai)"
          size="large"
        >
          <div className={styles.bulkUploadModalContent}>
            {/* Quick Instructions Card */}
            <Card variant="dark" padding="medium" className={styles.instructionsCard}>
              <h4 className={styles.instructionsTitle}>Quick Instructions</h4>
              <ol className={styles.instructionsList}>
                <li>Download narration text using the button below</li>
                <li>Upload text to Murf.ai (split by paragraphs)</li>
                <li>Export audio as MP3 and captions as VTT (split by blocks)</li>
                <li>Name files: 0001-Block.mp3, 0002-Block.vtt, etc.</li>
                <li>Create ZIP files and upload them here</li>
              </ol>
              
              <div className={styles.downloadButtonWrapper}>
                <Button
                  onClick={downloadNarrationFile}
                  variant="primary"
                  data-testid="download-narration-button"
                >
                  <Save size={16} />
                  Download Narration Text
                </Button>
              </div>
            </Card>

            {/* Upload Section */}
            <div className={styles.uploadSection}>
              <Grid cols={2} gap="large">
                {/* Audio Upload Card */}
                <Card variant="dark" padding="medium">
                  <h4 className={styles.uploadCardTitle}>
                    <Volume2 size={20} />
                    Audio Files
                  </h4>
                  
                  <div 
                    className={`${styles.dropZone} ${isUploading ? styles.dropZoneUploading : ''}`}
                    onClick={() => !isUploading && document.getElementById('audio-zip-input')?.click()}
                  >
                    <input
                      id="audio-zip-input"
                      type="file"
                      accept=".zip"
                      onChange={handleAudioZipUpload}
                      className={styles.hiddenInput}
                      aria-label="Upload audio zip"
                      data-testid="audio-zip-input"
                    />
                    
                    {!isUploading && !audioUploaded && (
                      <>
                        <Upload size={32} className={styles.dropZoneIcon} />
                        <p className={styles.dropZoneText}>Click to upload audio ZIP</p>
                        <p className={styles.dropZoneHint}>or drag and drop</p>
                      </>
                    )}
                    
                    {isUploading && uploadProgress && (
                      <div className={styles.uploadingContainer}>
                        <div className={styles.spinner} />
                        <p className={styles.uploadingText}>
                          Uploading {uploadProgress.fileName}
                        </p>
                        <ProgressBar 
                          value={uploadProgress.percent} 
                          max={100}
                          label={`${uploadProgress.percent}%`}
                          className={styles.uploadProgress}
                        />
                      </div>
                    )}
                    
                    {audioUploaded && (
                      <div className={styles.uploadSuccess}>
                        <CheckCircle size={32} className={styles.successIcon} />
                        <p className={styles.successText}>
                          {audioFiles.length} audio files uploaded
                        </p>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAudioUploaded(false)
                            document.getElementById('audio-zip-input')?.click()
                          }}
                        >
                          Replace Files
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Caption Upload Card */}
                <Card variant="dark" padding="medium">
                  <h4 className={styles.uploadCardTitle}>
                    <FileText size={20} />
                    Caption Files
                  </h4>
                  
                  <div 
                    className={styles.dropZone}
                    onClick={() => document.getElementById('captions-zip-input')?.click()}
                  >
                    <input
                      id="captions-zip-input"
                      type="file"
                      accept=".zip"
                      onChange={handleCaptionZipUpload}
                      className={styles.hiddenInput}
                      aria-label="Upload captions zip"
                      data-testid="captions-zip-input"
                    />
                    
                    {!captionsUploaded && (
                      <>
                        <Upload size={32} className={styles.dropZoneIcon} />
                        <p className={styles.dropZoneText}>Click to upload captions ZIP</p>
                        <p className={styles.dropZoneHint}>or drag and drop</p>
                      </>
                    )}
                    
                    {captionsUploaded && (
                      <div className={styles.uploadSuccess}>
                        <CheckCircle size={32} className={styles.successIcon} />
                        <p className={styles.successText}>
                          {captionFiles.length} caption files uploaded
                        </p>
                        <Button
                          size="small"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCaptionsUploaded(false)
                            document.getElementById('captions-zip-input')?.click()
                          }}
                        >
                          Replace Files
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              </Grid>
            </div>

            {/* Warning */}
            <Alert variant="warning">
              <strong>Note:</strong> Bulk upload will replace all existing audio and caption files. Make sure you have all required files in your ZIP archive.
            </Alert>
          </div>
        </Modal>
      )}

      {/* Recording Modal */}
      {showRecordingModal && (
          <Modal
            isOpen={showRecordingModal}
            onClose={cancelRecording}
            title={`Record Audio for ${narrationBlocks.find(b => b.id === recordingBlockId)?.pageTitle || ''}`}
            size="medium"
          >
            <div>
              {/* Display narration text for reference while recording */}
              {(() => {
                const currentBlock = narrationBlocks.find(b => b.id === recordingBlockId)
                if (currentBlock?.text) {
                  return (
                    <div className={styles.recordingTextContainer}>
                      <h4 className={styles.recordingTextTitle}>
                        Narration Text
                      </h4>
                      <p className={styles.recordingTextContent}>
                        {currentBlock.text}
                      </p>
                    </div>
                  )
                }
                return null
              })()}
              
              <div className={styles.recordingModalContent}>
                {!isRecording && !recordingPreviewUrl && (
                  <div>
                    <p className={styles.recordingPrompt}>
                      Click the button below to start recording
                    </p>
                    <Button
                      onClick={startRecording}
                      variant="primary"
                      size="large"
                      data-testid="start-recording-button"
                    >
                      <Icon icon={Mic} size="md" /> Start Recording
                    </Button>
                  </div>
                )}
              
              {isRecording && (
                <div>
                  <div className={styles.recordingTimer}>
                    <Icon icon={Circle} size="sm" color="#ef4444" /> {formatTime(recordingTime)}
                  </div>
                  <p className={styles.recordingStatus}>
                    Recording in progress...
                  </p>
                  <Button
                    onClick={stopRecording}
                    variant="danger"
                    size="large"
                    data-testid="stop-recording-button"
                  >
                    Stop Recording
                  </Button>
                </div>
              )}
              
              {recordingPreviewUrl && (
                <div>
                  <TauriAudioPlayer
                    controls
                    src={recordingPreviewUrl}
                  />
                  <ButtonGroup gap="medium" align="center" style={{ marginTop: 'var(--space-lg)' }}>
                    <Button
                      onClick={saveRecording}
                      variant="primary"
                      data-testid="save-recording-button"
                    >
                      <Icon icon={Save} size="sm" /> Save Recording
                    </Button>
                    <Button
                      onClick={() => {
                        setRecordingPreviewUrl(null)
                        setAudioChunks([])
                        setRecordingTime(0)
                      }}
                      variant="secondary"
                    >
                      Re-record
                    </Button>
                  </ButtonGroup>
                </div>
              )}
              
              {recordingError && (
                <Alert variant="error">
                  {recordingError}
                </Alert>
              )}
              </div>
            </div>
          </Modal>
        )}

      {/* Caption Preview Modal */}
      {showPreview && previewBlockId && (
          <Modal
            isOpen={showPreview}
            onClose={() => setShowPreview(false)}
            title="Caption Preview"
            size="medium"
          >
            {(() => {
              const block = narrationBlocks.find(b => b.id === previewBlockId)
              const hasAudio = block && audioFiles.some(f => f.blockNumber === block.blockNumber)
              
              return (
                <div>
                  {hasAudio && block && (
                    <TauriAudioPlayer
                      data-testid="caption-preview-audio"
                      controls
                      src={audioFiles.find(f => f.blockNumber === block.blockNumber)?.url}
                    />
                  )}
                  <div className={styles.captionPreviewContainer}>
                    <pre className={styles.captionPreviewText}>
                      {block && captionFiles.find(f => f.blockNumber === block.blockNumber)?.content}
                    </pre>
                  </div>
                </div>
              )
            })()}
          </Modal>
        )}

      {/* Replace Audio Confirmation */}
      {blockToReplaceAudio && (
          <ConfirmDialog
            isOpen={!!blockToReplaceAudio}
            onConfirm={() => {
              if (blockToReplaceAudio) {
                setRecordingBlockId(blockToReplaceAudio.id)
                setShowRecordingModal(true)
                setBlockToReplaceAudio(null)
              }
            }}
            onCancel={() => setBlockToReplaceAudio(null)}
            title="Replace Audio"
            message="This will replace the existing audio file. Are you sure you want to continue?"
            confirmText="Replace"
            cancelText="Cancel"
          />
        )}
      
      {/* Replace Audio Modal */}
      {showReplaceAudioModal && (
        <Modal
          isOpen={!!showReplaceAudioModal}
          onClose={() => setShowReplaceAudioModal(null)}
          title="Replace Audio"
          size="small"
        >
          <div className={styles.replaceAudioModalContent}>
            <p className={styles.replaceAudioText}>
              Choose how you want to replace the audio for "{showReplaceAudioModal.pageTitle}":
            </p>
            
            <div className={styles.replaceAudioOptions}>
              <input
                type="file"
                accept="audio/*"
                className={styles.hiddenInput}
                id="replace-audio-upload"
                onChange={async (e) => {
                  // Wait for the upload to complete before closing modal
                  await handleAudioFileChange(e, showReplaceAudioModal)
                  // Don't reset here - it's already done in handleAudioFileChange's finally block
                  // Close the modal after upload completes
                  setShowReplaceAudioModal(null)
                }}
              />
              <label htmlFor="replace-audio-upload" className={styles.replaceAudioLabel}>
                <Button
                  variant="secondary"
                  size="medium"
                  className={styles.replaceAudioButton}
                  style={{ pointerEvents: 'none' }}
                >
                  <Upload size={20} />
                  Upload Audio File
                </Button>
              </label>
              
              <Button
                variant="secondary"
                size="medium"
                onClick={async () => {
                  // Remove existing audio first
                  await removeAudio(showReplaceAudioModal.blockNumber)
                  // Start recording directly without confirmation
                  setRecordingBlockId(showReplaceAudioModal.id)
                  setShowRecordingModal(true)
                  setShowReplaceAudioModal(null)
                }}
                className={styles.replaceAudioButton}
              >
                <Mic size={20} />
                Record New Audio
              </Button>
            </div>
          </div>
        </Modal>
      )}
      
      {/* Clear All Confirmation */}
      {showClearAllConfirm && (
        <ConfirmDialog
          isOpen={showClearAllConfirm}
          onConfirm={async () => {
            // Delete all media from storage first
            if (deleteMedia) {
              // Delete all audio files from storage
              for (const file of audioFiles) {
                if (file.mediaId) {
                  try {
                    await deleteMedia(file.mediaId)
                  } catch (error) {
                    logger.error(`Failed to delete audio ${file.mediaId}:`, error)
                  }
                }
              }
              
              // Delete all caption files from storage
              for (const file of captionFiles) {
                if (file.mediaId) {
                  try {
                    await deleteMedia(file.mediaId)
                  } catch (error) {
                    logger.error(`Failed to delete caption ${file.mediaId}:`, error)
                  }
                }
              }
            }
            
            // Clear state FIRST
            setAudioFiles([])
            setCaptionFiles([])
            
            // Now explicitly clear media arrays from course content
            const clearedContent = JSON.parse(JSON.stringify(courseContent))
            
            // Clear welcome page media
            if ('welcomePage' in clearedContent && clearedContent.welcomePage) {
              clearedContent.welcomePage.media = []
              // Also clear the deprecated audioId and captionId fields
              delete clearedContent.welcomePage.audioId
              delete clearedContent.welcomePage.captionId
            }
            
            // Clear objectives page media
            if ('learningObjectivesPage' in clearedContent && clearedContent.learningObjectivesPage) {
              clearedContent.learningObjectivesPage.media = []
              // Also clear the deprecated audioId and captionId fields
              delete clearedContent.learningObjectivesPage.audioId
              delete clearedContent.learningObjectivesPage.captionId
            }
            
            // Clear all topic media
            if (clearedContent.topics && Array.isArray(clearedContent.topics)) {
              clearedContent.topics.forEach((topic: any) => {
                topic.media = []
                // Also clear the deprecated audioId and captionId fields
                delete topic.audioId
                delete topic.captionId
              })
            }
            
            // Save the cleared content directly
            if (storage && storage.currentProjectId) {
              storage.saveContent('audioNarration', clearedContent)
              
              // Update metadata to indicate no audio narration
              const metadata = await storage.getCourseMetadata() || {}
              await storage.saveCourseMetadata({
                ...metadata,
                hasAudioNarration: false
              })
            }
            
            // Pass cleared content to parent
            if (onSave) {
              onSave(clearedContent, true) // Pass silent=true to avoid double save
            }
            
            setShowClearAllConfirm(false)
          }}
          onCancel={() => setShowClearAllConfirm(false)}
          title="Clear All Audio and Captions"
          message="This will permanently delete all audio and caption files. This action cannot be undone."
          confirmText="Clear All"
          cancelText="Cancel"
        />
      )}
      
      {/* Hidden TauriAudioPlayer for asset:// URL playback - Always rendered to prevent layout shifts */}
      <div className={styles.hiddenAudioPlayer}>
        <TauriAudioPlayer
          key={(() => {
            if (!playingBlockNumber) return 'audio-none'
            const audioFile = audioFiles.find(f => f.blockNumber === playingBlockNumber)
            const version = audioVersionMap.get(playingBlockNumber) || 0
            return audioFile?.mediaId 
              ? `${audioFile.mediaId}-v${version}`
              : `audio-${playingBlockNumber}-v${version}`
          })()} // Use mediaId + version for reliable cache busting
          src={(() => {
            if (!playingBlockNumber) return undefined
            const audioFile = audioFiles.find(f => f.blockNumber === playingBlockNumber)
            if (!audioFile?.url) {
              logger.warn(`[AudioNarrationWizard] No audio URL found for playing block ${playingBlockNumber}`)
              return undefined
            }
            // Don't add query params to blob URLs - they break!
            // The key prop on the component handles cache busting
            logger.log(`[AudioNarrationWizard] TauriAudioPlayer src for block ${playingBlockNumber}: ${audioFile.url}`)
            return audioFile.url
          })()}
          controls={false}
          data-testid="hidden-audio-player"
          autoPlay={true}
          onError={(error) => {
            if (playingBlockNumber) {
              logger.error('[AudioNarrationWizard] TauriAudioPlayer error:', error)
              setError('Failed to play audio')
              setPlayingBlockNumber(null)
            }
          }}
          onEnded={() => {
            if (playingBlockNumber) {
              setPlayingBlockNumber(null)
            }
          }}
        />
      </div>

      {/* Confirmation dialog for audio removal */}
      <ConfirmDialog
        isOpen={showRemoveAudioConfirm}
        title="Remove Audio"
        message="Are you sure you want to remove this audio narration? This action cannot be undone."
        confirmText="Delete Audio"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmRemoveAudio}
        onCancel={cancelRemoveAudio}
      />

      {/* Confirmation dialog for caption removal */}
      <ConfirmDialog
        isOpen={showRemoveCaptionConfirm}
        title="Remove Caption"
        message="Are you sure you want to remove this caption file? This action cannot be undone."
        confirmText="Delete Caption"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmRemoveCaption}
        onCancel={cancelRemoveCaption}
      />
    </PageLayout>
  )
}

// Memoize the component to prevent unnecessary re-renders
// This significantly improves performance when parent components re-render
export default memo(AudioNarrationWizard);