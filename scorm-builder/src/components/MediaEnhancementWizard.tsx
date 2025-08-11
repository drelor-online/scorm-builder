import React, { useState, useRef, useEffect } from 'react'
import { CourseContentUnion, CourseContent, Media, Page, Topic } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'
import { searchGoogleImages, searchYouTubeVideos, SearchError } from '../services/searchService'
import { isKnownCorsRestrictedDomain, downloadExternalImage } from '../services/externalImageDownloader'
import { PageLayout } from './PageLayout'
import { ConfirmDialog } from './ConfirmDialog'
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
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
import { Upload, Image as ImageIcon, Edit, Video, Copy } from 'lucide-react'
import './DesignSystem/designSystem.css'
import { tokens } from './DesignSystem/designTokens'
import { PageThumbnailGrid } from './PageThumbnailGrid'
import { RichTextEditor } from './RichTextEditor'
import { useStorage } from '../contexts/PersistentStorageContext'
import DOMPurify from 'dompurify'
import { logger } from '../utils/logger'
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
}

interface MediaEnhancementWizardRefactoredProps {
  courseContent: CourseContentUnion
  courseSeedData?: CourseSeedData
  apiKeys?: any
  onUpdateContent?: (content: CourseContentUnion) => void
  onNext: (content: CourseContentUnion) => void
  onBack: () => void
  onSettingsClick?: () => void
  onHelp?: () => void
  onSave?: (content?: any, silent?: boolean) => void
  onSaveAs?: () => void
  onOpen?: () => void
  onStepClick?: (step: number) => void
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
  onSaveAs,
  onOpen,
  onStepClick
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedResults, setSelectedResults] = useState<{ [key: string]: boolean }>({})
  const [isSearching, setIsSearching] = useState(false)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [mediaSource, setMediaSource] = useState<'search' | 'upload'>('search')
  const [uploadedMedia, setUploadedMedia] = useState<SearchResult[]>([])
  const [imagePromptSuggestions, setImagePromptSuggestions] = useState<string[]>([])
  const [videoPromptSuggestions, setVideoPromptSuggestions] = useState<string[]>([])
  const mediaItemsRef = useRef<Map<string, Media>>(new Map())
  const [existingPageMedia, setExistingPageMedia] = useState<Media[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
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
  
  const { 
    storeMedia, 
    storeYouTubeVideo, 
    getMedia, 
    deleteMedia,
    getMediaForPage,
    createBlobUrl
  } = useUnifiedMedia()
  
  const storage = useStorage()
  
  // console.log('[MediaEnhancement] Component render - UnifiedMedia ready')
  
  // Track blob URLs (using state to persist across re-renders)
  const [blobUrls, setBlobUrls] = useState<Map<string, string>>(new Map())
  
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
  
  const getCurrentPageTitle = (): string => {
    const page = getCurrentPage()
    if (!page) return 'Unknown Page'
    
    if ('title' in page) return page.title || 'Untitled'
    if (currentPageIndex === 1) return 'Learning Objectives'
    
    return 'Page'
  }
  
  const getMediaType = (page: Page | Topic | undefined): 'image' | 'video' => {
    if (!page) return 'image'
    
    if ('videoSearchTerms' in page && Array.isArray(page.videoSearchTerms) && page.videoSearchTerms.length > 0) {
      return 'video'
    }
    return 'image'
  }

  // Handle clicking on search results to add them to the page
  const handleToggleSelection = async (resultId: string) => {
    const result = [...searchResults, ...uploadedMedia].find(r => r.id === resultId)
    if (!result) return

    // Check if there's existing media on the page
    // Use the local state which is updated after deletions
    const hasExistingMedia = existingPageMedia && existingPageMedia.length > 0
    
    if (hasExistingMedia) {
      // Show confirmation dialog
      setReplaceMode({ id: resultId, title: result.title || 'Media' })
      setIsSearching(false)
      return
    }

    // No existing media, proceed with adding
    await addMediaToPage(result)
  }

  // Separate function to add media to page
  const addMediaToPage = async (result: SearchResult) => {
    try {
      setIsSearching(true) // Use existing loading state
      
      // Declare pageId at function scope so it's accessible throughout
      const currentPage = getCurrentPage()
      if (!currentPage) {
        throw new Error('No current page selected')
      }
      const pageId = getPageId(currentPage)
      
      // Variable to store the result of storing media
      let storedItem: any
      
      // Check if it's a YouTube video - check isYouTube flag first
      if (result.isYouTube || result.embedUrl || (result.url && (result.url.includes('youtube.com') || result.url.includes('youtu.be')))) {
        console.log('[MediaEnhancement] Processing YouTube video:', {
          title: result.title,
          url: result.url,
          embedUrl: result.embedUrl,
          isYouTube: result.isYouTube,
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
            isYouTube: true
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
          console.log('[MediaEnhancement] Downloading external image')
          blob = await downloadExternalImage(result.url)
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
      }

      // Create the new media item for the page
      let newMediaItem: Media
      if (result.isYouTube || result.embedUrl || (result.url && (result.url.includes('youtube.com') || result.url.includes('youtu.be')))) {
        // YouTube video
        newMediaItem = {
          id: storedItem.id,
          type: 'video',
          title: storedItem.metadata?.title || storedItem.fileName || result.title || 'Video',
          url: storedItem.metadata?.youtubeUrl || result.url || '',
          embedUrl: storedItem.metadata?.embedUrl || result.embedUrl || '',
          isYouTube: true,
          storageId: storedItem.id,
          mimeType: 'video/mp4'
        }
      } else {
        // Regular image - create blob URL
        const blobUrl = await createBlobUrl(storedItem.id)
        
        // Track the blob URL for cleanup
        if (blobUrl) {
          setBlobUrls(prev => {
            const newMap = new Map(prev)
            newMap.set(storedItem.id, blobUrl)
            return newMap
          })
          console.log('[MediaEnhancement] Created and tracked blob URL for stored image:', storedItem.id)
        }
        
        newMediaItem = {
          id: storedItem.id,
          type: 'image',
          title: storedItem.metadata?.title || storedItem.fileName || result.title || 'Image',
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
      
      // Clear selections after successfully adding media
      setSelectedResults({})
      
      // Update course content with the combined media array
      if (currentPage) {
        updatePageInCourseContent(currentPage, updatedPageMedia)
      }

      // Show success message
      setSuccessMessage('Media added to page')
      setTimeout(() => setSuccessMessage(null), 3000)
      console.log('[MediaEnhancement] Media added to page successfully')
    } catch (error) {
      // Properly serialize error for logging (Error objects serialize to {})
      const errorInfo = error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n')[0] // Just first line of stack
      } : error
      console.error('[MediaEnhancement] Error adding media:', errorInfo)
      setSearchError('Failed to add media to page')
    } finally {
      setIsSearching(false)
    }
  }

  // Handle replace confirmation
  const handleReplaceConfirm = async () => {
    if (!replaceMode) return
    
    const result = [...searchResults, ...uploadedMedia].find(r => r.id === replaceMode.id)
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
  }
  
  // Move loadExistingMedia to component scope using useCallback
  const loadExistingMedia = React.useCallback(async () => {
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
    
    // Get media items for the current page
    let pageMediaItems: any[] = []
    try {
      const result = getMediaForPage(pageId)
      // Handle both promise and direct return
      pageMediaItems = Array.isArray(result) ? result : await result
      // Ensure it's always an array
      if (!Array.isArray(pageMediaItems)) {
        console.warn('[MediaEnhancement] getMediaForPage did not return an array:', pageMediaItems)
        pageMediaItems = []
      }
    } catch (error) {
      console.error('[MediaEnhancement] Error loading media for page:', error)
      pageMediaItems = []
    }
    
    // Only get image and video items (not audio/captions)
    const imageAndVideoItems = pageMediaItems.filter(item => 
      item.type === 'image' || item.type === 'video'
    )
    
    console.log('[MediaEnhancement] Found media items:', imageAndVideoItems.length)
    
    if (imageAndVideoItems.length > 0) {
      console.log('[MediaEnhancement] Loading', imageAndVideoItems.length, 'media items')
      setLoadingProgress({ current: 0, total: imageAndVideoItems.length })
      
      // Create media items from MediaService items with real blob URLs
      let loadedCount = 0
      const newBlobUrls = new Map<string, string>() // Collect blob URLs to batch update
      
      const mediaItemsPromises = imageAndVideoItems.map(async (item) => {
        let url = item.metadata.youtubeUrl || item.metadata.embedUrl
        
        // For all non-YouTube media (including images with asset:// URLs), ALWAYS create fresh blob URLs
        // Don't trust any stored blob: URLs as they're session-specific
        if (!item.metadata.youtubeUrl && !item.metadata.embedUrl) {
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
          type: item.type as 'image' | 'video',
          title: item.metadata.title || item.fileName,
          thumbnail: item.metadata.thumbnail,
          url: item.metadata.youtubeUrl || url || '',
          embedUrl: item.metadata.embedUrl,
          isYouTube: item.metadata.isYouTube || !!item.metadata.youtubeUrl,
          storageId: item.id,
          mimeType: item.metadata.mimeType || 'video/mp4'
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
      
      setExistingPageMedia(mediaItems)
    } else {
      console.log('[MediaEnhancement] No media found for page')
      setExistingPageMedia([])
    }
    
    setIsLoadingMedia(false)
    setLoadingProgress({ current: 0, total: 0 })
  }, [currentPageIndex, courseContent, getMediaForPage, createBlobUrl])
  
  // Load existing media on mount and page change
  useEffect(() => {
    loadExistingMedia()
    
    // Cleanup when page changes or component unmounts
    return () => {
      // DO NOT revoke blob URLs here!
      // They are cached and may be needed when returning to this page
      // The UnifiedMediaContext manages the blob URL cache globally
      setBlobUrls(new Map())
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
    setSelectedResults({})
  }, [activeTab])
  
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
  
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return
    
    // FIX: Enforce single file selection even if browser allows multiple
    if (files.length > 1) {
      console.warn('[MediaEnhancement] Multiple files selected, but only one media per page is allowed.')
      setSearchError('Only one media file per page is allowed. Please select a single file.')
      setTimeout(() => setSearchError(null), 3000)
      event.target.value = '' // Clear the input
      return
    }
    
    setIsFileProcessing(true)
    setUploadProgress({
      current: 0,
      total: 1,
      fileName: files[0].name,
      percent: 0
    })
    
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
    const existingMedia = getMediaForPage(pageId)
    
    if (existingMedia && existingMedia.length > 0 && results.length > 0) {
      // If there's existing media, show confirmation for the first uploaded file
      const firstResult = results[0]
      setReplaceMode({ id: firstResult.id, title: firstResult.title })
      // Temporarily store in uploadedMedia so handleReplaceConfirm can find it
      setUploadedMedia(results)
    } else if (results.length > 0) {
      // No existing media, add the first file directly
      const firstResult = results[0]
      await addMediaToPage(firstResult)
      // Clear uploadedMedia since we've added it
      setUploadedMedia([])
    }
    
    setRecentlyUploadedIds(prev => new Set([...prev, ...newlyUploaded]))
    
    setIsFileProcessing(false)
    setUploadProgress(null)
    event.target.value = ''
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
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    // Use activeTab to determine search type
    const isVideoSearch = activeTab === 'videos'
    
    setIsSearching(true)
    setSearchError(null)
    setYoutubeMessage(null)
    setSelectedResults({}) // Clear previous selections when starting new search
    
    try {
      if (isVideoSearch) {
        // Search YouTube videos
        const youtubeApiKey = apiKeys?.youtubeApiKey || ''
        if (!youtubeApiKey) {
          setYoutubeMessage("YouTube API key not configured. Please add it in settings.")
          setSearchResults([])
        } else {
          const videoResults = await searchYouTubeVideos(searchQuery, 1, youtubeApiKey)
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
        
        const images = await searchGoogleImages(searchQuery, 1, apiKeys?.googleImageApiKey || '', apiKeys?.googleCseId || '')
        console.log('[MediaEnhancement] Search returned', images.length, 'results');
        
        // The searchGoogleImages function already returns SearchResult objects
        // No need to map them again
        setSearchResults(images)
      }
      setHasSearched(true)
      setResultPage(1)
    } catch (error) {
      console.error('Search error:', error)
      if (error instanceof SearchError) {
        setSearchError(error.message)
      } else {
        setSearchError('Search failed. Please try again.')
      }
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }
  
  const navigateToPage = (index: number) => {
    if (index >= 0 && index < totalPages) {
      setCurrentPageIndex(index)
      setSearchQuery('')
      setSearchResults([])
      setUploadedMedia([]) // Clear uploaded media when changing pages
      setSelectedResults({})
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
    const allResults = [...searchResults, ...uploadedMedia]
    const selectedItems = allResults.filter(r => selectedResults[r.id])
    
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
            const storedItem = await storeMedia(
              fileToStore,
              pageId,
              mediaItem.type as 'image' | 'video',
              {
                title: mediaItem.title,
                thumbnail: mediaItem.thumbnail,
                embedUrl: mediaItem.embedUrl
              },
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
    
    // Clear selections
    setSelectedResults({})
    setRecentlyUploadedIds(new Set())
    
    // Update course content
    updatePageInCourseContent(currentPage, updatedPageMedia)
    
    // Reload existing media to get blob URLs for newly stored items
    setTimeout(() => {
      loadExistingMedia()
    }, 100)
  }
  
  const updatePageInCourseContent = (page: Page | Topic, media: Media[]) => {
    if (!courseContent || !onUpdateContent) return
    
    const content = courseContent as CourseContent
    const updatedContent = { ...content }
    
    // Ensure each Media object has a proper URL for display and preserves all flags
    const mediaWithUrls = media.map(item => ({
      ...item,
      // Preserve isYouTube flag explicitly
      isYouTube: item.isYouTube || false,
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
    
    onUpdateContent(updatedContent)
  }
  
  const handleRemoveMedia = (mediaId: string) => {
    const mediaToRemove = existingPageMedia.find(m => m.id === mediaId)
    if (mediaToRemove) {
      setRemoveConfirm({ id: mediaId, title: mediaToRemove.title || 'this media' })
    }
  }
  
  const confirmRemoveMedia = async () => {
    if (!removeConfirm) return
    
    const mediaToRemove = existingPageMedia.find(m => m.id === removeConfirm.id)
    if (mediaToRemove?.storageId) {
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
    
    setRemoveConfirm(null)
  }
  
  // Handle page selection from thumbnail grid
  const handlePageSelect = (pageId: string) => {
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
  }
  
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
    const updatedContent = { ...courseContent } as CourseContent
    
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
        const embedUrl = media.embedUrl || media.url
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
  
  
  
  // Paginate results
  const paginateResults = (results: SearchResult[]) => {
    const startIndex = (resultPage - 1) * resultsPerPage
    const endIndex = startIndex + resultsPerPage
    return results.slice(startIndex, endIndex)
  }
  
  const totalResultPages = Math.ceil([...searchResults, ...uploadedMedia].length / resultsPerPage)
  
  return (
    <PageLayout
      currentStep={3}
      title="Media Enhancement"
      description="Add images and videos to your course content"
      onBack={onBack}
      onNext={() => onNext(courseContentRef.current)}
      nextDisabled={false}
      onSettingsClick={onSettingsClick}
      onHelp={onHelp}
      onSave={onSave}
      onSaveAs={onSaveAs}
      onOpen={onOpen}
      onStepClick={onStepClick}
      autoSaveIndicator={onSave && <AutoSaveIndicatorConnected />}
    >
      <div className={styles.mainLayout}>
        {/* Left Sidebar - Page Navigation */}
        <div className={styles.leftSidebar}>
          <h3 className={styles.sidebarTitle}>Page Navigation</h3>
          <PageThumbnailGrid
            courseContent={courseContent as CourseContent}
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
                <h2 className={styles.pageTitle}>{getCurrentPageTitle()}</h2>
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
                {existingPageMedia.map((media) => (
                  <div 
                    key={media.id} 
                    className={styles.mediaItem}
                    onClick={() => handleMediaClick(media.id)}
                  >
                    {media.type === 'video' && media.isYouTube && media.url ? (
                      // FIXED: Display YouTube thumbnail for video preview
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
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                const parent = target.parentElement
                                if (parent) {
                                  // Use safe DOM manipulation instead of innerHTML
                                  const placeholder = document.createElement('div')
                                  placeholder.style.padding = '2rem'
                                  placeholder.style.textAlign = 'center'
                                  placeholder.style.color = '#666'
                                  placeholder.textContent = '📹 Video'
                                  parent.replaceChildren(placeholder)
                                }
                              }}
                            />
                            {/* Video play overlay */}
                            <div className={styles.videoPlayButton}>
                              <div className={styles.playIcon} />
                            </div>
                          </div>
                        ) : (
                          <div className={styles.noPreview}>
                            <span>📹 Video</span>
                          </div>
                        )
                      })()
                    ) : (media.storageId && blobUrls.get(media.storageId)) || getImageSource(media.url || '', false, media.storageId) ? (
                      <img 
                        src={(media.storageId && blobUrls.get(media.storageId)) || getImageSource(media.url || '', false, media.storageId)} 
                        alt={media.title || 'Media'} 
                        className={styles.mediaThumbnail}
                        onLoad={() => console.log('[MediaEnhancement v2.0.6] Image loaded successfully:', media.id)}
                        onError={(e) => {
                          console.error('[MediaEnhancement v2.0.6] Image failed to load:', media.id, e)
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                          const parent = target.parentElement
                          if (parent) {
                            // Use safe DOM manipulation instead of innerHTML
                            const placeholder = document.createElement('div')
                            placeholder.style.padding = '2rem'
                            placeholder.style.textAlign = 'center'
                            placeholder.style.color = '#666'
                            placeholder.textContent = 'Image unavailable'
                            parent.replaceChildren(placeholder)
                          }
                        }}
                      />
                    ) : (
                      <div className={styles.noPreview}>
                        <span>No preview</span>
                      </div>
                    )}
                    <div className={styles.mediaInfo}>
                      <p className={styles.mediaInfoTitle}>
                        {media.title || 'Untitled'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem' }}>
                      {media.type === 'video' && media.isYouTube && media.url && (
                        <Button
                          variant="primary"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            // Open YouTube video in new tab for preview
                            const videoUrl = media.url?.includes('embed') 
                              ? media.url.replace('/embed/', '/watch?v=')
                              : media.url
                            window.open(videoUrl, '_blank')
                          }}
                          style={{ flex: 1 }}
                        >
                          Preview
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveMedia(media.id)
                        }}
                        className={styles.removeButton}
                        style={{ flex: 1 }}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
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
          <Card>
            <h3 className={styles.cardTitle}>Add New Media</h3>
            
            {/* Tabbed Interface */}
            <Tabs activeTab={activeTab} onChange={(tab) => {
              setActiveTab(tab as 'images' | 'videos' | 'upload' | 'ai')
              // Clear search results and query when switching tabs
              setSearchResults([])
              setSearchQuery('')
              setSearchError(null)
            }}>
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
                  
                  {/* Image Search Input */}
                  <Flex gap="medium" className={styles['mb-lg']}>
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search for images..."
                      className={styles.flex1}
                    />
                    <Button 
                      onClick={handleSearch} 
                      disabled={isSearching || !searchQuery.trim()}
                      aria-label="Search images"
                      size="large"
                      className={styles.searchButton}
                    >
                      {isSearching ? 'Searching...' : 'Search'}
                    </Button>
                  </Flex>
                  
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
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search for videos..."
                      className={styles.flexInput}
                    />
                    <Button 
                      onClick={handleSearch} 
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
                      label={`Upload progress: ${uploadProgress.percent}%`}
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
                          🖼️ Stable Diffusion (Free)
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
                  {paginateResults([...searchResults, ...uploadedMedia]).map((result, index) => {
                    const isVideo = result.embedUrl || (result.url && result.url.includes('youtube'))
                    const imageSource = getImageSource(result.thumbnail || result.url, true)
                    const isRestricted = !imageSource && !isVideo
                    
                    return (
                      <div 
                        key={`${result.id}-${index}`}
                        data-testid={`search-result-${index}`}
                        data-selected={selectedResults[result.id] ? "true" : "false"}
                        className={`${styles.resultCard} ${selectedResults[result.id] ? styles.resultCardSelected : ''} ${isRestricted ? styles.resultCardRestricted : ''} ${isSearching ? styles.resultCardSearching : ''}`}
                        onClick={() => !isRestricted && !isSearching && handleToggleSelection(result.id)}
                      >
                        {/* Selection checkmark indicator */}
                        {selectedResults[result.id] && (
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
                          {result.source && (
                            <p className={styles.searchResultMeta}>
                              {result.source}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                
                {/* Pagination */}
                {totalResultPages > 1 && (
                  <div className={styles['mt-lg']}>
                    <Pagination
                      currentPage={resultPage}
                      hasNextPage={resultPage < totalResultPages}
                      onPageChange={setResultPage}
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
    </PageLayout>
  )
}

export { MediaEnhancementWizard }
export default MediaEnhancementWizard