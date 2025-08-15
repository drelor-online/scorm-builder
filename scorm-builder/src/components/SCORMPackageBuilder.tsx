import React, { useState, useEffect } from 'react'
import { CourseContent, Media } from '../types/aiPrompt'
import type { EnhancedCourseContent } from '../types/scorm'
import type { CourseMetadata } from '../types/metadata'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import { convertToEnhancedCourseContent } from '../services/courseContentConverter'
import { generateRustSCORM } from '../services/rustScormGenerator'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
import { useNotifications } from '../contexts/NotificationContext'
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor'
import { sanitizeScormFileName } from '../utils/fileSanitizer'

import { PageLayout } from './PageLayout'
import { 
  Card, 
  Button, 
  LoadingSpinner,
  Icon
} from './DesignSystem'
import { Package, Download, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react'
import './DesignSystem/designSystem.css'
import type { CourseSeedData } from '../types/course'

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
  const storage = useStorage()
  const { 
    getMedia,
    getAllMedia,
    getMediaForPage,
    createBlobUrl,
    storeMedia
  } = useUnifiedMedia()
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
      mediaFilesRef.current.clear()
    }
  }, [])

  // Helper function to get media blob from UnifiedMedia with timeout
  const getMediaBlobFromRegistry = async (mediaId: string): Promise<Blob | null> => {
    console.log('[SCORMPackageBuilder] Loading media:', mediaId)
    
    try {
      // Add timeout to prevent hanging
      let timeoutId: NodeJS.Timeout | null = null
      const timeoutPromise = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => {
          console.warn(`[SCORMPackageBuilder] Timeout loading media: ${mediaId}`)
          resolve(null)
        }, 5000) // 5 second timeout per media file
      })
      
      const mediaDataPromise = getMedia(mediaId)
      const mediaData = await Promise.race([mediaDataPromise, timeoutPromise])
      
      // Clear the timeout if we got data successfully
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      
      if (!mediaData) {
        console.warn(`[SCORMPackageBuilder] Media not found or timed out: ${mediaId}`)
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
            // Add timeout to blob fetch
            const controller = new AbortController()
            const fetchTimeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
            
            const response = await fetch(mediaData.url, { signal: controller.signal })
            clearTimeout(fetchTimeoutId)
            
            const blob = await response.blob()
            console.log('[SCORMPackageBuilder] Successfully fetched blob:', {
              mediaId,
              size: blob.size,
              type: blob.type
            })
            return blob
          } catch (fetchError: unknown) {
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
              console.warn(`[SCORMPackageBuilder] Blob fetch timed out for: ${mediaId}`)
            } else {
              console.error('[SCORMPackageBuilder] Failed to fetch blob URL:', fetchError)
            }
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

  const loadMediaFromRegistry = async (enhancedContent: EnhancedCourseContent): Promise<string[]> => {
    console.log('[SCORMPackageBuilder] Starting media loading from UnifiedMedia')
    
    // Helper function to create unique tracking key for media (prevents overwrites of same ID with different types)
    const createMediaTrackingKey = (id: string, type?: string): string => {
      return type ? `${id}:${type}` : id
    }
    
    // Track loaded media to prevent duplicates (using ID:type to allow same ID with different types)
    const loadedMediaIds = new Set<string>()
    const failedMedia: string[] = []
    let loadedCount = 0
    let totalMediaToLoad = 0
    
    // Get all media items
    const allMediaItems = getAllMedia()
    console.log('[SCORMPackageBuilder] Found', allMediaItems.length, 'media items in storage')
    
    // Helper function to handle remote media - only downloads if not already stored
    const handleRemoteMedia = async (url: string, mediaType: 'image' | 'video', pageId: string): Promise<string | null> => {
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
    
    // Load media for each page
    // Use correct property name 'welcome' instead of 'welcomePage'
    if (enhancedContent.welcome) {
      // Handle audioBlob without ID FIRST (recorded audio that hasn't been saved to registry)
      if (enhancedContent.welcome.audioBlob && !enhancedContent.welcome.audioId && !enhancedContent.welcome.audioFile) {
        const generatedId = `audio-welcome-blob-${Date.now()}`
        console.log(`[SCORMPackageBuilder] Processing welcome audioBlob without ID, generating: ${generatedId}`)
        mediaFilesRef.current.set(`${generatedId}.mp3`, enhancedContent.welcome.audioBlob)
        // Mark this ID as already loaded to avoid trying to fetch it from registry
        loadedMediaIds.add(generatedId)
        // Update the content to include the generated ID so Rust generator can find it
        enhancedContent.welcome.audioId = generatedId
        loadedCount++
        console.log(`[SCORMPackageBuilder] ✓ Added welcome audioBlob: ${generatedId}`)
      }
      
      // Welcome page media - look for audioFile/captionFile which contain the media IDs
      const welcomeAudioId = enhancedContent.welcome.audioId || enhancedContent.welcome.audioFile
      const welcomeCaptionId = enhancedContent.welcome.captionId || enhancedContent.welcome.captionFile
      const welcomeMedia = enhancedContent.welcome.media || []
      
      if (welcomeAudioId && !loadedMediaIds.has(welcomeAudioId)) {
        loadedMediaIds.add(welcomeAudioId)
        totalMediaToLoad++
        console.log(`[SCORMPackageBuilder] Loading welcome audio (${loadedCount + 1}/${totalMediaToLoad}): ${welcomeAudioId}`)
        const audioBlob = await getMediaBlobFromRegistry(welcomeAudioId)
        if (audioBlob) {
          mediaFilesRef.current.set(`${welcomeAudioId}.mp3`, audioBlob)
          loadedCount++
          console.log(`[SCORMPackageBuilder] ✓ Loaded welcome audio: ${welcomeAudioId}`)
        } else {
          failedMedia.push(`welcome audio: ${welcomeAudioId}`)
          console.warn(`[SCORMPackageBuilder] ✗ Failed to load welcome audio: ${welcomeAudioId}`)
        }
      }
      
      if (welcomeCaptionId && !loadedMediaIds.has(welcomeCaptionId)) {
        loadedMediaIds.add(welcomeCaptionId)
        totalMediaToLoad++
        console.log(`[SCORMPackageBuilder] Loading welcome caption (${loadedCount + 1}/${totalMediaToLoad}): ${welcomeCaptionId}`)
        const captionBlob = await getMediaBlobFromRegistry(welcomeCaptionId)
        if (captionBlob) {
          mediaFilesRef.current.set(`${welcomeCaptionId}.vtt`, captionBlob)
          loadedCount++
          console.log(`[SCORMPackageBuilder] ✓ Loaded welcome caption: ${welcomeCaptionId}`)
        } else {
          failedMedia.push(`welcome caption: ${welcomeCaptionId}`)
          console.warn(`[SCORMPackageBuilder] ✗ Failed to load welcome caption: ${welcomeCaptionId}`)
        }
      }
      
      for (const mediaItem of welcomeMedia) {
        const trackingKey = createMediaTrackingKey(mediaItem.id, mediaItem.type)
        if (mediaItem.id && !loadedMediaIds.has(trackingKey)) {
          loadedMediaIds.add(trackingKey)
          totalMediaToLoad++
          console.log(`[SCORMPackageBuilder] Loading welcome media (${loadedCount + 1}/${totalMediaToLoad}): ${mediaItem.id} (${mediaItem.type})`)
          const mediaBlob = await getMediaBlobFromRegistry(mediaItem.id)
          if (mediaBlob) {
            const extension = mediaItem.type === 'image' ? '.jpg' : mediaItem.type === 'video' ? '.mp4' : mediaItem.type === 'audio' ? '.mp3' : '.bin'
            // Generate unique filename by including type to prevent overwrites
            const uniqueFilename = `${mediaItem.id}-${mediaItem.type}${extension}`
            mediaFilesRef.current.set(uniqueFilename, mediaBlob)
            loadedCount++
            console.log(`[SCORMPackageBuilder] ✓ Loaded welcome media: ${mediaItem.id} as ${uniqueFilename}`)
          } else {
            failedMedia.push(`welcome ${mediaItem.type || 'media'}: ${mediaItem.id}`)
            console.warn(`[SCORMPackageBuilder] ✗ Failed to load welcome media: ${mediaItem.id}`)
          }
        } else if (mediaItem.id && loadedMediaIds.has(trackingKey)) {
          console.log(`[SCORMPackageBuilder] Skipping duplicate welcome media: ${mediaItem.id} (${mediaItem.type})`)
        } else if (mediaItem.url && mediaItem.url.startsWith('http')) {
          // Handle remote media
          const newId = await handleRemoteMedia(mediaItem.url, 'image', 'welcome')
          if (newId) {
            mediaItem.id = newId // Update the media reference with the new ID
            const mediaBlob = await getMediaBlobFromRegistry(newId)
            if (mediaBlob) {
              mediaFilesRef.current.set(`remote-${Date.now()}.jpg`, mediaBlob)
              console.log('[SCORMPackageBuilder] Loaded remote media with new ID:', newId)
            }
          }
        }
      }
    }
    
    // Use correct property name 'objectivesPage'
    if (enhancedContent.objectivesPage) {
      // Objectives page media - look for audioFile/captionFile which contain the media IDs
      const objectivesAudioId = enhancedContent.objectivesPage.audioId || enhancedContent.objectivesPage.audioFile
      const objectivesCaptionId = enhancedContent.objectivesPage.captionId || enhancedContent.objectivesPage.captionFile
      const objectivesMedia = enhancedContent.objectivesPage.media || []
      
      if (objectivesAudioId && !loadedMediaIds.has(objectivesAudioId)) {
        loadedMediaIds.add(objectivesAudioId)
        totalMediaToLoad++
        console.log(`[SCORMPackageBuilder] Loading objectives audio (${loadedCount + 1}/${totalMediaToLoad}): ${objectivesAudioId}`)
        const audioBlob = await getMediaBlobFromRegistry(objectivesAudioId)
        if (audioBlob) {
          mediaFilesRef.current.set(`${objectivesAudioId}.mp3`, audioBlob)
          loadedCount++
          console.log(`[SCORMPackageBuilder] ✓ Loaded objectives audio: ${objectivesAudioId}`)
        } else {
          failedMedia.push(`objectives audio: ${objectivesAudioId}`)
          console.warn(`[SCORMPackageBuilder] ✗ Failed to load objectives audio: ${objectivesAudioId}`)
        }
      }
      
      if (objectivesCaptionId && !loadedMediaIds.has(objectivesCaptionId)) {
        loadedMediaIds.add(objectivesCaptionId)
        totalMediaToLoad++
        console.log(`[SCORMPackageBuilder] Loading objectives caption (${loadedCount + 1}/${totalMediaToLoad}): ${objectivesCaptionId}`)
        const captionBlob = await getMediaBlobFromRegistry(objectivesCaptionId)
        if (captionBlob) {
          mediaFilesRef.current.set(`${objectivesCaptionId}.vtt`, captionBlob)
          loadedCount++
          console.log(`[SCORMPackageBuilder] ✓ Loaded objectives caption: ${objectivesCaptionId}`)
        } else {
          failedMedia.push(`objectives caption: ${objectivesCaptionId}`)
          console.warn(`[SCORMPackageBuilder] ✗ Failed to load objectives caption: ${objectivesCaptionId}`)
        }
      }
      
      for (const mediaItem of objectivesMedia) {
        const trackingKey = createMediaTrackingKey(mediaItem.id, mediaItem.type)
        if (mediaItem.id && !loadedMediaIds.has(trackingKey)) {
          loadedMediaIds.add(trackingKey)
          const mediaBlob = await getMediaBlobFromRegistry(mediaItem.id)
          if (mediaBlob) {
            const extension = mediaItem.type === 'image' ? '.jpg' : mediaItem.type === 'video' ? '.mp4' : mediaItem.type === 'audio' ? '.mp3' : '.bin'
            // Generate unique filename by including type to prevent overwrites
            const uniqueFilename = `${mediaItem.id}-${mediaItem.type}${extension}`
            mediaFilesRef.current.set(uniqueFilename, mediaBlob)
            console.log(`[SCORMPackageBuilder] Loaded objectives media: ${mediaItem.id} as ${uniqueFilename}`)
          }
        } else if (mediaItem.id && loadedMediaIds.has(trackingKey)) {
          console.log(`[SCORMPackageBuilder] Skipping duplicate objectives media: ${mediaItem.id} (${mediaItem.type})`)
        } else if (mediaItem.url && mediaItem.url.startsWith('http')) {
          // Handle remote media
          const newId = await handleRemoteMedia(mediaItem.url, 'image', 'objectives')
          if (newId) {
            mediaItem.id = newId
            const mediaBlob = await getMediaBlobFromRegistry(newId)
            if (mediaBlob) {
              mediaFilesRef.current.set(`remote-${Date.now()}.jpg`, mediaBlob)
              console.log('[SCORMPackageBuilder] Loaded remote objectives media with new ID:', newId)
            }
          }
        }
      }
    }
    
    // Topics
    if (enhancedContent.topics) {
      for (let topicIndex = 0; topicIndex < enhancedContent.topics.length; topicIndex++) {
        const topic = enhancedContent.topics[topicIndex]
        
        // Handle audioBlob without ID FIRST for this topic (recorded audio that hasn't been saved to registry)
        if (topic.audioBlob && !topic.audioId && !topic.audioFile) {
          const generatedId = `audio-topic-${topicIndex}-blob-${Date.now()}`
          console.log(`[SCORMPackageBuilder] Processing topic ${topicIndex} audioBlob without ID, generating: ${generatedId}`)
          mediaFilesRef.current.set(`${generatedId}.mp3`, topic.audioBlob)
          // Mark this ID as already loaded to avoid trying to fetch it from registry
          loadedMediaIds.add(generatedId)
          // Update the content to include the generated ID so Rust generator can find it
          topic.audioId = generatedId
          loadedCount++
          console.log(`[SCORMPackageBuilder] ✓ Added topic ${topicIndex} audioBlob: ${generatedId}`)
        }
        
        const topicAudioId = topic.audioId || topic.audioFile
        const topicCaptionId = topic.captionId || topic.captionFile
        const topicMedia = topic.media || []
        
        if (topicAudioId && !loadedMediaIds.has(topicAudioId)) {
          loadedMediaIds.add(topicAudioId)
          totalMediaToLoad++
          console.log(`[SCORMPackageBuilder] Loading topic ${topicIndex} audio (${loadedCount + 1}/${totalMediaToLoad}): ${topicAudioId}`)
          const audioBlob = await getMediaBlobFromRegistry(topicAudioId)
          if (audioBlob) {
            mediaFilesRef.current.set(`${topicAudioId}.mp3`, audioBlob)
            loadedCount++
            console.log(`[SCORMPackageBuilder] ✓ Loaded topic ${topicIndex} audio: ${topicAudioId}`)
          } else {
            failedMedia.push(`topic ${topicIndex} audio: ${topicAudioId}`)
            console.warn(`[SCORMPackageBuilder] ✗ Failed to load topic ${topicIndex} audio: ${topicAudioId}`)
          }
        }
        
        if (topicCaptionId && !loadedMediaIds.has(topicCaptionId)) {
          loadedMediaIds.add(topicCaptionId)
          totalMediaToLoad++
          console.log(`[SCORMPackageBuilder] Loading topic ${topicIndex} caption (${loadedCount + 1}/${totalMediaToLoad}): ${topicCaptionId}`)
          const captionBlob = await getMediaBlobFromRegistry(topicCaptionId)
          if (captionBlob) {
            mediaFilesRef.current.set(`${topicCaptionId}.vtt`, captionBlob)
            loadedCount++
            console.log(`[SCORMPackageBuilder] ✓ Loaded topic ${topicIndex} caption: ${topicCaptionId}`)
          } else {
            failedMedia.push(`topic ${topicIndex} caption: ${topicCaptionId}`)
            console.warn(`[SCORMPackageBuilder] ✗ Failed to load topic ${topicIndex} caption: ${topicCaptionId}`)
          }
        }
        
        for (const mediaItem of topicMedia) {
          const trackingKey = createMediaTrackingKey(mediaItem.id, mediaItem.type)
          if (mediaItem.id && !loadedMediaIds.has(trackingKey)) {
            loadedMediaIds.add(trackingKey)
            const mediaBlob = await getMediaBlobFromRegistry(mediaItem.id)
            if (mediaBlob) {
              const extension = mediaItem.type === 'image' ? '.jpg' : mediaItem.type === 'video' ? '.mp4' : mediaItem.type === 'audio' ? '.mp3' : '.bin'
              // Generate unique filename by including type to prevent overwrites
              const uniqueFilename = `${mediaItem.id}-${mediaItem.type}${extension}`
              mediaFilesRef.current.set(uniqueFilename, mediaBlob)
              console.log(`[SCORMPackageBuilder] Loaded topic ${topicIndex} media: ${mediaItem.id} as ${uniqueFilename}`)
            }
          } else if (mediaItem.id && loadedMediaIds.has(trackingKey)) {
            console.log(`[SCORMPackageBuilder] Skipping duplicate topic ${topicIndex} media: ${mediaItem.id} (${mediaItem.type})`)
          } else if (mediaItem.url && mediaItem.url.startsWith('http')) {
            // Handle remote media
            const newId = await handleRemoteMedia(mediaItem.url, 'image', `topic-${topicIndex}`)
            if (newId) {
              mediaItem.id = newId
              const mediaBlob = await getMediaBlobFromRegistry(newId)
              if (mediaBlob) {
                mediaFilesRef.current.set(`remote-${Date.now()}.jpg`, mediaBlob)
                console.log('[SCORMPackageBuilder] Loaded remote topic media with new ID:', newId)
              }
            }
          }
        }
      }
    }
    
    console.log('[SCORMPackageBuilder] Media loading complete.')
    console.log(`[SCORMPackageBuilder] Successfully loaded: ${loadedCount} files`)
    console.log(`[SCORMPackageBuilder] Failed to load: ${failedMedia.length} files`)
    if (failedMedia.length > 0) {
      console.warn('[SCORMPackageBuilder] Failed media items:', failedMedia)
    }
    console.log('[SCORMPackageBuilder] Total files in package:', mediaFilesRef.current.size)
    
    return failedMedia
  }

  const generatePackage = async () => {
    // Clear previous messages and media files
    setMessages([])
    mediaFilesRef.current.clear()  // FIX: Use ref instead of global
    setGeneratedPackage(null)
    setIsGenerating(true)
    setIsLoadingMedia(true)
    setLoadingMessage('Preparing course content...')
    setGenerationStartTime(Date.now())
    
    // Start elapsed time counter
    const intervalId = setInterval(() => {
      setElapsedTime(prev => prev + 0.1)
    }, 100)
    
    // Store interval ID to clear later
    const clearElapsedTimer = () => clearInterval(intervalId)
    
    try {
      const startTime = Date.now()
      const performanceMetrics: PerformanceMetrics = {}
      
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
      
      const metadata: CourseMetadata = {
        title: courseSeedData?.courseTitle || 'Untitled Course',
        identifier: storage.currentProjectId || 'default-project',
        version: '1.0',
        scormVersion: '1.2',
        duration: 0,
        passMark: 80
      }
      const enhancedContent = await convertToEnhancedCourseContent(courseContent, metadata)
      performanceMetrics.conversionDuration = Date.now() - (typeof performanceMetrics.conversionStart === 'number' ? performanceMetrics.conversionStart : Date.now())
      console.log('[SCORMPackageBuilder] Enhanced content ready:', enhancedContent)
      
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
      
      setLoadingMessage('Loading media files...')
      
      // Load media from MediaRegistry and collect blobs for SCORM generation
      performanceMetrics.mediaLoadStart = Date.now()
      let failedMedia: string[] = []
      try {
        console.log('[SCORMPackageBuilder] === STARTING MEDIA LOAD PHASE ===')
        failedMedia = await loadMediaFromRegistry(enhancedContent)
        console.log('[SCORMPackageBuilder] === MEDIA LOAD PHASE COMPLETE ===')
        console.log('[SCORMPackageBuilder] Media files ready for packaging:', mediaFilesRef.current.size)
        
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
      let mediaCount = 0
      
      // Count welcome page media
      if (enhancedContent.welcome) {
        if (enhancedContent.welcome.audioFile || enhancedContent.welcome.audioId || enhancedContent.welcome.audioBlob) mediaCount++
        if (enhancedContent.welcome.captionFile || enhancedContent.welcome.captionId || enhancedContent.welcome.captionBlob) mediaCount++
        if (enhancedContent.welcome.media) mediaCount += enhancedContent.welcome.media.length
      }
      
      // Count objectives page media
      if (enhancedContent.objectivesPage) {
        if (enhancedContent.objectivesPage.audioFile || enhancedContent.objectivesPage.audioId || enhancedContent.objectivesPage.audioBlob) mediaCount++
        if (enhancedContent.objectivesPage.captionFile || enhancedContent.objectivesPage.captionId || enhancedContent.objectivesPage.captionBlob) mediaCount++
        if (enhancedContent.objectivesPage.media) mediaCount += enhancedContent.objectivesPage.media.length
      }
      
      // Count topic media
      if (enhancedContent.topics) {
        enhancedContent.topics.forEach(topic => {
          if (topic.audioFile || topic.audioId || topic.audioBlob) mediaCount++
          if (topic.captionFile || topic.captionId || topic.captionBlob) mediaCount++
          if (topic.media) mediaCount += topic.media.length
        })
      }
      
      const estimatedSeconds = Math.round(60 + (mediaCount * 2)) // Reduced base time and per-file time
      setLoadingMessage(`Generating SCORM package (${mediaCount} media files, ${mediaFilesRef.current.size} loaded)...`)
      console.log('[SCORMPackageBuilder] === STARTING RUST GENERATION PHASE ===')
      console.log(`[SCORMPackageBuilder] Media count: ${mediaCount}, Loaded files: ${mediaFilesRef.current.size}`)
      
      // Generate using Rust
      performanceMetrics.rustGenerationStart = Date.now()
      const result = await measureAsync(
        'scorm-generation',
        async () => {
          try {
            return await generateRustSCORM(
              enhancedContent,
              storage.currentProjectId || 'default-project',
              (message, progress) => {
                setLoadingMessage(message)
                // Could also update a progress bar here if we had one
                console.log('[SCORMPackageBuilder] Progress:', progress, message)
              },
              mediaFilesRef.current // Pass the pre-loaded media files
            )
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
      
      performanceMetrics.totalDuration = Date.now() - startTime
      setPerformanceData(performanceMetrics)
      console.log('[SCORMPackageBuilder] Performance metrics:', performanceMetrics)
      
      const newPackage: GeneratedPackage = {
        data: result instanceof Uint8Array ? result.buffer as ArrayBuffer : result,
        metadata: metadata as CourseMetadata
      }
      
      setGeneratedPackage(newPackage)
      
      // Don't add success message - the UI card handles this
      // setMessages(prev => [...prev, {
      //   id: `success-${Date.now()}`,
      //   type: 'success',
      //   text: `✅ SCORM package generated successfully! Size: ${(result.buffer.byteLength / 1024 / 1024).toFixed(2)} MB, Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`
      // }])
      
      setLoadingMessage('')
      
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
      console.error('Error generating SCORM package:', error)
      const errorMsg = `Error generating SCORM package: ${error instanceof Error ? error.message : 'Unknown error'}`
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'error',
        text: errorMsg
      }])
      notifyError(errorMsg)
      setLoadingMessage('')
    } finally {
      setIsGenerating(false)
      setIsLoadingMedia(false)
      setGenerationStartTime(null)
      setElapsedTime(0)
      // Clear interval if it exists
      if (typeof clearElapsedTimer !== 'undefined') {
        clearElapsedTimer()
      }
      // Don't clear media files immediately - keep for display
      // mediaFilesRef.current.clear()
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
      console.error('[SCORMPackageBuilder] Error saving SCORM package:', error)
      console.error('[SCORMPackageBuilder] Error details:', {
        name: error instanceof Error ? error.name : undefined,
        message: error instanceof Error ? error.message : undefined,
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error,
        constructor: error && typeof error === 'object' && 'constructor' in error ? (error.constructor as any)?.name : undefined
      })
      const errorMsg = `Error saving SCORM package: ${error instanceof Error ? error.message : 'Unknown error'}`
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
      currentStep={6}
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
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <LoadingSpinner size="medium" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Generating SCORM Package
                </h3>
                <p className="text-gray-600 mb-4">{loadingMessage}</p>
                
                {generationStartTime && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full text-sm text-blue-700">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    {elapsedTime.toFixed(1)}s elapsed
                  </div>
                )}
                
                {isLoadingMedia && loadingDetails.totalFiles > 0 && (
                  <div className="mt-6 max-w-md mx-auto">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Loading media files</span>
                      <span className="font-medium">{loadingDetails.filesLoaded}/{loadingDetails.totalFiles}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${mediaLoadProgress}%` }}
                      />
                    </div>
                    {loadingDetails.currentFile && (
                      <p className="text-xs text-gray-500 mt-2 truncate">
                        {loadingDetails.currentFile}
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
                          {(performanceData.totalDuration / 1000).toFixed(1)}
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Seconds</div>
                      </div>
                      <div className="w-px h-12 bg-gray-200" />
                    </>
                  )}
                  <div className="flex flex-col items-center">
                    <div className="text-2xl font-bold text-green-600">
                      {mediaFilesRef.current.size}
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">
                      {mediaFilesRef.current.size === 1 ? 'Media File' : 'Media Files'}
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