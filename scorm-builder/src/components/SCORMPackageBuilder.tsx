import React, { useState, useEffect, useRef, memo } from 'react'
import { CourseContent, Media, Topic } from '../types/aiPrompt'
import type { EnhancedCourseContent } from '../types/scorm'
import type { CourseMetadata } from '../types/metadata'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import { convertToEnhancedCourseContent } from '../services/courseContentConverter'
import { generateRustSCORM } from '../services/rustScormGenerator'
import { useStorage } from '../contexts/PersistentStorageContext'
import { DEFAULT_COURSE_SETTINGS, type CourseSettings } from './CourseSettingsWizard'
import { useMedia } from '../hooks/useMedia'
import { useNotifications } from '../contexts/NotificationContext'
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor'
import { sanitizeScormFileName } from '../utils/fileSanitizer'
import { debugLogger } from '../utils/ultraSimpleLogger'
import { safeDeepClone } from '../utils/safeClone'
import { getExtensionFromMimeType } from '../services/rustScormGenerator'

import { PageLayout } from './PageLayout'
import { 
  Card, 
  Button, 
  LoadingSpinner,
  ProgressBar,
  Icon
} from './DesignSystem'
import { Package, Download, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react'
import './DesignSystem/designSystem.css'
import type { CourseSeedData } from '../types/course'

// Helper function to inject missing topic media from storage into course content
function injectMissingTopicMedia(courseContent: CourseContent, storageMedia: any[]): CourseContent {
  console.log('[SCORMPackageBuilder] Injecting missing topic media from storage')
  
  // Create a map of page_id to media for easy lookup
  const mediaByPageId = new Map<string, any[]>()
  storageMedia.forEach(media => {
    const pageId = media.pageId || media.metadata?.page_id
    if (pageId) {
      if (!mediaByPageId.has(pageId)) {
        mediaByPageId.set(pageId, [])
      }
      mediaByPageId.get(pageId)!.push(media)
    }
  })
  
  debugLogger.info('MEDIA_INJECTION', 'Storage media grouped by page ID', {
    totalStorageMedia: storageMedia.length,
    pageIdGroups: Array.from(mediaByPageId.entries()).map(([pageId, media]) => ({
      pageId,
      mediaCount: media.length,
      mediaIds: media.map(m => m.id)
    }))
  })
  
  // Create a deep copy of course content to avoid mutating the original
  const injectedContent = safeDeepClone(courseContent)
  
  // Track injections for logging
  const injectionLog: { topicId: string; injectedMediaIds: string[] }[] = []
  
  // Inject missing media into topics
  injectedContent.topics.forEach((topic: Topic, index: number) => {
    const topicPageId = topic.id
    const storageMediaForTopic = mediaByPageId.get(topicPageId) || []
    const existingMediaIds = new Set(topic.media?.map((m: Media) => m.id) || [])
    
    // Find media in storage that's not in course content
    const missingMedia = storageMediaForTopic.filter((media: any) => !existingMediaIds.has(media.id))
    
    if (missingMedia.length > 0) {
      console.log(`[SCORMPackageBuilder] Injecting ${missingMedia.length} missing media items into ${topicPageId}:`, missingMedia.map(m => m.id))
      
      // Add missing media to the topic
      topic.media = topic.media || []
      const injectedIds: string[] = []
      
      missingMedia.forEach((media: any) => {
        const isYouTubeVideo = media.type === 'youtube' || media.metadata?.isYouTube
        
        let mediaItem: Media
        
        if (isYouTubeVideo) {
          // Special handling for YouTube videos - preserve metadata properties
          const embedUrl = media.metadata?.embedUrl || media.metadata?.embed_url
          const youtubeUrl = media.metadata?.youtubeUrl || media.metadata?.youtube_url || media.url
          
          debugLogger.info('MEDIA_INJECTION', 'Injecting YouTube video with preserved metadata', {
            mediaId: media.id,
            mediaType: media.type,
            topicPageId,
            embedUrl,
            youtubeUrl,
            clipStart: media.metadata?.clipStart,
            clipEnd: media.metadata?.clipEnd,
            isYouTube: true
          })
          
          // FIXED: Ensure URL is never undefined to prevent Rust deserialization errors
          const fallbackUrl = `https://www.youtube.com/embed/${media.id.replace('video-', '')}`
          const safeUrl = embedUrl || youtubeUrl || fallbackUrl
          const safeEmbedUrl = embedUrl || safeUrl
          const safeYoutubeUrl = youtubeUrl || (safeEmbedUrl.includes('/embed/') ? 
            safeEmbedUrl.replace('/embed/', '/watch?v=').split('?')[0] + '?v=' + safeEmbedUrl.split('/embed/')[1].split('?')[0] : 
            safeUrl)

          debugLogger.info('MEDIA_INJECTION', 'YouTube URL fallback applied', {
            mediaId: media.id,
            originalEmbedUrl: embedUrl,
            originalYoutubeUrl: youtubeUrl,
            safeUrl,
            safeEmbedUrl,
            safeYoutubeUrl,
            fallbackUsed: !embedUrl && !youtubeUrl
          })

          mediaItem = {
            id: media.id,
            type: media.type,
            url: safeUrl, // FIXED: Never undefined, always has fallback
            title: media.metadata?.title || `YouTube Video ${media.id}`,
            storageId: media.id,
            // Preserve YouTube-specific properties for extractCourseContentMedia()
            embedUrl: safeEmbedUrl,
            youtubeUrl: safeYoutubeUrl,
            isYouTube: true,
            clipStart: media.metadata?.clipStart,
            clipEnd: media.metadata?.clipEnd,
          } as any // Cast to allow extra properties
        } else {
          // Regular media handling (images, local videos, etc.)
          const generatedUrl = media.url || (media.fileName ? `media/${media.fileName}` : `storage-ref-${media.id}`)
          
          debugLogger.info('MEDIA_INJECTION', 'Injecting regular media item', {
            mediaId: media.id,
            mediaType: media.type,
            topicPageId,
            hasFileName: !!media.fileName,
            fileName: media.fileName,
            originalUrl: media.url,
            generatedUrl,
            urlType: generatedUrl.startsWith('media/') ? 'relative-path' : 'storage-ref'
          })
          
          mediaItem = {
            id: media.id,
            type: media.type,
            url: generatedUrl,
            title: media.metadata?.title || `${media.type} for ${topicPageId}`,
            storageId: media.id
          }
        }
        
        topic.media!.push(mediaItem)
        injectedIds.push(media.id)
      })
      
      injectionLog.push({
        topicId: topicPageId,
        injectedMediaIds: injectedIds
      })
    }
  })
  
  debugLogger.info('MEDIA_INJECTION', 'Media injection completed', {
    totalTopics: injectedContent.topics.length,
    topicsWithInjections: injectionLog.length,
    injectionDetails: injectionLog,
    totalMediaInjected: injectionLog.reduce((sum, entry) => sum + entry.injectedMediaIds.length, 0)
  })
  
  console.log('[SCORMPackageBuilder] Media injection completed:', {
    topicsWithInjections: injectionLog.length,
    totalMediaInjected: injectionLog.reduce((sum, entry) => sum + entry.injectedMediaIds.length, 0),
    injectionDetails: injectionLog
  })
  
  return injectedContent
}

interface SCORMPackageBuilderProps {
  courseContent: CourseContent
  courseSeedData?: CourseSeedData
  onNext: () => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
}

interface Message {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  text: string
}

interface LoadingDetails {
  currentFile: string
  filesLoaded: number
  totalFiles: number
}

interface GeneratedPackage {
  data: ArrayBuffer
  metadata: CourseMetadata
}

interface PerformanceMetrics {
  conversionStart?: number
  conversionDuration?: number
  mediaLoadStart?: number
  mediaLoadDuration?: number
  rustGenerationStart?: number
  rustGenerationDuration?: number
  totalDuration?: number
  [key: string]: unknown
}

// Media files map will be created inside component to avoid memory leaks

const SCORMPackageBuilderComponent: React.FC<SCORMPackageBuilderProps> = ({
  courseContent,
  courseSeedData,
  onNext,
  onBack,
  onSettingsClick,
  onSave,
  onOpen,
  onHelp,
  onStepClick
}) => {
  // Create media files map inside component to avoid persistence issues
  const mediaFilesRef = React.useRef(new Map<string, Blob>())
  // AbortController to handle component unmounting and race conditions
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [generatedPackage, setGeneratedPackage] = useState<GeneratedPackage | null>(null)
  const [loadingMessage, setLoadingMessage] = useState('Preparing SCORM package...')
  // Autoplay is always enabled
  const audioAutoplay = true
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)
  const [mediaLoadProgress, setMediaLoadProgress] = useState(0)
  const [loadingDetails, setLoadingDetails] = useState<LoadingDetails>({
    currentFile: '',
    filesLoaded: 0,
    totalFiles: 0
  })
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [isCancellable, setIsCancellable] = useState(false)
  const [isGenerationCancelled, setIsGenerationCancelled] = useState(false)
  const generationAbortController = useRef<AbortController | null>(null)
  const storage = useStorage()
  const media = useMedia()
  
  // Extract commonly used methods
  const {
    createBlobUrl,
    storeMedia
  } = media.actions
  
  const {
    getMedia,
    getAllMedia,
    getMediaForPage
  } = media.selectors
  const { success, error: notifyError, info, progress, warning } = useNotifications()
  const { measureAsync } = usePerformanceMonitor({
    componentName: 'SCORMPackageBuilder',
    trackRenders: true
  })
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics | null>(null)

  // Cleanup media files map when component unmounts to prevent memory leaks
  useEffect(() => {
    return () => {
      console.log('[SCORMPackageBuilder] Cleaning up media files cache on unmount')
      
      // Abort any ongoing operations
      if (abortControllerRef.current) {
        console.log('[SCORMPackageBuilder] Aborting ongoing media operations')
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      
      mediaFilesRef.current.clear()
    }
  }, [])

  // Helper function to get correct extension from MIME type
  const getExtensionFromMedia = async (mediaId: string): Promise<string> => {
    try {
      const mediaData = await media.selectors.getMedia(mediaId)
      if (mediaData?.metadata?.mimeType) {
        const ext = getExtensionFromMimeType(mediaData.metadata.mimeType)
        if (ext) {
          console.log(`[SCORMPackageBuilder] Extension for ${mediaId}: .${ext} (from MIME: ${mediaData.metadata.mimeType})`)
          return `.${ext}`
        }
      }
      console.warn(`[SCORMPackageBuilder] No MIME type found for ${mediaId}, using .bin fallback`)
      return '.bin'
    } catch (error) {
      console.error(`[SCORMPackageBuilder] Error getting extension for ${mediaId}:`, error)
      return '.bin'
    }
  }

  // Helper function to get media blob from UnifiedMedia with proper cancellation
  const getMediaBlobFromRegistry = async (mediaId: string, signal?: AbortSignal): Promise<Blob | null> => {
    console.log('[SCORMPackageBuilder] Loading media:', mediaId)
    
    try {
      // Check if already aborted
      if (signal?.aborted) {
        console.log(`[SCORMPackageBuilder] Media loading aborted before start: ${mediaId}`)
        return null
      }
      
      // Create timeout with proper cleanup
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.warn(`[SCORMPackageBuilder] Timeout loading media: ${mediaId}`)
        controller.abort()
      }, 10000) // 10 second timeout per media file (increased since this is now used for fallbacks)
      
      // Combine signals - abort if either parent signal or timeout signal fires
      // Use AbortSignal.any if available (newer browsers), otherwise listen to parent signal manually
      let combinedSignal = controller.signal
      
      if (signal) {
        if (typeof AbortSignal.any === 'function') {
          combinedSignal = AbortSignal.any([signal, controller.signal])
        } else {
          // Fallback for older browsers - manually listen to parent signal
          const abortHandler = () => controller.abort()
          signal.addEventListener('abort', abortHandler, { once: true })
          
          // Clean up listener when our controller is aborted
          controller.signal.addEventListener('abort', () => {
            signal.removeEventListener('abort', abortHandler)
          }, { once: true })
        }
      }
      
      let mediaData
      try {
        // Pass the combined signal to getMedia if it supports it
        mediaData = await getMedia(mediaId)
        
        // Clear timeout on successful completion
        clearTimeout(timeoutId)
        
        // Check if we were aborted during the operation
        if (combinedSignal.aborted) {
          console.log(`[SCORMPackageBuilder] Media loading was aborted: ${mediaId}`)
          return null
        }
        
        if (!mediaData) {
          console.warn(`[SCORMPackageBuilder] Media not found: ${mediaId}`)
          return null
        }
      } catch (error) {
        // Clear timeout on error
        clearTimeout(timeoutId)
        
        // Check if this was an abort error
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`[SCORMPackageBuilder] Media loading aborted: ${mediaId}`)
          return null
        }
        
        console.error(`[SCORMPackageBuilder] Error loading media ${mediaId}:`, error)
        return null
      }
      console.log('[SCORMPackageBuilder] Media data retrieved:', {
        mediaId,
        hasData: !!mediaData?.data,
        hasUrl: !!mediaData?.url,
        dataType: mediaData?.data ? typeof mediaData.data : 'undefined',
        dataSize: (() => {
          if (!mediaData?.data) return 0
          const data = mediaData.data as any
          if (data instanceof Uint8Array) return data.length
          if (data instanceof ArrayBuffer) return data.byteLength
          return 0
        })(),
        metadata: mediaData?.metadata
      })
      
      if (mediaData) {
        // Check if we have binary data
        if (mediaData.data) {
          console.log('[SCORMPackageBuilder] Using binary data for:', mediaId)
          // Handle both Uint8Array and ArrayBuffer
          let dataArray: Uint8Array
          if (mediaData.data instanceof ArrayBuffer) {
            dataArray = new Uint8Array(mediaData.data)
          } else if (mediaData.data instanceof Uint8Array) {
            dataArray = mediaData.data
          } else {
            // For other array-like types
            dataArray = new Uint8Array(mediaData.data as any)
          }
          return new Blob([dataArray as BlobPart], { 
            type: mediaData.metadata?.mimeType || (mediaData.metadata as any)?.mime_type || 'application/octet-stream' 
          })
        }
        
        // If we have a blob URL but no data, we need to fetch the data
        // This can happen if the media was loaded but not with binary data
        if (mediaData.url && mediaData.url.startsWith('blob:')) {
          console.log('[SCORMPackageBuilder] Fetching from blob URL for:', mediaId)
          try {
            // Check if already aborted before starting fetch
            if (combinedSignal.aborted) {
              console.log(`[SCORMPackageBuilder] Blob fetch aborted before start: ${mediaId}`)
              return null
            }
            
            // Use the same combined signal for fetch
            const response = await fetch(mediaData.url, { signal: combinedSignal })
            const blob = await response.blob()
            
            // Check if aborted after fetch
            if (combinedSignal.aborted) {
              console.log(`[SCORMPackageBuilder] Blob processing aborted: ${mediaId}`)
              return null
            }
            
            console.log('[SCORMPackageBuilder] Successfully fetched blob:', {
              mediaId,
              size: blob.size,
              type: blob.type
            })
            return blob
          } catch (fetchError: unknown) {
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              console.log(`[SCORMPackageBuilder] Blob fetch aborted for: ${mediaId}`)
            } else {
              console.error('[SCORMPackageBuilder] Failed to fetch blob URL:', fetchError)
            }
            return null
          }
        }
        
        // For external URLs (YouTube, etc.), we don't need binary data
        if (mediaData.metadata?.isYouTube || mediaData.metadata?.source === 'youtube') {
          console.log('[SCORMPackageBuilder] Skipping YouTube video:', mediaId)
          return null // YouTube videos don't need binary data
        }
      }
    } catch (error) {
      console.error('[SCORMPackageBuilder] Error getting media:', error)
    }
    
    console.log('[SCORMPackageBuilder] No binary data available for:', mediaId)
    return null
  }

  const loadMediaFromRegistry = async (enhancedContent: EnhancedCourseContent, signal?: AbortSignal): Promise<string[]> => {
    console.log('[SCORMPackageBuilder] Starting BATCH media loading from UnifiedMedia')

    // Helper function to create unique tracking key for media (prevents overwrites of same ID with different types)
    const createMediaTrackingKey = (id: string, type?: string): string => {
      return type ? `${id}:${type}` : id
    }

    // Track loaded media to prevent duplicates (using ID:type to allow same ID with different types)
    const loadedMediaIds = new Set<string>()
    const failedMedia: string[] = []
    let loadedCount = 0

    // 🚀 BATCH OPTIMIZATION: Collect all media IDs first, then load in batches
    const mediaToLoad: Array<{
      id: string
      type?: string
      fileName: string
      trackingKey: string
      source: 'welcome' | 'objectives' | 'topic'
      topicIndex?: number
    }> = []
    
    // Get all media items
    const allMediaItems = getAllMedia()
    console.log('[SCORMPackageBuilder] Found', allMediaItems.length, 'media items in storage')
    
    // DEBUG: Log detailed course content media structure to identify missing mappings
    debugLogger.info('MEDIA_LOADING', 'Course content vs storage media analysis', {
      courseContentStructure: {
        welcomeMedia: enhancedContent.welcome?.media || [],
        objectivesMedia: enhancedContent.objectivesPage?.media || [],
        topicsWithMedia: enhancedContent.topics?.map((topic, index) => ({
          topicIndex: index,
          topicId: topic.id,
          mediaCount: topic.media?.length || 0,
          mediaItems: topic.media?.map(m => ({ id: m.id, type: m.type })) || []
        })) || []
      },
      allStorageMedia: allMediaItems.map(m => ({ 
        id: m.id, 
        pageId: m.pageId || m.metadata?.page_id, 
        type: m.type,
        fileName: m.fileName,
        metadata: m.metadata
      })),
      storageProjectId: storage.currentProjectId
    })
    
    // Helper function to detect media type from URL
    const detectMediaType = (url: string): 'image' | 'video' | 'audio' => {
      const urlLower = url.toLowerCase()
      
      // Audio file extensions
      if (urlLower.match(/\.(mp3|wav|ogg|aac|flac|m4a)(\?|$)/)) {
        return 'audio'
      }
      
      // Video file extensions
      if (urlLower.match(/\.(mp4|webm|avi|mov|wmv|flv|mkv)(\?|$)/)) {
        return 'video'
      }
      
      // Image file extensions (default)
      return 'image'
    }

    // Helper function to handle remote media - only downloads if not already stored
    const handleRemoteMedia = async (url: string, mediaType: 'image' | 'video' | 'audio', pageId: string): Promise<string | null> => {
      if (!url || !url.startsWith('http')) return null
      
      // Check if this remote URL has already been stored
      const existingMedia = allMediaItems.find(item => 
        item.metadata?.originalUrl === url || 
        item.metadata?.source === 'remote' && item.metadata?.originalName === url.split('/').pop()
      )
      
      if (existingMedia) {
        console.log('[SCORMPackageBuilder] Remote media already stored:', existingMedia.id)
        return existingMedia.id
      }
      
      // Only download if not already stored
      try {
        console.log('[SCORMPackageBuilder] Downloading new remote media:', url)
        const response = await fetch(url)
        const blob = await response.blob()
        
        // Store the remote media locally using UnifiedMediaContext
        const mediaItem = await storeMedia(blob, pageId, mediaType, {
          originalUrl: url,
          originalName: url.split('/').pop() || 'remote-media',
          source: 'remote',
          mimeType: blob.type
        })
        
        console.log('[SCORMPackageBuilder] Stored remote media with ID:', mediaItem.id)
        return mediaItem.id
      } catch (error) {
        console.error('[SCORMPackageBuilder] Failed to download remote media:', error)
        return null
      }
    }
    
    // 🚀 PHASE 1: Collect all media IDs from course content (no loading yet)
    console.log('[SCORMPackageBuilder] Phase 1: Collecting media IDs for batch loading')

    // Handle audioBlobs first (these don't need batch loading)
    if (enhancedContent.welcome?.audioBlob && !enhancedContent.welcome.audioId && !enhancedContent.welcome.audioFile) {
      const generatedId = `audio-welcome-blob-${Date.now()}`
      console.log(`[SCORMPackageBuilder] Processing welcome audioBlob without ID, generating: ${generatedId}`)
      mediaFilesRef.current.set(`${generatedId}.mp3`, enhancedContent.welcome.audioBlob)
      loadedMediaIds.add(generatedId)
      enhancedContent.welcome.audioId = generatedId
      loadedCount++
      console.log(`[SCORMPackageBuilder] ✓ Added welcome audioBlob: ${generatedId}`)
    }

    // Collect welcome page media IDs
    if (enhancedContent.welcome) {
      const welcomeAudioId = enhancedContent.welcome.audioId || enhancedContent.welcome.audioFile
      const welcomeCaptionId = enhancedContent.welcome.captionId || enhancedContent.welcome.captionFile
      const welcomeMedia = enhancedContent.welcome.media || []

      if (welcomeAudioId) {
        const trackingKey = createMediaTrackingKey(welcomeAudioId, 'audio')
        if (!loadedMediaIds.has(trackingKey)) {
          loadedMediaIds.add(trackingKey)
          mediaToLoad.push({
            id: welcomeAudioId,
            type: 'audio',
            fileName: `${welcomeAudioId}.mp3`,
            trackingKey,
            source: 'welcome'
          })
        }
      }

      if (welcomeCaptionId) {
        const trackingKey = createMediaTrackingKey(welcomeCaptionId, 'caption')
        if (!loadedMediaIds.has(trackingKey)) {
          loadedMediaIds.add(trackingKey)
          mediaToLoad.push({
            id: welcomeCaptionId,
            type: 'caption',
            fileName: `${welcomeCaptionId}.vtt`,
            trackingKey,
            source: 'welcome'
          })
        }
      }

      for (const mediaItem of welcomeMedia) {
        const trackingKey = createMediaTrackingKey(mediaItem.id, mediaItem.type)
        if (mediaItem.id && !loadedMediaIds.has(trackingKey)) {
          loadedMediaIds.add(trackingKey)
          mediaToLoad.push({
            id: mediaItem.id,
            type: mediaItem.type,
            fileName: `${mediaItem.id}-${mediaItem.type}`, // Extension will be added later
            trackingKey,
            source: 'welcome'
          })
        } else if (mediaItem.url && mediaItem.url.startsWith('http')) {
          // Handle remote media (still needs individual processing for now)
          const detectedType = detectMediaType(mediaItem.url)
          const newId = await handleRemoteMedia(mediaItem.url, detectedType, 'welcome')
          if (newId) {
            mediaItem.id = newId
            const trackingKey = createMediaTrackingKey(newId, detectedType)
            if (!loadedMediaIds.has(trackingKey)) {
              loadedMediaIds.add(trackingKey)
              mediaToLoad.push({
                id: newId,
                type: detectedType,
                fileName: `remote-${Date.now()}`,
                trackingKey,
                source: 'welcome'
              })
            }
          }
        }
      }
    }
    
    // Collect objectives page media IDs
    if (enhancedContent.objectivesPage) {
      const objectivesAudioId = enhancedContent.objectivesPage.audioId || enhancedContent.objectivesPage.audioFile
      const objectivesCaptionId = enhancedContent.objectivesPage.captionId || enhancedContent.objectivesPage.captionFile
      const objectivesMedia = enhancedContent.objectivesPage.media || []

      if (objectivesAudioId) {
        const trackingKey = createMediaTrackingKey(objectivesAudioId, 'audio')
        if (!loadedMediaIds.has(trackingKey)) {
          loadedMediaIds.add(trackingKey)
          mediaToLoad.push({
            id: objectivesAudioId,
            type: 'audio',
            fileName: `${objectivesAudioId}.mp3`,
            trackingKey,
            source: 'objectives'
          })
        }
      }

      if (objectivesCaptionId) {
        const trackingKey = createMediaTrackingKey(objectivesCaptionId, 'caption')
        if (!loadedMediaIds.has(trackingKey)) {
          loadedMediaIds.add(trackingKey)
          mediaToLoad.push({
            id: objectivesCaptionId,
            type: 'caption',
            fileName: `${objectivesCaptionId}.vtt`,
            trackingKey,
            source: 'objectives'
          })
        }
      }

      for (const mediaItem of objectivesMedia) {
        const trackingKey = createMediaTrackingKey(mediaItem.id, mediaItem.type)
        if (mediaItem.id && !loadedMediaIds.has(trackingKey)) {
          loadedMediaIds.add(trackingKey)
          mediaToLoad.push({
            id: mediaItem.id,
            type: mediaItem.type,
            fileName: `${mediaItem.id}-${mediaItem.type}`,
            trackingKey,
            source: 'objectives'
          })
        } else if (mediaItem.url && mediaItem.url.startsWith('http')) {
          const detectedType = detectMediaType(mediaItem.url)
          const newId = await handleRemoteMedia(mediaItem.url, detectedType, 'objectives')
          if (newId) {
            mediaItem.id = newId
            const trackingKey = createMediaTrackingKey(newId, detectedType)
            if (!loadedMediaIds.has(trackingKey)) {
              loadedMediaIds.add(trackingKey)
              mediaToLoad.push({
                id: newId,
                type: detectedType,
                fileName: `remote-${Date.now()}`,
                trackingKey,
                source: 'objectives'
              })
            }
          }
        }
      }
    }
    
    // Collect topics media IDs
    if (enhancedContent.topics) {
      for (let topicIndex = 0; topicIndex < enhancedContent.topics.length; topicIndex++) {
        const topic = enhancedContent.topics[topicIndex]

        // Handle audioBlob without ID FIRST for this topic (recorded audio that hasn't been saved to registry)
        if (topic.audioBlob && !topic.audioId && !topic.audioFile) {
          const generatedId = `audio-topic-${topicIndex}-blob-${Date.now()}`
          console.log(`[SCORMPackageBuilder] Processing topic ${topicIndex} audioBlob without ID, generating: ${generatedId}`)
          mediaFilesRef.current.set(`${generatedId}.mp3`, topic.audioBlob)
          loadedMediaIds.add(generatedId)
          topic.audioId = generatedId
          loadedCount++
          console.log(`[SCORMPackageBuilder] ✓ Added topic ${topicIndex} audioBlob: ${generatedId}`)
        }

        const topicAudioId = topic.audioId || topic.audioFile
        const topicCaptionId = topic.captionId || topic.captionFile
        const topicMedia = topic.media || []

        if (topicAudioId) {
          const trackingKey = createMediaTrackingKey(topicAudioId, 'audio')
          if (!loadedMediaIds.has(trackingKey)) {
            loadedMediaIds.add(trackingKey)
            mediaToLoad.push({
              id: topicAudioId,
              type: 'audio',
              fileName: `${topicAudioId}.mp3`,
              trackingKey,
              source: 'topic',
              topicIndex
            })
          }
        }

        if (topicCaptionId) {
          const trackingKey = createMediaTrackingKey(topicCaptionId, 'caption')
          if (!loadedMediaIds.has(trackingKey)) {
            loadedMediaIds.add(trackingKey)
            mediaToLoad.push({
              id: topicCaptionId,
              type: 'caption',
              fileName: `${topicCaptionId}.vtt`,
              trackingKey,
              source: 'topic',
              topicIndex
            })
          }
        }

        // DEBUG: Log topic media processing details
        debugLogger.info('MEDIA_LOADING', `Topic ${topicIndex} media processing`, {
          topicIndex,
          topicId: topic.id,
          mediaCount: topicMedia.length,
          mediaItems: topicMedia.map(m => ({ id: m.id, type: m.type, hasUrl: !!m.url }))
        })

        for (const mediaItem of topicMedia) {
          const trackingKey = createMediaTrackingKey(mediaItem.id, mediaItem.type)

          if (mediaItem.id && !loadedMediaIds.has(trackingKey)) {
            loadedMediaIds.add(trackingKey)
            mediaToLoad.push({
              id: mediaItem.id,
              type: mediaItem.type,
              fileName: `${mediaItem.id}-${mediaItem.type}`,
              trackingKey,
              source: 'topic',
              topicIndex
            })
          } else if (mediaItem.url && mediaItem.url.startsWith('http')) {
            const detectedType = detectMediaType(mediaItem.url)
            const newId = await handleRemoteMedia(mediaItem.url, detectedType, `topic-${topicIndex}`)
            if (newId) {
              mediaItem.id = newId
              const trackingKey = createMediaTrackingKey(newId, detectedType)
              if (!loadedMediaIds.has(trackingKey)) {
                loadedMediaIds.add(trackingKey)
                mediaToLoad.push({
                  id: newId,
                  type: detectedType,
                  fileName: `remote-${Date.now()}`,
                  trackingKey,
                  source: 'topic',
                  topicIndex
                })
              }
            }
          }
        }
      }
    }

    // 🚀 PHASE 2: Batch load all collected media IDs
    console.log(`[SCORMPackageBuilder] Phase 2: Batch loading ${mediaToLoad.length} media files`)
    setLoadingMessage(`Loading ${mediaToLoad.length} media files...`)

    if (mediaToLoad.length > 0) {
      try {
        // Check for cancellation
        if (signal?.aborted) {
          console.log('[SCORMPackageBuilder] Batch loading was aborted before starting')
          return failedMedia
        }

        // Extract all media IDs for batch loading
        const mediaIds = mediaToLoad.map(m => m.id)
        console.log('[SCORMPackageBuilder] Calling getMedia for batch loading:', mediaIds)

        // 🚀 SINGLE BATCH CALL instead of 60+ individual calls
        const startTime = Date.now()
        const batchResults = await Promise.all(
          mediaIds.map(async (id) => {
            try {
              const result = await getMedia(id)
              return { id, result }
            } catch (error) {
              console.warn(`[SCORMPackageBuilder] Failed to load media ${id}:`, error)
              return { id, result: null, error }
            }
          })
        )
        const batchDuration = Date.now() - startTime
        console.log(`[SCORMPackageBuilder] ✅ Batch loading completed in ${batchDuration}ms`)

        // Process batch results
        for (const { id, result, error } of batchResults) {
          const mediaInfo = mediaToLoad.find(m => m.id === id)
          if (!mediaInfo) continue

          if (result?.data && result.data instanceof Uint8Array) {
            // Convert Uint8Array to Blob - create a new Uint8Array to ensure proper typing
            const blob = new Blob([new Uint8Array(result.data)], {
              type: result.metadata?.mimeType || 'application/octet-stream'
            })

            // Get proper extension
            const extension = await getExtensionFromMedia(id)
            const finalFileName = mediaInfo.fileName.includes('.')
              ? mediaInfo.fileName
              : `${mediaInfo.fileName}${extension}`

            mediaFilesRef.current.set(finalFileName, blob)
            loadedCount++

            console.log(`[SCORMPackageBuilder] ✓ Loaded ${mediaInfo.source} media: ${id} as ${finalFileName}`)
          } else {
            const errorDescription = `${mediaInfo.source}${mediaInfo.topicIndex !== undefined ? ` topic ${mediaInfo.topicIndex}` : ''} ${mediaInfo.type || 'media'}: ${id}`
            failedMedia.push(errorDescription)
            console.warn(`[SCORMPackageBuilder] ✗ Failed to load ${errorDescription}`)
          }
        }
      } catch (error) {
        console.error('[SCORMPackageBuilder] Batch loading failed:', error)
        // Fallback: mark all as failed
        mediaToLoad.forEach(mediaInfo => {
          const errorDescription = `${mediaInfo.source}${mediaInfo.topicIndex !== undefined ? ` topic ${mediaInfo.topicIndex}` : ''} ${mediaInfo.type || 'media'}: ${mediaInfo.id}`
          failedMedia.push(errorDescription)
        })
      }
    }
    
    console.log('[SCORMPackageBuilder] Media loading complete.')
    console.log(`[SCORMPackageBuilder] Successfully loaded: ${loadedCount} files`)
    console.log(`[SCORMPackageBuilder] Failed to load: ${failedMedia.length} files`)
    if (failedMedia.length > 0) {
      console.warn('[SCORMPackageBuilder] Failed media items:', failedMedia)
    }
    console.log('[SCORMPackageBuilder] Total files in package:', mediaFilesRef.current.size)
    
    // DEBUG: Final summary of media loading results
    debugLogger.info('MEDIA_LOADING', 'Media loading summary', {
      totalStorageMedia: allMediaItems.length,
      mediaFilesRefSize: mediaFilesRef.current.size,
      loadedCount,
      failedCount: failedMedia.length,
      failedMedia,
      loadedMediaIds: Array.from(loadedMediaIds),
      mediaFilesRefContents: Array.from(mediaFilesRef.current.keys())
    })
    
    return failedMedia
  }

  const generatePackage = async () => {
    debugLogger.info('SCORM_PACKAGE', 'Starting SCORM package generation', {
      courseTitle: courseContent.welcomePage?.title || courseSeedData?.courseTitle || 'Untitled Course',
      topicCount: courseContent.topics?.length || 0,
      hasMediaItems: !!(courseContent.topics?.some((topic: Topic) => topic.media && topic.media.length > 0) || courseContent.welcomePage?.media?.length || courseContent.learningObjectivesPage?.media?.length),
      storageProjectId: storage.currentProjectId
    })
    
    // Clear previous messages and media files
    setMessages([])
    mediaFilesRef.current.clear()  // FIX: Use ref instead of global
    setGeneratedPackage(null)
    setIsGenerating(true)
    setIsLoadingMedia(true)
    setIsCancellable(true)
    setIsGenerationCancelled(false)
    setGenerationProgress(0)
    setLoadingMessage('Preparing course content...')
    
    // Create new AbortController for this generation
    if (abortControllerRef.current) {
      abortControllerRef.current.abort() // Cancel any previous operation
    }
    abortControllerRef.current = new AbortController()
    const { signal } = abortControllerRef.current
    
    // Use the same controller for generation cancellation
    generationAbortController.current = abortControllerRef.current
    setGenerationStartTime(Date.now())
    
    // Start elapsed time counter
    const intervalId = setInterval(() => {
      setElapsedTime(prev => prev + 0.1)
    }, 100)
    
    // Store interval ID to clear later
    const clearElapsedTimer = () => clearInterval(intervalId)
    
    // Helper function to yield to UI thread
    const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 50))
    
    try {
      const startTime = Date.now()
      const performanceMetrics: PerformanceMetrics = {}
      
      debugLogger.info('SCORM_PACKAGE', 'SCORM generation pipeline started', {
        courseTitle: courseContent.welcomePage?.title || courseSeedData?.courseTitle || 'Untitled Course',
        timestamp: new Date().toISOString(),
        projectId: storage.currentProjectId
      })
      
      // Enhanced course content for Rust
      performanceMetrics.conversionStart = Date.now()
      
      // Debug: Log the incoming course content to check for audio media
      console.log('[SCORMPackageBuilder] DEBUG - Incoming course content:', {
        hasWelcomePage: !!courseContent.welcomePage,
        welcomeMedia: courseContent.welcomePage?.media,
        welcomeMediaTypes: courseContent.welcomePage?.media?.map((m: Media) => ({ id: m.id, type: m.type })),
        hasObjectivesPage: !!courseContent.learningObjectivesPage,
        objectivesMedia: courseContent.learningObjectivesPage?.media,
        objectivesMediaTypes: courseContent.learningObjectivesPage?.media?.map((m: Media) => ({ id: m.id, type: m.type })),
        topicCount: courseContent.topics?.length,
        firstTopicMedia: courseContent.topics?.[0]?.media,
        firstTopicMediaTypes: courseContent.topics?.[0]?.media?.map((m: Media) => ({ id: m.id, type: m.type }))
      })
      
      // Check for cancellation
      if (generationAbortController.current?.signal.aborted) {
        throw new Error('Generation cancelled by user')
      }
      
      setGenerationProgress(5)
      await yieldToUI()
      
      const metadata: CourseMetadata = {
        title: courseSeedData?.courseTitle || 'Untitled Course',
        identifier: storage.currentProjectId || 'default-project',
        version: '1.0',
        scormVersion: '1.2',
        duration: 0,
        passMark: 80
      }
      
      setGenerationProgress(10)
      setLoadingMessage('Injecting missing topic media from storage...')
      await yieldToUI()
      
      // Fix missing topic media by injecting from storage before conversion
      const allMediaItems = getAllMedia()
      const injectedCourseContent = injectMissingTopicMedia(courseContent, allMediaItems)
      
      setLoadingMessage('Converting course content to enhanced format...')
      await yieldToUI()
      
      const enhancedContent = await convertToEnhancedCourseContent(injectedCourseContent, metadata)
      performanceMetrics.conversionDuration = Date.now() - (typeof performanceMetrics.conversionStart === 'number' ? performanceMetrics.conversionStart : Date.now())
      
      debugLogger.info('SCORM_PACKAGE', 'Course content conversion completed', {
        projectId: storage.currentProjectId,
        conversionDurationMs: performanceMetrics.conversionDuration,
        hasWelcome: !!enhancedContent.welcome,
        hasObjectives: !!enhancedContent.objectivesPage,
        topicsCount: enhancedContent.topics?.length || 0
      })
      
      console.log('[SCORMPackageBuilder] Enhanced content ready:', enhancedContent)
      
      setGenerationProgress(15)
      await yieldToUI()
      
      // Debug: Log the enhanced content to check audio/caption fields
      console.log('[SCORMPackageBuilder] DEBUG - Enhanced content audio/caption fields:', {
        welcomeAudioFile: enhancedContent.welcome?.audioFile,
        welcomeAudioId: enhancedContent.welcome?.audioId,
        welcomeCaptionFile: enhancedContent.welcome?.captionFile,
        welcomeCaptionId: enhancedContent.welcome?.captionId,
        objectivesAudioFile: enhancedContent.objectivesPage?.audioFile,
        objectivesAudioId: enhancedContent.objectivesPage?.audioId,
        objectivesCaptionFile: enhancedContent.objectivesPage?.captionFile,
        objectivesCaptionId: enhancedContent.objectivesPage?.captionId,
        firstTopicAudioFile: enhancedContent.topics?.[0]?.audioFile,
        firstTopicAudioId: enhancedContent.topics?.[0]?.audioId,
        firstTopicCaptionFile: enhancedContent.topics?.[0]?.captionFile,
        firstTopicCaptionId: enhancedContent.topics?.[0]?.captionId
      })
      
      // Check for cancellation before media loading
      if (generationAbortController.current?.signal.aborted) {
        throw new Error('Generation cancelled by user')
      }
      
      setGenerationProgress(20)
      setLoadingMessage('Loading media files...')
      await yieldToUI()
      
      // Load media from MediaRegistry and collect blobs for SCORM generation
      performanceMetrics.mediaLoadStart = Date.now()
      let failedMedia: string[] = []
      try {
        console.log('[SCORMPackageBuilder] === STARTING MEDIA LOAD PHASE ===')
        failedMedia = await loadMediaFromRegistry(enhancedContent, signal)
        console.log('[SCORMPackageBuilder] === MEDIA LOAD PHASE COMPLETE ===')
        console.log('[SCORMPackageBuilder] Media files ready for packaging:', mediaFilesRef.current.size)
        
        setGenerationProgress(40)
        await new Promise<void>(resolve => setTimeout(resolve, 50))
        
        // Add blob references to enhanced content for Rust generator
        // The Rust generator needs these blobs to include media in the package
        if (enhancedContent.welcome) {
          const welcomeAudioId = enhancedContent.welcome.audioId || enhancedContent.welcome.audioFile
          const welcomeCaptionId = enhancedContent.welcome.captionId || enhancedContent.welcome.captionFile
          if (welcomeAudioId) {
            (enhancedContent.welcome as any).audioBlob = mediaFilesRef.current.get(`${welcomeAudioId}.mp3`)
          }
          if (welcomeCaptionId) {
            (enhancedContent.welcome as any).captionBlob = mediaFilesRef.current.get(`${welcomeCaptionId}.vtt`)
          }
        }
        
        if (enhancedContent.objectivesPage) {
          const objectivesAudioId = enhancedContent.objectivesPage.audioId || enhancedContent.objectivesPage.audioFile
          const objectivesCaptionId = enhancedContent.objectivesPage.captionId || enhancedContent.objectivesPage.captionFile
          if (objectivesAudioId) {
            (enhancedContent.objectivesPage as any).audioBlob = mediaFilesRef.current.get(`${objectivesAudioId}.mp3`)
          }
          if (objectivesCaptionId) {
            (enhancedContent.objectivesPage as any).captionBlob = mediaFilesRef.current.get(`${objectivesCaptionId}.vtt`)
          }
        }
        
        if (enhancedContent.topics) {
          enhancedContent.topics.forEach((topic, index) => {
            const topicAudioId = topic.audioId || topic.audioFile
            const topicCaptionId = topic.captionId || topic.captionFile
            if (topicAudioId) {
              (topic as any).audioBlob = mediaFilesRef.current.get(`${topicAudioId}.mp3`)
            }
            if (topicCaptionId) {
              (topic as any).captionBlob = mediaFilesRef.current.get(`${topicCaptionId}.vtt`)
            }
            // Handle other media in topics
            if (topic.media) {
              topic.media.forEach(mediaItem => {
                if (mediaItem.id) {
                  const extension = mediaItem.type === 'image' ? '.jpg' : mediaItem.type === 'video' ? '.mp4' : '.bin'
                  const blob = mediaFilesRef.current.get(`${mediaItem.id}${extension}`)
                  if (blob) {
                    (mediaItem as any).blob = blob
                  }
                }
              })
            }
          })
        }
      } catch (mediaError) {
        debugLogger.error('SCORM_PACKAGE', 'Media loading failed during SCORM generation', {
          projectId: storage.currentProjectId,
          error: mediaError instanceof Error ? mediaError.message : String(mediaError),
          stack: mediaError instanceof Error ? mediaError.stack : undefined,
          mediaFilesLoaded: mediaFilesRef.current.size
        })
        
        console.error('[SCORMPackageBuilder] Error loading media:', mediaError)
        const warningMsg = 'Some media files could not be loaded. The SCORM package will be generated without them.'
        setMessages(prev => [...prev, {
          id: `warning-media-${Date.now()}`,
          type: 'warning',
          text: warningMsg
        }])
        info(warningMsg)
      }
      performanceMetrics.mediaLoadDuration = Date.now() - (typeof performanceMetrics.mediaLoadStart === 'number' ? performanceMetrics.mediaLoadStart : Date.now())
      
      setIsLoadingMedia(false)
      
      // FIX: Calculate accurate media count from enhanced content
      // Calculate media count based on what will actually be included in SCORM package
      // This includes both explicit content references AND auto-populated media from storage
      const calculateTotalMediaCount = (): { total: number, binaryFiles: number, embeddedUrls: number } => {
        let contentReferenced = 0
        let binaryFiles = 0
        let embeddedUrls = 0
        
        // Count welcome page media
        if (enhancedContent.welcome) {
          if (enhancedContent.welcome.audioFile || enhancedContent.welcome.audioId || enhancedContent.welcome.audioBlob) contentReferenced++
          if (enhancedContent.welcome.captionFile || enhancedContent.welcome.captionId || enhancedContent.welcome.captionBlob) contentReferenced++
          if (enhancedContent.welcome.media) contentReferenced += enhancedContent.welcome.media.length
        }
        
        // Count objectives page media
        if (enhancedContent.objectivesPage) {
          if (enhancedContent.objectivesPage.audioFile || enhancedContent.objectivesPage.audioId || enhancedContent.objectivesPage.audioBlob) contentReferenced++
          if (enhancedContent.objectivesPage.captionFile || enhancedContent.objectivesPage.captionId || enhancedContent.objectivesPage.captionBlob) contentReferenced++
          if (enhancedContent.objectivesPage.media) contentReferenced += enhancedContent.objectivesPage.media.length
        }
        
        // Count topic media
        if (enhancedContent.topics) {
          enhancedContent.topics.forEach(topic => {
            if (topic.audioFile || topic.audioId || topic.audioBlob) contentReferenced++
            if (topic.captionFile || topic.captionId || topic.captionBlob) contentReferenced++
            if (topic.media) contentReferenced += topic.media.length
          })
        }
        
        // Get all media from storage (this matches what loadMediaFromRegistry will process)
        const allStorageMedia = getAllMedia()
        
        allStorageMedia.forEach(mediaItem => {
          if (mediaItem.metadata?.youtubeUrl || mediaItem.metadata?.mimeType === 'application/json') {
            embeddedUrls++
          } else {
            binaryFiles++
          }
        })
        
        return {
          total: Math.max(contentReferenced, allStorageMedia.length),
          binaryFiles,
          embeddedUrls
        }
      }
      
      const mediaCountInfo = calculateTotalMediaCount()
      const mediaCount = mediaCountInfo.total
      
      // Check for cancellation before Rust generation
      if (generationAbortController.current?.signal.aborted) {
        throw new Error('Generation cancelled by user')
      }
      
      const estimatedSeconds = Math.round(60 + (mediaCount * 2)) // Reduced base time and per-file time
      setGenerationProgress(45)
      debugLogger.info('SCORM_PACKAGE', 'Starting Rust SCORM generation phase', {
        projectId: storage.currentProjectId,
        mediaCount,
        loadedMediaFiles: mediaFilesRef.current.size,
        estimatedTimeSeconds: Math.round(60 + (mediaCount * 2))
      })
      
      // Create descriptive message that shows both binary files and embedded URLs
      const mediaDescription = mediaCountInfo.binaryFiles > 0 && mediaCountInfo.embeddedUrls > 0 
        ? `${mediaCountInfo.binaryFiles} binary files + ${mediaCountInfo.embeddedUrls} embedded videos`
        : mediaCountInfo.binaryFiles > 0 
          ? `${mediaCountInfo.binaryFiles} binary files`
          : mediaCountInfo.embeddedUrls > 0
            ? `${mediaCountInfo.embeddedUrls} embedded videos`
            : 'no media files'
      
      setLoadingMessage(`Generating SCORM package (${mediaDescription}, ${mediaFilesRef.current.size} loaded)...`)
      await yieldToUI()
      
      console.log('[SCORMPackageBuilder] === STARTING RUST GENERATION PHASE ===')
      console.log(`[SCORMPackageBuilder] Media count: ${mediaCount} (${mediaCountInfo.binaryFiles} binary + ${mediaCountInfo.embeddedUrls} embedded), Loaded files: ${mediaFilesRef.current.size}`)
      
      // Generate using Rust
      performanceMetrics.rustGenerationStart = Date.now()
      
      // Create timeout promise - dynamic timeout based on media count
      const baseTimeout = 180000 // 3 minutes base
      const timeoutPerMedia = 8000 // 8 seconds per media file
      const SCORM_GENERATION_TIMEOUT = Math.max(baseTimeout, baseTimeout + (mediaCount * timeoutPerMedia))
      
      console.log(`[SCORMPackageBuilder] Calculated timeout: ${SCORM_GENERATION_TIMEOUT / 1000} seconds for ${mediaCount} media files`)
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`SCORM generation timeout after ${SCORM_GENERATION_TIMEOUT / 1000} seconds with ${mediaCount} media files. Large media sets require more processing time.`))
        }, SCORM_GENERATION_TIMEOUT)
        
        // Clear timeout if generation completes normally
        if (generationAbortController.current?.signal) {
          generationAbortController.current.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId)
          })
        }
      })
      
      // Retrieve course settings from storage
      let courseSettings: CourseSettings | null = null
      try {
        courseSettings = await storage.getContent('courseSettings') as CourseSettings
        console.log('[SCORMPackageBuilder] Loaded course settings:', courseSettings)
      } catch (error) {
        console.log('[SCORMPackageBuilder] No course settings found, using defaults')
      }

      // CRITICAL FIX: Apply defaults when settings loading fails
      // This prevents the missing sidebar issue when courseSettings is null
      const finalCourseSettings: CourseSettings = courseSettings || DEFAULT_COURSE_SETTINGS
      console.log('[SCORMPackageBuilder] Final course settings applied:', finalCourseSettings)

      const result = await measureAsync(
        'scorm-generation',
        async () => {
          try {
            // Race between generation and timeout
            return await Promise.race([
              generateRustSCORM(
                enhancedContent,
                storage.currentProjectId || 'default-project',
                (message, progress) => {
                  setLoadingMessage(message)
                  // Map Rust progress (0-100) to our progress range (45-95)
                  const mappedProgress = 45 + (progress * 0.5)
                  setGenerationProgress(mappedProgress)
                  console.log('[SCORMPackageBuilder] Progress:', progress, message)
                },
                mediaFilesRef.current, // Pass the pre-loaded media files
                finalCourseSettings // Pass course settings with defaults applied
              ),
              timeoutPromise
            ])
          } catch (rustError: unknown) {
            console.error('[SCORMPackageBuilder] Rust generation failed:', rustError)
            throw rustError
          }
        }
      )
      performanceMetrics.rustGenerationDuration = Date.now() - (typeof performanceMetrics.rustGenerationStart === 'number' ? performanceMetrics.rustGenerationStart : Date.now())
      console.log('[SCORMPackageBuilder] === RUST GENERATION PHASE COMPLETE ===')
      
      if (!result) {
        throw new Error('Failed to generate SCORM package - no data returned')
      }
      
      setGenerationProgress(95)
      setLoadingMessage('Finalizing SCORM package...')
      await yieldToUI()
      
      performanceMetrics.totalDuration = Date.now() - startTime
      setPerformanceData(performanceMetrics)
      console.log('[SCORMPackageBuilder] Performance metrics:', performanceMetrics)
      
      const newPackage: GeneratedPackage = {
        data: result instanceof Uint8Array ? result.buffer as ArrayBuffer : result,
        metadata: metadata as CourseMetadata
      }
      
      setGeneratedPackage(newPackage)
      setGenerationProgress(100)
      setLoadingMessage('SCORM package generated successfully!')
      await yieldToUI()
      
      // Clear the elapsed time interval
      clearElapsedTimer()
      
      // FIX: Don't auto-download. Let user choose when to download
      console.log('[SCORMPackageBuilder] Package generated successfully, ready for download')
      
      // Check if there were any failed media before showing success
      if (failedMedia.length === 0) {
        success('SCORM package generated successfully!')
      } else {
        warning(`Package generated with ${failedMedia.length} missing media files`)
        console.warn('[SCORMPackageBuilder] Package generated with missing media:', failedMedia)
      }
    } catch (error) {
      // Log critical SCORM package generation error to ultraSimpleLogger
      debugLogger.error('SCORM_PACKAGE', 'SCORM package generation failed in UI', {
        courseTitle: courseContent.welcomePage?.title || courseSeedData?.courseTitle || 'Untitled Course',
        topicCount: courseContent.topics?.length || 0,
        hasMediaItems: !!(
          courseContent.topics?.some((topic: Topic) => topic.media && topic.media.length > 0) ||
          courseContent.welcomePage?.media?.length ||
          courseContent.learningObjectivesPage?.media?.length
        ),
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
      
      console.error('Error generating SCORM package:', error)
      
      // Handle timeout errors specifically
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isTimeout = errorMessage.includes('timeout')
      
      let userMessage = errorMessage
      if (isTimeout) {
        userMessage = `SCORM generation timed out after 2 minutes. This may be due to:\n• Large course content or media files\n• System performance issues\n• Complex course structure\n\nTry reducing content size or check system resources.`
        setLoadingMessage('Generation timed out - please try again')
      } else if (errorMessage.includes('cancelled')) {
        userMessage = 'SCORM generation was cancelled by user'
        setLoadingMessage('Generation cancelled')
      } else {
        userMessage = `Error generating SCORM package: ${errorMessage}`
        setLoadingMessage('Generation failed')
      }
      
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'error',
        text: userMessage
      }])
      notifyError(isTimeout ? 'SCORM generation timed out' : userMessage)
    } finally {
      setIsGenerating(false)
      setIsLoadingMedia(false)
      setIsCancellable(false)
      setGenerationStartTime(null)
      setElapsedTime(0)
      // Clear interval if it exists
      if (typeof clearElapsedTimer !== 'undefined') {
        clearElapsedTimer()
      }
      // Clear abort controller
      generationAbortController.current = null
      // Don't clear media files immediately - keep for display
      // mediaFilesRef.current.clear()
    }
  }

  const cancelGeneration = () => {
    if (generationAbortController.current) {
      generationAbortController.current.abort()
      setIsGenerationCancelled(true)
      setLoadingMessage('Cancelling generation...')
      console.log('[SCORMPackageBuilder] Generation cancelled by user')
    }
  }

  const downloadPackage = async (packageToDownload?: GeneratedPackage | null) => {
    console.log('[SCORMPackageBuilder] downloadPackage called')
    const pkg = packageToDownload || generatedPackage
    if (!pkg) {
      console.log('[SCORMPackageBuilder] No generated package available')
      return
    }
    
    console.log('[SCORMPackageBuilder] Starting download process...')
    console.log('[SCORMPackageBuilder] Package size:', pkg.data.byteLength, 'bytes')
    setIsDownloading(true)
    
    try {
      // First, try the dialog API directly
      console.log('[SCORMPackageBuilder] Attempting to open save dialog...')
      console.log('[SCORMPackageBuilder] Dialog save function available:', typeof save)
      
      let filePath = null
      
      try {
        // FIX: Sanitize filename to avoid Windows reserved characters
        const sanitizedFileName = sanitizeScormFileName(
          (typeof pkg.metadata.title === 'string' ? pkg.metadata.title : undefined) || 
          courseSeedData?.courseTitle
        )
        console.log('[SCORMPackageBuilder] Calling save dialog with sanitized filename:', sanitizedFileName)
        filePath = await save({
          defaultPath: sanitizedFileName,
          filters: [{
            name: 'SCORM Package',
            extensions: ['zip']
          }]
        })
        console.log('[SCORMPackageBuilder] Dialog returned:', filePath)
      } catch (dialogError) {
        console.error('[SCORMPackageBuilder] Dialog error:', dialogError)
        console.error('[SCORMPackageBuilder] Dialog error type:', typeof dialogError)
        console.error('[SCORMPackageBuilder] Dialog error stringify:', JSON.stringify(dialogError, null, 2))
        
        // If dialog fails, try using invoke to get projects directory
        console.log('[SCORMPackageBuilder] Attempting alternative save method...')
        try {
          // FIX: Use sanitized filename for fallback too
          const fileName = sanitizeScormFileName(
            (typeof pkg.metadata.title === 'string' ? pkg.metadata.title : undefined) || 
            courseSeedData?.courseTitle
          )
          const projectDir = await invoke<string>('get_projects_dir')
          filePath = `${projectDir}/${fileName}`
          console.log('[SCORMPackageBuilder] Using fallback path:', filePath)
        } catch (fallbackError) {
          console.error('[SCORMPackageBuilder] Fallback error:', fallbackError)
          throw dialogError // Re-throw original error
        }
      }
      
      if (filePath) {
        console.log('[SCORMPackageBuilder] Writing file to:', filePath)
        console.log('[SCORMPackageBuilder] Data type:', typeof pkg.data)
        console.log('[SCORMPackageBuilder] Data constructor:', pkg.data.constructor.name)
        
        // Convert ArrayBuffer to Uint8Array if needed
        const data = pkg.data instanceof Uint8Array 
          ? pkg.data 
          : new Uint8Array(pkg.data)
        
        console.log('[SCORMPackageBuilder] Writing', data.length, 'bytes to file...')
        await writeFile(filePath, data)
        
        console.log('[SCORMPackageBuilder] File written successfully')
        success(`SCORM package saved to: ${filePath}`)
        // Don't add success message - let the user see the file save location from their OS
        // setMessages(prev => [...prev, {
        //   id: `download-success-${Date.now()}`,
        //   type: 'success',
        //   text: `SCORM package saved to: ${filePath}`
        // }])
      } else {
        console.log('[SCORMPackageBuilder] User cancelled save dialog or no path returned')
      }
    } catch (error: unknown) {
      // Log file saving error to ultraSimpleLogger
      debugLogger.error('SCORM_SAVE', 'Failed to save SCORM package to file system', {
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : undefined,
        errorStack: error instanceof Error ? error.stack : undefined,
        typeof: typeof error,
        constructor: error && typeof error === 'object' && 'constructor' in error ? (error.constructor as any)?.name : undefined,
        timestamp: new Date().toISOString()
      })
      
      console.error('[SCORMPackageBuilder] Error saving SCORM package:', error)
      console.error('[SCORMPackageBuilder] Error details:', {
        name: error instanceof Error ? error.name : undefined,
        message: error instanceof Error ? error.message : undefined,
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        constructor: error && typeof error === 'object' && 'constructor' in error ? (error.constructor as any)?.name : undefined
      })

      // Provide more specific error messages for common failure scenarios
      let errorMsg = 'Error saving SCORM package: Unknown error'
      if (error instanceof Error) {
        if (error.message.includes('Permission denied') || error.message.includes('EACCES') || error.name === 'PermissionError') {
          errorMsg = 'Permission denied: Cannot write to the selected location. Please choose a different folder or run as administrator.'
        } else if (error.message.includes('ENOSPC') || error.message.includes('No space left')) {
          errorMsg = 'Insufficient disk space: Please free up space on your disk and try again.'
        } else if (error.message.includes('ENOENT') || error.message.includes('no such file or directory')) {
          errorMsg = 'Invalid path: The selected folder does not exist. Please choose a valid location.'
        } else if (error.message.includes('EROFS') || error.message.includes('read-only')) {
          errorMsg = 'Cannot write to read-only location: Please choose a writable folder.'
        } else {
          errorMsg = `Error saving SCORM package: ${error.message}`
        }
      }

      setMessages(prev => [...prev, {
        id: `download-error-${Date.now()}`,
        type: 'error',
        text: errorMsg
      }])
      notifyError(errorMsg)
    } finally {
      console.log('[SCORMPackageBuilder] Download process complete')
      setIsDownloading(false)
    }
  }

  const removeMessage = (id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id))
  }

  const getMessageIcon = (type: Message['type']) => {
    switch (type) {
      case 'error':
        return <Icon icon={AlertCircle} className="w-5 h-5" />
      case 'warning':
        return <Icon icon={AlertCircle} className="w-5 h-5" />
      case 'success':
        return <Icon icon={CheckCircle} className="w-5 h-5" />
      default:
        return <Icon icon={AlertCircle} className="w-5 h-5" />
    }
  }

  const getMessageStyle = (type: Message['type']) => {
    const baseStyle = "mb-2 p-3 rounded-md border flex items-start justify-between"
    switch (type) {
      case 'error':
        return `${baseStyle} bg-red-50 border-red-200 text-red-800`
      case 'warning':
        return `${baseStyle} bg-yellow-50 border-yellow-200 text-yellow-800`
      case 'success':
        return `${baseStyle} bg-green-50 border-green-200 text-green-800`
      default:
        return `${baseStyle} bg-blue-50 border-blue-200 text-blue-800`
    }
  }

  return (
    <PageLayout
      currentStep={7}
      title="Generate SCORM Package"
      description="Export your course as a SCORM-compliant package"
      onBack={onBack}
      onSettingsClick={onSettingsClick}
      onSave={onSave}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
    >
      <div className="max-w-3xl mx-auto">
        {/* Main Action Area */}
        {!isGenerating && !generatedPackage && (
          <Card className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                <Icon icon={Package} className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {courseSeedData?.courseTitle || 'Untitled Course'}
              </h2>
              <p className="text-gray-600 mb-6">
                Ready to generate your SCORM 1.2 compliant package
              </p>
              
              {/* Course Stats */}
              <div className="grid grid-cols-3 gap-4 mb-8 max-w-md mx-auto">
                <div className="bg-white rounded-lg p-4 border border-blue-100">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">{courseContent.topics?.length || 0}</div>
                    <div className="text-xs text-gray-600">Course Topics</div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-blue-100">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">{courseContent.assessment?.questions?.length || 0}</div>
                    <div className="text-xs text-gray-600">Assessment Questions</div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-blue-100">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">{courseContent.topics?.length || 0}</div>
                    <div className="text-xs text-gray-600">Knowledge Checks</div>
                  </div>
                </div>
              </div>
              
              <Button
                onClick={generatePackage}
                variant="primary"
                size="large"
                className="min-w-[250px]"
                data-testid="generate-scorm-button"
              >
                <Icon icon={Package} />
                Generate SCORM Package
              </Button>
            </div>
          </Card>
        )}

        {/* Messages - Only show for errors when not in success state */}
        {messages.length > 0 && !generatedPackage && (
          <div className="mb-6">
            {messages.filter(msg => msg.type === 'error' || msg.type === 'warning').map(message => (
              <div key={message.id} className={getMessageStyle(message.type)}>
                <div className="flex items-start gap-3 flex-1">
                  {getMessageIcon(message.type)}
                  <p className="text-sm">{message.text}</p>
                </div>
                <button
                  onClick={() => removeMessage(message.id)}
                  className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Icon icon={X} className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Loading State */}
        {isGenerating && (
          <Card className="mb-6 border-blue-200">
            <div className="p-8">
              <div className="text-center">
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Generating SCORM Package
                </h3>
                <p className="text-gray-600 mb-4">{loadingMessage}</p>
                
                {/* Linear Progress Bar */}
                <div className="max-w-md mx-auto mb-4">
                  <ProgressBar
                    value={generationProgress}
                    max={100}
                    label="SCORM package generation"
                    showPercentage={true}
                    showTimeRemaining={true}
                    startTime={generationStartTime || undefined}
                    size="medium"
                    variant="primary"
                    className="mb-2"
                  />
                </div>
                
                {/* Time and Control Section */}
                <div className="flex items-center justify-center gap-4 mb-4">
                  {generationStartTime && (
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-sm text-blue-700">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      {elapsedTime.toFixed(1)}s elapsed
                    </div>
                  )}
                  
                  {isCancellable && !isGenerationCancelled && (
                    <div className="flex items-center gap-3">
                      {/* Timeout warning when approaching limit */}
                      {elapsedTime > 90 && (
                        <div className="flex items-center gap-1 text-orange-600 text-sm">
                          <Icon icon={AlertCircle} size="xs" />
                          <span>Timing out in {Math.max(0, 120 - elapsedTime).toFixed(0)}s</span>
                        </div>
                      )}
                      
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={cancelGeneration}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        aria-label="Cancel SCORM package generation"
                        title="Cancel SCORM package generation"
                      >
                        <Icon icon={X} size="xs" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
                
                {/* Media Loading Details */}
                {isLoadingMedia && loadingDetails.totalFiles > 0 && (
                  <div className="mt-4 max-w-md mx-auto p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Loading media files</span>
                      <span className="font-medium">{loadingDetails.filesLoaded}/{loadingDetails.totalFiles}</span>
                    </div>
                    {loadingDetails.currentFile && (
                      <p className="text-xs text-gray-500 truncate">
                        Current: {loadingDetails.currentFile}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Success State */}
        {generatedPackage && !isGenerating && (
          <Card className="mb-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <div className="p-8">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <Icon icon={CheckCircle} className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Package Ready!
                </h3>
                <p className="text-gray-600 mb-6">
                  Your SCORM package has been generated successfully
                </p>
                
                {/* Compact Stats */}
                <div className="inline-flex items-center gap-8 px-8 py-4 bg-white rounded-lg border border-green-100 mb-6">
                  <div className="flex flex-col items-center">
                    <div className="text-2xl font-bold text-green-600">
                      {(generatedPackage.data.byteLength / 1024 / 1024).toFixed(1)}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">MB</div>
                  </div>
                  <div className="w-px h-12 bg-gray-200" />
                  {performanceData && (
                    <>
                      <div className="flex flex-col items-center">
                        <div className="text-2xl font-bold text-green-600">
                          {((performanceData.totalDuration || 0) / 1000).toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Seconds</div>
                      </div>
                      <div className="w-px h-12 bg-gray-200" />
                    </>
                  )}
                  <div className="flex flex-col items-center">
                    <div className="text-2xl font-bold text-green-600">
                      {(() => {
                        // Calculate total media count including both binary files and embedded URLs
                        const allMedia = getAllMedia()
                        const binaryFileCount = mediaFilesRef.current.size
                        const totalMediaCount = allMedia.length
                        const embeddedUrlCount = totalMediaCount - binaryFileCount
                        
                        // Log media count breakdown for debugging
                        debugLogger.info('SCORM_PACKAGE', 'Completion screen media count display', {
                          totalMediaCount,
                          binaryFileCount,
                          embeddedUrlCount,
                          allMediaIds: allMedia.map(m => m.id),
                          projectId: storage.currentProjectId
                        })
                        
                        return totalMediaCount
                      })()}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">
                      {(() => {
                        const allMedia = getAllMedia()
                        const totalCount = allMedia.length
                        return totalCount === 1 ? 'Media File' : 'Media Files'
                      })()}
                    </div>
                  </div>
                </div>
                
                <Button
                  onClick={() => downloadPackage()}
                  disabled={isDownloading}
                  variant="primary"
                  size="large"
                  className="min-w-[250px]"
                >
                  {isDownloading ? (
                    <>
                      <Icon icon={Loader2} className="w-5 h-5 animate-spin" />
                      Saving Package...
                    </>
                  ) : (
                    <>
                      <Icon icon={Download} className="w-5 h-5" />
                      Download SCORM Package
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Additional Info */}
        {!isGenerating && !generatedPackage && (
          <div className="text-center text-sm text-gray-500">
            <p>The package will include all course content, media files, and assessments</p>
            <p>Compatible with any SCORM 1.2 compliant Learning Management System</p>
          </div>
        )}
      </div>
    </PageLayout>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const SCORMPackageBuilder = React.memo(SCORMPackageBuilderComponent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.courseContent === nextProps.courseContent &&
    prevProps.courseSeedData === nextProps.courseSeedData &&
    prevProps.onNext === nextProps.onNext &&
    prevProps.onBack === nextProps.onBack &&
    prevProps.onSettingsClick === nextProps.onSettingsClick &&
    prevProps.onSave === nextProps.onSave &&
    prevProps.onOpen === nextProps.onOpen &&
    prevProps.onHelp === nextProps.onHelp &&
    prevProps.onStepClick === nextProps.onStepClick
  )
})

export default SCORMPackageBuilder