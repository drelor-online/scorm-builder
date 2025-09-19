import React, { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react'
import { CourseContentUnion, CourseContent, Media, Page, Topic } from '../types/aiPrompt'
import type { MediaItem } from '../services/MediaService'
import { CourseSeedData } from '../types/course'
import { searchGoogleImages, searchYouTubeVideos, SearchError } from '../services/searchService'
import { isKnownCorsRestrictedDomain, downloadExternalImage, forceDownloadExternalImage } from '../services/externalImageDownloader'
import { PageLayout } from './PageLayout'
import { ConfirmDialog } from './ConfirmDialog'
import { AutoSaveBadge } from './AutoSaveBadge'
import { useMedia } from '../hooks/useMedia'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import { 
  Button, 
  Card, 
  Input, 
  Section,
  Flex,
  Pagination,
  Icon,
  ProgressBar,
  Modal,
  Tabs,
  Tab,
  Alert
} from './DesignSystem'
import { Upload, Image as ImageIcon, Edit, Video, Copy, Plus, Shield, Trash2, Scissors } from 'lucide-react'
import './DesignSystem/designSystem.css'
import { tokens } from './DesignSystem/designTokens'
import { PageThumbnailGrid } from './PageThumbnailGrid'
import { RichTextEditor } from './RichTextEditor'
import { debugLogger } from '../utils/ultraSimpleLogger'
import { ImageEditModal } from './ImageEditModal'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useNotifications } from '../contexts/NotificationContext'
import DOMPurify from 'dompurify'
import { logger } from '../utils/logger'
import { buildYouTubeEmbed, parseYouTubeClipTiming, extractClipTimingFromUrl } from '../services/mediaUrl'
import styles from './MediaEnhancementWizard.module.css'

interface SearchResult {
  id: string
  url: string
  title: string
  thumbnail?: string
  embedUrl?: string
  photographer?: string
  source?: string
  dimensions?: string
  views?: string
  uploadedAt?: string
  channel?: string
  duration?: string
  isYouTube?: boolean
  clipStart?: number // seconds
  clipEnd?: number   // seconds
}

interface MediaEnhancementWizardRefactoredProps {
  courseContent: CourseContentUnion
  courseSeedData?: CourseSeedData
  apiKeys?: Record<string, string>
  onUpdateContent?: (content: CourseContentUnion) => void
  onNext: (content: CourseContentUnion) => void
  onBack: () => void
  onSettingsClick?: () => void
  onHelp?: () => void
  onSave?: (content?: CourseContentUnion, silent?: boolean) => void
  onOpen?: () => void
  onStepClick?: (step: number) => void
}

// Module-local utility functions for YouTube clip timing
function parseTimeToSeconds(s?: string | null): number | undefined {
  if (!s) return undefined
  if (/^\d+$/.test(s)) return Number(s)
  const p = s.split(':').map(Number)
  if (p.some(Number.isNaN)) return undefined
  const [h, m, sec] = p.length === 3 ? p : [0, p[0] || 0, p[1] || 0]
  return h * 3600 + m * 60 + sec
}


// Helper to safely extract page IDs from course content
const getPageId = (content: Page | Topic | undefined): string => {
  if (!content) return ''
  if ('id' in content && content.id) return content.id
  return ''
}

// Helper to extract media from a page
const _getPageMedia = (page: Page | Topic | undefined): Media[] => {
  if (!page) return []
  
  // For pages with media array
  if ('media' in page && Array.isArray(page.media)) {
    return page.media || []
  }
  
  // For pages with mediaReferences
  if ('mediaReferences' in page && Array.isArray(page.mediaReferences)) {
    return page.mediaReferences || []
  }
  
  return []
}

// Helper to update page media
const setPageMedia = (page: Page | Topic | undefined, media: Media[]): Page | Topic | undefined => {
  if (!page) return page
  
  const updated = { ...page }
  
  // Always set media array directly (don't check if property exists)
  // This ensures media is added even if the page didn't have a media property initially
  updated.media = media
  
  // Also set mediaReferences if needed for compatibility
  if ('mediaReferences' in updated) {
    updated.mediaReferences = media
  }
  
  // console.log(`[setPageMedia] Updated page ${updated.id} with ${media.length} media items`)
  
  return updated
}

// Helper to validate and fix courseContent structure
const validateCourseContent = (content: CourseContentUnion): CourseContent => {
  if (!content || typeof content !== 'object') {
    logger.warn('[MediaEnhancementWizard] Invalid courseContent received, using default structure')
    return {
      welcomePage: { 
        id: 'welcome', 
        title: 'Welcome', 
        content: '', 
        narration: '', 
        imageKeywords: [], 
        imagePrompts: [], 
        videoSearchTerms: [], 
        duration: 0 
      },
      learningObjectivesPage: { 
        id: 'objectives', 
        title: 'Learning Objectives', 
        content: '', 
        narration: '', 
        imageKeywords: [], 
        imagePrompts: [], 
        videoSearchTerms: [], 
        duration: 0 
      },
      topics: [],
      assessment: { questions: [], passMark: 80, narration: null }
    }
  }
  
  // Ensure topics is an array
  const validatedContent = { ...content } as CourseContent
  if (!Array.isArray(validatedContent.topics)) {
    logger.warn('[MediaEnhancementWizard] courseContent.topics is not an array, defaulting to empty array')
    validatedContent.topics = []
  }
  
  return validatedContent
}

// Helper function for time formatting (moved outside component for shared access)
const formatSecondsToTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Enhanced Clip Timing Display Component
interface EnhancedClipTimingDisplayProps {
  media: any
  styles: any
}

const EnhancedClipTimingDisplay: React.FC<EnhancedClipTimingDisplayProps> = ({ 
  media, 
  styles 
}) => {
  // 🔍 DEBUG: Log every call to this component
  console.log('🎬 [EnhancedClipTimingDisplay] Component called with:', {
    hasMedia: !!media,
    mediaId: media?.id,
    mediaType: media?.type,
    isYouTube: media?.isYouTube,
    clipStart: media?.clipStart,
    clipEnd: media?.clipEnd,
    hasClipTiming: !!(media?.clipStart !== undefined || media?.clipEnd !== undefined),
    allMediaKeys: media ? Object.keys(media) : [],
    willRender: !(!media || (media.clipStart === undefined && media.clipEnd === undefined)),
    // Include raw field values to check for snake_case vs camelCase issues
    clip_start: media?.clip_start,
    clip_end: media?.clip_end,
    timestamp: new Date().toISOString(),
    stackTrace: new Error().stack?.split('\n')[2]?.trim()
  })

  // Only render for media with clip timing data
  if (!media || (media.clipStart === undefined && media.clipEnd === undefined)) {
    console.log('🚫 [EnhancedClipTimingDisplay] NOT rendering - missing media or clip timing data')
    return null
  }
  
  console.log('✅ [EnhancedClipTimingDisplay] RENDERING clip timing display')
  
  return (
    <div className={styles.clipTimingDisplay} data-testid="clip-timing-display">
      <div className={styles.clipTimingTitle}>
        <Icon icon={Scissors} size="sm" />
        <span>Video Clip Timing</span>
      </div>
      <div className={styles.clipTimingValues}>
        <span className={styles.timingValue}>
          Start: {media.clipStart !== undefined ? formatSecondsToTime(media.clipStart) : '--'}
        </span>
        <span className={styles.timingDivider}>•</span>
        <span className={styles.timingValue}>
          End: {media.clipEnd !== undefined ? formatSecondsToTime(media.clipEnd) : '--'}
        </span>
      </div>
    </div>
  )
}

const MediaEnhancementWizard: React.FC<MediaEnhancementWizardRefactoredProps> = ({
  courseContent,
  courseSeedData,
  apiKeys,
  onUpdateContent,
  onNext,
  onBack,
  onSettingsClick,
  onHelp,
  onSave,
  onOpen,
  onStepClick
}) => {
  const { success, error: notifyError, info } = useNotifications()
  const { markDirty, resetDirty } = useUnsavedChanges()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isPaginationLoading, setIsPaginationLoading] = useState(false)
  const [addingMediaIds, setAddingMediaIds] = useState<Set<string>>(new Set())
  const [lightboxMedia, setLightboxMedia] = useState<SearchResult | null>(null)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [clipStart, setClipStart] = useState<number | undefined>(undefined)
  const [clipEnd, setClipEnd] = useState<number | undefined>(undefined)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [mediaSource, setMediaSource] = useState<'search' | 'upload'>('search')
  const [uploadedMedia, setUploadedMedia] = useState<SearchResult[]>([])
  const [imagePromptSuggestions, setImagePromptSuggestions] = useState<string[]>([])
  const [videoPromptSuggestions, setVideoPromptSuggestions] = useState<string[]>([])
  const mediaItemsRef = useRef<Map<string, Media>>(new Map())
  const [existingPageMedia, setExistingPageMedia] = useState<Media[]>([])
  
  // Cache for enriched YouTube metadata to prevent excessive getMedia() calls
  const enrichedMetadataCacheRef = useRef<Map<string, any>>(new Map())
  
  // State for enriched metadata (used for YouTube URL enrichment)
  const [enrichedMetadata, setEnrichedMetadata] = useState<Map<string, any>>(new Map())
  
  // State for contamination cleanup
  const [isCleaningContamination, setIsCleaningContamination] = useState(false)
  const [contaminationDetected, setContaminationDetected] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [forceDownloadMode, setForceDownloadMode] = useState<boolean>(false)
  const [contentHistory, setContentHistory] = useState<{ [key: string]: Page | Topic }>({})
  const [hasSearched, setHasSearched] = useState(false)
  const [existingMediaIdMap, setExistingMediaIdMap] = useState<Map<string, string>>(new Map())

  // State for image loading timeout mechanism
  const [loadingTimeouts, setLoadingTimeouts] = useState<Set<string>>(new Set())
  const currentlyLoadingRef = useRef<Set<string>>(new Set())
  const [youtubeMessage, setYoutubeMessage] = useState<string | null>(null)
  const [stickyReminders, setStickyReminders] = useState<Set<string>>(new Set())
  const [replaceMode, setReplaceMode] = useState<{ id: string; title: string } | null>(null)
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; title: string } | null>(null)
  const [triggerSearch, setTriggerSearch] = useState(false)
  const [videoThumbnails, setVideoThumbnails] = useState<{ [key: string]: string }>({})
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set())
  const fileInputIdRef = useRef<string>('media-upload')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isFileProcessing, setIsFileProcessing] = useState(false)
  // AbortController to handle concurrent uploads and component unmounting
  const uploadAbortControllerRef = useRef<AbortController | null>(null)
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 })
  const [videoContainerReady, setVideoContainerReady] = useState(false)
  const [previewMediaId, setPreviewMediaId] = useState<string | null>(null)
  
  // FIX: Track current page index with ref to prevent stale closures in async operations
  const currentPageIndexRef = useRef(currentPageIndex)
  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex
  }, [currentPageIndex])
  
  // RENDER LOOP FIX: Page-based gating with sequence tokens to prevent courseContent dependency loops
  const loadSeqRef = useRef(0)
  const pageId = useMemo(() => {
    if (currentPageIndex === 0) return 'welcome'
    if (currentPageIndex === 1) return 'learning-objectives'  
    return `topic-${currentPageIndex - 2}`
  }, [currentPageIndex])
  
  // Reset video container ready state when preview media changes
  useEffect(() => {
    setVideoContainerReady(false)
  }, [previewMediaId])
  
  const [uploadProgress, setUploadProgress] = useState<{
    current: number
    total: number
    fileName: string
    percent: number
  } | null>(null)
  const [recentlyUploadedIds, setRecentlyUploadedIds] = useState<Set<string>>(new Set())
  const [resultPage, setResultPage] = useState(1)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [editingImage, setEditingImage] = useState<{ id: string; title: string; url: string } | null>(null)
  const resultsPerPage = 12
  const [replaceConfirmDetails, setReplaceConfirmDetails] = useState<{
    existingMedia: Media
    newSearchResult: SearchResult
  } | null>(null)
  const [isEditingContent, setIsEditingContent] = useState(false)
  const [activeTab, setActiveTab] = useState<'images' | 'videos' | 'upload' | 'ai'>('images')
  
  // FIX: Use ref to always have access to latest course content
  // This prevents stale closure issues when onNext is called
  const courseContentRef = useRef(courseContent)
  useEffect(() => {
    courseContentRef.current = courseContent
  }, [courseContent])


  // Load force download mode preference from localStorage
  useEffect(() => {
    const savedForceDownload = localStorage.getItem('scorm_builder_force_download_mode')
    if (savedForceDownload !== null && savedForceDownload !== 'undefined') {
      try {
        setForceDownloadMode(JSON.parse(savedForceDownload))
      } catch (err) {
        console.warn('[MediaEnhancement] Failed to parse force download mode from localStorage:', err)
      }
    }
  }, [])
  
  const media = useMedia()
  
  // Extract commonly used methods for cleaner code
  const {
    storeMedia,
    storeYouTubeVideo,
    updateYouTubeVideoMetadata,
    deleteMedia,
    populateFromCourseContent,
    createBlobUrl,
    cleanupContaminatedMedia,
    setLoadingProfile
  } = media.actions
  
  const {
    getMedia,
    getValidMediaForPage,
    loadingProfile
  } = media.selectors
  
  const storage = useStorage()

  // YouTube URL enrichment effect - fetch enriched metadata for YouTube videos that need it
  useEffect(() => {
    const enrichYouTubeMetadata = async () => {
      if (!existingPageMedia || existingPageMedia.length === 0) return
      
      const youtubeVideosNeedingEnrichment = existingPageMedia.filter(media => {
        // Only process YouTube videos
        if (!((media.type === 'video' || media.type === 'youtube') && media.isYouTube)) return false
        
        // Check if basic metadata has YouTube URLs
        const hasBasicUrl = !!((media as any).youtubeUrl || media.embedUrl || media.url ||
                              (media as any).metadata?.youtubeUrl ||
                              (media as any).metadata?.embedUrl ||
                              (media as any).metadata?.url)
        
        // Only enrich if no basic URL and not already cached
        return !hasBasicUrl && !enrichedMetadata.get(media.id)
      })
      
      if (youtubeVideosNeedingEnrichment.length === 0) return
      
      console.log('[MediaEnhancement] 🔄 Fetching enriched metadata for YouTube videos:', 
        youtubeVideosNeedingEnrichment.map(m => m.id))
      
      // Process each video that needs enrichment
      for (const media of youtubeVideosNeedingEnrichment) {
        try {
          console.log('[MediaEnhancement] 📡 Calling getMedia() for enrichment:', media.id)
          const enrichedData = await getMedia(media.id)
          
          if (enrichedData?.metadata) {
            // Cache the enriched metadata
            setEnrichedMetadata(prev => new Map(prev.set(media.id, enrichedData)))
            
            console.log('[MediaEnhancement] ✅ Cached enriched metadata for:', media.id, {
              enrichedYoutubeUrl: enrichedData.metadata.youtubeUrl,
              enrichedEmbedUrl: enrichedData.metadata.embedUrl,
              enrichedDirectUrl: enrichedData.url
            })
          } else {
            console.warn('[MediaEnhancement] ⚠️ No enriched metadata available for:', media.id)
          }
        } catch (error) {
          console.error('[MediaEnhancement] ❌ Failed to fetch enriched metadata for:', media.id, error)
        }
      }
    }
    
    enrichYouTubeMetadata()
  }, [existingPageMedia])
  
  // console.log('[MediaEnhancement] Component render - UnifiedMedia ready')
  
  // Track blob URLs (using state to persist across re-renders)
  const [blobUrls, setBlobUrls] = useState<Map<string, string>>(new Map())
  
  // Local state for YouTube clip time inputs to prevent re-render during typing
  const [activeTimeInputs, setActiveTimeInputs] = useState<Map<string, { start?: string; end?: string }>>(new Map())
  // Note: focusedInput removed - no longer needed after removing inline editor
  
  // INPUT VALUE PRESERVATION: Backup state to prevent complete value loss
  const [lastKnownGoodValues, setLastKnownGoodValues] = useState<Map<string, { start?: number; end?: number }>>(new Map())
  
  // LIGHTBOX CLIP TIMING: Controlled state for start/end text inputs
  const [startText, setStartText] = useState<string>('')
  const [endText, setEndText] = useState<string>('')
  
  // PENDING CLIP UPDATES: State for deferred persistence to fix render-phase updates
  const [pendingClip, setPendingClip] = useState<null | {
    pageId: string
    mediaId: string
    clipStart?: number
    clipEnd?: number
    embedUrl: string
  }>(null)

  // MEDIA CLEARING FIX: Track when we're updating clip timing to avoid unnecessary media reloading
  const [isUpdatingClipTiming, setIsUpdatingClipTiming] = useState(false)
  const isUpdatingClipTimingRef = useRef(false)
  
  // Clear any stale blob URLs on mount to force regeneration
  useEffect(() => {
    // Clear on mount to ensure fresh blob URLs for new session
    setBlobUrls(new Map())
    
    // Cleanup on unmount - but DO NOT revoke blob URLs
    return () => {
      // DO NOT revoke blob URLs here!
      // Blob URLs are cached and shared across multiple components
      // The UnifiedMediaContext manages the blob URL cache globally
      setBlobUrls(new Map())
    }
  }, [])
  
  // PERFORMANCE OPTIMIZATION: Set visual-only loading profile for Media step
  useEffect(() => {
    console.log('[MediaEnhancement] 🚀 Setting visual-only loading profile for Media step')
    console.log('[MediaEnhancement] 🔍 PROFILE DEBUG: setLoadingProfile function available:', !!setLoadingProfile)
    setLoadingProfile?.('visual-only')
    console.log('[MediaEnhancement] ✅ PROFILE DEBUG: Called setLoadingProfile("visual-only")')
    
    return () => {
      console.log('[MediaEnhancement] 🔄 Restoring all loading profile on unmount')
      setLoadingProfile?.('all')
    }
  }, [setLoadingProfile])
  
  // 🔧 CONTAMINATION CLEANUP: Clean any contaminated media on component mount
  // 🚀 FIX 7: SKIP CLEANUP IN VISUAL-ONLY MODE (prevents backend audio/caption scanning)
  useEffect(() => {
    const runContaminationCleanup = async () => {
      try {
        // 🚀 FIX 7: Skip contamination cleanup in visual-only mode
        // This prevents the backend from scanning audio/caption files during Media Enhancement
        if (loadingProfile === 'visual-only') {
          console.log('[MediaEnhancement] 🚀 FIX 7: SKIPPING contamination cleanup in visual-only mode')
          console.log('[MediaEnhancement] ✅ Audio/caption files will not be scanned - backend scanning prevented!')
          return
        }
        
        console.log('[MediaEnhancement] 🧹 Running contamination cleanup on startup...')
        const result = await cleanupContaminatedMedia(null)
        
        if (result.removedMediaIds.length > 0) {
          console.log('[MediaEnhancement] ✅ Cleaned contaminated media:', result.removedMediaIds)
          // Show success notification to user
          success(`Cleaned ${result.removedMediaIds.length} contaminated media items`)
        }
        
        if (result.errors.length > 0) {
          console.error('[MediaEnhancement] ❌ Cleanup errors:', result.errors)
          result.errors.forEach((error: string) => console.error(`Cleanup error: ${error}`))
        }
        
        if (result.removedMediaIds.length === 0 && result.errors.length === 0) {
          console.log('[MediaEnhancement] ✅ No contaminated media found - all clean!')
        }
      } catch (error) {
        console.error('[MediaEnhancement] ❌ Failed to run contamination cleanup:', error)
      }
    }
    
    // Run cleanup after a short delay to allow media context to initialize
    const cleanupTimer = setTimeout(runContaminationCleanup, 1000)
    return () => clearTimeout(cleanupTimer)
  }, [cleanupContaminatedMedia, success, loadingProfile])
  
  // 🚨 CONTAMINATION DETECTION: Check for contamination in loaded media
  useEffect(() => {
    const checkForContamination = () => {
      const hasContamination = existingPageMedia.some(media => {
        const metadata = (media as any).metadata || {}
        
        // Only flag NON-VIDEO media that has YouTube properties (true contamination)
        // Videos and YouTube types are ALLOWED to have YouTube properties
        if (media.type !== 'video' && media.type !== 'youtube') {
          const mediaAny = media as any
          const isContaminated = metadata.source === 'youtube' ||
                                 metadata.embed_url ||
                                 metadata.clip_start !== undefined ||
                                 metadata.clip_end !== undefined ||
                                 mediaAny.embedUrl ||
                                 (mediaAny.clipStart !== undefined && mediaAny.clipStart !== null) ||
                                 (mediaAny.clipEnd !== undefined && mediaAny.clipEnd !== null) ||
                                 mediaAny.isYouTube === true
          return isContaminated
        }
        return false
      })
      setContaminationDetected(hasContamination)
      
      if (hasContamination) {
        console.log('[MediaEnhancement] 🚨 CONTAMINATION DETECTED in current page media')
      } else {
        console.log('[MediaEnhancement] ✅ No contamination detected - all media types are valid')
      }
    }
    
    checkForContamination()
  }, [existingPageMedia])
  
  // Manual media issues cleanup handler - now uses orphaned media references cleanup
  const handleManualContaminationCleanup = useCallback(async () => {
    debugLogger.info('MEDIA_CLEANUP', 'Starting manual contamination cleanup', {
      currentPage: getCurrentPage()?.id || `index-${currentPageIndex}`,
      hasContamination: contaminationDetected,
      totalMediaLoaded: existingPageMedia.length
    })
    
    setIsCleaningContamination(true)
    
    try {
      console.log('[MediaEnhancement] 🧹 Running MANUAL media issues cleanup with orphaned references...')
      
      // Import the cleanup utility
      const { cleanupOrphanedMediaReferences } = await import('../utils/orphanedMediaCleaner')
      
      // Create media existence checker using getMedia from UnifiedMediaContext
      const mediaExistsChecker = async (mediaId: string) => {
        try {
          const mediaResult = await getMedia(mediaId)
          return mediaResult !== null && mediaResult !== undefined
        } catch {
          return false
        }
      }
      
      // Get current course content
      if (!courseContent) {
        notifyError('No course content available for cleanup')
        return
      }
      
      // Run cleanup on course content
      const cleanupResult = await cleanupOrphanedMediaReferences(courseContent, mediaExistsChecker)
      
      if (cleanupResult.removedMediaIds.length > 0) {
        debugLogger.info('MEDIA_CLEANUP', 'Manual contamination cleanup completed', {
          removedMediaIds: cleanupResult.removedMediaIds,
          removedCount: cleanupResult.removedMediaIds.length,
          currentPage: getCurrentPage()?.id || `index-${currentPageIndex}`
        })
        
        console.log('[MediaEnhancement] ✅ Manual cleanup successful:', cleanupResult.removedMediaIds)
        success(`Successfully cleaned ${cleanupResult.removedMediaIds.length} orphaned media references`)
        
        // Update course content with cleaned version
        if (onUpdateContent && cleanupResult.cleanedContent) {
          onUpdateContent(cleanupResult.cleanedContent)
          console.log('[MediaEnhancement] ✅ Course content updated with cleaned version')
        }
        
        // Trigger save if available
        if (onSave) {
          onSave()
          console.log('[MediaEnhancement] ✅ Course content saved after cleanup')
        }
      } else {
        success('No orphaned media references found - all media references are valid!')
      }
    } catch (err) {
      console.error('[MediaEnhancement] ❌ Manual cleanup failed:', err)
      notifyError('Failed to clean media issues. Please try again or check console for details.')
    } finally {
      setIsCleaningContamination(false)
    }
  }, [courseContent, getMedia, onUpdateContent, onSave, success, notifyError])
  
  // PENDING CLIP PROCESSING: Effect to handle deferred clip timing updates
  useEffect(() => {
    if (!pendingClip) return
    
    
    // Find and update the media item with clip timing
    if (!courseContent || !onUpdateContent) {
      setPendingClip(null)
      return
    }
    
    const content = courseContent as CourseContent
    const updatedContent = structuredClone(content)
    
    
    // Find the page and update the specific media item
    let pageFound = false
    if (pendingClip.pageId === 'welcome' && updatedContent.welcomePage?.media) {
      const mediaIndex = updatedContent.welcomePage.media.findIndex((m: any) => m.id === pendingClip.mediaId)
      console.log('🔍 [PENDING CLIP DEBUG] Welcome page search:', {
        searchingForMediaId: pendingClip.mediaId,
        foundIndex: mediaIndex,
        existingMediaAtIndex: mediaIndex !== -1 ? updatedContent.welcomePage.media[mediaIndex] : null
      })
      if (mediaIndex !== -1) {
        const beforeUpdate = updatedContent.welcomePage.media[mediaIndex]
        updatedContent.welcomePage.media[mediaIndex] = {
          ...updatedContent.welcomePage.media[mediaIndex],
          clipStart: pendingClip.clipStart,
          clipEnd: pendingClip.clipEnd,
          embedUrl: pendingClip.embedUrl
        }
        console.log('🔍 [PENDING CLIP DEBUG] Updated welcome page media:', {
          mediaId: beforeUpdate.id,
          mediaType: beforeUpdate.type || 'unknown',
          beforeUpdate,
          afterUpdate: updatedContent.welcomePage.media[mediaIndex]
        })
        pageFound = true
      }
    } else if (pendingClip.pageId === 'objectives' && updatedContent.learningObjectivesPage?.media) {
      const mediaIndex = updatedContent.learningObjectivesPage.media.findIndex((m: any) => m.id === pendingClip.mediaId)
      if (mediaIndex !== -1) {
        updatedContent.learningObjectivesPage.media[mediaIndex] = {
          ...updatedContent.learningObjectivesPage.media[mediaIndex],
          clipStart: pendingClip.clipStart,
          clipEnd: pendingClip.clipEnd,
          embedUrl: pendingClip.embedUrl
        }
        pageFound = true
      }
    } else {
      // Check topics
      const topicIndex = updatedContent.topics?.findIndex(t => t.id === pendingClip.pageId)
      console.log('🔍 [PENDING CLIP DEBUG] Topic search:', {
        searchingForPageId: pendingClip.pageId,
        foundTopicIndex: topicIndex,
        topicIds: updatedContent.topics?.map(t => t.id) || []
      })
      if (topicIndex !== -1 && updatedContent.topics?.[topicIndex]?.media) {
        const mediaIndex = updatedContent.topics[topicIndex].media!.findIndex(m => m.id === pendingClip.mediaId)
        console.log('🔍 [PENDING CLIP DEBUG] Topic media search:', {
          topicId: updatedContent.topics[topicIndex].id,
          searchingForMediaId: pendingClip.mediaId,
          foundMediaIndex: mediaIndex,
          topicMediaIds: updatedContent.topics[topicIndex].media!.map(m => m.id)
        })
        if (mediaIndex !== -1) {
          const beforeUpdate = updatedContent.topics[topicIndex].media![mediaIndex]
          updatedContent.topics![topicIndex].media![mediaIndex] = {
            ...updatedContent.topics![topicIndex].media![mediaIndex],
            clipStart: pendingClip.clipStart,
            clipEnd: pendingClip.clipEnd,
            embedUrl: pendingClip.embedUrl
          }
          console.log('🔍 [PENDING CLIP DEBUG] Updated topic media:', {
            topicId: updatedContent.topics[topicIndex].id,
            mediaId: beforeUpdate.id,
            mediaType: beforeUpdate.type || 'unknown',
            beforeUpdate,
            afterUpdate: updatedContent.topics[topicIndex].media![mediaIndex]
          })
          pageFound = true
        }
      }
    }
    
    if (pageFound) {
      onUpdateContent(updatedContent)
    }
    
    setPendingClip(null)
  }, [pendingClip, courseContent, onUpdateContent])
  
  // CLIP INPUT INITIALIZATION: Populate start/end inputs when lightbox opens
  useEffect(() => {
    if (isLightboxOpen && lightboxMedia) {
      // Populate inputs from existing clip values
      const formatSecondsToText = (seconds?: number): string => {
        if (seconds === undefined || seconds === null) return ''
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : seconds.toString()
      }
      
      let startTime = lightboxMedia.clipStart
      let endTime = lightboxMedia.clipEnd
      
      // Fallback: parse timing from existing embedUrl if clipStart/clipEnd not available
      if ((startTime === undefined || endTime === undefined) && lightboxMedia.embedUrl) {
        const parsed = parseYouTubeClipTiming(lightboxMedia.embedUrl)
        startTime = startTime ?? parsed.start
        endTime = endTime ?? parsed.end
      }
      
      setStartText(formatSecondsToText(startTime))
      setEndText(formatSecondsToText(endTime))
    } else if (!isLightboxOpen) {
      // Clear inputs when lightbox closes
      setStartText('')
      setEndText('')
    }
  }, [isLightboxOpen, lightboxMedia?.clipStart, lightboxMedia?.clipEnd, lightboxMedia?.embedUrl])
  
  // FIX: Properly track and manage blob URLs to prevent memory leaks
  const createTrackedBlobUrl = (blob: Blob, key: string): string => {
    // Check for existing URL
    const existingUrl = blobUrls.get(key)
    if (existingUrl) {
      // DO NOT revoke the existing URL - it may still be in use
      // Just return the existing URL instead of creating a new one
      return existingUrl
    }
    
    // Create new URL for temporary blob
    // Note: For temporary upload blobs, we must use URL.createObjectURL
    // The UnifiedMediaContext's createBlobUrl is for stored media IDs
    const url = URL.createObjectURL(blob)
    setBlobUrls(prev => {
      const newMap = new Map(prev)
      newMap.set(key, url)
      return newMap
    })
    
    // This URL will be cleaned up in the useEffect cleanup function
    return url
  }
  
  const totalPages = courseContent ? 
    2 + ((courseContent as CourseContent).topics?.length || 0) : 
    0
  
  // PERFORMANCE: Memoized course content validation
  const validatedCourseContent = React.useMemo(() => {
    return validateCourseContent(courseContent)
  }, [courseContent])
  
  const getCurrentPage = React.useCallback((): Page | Topic | undefined => {
    if (!courseContent) return undefined
    
    const content = courseContent as CourseContent
    
    if (currentPageIndex === 0) return content.welcomePage
    if (currentPageIndex === 1) return content.learningObjectivesPage
    
    const topicIndex = currentPageIndex - 2
    if (content.topics && topicIndex >= 0 && topicIndex < content.topics.length) {
      return content.topics[topicIndex]
    }
    
    return undefined
  }, [currentPageIndex, courseContent])
  
  const getCurrentPageTitle = React.useMemo((): string => {
    const page = getCurrentPage()
    if (!page) return 'Unknown Page'
    
    if ('title' in page) return page.title || 'Untitled'
    if (currentPageIndex === 1) return 'Learning Objectives'
    
    return 'Page'
  }, [getCurrentPage, currentPageIndex])
  
  // PERFORMANCE: Memoized current page media extraction
  const currentPageMedia = React.useMemo(() => {
    const page = getCurrentPage()
    return _getPageMedia(page)
  }, [getCurrentPage])
  
  // PERFORMANCE: Memoize array combinations to prevent expensive recalculation on every render
  const searchResultsArray = useMemo(() => 
    Array.isArray(searchResults) ? searchResults : [], 
    [searchResults]
  )
  const uploadedMediaArray = useMemo(() => 
    Array.isArray(uploadedMedia) ? uploadedMedia : [], 
    [uploadedMedia]
  )
  const displayedResults = useMemo(() => 
    [...searchResultsArray, ...uploadedMediaArray], 
    [searchResultsArray, uploadedMediaArray]
  )
  
  // PREVIEW URL COMPUTATION: Dynamic clip-aware preview URL for lightbox
  const previewUrl = useMemo(() => {
    if (!lightboxMedia?.isYouTube) {
      return lightboxMedia?.embedUrl || lightboxMedia?.url || ''
    }

    // Use direct clipStart/clipEnd state for immediate preview updates
    const url = buildYouTubeEmbed(
      lightboxMedia.url || lightboxMedia.embedUrl || '',
      clipStart,
      clipEnd
    )

    // Validate the URL is a proper embed URL or safe fallback
    if (!url || url === 'about:blank') {
      console.error('[MediaEnhancement] Invalid YouTube embed URL generated:', {
        originalUrl: lightboxMedia.url || lightboxMedia.embedUrl,
        generatedUrl: url,
        clipStart,
        clipEnd
      })
      return 'about:blank' // Safe fallback that won't cause iframe errors
    }

    // Ensure it's a proper YouTube embed URL
    if (!url.includes('/embed/') && !url.startsWith('about:')) {
      console.error('[MediaEnhancement] Generated URL is not a proper embed URL:', url)
      return 'about:blank' // Safe fallback instead of potentially problematic URL
    }

    return url
  }, [lightboxMedia?.url, lightboxMedia?.embedUrl, lightboxMedia?.isYouTube, clipStart, clipEnd])
  
  // PERFORMANCE: Memoize existing media items to prevent expensive re-rendering
  const getMediaType = (page: Page | Topic | undefined): 'image' | 'video' => {
    if (!page) return 'image'
    
    if ('videoSearchTerms' in page && Array.isArray(page.videoSearchTerms) && page.videoSearchTerms.length > 0) {
      return 'video'
    }
    return 'image'
  }

  // Handle clicking on search results to open lightbox preview
  const handleMediaPreview = useCallback((resultId: string) => {
    const result = displayedResults.find(r => r.id === resultId)
    if (!result) return
    
    // Initialize clip timing from existing values or parse from embed URL
    if (result.isYouTube) {
      if (result.clipStart !== undefined || result.clipEnd !== undefined) {
        // Use existing clip timing from the result
        setClipStart(result.clipStart)
        setClipEnd(result.clipEnd)
      } else if (result.embedUrl) {
        // Parse clip timing from embed URL
        const { start, end } = parseYouTubeClipTiming(result.embedUrl)
        setClipStart(start)
        setClipEnd(end)
      } else {
        // Reset to undefined for new YouTube videos
        setClipStart(undefined)
        setClipEnd(undefined)
      }
    } else {
      // Reset for non-YouTube media
      setClipStart(undefined)
      setClipEnd(undefined)
    }
    
    setLightboxMedia(result)
    setIsLightboxOpen(true)
  }, [displayedResults])
  
  // Single commit path for YouTube clip timing changes
  const commitClipTiming = useCallback(async () => {
    if (!lightboxMedia) return
    
    const page = getCurrentPage()
    if (!page) return

    const s = startText ? parseTimeToSeconds(startText) : lightboxMedia.clipStart
    const e = endText ? parseTimeToSeconds(endText) : lightboxMedia.clipEnd

    // 🔧 FIX: Use enriched metadata as fallback for YouTube URL
    let embedUrl = lightboxMedia.embedUrl
    if (lightboxMedia.isYouTube) {
      // Try to get URL from lightboxMedia first, then fall back to enriched metadata
      const primaryUrl = lightboxMedia.url || lightboxMedia.embedUrl
      const enriched = enrichedMetadata.get(lightboxMedia.id)
      const fallbackUrl = enriched?.metadata?.youtubeUrl || enriched?.metadata?.embedUrl || ''

      const youtubeUrl = primaryUrl || fallbackUrl
      embedUrl = buildYouTubeEmbed(youtubeUrl, s, e)

      console.log('🔍 [CLIP DEBUG] commitClipTiming URL resolution:', {
        mediaId: lightboxMedia.id,
        primaryUrl,
        fallbackUrl,
        finalYoutubeUrl: youtubeUrl,
        finalEmbedUrl: embedUrl,
        hasEnrichedMetadata: !!enriched
      })
    }

    const embed = embedUrl

    debugLogger.info('YOUTUBE_CLIP', 'Committing YouTube clip timing changes', {
      mediaId: lightboxMedia.id,
      title: lightboxMedia.title,
      pageId: getCurrentPage()?.id || `index-${currentPageIndex}`,
      clipStart: s,
      clipEnd: e,
      isYouTube: lightboxMedia.isYouTube,
      hasValidTiming: (s !== undefined && s >= 0) || (e !== undefined && e >= 0)
    })

    console.log('[MediaEnhancement] 🎬 Committing clip timing:', {
      mediaId: lightboxMedia.id,
      title: lightboxMedia.title,
      clipStart: s,
      clipEnd: e,
      embedUrl: embed
    })

    // 1) Update in-memory current page media (no reordering)
    const updated = existingPageMedia.map(m =>
      m.id === lightboxMedia.id ? { ...m, clipStart: s, clipEnd: e, embedUrl: embed } : m
    )
    setExistingPageMedia(updated)

    // 2) Update CourseContent via deferred effect path
    setPendingClip({ 
      pageId: getPageId(page), 
      mediaId: lightboxMedia.id, 
      clipStart: s, 
      clipEnd: e, 
      embedUrl: embed || lightboxMedia.embedUrl || lightboxMedia.url || ''
    })

    // 3) Persist to storage metadata so timing hydrates next session
    const stored = existingPageMedia.find(m => m.id === lightboxMedia.id)
    
    console.log('🔍 [CLIP DEBUG] commitClipTiming - Checking persistence conditions:', {
      mediaId: lightboxMedia.id,
      existingPageMediaCount: existingPageMedia.length,
      existingPageMediaIds: existingPageMedia.map(m => m.id),
      stored: stored ? 'found' : 'NOT FOUND',
      storageId: stored?.storageId,
      hasStorageId: !!stored?.storageId,
      storedItem: stored
    })
    
    if (stored?.storageId) {
      console.log('🔍 [CLIP DEBUG] About to call updateYouTubeVideoMetadata with:', {
        storageId: stored.storageId,
        updates: { clipStart: s, clipEnd: e, embedUrl: embed }
      })
      
      try {
        await updateYouTubeVideoMetadata(stored.storageId, { 
          clipStart: s, 
          clipEnd: e, 
          embedUrl: embed 
        })
        console.log('[MediaEnhancement] ✅ Persisted clip timing to storage')
      } catch (error) {
        console.error('[MediaEnhancement] ❌ Failed to persist clip timing:', error)
      }
    } else {
      console.error('🔍 [CLIP DEBUG] PERSISTENCE SKIPPED - stored item not found or no storageId:', {
        stored: !!stored,
        storageId: stored?.storageId,
        lightboxMediaId: lightboxMedia.id,
        availableIds: existingPageMedia.map(m => ({ id: m.id, storageId: m.storageId }))
      })
    }

    // 4) Close modal + clear inputs
    setIsLightboxOpen(false)
    setStartText('')
    setEndText('')
    setLightboxMedia(null)
    setClipStart(undefined)
    setClipEnd(undefined)

    console.log('[MediaEnhancement] ✅ Clip timing commit completed')
  }, [lightboxMedia, existingPageMedia, startText, endText, getCurrentPage, getPageId, updateYouTubeVideoMetadata, setPendingClip, buildYouTubeEmbed, parseTimeToSeconds, setExistingPageMedia, setIsLightboxOpen, setStartText, setEndText, setLightboxMedia, setClipStart, setClipEnd])

  // Handle lightbox actions
  const handleLightboxConfirm = async () => {
    if (!lightboxMedia) return
    
    // Check if we're editing existing media or adding new media
    const isEditingExistingMedia = existingPageMedia.some(media => media.id === lightboxMedia.id)
    const hasExistingMedia = existingPageMedia && existingPageMedia.length > 0
    
    if (isEditingExistingMedia) {
      // Use the single commit path for clip timing changes
      await commitClipTiming()
      return
    }
    
    // Close lightbox for new media addition
    setIsLightboxOpen(false)
    
    if (hasExistingMedia) {
      // Delete existing media first, then add new (same as handleReplaceConfirm)
      console.log('[MediaEnhancement] Deleting existing media before replacement:', existingPageMedia)
      for (const media of existingPageMedia) {
        try {
          console.log('[MediaEnhancement] Deleting existing media:', media.id, media.type)
          
          // DEFENSIVE LOGGING: Track what's causing video deletion
          console.error('🚨 [DELETION DEBUG] Video deletion triggered from addMediaToPage!', {
            mediaId: media.id,
            storageId: media.storageId,
            mediaType: media.type,
            stackTrace: new Error().stack,
            timestamp: new Date().toISOString()
          })
          
          // Delete from storage using the same method as handleReplaceConfirm
          if (media.storageId) {
            await deleteMedia(media.storageId)
            // Clear enriched metadata cache
            enrichedMetadataCacheRef.current.delete(media.storageId)
          } else {
            // Fallback to media.id if no storageId
            await deleteMedia(media.id)
            // Clear enriched metadata cache
            enrichedMetadataCacheRef.current.delete(media.id)
          }
        } catch (err) {
          console.warn('[MediaEnhancement] Failed to delete existing media:', err)
        }
      }
      
      // NOTE: Keep existing media visible until new media is added (per user requirement)
      // setExistingPageMedia([]) - REMOVED: This was causing premature clearing
    }
    
    // Add new media with clip timing
    const mediaToAdd = { ...lightboxMedia }
    
    // For YouTube videos, update clip timing and embed URL
    if (lightboxMedia.isYouTube) {
      mediaToAdd.clipStart = clipStart
      mediaToAdd.clipEnd = clipEnd
      
      // Update embed URL with clip parameters if they exist
      if (clipStart !== undefined || clipEnd !== undefined) {
        mediaToAdd.embedUrl = buildYouTubeEmbed(lightboxMedia.url, clipStart, clipEnd)
      }
    }
    
    await addMediaToPage(mediaToAdd)
    setLightboxMedia(null)
    setClipStart(undefined)
    setClipEnd(undefined)
    
    // Clear uploadedMedia if this was from an upload
    if (uploadedMedia.some(m => m.id === lightboxMedia.id)) {
      setUploadedMedia([])
    }
    
    // Note: loadExistingMedia() is already called inside addMediaToPage() after the fix
  }
  
  const handleLightboxCancel = () => {
    setIsLightboxOpen(false)
    setLightboxMedia(null)
    setClipStart(undefined)
    setClipEnd(undefined)
  }

  // Image edit handlers
  const handleEditImage = (media: Media) => {
    const imageUrl = (media.storageId && blobUrls.get(media.storageId)) || media.url
    if (imageUrl && media.type === 'image') {
      setEditingImage({
        id: media.id,
        title: media.title || 'Untitled',
        url: imageUrl
      })
    }
  }


  const handleImageUpdated = async (imageId: string, newTitle: string) => {
    try {
      console.log('handleImageUpdated called with:', { imageId, newTitle, editingImage })
      
      // Update the image metadata (title) - ID stays the same since we're overwriting
      if (editingImage) {
        console.log('Before update - existingPageMedia:', existingPageMedia.map(m => ({ id: m.id, title: m.title })))
        
        const updatedMedia = existingPageMedia.map(media => {
          if (media.id === editingImage.id) {
            console.log('Updating media title for same ID:', media.id, 'new title:', newTitle)
            // ID stays the same, only update title/metadata
            return { ...media, title: newTitle }
          }
          return media
        })
        
        console.log('After update - updatedMedia:', updatedMedia.map(m => ({ id: m.id, title: m.title })))
        
        setExistingPageMedia(updatedMedia)
        
        // Update the course content
        const currentPage = getCurrentPage()
        if (currentPage) {
          console.log('Updating page content for:', currentPage.title)
          updatePageInCourseContent(currentPage, updatedMedia)
        }
        
        // Mark as unsaved
        markDirty('media')
      }
      
      setEditingImage(null)
    } catch (error) {
      console.error('Error updating edited image:', error)
      notifyError('Failed to update edited image')
    }
  }

  const handleCloseImageEdit = () => {
    setEditingImage(null)
  }

  // Helper functions for time parsing and formatting

  // YouTube clip time handlers
  const handleClipTimeChange = (mediaId: string, field: 'start' | 'end', value: string) => {
    const timeInSeconds = parseTimeToSeconds(value)
    
    console.log(`[YouTube Clip] handleClipTimeChange called:`, {
      mediaId,
      field,
      value,
      timeInSeconds,
      currentExistingPageMedia: existingPageMedia.length
    })
    
    // Only update media state if parsing succeeded (not null)
    if (timeInSeconds !== null) {
      const updatedMedia = existingPageMedia.map(media => {
        if (media.id === mediaId) {
          // CRITICAL FIX: Synchronize with backup system to preserve all timing values
          const backupValues = lastKnownGoodValues.get(mediaId) || {}
          const updatedMedia = {
            ...media,
            // Use backup values as source of truth, falling back to media object values
            clipStart: field === 'start' ? timeInSeconds : (backupValues.start ?? media.clipStart ?? undefined),
            clipEnd: field === 'end' ? timeInSeconds : (backupValues.end ?? media.clipEnd ?? undefined)
          }
          console.log(`[YouTube Clip] Updated media object:`, {
            mediaId,
            field,
            oldClipStart: media.clipStart,
            oldClipEnd: media.clipEnd,
            newClipStart: updatedMedia.clipStart,
            newClipEnd: updatedMedia.clipEnd
          })
          console.log(`[SCORM DEBUG] Media object after timing update:`, {
            id: updatedMedia.id,
            type: updatedMedia.type,
            url: updatedMedia.url,
            isYouTube: updatedMedia.isYouTube,
            clipStart: updatedMedia.clipStart,
            clipEnd: updatedMedia.clipEnd,
            embedUrl: updatedMedia.embedUrl,
            title: updatedMedia.title
          })
          return updatedMedia
        }
        return media
      })
      
      console.log(`[YouTube Clip] Setting existingPageMedia with ${updatedMedia.length} items`)
      setExistingPageMedia(updatedMedia)
      
      // Update course content
      const currentPage = getCurrentPage()
      if (currentPage) {
        updatePageInCourseContent(currentPage, updatedMedia)
      }
      
      // Mark as unsaved
      markDirty('media')
    }
  }

  // Enhanced input change handler with useCallback
  const handleClipInputChange = useCallback((mediaId: string, field: 'start' | 'end', value: string) => {
    console.log(`[YouTube Clip] handleClipInputChange called:`, {
      mediaId,
      field,
      value,
      activeTimeInputsSize: activeTimeInputs.size
    })
    
    // Update local input state during typing
    setActiveTimeInputs(prev => {
      const updated = new Map(prev)
      const current = updated.get(mediaId) || {}
      updated.set(mediaId, { ...current, [field]: value })
      
      console.log(`[YouTube Clip] Updated activeTimeInputs:`, {
        mediaId,
        field,
        newValue: value,
        updatedEntry: updated.get(mediaId)
      })
      
      return updated
    })
  }, [activeTimeInputs])

  // Enhanced focus handler with useCallback
  const handleClipInputFocus = useCallback((mediaId: string, field: 'start' | 'end') => {
    console.log(`[YouTube Clip] handleClipInputFocus called:`, {
      mediaId,
      field,
      previousFocus: null // focusedInput removed
    })
    
    // setFocusedInput removed - no longer needed
    
    // Initialize local input with current formatted value if not already present
    const media = existingPageMedia.find(m => m.id === mediaId)
    if (media) {
      const currentValue = field === 'start' ? media.clipStart : media.clipEnd
      const formattedValue = currentValue !== undefined ? formatSecondsToTime(currentValue) : ''
      
      setActiveTimeInputs(prev => {
        const updated = new Map(prev)
        const current = updated.get(mediaId) || {}
        // Only set if not already typing
        if (!current[field]) {
          updated.set(mediaId, { ...current, [field]: formattedValue })
        }
        return updated
      })
    }
  }, [existingPageMedia, formatSecondsToTime]) // focusedInput dependency removed

  // Function to update page in course content - moved here to fix temporal dead zone error
  const updatePageInCourseContent = (page: Page | Topic, media: Media[]) => {
    if (!courseContent || !onUpdateContent) return
    
    const content = courseContent as CourseContent
    const updatedContent = structuredClone(content)
    
    // Ensure each Media object has a proper URL for display and preserves all flags
    const mediaWithUrls = media.map(item => ({
      ...item,
      // CRITICAL FIX: Ensure YouTube videos get isYouTube flag set correctly
      isYouTube: item.isYouTube || item.type === 'youtube' || false,
      // CRITICAL FIX: Explicitly preserve YouTube clip timing properties
      clipStart: item.clipStart,
      clipEnd: item.clipEnd,
      // If no URL, create one based on the media ID
      url: item.url || item.embedUrl || `media://${item.id}`
    }))
    
    const pageWithMedia = setPageMedia(page, mediaWithUrls)
    if (!pageWithMedia) return
    
    // FIXED: Do NOT modify HTML content - keep media separate
    // Media should only be stored in the media array, never embedded in content
    const updatedPage = { ...pageWithMedia }
    
    // FIX: Use specific patterns to only remove OUR generated media containers
    // Preserve user-added images and iframes
    if (updatedPage.content) {
      console.log('[MediaEnhancement] Cleaning only our generated media from content')
      
      // Pattern 1: Remove our media container divs with class="media-container" or data-media-id
      updatedPage.content = updatedPage.content.replace(
        /<div[^>]*(?:class="media-container"|data-media-id="[^"]*")[^>]*>[\s\S]*?<\/div>/gi,
        ''
      )
      
      // Pattern 2: Only remove blob images that are part of our media system (with data attributes)
      // This preserves user-uploaded images with regular URLs
      updatedPage.content = updatedPage.content.replace(
        /<img[^>]*blob:[^>]*data-media-[^>]*>/gi,
        ''
      )
      
      // Pattern 3: Only remove YouTube iframes with our specific markers
      // Look for iframes with data-media-youtube attribute or our specific embed pattern
      updatedPage.content = updatedPage.content.replace(
        /<iframe[^>]*(?:data-media-youtube="true"|class="media-youtube")[^>]*>[\s\S]*?<\/iframe>/gi,
        ''
      )
      
      // Clean up extra whitespace
      updatedPage.content = updatedPage.content.replace(/\n\s*\n\s*\n/g, '\n\n').trim()
    }
    
    if (currentPageIndex === 0) {
      updatedContent.welcomePage = updatedPage as Page
    } else if (currentPageIndex === 1) {
      updatedContent.learningObjectivesPage = updatedPage as Page
    } else {
      const topicIndex = currentPageIndex - 2
      if (updatedContent.topics && topicIndex >= 0) {
        updatedContent.topics[topicIndex] = updatedPage as Topic
      }
    }
    
    // Enhanced debug logging to trace clip timing data flow
    const currentPageMedia = updatedPage.media || []
    const youtubeMediaWithTiming = currentPageMedia.filter(m => m.isYouTube && (m.clipStart !== undefined || m.clipEnd !== undefined))
    
    console.log(`[SCORM DEBUG] Calling onUpdateContent with course content:`, {
      totalPages: Object.keys(updatedContent).length,
      currentPageId: updatedPage.id,
      currentPageMediaCount: currentPageMedia.length,
      youtubeMediaWithTimingCount: youtubeMediaWithTiming.length,
      // CRITICAL: Log detailed YouTube media with timing
      youtubeMediaDetails: youtubeMediaWithTiming.map(m => ({
        id: m.id,
        title: m.title,
        type: m.type,
        isYouTube: m.isYouTube,
        clipStart: m.clipStart,
        clipEnd: m.clipEnd,
        hasClipStart: m.clipStart !== undefined,
        hasClipEnd: m.clipEnd !== undefined,
        url: m.url?.substring(0, 50) + '...'
      })),
      // Log all media for current page
      allCurrentPageMedia: currentPageMedia.map(m => ({
        id: m.id,
        type: m.type,
        isYouTube: m.isYouTube,
        clipStart: m.clipStart,
        clipEnd: m.clipEnd
      }))
    })
    onUpdateContent(updatedContent)
  }

  // Enhanced clip input blur handler with debouncing and conflict prevention
  const handleClipInputBlur = useCallback(async (mediaId: string, field: 'start' | 'end') => {
    // MEDIA CLEARING FIX: Set flag to prevent unnecessary media reloading during clip timing updates
    setIsUpdatingClipTiming(true)
    isUpdatingClipTimingRef.current = true

    // Parse the current input value and save to media state
    const inputValue = activeTimeInputs.get(mediaId)?.[field] || ''
    const timeInSeconds = parseTimeToSeconds(inputValue)
    
    console.log(`[YouTube Clip] handleClipInputBlur called:`, {
      mediaId,
      field,
      inputValue,
      timeInSeconds,
      activeTimeInputsSize: activeTimeInputs.size,
      activeTimeInputsForMedia: activeTimeInputs.get(mediaId)
    })
    
    // Only save if input is valid, otherwise keep the invalid input visible for correction
    if (inputValue.trim() && timeInSeconds !== null) {
      console.log(`[YouTube Clip] Valid input detected, saving...`)
      
      // PERSISTENCE TO BACKEND: Update the stored media metadata with new clip timing (do this first)
      const currentMediaItem = existingPageMedia.find(m => m.id === mediaId)
      if (currentMediaItem?.isYouTube && currentMediaItem.storageId) {
        try {
          const backupValues = lastKnownGoodValues.get(mediaId) || {}
          const clipStart = field === 'start' ? timeInSeconds : (backupValues.start ?? currentMediaItem.clipStart)
          const clipEnd = field === 'end' ? timeInSeconds : (backupValues.end ?? currentMediaItem.clipEnd)
          
          console.log(`[YouTube Clip] Persisting clip timing to backend storage:`, {
            mediaId,
            storageId: currentMediaItem.storageId,
            clipStart,
            clipEnd,
            field,
            newValue: timeInSeconds
          })
          
          // Call the new backend persistence method
          await updateYouTubeVideoMetadata(currentMediaItem.storageId, {
            clipStart,
            clipEnd
          })
          
          console.log(`[YouTube Clip] Successfully persisted clip timing to backend`)
          
          // MEDIA CLEARING FIX: Show positive feedback without disrupting UI
          setSuccessMessage(`Clip timing ${field} time saved successfully`)
          setTimeout(() => setSuccessMessage(null), 2000)
        } catch (error) {
          console.error(`[YouTube Clip] Failed to persist clip timing to backend:`, error)
          // Don't throw error - local state is still updated, just backend persistence failed
        }
      }
      
      // DEBOUNCING: Use requestAnimationFrame to ensure proper timing for state updates
      requestAnimationFrame(() => {
        // ATOMIC STATE UPDATE: Use functional updates to ensure consistency
        setExistingPageMedia(prevMedia => {
          const updatedMedia = prevMedia.map(media => {
            if (media.id === mediaId) {
              // CRITICAL FIX: Synchronize with backup system to preserve all timing values
              const backupValues = lastKnownGoodValues.get(mediaId) || {}
              const updatedMediaItem = {
                ...media,
                // Use backup values as source of truth, falling back to media object values
                clipStart: field === 'start' ? timeInSeconds : (backupValues.start ?? media.clipStart ?? undefined),
                clipEnd: field === 'end' ? timeInSeconds : (backupValues.end ?? media.clipEnd ?? undefined)
              }
              console.log(`[YouTube Clip] Updated media object atomically (debounced):`, {
                mediaId,
                field,
                oldClipStart: media.clipStart,
                oldClipEnd: media.clipEnd,
                backupStart: backupValues.start,
                backupEnd: backupValues.end,
                newClipStart: updatedMediaItem.clipStart,
                newClipEnd: updatedMediaItem.clipEnd,
                sourcedFromBackup: {
                  start: backupValues.start !== undefined,
                  end: backupValues.end !== undefined
                }
              })
              
              // IMMEDIATE COURSE CONTENT UPDATE: Update course content in the same render cycle
              const currentPage = getCurrentPage()
              if (currentPage) {
                console.log(`[YouTube Clip] Updating course content synchronously for page:`, currentPage.id)
                // Update the course content with the new media immediately
                const updatedPageMedia = prevMedia.map(m => m.id === mediaId ? updatedMediaItem : m)
                updatePageInCourseContent(currentPage, updatedPageMedia)
              }
              
              return updatedMediaItem
            }
            return media
          })
          
          console.log(`[YouTube Clip] Setting existingPageMedia with ${updatedMedia.length} items (atomic debounced update)`)
          return updatedMedia
        })
        
        // Mark as unsaved
        markDirty('media')
        
        // BACKUP SUCCESSFUL VALUE: Store in preservation state for fallback
        setLastKnownGoodValues(prev => {
          const updated = new Map(prev)
          const current = updated.get(mediaId) || {}
          updated.set(mediaId, { 
            ...current, 
            [field]: timeInSeconds 
          })
          console.log(`[YouTube Clip] Preserved good value for fallback:`, {
            mediaId,
            field,
            value: timeInSeconds,
            allBackups: Object.fromEntries(updated)
          })
          return updated
        })
      })
        
      // MEDIA CLEARING FIX: Use gentler clearing that preserves visual state
      // Instead of immediately clearing, delay the clearing to allow smooth transition
      setTimeout(() => {
        setActiveTimeInputs(prev => {
          const updated = new Map(prev)
          const current = updated.get(mediaId) || {}
          const newCurrent = { ...current }
          delete newCurrent[field]
          
          console.log(`[YouTube Clip] Clearing activeTimeInputs for ${mediaId}.${field} (smooth transition)`, {
            beforeDelete: current,
            afterDelete: newCurrent
          })
          
          if (Object.keys(newCurrent).length === 0) {
            updated.delete(mediaId)
            console.log(`[YouTube Clip] Removing all activeTimeInputs for ${mediaId} (smooth transition)`)
          } else {
            updated.set(mediaId, newCurrent)
            console.log(`[YouTube Clip] Keeping remaining activeTimeInputs for ${mediaId} (smooth transition):`, newCurrent)
          }
          return updated
        })
      }, 150); // Small delay to allow backend save to complete and prevent jarring clearing
      
    } else if (inputValue.trim()) {
        // Invalid input - keep it visible so user can correct it
        // Don't clear local state, don't save to media state
        console.warn('[YouTube Clip] Invalid time format:', inputValue)
      } else {
        // Empty input - clear local state immediately (no debouncing needed)
        setActiveTimeInputs(prev => {
          const updated = new Map(prev)
          const current = updated.get(mediaId) || {}
          const newCurrent = { ...current }
          delete newCurrent[field]
          
          if (Object.keys(newCurrent).length === 0) {
            updated.delete(mediaId)
          } else {
            updated.set(mediaId, newCurrent)
          }
          return updated
        })
      }
      
      // Clear focused input after everything else is done
      // focusedInput logic removed - no longer needed

      // MEDIA CLEARING FIX: Clear the clip timing update flag after a delay to allow state to settle
      setTimeout(() => {
        setIsUpdatingClipTiming(false)
        isUpdatingClipTimingRef.current = false
      }, 100)
  }, [
    activeTimeInputs, 
    parseTimeToSeconds, 
    markDirty, 
    existingPageMedia, 
    lastKnownGoodValues, // focusedInput dependency removed 
    updateYouTubeVideoMetadata, 
    getCurrentPage, 
    updatePageInCourseContent
  ])

  // Enhanced input value getter with state synchronization guards
  const getInputValue = useCallback((media: Media, field: 'start' | 'end'): string => {
    // STATE SYNCHRONIZATION GUARD: Check if we have active input first
    const activeInput = activeTimeInputs.get(media.id)?.[field]
    if (activeInput !== undefined) {
      console.log(`[YouTube Clip] getInputValue returning activeInput (guarded):`, {
        mediaId: media.id,
        field,
        activeInput,
        source: 'activeTimeInputs',
        hasStoredValue: (field === 'start' ? media.clipStart : media.clipEnd) !== undefined
      })
      return activeInput
    }
    
    // FALLBACK TO STORED VALUE: Show the formatted stored value with validation
    const storedValue = field === 'start' ? media.clipStart : media.clipEnd
    const hasValidStoredValue = storedValue !== undefined && storedValue !== null && storedValue >= 0
    
    // ULTIMATE FALLBACK: Use backup value if stored value is missing/invalid
    const backupValue = lastKnownGoodValues.get(media.id)?.[field]
    const hasValidBackupValue = backupValue !== undefined && backupValue !== null && backupValue >= 0
    
    const finalValue = hasValidStoredValue ? storedValue : (hasValidBackupValue ? backupValue : null)
    const formattedValue = finalValue !== null ? formatSecondsToTime(finalValue) : ''
    
    console.log(`[YouTube Clip] getInputValue returning fallback-protected value (guarded):`, {
      mediaId: media.id,
      field,
      storedValue,
      hasValidStoredValue,
      backupValue,
      hasValidBackupValue,
      finalValue,
      formattedValue,
      source: hasValidStoredValue ? 'media.clip' + (field === 'start' ? 'Start' : 'End') : (hasValidBackupValue ? 'backup' : 'empty'),
      activeTimeInputsSize: activeTimeInputs.size
    })
    
    return formattedValue
  }, [activeTimeInputs, lastKnownGoodValues, formatSecondsToTime])

  // Keep old function for compatibility but redirect to preview
  const handleToggleSelection = (resultId: string) => {
    handleMediaPreview(resultId)
  }

  // Separate function to add media to page
  const addMediaToPage = async (result: SearchResult) => {
    debugLogger.info('MEDIA_ADD', 'Adding media to page', {
      mediaId: result.id,
      mediaTitle: result.title,
      mediaType: result.isYouTube ? 'youtube' : 'image',
      pageId: getCurrentPage()?.id || `index-${currentPageIndex}`,
      isYouTube: result.isYouTube,
      hasUrl: !!result.url
    })
    
    // DEFENSIVE LOGGING: Track when addMediaToPage is called
    console.error('🚨 [DELETION DEBUG] addMediaToPage called!', {
      resultId: result.id,
      resultTitle: result.title,
      resultUrl: result.url,
      resultIsYouTube: result.isYouTube,
      stackTrace: new Error().stack,
      timestamp: new Date().toISOString()
    })
    
    const mediaId = result.id
    
    // Create timeout promise for stuck operations (30 seconds for portable exe)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Media addition timeout: Operation took too long. This may happen with slow network connections or in portable versions. Please try again.'))
      }, 30000) // 30 second timeout
    })
    
    try {
      // Add this specific media ID to the loading set
      setAddingMediaIds(prev => new Set(prev).add(mediaId))
      
      // Create the main media addition logic as a separate promise
      const addMediaPromise = async () => {
        // Declare pageId at function scope so it's accessible throughout
      const currentPage = getCurrentPage()
      if (!currentPage) {
        throw new Error('No current page selected')
      }
      const pageId = getPageId(currentPage)
      
      // Variable to store the result of storing media
      let storedItem: MediaItem
      
      // Check if it's a YouTube video - check isYouTube flag first
      if (result.isYouTube || result.embedUrl || (result.url && (result.url.includes('youtube.com') || result.url.includes('youtu.be')))) {
        console.log('[MediaEnhancement] Processing YouTube video:', {
          title: result.title,
          url: result.url,
          embedUrl: result.embedUrl,
          isYouTube: result.isYouTube,
          clipStart: result.clipStart,
          clipEnd: result.clipEnd,
          pageId
        })
        
        // FIX: Validate and sanitize YouTube URL before storing
        const videoUrl = result.url || (result.embedUrl ? result.embedUrl.replace('/embed/', '/watch?v=') : '')
        if (!videoUrl) {
          console.error('[MediaEnhancement] YouTube video URL not found in result:', result)
          throw new Error('YouTube video URL not found')
        }
        
        // Extract and validate video ID
        const videoId = extractYouTubeVideoId(videoUrl)
        if (!videoId) {
          console.error('[MediaEnhancement] Invalid YouTube URL:', videoUrl)
          setSearchError('Invalid YouTube URL format. Please use a valid YouTube video URL.')
          throw new Error('Invalid YouTube URL')
        }
        
        // Generate secure embed URL
        const embedUrl = generateSecureYouTubeEmbed(videoId)
        
        console.log('[MediaEnhancement] Storing validated YouTube video:', {
          originalUrl: videoUrl,
          videoId,
          embedUrl,
          pageId
        })
        
        storedItem = await storeYouTubeVideo(
          `https://www.youtube.com/watch?v=${videoId}`, // Normalized URL
          embedUrl,
          pageId, 
          {
            title: result.title || 'Video',
            type: 'video',
            isYouTube: true,
            clipStart: result.clipStart,  // Pass clip timing data
            clipEnd: result.clipEnd       // Pass clip timing data
            // Duration will be available from ReactPlayer when needed
          }
        )
        console.log('[MediaEnhancement] Successfully stored YouTube video:', storedItem)
      } else {
        console.log('[MediaEnhancement] Processing image:', {
          title: result.title,
          url: result.url,
          pageId
        })
        
        // Check if this is an uploaded file (has blob in mediaItemsRef)
        const mediaItem = mediaItemsRef.current.get(result.id)
        let blob: Blob
        
        if (mediaItem?.blob) {
          // Use the existing blob from uploaded file
          console.log('[MediaEnhancement] Using existing blob from uploaded file')
          blob = mediaItem.blob
        } else {
          // Download and store external image
          if (forceDownloadMode) {
            console.log('[MediaEnhancement] Using force download mode for external image')
            blob = await forceDownloadExternalImage(result.url)
          } else {
            console.log('[MediaEnhancement] Downloading external image (normal mode)')
            blob = await downloadExternalImage(result.url)
          }
        }
        
        console.log('[MediaEnhancement] Image blob:', {
          size: blob.size,
          type: blob.type
        })
        
        storedItem = await storeMedia(blob, pageId, 'image', {
          title: result.title || 'Image',
          type: 'image',
          url: result.url
        })
        console.log('[MediaEnhancement] Successfully stored image:', storedItem)
        success(`Image "${result.title || 'Image'}" added successfully`)
      }

      // Create the new media item for the page
      let newMediaItem: Media
      if (result.isYouTube || result.embedUrl || (result.url && (result.url.includes('youtube.com') || result.url.includes('youtu.be')))) {
        // YouTube video
        newMediaItem = {
          id: storedItem.id,
          type: 'video',
          title: (typeof storedItem.metadata?.title === 'string' ? storedItem.metadata.title : undefined) || storedItem.fileName || result.title || 'Video',
          url: storedItem.metadata?.youtubeUrl || result.url || '',
          embedUrl: (result.clipStart !== undefined || result.clipEnd !== undefined) 
            ? buildYouTubeEmbed(storedItem.metadata?.youtubeUrl || result.url || '', result.clipStart, result.clipEnd)
            : storedItem.metadata?.embedUrl || result.embedUrl || '',
          isYouTube: true,
          storageId: storedItem.id,
          mimeType: 'video/mp4',
          clipStart: result.clipStart,
          clipEnd: result.clipEnd
        }
      } else {
        // Regular image - Force create a fresh blob URL (don't use cached)
        // First revoke any existing URL to ensure fresh generation
        const existingUrl = blobUrls.get(storedItem.id)
        if (existingUrl) {
          URL.revokeObjectURL(existingUrl)
          setBlobUrls(prev => {
            const newMap = new Map(prev)
            newMap.delete(storedItem.id)
            return newMap
          })
        }
        
        // Now create fresh blob URL
        const blobUrl = await createBlobUrl(storedItem.id)
        
        // Track the blob URL for cleanup
        if (blobUrl) {
          setBlobUrls(prev => {
            const newMap = new Map(prev)
            newMap.set(storedItem.id, blobUrl)
            return newMap
          })
          console.log('[MediaEnhancement] Created and tracked fresh blob URL for stored image:', storedItem.id)
        }
        
        newMediaItem = {
          id: storedItem.id,
          type: 'image',
          title: (typeof storedItem.metadata?.title === 'string' ? storedItem.metadata.title : undefined) || storedItem.fileName || result.title || 'Image',
          url: blobUrl || `media-error://${storedItem.id}`,
          storageId: storedItem.id,
          mimeType: storedItem.metadata?.mimeType || 'image/jpeg'
        }
      }

      // FIXED: Replace media instead of appending (only one media per page)
      // Previously: const updatedPageMedia = [...currentPageMedia, newMediaItem]
      const updatedPageMedia = [newMediaItem]
      
      // Update the local state immediately with single media item
      setExistingPageMedia(updatedPageMedia)
      
      // Media added successfully
      
      // Update course content with the combined media array
      if (currentPage) {
        updatePageInCourseContent(currentPage, updatedPageMedia)
      }

      // Show success message
      setSuccessMessage('Media added to page')
      setTimeout(() => setSuccessMessage(null), 3000)
      console.log('[MediaEnhancement] Media added to page successfully')
      
      // Mark media section as dirty after successful media addition
      markDirty('media')

      // RACE CONDITION FIX: Do NOT reload media from cache after adding
      // The local state has already been updated with the correct item (line 1804)
      // Calling loadExistingMedia() can cause a race condition where the cache
      // hasn't been updated yet, causing the newly added video to disappear
      console.log('[MediaEnhancement] Media added successfully - using direct state update instead of cache reload')
      }
      
      // Race the media addition against timeout
      await Promise.race([addMediaPromise(), timeoutPromise])
    } catch (error) {
      // Properly serialize error for logging (Error objects serialize to {})
      const errorInfo = error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n')[0] // Just first line of stack
      } : error
      console.error('[MediaEnhancement] Error adding media:', errorInfo)
      
      // Provide helpful error messages based on error type
      let errorMsg = 'Failed to add media to page'
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : ''
      
      if (errorMessage.includes('cors') || errorMessage.includes('blocked') || errorMessage.includes('policy')) {
        if (forceDownloadMode) {
          errorMsg = 'Unable to download this image even with force mode. The source may have strict security policies.'
        } else {
          errorMsg = 'Download blocked by network restrictions. Try enabling Force Download Mode in Settings > Advanced.'
        }
      } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
        if (!forceDownloadMode) {
          errorMsg = 'Download timed out. If you\'re on a corporate network or VPN, try enabling Force Download Mode in Settings > Advanced.'
        } else {
          errorMsg = 'Network timeout occurred even with force download mode. Please try again or upload the image manually.'
        }
      } else if (errorMessage.includes('force download methods failed')) {
        errorMsg = 'All download methods failed. Please save the image to your computer and upload it using the Upload tab.'
      }
      
      setSearchError(errorMsg)
      notifyError(errorMsg)
    } finally {
      // Remove this specific media ID from the loading set
      setAddingMediaIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(mediaId)
        return newSet
      })
    }
  }

  // Handle replace confirmation
  const handleReplaceConfirm = useCallback(async () => {
    if (!replaceMode) return
    
    const result = displayedResults.find(r => r.id === replaceMode.id)
    if (!result) {
      setReplaceMode(null)
      return
    }

    // FIXED: Properly delete ALL existing media before adding new
    // This ensures only one media item per page
    if (existingPageMedia && existingPageMedia.length > 0) {
      console.log('[MediaEnhancement] Deleting existing media before replacement:', existingPageMedia)
      for (const media of existingPageMedia) {
        try {
          // FIXED: Always delete ALL existing media when replacing
          // Only one media per page is allowed - no exceptions
          console.log('[MediaEnhancement] Deleting existing media:', media.id, media.type)
          
          // DEFENSIVE LOGGING: Track what's causing video deletion 
          console.error('🚨 [DELETION DEBUG] Video deletion triggered from addMediaToPage (existing media cleanup)!', {
            mediaId: media.id,
            storageId: media.storageId,
            mediaType: media.type,
            stackTrace: new Error().stack,
            timestamp: new Date().toISOString()
          })
          
          // Delete from storage if it has a storage ID
          if (media.storageId) {
            await deleteMedia(media.storageId)
            // Clear enriched metadata cache
            enrichedMetadataCacheRef.current.delete(media.storageId)
          } else {
            // Fallback to media.id if no storageId
            await deleteMedia(media.id)
            // Clear enriched metadata cache
            enrichedMetadataCacheRef.current.delete(media.id)
          }
        } catch (err) {
          console.warn('[MediaEnhancement] Failed to delete existing media:', err)
        }
      }
      
      // Clear the existing media array immediately
      setExistingPageMedia([])
    }

    // Now add the new media as the ONLY media item
    await addMediaToPage(result)
    setReplaceMode(null)
    
    // Note: loadExistingMedia() is already called inside addMediaToPage() after the fix
  }, [replaceMode, displayedResults, existingPageMedia, deleteMedia, addMediaToPage])
  
  // Move loadExistingMedia to component scope using useCallback
  const loadExistingMedia = React.useCallback(async () => {
    // MEDIA CLEARING FIX: Skip loading if we're in the middle of a clip timing update
    if (isUpdatingClipTimingRef.current) {
      console.log('[MediaEnhancement] Skipping loadExistingMedia - clip timing update in progress')
      return
    }

    // Directly determine page based on index to avoid dependency on getCurrentPage
    if (!courseContent) return
    
    setIsLoadingMedia(true)
    setLoadingProgress({ current: 0, total: 0 })
    
    const content = courseContent as CourseContent
    let currentPage: Page | Topic | undefined
    
    if (currentPageIndex === 0) {
      currentPage = content.welcomePage
    } else if (currentPageIndex === 1) {
      currentPage = content.learningObjectivesPage
    } else {
      const topicIndex = currentPageIndex - 2
      if (content.topics && topicIndex >= 0 && topicIndex < content.topics.length) {
        currentPage = content.topics[topicIndex]
      }
    }
    
    if (!currentPage) return
    
    // Add safety checks for context functions to prevent errors during renders
    if (!getValidMediaForPage || !populateFromCourseContent || !createBlobUrl) {
      console.warn('[MediaEnhancement] Context functions not available yet, skipping media load')
      return
    }
    
    const pageId = getPageId(currentPage)
    console.log('[MediaEnhancement] Loading media for page:', pageId)
    
    // 🔧 FIX: First populate UnifiedMediaContext cache from course content
    // This ensures getValidMediaForPage will find the media items
    const pageMediaFromCourseContent = _getPageMedia(currentPage)
    if (pageMediaFromCourseContent.length > 0) {
      console.log(`[MediaEnhancement] 🔄 Populating media cache from course content: ${pageMediaFromCourseContent.length} items`)
      try {
        await populateFromCourseContent(pageMediaFromCourseContent, pageId)
      } catch (error) {
        console.error('[MediaEnhancement] Failed to populate media cache from course content:', error)
      }
    }
    
    // Get media items for the current page (using defensive version)
    let pageMediaItems: Media[] = []
    try {
      // PERFORMANCE FIX: Use lightweight visual-only mode to prevent audio/caption loading
      const result = await getValidMediaForPage(pageId, { 
        types: ['image', 'video', 'youtube'], 
        verifyExistence: false 
      })
      pageMediaItems = result as unknown as Media[]
      
      // Ensure it's always an array
      if (!Array.isArray(pageMediaItems)) {
        console.warn('[MediaEnhancement] getValidMediaForPage did not return an array:', pageMediaItems)
        pageMediaItems = []
      }
    } catch (error) {
      console.error('[MediaEnhancement] Error loading media for page:', error)
      pageMediaItems = []
    }
    
    // Only get image, video, and YouTube items (not audio/captions)
    const imageAndVideoItems = pageMediaItems.filter(item => 
      item.type === 'image' || item.type === 'video' || item.type === 'youtube'
    )
    
    console.log('[MediaEnhancement] 📋 MEDIA LOADING VERIFICATION DEBUG:', {
      pageId,
      rawMediaCount: pageMediaItems.length,
      visualMediaItems: imageAndVideoItems.map(item => ({
        id: item.id,
        type: item.type,
        hasMetadata: !!(item as any).metadata,
        metadataKeys: (item as any).metadata ? Object.keys((item as any).metadata) : [],
        isYouTube: (item as any).metadata?.isYouTube || item.type === 'youtube',
        metadataStructure: (item as any).metadata
      }))
    })
    console.log('[MediaEnhancement] Found media items:', imageAndVideoItems.length)
    
    if (imageAndVideoItems.length > 0) {
      console.log('[MediaEnhancement] Loading', imageAndVideoItems.length, 'media items')
      setLoadingProgress({ current: 0, total: imageAndVideoItems.length })
      
      // Create media items from MediaService items with real blob URLs
      let loadedCount = 0
      const newBlobUrls = new Map<string, string>() // Collect blob URLs to batch update
      
      const mediaItemsPromises = imageAndVideoItems.map(async (item) => {
        // DEFENSIVE FIX: Safely access metadata properties, fallback to item properties
        const metadata = (item as any).metadata || {}
        const itemAny = item as any
        
        
        // Check for YouTube URL in multiple possible locations
        let url = metadata.youtubeUrl || metadata.embedUrl || itemAny.url || itemAny.embedUrl
        const isYouTubeVideo = item.type === 'youtube' || metadata.isYouTube || itemAny.isYouTube || 
                              (url && (url.includes('youtube.com') || url.includes('youtu.be')))
        
        // 🔧 DEBUG: Log YouTube detection for troubleshooting
        if (item.type === 'youtube' || metadata.isYouTube || itemAny.isYouTube) {
          console.log(`[MediaEnhancement] 🎬 YouTube video detected for ${item.id}:`, {
            itemType: item.type,
            metadataIsYouTube: metadata.isYouTube,
            itemAnyIsYouTube: itemAny.isYouTube,
            hasYouTubeUrl: !!(url && (url.includes('youtube.com') || url.includes('youtu.be'))),
            finalIsYouTubeVideo: isYouTubeVideo
          })
        }
        
        // 🔧 CRITICAL FIX: For YouTube videos, get enriched data from MediaService (with caching)
        // This ensures clip timing data is loaded from FileStorage without excessive API calls
        let enrichedMetadata = metadata
        if (isYouTubeVideo) {
          // Check cache first to prevent multiple getMedia() calls for the same video
          if (enrichedMetadataCacheRef.current.has(item.id)) {
            const cachedData = enrichedMetadataCacheRef.current.get(item.id)
            enrichedMetadata = cachedData.metadata
            url = cachedData.url || url
            console.log(`[MediaEnhancement] 📦 Using cached enriched metadata for ${item.id}`)
          } else {
            // Load from MediaService and cache the result
            try {
              const mediaServiceData = await getMedia(item.id)
              if (mediaServiceData && mediaServiceData.metadata) {
                enrichedMetadata = mediaServiceData.metadata
                // Cache the enriched data
                enrichedMetadataCacheRef.current.set(item.id, {
                  metadata: enrichedMetadata,
                  url: mediaServiceData.url
                })
                console.log(`[MediaEnhancement] 🎬 Loaded and cached enriched YouTube metadata for ${item.id}:`, {
                  clipStart: enrichedMetadata.clipStart,
                  clipEnd: enrichedMetadata.clipEnd,
                  hasUrl: !!mediaServiceData.url
                })
                // Use the URL from MediaService if available
                if (mediaServiceData.url) {
                  url = mediaServiceData.url
                }
              }
            } catch (error) {
              console.warn(`[MediaEnhancement] Failed to load enriched metadata for YouTube video ${item.id}:`, error)
            }
          }
          
          // 🔧 FALLBACK FIX: Ensure YouTube videos always have a valid URL, never media-error://
          if (!url && isYouTubeVideo) {
            // Try multiple sources for YouTube URL in order of preference
            url = enrichedMetadata.youtubeUrl ||
                  enrichedMetadata.embedUrl ||
                  metadata.youtubeUrl ||
                  metadata.embedUrl ||
                  itemAny.url ||
                  itemAny.embedUrl
            console.log(`[MediaEnhancement] Using fallback YouTube URL for ${item.id}:`, url)
          }
        } else {
          // For all non-YouTube media, create fresh blob URLs
          // Always regenerate blob URLs, ignoring any stored blob: URLs
          const blobUrl = await createBlobUrl(item.id)
          url = blobUrl || `media-error://${item.id}` // Fallback if blob creation fails
          
          // Collect blob URLs for batch update (don't update state here)
          if (blobUrl) {
            newBlobUrls.set(item.id, blobUrl)
          }
        }
        
        const mediaItem = {
          id: item.id,
          type: (item.type === 'youtube' ? 'video' : item.type) as 'image' | 'video', // 🔧 FIX: Handle 'youtube' type
          title: enrichedMetadata.title || itemAny.title || item.fileName,
          thumbnail: enrichedMetadata.thumbnail || itemAny.thumbnail,
          url: url || '',
          embedUrl: enrichedMetadata.embedUrl || itemAny.embedUrl,
          isYouTube: isYouTubeVideo,
          storageId: item.id,
          mimeType: enrichedMetadata.mimeType || itemAny.mimeType || 'video/mp4',
          // 🔧 FIX: Extract clip timing from enriched metadata (from MediaService)
          clipStart: enrichedMetadata.clipStart || enrichedMetadata.clip_start || itemAny.clipStart || itemAny.clip_start,
          clipEnd: enrichedMetadata.clipEnd || enrichedMetadata.clip_end || itemAny.clipEnd || itemAny.clip_end
        }
        
        // 🔧 DEBUG: Log final media item for YouTube videos
        if (isYouTubeVideo) {
          console.log(`[MediaEnhancement] 📦 Created mediaItem for ${item.id}:`, {
            id: mediaItem.id,
            type: mediaItem.type,
            isYouTube: mediaItem.isYouTube,
            hasUrl: !!mediaItem.url,
            hasEmbedUrl: !!mediaItem.embedUrl,
            clipStart: mediaItem.clipStart,
            clipEnd: mediaItem.clipEnd
          })
        }
        
        
        // Log loaded clip timing values for YouTube videos (for debugging)
        if (mediaItem.isYouTube && (mediaItem.clipStart !== undefined || mediaItem.clipEnd !== undefined)) {
          console.log(`[MediaEnhancement] Loaded YouTube video "${mediaItem.title}" with clip timing: ${mediaItem.clipStart || 0}s - ${mediaItem.clipEnd || 'end'}s`)
        }
        
        // Update progress
        loadedCount++
        setLoadingProgress({ current: loadedCount, total: imageAndVideoItems.length })
        
        return mediaItem
      })
      
      const mediaItems = await Promise.all(mediaItemsPromises)
      console.log('[MediaEnhancement] Created media items with blob URLs:', mediaItems)
      
      // Batch update blob URLs to avoid multiple re-renders
      if (newBlobUrls.size > 0) {
        setBlobUrls(prev => {
          const merged = new Map(prev)
          newBlobUrls.forEach((url, id) => {
            merged.set(id, url)
          })
          return merged
        })
      }
      
      console.log('[MediaEnhancement] 🎯 Setting existingPageMedia state with loaded items:', {
        itemCount: mediaItems.length,
        items: mediaItems.map(item => ({
          id: item.id,
          type: item.type,
          title: item.title,
          clipStart: item.clipStart,
          clipEnd: item.clipEnd,
          clipStartType: typeof item.clipStart,
          clipEndType: typeof item.clipEnd,
          hasClipTiming: (item.clipStart !== undefined || item.clipEnd !== undefined),
          isYouTube: item.isYouTube
        }))
      })
      
      setExistingPageMedia(mediaItems)
    } else {
      console.log('[MediaEnhancement] No media found for page')
      setExistingPageMedia([])
    }
    
    setIsLoadingMedia(false)
    setLoadingProgress({ current: 0, total: 0 })
  }, [currentPageIndex]) // RENDER LOOP FIX: Removed courseContent dependency to prevent cleanup writes from restarting loader
  
  // RENDER LOOP FIX: Page-based loading with sequence tokens to prevent courseContent dependency loops
  useEffect(() => {
    if (!pageId) return
    
    // MEDIA CLEARING FIX: Skip loading during clip timing updates to prevent UI flickering
    if (isUpdatingClipTimingRef.current) {
      console.log('[MediaEnhancement] Skipping media load during clip timing update')
      return
    }
    
    const seq = ++loadSeqRef.current
    console.log(`[MediaEnhancement] Starting load sequence ${seq} for page: ${pageId}`)

    // Cancel previous run and start fresh
    setIsLoadingMedia(true)
    setLoadingProgress({ current: 0, total: 0 })
    
    // Clear enriched metadata cache when page changes to prevent stale data
    enrichedMetadataCacheRef.current.clear()
    console.log('[MediaEnhancement] Cleared enriched metadata cache for page change')

    ;(async () => {
      try {
        // Ensure cache is populated first
        const pageMediaFromCourseContent = _getPageMedia(getCurrentPage())
        if (pageMediaFromCourseContent.length > 0) {
          await populateFromCourseContent?.(pageMediaFromCourseContent, pageId)
        }
        const items = await getValidMediaForPage?.(pageId, { 
          types: ['image', 'video', 'youtube'], 
          verifyExistence: false 
        }) ?? []

        // Abandon if newer run started
        if (seq !== loadSeqRef.current) {
          console.log(`[MediaEnhancement] Abandoning sequence ${seq} (current: ${loadSeqRef.current})`)
          return
        }
        
        // PERFORMANCE OPTIMIZATION: Filter to visual items only for progress calculation
        const visualItems = items.filter(item => 
          item.type === 'image' || item.type === 'video' || item.type === 'youtube'
        )
        
        console.log(`[MediaEnhancement] Loading ${visualItems.length} visual items for page: ${pageId} (filtered from ${items.length} total)`)
        setLoadingProgress({ current: 0, total: visualItems.length })

        // Convert to display format
        const mediaItems: Media[] = visualItems.map((item, index) => {
          const isYouTube = item.metadata?.isYouTube || item.type === 'youtube' || false
          const embedUrl = item.metadata?.embedUrl
          let clipStart = (item.metadata?.clipStart || item.metadata?.clip_start) as number | undefined
          let clipEnd = (item.metadata?.clipEnd || item.metadata?.clip_end) as number | undefined

          // 🔧 FIX: Extract clip timing from embedUrl if not available as metadata
          // This ensures clip timing appears on first topic visit, not just after navigation
          if (isYouTube && (!clipStart || !clipEnd) && embedUrl) {
            const extracted = extractClipTimingFromUrl(embedUrl)

            // Use extracted values only if the metadata properties were undefined
            if (clipStart === undefined) clipStart = extracted.clipStart
            if (clipEnd === undefined) clipEnd = extracted.clipEnd

            console.log(`[MediaEnhancement] 🎬 Extracted clip timing for ${item.id}:`, {
              embedUrl,
              originalClipStart: item.metadata?.clipStart,
              originalClipEnd: item.metadata?.clipEnd,
              extractedClipStart: extracted.clipStart,
              extractedClipEnd: extracted.clipEnd,
              finalClipStart: clipStart,
              finalClipEnd: clipEnd
            })
          }

          return {
            id: item.id,
            type: item.type as 'image' | 'video',
            title: (item.metadata?.title || item.metadata?.original_name || `Media ${index + 1}`) as string,
            url: '', // Will be populated by createBlobUrl
            storageId: item.id,
            // CRITICAL FIX: Ensure YouTube videos get isYouTube flag set correctly
            isYouTube,
            embedUrl,
            clipStart,
            clipEnd
          }
        })

        // Set the media items first
        if (seq === loadSeqRef.current) {
          setExistingPageMedia(mediaItems)
        }

        // Load each visual item with abandonment check
        for (let i = 0; i < visualItems.length; i++) {
          const item = visualItems[i]
          await createBlobUrl?.(item.id)
          
          if (seq !== loadSeqRef.current) {
            console.log(`[MediaEnhancement] Abandoning sequence ${seq} at visual item ${i + 1}/${visualItems.length}`)
            return
          }
          
          setLoadingProgress(p => ({ current: p.current + 1, total: p.total }))
        }

        if (seq !== loadSeqRef.current) return
        
        console.log(`[MediaEnhancement] Completed load sequence ${seq} for page: ${pageId}`)
        setIsLoadingMedia(false)
        
      } catch (error) {
        if (seq !== loadSeqRef.current) return
        console.error(`[MediaEnhancement] Error in load sequence ${seq}:`, error)
        setIsLoadingMedia(false)
        setExistingPageMedia([])
      }
    })()
    
    // Cleanup when page changes or component unmounts
    return () => {
      // Only clear blob URLs if we're actually changing pages, not during save operations
      if (isUpdatingClipTimingRef.current) {
        console.log('[MediaEnhancement] Preserving blob URLs during clip timing update')
      } else {
        setBlobUrls(new Map())
      }
    }
  }, [pageId]) // Only depend on stable pageId, not courseContent
  
  // Auto-trigger search when suggestion is clicked
  useEffect(() => {
    if (triggerSearch && searchQuery.trim()) {
      handleSearch()
      setTriggerSearch(false)
    }
  }, [triggerSearch, searchQuery])
  
  // Clear uploaded media when switching tabs
  useEffect(() => {
    setUploadedMedia([])
  }, [activeTab])
  
  // STATE SYNCHRONIZATION GUARD: Ensure activeTimeInputs doesn't hold stale references to media that no longer exist
  useEffect(() => {
    const existingMediaIds = new Set(existingPageMedia.map(media => media.id))
    
    setActiveTimeInputs(prev => {
      const updated = new Map(prev)
      let hasChanges = false
      
      // Remove any activeTimeInputs for media that no longer exists
      for (const [mediaId] of prev) {
        if (!existingMediaIds.has(mediaId)) {
          updated.delete(mediaId)
          hasChanges = true
          console.log(`[YouTube Clip] Removed stale activeTimeInputs for deleted media:`, mediaId)
        }
      }
      
      return hasChanges ? updated : prev
    })
    
    // Also clear focused input if it references non-existent media
    // focusedInput cleanup logic removed - no longer needed
  }, [existingPageMedia]) // focusedInput dependency removed
  
  // 🔧 FIX: Auto-select media with clip timing for persistent current media preview
  useEffect(() => {
    // Check if page just changed to avoid false deletion detection
    const pageJustChanged = currentPageIndexRef.current !== currentPageIndex

    // If no media is currently selected for preview
    if (!previewMediaId && existingPageMedia.length > 0) {
      // Find the first media item with clip timing (YouTube videos with start/end times)
      const mediaWithClipTiming = existingPageMedia.find(media =>
        media.type === 'video' &&
        media.embedUrl &&
        ((media.clipStart !== undefined && media.clipStart !== null) ||
         (media.clipEnd !== undefined && media.clipEnd !== null))
      )

      if (mediaWithClipTiming) {
        console.log('[MediaEnhancement] 🎬 Auto-selecting media with clip timing for persistent preview:', {
          mediaId: mediaWithClipTiming.id,
          title: mediaWithClipTiming.title,
          clipStart: mediaWithClipTiming.clipStart,
          clipEnd: mediaWithClipTiming.clipEnd
        })
        setPreviewMediaId(mediaWithClipTiming.id)
      } else if (existingPageMedia.length === 1) {
        // Fallback: If there's only one media item, select it
        console.log('[MediaEnhancement] 📺 Auto-selecting single media item for preview:', existingPageMedia[0].id)
        setPreviewMediaId(existingPageMedia[0].id)
      }
    }

    // Clear preview only if media is deleted on same page, not when switching pages
    if (previewMediaId && !existingPageMedia.find(m => m.id === previewMediaId) && !pageJustChanged) {
      console.log('[MediaEnhancement] 🧹 Clearing preview for deleted media:', previewMediaId)
      setPreviewMediaId(null)
    }
  }, [existingPageMedia, previewMediaId, currentPageIndex])
  
  // Load prompt suggestions separated by type
  useEffect(() => {
    const page = getCurrentPage()
    if (!page) return
    
    const imageSuggestions: string[] = []
    const videoSuggestions: string[] = []
    
    // Only use imageKeywords for search suggestions, not AI prompts
    if ('imageKeywords' in page && Array.isArray(page.imageKeywords)) {
      imageSuggestions.push(...page.imageKeywords)
    }
    
    if ('videoSearchTerms' in page && Array.isArray(page.videoSearchTerms)) {
      videoSuggestions.push(...page.videoSearchTerms)
    }
    
    setImagePromptSuggestions(imageSuggestions.filter(Boolean))
    setVideoPromptSuggestions(videoSuggestions.filter(Boolean))
  }, [currentPageIndex, courseContent])
  
  // Cleanup upload operations on unmount
  useEffect(() => {
    return () => {
      // Abort any ongoing upload when component unmounts
      if (uploadAbortControllerRef.current) {
        console.log('[MediaEnhancement] Aborting upload on unmount')
        uploadAbortControllerRef.current.abort()
        uploadAbortControllerRef.current = null
      }
    }
  }, [])
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    
    debugLogger.info('MEDIA_UPLOAD', 'Starting media file upload', {
      fileCount: files.length,
      pageId: getCurrentPage()?.id || `index-${currentPageIndex}`,
      fileSizes: Array.from(files).map(f => f.size),
      fileTypes: Array.from(files).map(f => f.type)
    })
    
    // Prevent concurrent uploads - cancel any ongoing upload
    if (uploadAbortControllerRef.current) {
      console.log('[MediaEnhancement] Cancelling previous upload to start new one')
      uploadAbortControllerRef.current.abort()
    }
    
    // Create new AbortController for this upload
    uploadAbortControllerRef.current = new AbortController()
    const { signal } = uploadAbortControllerRef.current
    
    // FIX: Enforce single file selection even if browser allows multiple
    if (files.length > 1) {
      console.warn('[MediaEnhancement] Multiple files selected, but only one media per page is allowed.')
      setSearchError('Only one media file per page is allowed. Please select a single file.')
      setTimeout(() => setSearchError(null), 3000)
      event.target.value = '' // Clear the input
      return
    }
    
    // Check if already aborted (e.g., if component unmounted)
    if (signal.aborted) {
      console.log('[MediaEnhancement] Upload aborted before processing started')
      return
    }
    
    setIsFileProcessing(true)
    setUploadProgress({
      current: 0,
      total: 1,
      fileName: files[0].name,
      percent: 0
    })
    
    try {
      const results: SearchResult[] = []
      const newlyUploaded = new Set<string>()
    
    // Process only the first file
    const file = files[0]
    const fileId = `uploaded-${Date.now()}-0`
    const blob = new Blob([file], { type: file.type })
    const blobUrl = createTrackedBlobUrl(blob, fileId)
    
    // Update progress
    setUploadProgress({
      current: 1,
      total: 1,
      fileName: file.name,
      percent: 100
    })
    
    const result: SearchResult = {
      id: fileId,
      url: blobUrl,
      title: file.name,
      thumbnail: file.type.startsWith('image/') ? blobUrl : undefined
    }
    
    results.push(result)
    newlyUploaded.add(fileId)
    
    // Create media item
    const mediaItem: Media = {
      id: fileId,
      type: file.type.startsWith('video/') ? 'video' : 'image',
      title: file.name,
      url: blobUrl,
      blob: blob,
      storageId: fileId
    }
    
    mediaItemsRef.current.set(fileId, mediaItem)
    
    // Check if there's existing media on the current page
    const currentPage = getCurrentPage()
    const pageId = getPageId(currentPage!)
    const existingMedia = await getValidMediaForPage(pageId, { 
      types: ['image', 'video', 'youtube'], 
      verifyExistence: false 
    })
    
    if (results.length > 0) {
      // Store uploaded media and open lightbox for preview
      const firstResult = results[0]
      setUploadedMedia(results)
      setLightboxMedia(firstResult)
      setIsLightboxOpen(true)
    }
    
    // Final abort check before completing
    if (signal.aborted) {
      console.log('[MediaEnhancement] Upload was aborted during processing')
      setIsFileProcessing(false)
      setUploadProgress(null)
      event.target.value = ''
      return
    }
    
    setRecentlyUploadedIds(prev => new Set([...prev, ...newlyUploaded]))
    
    setIsFileProcessing(false)
    setUploadProgress(null)
    event.target.value = ''
    
      // Clear the AbortController reference on successful completion
      if (uploadAbortControllerRef.current?.signal === signal) {
        uploadAbortControllerRef.current = null
      }
    } catch (error) {
      // Handle upload errors and cleanup
      console.error('[MediaEnhancement] Upload error:', error)
      
      // Clean up on error
      setIsFileProcessing(false)
      setUploadProgress(null)
      event.target.value = ''
      
      // Clear the AbortController reference
      if (uploadAbortControllerRef.current?.signal === signal) {
        uploadAbortControllerRef.current = null
      }
      
      // Show error message if not aborted
      if (error instanceof Error && error.name !== 'AbortError') {
        setSearchError('Upload failed. Please try again.')
        setTimeout(() => setSearchError(null), 3000)
      }
    }
  }
  
  // FIX: Validate and extract YouTube video ID with security checks
  const extractYouTubeVideoId = (url: string): string | null => {
    // Validate URL format first
    try {
      const urlObj = new URL(url)
      
      // Only allow HTTPS for security
      if (urlObj.protocol !== 'https:') {
        console.warn('[MediaEnhancement] YouTube URL must use HTTPS:', url)
        return null
      }
      
      // Validate hostname (prevent open redirects and subdomain attacks)
      const validHosts = ['www.youtube.com', 'youtube.com', 'youtu.be', 'm.youtube.com']
      if (!validHosts.includes(urlObj.hostname)) {
        console.warn('[MediaEnhancement] Invalid YouTube hostname:', urlObj.hostname)
        return null
      }
      
      // Extract video ID based on URL format
      let videoId: string | null = null
      
      if (urlObj.hostname === 'youtu.be') {
        videoId = urlObj.pathname.slice(1)
      } else if (urlObj.pathname === '/watch') {
        videoId = urlObj.searchParams.get('v')
      } else if (urlObj.pathname.startsWith('/embed/')) {
        videoId = urlObj.pathname.slice(7)
      }
      
      // Validate video ID format (11 characters, alphanumeric with - and _)
      if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return videoId
      }
      
      console.warn('[MediaEnhancement] Invalid YouTube video ID format:', videoId)
      return null
    } catch (error) {
      console.error('[MediaEnhancement] Invalid URL:', url, error)
      return null
    }
  }
  
  // FIX: Generate secure YouTube embed URL
  const generateSecureYouTubeEmbed = (videoId: string): string => {
    // Use validated video ID to create secure embed URL
    // Include only safe parameters
    const safeParams = new URLSearchParams({
      'rel': '0', // Don't show related videos
      'modestbranding': '1', // Minimal YouTube branding
      'controls': '1', // Show player controls
    })
    
    return `https://www.youtube.com/embed/${videoId}?${safeParams.toString()}`
  }
  
  const handleSearch = async (resetPagination: boolean = true) => {
    if (!searchQuery.trim()) return
    
    // Use activeTab to determine search type
    const isVideoSearch = activeTab === 'videos'
    
    debugLogger.info('MEDIA_SEARCH', 'Starting media search', {
      searchQuery: searchQuery.trim(),
      searchType: isVideoSearch ? 'youtube' : 'images',
      pageId: getCurrentPage()?.id || `index-${currentPageIndex}`,
      isInitialSearch: resetPagination,
      currentResultPage: resetPagination ? 1 : resultPage
    })
    
    // Use different loading states for initial search vs pagination
    if (resetPagination) {
      setIsSearching(true) // Initial search - show loading on search button
    } else {
      setIsPaginationLoading(true) // Pagination search - don't block media clicks
    }
    setSearchError(null)
    setYoutubeMessage(null)
    
    try {
      if (isVideoSearch) {
        // Search YouTube videos
        const youtubeApiKey = apiKeys?.youtubeApiKey || ''
        if (!youtubeApiKey) {
          setYoutubeMessage("YouTube API key not configured. Please add it in settings.")
          setSearchResults([])
        } else {
          const videoResults = await searchYouTubeVideos(searchQuery, resultPage, youtubeApiKey)
          // Extract thumbnails for YouTube videos
          const thumbnails: { [key: string]: string } = {}
          videoResults.forEach(result => {
            if (result.url) {
              const videoId = extractYouTubeVideoId(result.url)
              if (videoId) {
                // Use high quality thumbnail
                thumbnails[result.id] = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
              }
            }
          })
          setVideoThumbnails(thumbnails)
          setSearchResults(videoResults)
        }
      } else {
        // Debug: Log API keys to diagnose search issues
        console.log('[MediaEnhancement] Searching Google Images with:', {
          query: searchQuery,
          hasApiKey: !!apiKeys?.googleImageApiKey,
          hasCseId: !!apiKeys?.googleCseId,
          apiKeyLength: apiKeys?.googleImageApiKey?.length || 0,
          cseIdLength: apiKeys?.googleCseId?.length || 0
        });
        
        const images = await searchGoogleImages(
          searchQuery, 
          resultPage, 
          apiKeys?.googleImageApiKey || '', 
          apiKeys?.googleCseId || ''
        )
        console.log('[MediaEnhancement] Search returned', images.length, 'results');
        
        // The searchGoogleImages function already returns SearchResult objects
        // No need to map them again
        setSearchResults(images)
      }
      setHasSearched(true)
      if (resetPagination) {
        setResultPage(1)
      }
    } catch (error) {
      console.error('Search error:', error)
      if (error instanceof SearchError) {
        setSearchError(error.message)
      } else {
        setSearchError('Search failed. Please try again.')
      }
      setSearchResults([])
    } finally {
      // Clear the appropriate loading state
      if (resetPagination) {
        setIsSearching(false)
      } else {
        setIsPaginationLoading(false)
      }
    }
  }

  // Wrapper function for onClick handlers to maintain TypeScript compatibility
  const handleSearchClick = () => handleSearch() // Uses default resetPagination=true
  
  const navigateToPage = (index: number) => {
    if (index >= 0 && index < totalPages) {
      setCurrentPageIndex(index)
      setSearchQuery('')
      setSearchResults([])
      setUploadedMedia([]) // Clear uploaded media when changing pages
      setHasSearched(false)
      setSearchError(null)
      setYoutubeMessage(null)
      setResultPage(1)
      setActiveTab('images') // Reset to images tab
    }
  }
  
  const handleAddSelectedMedia = async () => {
    // FIX: Capture page index at start of async operation
    const pageIndexAtStart = currentPageIndexRef.current
    
    const currentPage = getCurrentPage()
    if (!currentPage) return
    
    const pageId = getPageId(currentPage)
    const allResults = displayedResults
    const selectedItems: (SearchResult | Media)[] = []
    
    if (selectedItems.length === 0) return
    
    // Process selected media
    const newMedia: Media[] = []
    
    for (const item of selectedItems) {
      let mediaItem = mediaItemsRef.current.get(item.id)
      
      if (!mediaItem) {
        // Create new media item
        mediaItem = {
          id: item.id,
          type: item.embedUrl ? 'video' : 'image',
          title: item.title,
          url: item.url,
          thumbnail: item.thumbnail,
          embedUrl: item.embedUrl,
          storageId: item.id
        }
        
        mediaItemsRef.current.set(item.id, mediaItem)
      }
      
      // Check if this is a YouTube video
      const isYouTube = mediaItem.embedUrl && (
        mediaItem.url.includes('youtube.com') || 
        mediaItem.url.includes('youtu.be') ||
        mediaItem.embedUrl.includes('youtube.com/embed')
      )
      
      if (isYouTube) {
        // For YouTube videos, use the special storeYouTubeVideo method
        console.log('[MediaEnhancement] YouTube video detected, preserving URL:', mediaItem.url)
        
        try {
          const storedItem = await storeYouTubeVideo(
            mediaItem.url,
            mediaItem.embedUrl || '',
            pageId,
            {
              title: mediaItem.title,
              thumbnail: mediaItem.thumbnail
              // Duration will be available from ReactPlayer when needed
            }
          )
          
          mediaItem.storageId = storedItem.id
          console.log('[MediaEnhancement] Stored YouTube video:', storedItem.id)
        } catch (error) {
          // Properly serialize error for logging
          const errorInfo = error instanceof Error ? {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n')[0]
          } : error
          console.error('[MediaEnhancement] Failed to store YouTube video:', errorInfo)
        }
      } else if (item.id.startsWith('uploaded-') || recentlyUploadedIds.has(item.id)) {
        // Store non-YouTube media
        const fileToStore = mediaItem.blob ? new File([mediaItem.blob], mediaItem.title || 'media', { 
          type: mediaItem.blob.type 
        }) : null
        
        if (fileToStore) {
          try {
            // 🔧 CONTAMINATION FIX: Only include appropriate metadata for non-YouTube media
            // This prevents YouTube metadata from contaminating image storage
            const cleanMetadata: any = {
              title: mediaItem.title,
              thumbnail: mediaItem.thumbnail
            }
            
            // Only add embedUrl for actual video files (not images)
            if (mediaItem.type === 'video' && !mediaItem.isYouTube && mediaItem.embedUrl) {
              cleanMetadata.embedUrl = mediaItem.embedUrl
            }
            
            console.log('[MediaEnhancement] 🧹 Storing non-YouTube media with clean metadata:', {
              mediaId: mediaItem.id,
              type: mediaItem.type,
              cleanMetadata,
              originalEmbedUrl: mediaItem.embedUrl,
              isYouTube: mediaItem.isYouTube
            })
            
            const storedItem = await storeMedia(
              fileToStore,
              pageId,
              mediaItem.type as 'image' | 'video',
              cleanMetadata,
              (progress) => {
                // Update upload progress for individual file storage
                setUploadProgress({
                  current: 0,
                  total: 1,
                  fileName: mediaItem.title || 'media',
                  percent: progress.percent
                })
              }
            )
            
            mediaItem.storageId = storedItem.id
            console.log('[MediaEnhancement] Stored media:', storedItem.id)
          } catch (error) {
            // Properly serialize error for logging
            const errorInfo = error instanceof Error ? {
              message: error.message,
              name: error.name,
              stack: error.stack?.split('\n')[0]
            } : error
            console.error('[MediaEnhancement] Failed to store media:', errorInfo)
          }
        }
      }
      
      newMedia.push(mediaItem)
    }
    
    // FIX: Properly handle single media per page requirement
    // If multiple media items were processed, show user feedback
    if (newMedia.length > 1) {
      console.warn('[MediaEnhancement] Multiple media items selected, but only one media per page is allowed. Using the first item.')
      setSearchError('Only one media item per page is allowed. The first item was added.')
      setTimeout(() => setSearchError(null), 3000)
    }
    
    // Take only the first media item (more intuitive than last)
    const updatedPageMedia = newMedia.length > 0 ? [newMedia[0]] : []
    
    // FIX: Check if we're still on the same page before updating
    if (currentPageIndexRef.current !== pageIndexAtStart) {
      console.warn('[MediaEnhancement] Page changed during async operation, aborting update')
      setSearchError('Page changed during media processing. Please try again.')
      setTimeout(() => setSearchError(null), 3000)
      return
    }
    
    setExistingPageMedia(updatedPageMedia)
    
    // Clear recent uploads
    setRecentlyUploadedIds(new Set())
    
    // Update course content
    updatePageInCourseContent(currentPage, updatedPageMedia)
    
    // Reload existing media to get blob URLs for newly stored items
    setTimeout(() => {
      // MEDIA CLEARING FIX: Skip reload during clip timing updates
      if (!isUpdatingClipTimingRef.current) {
        loadExistingMedia()
      } else {
        console.log('[MediaEnhancement] Skipping delayed loadExistingMedia - clip timing update in progress')
      }
    }, 100)
  }
  
  const handleRemoveMedia = (mediaId: string) => {
    // DELETION FIX: Add protective logging and confirmation
    console.error('🚨 [DELETION DEBUG] handleRemoveMedia called!', {
      mediaId,
      stackTrace: new Error().stack,
      timestamp: new Date().toISOString()
    })
    
    const mediaToRemove = existingPageMedia.find(m => m.id === mediaId)
    if (mediaToRemove) {
      // DELETION FIX: Enhanced confirmation with clear warning for YouTube videos with clip timing
      const hasClipTiming = mediaToRemove.clipStart !== undefined || mediaToRemove.clipEnd !== undefined
      const isYouTubeWithTiming = mediaToRemove.isYouTube && hasClipTiming
      
      const confirmationTitle = isYouTubeWithTiming 
        ? `${mediaToRemove.title || 'this YouTube video'} (with clip timing: ${mediaToRemove.clipStart || 0}s-${mediaToRemove.clipEnd || 'end'}s)`
        : mediaToRemove.title || 'this media'
        
      setRemoveConfirm({ 
        id: mediaId, 
        title: confirmationTitle
      })
    }
  }
  
  const confirmRemoveMedia = async () => {
    if (!removeConfirm) return
    
    const mediaToRemove = existingPageMedia.find(m => m.id === removeConfirm.id)
    if (mediaToRemove?.storageId) {
      // React modal already handled the confirmation - proceed with deletion
      const hasClipTiming = mediaToRemove.clipStart !== undefined || mediaToRemove.clipEnd !== undefined
      
      // DEFENSIVE LOGGING: Track intentional video deletion
      console.error('🚨 [DELETION DEBUG] Video deletion triggered from confirmRemoveMedia (intentional removal)!', {
        mediaId: mediaToRemove.id,
        storageId: mediaToRemove.storageId,
        mediaType: mediaToRemove.type,
        hasClipTiming,
        clipStart: mediaToRemove.clipStart,
        clipEnd: mediaToRemove.clipEnd,
        stackTrace: new Error().stack,
        timestamp: new Date().toISOString(),
        confirmDialogData: removeConfirm
      })
      
      // Delete from storage
      await deleteMedia(mediaToRemove.storageId)
      
      // Clear enriched metadata cache
      enrichedMetadataCacheRef.current.delete(mediaToRemove.storageId)
      
      // Clean up blob URL tracking (but don't revoke the URL)
      if (mediaToRemove.storageId) {
        setBlobUrls(prev => {
          const newMap = new Map(prev)
          newMap.delete(mediaToRemove.storageId!)
          return newMap
        })
      }
    }
    
    const updatedMedia = existingPageMedia.filter(m => m.id !== removeConfirm.id)
    setExistingPageMedia(updatedMedia)
    
    const currentPage = getCurrentPage()
    if (currentPage) {
      updatePageInCourseContent(currentPage, updatedMedia)
    }
    
    // Mark media section as dirty after successful media removal
    markDirty('media')
    
    setRemoveConfirm(null)
  }
  
  // PERFORMANCE: Handle page selection from thumbnail grid - memoized
  const handlePageSelect = React.useCallback((pageId: string) => {
    let newIndex = -1
    
    // Find the page index - support both old and new ID formats
    if (pageId === 'welcome' || pageId === 'content-0') {
      // Handle both 'welcome' and old 'content-0' format
      newIndex = 0
    } else if (pageId === 'objectives' || pageId === 'learning-objectives' || pageId === 'content-1') {
      // Handle 'objectives', 'learning-objectives', and old 'content-1' format
      newIndex = 1
    } else {
      // Find topic index
      const topicIndex = (courseContent as CourseContent).topics.findIndex(t => t.id === pageId)
      if (topicIndex !== -1) {
        newIndex = topicIndex + 2
      }
    }
    
    // Navigate to the page with state clearing
    if (newIndex >= 0) {
      console.log('[MediaEnhancementWizard] Navigating to page index:', newIndex, 'from pageId:', pageId)
      navigateToPage(newIndex)
    }
  }, [courseContent])
  
  // PERFORMANCE: Memoized tab change handler  
  const handleTabChange = React.useCallback((tab: string) => {
    setActiveTab(tab as 'images' | 'videos' | 'upload' | 'ai')
    // Clear search results and query when switching tabs
    setSearchResults([])
    setSearchQuery('')
    setSearchError(null)
    setResultPage(1) // Reset pagination when switching tabs
  }, [])
  
  // Handle content editing
  const handleSaveContent = (newContent: string) => {
    const currentPage = getCurrentPage()
    if (!currentPage || !onUpdateContent) return
    
    // FIX: Sanitize content before saving to prevent XSS attacks
    // Configure DOMPurify to allow safe HTML elements and attributes
    const sanitizedContent = DOMPurify.sanitize(newContent, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'video', 'iframe',
        'div', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th'
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'src', 'alt', 'title', 'width', 'height',
        'class', 'id', 'style', 'data-*', 'controls', 'autoplay',
        'allowfullscreen', 'frameborder'
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
      // Allow data attributes for our media system
      ADD_ATTR: ['data-media-id', 'data-media-youtube']
    })
    
    const updatedPage = { ...currentPage, content: sanitizedContent }
    const updatedContent = structuredClone(courseContent) as CourseContent
    
    if (currentPageIndex === 0) {
      updatedContent.welcomePage = updatedPage as Page
    } else if (currentPageIndex === 1) {
      updatedContent.learningObjectivesPage = updatedPage as Page
    } else {
      const topicIndex = currentPageIndex - 2
      if (updatedContent.topics && topicIndex >= 0) {
        updatedContent.topics[topicIndex] = updatedPage as Topic
      }
    }
    
    onUpdateContent(updatedContent)
    
    // Mark media section as dirty after content editing
    markDirty('media')
    
    setIsEditingContent(false)
  }
  
  // Get image source handling CORS-restricted domains
  const handleMediaClick = (mediaId: string) => {
    console.log('[MediaEnhancement] Media clicked:', mediaId)
    setPreviewMediaId(mediaId)
    setPreviewDialogOpen(true)
  }

  const getPreviewContent = () => {
    if (!previewMediaId) return null
    
    const media = existingPageMedia.find(m => m.id === previewMediaId)
    if (!media) return null
    
    // 🔍 DEBUG: Log the exact media object being used for preview
    console.log('[PREVIEW DEBUG] 🔍 getPreviewContent media object:', {
      mediaId: media.id,
      type: media.type,
      title: media.title,
      clipStart: media.clipStart,
      clipEnd: media.clipEnd,
      hasClipStart: media.clipStart !== undefined,
      hasClipEnd: media.clipEnd !== undefined,
      clipStartType: typeof media.clipStart,
      clipEndType: typeof media.clipEnd,
      mediaKeys: Object.keys(media),
      fullMedia: media
    })
    
    if (media.type === 'video' || media.type === 'youtube') {
      // Check if it's a YouTube video, including enriched metadata
      const hasYouTubeUrl = media.embedUrl || 
                           (media.url && (media.url.includes('youtube.com') || media.url.includes('youtu.be'))) ||
                           (media as any).metadata?.youtubeUrl ||
                           (media as any).metadata?.embedUrl ||
                           enrichedMetadata.get(media.id)?.metadata?.youtubeUrl ||
                           enrichedMetadata.get(media.id)?.metadata?.embedUrl
      
      if (hasYouTubeUrl) {
        // DEBUG: Log the clip timing data flow
        console.log('[YouTube Clip Display] 🎬 Rendering YouTube video with timing data:', {
          mediaId: media.id,
          title: media.title,
          originalUrl: media.url,
          embedUrl: media.embedUrl,
          clipStart: media.clipStart,
          clipEnd: media.clipEnd,
          hasClipTiming: (media.clipStart !== undefined || media.clipEnd !== undefined)
        })
        
        // Generate embed URL with clip timing if available - use enriched metadata fallback
        const youtubeUrl = media.url || media.embedUrl || 
                          (media as any).metadata?.youtubeUrl ||
                          (media as any).metadata?.embedUrl ||
                          enrichedMetadata.get(media.id)?.metadata?.youtubeUrl ||
                          enrichedMetadata.get(media.id)?.metadata?.embedUrl || ''
                          
        // ALWAYS use buildYouTubeEmbed for URL validation and safety
        const embedUrl = buildYouTubeEmbed(youtubeUrl, media.clipStart, media.clipEnd)

        // Additional safety check - never allow problematic URLs
        if (!embedUrl || embedUrl === 'about:blank' || embedUrl === 'https://www.youtube.com/') {
          console.error('[YouTube Clip Display] Invalid embed URL, skipping video display:', {
            mediaId: media.id,
            originalUrl: youtubeUrl,
            finalEmbedUrl: embedUrl
          })
          return <div className={styles.noPreview}>Invalid YouTube URL</div>
        }

        console.log('[YouTube Clip Display] 📺 Final iframe src URL:', {
          mediaId: media.id,
          finalEmbedUrl: embedUrl,
          urlLength: embedUrl.length,
          containsClipParams: embedUrl.includes('&t=') || embedUrl.includes('?t=') || embedUrl.includes('start=') || embedUrl.includes('end=')
        })
          
        return (
          <div 
            className={styles.videoPreviewContainer}
            ref={(el) => {
              if (el) {
                // Set container ready immediately when video container mounts
                // YouTube iframes don't reliably fire onLoad events due to cross-origin restrictions
                setTimeout(() => {
                  setVideoContainerReady(true)
                }, 100) // Small delay to ensure DOM stability
              }
            }}
          >
            <iframe
              src={embedUrl}
              width="100%"
              height="400"
              frameBorder="0"
              allowFullScreen
              title={media.title}
            />
          </div>
        )
      }
      // Regular video - use blob URL if available
      const videoId = media.storageId || media.id
      const videoUrl = blobUrls.get(videoId) || media.url
      return (
        <video
          src={videoUrl}
          controls
          className={styles.mediaVideo}
          title={media.title}
        />
      )
    } else {
      // Image - use blob URL if available 
      const imageId = media.storageId || media.id
      const imageUrl = blobUrls.get(imageId) || media.url
      return (
        <img
          src={imageUrl}
          alt={media.title}
          className={styles.mediaImage}
        />
      )
    }
  }

  const getImageSource = (url: string, isSearchResult: boolean = false, storageId?: string): string | undefined => {
    // Handle undefined/null URLs - return undefined to avoid empty src warning
    if (!url) {
      console.log('[MediaEnhancement v2.0.6] getImageSource: URL is null/undefined')
      return undefined
    }
    
    // Handle blob URLs directly
    if (url.startsWith('blob:')) {
      console.log('[MediaEnhancement v2.0.6] getImageSource: Using blob URL directly')
      return url
    }
    
    // Handle asset:// and asset.localhost URLs - need blob URLs for display
    if (url.startsWith('asset://') || url.includes('asset.localhost')) {
      logger.info('[MediaEnhancement v2.0.6] Asset URL detected, need blob URL', { url, storageId })
      console.log('[MediaEnhancement v2.0.6] getImageSource: Asset URL needs blob conversion:', url)
      
      // If we have a storageId, check if we have a blob URL for it
      if (storageId) {
        const blobUrl = blobUrls.get(storageId)
        if (blobUrl) {
          console.log('[MediaEnhancement v2.0.6] Found blob URL for asset:', blobUrl)
          return blobUrl
        }
      }
      
      // Return empty string - blob URL will be created asynchronously
      return ''
    }
    
    // For media references, try to get the URL from cache
    if (url.startsWith('scorm-media://')) {
      const [, , mediaStorageId] = url.split('/')
      
      // Check if we have a YouTube URL in the media items
      const mediaItem = existingPageMedia.find(m => m.storageId === mediaStorageId)
      if (mediaItem?.embedUrl && (mediaItem.url.includes('youtube.com') || mediaItem.url.includes('youtu.be'))) {
        console.log('[MediaEnhancement] Found YouTube URL:', mediaItem.url)
        return mediaItem.url
      }
      
      // Get blob URL from blob manager if available
      const blobUrl = blobUrls.get(mediaStorageId)
      if (blobUrl) {
        return blobUrl
      }
      
      // Return placeholder - blob URL will be loaded asynchronously
      return ''
    }
    
    // For CORS-restricted domains, don't show in search results
    if (isSearchResult && isKnownCorsRestrictedDomain(url)) {
      return ''
    }
    
    return url
  }
  
  // Load blob URLs for media items
  useEffect(() => {
    const loadBlobUrls = async () => {
      for (const media of existingPageMedia) {
        if (media.storageId && !blobUrls.has(media.storageId)) {
          // Skip YouTube videos (they have their own thumbnails)
          if (media.embedUrl && (media.url?.includes('youtube.com') || media.url?.includes('youtu.be'))) {
            continue
          }
          
          // Skip data URLs (e.g., inline SVGs)
          if (media.url?.startsWith('data:')) {
            continue
          }
          
          // Create blob URLs for all images, including those with asset:// or asset.localhost URLs
          try {
            if (media.storageId) {
              console.log('[MediaEnhancement v2.0.6] Creating blob URL for storageId:', media.storageId)
              const blobUrl = await createBlobUrl(media.storageId)
              if (blobUrl) {
                setBlobUrls(prev => {
                  const newMap = new Map(prev)
                  newMap.set(media.storageId!, blobUrl)
                  return newMap
                })
                console.log('[MediaEnhancement v2.0.6] Created blob URL for', media.storageId, ':', {
                  url: blobUrl,
                  isAssetUrl: blobUrl.startsWith('asset://'),
                  isBlobUrl: blobUrl.startsWith('blob:')
                })
              } else {
                console.error('[MediaEnhancement v2.0.6] Failed to create blob URL for:', media.storageId)
              }
            }
          } catch (error) {
            // Properly serialize error for logging
            const errorInfo = error instanceof Error ? {
              message: error.message,
              name: error.name,
              stack: error.stack?.split('\n')[0]
            } : error
            console.error('[MediaEnhancement] Failed to create blob URL for', media.storageId, ':', errorInfo)
          }
        }
      }
    }
    
    loadBlobUrls()
  }, [existingPageMedia, createBlobUrl])
  
  // Effect to trigger new search when pagination changes
  useEffect(() => {
    // Trigger search for any page change after initial search has been performed
    // This includes going back to page 1 from page 2 (which was previously broken)
    if (hasSearched && searchQuery.trim()) {
      handleSearch(false) // Don't reset pagination when triggered by pagination change
    }
  }, [resultPage])
  
  // Note: For API pagination, we don't slice results locally since each search already returns the correct page
  // The searchResults array contains only the current page's results from the API
  // (searchResultsArray and uploadedMediaArray are now memoized earlier in the component)
  
  // For API-based pagination, we assume there are more pages if we got a full page of results (10 items)
  // This matches how the searchService mock data works (it provides 100 results across 10 pages)
  const hasNextPage = searchResultsArray.length === 10 // If we got 10 results, there might be more pages
  const totalResultPages = hasNextPage ? Math.max(resultPage + 1, 10) : resultPage // Estimate pages based on current results
  
  // Scroll to Add Media section
  const scrollToAddMedia = () => {
    const addMediaCard = document.querySelector('[data-testid="add-media-card"]')
    if (addMediaCard) {
      addMediaCard.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Wrapped onNext function that resets dirty flag on successful navigation
  const handleNext = React.useCallback(async (content: CourseContentUnion) => {
    try {
      console.log('[MediaEnhancement] handleNext called, ensuring latest media data...')
      
      // 🔧 FIX: Ensure we have the absolute latest course content with all loaded media
      // This addresses the race condition where loadExistingMedia might not have completed
      let finalContent = content
      
      // CRITICAL FIX: Ensure ALL pages have their latest media data, not just current page
      // This prevents the "last page wins" bug where only the current page's media is preserved
      if ('topics' in content) {
        const currentPage = getCurrentPage()
        if (currentPage && existingPageMedia.length > 0) {
          console.log('[MediaEnhancement] Synchronizing current page media with clip timing:', {
            pageId: currentPage.id,
            mediaCount: existingPageMedia.length,
            mediaWithClipTiming: existingPageMedia.filter(m => m.clipStart !== undefined || m.clipEnd !== undefined).length
          })
          
          // Clone the content and update ONLY the current page with latest media
          // CRITICAL: Other pages' media is preserved as-is to prevent data loss
          const updatedContent = structuredClone(content as CourseContent)
          
          if (currentPage.id === 'welcome') {
            updatedContent.welcomePage.media = existingPageMedia
          } else if (currentPage.id === 'objectives') {
            updatedContent.learningObjectivesPage.media = existingPageMedia
          } else {
            // Find topic by ID and update its media
            const topicIndex = updatedContent.topics.findIndex(t => t.id === currentPage.id)
            if (topicIndex >= 0) {
              updatedContent.topics[topicIndex].media = existingPageMedia
            }
          }
          
          finalContent = updatedContent
          
          // ENHANCED DEBUG: Log all pages' media with clip timing to verify preservation
          console.log('[MediaEnhancement] ✅ Final content synchronized - media summary by page:')
          console.log('Welcome media:', (finalContent as CourseContent).welcomePage.media?.length || 0)
          console.log('Objectives media:', (finalContent as CourseContent).learningObjectivesPage.media?.length || 0)
          ;(finalContent as CourseContent).topics.forEach((topic, index) => {
            const mediaWithTiming = topic.media?.filter(m => m.clipStart !== undefined || m.clipEnd !== undefined) || []
            console.log(`Topic ${index} (${topic.id}) media: ${topic.media?.length || 0}, with clip timing: ${mediaWithTiming.length}`)
            if (mediaWithTiming.length > 0) {
              mediaWithTiming.forEach(m => console.log(`  - ${m.title}: ${m.clipStart}s-${m.clipEnd}s`))
            }
          })
        }
      }
      
      await onNext(finalContent)
      // Reset media dirty flag only on successful next
      resetDirty('media')
    } catch (error) {
      // If onNext fails, don't reset dirty flag
      console.error('Failed to proceed to next step:', error)
      throw error // Re-throw to maintain error handling
    }
  }, [onNext, resetDirty, getCurrentPage, existingPageMedia])

  // RENDER FIX: Filter to visual media only to prevent empty src warnings for audio/caption
  const visualMedia = useMemo(() => {
    console.log('[MediaEnhancement] 🔍 VISUAL MEDIA FILTERING DEBUG - Raw input media:', existingPageMedia?.map(m => ({
      id: m.id,
      type: m.type,
      isYouTube: m.isYouTube,
      hasUrl: !!m.url,
      hasMetadata: !!(m as any).metadata,
      metadataKeys: (m as any).metadata ? Object.keys((m as any).metadata) : [],
      fullMedia: m
    })))
    
    const filtered = (existingPageMedia || []).filter(m => {
      const isVisual = m.type === 'image' || m.type === 'video' || m.type === 'youtube'
      console.log(`[MediaEnhancement] 🔍 Media filtering for ${m.id}:`, {
        id: m.id,
        type: m.type,
        isYouTube: m.isYouTube,
        isVisual,
        hasUrl: !!m.url,
        hasMetadata: !!(m as any).metadata,
        metadataKeys: (m as any).metadata ? Object.keys((m as any).metadata) : [],
        reason: isVisual ? 'INCLUDED' : 'EXCLUDED'
      })
      return isVisual
    })
    
    console.log(`[MediaEnhancement] 📊 Visual media filtering summary:`, {
      totalMediaCount: existingPageMedia?.length || 0,
      visualMediaCount: filtered.length,
      willShowGrid: filtered.length > 0,
      willShowNoMediaMessage: filtered.length === 0
    })
    
    return filtered
  }, [existingPageMedia])

  // PERFORMANCE: Memoize existing media items to prevent expensive re-rendering
  const renderedExistingMedia = useMemo(() => {
    console.log('[MediaEnhancement] 🎨 Rendering visual media items only:', {
      totalCount: existingPageMedia.length,
      visualCount: visualMedia.length,
      filteredTypes: visualMedia.map(m => m.type),
      items: visualMedia.map(media => ({
        id: media.id,
        type: media.type,
        title: media.title,
        isYouTube: media.isYouTube,
        hasUrl: !!media.url,
        url: media.url,
        clipStart: media.clipStart,
        clipEnd: media.clipEnd,
        // Additional debugging for the Current Media section
        willRenderClipTiming: media.isYouTube && (media.clipStart !== undefined || media.clipEnd !== undefined)
      }))
    })
    
    return visualMedia.map((media) => (
      <div 
        key={media.id} 
        className={styles.mediaItem}
        onClick={() => handleMediaClick(media.id)}
      >
        <div className={styles.mediaThumbnailContainer}>
          {(media.type === 'video' || media.type === 'youtube') && media.isYouTube ? (
            // YouTube video thumbnail - enhanced with URL fallback logic
            (() => {
              // Try multiple URL locations for YouTube URL (same logic as PageThumbnailGrid)
              // FIXED: Also check nested metadata like PageThumbnailGrid does
              let youtubeUrl = (media as any).youtubeUrl || 
                               media.embedUrl ||
                               media.url ||
                               (media as any).metadata?.youtubeUrl ||
                               (media as any).metadata?.embedUrl ||
                               (media as any).metadata?.url
              
              // If no YouTube URL found in basic metadata, try enriched metadata (same as PageThumbnailGrid)
              if (!youtubeUrl) {
                console.log('[MediaEnhancement] 🔄 No YouTube URL in basic metadata, checking enriched cache for:', media.id)
                
                // Check if we already have enriched metadata cached
                const cachedMetadata = enrichedMetadata.get(media.id)
                if (cachedMetadata?.metadata) {
                  // Extract YouTube URL from cached enriched metadata
                  youtubeUrl = cachedMetadata.metadata.youtubeUrl || 
                              cachedMetadata.metadata.embedUrl ||
                              cachedMetadata.url
                  
                  console.log('[MediaEnhancement] 📦 Using cached enriched metadata for:', media.id, {
                    enrichedYoutubeUrl: cachedMetadata.metadata.youtubeUrl,
                    enrichedEmbedUrl: cachedMetadata.metadata.embedUrl,
                    enrichedDirectUrl: cachedMetadata.url,
                    finalUrl: youtubeUrl
                  })
                }
                
                // If still no URL and not cached, we'll need async enrichment
                // This will be handled by a React effect since we can't do async in render
                if (!youtubeUrl && !cachedMetadata) {
                  console.log('[MediaEnhancement] ⏳ YouTube URL requires async enrichment for:', media.id)
                }
              }
              
              const videoIdMatch = youtubeUrl?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\n?#]+)/)
              const videoId = videoIdMatch ? videoIdMatch[1] : null
              const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null
              
              console.log('[MediaEnhancement] 🔎 DEEP YouTube URL extraction debug:', {
                mediaId: media.id,
                mediaType: media.type,
                isYouTube: media.isYouTube,
                // Direct properties
                directYoutubeUrl: (media as any).youtubeUrl,
                directEmbedUrl: media.embedUrl,
                directUrl: media.url,
                // Metadata exploration
                hasMetadata: !!(media as any).metadata,
                metadataKeys: (media as any).metadata ? Object.keys((media as any).metadata) : [],
                metadataYoutubeUrl: (media as any).metadata?.youtubeUrl,
                metadataEmbedUrl: (media as any).metadata?.embedUrl,
                metadataUrl: (media as any).metadata?.url,
                // Complete metadata dump for analysis
                fullMetadata: (media as any).metadata,
                // Extraction logic results
                urlExtractionResults: {
                  step1_directYoutubeUrl: (media as any).youtubeUrl || null,
                  step2_directEmbedUrl: media.embedUrl || null,
                  step3_directUrl: media.url || null,
                  step4_metadataYoutubeUrl: (media as any).metadata?.youtubeUrl || null,
                  step5_metadataEmbedUrl: (media as any).metadata?.embedUrl || null,
                  step6_metadataUrl: (media as any).metadata?.url || null,
                  finalSelectedUrl: youtubeUrl
                },
                // Video ID extraction
                videoIdMatch: youtubeUrl?.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\n?#]+)/),
                videoId,
                // Final thumbnail URL
                finalThumbnailUrl: thumbnailUrl,
                // Decision outcome
                willShowThumbnail: !!thumbnailUrl,
                willShowPlaceholder: !thumbnailUrl
              })
              
              return thumbnailUrl ? (
                <div className={styles.mediaItemInner}>
                  <img
                    src={thumbnailUrl}
                    alt={media.title || 'Video thumbnail'}
                    className={styles.mediaThumbnail}
                    onLoad={() => {
                      console.log('[MediaEnhancement] ✅ YouTube thumbnail loaded successfully:', thumbnailUrl)
                    }}
                    onError={(e) => {
                      console.error('[MediaEnhancement] ❌ YouTube thumbnail failed to load:', {
                        thumbnailUrl,
                        error: e,
                        mediaId: media.id,
                        videoId,
                        originalYoutubeUrl: youtubeUrl
                      })
                      const target = e.target as HTMLImageElement
                      target.classList.add(styles.hidden)
                      const parent = target.parentElement
                      if (parent) {
                        const fallbackDiv = document.createElement('div')
                        fallbackDiv.className = styles.videoThumbnailPlaceholder
                        fallbackDiv.textContent = '📹 Video'
                        parent.appendChild(fallbackDiv)
                      }
                    }}
                  />
                </div>
              ) : (
                <div className={styles.mediaItemInner}>
                  <span className={styles.videoThumbnailPlaceholder}>📹 Video</span>
                </div>
              )
            })()
          ) : (
            // Regular image (only render <img> when a non-empty URL exists)
            <div className={styles.mediaItemInner}>
              {(() => {
                const id = media.storageId || media.id
                const url = id ? blobUrls.get(id) : undefined
                const hasTimedOut = loadingTimeouts.has(id)

                // Debug logging for image loading issues
                if (id && !url && !hasTimedOut) {
                  console.log(`[MediaEnhancement] Loading state for ${id}:`, {
                    id,
                    hasUrl: !!url,
                    hasTimedOut,
                    blobUrlsSize: blobUrls.size,
                    isCurrentlyLoading: currentlyLoadingRef.current.has(id)
                  })
                }

                // Set timeout for loading if not already set and no URL yet
                if (!url && id && !hasTimedOut && !currentlyLoadingRef.current.has(id)) {
                  currentlyLoadingRef.current.add(id)
                  setTimeout(() => {
                    setLoadingTimeouts(prev => new Set([...prev, id]))
                    currentlyLoadingRef.current.delete(id)
                  }, 5000) // 5 second timeout
                }

                return url ? (
                  <img
                    src={url}                // <-- guaranteed non-empty here
                    alt={media.title || 'Media'}
                    className={styles.mediaThumbnail}
                    onError={(e) => {
                      console.log('[MediaEnhancement] Media thumbnail failed to load:', url)
                      const target = e.target as HTMLImageElement
                      target.classList.add(styles.hidden)
                    }}
                  />
                ) : hasTimedOut ? (
                  <div className={styles.mediaPlaceholder}>
                    <span>⚠️ Failed to load</span>
                    <button
                      onClick={() => {
                        setLoadingTimeouts(prev => {
                          const next = new Set(prev)
                          next.delete(id)
                          return next
                        })
                        currentlyLoadingRef.current.delete(id)
                      }}
                      className={styles.retryButton}
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className={styles.mediaPlaceholder}>
                    <span>Loading...</span>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Action buttons overlay */}
          <div className={styles.mediaActionsOverlay}>
            {media.type === 'image' && (
              <Button
                variant="secondary"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  handleEditImage(media)
                }}
                aria-label="Edit image"
                data-testid={`edit-media-${media.id}`}
                className={styles.overlayButton}
              >
                <Icon icon={Edit} size="sm" />
              </Button>
            )}
            
            {/* 🔧 FIX: Add Edit Clip Timing button for existing YouTube videos */}
            {media.isYouTube && (
              <Button
                variant="primary"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  
                  // Open lightbox with existing YouTube video for clip timing editing
                  const existingAsSearchResult: SearchResult = {
                    id: media.id,
                    title: media.title || 'YouTube Video',
                    url: media.url,
                    thumbnail: media.thumbnail,
                    isYouTube: true,
                    embedUrl: media.embedUrl,
                    clipStart: media.clipStart,
                    clipEnd: media.clipEnd
                  }
                  
                  console.log('[MediaEnhancement] 🎬 Opening clip timing editor for existing video:', {
                    mediaId: media.id,
                    title: media.title,
                    clipStart: media.clipStart,
                    clipEnd: media.clipEnd
                  })
                  
                  setLightboxMedia(existingAsSearchResult)
                  setIsLightboxOpen(true)
                  // Don't set clipStart/clipEnd state here - let the useEffect handle it from lightboxMedia
                }}
                aria-label="Edit YouTube clip timing"
                data-testid={`edit-clip-timing-${media.id}`}
                className={styles.overlayButton}
                title="Edit clip timing"
              >
                <Icon icon={Scissors} size="sm" />
              </Button>
            )}
            
            <Button
              variant="secondary" 
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                // Direct removal - React modal will handle all confirmation
                handleRemoveMedia(media.id)
              }}
              aria-label={`Remove ${media.isYouTube && (media.clipStart !== undefined || media.clipEnd !== undefined) ? 'YouTube video with clip timing' : 'media'}`}
              data-testid={`remove-media-${media.id}`}
              className={styles.overlayButton}
              title={media.isYouTube && (media.clipStart !== undefined || media.clipEnd !== undefined) ? 'Remove YouTube video (has clip timing)' : 'Remove media'}
            >
              <Icon icon={Trash2} size="sm" />
            </Button>
          </div>
        </div>
        <div className={styles.mediaInfo}>
          <p className={styles.mediaTitle}>
            {media.title || 'Untitled'}
          </p>
          
          {/* Enhanced Clip Timing Display for Current Media */}
          {(() => {
            const shouldShow = media.isYouTube && (
              (typeof media.clipStart === 'number' && !isNaN(media.clipStart)) ||
              (typeof media.clipEnd === 'number' && !isNaN(media.clipEnd))
            );
            console.log('🎯 [Current Media Section] Checking Enhanced Clip Timing Display - DETAILED:');
            console.log('  📍 Media ID:', media.id);
            console.log('  📍 Media Type:', media.type);
            console.log('  📍 Is YouTube:', media.isYouTube);
            console.log('  📍 Clip Start:', media.clipStart, '(type:', typeof media.clipStart, ')');
            console.log('  📍 Clip End:', media.clipEnd, '(type:', typeof media.clipEnd, ')');
            console.log('  📍 Has Clip Start:', media.clipStart !== undefined && media.clipStart !== null);
            console.log('  📍 Has Clip End:', media.clipEnd !== undefined && media.clipEnd !== null);
            console.log('  📍 Should Show:', shouldShow);
            console.log('  📍 All Media Keys:', Object.keys(media));
            console.log('  📍 Media Keys Available:', Object.keys(media).join(', '));
            console.log('  📍 Full Media Object:', JSON.stringify(media, null, 2));
            return shouldShow ? (
              <EnhancedClipTimingDisplay 
                media={media} 
                styles={styles}
              />
            ) : null;
          })()}
        </div>

      </div>
    ))
  }, [visualMedia, blobUrls, handleMediaClick, setLightboxMedia, setStartText, setEndText, setClipStart, setClipEnd, setIsLightboxOpen, formatSecondsToTime, styles])

  return (
    <PageLayout
      currentStep={3}
      title="Media Enhancement"
      description="Add images and videos to your course content"
      onBack={onBack}
      onNext={() => handleNext(courseContentRef.current)}
      nextDisabled={false}
      onSettingsClick={onSettingsClick}
      onHelp={onHelp}
      onSave={onSave}
      onOpen={onOpen}
      onStepClick={onStepClick}
      autoSaveIndicator={onSave && <AutoSaveBadge />}
      actions={
        <Button
          variant="primary"
          size="medium"
          onClick={scrollToAddMedia}
          aria-label="Add media to current page"
          data-testid="header-add-media-button"
        >
          <Icon icon={Plus} size="sm" />
          Add Media
        </Button>
      }
    >
      <div className={styles.mainLayout}>
        {/* Left Sidebar - Page Navigation */}
        <div className={styles.leftSidebar}>
          <h3 className={styles.sidebarTitle}>Page Navigation</h3>
          <PageThumbnailGrid
            courseContent={validatedCourseContent}
            currentPageId={getCurrentPage()?.id || ''}
            onPageSelect={handlePageSelect}
          />
        </div>
        
        {/* Right Content Area */}
        <div className={styles.rightContent}>
          <Section>
            {/* Current Page Info */}
            <Card className={styles.currentPageCard} data-testid="current-page-info-card">
              {/* Header row with title and Edit button */}
              <div className={styles.pageHeader}>
                <h2 className={styles.pageTitle}>{getCurrentPageTitle}</h2>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setIsEditingContent(true)}
                  disabled={isEditingContent}
                  data-testid="edit-content-button"
                >
                  <Icon icon={Edit} size="sm" data-testid="edit-icon" />
                  Edit Content
                </Button>
              </div>
              
              {/* Content preview below the header */}
              <div 
                data-testid="page-content-preview"
                className={styles.contentPreview}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getCurrentPage()?.content || '') }}
              />
            </Card>
            
            {/* Contamination Cleanup Warning */}
            {contaminationDetected && (
              <Alert 
                variant="warning" 
                className={styles.contaminationWarning}
                data-testid="contamination-warning"
              >
                <div className={styles.contaminationContent}>
                  <div className={styles.contaminationMessage}>
                    <strong>Media Issues Detected</strong>
                    <p>Some media files have corrupted metadata that may cause display issues. Click below to fix these problems.</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={handleManualContaminationCleanup}
                    disabled={isCleaningContamination}
                    data-testid="manual-cleanup-button"
                    className={styles.cleanupButton}
                  >
                    <Icon icon={Shield} size="sm" />
                    {isCleaningContamination ? 'Fixing Issues...' : 'Fix Media Issues'}
                  </Button>
                </div>
              </Alert>
            )}
            
            {/* Loading indicator */}
            {isLoadingMedia && (
              <Card className={styles.loadingCard} data-testid="media-loading-card">
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner} data-testid="loading-spinner" />
                  <div className={styles.loadingText}>
                    <p>Loading media...</p>
                    {loadingProgress.total > 0 && (
                      <p className={styles.progressText} data-testid="loading-progress">
                        {loadingProgress.current} / {loadingProgress.total} items loaded
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}
            
            {/* Existing Visual Media */}
            {!isLoadingMedia && visualMedia.length > 0 && (() => {
              console.log('[MediaEnhancement] 🎯 RENDERING CURRENT MEDIA GRID:', {
                isLoadingMedia,
                visualMediaLength: visualMedia.length,
                renderedExistingMediaCount: renderedExistingMedia.length,
                willRenderGrid: !isLoadingMedia && visualMedia.length > 0
              })
              return (
                <Card className={styles.mediaCard}>
                  <h3 className={styles.mediaTitle}>Current Media</h3>
                  <div className={styles.mediaGrid}>
                    {renderedExistingMedia}
                  </div>
                </Card>
              )
            })()}
          
          {/* Show "No media" message when page has no visual media */}
          {visualMedia.length === 0 && (
            <Card className={styles.noMediaCard}>
              <h3 className={styles.cardTitle}>Current Media</h3>
              <div className={styles.noMediaMessage}>
                <p>No media added yet</p>
                <p className={styles.noMediaHint}>
                  Use the options below to add images or videos to this page
                </p>
                <p className={styles.addMediaText}>
                  ↓ Add Media Below ↓
                </p>
              </div>
            </Card>
          )}
          </Section>
          
          {/* Add New Media */}
          <Section>
          <Card data-testid="add-media-card">
            <h3 className={styles.cardTitle}>Add New Media</h3>
            
            {/* Tabbed Interface */}
            <Tabs activeTab={activeTab} onChange={handleTabChange}>
              <Tab 
                tabKey="images" 
                label="Search Images" 
                icon={<ImageIcon size={16} data-testid="image-icon" />}
              >
                <div>
                  {/* Search History Dropdown */}
                  <div data-testid="search-history-dropdown" className={styles.searchHistory}>
                    <span className={styles.searchHistoryLabel}>Recent searches</span>
                  </div>
                  
                  {/* Image Prompt Suggestions */}
                  {imagePromptSuggestions.length > 0 && (
                    <div className={styles.suggestionSection}>
                      <p className={styles.suggestionLabel}>
                        Suggested searches:
                      </p>
                      <div className={styles.suggestionList}>
                        {imagePromptSuggestions.map((suggestion, index) => (
                          <Button
                            key={index}
                            variant="secondary"
                            size="small"
                            onClick={() => {
                              setSearchQuery(suggestion)
                              setTriggerSearch(true)
                            }}
                            aria-label={`Search for ${suggestion}`}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Image Search Input with Size Filter */}
                  <Flex gap="medium" className={styles['mb-lg']}>
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchClick()}
                      placeholder="Search for images..."
                      className={styles.flex1}
                    />
                    <Button 
                      onClick={handleSearchClick} 
                      disabled={isSearching || !searchQuery.trim()}
                      aria-label="Search images"
                      size="large"
                      className={styles.searchButton}
                    >
                      {isSearching ? 'Searching...' : 'Search'}
                    </Button>
                  </Flex>
                  
                  {/* Force Download Mode Indicator */}
                  {forceDownloadMode && (
                    <Alert variant="info">
                      <div className={styles.forceDownloadInfo}>
                        <Icon icon={Shield} size="sm" />
                        <span>
                          <strong>Force Download Mode Active</strong> - Using aggressive download methods for VPN/corporate networks
                        </span>
                      </div>
                    </Alert>
                  )}
                  
                  {searchError && (
                    <Alert variant="warning">
                      {searchError}
                    </Alert>
                  )}
                  
                  {successMessage && (
                    <Alert variant="success">
                      {successMessage}
                    </Alert>
                  )}
                </div>
              </Tab>
              
              <Tab 
                tabKey="videos" 
                label="Search Videos" 
                icon={<Video size={16} data-testid="video-icon" />}
              >
                <div>
                  {/* Video Prompt Suggestions */}
                  {videoPromptSuggestions.length > 0 && (
                    <div className={styles.suggestionContainer}>
                      <p className={styles.suggestionLabel}>
                        Suggested searches:
                      </p>
                      <div className={styles.suggestionButtons}>
                        {videoPromptSuggestions.map((suggestion, index) => (
                          <Button
                            key={index}
                            variant="secondary"
                            size="small"
                            onClick={() => {
                              setSearchQuery(suggestion)
                              setTriggerSearch(true)
                            }}
                            aria-label={`Search for ${suggestion}`}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Video Search Input */}
                  <Flex gap="medium" className={styles.searchInputContainer}>
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearchClick()}
                      placeholder="Search for videos..."
                      className={styles.flexInput}
                    />
                    <Button 
                      onClick={handleSearchClick} 
                      disabled={isSearching || !searchQuery.trim()}
                      aria-label="Search videos"
                      size="large"
                      className={styles.searchButton}
                    >
                      {isSearching ? 'Searching...' : 'Search'}
                    </Button>
                  </Flex>
                  
                  {youtubeMessage && (
                    <Alert variant="info">
                      {youtubeMessage}
                    </Alert>
                  )}
                </div>
              </Tab>
              
              <Tab 
                tabKey="upload" 
                label="Upload Files" 
                icon={<Upload size={16} data-testid="upload-icon" />}
              >
                <div 
                  data-testid="upload-dropzone"
                  className={styles.uploadDropzoneBox}
                >
                  <p className={styles.dropzoneDescription}>
                    Drop files here or click to upload
                  </p>
                  <p className={styles.dropzoneDescription}>
                    Accepted: Images (JPG, PNG, GIF) and Videos (MP4, MOV)
                  </p>
                  
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileUpload}
                    className={styles.uploadHiddenInput}
                    id="media-upload"
                    data-testid="file-input"
                    // FIXED: Removed 'multiple' - only one media per page allowed
                    disabled={isFileProcessing}
                  />
                  <label
                    htmlFor="media-upload"
                    className={isFileProcessing ? `${styles.uploadButton} ${styles.uploadButtonDisabled}` : styles.uploadButton}
                  >
                    <Icon icon={Upload} size="md" />
                    {isFileProcessing ? 'Processing...' : 'Select Files'}
                  </label>
                </div>
                
                {uploadProgress && (
                  <div className={styles.uploadProgressContainer} data-testid="upload-progress">
                    <p className={styles.uploadProgressText}>
                      Uploading {uploadProgress.fileName}...
                    </p>
                    <ProgressBar 
                      value={uploadProgress.percent} 
                      max={100}
                      label="Media upload"
                      showPercentage={true}
                      size="medium"
                      variant="primary"
                    />
                  </div>
                )}
                
                {uploadedMedia.length > 0 && (
                  <div className={styles.uploadCompleteContainer}>
                    <p className={styles.uploadCompleteText}>
                      Uploaded Files ({uploadedMedia.length})
                    </p>
                  </div>
                )}
              </Tab>
              
              <Tab 
                tabKey="ai" 
                label="AI Image Tools" 
                icon={<ImageIcon size={16} data-testid="ai-icon" />}
              >
                <div>
                  <h4 className={styles.aiToolsHeader}>
                    AI Image Generation Helper
                  </h4>
                  
                  {/* AI Prompt Based on Page Content */}
                  <div className={styles.providerInputContainer}>
                    <label className={styles.aiPromptLabel}>
                      AI Prompt for This Page
                    </label>
                    <div className={styles.aiPromptBox}>
                      <p className={styles.aiPromptText}>
                        {(() => {
                          const page = getCurrentPage()
                          
                          // Use the actual AI prompt from the page data if available
                          if (page && 'imagePrompts' in page && page.imagePrompts && page.imagePrompts.length > 0) {
                            // Use the first AI prompt from the page
                            return page.imagePrompts[0]
                          }
                          
                          // Fallback to generated prompt if no AI prompt available
                          const pageTitle = page?.title || 'Course Page'
                          const pageContent = page?.content || ''
                          const contentPreview = pageContent.slice(0, 100).replace(/<[^>]*>/g, '')
                          
                          return `Professional training image for "${pageTitle}". ${contentPreview ? `Context: ${contentPreview}...` : ''} Style: corporate training, clean, modern, educational. Aspect ratio: 16:9 for presentations.`
                        })()}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => {
                        const page = getCurrentPage()
                        let prompt: string
                        
                        // Use the actual AI prompt from the page data if available
                        if (page && 'imagePrompts' in page && page.imagePrompts && page.imagePrompts.length > 0) {
                          prompt = page.imagePrompts[0]
                        } else {
                          // Fallback to generated prompt
                          const pageTitle = page?.title || 'Course Page'
                          const pageContent = page?.content || ''
                          const contentPreview = pageContent.slice(0, 100).replace(/<[^>]*>/g, '')
                          prompt = `Professional training image for "${pageTitle}". ${contentPreview ? `Context: ${contentPreview}...` : ''} Style: corporate training, clean, modern, educational. Aspect ratio: 16:9 for presentations.`
                        }
                        
                        navigator.clipboard.writeText(prompt)
                        // Could add a toast notification here
                      }}
                      className={styles.searchInputContainer}
                    >
                      <Copy size={16} className={styles.buttonIcon} />
                      Copy Prompt to Clipboard
                    </Button>
                  </div>
                  
                  {/* External AI Tools Links */}
                  <div className={styles.aiToolsSection}>
                    <h5 className={styles.aiToolsTitle}>
                      Popular AI Image Generation Tools
                    </h5>
                    <div className={styles.aiToolsGrid}>
                      <div className={styles.aiToolCard}>
                        <h6 className={styles.aiToolTitle}>
                          🎨 DALL-E 3 (OpenAI)
                        </h6>
                        <p className={styles.aiToolDescription}>
                          High-quality, creative images with excellent prompt understanding
                        </p>
                        <a 
                          href="https://chat.openai.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={styles.aiToolLink}
                        >
                          Visit ChatGPT →
                        </a>
                      </div>
                      
                      <div className={styles.aiToolCard}>
                        <h6 className={styles.aiToolTitle}>
                          🚀 Midjourney
                        </h6>
                        <p className={styles.aiToolDescription}>
                          Artistic and stylized images, great for creative visuals
                        </p>
                        <a 
                          href="https://www.midjourney.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={styles.aiToolLink}
                        >
                          Visit Midjourney →
                        </a>
                      </div>
                      
                      <div className={styles.aiToolCard}>
                        <h6 className={styles.aiToolTitle}>
                          <Icon icon={ImageIcon} size="sm" />
                          Stable Diffusion (Free)
                        </h6>
                        <p className={styles.aiToolDescription}>
                          Open-source, customizable, runs locally or online
                        </p>
                        <a 
                          href="https://stablediffusionweb.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={styles.aiToolLink}
                        >
                          Try Online →
                        </a>
                      </div>
                      
                      <div className={styles.aiToolCard}>
                        <h6 className={styles.aiToolTitle}>
                          🎯 Microsoft Designer
                        </h6>
                        <p className={styles.aiToolDescription}>
                          Free AI image generation with DALL-E integration
                        </p>
                        <a 
                          href="https://designer.microsoft.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={styles.aiToolLink}
                        >
                          Visit Designer →
                        </a>
                      </div>
                    </div>
                  </div>
                  
                  {/* Instructions */}
                  <Alert variant="info">
                    <strong>How to use:</strong><br />
                    1. Copy the AI prompt above<br />
                    2. Visit one of the AI image generation tools<br />
                    3. Paste the prompt and generate your image<br />
                    4. Download the image and upload it using the "Upload Files" tab
                  </Alert>
                </div>
              </Tab>
            </Tabs>
            
            {/* Results Grid */}
            {(searchResults.length > 0 || uploadedMedia.length > 0) && (
              <>
                <div className={styles.resultsGrid}>
                  {displayedResults.map((result, index) => {
                    const isVideo = result.embedUrl || (result.url && result.url.includes('youtube'))
                    const imageSource = getImageSource(result.thumbnail || result.url, true)
                    const isRestricted = !imageSource && !isVideo
                    
                    return (
                      <div 
                        key={`${result.id}-${index}`}
                        data-testid={`search-result-${index}`}
                        className={`${styles.resultCard} ${isRestricted ? styles.resultCardRestricted : ''} ${isSearching ? styles.resultCardSearching : ''}`}
                        onClick={() => !isRestricted && !isSearching && handleMediaPreview(result.id)}
                      >
                        {/* Removed selection indicator - using lightbox now */}
                        {false && (
                          <div className={styles.selectionIndicator} aria-label="Selected">
                            ✓
                          </div>
                        )}
                        {isVideo ? (
                          <div className={styles.videoThumbnailContainer}>
                            {videoThumbnails[result.id] ? (
                              <img 
                                src={videoThumbnails[result.id]} 
                                alt={result.title}
                                className={styles.videoThumbnailImage}
                              />
                            ) : (
                              <span className={styles.videoThumbnailPlaceholder}>📹 Video</span>
                            )}
                          </div>
                        ) : isRestricted ? (
                          <div className={styles.restrictedImageContainer}>
                            <span className={styles.restrictedImageText}>
                              This image cannot be previewed due to site restrictions
                            </span>
                          </div>
                        ) : (
                          <div className={styles.resultImageContainer}>
                            <img 
                              src={imageSource}
                              alt={result.title}
                              className={`${styles.resultImage} ${imageErrors.has(result.id) ? styles.resultImageHidden : ''}`}
                              onError={() => {
                                setImageErrors(prev => new Set([...prev, result.id]))
                              }}
                            />
                            {imageErrors.has(result.id) && (
                              <div className={styles.noPreview}>
                                <span>Image unavailable</span>
                              </div>
                            )}
                          </div>
                        )}
                        <div className={styles.searchResultInfo}>
                          <p className={styles.searchResultTitle}>
                            {result.title}
                          </p>
                          <p className={styles.searchResultMeta}>
                            {result.dimensions && (
                              <span className={styles.imageDimensions}>
                                📐 {result.dimensions}
                              </span>
                            )}
                            {result.dimensions && result.source && ' • '}
                            {result.source && (
                              <span>{result.source}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                {/* Pagination */}
                {(hasSearched && (resultPage > 1 || hasNextPage)) && (
                  <div className={styles['mt-lg']}>
                    <Pagination
                      currentPage={resultPage}
                      hasNextPage={hasNextPage}
                      onPageChange={setResultPage}
                      isLoading={isPaginationLoading}
                    />
                  </div>
                )}
                
                {/* Single-click selection only - no button needed */}
              </>
            )}
            
            {/* No Results Message - Only show for search tabs */}
            {hasSearched && searchResults.length === 0 && !searchError && !youtubeMessage && 
             (activeTab === 'images' || activeTab === 'videos') && (
              <Alert variant="info">
                No results found. Try different search terms or upload your own media.
              </Alert>
            )}
          </Card>
        </Section>
      </div>
    </div>
      
      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!removeConfirm}
        title="Remove Media"
        message={`Are you sure you want to remove "${removeConfirm?.title}"?`}
        onConfirm={confirmRemoveMedia}
        onCancel={() => setRemoveConfirm(null)}
        confirmText="Remove"
        cancelText="Cancel"
      />
      
      {/* Replace Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!replaceConfirmDetails}
        title="Replace Media"
        message={`Are you sure you want to replace "${replaceConfirmDetails?.existingMedia.title}" with "${replaceConfirmDetails?.newSearchResult.title}"?`}
        onConfirm={() => {
          if (replaceConfirmDetails) {
            // Implementation for replace would go here
            setReplaceConfirmDetails(null)
          }
        }}
        onCancel={() => setReplaceConfirmDetails(null)}
        confirmText="Replace"
        cancelText="Cancel"
      />
      
      {/* Preview Dialog */}
      <Modal
        isOpen={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        title={existingPageMedia.find(m => m.id === previewMediaId)?.title || 'Media Preview'}
      >
        {getPreviewContent()}
      </Modal>
      
      {/* Rich Text Editor */}
      <RichTextEditor
        isOpen={isEditingContent}
        content={getCurrentPage()?.content || ''}
        onSave={handleSaveContent}
        onCancel={() => setIsEditingContent(false)}
      />

      {/* Replace Media Confirmation Dialog */}
      {replaceMode && (
        <ConfirmDialog
          isOpen={true}
          title="Replace Existing Media"
          message={`This page already has media. Do you want to replace it with "${replaceMode.title}"?`}
          onConfirm={handleReplaceConfirm}
          onCancel={() => setReplaceMode(null)}
          confirmText="Replace"
          cancelText="Cancel"
        />
      )}
      
      {/* Lightbox Preview Modal */}
      {isLightboxOpen && lightboxMedia && (
        <Modal
          isOpen={isLightboxOpen}
          onClose={handleLightboxCancel}
          size="xlarge"
          showCloseButton={false}
          data-testid="lightbox-modal"
        >
          <div className={styles.lightboxContent}>
            <div className={styles.lightboxPreview}>
              {lightboxMedia.isYouTube || lightboxMedia.embedUrl ? (
                <iframe
                  src={previewUrl}
                  title={lightboxMedia.title}
                  className={styles.lightboxVideo}
                  allowFullScreen
                  data-testid="video-preview"
                />
              ) : (
                <img
                  src={lightboxMedia.url}
                  alt={lightboxMedia.title}
                  className={styles.lightboxImage}
                />
              )}
            </div>
            
            <div className={styles.lightboxInfo}>
              <h3>{lightboxMedia.title}</h3>
              {lightboxMedia.source && <p className={styles.lightboxSource}>Source: {lightboxMedia.source}</p>}
              {lightboxMedia.dimensions && <p className={styles.lightboxDimensions}>{lightboxMedia.dimensions}</p>}
              {lightboxMedia.duration && <p className={styles.lightboxDuration}>Duration: {lightboxMedia.duration}</p>}
              {lightboxMedia.channel && <p className={styles.lightboxChannel}>Channel: {lightboxMedia.channel}</p>}
              
              {/* Clip timing inputs for YouTube videos */}
              {lightboxMedia.isYouTube && (
                <div className={styles.clipTimingSection}>
                  <h4>Clip Timing (optional)</h4>
                  <div className={styles.clipInputs}>
                    <div className={styles.clipInputGroup}>
                      <label htmlFor="clipStart">Start Time:</label>
                      <Input
                        id="clipStart"
                        type="text"
                        placeholder="0:30 or 30"
                        value={startText}
                        onChange={(e) => setStartText(e.target.value)}
                        onBlur={() => {
                          // Commit timing when user finishes editing
                          const startSeconds = parseTimeToSeconds(startText)
                          const endSeconds = parseTimeToSeconds(endText)
                          const embedUrl = buildYouTubeEmbed(
                            lightboxMedia.url || lightboxMedia.embedUrl || '', 
                            startSeconds, 
                            endSeconds
                          )
                          // Set up pending clip update for deferred persistence
                          if (getCurrentPage()) {
                            setPendingClip({
                              pageId: getCurrentPage()!.id,
                              mediaId: lightboxMedia.id,
                              clipStart: startSeconds,
                              clipEnd: endSeconds,
                              embedUrl
                            })
                          }
                        }}
                      />
                    </div>
                    <div className={styles.clipInputGroup}>
                      <label htmlFor="clipEnd">End Time:</label>
                      <Input
                        id="clipEnd"
                        type="text"
                        placeholder="2:00 or 120"
                        value={endText}
                        onChange={(e) => setEndText(e.target.value)}
                        onBlur={() => {
                          // Commit timing when user finishes editing
                          const startSeconds = parseTimeToSeconds(startText)
                          const endSeconds = parseTimeToSeconds(endText)
                          const embedUrl = buildYouTubeEmbed(
                            lightboxMedia.url || lightboxMedia.embedUrl || '', 
                            startSeconds, 
                            endSeconds
                          )
                          // Set up pending clip update for deferred persistence
                          if (getCurrentPage()) {
                            setPendingClip({
                              pageId: getCurrentPage()!.id,
                              mediaId: lightboxMedia.id,
                              clipStart: startSeconds,
                              clipEnd: endSeconds,
                              embedUrl
                            })
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Duration display for UX */}
                  {(() => {
                    const startSeconds = parseTimeToSeconds(startText)
                    const endSeconds = parseTimeToSeconds(endText)
                    
                    if (startSeconds !== undefined && endSeconds !== undefined && endSeconds > startSeconds) {
                      const duration = endSeconds - startSeconds
                      const mins = Math.floor(duration / 60)
                      const secs = duration % 60
                      const durationText = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`
                      
                      return (
                        <div className={styles.clipDuration}>
                          <strong>Clip Duration: {durationText}</strong>
                        </div>
                      )
                    } else if (startSeconds !== undefined || endSeconds !== undefined) {
                      return (
                        <div className={styles.clipDuration}>
                          <em>Partial clip timing set</em>
                        </div>
                      )
                    }
                    return null
                  })()}
                  
                  <div className={styles.clipActions}>
                    {(startText || endText) && (
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          setStartText('')
                          setEndText('')
                          // Clear the clip timing from the media immediately
                          if (getCurrentPage()) {
                            setPendingClip({
                              pageId: getCurrentPage()!.id,
                              mediaId: lightboxMedia.id,
                              clipStart: undefined,
                              clipEnd: undefined,
                              embedUrl: buildYouTubeEmbed(lightboxMedia.url || lightboxMedia.embedUrl || '')
                            })
                          }
                        }}
                        className={styles.clearClipButton}
                      >
                        Clear Timing
                      </Button>
                    )}
                  </div>
                  
                  <p className={styles.clipTimingHelp}>
                    Set start and end times to create a video clip. Leave empty to play the entire video.
                  </p>
                </div>
              )}
            </div>
            
            <div className={styles.lightboxActions}>
              <Button
                variant="secondary"
                size="large"
                onClick={handleLightboxCancel}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="large"
                onClick={handleLightboxConfirm}
                disabled={lightboxMedia ? addingMediaIds.has(lightboxMedia.id) : false}
                data-testid="set-media-button"
              >
                {lightboxMedia && addingMediaIds.has(lightboxMedia.id)
                  ? 'Adding Media...' 
                  : (existingPageMedia && existingPageMedia.length > 0 ? 'Replace Media' : 'Set Media')
                }
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Image Edit Modal */}
      {editingImage && (
        <ImageEditModal
          isOpen={true}
          onClose={handleCloseImageEdit}
          imageUrl={editingImage.url}
          imageTitle={editingImage.title}
          originalImageId={editingImage.id}
          onImageUpdated={handleImageUpdated}
        />
      )}
    </PageLayout>
  )
}

// Memoize the component to prevent unnecessary re-renders
const MemoizedMediaEnhancementWizard = memo(MediaEnhancementWizard)

export { MemoizedMediaEnhancementWizard as MediaEnhancementWizard }
export default MemoizedMediaEnhancementWizard