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
import { FileAudio, FileText, Eye, Mic, Circle, Save } from 'lucide-react'
import { TauriAudioPlayer } from './TauriAudioPlayer'
import './DesignSystem/designSystem.css'
import { tokens } from './DesignSystem/designTokens'
import styles from './AudioNarrationWizard.module.css'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
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

interface AudioNarrationWizardProps {
  courseContent: CourseContentUnion
  courseSeedData?: CourseSeedData
  onNext: (enhancedContent: CourseContentUnion) => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: (content?: any, silent?: boolean) => void
  onSaveAs?: () => void
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
  onSaveAs,
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
    deleteMedia
  } = useUnifiedMedia()
  
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
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null)
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
  const [error, setError] = useState<string | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [previewBlockId, setPreviewBlockId] = useState<string | null>(null)
  const [blockToReplaceAudio, setBlockToReplaceAudio] = useState<UnifiedNarrationBlock | null>(null)
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
    onGenerateCaption,
    onPreviewCaption,
    onToggleRecording,
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
    onGenerateCaption: () => void,
    onPreviewCaption: () => void,
    onToggleRecording: () => void,
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
            {/* Audio playback and remove controls - only show when audio exists */}
            {hasAudio && (
              <>
                <Button
                  size="small"
                  variant={isPlaying ? "primary" : "secondary"}
                  onClick={onPlayAudio}
                  className={styles.buttonWithIcon}
                >
                  {isPlaying ? '⏹️ Stop' : '▶️ Play'}
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  onClick={onRemoveAudio}
                  className={styles.dangerButton}
                >
                  Remove Audio
                </Button>
              </>
            )}
            
            {/* Separate Upload Audio button - always shows "Upload Audio" */}
            <input
              type="file"
              accept="audio/*"
              className={styles.hiddenInput}
              id={`audio-upload-${block.blockNumber}`}
              onChange={onUploadAudio}
            />
            <label htmlFor={`audio-upload-${block.blockNumber}`} className={styles.uploadLabel}>
              <span className={styles.uploadLabelSpan}>
                <Button
                  size="small"
                  variant="secondary"
                  className={styles.uploadButtonDisabled}
                >
                  📁 Upload Audio
                </Button>
              </span>
            </label>
            
            {/* Separate Record Audio button - always shows "Record Audio" */}
            <Button
              size="small"
              variant={isRecording && recordingId === block.id ? "primary" : "secondary"}
              onClick={onToggleRecording}
              className={styles.buttonWithIcon}
            >
              {isRecording && recordingId === block.id ? '⏹️ Stop Recording' : '🎙️ Record Audio'}
            </Button>
            {/* Caption Upload - Always Available */}
            <div className={styles.captionUploadContainer}>
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
                  >
                    📝 Upload Caption
                  </Button>
                </span>
              </label>
              {hasCaption && (
                <>
                  <span className={styles.successCheck}>
                    ✓
                  </span>
                  <Button
                    size="small"
                    variant="tertiary"
                    onClick={onPreviewCaption}
                    className={styles.buttonWithIcon}
                  >
                    👁️ Preview
                  </Button>
                </>
              )}
            </div>
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
  
  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      // Revoke all blob URLs when component unmounts
      if (blobUrlsRef.current && blobUrlsRef.current.length > 0) {
        logger.log('[AudioNarrationWizard] Cleaning up blob URLs on unmount')
        blobUrlsRef.current.forEach(url => {
          try {
            URL.revokeObjectURL(url)
          } catch (e) {
            logger.warn('[AudioNarrationWizard] Failed to revoke blob URL:', e)
          }
        })
        blobUrlsRef.current = []
      }
    }
  }, [])
  
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
              
              // Only track blob URLs for cleanup (from recordings)
              if (playableUrl && playableUrl.startsWith('blob:')) {
                blobUrlsRef.current.push(playableUrl)
              }
              
              const audioFile: AudioFile = {
                blockNumber: block.blockNumber,
                file: cachedData.file || new File([], cachedData.fileName || `${block.blockNumber}-Block.mp3`),
                url: playableUrl || undefined,
                mediaId: audioId
              }
              return audioFile
            }
          }
          
          try {
            // Get media from UnifiedMedia - use asset URL directly
            const mediaData = await getMedia(audioId)
            
            if (mediaData) {
              const fileName = mediaData.metadata?.original_name || mediaData.metadata?.originalName || `${block.blockNumber}-Block.mp3`
              
              // Use the URL directly - asset:// URLs work natively in Tauri
              const playableUrl = mediaData.url
              
              logger.log(`[AudioNarrationWizard] Got media URL for ${audioId}:`, playableUrl)
              
              // Only track blob URLs for cleanup (from recordings)
              if (playableUrl && playableUrl.startsWith('blob:')) {
                // Track existing blob URLs for cleanup
                blobUrlsRef.current.push(playableUrl)
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
            return mediaCache.current.get(cacheKey)
          }
          
          try {
            // Get caption content from MediaService
            const mediaData = await getMedia(captionId)
            
            if (mediaData) {
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
        const block = narrationBlocks.find(b => b.pageId === item.pageId)
        if (block) {
          const mediaData = await getMedia(item.id)
          if (mediaData) {
            // Use the asset URL from MediaService
            const url = mediaData.url || undefined
            
            // Create a placeholder file for UI consistency  
            const fileName = item.metadata?.fileName || item.fileName || 'audio.mp3'
            const file = new File([], fileName, { type: mediaData.metadata?.mimeType || 'audio/mpeg' })
            
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
        const block = narrationBlocks.find(b => b.pageId === item.pageId)
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
    
    setAudioUploaded(hasAudio)
  }, [audioFiles])

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
    
    // CRITICAL FIX: Sync edited narration text back to course content during autosave
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
    if (autoSaveToCourseContentRef.current) {
      autoSaveToCourseContentRef.current()
    }
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
    
    // CRITICAL FIX: Sync edited narration text back to course content
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
      return
    }
    
    // Start operation tracking
    const operationId = `audio-upload-${block.blockNumber}-${Date.now()}`
    startOperation(operationId)
    
    try {
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
      
      // Get the asset URL from the stored media item
      const mediaData = await getMedia(storedItem.id)
      const url = mediaData?.url || undefined
      
      setAudioFiles(prev => {
        // Remove any existing audio for this block
        const filtered = prev.filter(f => f.blockNumber !== block.blockNumber)
        // Add the new audio
        return [...filtered, {
          blockNumber: block.blockNumber,
          file,
          url,
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
    } finally {
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
    const audioFile = audioFiles.find(f => f.blockNumber === blockNumber)
    if (!audioFile) {
      logger.warn('[AudioNarrationWizard] No audio file found for block:', blockNumber)
      return
    }
    
    logger.log('[AudioNarrationWizard] playAudio called for block:', blockNumber, 'audioFile:', audioFile)
    
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
      // If already playing the same audio, stop it
      if (playingAudioUrl === url) {
        logger.log('[AudioNarrationWizard] Stopping audio:', url)
        setPlayingAudioUrl(null)
        return
      }
      
      // Store the currently playing audio URL for TauriAudioPlayer to handle
      logger.log('[AudioNarrationWizard] Playing audio with TauriAudioPlayer:', url)
      setPlayingAudioUrl(url)
    } else {
      logger.error('[AudioNarrationWizard] Could not get audio URL for block:', blockNumber)
      // Show user feedback
      setError('Unable to play audio. Please try uploading the file again.')
    }
  }

  // Remove audio for a specific block
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

  // Generate caption for a specific block
  const generateCaption = async (blockNumber: string) => {
    const block = narrationBlocks.find(b => b.blockNumber === blockNumber)
    if (!block) return

    // For now, we'll use the narration text as the caption
    // In a real implementation, this might call an AI service or transcription service
    const captionContent = block.text

    // Start operation tracking
    const operationId = `caption-generate-${blockNumber}-${Date.now()}`
    startOperation(operationId)
    
    try {
      // Store the caption using UnifiedMediaContext
      if (storeMedia) {
        // Create a blob from the caption text
        const blob = new Blob([captionContent], { type: 'text/plain' })
        const storedItem = await storeMedia(blob, block.pageId, 'caption', {
          blockNumber: blockNumber
        })
        
        setCaptionFiles(prev => {
          // Remove any existing caption for this block
          const filtered = prev.filter(f => f.blockNumber !== blockNumber)
          // Add the new caption
          return [...filtered, {
            blockNumber: blockNumber,
            content: captionContent,
            mediaId: storedItem.id
          }]
        })
        
        logger.log(`[AudioNarrationWizard] Generated caption ${storedItem.id} for block ${blockNumber}`)
      } else {
        // Fallback if media context not available
        setCaptionFiles(prev => {
          const filtered = prev.filter(f => f.blockNumber !== blockNumber)
          return [...filtered, {
            blockNumber: blockNumber,
            content: captionContent,
            mediaId: `caption-${blockNumber}-${Date.now()}`
          }]
        })
      }
    } catch (error) {
      logger.error('Error generating caption:', error)
      setError('Failed to generate caption')
    } finally {
      endOperation(operationId)
    }
  }

  // Remove caption for a specific block
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
        
        // Get the asset URL from the stored media item
        const mediaData = await getMedia(storedItem.id)
        const url = mediaData?.url || undefined
        
        setAudioFiles(prev => {
          // Remove any existing audio for this block
          const filtered = prev.filter(f => f.blockNumber !== block.blockNumber)
          // Add the new audio
          return [...filtered, {
            blockNumber: block.blockNumber,
            file: audioFile,
            url,
            mediaId: storedItem.id
          }]
        })
        
        logger.log(`[AudioNarrationWizard] Stored recorded audio ${storedItem.id} for block ${block.blockNumber}`)
        
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
          
          // First try: createBlobUrl (preferred method)
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
            }
          } catch (e) {
            logger.warn('[AudioNarrationWizard] Failed to create blob URL:', e)
          }
          
          // Second try: getMedia for URL
          if (!url) {
            try {
              const mediaData = await getMedia(storedItem.id)
              if (mediaData?.url) {
                url = mediaData.url
                logger.log(`[AudioNarrationWizard] Got URL from getMedia for ${storedItem.id}:`, url)
              }
            } catch (e) {
              logger.warn('[AudioNarrationWizard] Failed to get media URL:', e)
            }
          }
          
          // Third try: mediaUrlService direct asset URL
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
      onSaveAs={onSaveAs}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
      onSettingsClick={onSettingsClick}
    >
      <div className={styles.bulkUploadContainer}>
        {/* Summary */}
        <Card variant="default" padding="medium">
          <h3 className={styles.bulkUploadTitle}>Narration Blocks</h3>
          <Grid cols={2} gap="medium">
            <Alert variant={audioUploaded ? 'success' : 'info'}>
              <strong>Audio Files:</strong> {audioUploaded ? `${audioFiles.length} files uploaded` : 'Not uploaded'}
            </Alert>
            <Alert variant={captionsUploaded ? 'success' : 'info'}>
              <strong>Caption Files:</strong> {captionsUploaded ? `${captionFiles.length} files uploaded` : 'Not uploaded'}
            </Alert>
          </Grid>
        </Card>

        {/* Show error if any */}
        {error && (
          <Alert variant="error">
            {error}
          </Alert>
        )}

        {/* Bulk Upload Section */}
        <Card variant="default" padding="medium">
          <h3 className={styles.bulkUploadTitle}>Bulk Audio Upload</h3>
          
          {/* Workflow Instructions */}
          <div className={styles.workflowSection}>
            <h4 className={styles.workflowTitle}>Workflow</h4>
            <Grid cols={2} gap="medium">
              <div className={styles.workflowOption}>
                <h5 className={styles.workflowOptionTitle}>
                  Option 1: Individual Recording
                </h5>
                <p className={styles.workflowOptionDescription}>
                  Record or upload audio files for each narration block individually using the controls below.
                </p>
              </div>
              <div className={styles.workflowOption}>
                <h5 className={styles.workflowOptionTitle}>
                  Option 2: Bulk Upload via Murf.ai
                </h5>
                <p className={styles.workflowOptionDescription}>
                  Download all narration text, generate audio using Murf.ai, then upload the ZIP files.
                </p>
              </div>
            </Grid>
          </div>

          {/* Download Button */}
          <div className={styles.downloadSection}>
            <Button
              onClick={downloadNarrationFile}
              variant="primary"
              data-testid="download-narration-button"
            >
              Download Narration Text
            </Button>
          </div>

          {/* Warning */}
          <Alert variant="warning">
            ⚠️ Bulk upload will replace all existing audio and caption files. Make sure you have all required files in your ZIP archive.
          </Alert>

          {/* Upload Grid */}
          <Grid cols={2} gap="large">
            {/* Audio Upload */}
            <div className={styles.uploadGridContainer}>
              <h4 className={styles.uploadSectionTitle}>
                Audio Files (.zip)
              </h4>
              <div className={styles.uploadButtonContainer}>
                <Button
                  onClick={() => document.getElementById('audio-zip-input')?.click()}
                  variant="secondary"
                  disabled={isUploading}
                  data-testid="upload-audio-zip-button"
                >
                  {isUploading ? 'Uploading...' : 'Upload Audio ZIP'}
                </Button>
                <input
                  id="audio-zip-input"
                  type="file"
                  accept=".zip"
                  onChange={handleAudioZipUpload}
                  className={styles.hiddenInput}
                  aria-label="Upload audio zip"
                  data-testid="audio-zip-input"
                />
                {uploadProgress && (
                  <div className={styles.uploadProgressContainer}>
                    <p className={styles.uploadProgressText}>
                      Uploading {uploadProgress.fileName}
                    </p>
                    <ProgressBar 
                      value={uploadProgress.percent} 
                      max={100}
                      label={`Upload progress: ${uploadProgress.percent}%`}
                    />
                  </div>
                )}
                {audioUploaded && (
                  <Alert variant="success">
                    ✓ {audioFiles.length} audio files uploaded
                  </Alert>
                )}
              </div>
            </div>

            {/* Caption Upload */}
            <div className={styles.uploadGridContainer}>
              <h4 className={styles.uploadSectionTitle}>
                Caption Files (.zip)
              </h4>
              <div className={styles.uploadButtonContainer}>
                <Button
                  onClick={() => document.getElementById('captions-zip-input')?.click()}
                  variant="secondary"
                  data-testid="upload-captions-zip-button"
                >
                  Upload Captions ZIP
                </Button>
                <input
                  id="captions-zip-input"
                  type="file"
                  accept=".zip"
                  onChange={handleCaptionZipUpload}
                  className={styles.hiddenInput}
                  aria-label="Upload captions zip"
                  data-testid="captions-zip-input"
                />
                {captionsUploaded && (
                  <Alert variant="success">
                    ✓ {captionFiles.length} caption files uploaded
                  </Alert>
                )}
              </div>
            </div>
          </Grid>

          {/* Detailed Instructions */}
          <div className={styles.instructionsSection}>
            <h4 className={styles.instructionsTitle}>
              How to use Murf.ai for professional voiceovers:
            </h4>
            
            <Grid cols={2} gap="large">
              {/* Steps */}
              <div className={styles.instructionColumn}>
                <h5 className={styles.instructionSubtitle}>
                  Step-by-step guide:
                </h5>
                <ol className={styles.instructionList}>
                  <li className={styles.instructionListItem}>
                    Download narration text using the button above
                  </li>
                  <li className={styles.instructionListItem}>
                    Go to murf.ai and create a new project
                  </li>
                  <li className={styles.instructionListItem}>
                    Upload the narration script, select "Split by paragraphs"
                  </li>
                  <li className={styles.instructionListItem}>
                    Select an appropriate voice and preview
                  </li>
                  <li className={styles.instructionListItem}>
                    <strong>For Audio:</strong>
                    <ul className={styles.instructionSubList}>
                      <li>Select Export → Voice only</li>
                      <li>Download as: Split by blocks</li>
                      <li>Format: .MP3</li>
                      <li>Quality: High</li>
                      <li>Channel: Stereo</li>
                    </ul>
                  </li>
                  <li className={styles.instructionListItem}>
                    <strong>For Captions:</strong>
                    <ul className={styles.instructionSubList}>
                      <li>Select Export → Script</li>
                      <li>Download as: Split by blocks</li>
                      <li>Format: .VTT</li>
                    </ul>
                  </li>
                  <li className={styles.instructionListItem}>
                    Upload the ZIP files here
                  </li>
                </ol>

                <h5 className={styles.instructionSubtitle}>
                  File naming convention:
                </h5>
                <div className={styles.fileNamingBox}>
                  0001-Block.mp3
                  0002-Block.mp3
                  0003-Block.mp3
                  ...
                </div>
                <p className={styles.fileNamingNote}>
                  Name your audio files exactly as shown above to match block numbers
                </p>
              </div>

              {/* Features and Tips */}
              <div className={styles.instructionColumn}>
                <h5 className={styles.instructionSubtitle}>
                  Murf.ai features:
                </h5>
                <ul className={styles.featureList}>
                  <li className={styles.featureListItem}>120+ AI voices in different accents</li>
                  <li className={styles.featureListItem}>20+ languages supported</li>
                  <li className={styles.featureListItem}>Adjustable speed and pitch</li>
                  <li className={styles.featureListItem}>Add pauses and emphasis</li>
                  <li className={styles.featureListItem}>Background music options</li>
                </ul>

                <h5 className={styles.instructionSubtitle}>
                  Tips for best results:
                </h5>
                <ul className={styles.tipsList}>
                  <li className={styles.tipsListItem}>Preview different voices before committing</li>
                  <li className={styles.tipsListItem}>Add pauses between sentences for natural flow</li>
                  <li className={styles.tipsListItem}>Use the same voice for consistent narration throughout</li>
                  <li className={styles.tipsListItem}>Export at high quality (minimum 128kbps)</li>
                </ul>
              </div>
            </Grid>
          </div>
        </Card>

        {/* Individual narration blocks */}
        <div className={styles.narrationBlocksList}>
          {narrationBlocks.map((block) => {
            const hasAudio = audioFiles.some(f => f.blockNumber === block.blockNumber)
            const hasCaption = captionFiles.some(f => f.blockNumber === block.blockNumber)
            const isEditing = editingBlockId === block.id
            
            const audioFile = audioFiles.find(f => f.blockNumber === block.blockNumber)
            const isCurrentlyPlaying = playingAudioUrl === audioFile?.url
            
            return (
              <NarrationBlockItem
                key={block.id}
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
                onRemoveAudio={() => removeAudio(block.blockNumber)}
                onGenerateCaption={() => generateCaption(block.blockNumber)}
                onPreviewCaption={() => {
                  setPreviewBlockId(block.id)
                  setShowPreview(true)
                }}
                onToggleRecording={() => handleRecordClick(block)}
                isRecording={recordingBlockId === block.id}
                recordingId={recordingBlockId}
                isPlaying={isCurrentlyPlaying}
              />
            )
          })}
        </div>

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
                  <ButtonGroup gap="medium" align="center">
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
        
        {/* Hidden TauriAudioPlayer for asset:// URL playback */}
        {playingAudioUrl && (
          <div className={styles.hiddenAudioPlayer}>
            <TauriAudioPlayer
              src={playingAudioUrl}
              controls={false}
              data-testid="hidden-audio-player"
              autoPlay={true}
              onError={(error) => {
                logger.error('[AudioNarrationWizard] TauriAudioPlayer error:', error)
                setError('Failed to play audio')
                setPlayingAudioUrl(null)
              }}
              onEnded={() => {
                setPlayingAudioUrl(null)
              }}
            />
          </div>
        )}
      </div>
    </PageLayout>
  )
}

export default AudioNarrationWizard;