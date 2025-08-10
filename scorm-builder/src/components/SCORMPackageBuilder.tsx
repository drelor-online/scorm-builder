import React, { useState } from 'react'
import { CourseContent } from '../types/aiPrompt'
import type { CourseMetadata } from '../types/metadata'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { invoke } from '@tauri-apps/api/core'
import { convertToEnhancedCourseContent } from '../services/courseContentConverter'
import { generateRustSCORM } from '../services/rustScormGenerator'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
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
  onSaveAs?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
}

interface Message {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  text: string
}

// Media files map will be created inside component to avoid memory leaks

const SCORMPackageBuilderComponent: React.FC<SCORMPackageBuilderProps> = ({
  courseContent,
  courseSeedData,
  onNext,
  onBack,
  onSettingsClick,
  onSave,
  onSaveAs,
  onOpen,
  onHelp,
  onStepClick
}) => {
  // Create media files map inside component to avoid persistence issues
  const mediaFilesRef = React.useRef(new Map<string, Blob>())
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [generatedPackage, setGeneratedPackage] = useState<{
    data: ArrayBuffer
    metadata: any // SCORMMetadata type not defined
  } | null>(null)
  const [loadingMessage, setLoadingMessage] = useState('Preparing SCORM package...')
  const [audioAutoplay, setAudioAutoplay] = useState(() => 
    localStorage.getItem('audioAutoplay') === 'true'
  )
  const [isLoadingMedia, setIsLoadingMedia] = useState(false)
  const [mediaLoadProgress, setMediaLoadProgress] = useState(0)
  const [loadingDetails, setLoadingDetails] = useState({
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
    createBlobUrl
  } = useUnifiedMedia()
  const { measureAsync } = usePerformanceMonitor({
    componentName: 'SCORMPackageBuilder',
    trackRenders: true
  })
  const [performanceData, setPerformanceData] = useState<any>(null)

  // Helper function to get media blob from UnifiedMedia with timeout
  const getMediaBlobFromRegistry = async (mediaId: string): Promise<Blob | null> => {
    console.log('[SCORMPackageBuilder] Loading media:', mediaId)
    
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => {
          console.warn(`[SCORMPackageBuilder] Timeout loading media: ${mediaId}`)
          resolve(null)
        }, 5000) // 5 second timeout per media file
      })
      
      const mediaDataPromise = getMedia(mediaId)
      const mediaData = await Promise.race([mediaDataPromise, timeoutPromise])
      
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
            const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
            
            const response = await fetch(mediaData.url, { signal: controller.signal })
            clearTimeout(timeoutId)
            
            const blob = await response.blob()
            console.log('[SCORMPackageBuilder] Successfully fetched blob:', {
              mediaId,
              size: blob.size,
              type: blob.type
            })
            return blob
          } catch (fetchError: any) {
            if (fetchError.name === 'AbortError') {
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

  const loadMediaFromRegistry = async (enhancedContent: any) => {
    console.log('[SCORMPackageBuilder] Starting media loading from UnifiedMedia')
    
    // Track loaded media to prevent duplicates
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
        
        // Store the remote media locally - NOT IMPLEMENTED YET
        // Need to use storeMedia from useUnifiedMedia but it's a hook
        // For now, just return null
        console.log('[SCORMPackageBuilder] Remote media storage not implemented yet')
        const mediaItem = { id: null } // Temporary placeholder
        return null
        
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
        if (mediaItem.id && !loadedMediaIds.has(mediaItem.id)) {
          loadedMediaIds.add(mediaItem.id)
          totalMediaToLoad++
          console.log(`[SCORMPackageBuilder] Loading welcome media (${loadedCount + 1}/${totalMediaToLoad}): ${mediaItem.id}`)
          const mediaBlob = await getMediaBlobFromRegistry(mediaItem.id)
          if (mediaBlob) {
            const extension = mediaItem.type === 'image' ? '.jpg' : mediaItem.type === 'video' ? '.mp4' : '.bin'
            mediaFilesRef.current.set(`${mediaItem.id}${extension}`, mediaBlob)
            loadedCount++
            console.log(`[SCORMPackageBuilder] ✓ Loaded welcome media: ${mediaItem.id}`)
          } else {
            failedMedia.push(`welcome ${mediaItem.type || 'media'}: ${mediaItem.id}`)
            console.warn(`[SCORMPackageBuilder] ✗ Failed to load welcome media: ${mediaItem.id}`)
          }
        } else if (mediaItem.id && loadedMediaIds.has(mediaItem.id)) {
          console.log(`[SCORMPackageBuilder] Skipping duplicate welcome media: ${mediaItem.id}`)
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
        if (mediaItem.id && !loadedMediaIds.has(mediaItem.id)) {
          loadedMediaIds.add(mediaItem.id)
          const mediaBlob = await getMediaBlobFromRegistry(mediaItem.id)
          if (mediaBlob) {
            const extension = mediaItem.type === 'image' ? '.jpg' : mediaItem.type === 'video' ? '.mp4' : '.bin'
            mediaFilesRef.current.set(`${mediaItem.id}${extension}`, mediaBlob)
            console.log('[SCORMPackageBuilder] Loaded objectives media:', mediaItem.id)
          }
        } else if (mediaItem.id && loadedMediaIds.has(mediaItem.id)) {
          console.log(`[SCORMPackageBuilder] Skipping duplicate objectives media: ${mediaItem.id}`)
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
          if (mediaItem.id && !loadedMediaIds.has(mediaItem.id)) {
            loadedMediaIds.add(mediaItem.id)
            const mediaBlob = await getMediaBlobFromRegistry(mediaItem.id)
            if (mediaBlob) {
              const extension = mediaItem.type === 'image' ? '.jpg' : mediaItem.type === 'video' ? '.mp4' : '.bin'
              mediaFilesRef.current.set(`${mediaItem.id}${extension}`, mediaBlob)
              console.log('[SCORMPackageBuilder] Loaded topic media:', mediaItem.id)
            }
          } else if (mediaItem.id && loadedMediaIds.has(mediaItem.id)) {
            console.log(`[SCORMPackageBuilder] Skipping duplicate topic ${topicIndex} media: ${mediaItem.id}`)
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
      const performanceMetrics: any = {}
      
      // Enhanced course content for Rust
      performanceMetrics.conversionStart = Date.now()
      const metadata: CourseMetadata = {
        title: courseSeedData?.courseTitle || 'Untitled Course',
        identifier: storage.currentProjectId || 'default-project',
        version: '1.0',
        scormVersion: '1.2',
        duration: 0,
        passMark: 80
      }
      const enhancedContent = await convertToEnhancedCourseContent(courseContent, metadata)
      performanceMetrics.conversionDuration = Date.now() - performanceMetrics.conversionStart
      console.log('[SCORMPackageBuilder] Enhanced content ready:', enhancedContent)
      
      setLoadingMessage('Loading media files...')
      
      // Load media from MediaRegistry and collect blobs for SCORM generation
      performanceMetrics.mediaLoadStart = Date.now()
      try {
        console.log('[SCORMPackageBuilder] === STARTING MEDIA LOAD PHASE ===')
        await loadMediaFromRegistry(enhancedContent)
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
        setMessages(prev => [...prev, {
          id: `warning-media-${Date.now()}`,
          type: 'warning',
          text: 'Some media files could not be loaded. The SCORM package will be generated without them.'
        }])
      }
      performanceMetrics.mediaLoadDuration = Date.now() - performanceMetrics.mediaLoadStart
      
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
          } catch (rustError: any) {
            console.error('[SCORMPackageBuilder] Rust generation failed:', rustError)
            throw rustError
          }
        }
      )
      performanceMetrics.rustGenerationDuration = Date.now() - performanceMetrics.rustGenerationStart
      console.log('[SCORMPackageBuilder] === RUST GENERATION PHASE COMPLETE ===')
      
      if (!result) {
        throw new Error('Failed to generate SCORM package - no data returned')
      }
      
      performanceMetrics.totalDuration = Date.now() - startTime
      setPerformanceData(performanceMetrics)
      console.log('[SCORMPackageBuilder] Performance metrics:', performanceMetrics)
      
      const newPackage = {
        data: result.buffer instanceof ArrayBuffer ? result.buffer : (result.buffer as any).buffer || result.buffer,
        metadata: metadata
      }
      
      setGeneratedPackage(newPackage)
      
      setMessages(prev => [...prev, {
        id: `success-${Date.now()}`,
        type: 'success',
        text: `✅ SCORM package generated successfully! Size: ${(result.buffer.byteLength / 1024 / 1024).toFixed(2)} MB, Time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`
      }])
      
      setLoadingMessage('')
      
      // Clear the elapsed time interval
      clearElapsedTimer()
      
      // FIX: Don't auto-download. Let user choose when to download
      console.log('[SCORMPackageBuilder] Package generated successfully, ready for download')
    } catch (error) {
      console.error('Error generating SCORM package:', error)
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'error',
        text: `Error generating SCORM package: ${error instanceof Error ? error.message : 'Unknown error'}`
      }])
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

  const downloadPackage = async (packageToDownload?: typeof generatedPackage) => {
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
        const sanitizedFileName = sanitizeScormFileName(pkg.metadata.title || courseSeedData?.courseTitle)
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
          const fileName = sanitizeScormFileName(pkg.metadata.title || courseSeedData?.courseTitle)
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
        setMessages(prev => [...prev, {
          id: `download-success-${Date.now()}`,
          type: 'success',
          text: `SCORM package saved to: ${filePath}`
        }])
      } else {
        console.log('[SCORMPackageBuilder] User cancelled save dialog or no path returned')
      }
    } catch (error: any) {
      console.error('[SCORMPackageBuilder] Error saving SCORM package:', error)
      console.error('[SCORMPackageBuilder] Error details:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        type: typeof error,
        constructor: error?.constructor?.name
      })
      setMessages(prev => [...prev, {
        id: `download-error-${Date.now()}`,
        type: 'error',
        text: `Error saving SCORM package: ${error instanceof Error ? error.message : 'Unknown error'}`
      }])
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
    const baseStyle = "mb-3 p-4 rounded-lg border flex items-start justify-between animate-fadeIn"
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
      description="Create a SCORM-compliant package for your course"
      onBack={onBack}
      actions={
        generatedPackage ? (
          <Button 
            onClick={() => downloadPackage()}
            disabled={isDownloading}
            variant="primary"
            className="min-w-[200px]"
          >
            {isDownloading ? (
              <>
                <Icon icon={Loader2} className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Icon icon={Download} />
                Download Package
              </>
            )}
          </Button>
        ) : undefined
      }
      onSettingsClick={onSettingsClick}
      onSave={onSave}
      onSaveAs={onSaveAs}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
    >
      <div className="max-w-4xl mx-auto">
        <Card className="mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Package Information</h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm text-gray-500">Course Title:</span>
                <p className="font-medium">{courseSeedData?.courseTitle || 'Untitled Course'}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">SCORM Version:</span>
                <p className="font-medium">SCORM 1.2</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Content Summary:</span>
                <p className="text-sm text-gray-600">
                  {courseContent.topics?.length || 0} topics, 
                  {' '}{courseContent.topics?.length || 0} knowledge checks,
                  {' '}{courseContent.assessment?.questions?.length || 0} assessment questions
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Audio Settings */}
        <Card className="mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Audio Settings</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={audioAutoplay}
                  onChange={(e) => {
                    const newValue = e.target.checked
                    setAudioAutoplay(newValue)
                    localStorage.setItem('audioAutoplay', newValue.toString())
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Enable audio autoplay"
                />
                <div>
                  <span className="font-medium">Autoplay audio when pages load</span>
                  <p className="text-sm text-gray-500 mt-1">
                    Note: Some browsers may require user interaction before audio can play automatically.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </Card>

        {/* Messages */}
        {messages.length > 0 && (
          <div className="mb-6">
            {messages.map(message => (
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
          <Card className="mb-6">
            <div className="p-8">
              <div className="flex flex-col items-center justify-center">
                <LoadingSpinner size="large" className="mb-4" />
                <p className="text-lg font-medium mb-2">{loadingMessage}</p>
                {generationStartTime && (
                  <p className="text-sm text-gray-500 mb-2">
                    Elapsed: {elapsedTime.toFixed(1)} seconds
                  </p>
                )}
                {isLoadingMedia && (
                  <div className="mt-4 w-full max-w-md">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Loading media files...</span>
                      <span>{loadingDetails.filesLoaded} / {loadingDetails.totalFiles}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
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
          <Card className="mb-6 border-2 border-green-500 shadow-lg animate-fadeIn">
            <div className="p-8 text-center bg-gradient-to-b from-green-50 to-white rounded-lg">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <Icon icon={CheckCircle} className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold mb-2 text-green-800">🎉 Package Generated Successfully!</h3>
              <p className="text-lg text-gray-700 mb-4">
                Your SCORM package is ready for download.
              </p>
              <div className="bg-white rounded-lg p-4 mb-6 shadow-inner">
                <div className="text-sm space-y-1">
                  <p className="text-gray-600">
                    <span className="font-semibold">Package size:</span> 
                    <span className="text-lg font-bold text-blue-600 ml-2">
                      {(generatedPackage.data.byteLength / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </p>
                  {performanceData && (
                    <p className="text-gray-600">
                      <span className="font-semibold">Generation time:</span>
                      <span className="text-lg font-bold text-blue-600 ml-2">
                        {(performanceData.totalDuration / 1000).toFixed(1)} seconds
                      </span>
                    </p>
                  )}
                  <p className="text-gray-600">
                    <span className="font-semibold">Media files included:</span>
                    <span className="text-lg font-bold text-blue-600 ml-2">
                      {mediaFilesRef.current.size}
                    </span>
                  </p>
                </div>
              </div>
              <Button
                onClick={() => downloadPackage()}
                disabled={isDownloading}
                variant="primary"
                size="large"
                className="min-w-[200px]"
              >
                {isDownloading ? (
                  <>
                    <Icon icon={Loader2} className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon icon={Download} />
                    Download Package
                  </>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Generate Button */}
        {!isGenerating && !generatedPackage && (
          <div className="text-center">
            <Button
              onClick={generatePackage}
              variant="primary"
              size="large"
              className="min-w-[300px]"
            >
              <Icon icon={Package} />
              Generate SCORM Package
            </Button>
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
    prevProps.onSaveAs === nextProps.onSaveAs &&
    prevProps.onOpen === nextProps.onOpen &&
    prevProps.onHelp === nextProps.onHelp &&
    prevProps.onStepClick === nextProps.onStepClick
  )
})

export default SCORMPackageBuilder