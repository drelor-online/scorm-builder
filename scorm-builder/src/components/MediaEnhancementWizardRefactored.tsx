import React, { useState, useRef, useEffect } from 'react'
import DOMPurify from 'dompurify'
import { CourseContentUnion, CourseContent, Media } from '../types/aiPrompt'
import { CourseSeedData } from '../types/course'
import { searchGoogleImages, searchYouTubeVideos, clearYouTubePageTokens, hasYouTubeNextPage, SearchResult as ApiSearchResult, SearchError } from '../services/searchService'
import { PageLayout } from './PageLayout'
import { MediaLibrary, MediaItem } from './MediaLibrary'
import { ConfirmDialog } from './ConfirmDialog'
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected'
import { CoursePreview } from './CoursePreview'
import { RichTextEditor } from './RichTextEditor'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useMedia } from '../contexts/MediaContext'
import { useStepData } from '../hooks/useStepData'
import { invoke } from '@tauri-apps/api/core'
import { generateMediaId, getPageIndex } from '../services/idGenerator'
import { 
  Button, 
  Card, 
  Input, 
  ButtonGroup,
  Section,
  Grid,
  Flex,
  LoadingSpinner,
  Pagination,
  Alert as DesignAlert
} from './DesignSystem'
import './DesignSystem/designSystem.css'
import { tokens } from './DesignSystem/designTokens'

interface MediaEnhancementWizardProps {
  courseContent: CourseContentUnion
  courseSeedData?: CourseSeedData
  onNext: (content: CourseContentUnion) => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
  apiKeys?: {
    googleImageApiKey: string
    googleCseId: string
    youtubeApiKey: string
  }
}

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
}

// Alert component
const Alert: React.FC<{ 
  type: 'info' | 'warning' | 'success'
  children: React.ReactNode 
}> = ({ type, children }) => {
  const colors = {
    info: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd' },
    warning: { bg: 'rgba(251, 146, 60, 0.1)', border: 'rgba(251, 146, 60, 0.2)', text: '#fdba74' },
    success: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)', text: '#86efac' }
  }
  
  return (
    <div className={`alert alert-${type}`} style={{
      backgroundColor: colors[type].bg,
      border: `1px solid ${colors[type].border}`,
      borderRadius: '0.5rem',
      padding: '1rem',
      color: colors[type].text,
      fontSize: '0.875rem'
    }}>
      {children}
    </div>
  )
}

type PageType = 'welcome' | 'objectives' | 'topic'

interface CurrentPage {
  type: PageType
  index: number
}

// Type guard to check if content is new format
function isNewFormat(content: CourseContentUnion): content is CourseContent {
  return 'welcomePage' in content && 'learningObjectivesPage' in content && 'assessment' in content
}

export const MediaEnhancementWizard: React.FC<MediaEnhancementWizardProps> = ({
  courseContent,
  courseSeedData,
  onNext,
  onBack,
  onSettingsClick,
  onSave,
  onSaveAs,
  onOpen,
  onHelp,
  onStepClick,
  apiKeys
}) => {
  const storage = useStorage()
  const { storeMedia, getMediaUrl, isLoading: isMediaLoading } = useMedia()
  const [updatedContent, setUpdatedContent] = useState<CourseContentUnion>(courseContent)
  const [currentPage, setCurrentPage] = useState<CurrentPage>({ type: 'welcome', index: 0 })
  const [searchQuery, setSearchQuery] = useState('')
  const [videoSearchQuery, setVideoSearchQuery] = useState('')
  const [imageSearchResults, setImageSearchResults] = useState<SearchResult[]>([])
  const [videoSearchResults, setVideoSearchResults] = useState<SearchResult[]>([])
  const [imageSearchPage, setImageSearchPage] = useState(1)
  const [videoSearchPage, setVideoSearchPage] = useState(1)
  const [isSearchingImages, setIsSearchingImages] = useState(false)
  const [isSearchingVideos, setIsSearchingVideos] = useState(false)
  const [imageSearchError, setImageSearchError] = useState<string | null>(null)
  const [videoSearchError, setVideoSearchError] = useState<string | null>(null)
  const [hasMoreImages, setHasMoreImages] = useState(false)
  const [hasMoreVideos, setHasMoreVideos] = useState(false)
  const [isLoadingMoreImages, setIsLoadingMoreImages] = useState(false)
  const [isLoadingMoreVideos, setIsLoadingMoreVideos] = useState(false)
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; media: SearchResult | null; type: 'image' | 'video' }>({ 
    isOpen: false, 
    media: null, 
    type: 'image' 
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isInitialMount = useRef(true)
  const [storageError, setStorageError] = useState<string | null>(null)
  
  // Confirmation dialog state
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
  const [pendingMedia, setPendingMedia] = useState<Media | null>(null)
  const [generalError, setGeneralError] = useState<string | null>(null)
  
  // Media source state - removed library feature
  const [mediaSource, setMediaSource] = useState<'search' | 'library'>('search')
  const [isLoadingMedia] = useState(false) // setIsLoadingMedia is now handled by useStepData
  const [mediaLibraryItems] = useState<MediaItem[]>([]) // Empty array since library feature was removed
  
  // Content editor state
  const [showContentEditor, setShowContentEditor] = useState(false)
  
  // Get current page content
  const getCurrentPageContent = () => {
    if (!isNewFormat(updatedContent)) {
      // For legacy format, return a placeholder
      return {
        id: 'legacy',
        title: 'Legacy Content',
        content: 'This wizard requires the new content format.',
        narration: '',
        imageKeywords: [],
        imagePrompts: [],
        videoSearchTerms: [],
        duration: 0,
        media: []
      }
    }
    
    switch (currentPage.type) {
      case 'welcome':
        return updatedContent.welcomePage
      case 'objectives':
        return updatedContent.learningObjectivesPage
      case 'topic':
        return updatedContent.topics[currentPage.index]
      default:
        throw new Error('Invalid page type')
    }
  }
  
  // Load persisted data when step becomes active
  const loadPersistedData = async () => {
    if (!storage.isInitialized || !isNewFormat(updatedContent)) return
    
    // Wait for MediaStore to be loaded
    if (isMediaLoading) {
      console.log('[MediaEnhancement] Waiting for MediaStore to load...')
      return
    }
    
    try {
      // Load media for current page
      const pageId = currentPageContent.id
      console.log('[MediaEnhancement] Loading media for page:', pageId, 'type:', currentPage.type)
      const storedMedia = await storage.getMediaForTopic(pageId)
      console.log('[MediaEnhancement] Found stored media:', storedMedia?.length || 0, 'items')
      
      if (storedMedia && storedMedia.length > 0) {
        // Filter for only images and videos - exclude audio and captions
        const filteredMedia = storedMedia.filter((item: any) => {
          const mediaType = item.mediaType || item.type
          const isImageOrVideo = mediaType === 'image' || mediaType === 'video'
          if (!isImageOrVideo) {
            console.log('[MediaEnhancement] Filtering out non-image/video media:', item.id, 'type:', mediaType)
          }
          return isImageOrVideo
        })
        
        console.log('[MediaEnhancement] Filtered media:', filteredMedia.length, 'image/video items from', storedMedia.length, 'total items')
        
        const mediaItems: Media[] = filteredMedia.map((item: any) => {
          console.log('[MediaEnhancement] Processing stored media item:', item.id, 'type:', item.mediaType, 'has blob:', !!item.blob, 'blob size:', item.blob?.size)
          
          // Don't store any URLs in state - they should always be fetched fresh from MediaStore
          return {
            id: item.id,
            type: item.mediaType || item.type || 'image', // Use mediaType or type field
            url: '', // Always empty - will be loaded from MediaStore when needed
            title: item.title || item.metadata?.originalName || 'Untitled',
            embedUrl: item.embedUrl,
            storageId: item.id
          }
        })
        
        // Only update content if we have image/video media after filtering
        if (filteredMedia.length > 0) {
          // Update content with loaded media
          switch (currentPage.type) {
            case 'welcome':
              setUpdatedContent(prev => ({
                ...prev as CourseContent,
                welcomePage: {
                  ...(prev as CourseContent).welcomePage,
                  media: mediaItems
                }
              }))
              break
            case 'objectives':
              setUpdatedContent(prev => ({
                ...prev as CourseContent,
                learningObjectivesPage: {
                  ...(prev as CourseContent).learningObjectivesPage,
                  media: mediaItems
                }
              }))
              break
            case 'topic':
              setUpdatedContent(prev => {
                const content = prev as CourseContent
                const updatedTopics = content.topics.map((topic, index) => {
                  if (index === currentPage.index) {
                    return { ...topic, media: mediaItems }
                  }
                  return topic
                })
                return { ...content, topics: updatedTopics }
              })
              break
          }
        } else {
          console.log('[MediaEnhancement] No image/video media found for page after filtering')
        }
      }
    } catch (error) {
      console.error('Failed to load persisted media:', error)
      setStorageError('Failed to load saved media')
    }
  }
  
  // Use step data hook to reload when returning to step 2
  useStepData(loadPersistedData, { 
    step: 2,
    dependencies: [storage?.isInitialized, courseContent, currentPage.type, currentPage.index, getMediaUrl, isMediaLoading]
  })
  
  
  // Media selections are saved to FileStorage through the main autosave
  
  // Results per page handled by search service
  
  // Update state when courseContent prop changes, but preserve local modifications
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    
    // Only update if the courseContent has actually changed and we haven't made local modifications
    const hasLocalChanges = JSON.stringify(updatedContent) !== JSON.stringify(courseContent)
    if (!hasLocalChanges) {
      setUpdatedContent(courseContent)
    }
  }, [courseContent])
  
  const currentPageContent = getCurrentPageContent()
  // Filter out audio files when checking if page has media
  const pageMedia = currentPageContent.media?.filter((m: any) => 
    m.type !== 'audio' && m.mediaType !== 'audio'
  ) || []
  const hasMedia = pageMedia.length > 0
  
  console.log('[MediaEnhancement] Current page content:', {
    pageId: currentPageContent.id,
    pageType: currentPage.type,
    mediaCount: pageMedia.length,
    hasMedia: hasMedia,
    media: pageMedia,
    firstMediaUrl: pageMedia[0]?.url,
    firstMediaType: pageMedia[0]?.type,
    isValidBlobUrl: pageMedia[0]?.url?.startsWith('blob:')
  })
  
  // Load media for current page from persistent storage
  // This is now handled by useStepData hook above
  useEffect(() => {
    // const loadPageMedia = async () => {
      if (!storage.isInitialized || !isNewFormat(updatedContent)) return
      
      // Skip if we're using useStepData for loading (step 2)
      return
      
      // setIsLoadingMedia(true)
      // try {
      //   const pageId = currentPageContent.id
      //   const storedMedia = await storage.getMediaForTopic(pageId)
        
        // Rest of the code is commented out as it's now handled by useStepData
        /*
        if (storedMedia && storedMedia.length > 0) {
        //   // Update the current page with loaded media
        //   const mediaItems: Media[] = storedMedia.map((item: any) => ({
        //     id: item.id,
        //     type: item.type,
        //     url: item.url,
        //     title: item.title || item.metadata?.originalName || 'Untitled',
        //     embedUrl: item.embedUrl,
        //     storageId: item.id // Reference to the stored media
        //   }))
          
          // Update content with loaded media
          switch (currentPage.type) {
            case 'welcome':
              setUpdatedContent(prev => ({
                ...prev as CourseContent,
                welcomePage: {
                  ...(prev as CourseContent).welcomePage,
                  media: mediaItems
                }
              }))
              break
            case 'objectives':
              setUpdatedContent(prev => ({
                ...prev as CourseContent,
                learningObjectivesPage: {
                  ...(prev as CourseContent).learningObjectivesPage,
                  media: mediaItems
                }
              }))
              break
            case 'topic':
              setUpdatedContent(prev => {
                const content = prev as CourseContent
                const updatedTopics = content.topics.map((topic, index) => {
                  if (index === currentPage.index) {
                    return {
                      ...topic,
                      media: mediaItems
                    }
                  }
                  return topic
                })
                return { ...content, topics: updatedTopics }
              })
              break
          }
        }
      } catch (error) {
        console.error('Failed to load media for page:', error)
        setStorageError('Failed to load media from storage')
      } finally {
        setIsLoadingMedia(false)
      }
      */
    // }
    
    // Now handled by useStepData hook
    // loadPageMedia()
  }, [currentPage, storage.isInitialized])
  
  // Calculate total pages and current page number
  const totalPages = isNewFormat(updatedContent) ? 2 + updatedContent.topics.length : 0 // Welcome + Objectives + Topics
  const getCurrentPageNumber = () => {
    switch (currentPage.type) {
      case 'welcome':
        return 1
      case 'objectives':
        return 2
      case 'topic':
        return 3 + currentPage.index
    }
  }
  const currentPageNumber = getCurrentPageNumber()

  // Clear general error after 5 seconds
  useEffect(() => {
    if (generalError) {
      const timer = setTimeout(() => setGeneralError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [generalError])

  const handleNext = async () => {
    // Save all content before navigating
    if (storage.isInitialized && isNewFormat(updatedContent)) {
      try {
        // Save content for each page
        const content = updatedContent as CourseContent
        
        // Save welcome page
        await storage.saveContent('welcome', {
          ...content.welcomePage,
          media: content.welcomePage.media?.map(m => ({
            id: m.id,
            type: m.type,
            title: m.title,
            storageId: (m as any).storageId || m.id
            // Explicitly exclude url to prevent blob URL persistence
          }))
        })
        
        // Save objectives page
        await storage.saveContent('objectives', {
          ...content.learningObjectivesPage,
          media: content.learningObjectivesPage.media?.map(m => ({
            id: m.id,
            type: m.type,
            title: m.title,
            storageId: (m as any).storageId || m.id
            // Explicitly exclude url to prevent blob URL persistence
          }))
        })
        
        // Save topics with numeric IDs
        for (let i = 0; i < content.topics.length; i++) {
          const topic = content.topics[i]
          const numericContentId = `content-${2 + i}` // Topics start at content-2
          await storage.saveContent(numericContentId, {
            ...topic,
            media: topic.media?.map(m => ({
              id: m.id,
              type: m.type,
              title: m.title,
              storageId: (m as any).storageId || m.id
              // Explicitly exclude url to prevent blob URL persistence
            }))
          })
        }
      } catch (error) {
        console.error('Failed to save content:', error)
        setStorageError('Failed to save content')
      }
    }
    
    onNext(updatedContent)
  }

  const handlePreviousTopic = () => {
    if (currentPage.type === 'topic' && currentPage.index > 0) {
      setCurrentPage({ type: 'topic', index: currentPage.index - 1 })
      resetSearchState()
    } else if (currentPage.type === 'topic' && currentPage.index === 0) {
      setCurrentPage({ type: 'objectives', index: 0 })
      resetSearchState()
    } else if (currentPage.type === 'objectives') {
      setCurrentPage({ type: 'welcome', index: 0 })
      resetSearchState()
    }
  }

  const handleNextTopic = () => {
    if (currentPage.type === 'welcome') {
      setCurrentPage({ type: 'objectives', index: 0 })
      resetSearchState()
    } else if (currentPage.type === 'objectives') {
      setCurrentPage({ type: 'topic', index: 0 })
      resetSearchState()
    } else if (currentPage.type === 'topic' && currentPage.index < updatedContent.topics.length - 1) {
      setCurrentPage({ type: 'topic', index: currentPage.index + 1 })
      resetSearchState()
    }
  }

  const resetSearchState = () => {
    setSearchQuery('')
    setVideoSearchQuery('')
    setImageSearchResults([])
    setVideoSearchResults([])
    setImageSearchPage(1)
    setVideoSearchPage(1)
  }

  const handleSearchImages = async (query?: string, page?: number) => {
    const searchTerm = query || searchQuery
    if (!searchTerm.trim() || !apiKeys?.googleImageApiKey || !apiKeys?.googleCseId) return
    
    const pageToSearch = page || imageSearchPage
    const isNewSearch = page === 1 || (!page && imageSearchPage === 1)
    
    if (isNewSearch) {
      setIsSearchingImages(true)
    } else {
      setIsLoadingMoreImages(true)
    }
    
    setImageSearchError(null)
    try {
      const results = await searchGoogleImages(
        searchTerm,
        pageToSearch,
        apiKeys.googleImageApiKey,
        apiKeys.googleCseId
      )
      
      const formattedResults: SearchResult[] = results.map((result: ApiSearchResult) => ({
        id: result.id,
        url: result.url,
        title: result.title,
        thumbnail: result.thumbnail,
        source: result.source
      }))
      
      setImageSearchResults(formattedResults)
      // If we get 10 results, assume there might be more
      setHasMoreImages(formattedResults.length >= 10)
      
      if (page) {
        setImageSearchPage(page)
      }
    } catch (error) {
      // Handle error without console.error
      if (error instanceof SearchError) {
        switch (error.code) {
          case 'RATE_LIMIT':
            setImageSearchError('API rate limit exceeded. Please try again later.')
            break
          case 'INVALID_KEY':
            setImageSearchError('Invalid API key. Please check your Google API settings.')
            break
          case 'NETWORK_ERROR':
            setImageSearchError('Network error. Please check your internet connection.')
            break
          default:
            setImageSearchError('Failed to search images. Please try again.')
        }
      } else {
        setImageSearchError('Failed to search images. Please check your API keys and try again.')
      }
      setImageSearchResults([])
      setHasMoreImages(false)
    } finally {
      setIsSearchingImages(false)
      setIsLoadingMoreImages(false)
    }
  }

  const handleSearchVideos = async (query?: string, page?: number) => {
    const searchTerm = query || videoSearchQuery
    if (!searchTerm.trim() || !apiKeys?.youtubeApiKey) return
    
    const pageToSearch = page || videoSearchPage
    const isNewSearch = page === 1 || (!page && videoSearchPage === 1)
    
    if (isNewSearch) {
      setIsSearchingVideos(true)
      // Clear YouTube page tokens for new searches
      clearYouTubePageTokens(searchTerm)
    } else {
      setIsLoadingMoreVideos(true)
    }
    
    setVideoSearchError(null)
    try {
      const results = await searchYouTubeVideos(
        searchTerm,
        pageToSearch,
        apiKeys.youtubeApiKey
      )
      
      const formattedResults: SearchResult[] = results
      
      setVideoSearchResults(formattedResults)
      
      // For YouTube, check if there's a next page token
      // If we have results, check if there's a next page
      if (formattedResults.length > 0) {
        setHasMoreVideos(hasYouTubeNextPage(searchTerm, pageToSearch))
      } else {
        setHasMoreVideos(false)
      }
      
      if (page) {
        setVideoSearchPage(page)
      }
    } catch (error) {
      // Handle error without console.error
      if (error instanceof SearchError) {
        switch (error.code) {
          case 'RATE_LIMIT':
            setVideoSearchError('YouTube API rate limit exceeded. Please try again later.')
            break
          case 'INVALID_KEY':
            setVideoSearchError('Invalid YouTube API key or quota exceeded. Please check your settings.')
            break
          case 'NETWORK_ERROR':
            setVideoSearchError('Network error. Please check your internet connection.')
            break
          default:
            setVideoSearchError('Failed to search videos. Please try again.')
        }
      } else {
        setVideoSearchError('Failed to search videos. Please check your API keys and try again.')
      }
      setVideoSearchResults([])
      setHasMoreVideos(false)
    } finally {
      setIsSearchingVideos(false)
      setIsLoadingMoreVideos(false)
    }
  }

  const handleAddMedia = async (media: Media & { storageId?: string }) => {
    if (!isNewFormat(updatedContent)) return
    
    // Check if media already exists for the current page
    const currentContent = getCurrentPageContent()
    const currentMedia = currentContent.media?.filter((m: any) => 
      m.type !== 'audio' && m.mediaType !== 'audio'
    ) || []
    if (currentMedia.length > 0) {
      // Show confirmation dialog for replacement
      setPendingMedia(media)
      setShowReplaceConfirm(true)
    } else {
      // No existing media, add directly
      await addMediaToPage(media)
    }
  }

  const addMediaToPage = async (media: Media & { storageId?: string }) => {
    if (!isNewFormat(updatedContent)) return
    
    let newContent = updatedContent
    
    // Create media object without blob URL to prevent persistence issues
    const mediaWithoutBlobUrl: Media = {
      id: media.id,
      type: media.type,
      title: media.title,
      url: '', // Empty URL - will be loaded from MediaStore when needed
      storageId: media.storageId || media.id,
      // For videos, we may need embedUrl for YouTube videos
      ...(media.embedUrl ? { embedUrl: media.embedUrl } : {})
    }
    
    switch (currentPage.type) {
      case 'welcome':
        newContent = {
          ...updatedContent,
          welcomePage: {
            ...updatedContent.welcomePage,
            media: [mediaWithoutBlobUrl] // Replace instead of append
          }
        }
        setUpdatedContent(newContent)
        break
      case 'objectives':
        newContent = {
          ...updatedContent,
          learningObjectivesPage: {
            ...updatedContent.learningObjectivesPage,
            media: [mediaWithoutBlobUrl] // Replace instead of append
          }
        }
        setUpdatedContent(newContent)
        break
      case 'topic':
        const updatedTopics = updatedContent.topics.map((topic, index) => {
          if (index === currentPage.index) {
            return {
              ...topic,
              media: [mediaWithoutBlobUrl] // Replace instead of append
            }
          }
          return topic
        })
        newContent = { ...updatedContent, topics: updatedTopics }
        setUpdatedContent(newContent)
        break
    }
    
    // Save content with media reference (without blob or url)
    if (storage.isInitialized && media.storageId) {
      try {
        const pageContent = currentPage.type === 'welcome' 
          ? (newContent as CourseContent).welcomePage
          : currentPage.type === 'objectives'
          ? (newContent as CourseContent).learningObjectivesPage
          : (newContent as CourseContent).topics[currentPage.index]
          
        const contentToSave = {
          ...pageContent,
          media: [{
            id: media.id,
            type: media.type,
            title: media.title,
            storageId: media.storageId
            // Explicitly exclude url and blob
          }]
        }
        await storage.saveContent(currentPageContent.id, contentToSave)
      } catch (error) {
        console.error('Failed to save content:', error)
        setStorageError('Failed to save media reference')
      }
    }
  }

  const handleConfirmReplaceMedia = async () => {
    if (pendingMedia) {
      await addMediaToPage(pendingMedia)
      setPendingMedia(null)
      setShowReplaceConfirm(false)
    }
  }

  const handleRemoveMedia = (e: React.MouseEvent) => {
    // Prevent any default behavior and stop propagation
    e.preventDefault()
    e.stopPropagation()
    
    if (!isNewFormat(updatedContent)) return
    
    // Ensure we have media before showing confirmation
    const currentContent = getCurrentPageContent()
    const currentMedia = currentContent.media?.filter((m: any) => 
      m.type !== 'audio' && m.mediaType !== 'audio'
    ) || []
    if (currentMedia.length === 0) {
      console.warn('No media to remove')
      return
    }
    
    // Show confirmation dialog
    setShowRemoveConfirm(true)
  }

  const handleConfirmRemoveMedia = () => {
    if (!isNewFormat(updatedContent)) return
    
    switch (currentPage.type) {
      case 'welcome':
        setUpdatedContent({
          ...updatedContent,
          welcomePage: {
            ...updatedContent.welcomePage,
            media: []
          }
        })
        break
      case 'objectives':
        setUpdatedContent({
          ...updatedContent,
          learningObjectivesPage: {
            ...updatedContent.learningObjectivesPage,
            media: []
          }
        })
        break
      case 'topic':
        const updatedTopics = updatedContent.topics.map((topic, index) => {
          if (index === currentPage.index) {
            return {
              ...topic,
              media: []
            }
          }
          return topic
        })
        setUpdatedContent({ ...updatedContent, topics: updatedTopics })
        break
    }
    
    // Close dialog
    setShowRemoveConfirm(false)
  }

  const handleSaveContent = async (newContent: string) => {
    if (!isNewFormat(updatedContent)) return
    
    let newCourseContent = updatedContent
    
    switch (currentPage.type) {
      case 'welcome':
        newCourseContent = {
          ...updatedContent,
          welcomePage: {
            ...updatedContent.welcomePage,
            content: newContent
          }
        }
        break
      case 'objectives':
        newCourseContent = {
          ...updatedContent,
          learningObjectivesPage: {
            ...updatedContent.learningObjectivesPage,
            content: newContent
          }
        }
        break
      case 'topic':
        const updatedTopics = updatedContent.topics.map((topic, index) => {
          if (index === currentPage.index) {
            return {
              ...topic,
              content: newContent
            }
          }
          return topic
        })
        newCourseContent = { ...updatedContent, topics: updatedTopics }
        break
    }
    
    setUpdatedContent(newCourseContent)
    
    // Save to storage
    if (storage.isInitialized) {
      try {
        const pageContent = currentPage.type === 'welcome' 
          ? (newCourseContent as CourseContent).welcomePage
          : currentPage.type === 'objectives'
          ? (newCourseContent as CourseContent).learningObjectivesPage
          : (newCourseContent as CourseContent).topics[currentPage.index]
          
        await storage.saveContent(currentPageContent.id, pageContent)
      } catch (error) {
        console.error('Failed to save content:', error)
        setStorageError('Failed to save content changes')
      }
    }
    
    setShowContentEditor(false)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file size (50MB limit for images, 200MB for videos)
      const maxSize = file.type.startsWith('video/') ? 200 * 1024 * 1024 : 50 * 1024 * 1024
      if (file.size > maxSize) {
        const sizeMB = Math.round(file.size / (1024 * 1024))
        const maxSizeMB = maxSize / (1024 * 1024)
        setGeneralError(`File size (${sizeMB}MB) exceeds the maximum allowed size of ${maxSizeMB}MB`)
        return
      }
      
      try {
        // Generate numeric ID for the media
        let pageIndex: number
        
        // Use currentPage info which is always accurate
        if (currentPage.type === 'welcome') {
          pageIndex = 0
        } else if (currentPage.type === 'objectives') {
          pageIndex = 1
        } else if (currentPage.type === 'topic') {
          pageIndex = getPageIndex('topic', currentPage.index)
        } else {
          // For special pages like KC or summary, use a high index
          pageIndex = 999
        }
        const mediaId = generateMediaId('image', pageIndex)
        const mediaType = file.type.startsWith('video/') ? 'video' : 'image' as 'image' | 'video'
        
        console.log('[MediaEnhancement] Storage initialized:', storage.isInitialized)
        console.log('[MediaEnhancement] Adding media with numeric ID:', mediaId, mediaType)
        
        if (storage.isInitialized) {
          // Store media using new MediaContext API
          console.log('[MediaEnhancement] Calling storeMedia...')
          await storeMedia(
            mediaId,
            file,
            {
              page_id: currentPageContent.id,
              type: mediaType as 'image' | 'video' | 'audio',
              original_name: file.name,
              mime_type: file.type,
              title: file.name
            }
          )
          
          // Also store in old system for backward compatibility
          await storage.storeMedia(
            mediaId,
            file,
            mediaType,
            {
              topicId: currentPageContent.id,
              originalName: file.name,
              size: file.size,
              uploadedAt: new Date().toISOString()
            }
          )
        } else {
          console.warn('[MediaEnhancement] Storage not initialized! Media will not be persisted.')
        }
        
        // Create media object with storage reference
        const media: Media & { storageId?: string } = {
          id: mediaId,
          type: mediaType,
          url: URL.createObjectURL(file), // Temporary URL for preview
          title: file.name,
          storageId: storage.isInitialized ? mediaId : undefined,
          blob: !storage.isInitialized ? file : undefined // Store blob if storage not available
        }
        await handleAddMedia(media)
      } catch (error) {
        console.error('Failed to upload file:', error)
        setStorageError('Failed to save media. Please try again.')
      }
    }
  }

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
  }

  const handleAddMediaFromLibrary = async (item: MediaItem) => {
    // Generate numeric ID for the media
    let pageIndex: number
    
    // Use currentPage info which is always accurate
    if (currentPage.type === 'welcome') {
      pageIndex = 0
    } else if (currentPage.type === 'objectives') {
      pageIndex = 1
    } else if (currentPage.type === 'topic') {
      pageIndex = getPageIndex('topic', currentPage.index)
    } else {
      // For special pages like KC or summary, use a high index
      pageIndex = 999
    }
    const mediaId = generateMediaId('image', pageIndex)
    const media: Media & { storageId?: string } = {
      id: mediaId,
      type: item.type === 'video' ? 'video' : item.type === 'audio' ? 'audio' : 'image',
      url: item.url,
      title: item.name,
      storageId: item.id // Keep original storage ID for library reference
    }
    await handleAddMedia(media)
  }

  const handleLibraryUpload = async (file: { file: File; name: string; type: string; size: number }) => {
    try {
      // Generate numeric ID for the media
      const pageIndex = getPageIndex(currentPageContent.id.includes('welcome') ? 'welcome' : 
                                      currentPageContent.id.includes('objectives') ? 'objectives' : 
                                      'topic', 
                                      currentPageContent.id.startsWith('topic-') ? 
                                      parseInt(currentPageContent.id.replace('topic-', '')) : 0)
      const mediaId = generateMediaId('image', pageIndex)
      const mediaType = file.type === 'video' ? 'video' : file.type === 'audio' ? 'audio' : 'image' as 'image' | 'video' | 'audio'
      
      console.log('[MediaEnhancement Library] Storage initialized:', storage.isInitialized)
      console.log('[MediaEnhancement Library] Adding media with numeric ID:', mediaId, mediaType)
      
      if (storage.isInitialized) {
        // Store media using new MediaContext API
        console.log('[MediaEnhancement Library] Calling storeMedia...')
        await storeMedia(
          mediaId,
          file.file,
          {
            page_id: currentPageContent.id,
            type: mediaType as 'image' | 'video' | 'audio',
            original_name: file.name,
            mime_type: file.file.type,
            title: file.name
          }
        )
        
        // Also store in old system for backward compatibility
        await storage.storeMedia(
          mediaId,
          file.file,
          mediaType,
          {
            isLibraryItem: true,
            originalName: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            topicId: currentPageContent.id
          }
        )
        
        // Get the stored media URL from new system
        const url = getMediaUrl(mediaId) || URL.createObjectURL(file.file)
        
        // Create media item (newItem variable removed as it was unused)
        // Media is stored directly to storage without creating an intermediate MediaItem
        
        // Also add to the current page
        const media: Media & { storageId?: string } = {
          id: mediaId,
          type: mediaType,
          url: url,
          title: file.name,
          storageId: mediaId
        }
        await handleAddMedia(media)
      } else {
        // Fallback to data URL if storage not available
        const reader = new FileReader()
        reader.onload = async (e) => {
          const url = e.target?.result as string
            
          // Add to the current page
          const media: Media = {
            id: mediaId,
            type: mediaType,
            url: url,
            title: file.name,
            blob: file.file
          }
          await handleAddMedia(media)
        }
        reader.readAsDataURL(file.file)
      }
    } catch (error) {
      console.error('Failed to upload to library:', error)
      setStorageError('Failed to save media to library')
    }
  }

  const openPreview = (media: SearchResult, type: 'image' | 'video') => {
    setPreviewModal({ isOpen: true, media, type })
  }

  const closePreview = () => {
    setPreviewModal({ isOpen: false, media: null, type: 'image' })
  }

  const selectFromPreview = async () => {
    if (previewModal.media) {
      try {
        // Generate numeric ID for the media
        let pageIndex: number
        
        // Use currentPage info which is always accurate
        if (currentPage.type === 'welcome') {
          pageIndex = 0
        } else if (currentPage.type === 'objectives') {
          pageIndex = 1
        } else if (currentPage.type === 'topic') {
          pageIndex = getPageIndex('topic', currentPage.index)
        } else {
          // For special pages like KC or summary, use a high index
          pageIndex = 999
        }
        const mediaId = generateMediaId('image', pageIndex)
        const mediaType = previewModal.type
        
        if (storage.isInitialized && mediaType === 'image') {
          // Download all images via Tauri to bypass CORS issues
          
          // Try to download image via Tauri to bypass CORS
          try {
            console.log('[MediaEnhancement] Downloading image via Tauri:', previewModal.media.url)
            
            const response = await invoke<{ base64_data: string, content_type: string }>('download_image', {
              url: previewModal.media.url
            })
            
            console.log('[MediaEnhancement] Downloaded image content_type:', response.content_type)
            
            // Convert base64 to blob
            const base64Response = await fetch(`data:${response.content_type};base64,${response.base64_data}`)
            const blob = await base64Response.blob()
            
            console.log('[MediaEnhancement Preview] Calling storeMedia for image...')
            console.log('[MediaEnhancement] Blob type:', blob.type, 'size:', blob.size)
            
            await storeMedia(
              mediaId,
              blob,
              {
                page_id: currentPageContent.id,
                type: 'image',
                original_name: previewModal.media.title || 'search-image.jpg',
                mime_type: response.content_type || blob.type, // Use response content type if available
                title: previewModal.media.title,
                source: 'search'
              }
            )
            
            // Also store in old system for backward compatibility
            await storage.storeMedia(
              mediaId,
              blob,
              'image',
              {
                topicId: currentPageContent.id,
                source: 'search',
                originalUrl: previewModal.media.url,
                title: previewModal.media.title,
                photographer: previewModal.media.photographer,
                sourceWebsite: previewModal.media.source
              }
            )
            
            const mediaToAdd: Media & { storageId?: string } = {
              id: mediaId,
              type: mediaType,
              url: previewModal.media.url,
              title: previewModal.media.title,
              storageId: mediaId
            }
            handleAddMedia(mediaToAdd)
          } catch (error) {
            console.error('Failed to download and store image:', error)
            // Fallback to using URL directly
            const mediaToAdd: Media = {
              id: mediaId,
              type: mediaType,
              url: previewModal.media.url,
              title: previewModal.media.title
            }
            handleAddMedia(mediaToAdd)
          }
        } else {
          // For videos or when storage not available, use URL directly
          const mediaToAdd: Media & { storageId?: string } = {
            id: mediaId,
            type: mediaType,
            url: previewModal.media.url,
            title: previewModal.media.title,
            embedUrl: previewModal.media.embedUrl,
            storageId: storage.isInitialized ? mediaId : undefined
          }
          
          if (storage.isInitialized && mediaType === 'video') {
            // Store video metadata using new MediaContext API
            console.log('[MediaEnhancement Preview] Calling storeMedia for video metadata...')
            await storeMedia(
              mediaId,
              new Blob([JSON.stringify({
                url: previewModal.media.url,
                embedUrl: previewModal.media.embedUrl,
                title: previewModal.media.title
              })], { type: 'application/json' }),
              {
                page_id: currentPageContent.id,
                type: 'video',
                original_name: previewModal.media.title || 'search-video.json',
                mime_type: 'application/json',
                title: previewModal.media.title,
                source: 'search',
                embed_url: previewModal.media.embedUrl
              }
            )
            
            // Also store in old system for backward compatibility
            await storage.storeMedia(
              mediaId,
              new Blob([JSON.stringify({
                url: previewModal.media.url,
                embedUrl: previewModal.media.embedUrl,
                title: previewModal.media.title
              })], { type: 'application/json' }),
              'video',
              {
                topicId: currentPageContent.id,
                source: 'search',
                isEmbedOnly: true,
                originalUrl: previewModal.media.url,
                embedUrl: previewModal.media.embedUrl
              }
            )
          }
          
          handleAddMedia(mediaToAdd)
        }
        closePreview()
      } catch (error) {
        console.error('Failed to select media:', error)
        setStorageError('Failed to save selected media')
      }
    }
  }

  const autoSaveIndicator = (
    <AutoSaveIndicatorConnected />
  )

  const coursePreviewElement = courseSeedData && isNewFormat(updatedContent) ? (
    <CoursePreview 
      courseContent={updatedContent as CourseContent}
      courseSeedData={courseSeedData}
    />
  ) : null

  return (
    <PageLayout
      currentStep={3}
      title="Media Enhancement"
      description="Add media to enhance your course content"
      autoSaveIndicator={autoSaveIndicator}
      coursePreview={coursePreviewElement}
      onSettingsClick={onSettingsClick}
      onBack={onBack}
      onNext={handleNext}
      onSave={onSave}
      onSaveAs={onSaveAs}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
    >
      {/* Topic Progress */}
      <Flex justify="end" style={{ marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>
          Page {currentPageNumber} of {totalPages}
        </span>
      </Flex>

      {/* Storage Error */}
      {storageError && (
        <Section>
          <DesignAlert variant="warning">
            {storageError}
          </DesignAlert>
        </Section>
      )}
      
      {/* General error alert */}
      {generalError && (
        <Section>
          <DesignAlert variant="error">
            {generalError}
          </DesignAlert>
        </Section>
      )}

      {/* API Keys Warning */}
      {(!apiKeys || !apiKeys.googleImageApiKey || !apiKeys.googleCseId || !apiKeys.youtubeApiKey) && (
        <Section>
          <Alert type="warning">
            <strong>API keys not configured.</strong> Image and video search features require API keys. 
            Please configure your Google Custom Search and YouTube API keys in Settings to enable search functionality.
          </Alert>
        </Section>
      )}

      {/* Page Content */}
      <Section>
        <Card title={currentPageContent.title}>
          <div 
            style={{
              backgroundColor: '#18181b',
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: '0.5rem',
              padding: '1.5rem',
              marginBottom: '1.5rem'
            }}
          >
            <div 
              style={{
                color: '#e4e4e7',
                lineHeight: 1.6
              }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentPageContent.content) }}
            />
          </div>

          {/* Edit Content Button */}
          <Flex justify="center" style={{ marginBottom: '1.5rem' }}>
            <Button
              onClick={() => setShowContentEditor(true)}
              variant="secondary"
              size="small"
            >
              Edit Content
            </Button>
          </Flex>

          {/* Topic Navigation */}
          <Flex justify="space-between" style={{ marginBottom: '1.5rem' }}>
            {currentPageNumber > 1 ? (
              <Button
                onClick={handlePreviousTopic}
                variant="secondary"
                size="small"
              >
                ← Previous Topic
              </Button>
            ) : (
              <div />
            )}
            {currentPageNumber < totalPages ? (
              <Button
                onClick={handleNextTopic}
                variant="secondary"
                size="small"
              >
                Next Topic →
              </Button>
            ) : (
              <div />
            )}
          </Flex>
        </Card>
      </Section>

      {/* Current Media */}
      <Section>
        <Card title="Current Media">
          {(isLoadingMedia || isMediaLoading) ? (
            <Flex justify="center" style={{ padding: '2rem' }}>
              <LoadingSpinner text="Loading media..." />
            </Flex>
          ) : hasMedia ? (
            <>
              <Alert type="success">
                ✓ Media has been added to this topic
              </Alert>
              
              {/* Media Preview */}
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '1rem', color: '#e4e4e7' }}>Media Preview</h4>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#18181b',
                  border: `1px solid ${tokens.colors.border.default}`,
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  maxWidth: '400px',
                  maxHeight: '300px',
                  margin: '0 auto',
                  overflow: 'hidden'
                }}>
                  {pageMedia && pageMedia[0] && (() => {
                    const media = pageMedia[0]
                    
                    // Filter out audio files - they shouldn't be displayed on media enhancement page
                    if (media.type === 'audio' || media.mediaType === 'audio') {
                      console.log('[MediaEnhancement] Skipping audio file in display:', media.id)
                      return null
                    }
                    
                    // Always get fresh URL from MediaStore
                    // Always get URL from MediaStore, never use persisted URLs
                    const freshUrl = getMediaUrl(media.id)
                    if (!freshUrl) {
                      console.warn('[MediaEnhancement] No URL available for media:', media.id)
                      return null
                    }
                    
                    return media.type === 'image' ? (
                      <img
                        src={freshUrl}
                        alt={media.title || 'Image'}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain'
                        }}
                        onError={(e) => {
                          console.error('[MediaEnhancement] Failed to load image:', freshUrl)
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <iframe
                        src={media.embedUrl || freshUrl}
                        title={media.title || 'Video'}
                        width="100%"
                        height="250"
                        frameBorder="0"
                        allowFullScreen
                        style={{
                          border: 'none',
                          borderRadius: '0.25rem'
                        }}
                      />
                    )
                  })()}
                </div>
              </div>
              
              <Flex justify="center" style={{ marginTop: '1rem' }}>
                <Button 
                  onClick={handleRemoveMedia} 
                  variant="danger" 
                  size="small" 
                  type="button"
                >
                  Remove Media
                </Button>
              </Flex>
            </>
          ) : (
            <Alert type="info">
              No media added yet. Use the search below or upload your own.
            </Alert>
          )}
        </Card>
      </Section>

      {/* Media Source Tabs */}
      <Section>
        <div style={{ marginBottom: '1rem' }}>
          <ButtonGroup>
            <Button
              variant={mediaSource === 'search' ? 'primary' : 'secondary'}
              onClick={() => setMediaSource('search')}
            >
              Search Online
            </Button>
            <Button
              variant={mediaSource === 'library' ? 'primary' : 'secondary'}
              onClick={() => setMediaSource('library' as 'search' | 'library')}
            >
              Media Library
            </Button>
          </ButtonGroup>
        </div>

        {/* Search View */}
        {mediaSource === 'search' && (
          <Card title="Image Search">
          <Flex gap="medium" style={{ marginBottom: '1rem' }}>
            <Input
              placeholder="Search for images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchImages(undefined, 1)}
              fullWidth
              aria-label="Search for images"
            />
            <Button
              onClick={() => handleSearchImages(undefined, 1)}
              disabled={!searchQuery.trim() || isSearchingImages || !apiKeys?.googleImageApiKey || !apiKeys?.googleCseId}
              variant="primary"
              aria-label="Search images"
            >
              {isSearchingImages ? 'Searching...' : 'Search'}
            </Button>
          </Flex>

          {/* Image Search Suggestions */}
          {currentPageContent.imageKeywords && currentPageContent.imageKeywords.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>
                Suggested searches:
              </p>
              <ButtonGroup gap="small">
                {currentPageContent.imageKeywords.map((keyword: string, index: number) => (
                  <Button
                    key={index}
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      setSearchQuery(keyword)
                      handleSearchImages(keyword, 1)
                    }}
                  >
                    {keyword}
                  </Button>
                ))}
              </ButtonGroup>
            </div>
          )}

          {/* Image Search Error */}
          {imageSearchError && (
            <Alert type="warning">
              {imageSearchError}
            </Alert>
          )}

          {isSearchingImages && (
            <Flex justify="center" style={{ padding: '2rem' }}>
              <LoadingSpinner text="Searching images..." />
            </Flex>
          )}

          {!isSearchingImages && imageSearchResults.length > 0 && (
            <>
              <div className="image-grid">
                {imageSearchResults.map((image) => (
                  <div
                    key={image.id}
                    className="image-item"
                    style={{
                      border: `1px solid ${tokens.colors.border.default}`,
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                    }}
                    onClick={() => openPreview(image, 'image')}
                  >
                    <img
                      src={image.thumbnail || image.url}
                      alt={image.title}
                    />
                    <div style={{ padding: '0.75rem', position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
                      <p style={{ fontSize: '0.875rem', color: '#e4e4e7', margin: 0 }}>
                        {image.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <Pagination
                currentPage={imageSearchPage}
                hasNextPage={hasMoreImages}
                onPageChange={(page) => handleSearchImages(undefined, page)}
                isLoading={isLoadingMoreImages}
              />
            </>
          )}
          </Card>
        )}

        {/* Library View */}
        {mediaSource === 'library' && (
          <MediaLibrary
            items={mediaLibraryItems}
            onSelect={(item) => {
              if (!Array.isArray(item)) {
                handleAddMediaFromLibrary(item)
              }
            }}
            onUpload={(file) => {
              handleLibraryUpload(file)
            }}
            onDelete={() => {
              // Delete functionality removed
            }}
            multiSelect={false}
          />
        )}
      </Section>

      {/* Video Search - Only show when in search mode */}
      {mediaSource === 'search' && (
        <Section>
          <Card title="Video Search">
          <Flex gap="medium" style={{ marginBottom: '1rem' }}>
            <Input
              placeholder="Search for videos..."
              value={videoSearchQuery}
              onChange={(e) => setVideoSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchVideos(undefined, 1)}
              fullWidth
              aria-label="Search for videos"
            />
            <Button
              onClick={() => handleSearchVideos(undefined, 1)}
              disabled={!videoSearchQuery.trim() || isSearchingVideos || !apiKeys?.youtubeApiKey}
              variant="primary"
              aria-label="Search videos"
            >
              {isSearchingVideos ? 'Searching...' : 'Search'}
            </Button>
          </Flex>

          {/* Video Search Suggestions */}
          {currentPageContent.videoSearchTerms && currentPageContent.videoSearchTerms.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>
                Suggested searches:
              </p>
              <ButtonGroup gap="small">
                {currentPageContent.videoSearchTerms.map((term: string, index: number) => (
                  <Button
                    key={index}
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      setVideoSearchQuery(term)
                      handleSearchVideos(term, 1)
                    }}
                  >
                    {term}
                  </Button>
                ))}
              </ButtonGroup>
            </div>
          )}

          {/* Video Search Error */}
          {videoSearchError && (
            <Alert type="warning">
              {videoSearchError}
            </Alert>
          )}

          {isSearchingVideos && (
            <Flex justify="center" style={{ padding: '2rem' }}>
              <LoadingSpinner text="Searching videos..." />
            </Flex>
          )}

          {!isSearchingVideos && videoSearchResults.length > 0 && (
            <>
              <div className="image-grid">
                {videoSearchResults.map((video) => (
                  <div
                    key={video.id}
                    className="image-item"
                    style={{
                      border: `1px solid ${tokens.colors.border.default}`,
                      cursor: 'pointer',
                      transition: 'transform 0.2s',
                    }}
                    onClick={() => openPreview(video, 'video')}
                  >
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                    />
                    <div style={{ padding: '0.75rem', position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
                      <p style={{ fontSize: '0.875rem', color: '#e4e4e7', margin: 0 }}>
                        {video.title}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: '#71717a', margin: '0.25rem 0 0 0' }}>
                        {video.channel}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <Pagination
                currentPage={videoSearchPage}
                hasNextPage={hasMoreVideos}
                onPageChange={(page) => handleSearchVideos(undefined, page)}
                isLoading={isLoadingMoreVideos}
              />
            </>
          )}
          </Card>
        </Section>
      )}

      {/* Upload - Only show when in search mode */}
      {mediaSource === 'search' && (
        <Section>
          <Card title="Upload Media">
          <ButtonGroup gap="medium">
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="secondary"
              icon="📁"
            >
              Choose File
            </Button>
            <Alert type="info">
              Supported formats: JPG, PNG, GIF, MP4, WebM
            </Alert>
          </ButtonGroup>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          </Card>
        </Section>
      )}

      {/* AI Image Generators - Only show when in search mode */}
      {mediaSource === 'search' && (
        <Section>
        <Card title="AI Image Generators">
          <Alert type="info">
            <strong>Use these AI tools to generate custom images for your course.</strong><br />
            Copy the prompt below and paste it into your preferred AI image generator.
          </Alert>
          
          {/* AI Generator Links */}
          <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.75rem' }}>
              Popular AI Image Generators:
            </p>
            <Grid cols={2} gap="medium">
              <a
                href="https://openai.com/dall-e-3"
                target="_blank"
                rel="noopener noreferrer"
                className="ai-generator-link"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: '#27272a',
                  border: `1px solid ${tokens.colors.border.default}`,
                  borderRadius: '0.5rem',
                  color: '#e4e4e7',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  gap: '0.5rem'
                }}
              >
                🎨 DALL-E 3
              </a>
              <a
                href="https://www.midjourney.com"
                target="_blank"
                rel="noopener noreferrer"
                className="ai-generator-link"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: '#27272a',
                  border: `1px solid ${tokens.colors.border.default}`,
                  borderRadius: '0.5rem',
                  color: '#e4e4e7',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  gap: '0.5rem'
                }}
              >
                🖼️ Midjourney
              </a>
              <a
                href="https://stability.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="ai-generator-link"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: '#27272a',
                  border: `1px solid ${tokens.colors.border.default}`,
                  borderRadius: '0.5rem',
                  color: '#e4e4e7',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  gap: '0.5rem'
                }}
              >
                🌟 Stable Diffusion
              </a>
              <a
                href="https://www.adobe.com/products/firefly.html"
                target="_blank"
                rel="noopener noreferrer"
                className="ai-generator-link"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.75rem',
                  backgroundColor: '#27272a',
                  border: `1px solid ${tokens.colors.border.default}`,
                  borderRadius: '0.5rem',
                  color: '#e4e4e7',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  gap: '0.5rem'
                }}
              >
                🔥 Adobe Firefly
              </a>
            </Grid>
          </div>

          {/* AI Image Prompt */}
          {currentPageContent.imagePrompts && currentPageContent.imagePrompts.length > 0 && (
            <>
              <p style={{ fontSize: '0.875rem', color: '#a1a1aa', marginBottom: '0.5rem' }}>
                AI Image Prompt:
              </p>
              <div style={{
                backgroundColor: '#18181b',
                border: `1px solid ${tokens.colors.border.default}`,
                borderRadius: '0.5rem',
                padding: '1rem',
                marginBottom: '1rem',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: '#e4e4e7'
              }}>
                {currentPageContent.imagePrompts[0]}
              </div>
              <Flex justify="center" style={{ marginBottom: '1rem' }}>
                <Button
                  onClick={() => handleCopyPrompt(currentPageContent.imagePrompts[0])}
                  variant="secondary"
                  size="small"
                >
                  Copy Prompt
                </Button>
              </Flex>
            </>
          )}
          </Card>
        </Section>
      )}

      {/* Search Helper - Only show when in search mode */}
      {mediaSource === 'search' && (
        <Section>
        <Card title="Search Helper">
          <Alert type="info">
            Need help finding media? Copy this prompt for AI assistance:
          </Alert>
          <div style={{
            backgroundColor: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginTop: '1rem',
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            color: '#e4e4e7'
          }}>
            {`Find relevant images for: "${currentPageContent.title}"`}
          </div>
          <Flex justify="center" style={{ marginTop: '1rem' }}>
            <Button
              onClick={() => handleCopyPrompt(`Find relevant images for: "${currentPageContent.title}"`)}
              variant="secondary"
              size="small"
            >
              Copy Prompt
            </Button>
          </Flex>
          </Card>
        </Section>
      )}

      {/* Preview Modal */}
      {previewModal.isOpen && previewModal.media && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto', backgroundColor: '#27272a', border: `1px solid ${tokens.colors.border.default}`, borderRadius: '0.5rem', padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>{previewModal.media.title}</h3>
            {previewModal.type === 'image' ? (
              <img
                src={previewModal.media.url}
                alt={previewModal.media.title}
                style={{ width: '100%', height: 'auto' }}
              />
            ) : (
              <iframe
                src={previewModal.media.embedUrl}
                title={previewModal.media.title}
                width="100%"
                height="450"
                frameBorder="0"
                allowFullScreen
              />
            )}
            <Flex justify="space-between" style={{ marginTop: '1.5rem' }}>
              <Button onClick={closePreview} variant="secondary">
                Cancel
              </Button>
              <Button onClick={selectFromPreview} variant="primary">
                Select This {previewModal.type === 'image' ? 'Image' : 'Video'}
              </Button>
            </Flex>
          </div>
        </div>
      )}

      {/* Remove Media Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRemoveConfirm}
        title="Remove Media"
        message="Are you sure you want to remove the media from this topic? This action cannot be undone."
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmRemoveMedia}
        onCancel={() => setShowRemoveConfirm(false)}
      />

      {/* Replace Media Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showReplaceConfirm}
        title="Replace Media"
        message="This topic already has media. Do you want to replace it with the new selection?"
        confirmText="Replace"
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleConfirmReplaceMedia}
        onCancel={() => {
          setShowReplaceConfirm(false)
          setPendingMedia(null)
        }}
      />

      {/* Rich Text Editor for Content Editing */}
      {showContentEditor && (
        <RichTextEditor
          isOpen={showContentEditor}
          content={currentPageContent.content}
          onSave={handleSaveContent}
          onCancel={() => setShowContentEditor(false)}
        />
      )}
    </PageLayout>
  )
}