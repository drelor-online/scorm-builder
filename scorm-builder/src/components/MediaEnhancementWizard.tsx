import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { CourseContentUnion, CourseContent, Media, Page, Topic } from '../types/aiPrompt'
import type { MediaItem } from '../services/MediaService'
import { CourseSeedData } from '../types/course'
import { searchGoogleImages, searchYouTubeVideos, SearchError } from '../services/searchService'
import { isKnownCorsRestrictedDomain, downloadExternalImage, forceDownloadExternalImage } from '../services/externalImageDownloader'
import { PageLayout } from './PageLayout'
import { ConfirmDialog } from './ConfirmDialog'
import { AutoSaveBadge } from './AutoSaveBadge'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
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
import { Upload, Image as ImageIcon, Edit, Video, Copy, Plus, Shield, Trash2 } from 'lucide-react'
import './DesignSystem/designSystem.css'
import { tokens } from './DesignSystem/designTokens'
import { PageThumbnailGrid } from './PageThumbnailGrid'
import { RichTextEditor } from './RichTextEditor'
import { ImageEditModal } from './ImageEditModal'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useNotifications } from '../contexts/NotificationContext'
import DOMPurify from 'dompurify'
import { logger } from '../utils/logger'
import { buildYouTubeEmbed, parseYouTubeClipTiming } from '../services/mediaUrl'
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
  
  // State for contamination cleanup
  const [isCleaningContamination, setIsCleaningContamination] = useState(false)
  const [contaminationDetected, setContaminationDetected] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [forceDownloadMode, setForceDownloadMode] = useState<boolean>(false)
  const [contentHistory, setContentHistory] = useState<{ [key: string]: Page | Topic }>({})
  const [hasSearched, setHasSearched] = useState(false)
  const [existingMediaIdMap, setExistingMediaIdMap] = useState<Map<string, string>>(new Map())
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
  
  // FIX: Track current page index with ref to prevent stale closures in async operations
  const currentPageIndexRef = useRef(currentPageIndex)
  useEffect(() => {
    currentPageIndexRef.current = currentPageIndex
  }, [currentPageIndex])
  const [uploadProgress, setUploadProgress] = useState<{
    current: number
    total: number
    fileName: string
    percent: number
  } | null>(null)
  const [recentlyUploadedIds, setRecentlyUploadedIds] = useState<Set<string>>(new Set())
  const [resultPage, setResultPage] = useState(1)
  const [previewMediaId, setPreviewMediaId] = useState<string | null>(null)
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
  
  const { 
    storeMedia, 
    storeYouTubeVideo,
    updateYouTubeVideoMetadata, 
    getMedia, 
    deleteMedia,
    getValidMediaForPage,
    createBlobUrl,
    cleanContaminatedMedia
  } = useUnifiedMedia()
  
  const storage = useStorage()
  
  // console.log('[MediaEnhancement] Component render - UnifiedMedia ready')
  
  // Track blob URLs (using state to persist across re-renders)
  const [blobUrls, setBlobUrls] = useState<Map<string, string>>(new Map())
  
  // Local state for YouTube clip time inputs to prevent re-render during typing
  const [activeTimeInputs, setActiveTimeInputs] = useState<Map<string, { start?: string; end?: string }>>(new Map())
  const [focusedInput, setFocusedInput] = useState<{ mediaId: string; field: 'start' | 'end' } | null>(null)
  
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
  
  // 🔧 CONTAMINATION CLEANUP: Clean any contaminated media on component mount
  useEffect(() => {
    const runContaminationCleanup = async () => {
      try {
        console.log('[MediaEnhancement] 🧹 Running contamination cleanup on startup...')
        const result = await cleanContaminatedMedia()
        
        if (result.cleaned.length > 0) {
          console.log('[MediaEnhancement] ✅ Cleaned contaminated media:', result.cleaned)
          // Show success notification to user
          success(`Cleaned ${result.cleaned.length} contaminated media items`)
        }
        
        if (result.errors.length > 0) {
          console.error('[MediaEnhancement] ❌ Cleanup errors:', result.errors)
          result.errors.forEach(error => console.error(`Cleanup error: ${error}`))
        }
        
        if (result.cleaned.length === 0 && result.errors.length === 0) {
          console.log('[MediaEnhancement] ✅ No contaminated media found - all clean!')
        }
      } catch (error) {
        console.error('[MediaEnhancement] ❌ Failed to run contamination cleanup:', error)
      }
    }
    
    // Run cleanup after a short delay to allow media context to initialize
    const cleanupTimer = setTimeout(runContaminationCleanup, 1000)
    return () => clearTimeout(cleanupTimer)
  }, [cleanContaminatedMedia, success])
  
  // 🚨 CONTAMINATION DETECTION: Check for contamination in loaded media
  useEffect(() => {
    const checkForContamination = () => {
      const hasContamination = existingPageMedia.some(media => {
        const metadata = media.metadata || {}
        
        // Check if image/audio has YouTube-specific fields
        if (media.type !== 'video') {
          const mediaAny = media as any
          const isContaminated = metadata.source === 'youtube' || 
                                 metadata.embed_url || 
                                 metadata.clip_start !== undefined || 
                                 metadata.clip_end !== undefined ||
                                 mediaAny.embedUrl ||
                                 mediaAny.clipStart !== undefined ||
                                 mediaAny.clipEnd !== undefined ||
                                 mediaAny.isYouTube === true
          return isContaminated
        }
        return false
      })
      setContaminationDetected(hasContamination)
      
      if (hasContamination) {
        console.log('[MediaEnhancement] 🚨 CONTAMINATION DETECTED in current page media')
      }
    }
    
    checkForContamination()
  }, [existingPageMedia])
  
  // Manual media issues cleanup handler - now uses orphaned media references cleanup
  const handleManualContaminationCleanup = useCallback(async () => {
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
      if (mediaIndex !== -1) {
        updatedContent.welcomePage.media[mediaIndex] = {
          ...updatedContent.welcomePage.media[mediaIndex],
          clipStart: pendingClip.clipStart,
          clipEnd: pendingClip.clipEnd,
          embedUrl: pendingClip.embedUrl
        }
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
      if (topicIndex !== -1 && updatedContent.topics?.[topicIndex]?.media) {
        const mediaIndex = updatedContent.topics[topicIndex].media!.findIndex(m => m.id === pendingClip.mediaId)
        if (mediaIndex !== -1) {
          updatedContent.topics![topicIndex].media![mediaIndex] = {
            ...updatedContent.topics![topicIndex].media![mediaIndex],
            clipStart: pendingClip.clipStart,
            clipEnd: pendingClip.clipEnd,
            embedUrl: pendingClip.embedUrl
          }
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
    return buildYouTubeEmbed(
      lightboxMedia.url || lightboxMedia.embedUrl || '',
      clipStart,
      clipEnd
    )
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
  
  // Handle lightbox actions
  const handleLightboxConfirm = async () => {
    if (!lightboxMedia) return
    
    // 🔧 FIX: Check if we're editing existing media or adding new media
    const isEditingExistingMedia = existingPageMedia.some(media => media.id === lightboxMedia.id)
    const hasExistingMedia = existingPageMedia && existingPageMedia.length > 0
    
    setIsLightboxOpen(false)
    
    if (isEditingExistingMedia) {
      // 🔧 FIX: Update existing media clip timing instead of deleting and recreating
      console.log('[MediaEnhancement] 🎬 Updating clip timing for existing YouTube video:', {
        mediaId: lightboxMedia.id,
        title: lightboxMedia.title,
        oldClipStart: existingPageMedia.find(m => m.id === lightboxMedia.id)?.clipStart,
        oldClipEnd: existingPageMedia.find(m => m.id === lightboxMedia.id)?.clipEnd,
        newClipStart: parseTimeToSeconds(startText) ?? lightboxMedia.clipStart,
        newClipEnd: parseTimeToSeconds(endText) ?? lightboxMedia.clipEnd
      })
      
      // Update the existing media with new clip timing
      const startSeconds = parseTimeToSeconds(startText) ?? lightboxMedia.clipStart
      const endSeconds = parseTimeToSeconds(endText) ?? lightboxMedia.clipEnd
      
      const updatedMedia = existingPageMedia.map(media => {
        if (media.id === lightboxMedia.id) {
          const updatedEmbed = lightboxMedia.isYouTube 
            ? buildYouTubeEmbed(lightboxMedia.url, startSeconds, endSeconds)
            : media.embedUrl
            
          return {
            ...media,
            clipStart: startSeconds,
            clipEnd: endSeconds,
            embedUrl: updatedEmbed
          }
        }
        return media
      })
      
      // Update the component state
      setExistingPageMedia(updatedMedia)
      
      // Update the course content immediately
      if (courseContent && onUpdateContent) {
        const currentPage = getCurrentPage()
        if (currentPage) {
          const updatedPage = { ...currentPage, media: updatedMedia }
          updatePageInCourseContent(currentPage, updatedMedia)
        }
      }
      
      // Persist clip timing changes to storage
      try {
        const existingMedia = existingPageMedia.find(m => m.id === lightboxMedia.id)
        if (existingMedia?.storageId) {
          await updateYouTubeVideoMetadata(existingMedia.storageId, {
            clipStart: startSeconds,
            clipEnd: endSeconds,
            embedUrl: lightboxMedia.isYouTube 
              ? buildYouTubeEmbed(lightboxMedia.url, startSeconds, endSeconds)
              : undefined
          })
          console.log('[MediaEnhancement] ✅ Persisted clip timing changes to storage')
        }
      } catch (error) {
        console.error('[MediaEnhancement] ❌ Failed to persist clip timing changes:', error)
      }
      
      // Clear clip timing state
      setStartText('')
      setEndText('')
      setLightboxMedia(null)
      setClipStart(undefined)
      setClipEnd(undefined)
      
      console.log('[MediaEnhancement] ✅ Successfully updated YouTube video clip timing')
    } else if (hasExistingMedia) {
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
          } else {
            // Fallback to media.id if no storageId
            await deleteMedia(media.id)
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

  const formatSecondsToTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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
      previousFocus: focusedInput
    })
    
    setFocusedInput({ mediaId, field })
    
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
  }, [focusedInput, existingPageMedia, formatSecondsToTime])

  // Function to update page in course content - moved here to fix temporal dead zone error
  const updatePageInCourseContent = (page: Page | Topic, media: Media[]) => {
    if (!courseContent || !onUpdateContent) return
    
    const content = courseContent as CourseContent
    const updatedContent = structuredClone(content)
    
    // Ensure each Media object has a proper URL for display and preserves all flags
    const mediaWithUrls = media.map(item => ({
      ...item,
      // Preserve isYouTube flag explicitly
      isYouTube: item.isYouTube || false,
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
      if (focusedInput?.mediaId === mediaId && focusedInput?.field === field) {
        setFocusedInput(null)
      }

      // MEDIA CLEARING FIX: Clear the clip timing update flag after a delay to allow state to settle
      setTimeout(() => {
        setIsUpdatingClipTiming(false)
        isUpdatingClipTimingRef.current = false
      }, 100)
  }, [
    activeTimeInputs, 
    parseTimeToSeconds, 
    markDirty, 
    focusedInput, 
    existingPageMedia, 
    lastKnownGoodValues, 
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
      
        // CRITICAL FIX: Reload media from MediaService to ensure fresh blob URLs
        // This ensures the component shows the latest data with proper blob URLs
        // MEDIA CLEARING FIX: Skip reload during clip timing updates
        if (!isUpdatingClipTimingRef.current) {
          await loadExistingMedia()
        } else {
          console.log('[MediaEnhancement] Skipping loadExistingMedia after media addition - clip timing update in progress')
        }
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
          } else {
            // Fallback to media.id if no storageId
            await deleteMedia(media.id)
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
    
    const pageId = getPageId(currentPage)
    console.log('[MediaEnhancement] Loading media for page:', pageId)
    
    // Get media items for the current page (using defensive version)
    let pageMediaItems: Media[] = []
    try {
      // DEFENSIVE FIX: Use getValidMediaForPage to filter out orphaned media references
      const result = await getValidMediaForPage(pageId)
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
        const isYouTubeVideo = metadata.isYouTube || itemAny.isYouTube || 
                              (url && (url.includes('youtube.com') || url.includes('youtu.be')))
        
        // For all non-YouTube media, create fresh blob URLs
        if (!isYouTubeVideo) {
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
          type: item.type as 'image' | 'video' | 'youtube',
          title: metadata.title || itemAny.title || item.fileName,
          thumbnail: metadata.thumbnail || itemAny.thumbnail,
          url: url || '',
          embedUrl: metadata.embedUrl || itemAny.embedUrl,
          isYouTube: isYouTubeVideo,
          storageId: item.id,
          mimeType: metadata.mimeType || itemAny.mimeType || 'video/mp4',
          // 🔧 FIX: Extract clip timing from multiple possible locations
          clipStart: metadata.clipStart || metadata.clip_start || itemAny.clipStart || itemAny.clip_start,
          clipEnd: metadata.clipEnd || metadata.clip_end || itemAny.clipEnd || itemAny.clip_end
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
  }, [currentPageIndex, courseContent, getValidMediaForPage, createBlobUrl])
  
  // Load existing media on mount and page change
  useEffect(() => {
    // MEDIA CLEARING FIX: Skip loading during clip timing updates to prevent UI flickering
    if (isUpdatingClipTimingRef.current) {
      console.log('[MediaEnhancement] Skipping loadExistingMedia during clip timing update')
      return
    }
    
    loadExistingMedia()
    
    // Cleanup when page changes or component unmounts
    return () => {
      // DO NOT revoke blob URLs here!
      // They are cached and may be needed when returning to this page
      // The UnifiedMediaContext manages the blob URL cache globally
      
      // Only clear blob URLs if we're actually changing pages, not during save operations
      // This prevents the "Loading..." state after saves
      if (isUpdatingClipTimingRef.current) {
        console.log('[MediaEnhancement] Preserving blob URLs during clip timing update')
      } else {
        setBlobUrls(new Map())
      }
    }
  }, [loadExistingMedia])
  
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
    if (focusedInput && !existingMediaIds.has(focusedInput.mediaId)) {
      console.log(`[YouTube Clip] Clearing stale focusedInput for deleted media:`, focusedInput.mediaId)
      setFocusedInput(null)
    }
  }, [existingPageMedia, focusedInput])
  
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
    const existingMedia = await getValidMediaForPage(pageId)
    
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
      // DELETION FIX: Extra protection for YouTube videos with clip timing
      const hasClipTiming = mediaToRemove.clipStart !== undefined || mediaToRemove.clipEnd !== undefined
      const isYouTubeWithTiming = mediaToRemove.isYouTube && hasClipTiming
      
      if (isYouTubeWithTiming) {
        // Double confirmation for YouTube videos with clip timing
        const doubleConfirm = window.confirm(
          `⚠️ WARNING: You are about to delete a YouTube video with clip timing!\n\n` +
          `Video: ${mediaToRemove.title || 'Untitled'}\n` +
          `Clip timing: ${mediaToRemove.clipStart || 0}s to ${mediaToRemove.clipEnd || 'end'}s\n\n` +
          `This will permanently remove the video and all its clip timing settings.\n\n` +
          `Are you absolutely sure you want to delete this video?`
        )
        
        if (!doubleConfirm) {
          console.log('[DELETION DEBUG] User cancelled deletion of YouTube video with clip timing')
          setRemoveConfirm(null)
          return
        }
      }
      
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
    
    if (media.type === 'video') {
      // Check if it's a YouTube video
      if (media.embedUrl || (media.url && (media.url.includes('youtube.com') || media.url.includes('youtu.be')))) {
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
        
        // Generate embed URL with clip timing if available
        const embedUrl = (media.clipStart !== undefined || media.clipEnd !== undefined)
          ? buildYouTubeEmbed(media.url || media.embedUrl || '', media.clipStart, media.clipEnd)
          : media.embedUrl || media.url
          
        console.log('[YouTube Clip Display] 📺 Final iframe src URL:', {
          mediaId: media.id,
          finalEmbedUrl: embedUrl,
          urlLength: embedUrl.length,
          containsClipParams: embedUrl.includes('&t=') || embedUrl.includes('?t=') || embedUrl.includes('start=') || embedUrl.includes('end=')
        })
          
        return (
          <iframe
            src={embedUrl}
            width="100%"
            height="400"
            frameBorder="0"
            allowFullScreen
            title={media.title}
          />
        )
      }
      // Regular video
      return (
        <video
          src={media.url}
          controls
          className={styles.mediaVideo}
          title={media.title}
        />
      )
    } else {
      // Image
      return (
        <img
          src={media.url}
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

  // PERFORMANCE: Memoize existing media items to prevent expensive re-rendering
  const renderedExistingMedia = useMemo(() => {
    console.log('[MediaEnhancement] 🎨 Rendering existing media items:', {
      count: existingPageMedia.length,
      items: existingPageMedia.map(media => ({
        id: media.id,
        type: media.type,
        title: media.title,
        isYouTube: media.isYouTube,
        hasUrl: !!media.url,
        url: media.url,
        clipStart: media.clipStart,
        clipEnd: media.clipEnd
      }))
    })
    
    return existingPageMedia.map((media) => (
      <div 
        key={media.id} 
        className={styles.mediaItem}
        onClick={() => handleMediaClick(media.id)}
      >
        <div className={styles.mediaThumbnailContainer}>
          {(media.type === 'video' || media.type === 'youtube') && (media.isYouTube || media.type === 'youtube') && media.url ? (
            // YouTube video thumbnail
            (() => {
              const videoIdMatch = media.url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&\n?#]+)/)
              const videoId = videoIdMatch ? videoIdMatch[1] : null
              const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null
              
              return thumbnailUrl ? (
                <div className={styles.mediaItemInner}>
                  <img
                    src={thumbnailUrl}
                    alt={media.title || 'Video thumbnail'}
                    className={styles.mediaThumbnail}
                    onError={(e) => {
                      console.log('[MediaEnhancement] YouTube thumbnail failed to load:', thumbnailUrl)
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
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
            // Regular image or other media
            <div className={styles.mediaItemInner}>
              {blobUrls.has(media.storageId || media.id) ? (
                <img
                  src={blobUrls.get(media.storageId || media.id)}
                  alt={media.title || 'Media'}
                  className={styles.mediaThumbnail}
                  onError={(e) => {
                    console.log('[MediaEnhancement] Media thumbnail failed to load')
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                  }}
                />
              ) : (
                <div className={styles.mediaPlaceholder}>
                  <span>Loading...</span>
                </div>
              )}
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
                <Icon icon={Video} size="sm" />
              </Button>
            )}
            
            <Button
              variant="secondary" 
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                // DELETION FIX: Add extra protection against accidental clicks
                const hasClipTiming = media.clipStart !== undefined || media.clipEnd !== undefined
                const isYouTubeWithTiming = media.isYouTube && hasClipTiming
                
                if (isYouTubeWithTiming) {
                  // For YouTube videos with clip timing, require an immediate confirmation
                  const immediateConfirm = window.confirm(
                    `🔥 Are you sure you want to REMOVE this YouTube video?\n\n` +
                    `"${media.title || 'Untitled'}"\n` +
                    `(has clip timing: ${media.clipStart || 0}s-${media.clipEnd || 'end'}s)\n\n` +
                    `Click OK to confirm removal, or Cancel to keep it.`
                  )
                  
                  if (immediateConfirm) {
                    handleRemoveMedia(media.id)
                  } else {
                    console.log('[DELETION DEBUG] User cancelled immediate removal of YouTube video with clip timing')
                  }
                } else {
                  handleRemoveMedia(media.id)
                }
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
        </div>

        {/* YouTube clip time inputs */}
        {media.type === 'video' && media.isYouTube && (
          <div 
            className={styles.youTubeClipContainer}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.youTubeClipInputs}>
              <div className={styles.clipInputWrapper}>
                <label className={styles.clipInputLabel}>Start</label>
                <Input
                  type="text"
                  placeholder="0:00"
                  value={getInputValue(media, 'start')}
                  onChange={(e) => handleClipInputChange(media.id, 'start', e.target.value)}
                  onFocus={() => setFocusedInput({ mediaId: media.id, field: 'start' })}
                  onBlur={() => handleClipInputBlur(media.id, 'start')}
                  aria-label="Clip start time"
                />
              </div>
              <div className={styles.clipInputWrapper}>
                <label className={styles.clipInputLabel}>End</label>
                <Input
                  type="text"
                  placeholder="0:00"
                  value={getInputValue(media, 'end')}
                  onChange={(e) => handleClipInputChange(media.id, 'end', e.target.value)}
                  onFocus={() => setFocusedInput({ mediaId: media.id, field: 'end' })}
                  onBlur={() => handleClipInputBlur(media.id, 'end')}
                  aria-label="Clip end time"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    ))
  }, [existingPageMedia, blobUrls, handleMediaClick, handleClipInputChange, handleClipInputBlur, getInputValue, setFocusedInput, styles])

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
                type="warning" 
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
            
            {/* Existing Media */}
            {!isLoadingMedia && existingPageMedia.length > 0 && (
            <Card className={styles.mediaCard}>
              <h3 className={styles.mediaTitle}>Current Media</h3>
              <div className={styles.mediaGrid}>
                {renderedExistingMedia}
              </div>
            </Card>
          )}
          
          {/* Show "No media" message when page has no media */}
          {existingPageMedia.length === 0 && (
            <Card className={styles.noMediaCard}>
              <h3 className={styles.cardTitle}>Current Media</h3>
              <div className={styles.noMediaMessage}>
                <p>No media added yet</p>
                <p className={styles.noMediaHint}>
                  Use the options below to add images or videos to this page
                </p>
                <p style={{ marginTop: '1rem', fontSize: '1.2rem' }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

export { MediaEnhancementWizard }
export default MediaEnhancementWizard