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

  // Helper function to get media blob from UnifiedMedia
  const getMediaBlobFromRegistry = async (mediaId: string): Promise<Blob | null> => {
    console.log('[SCORMPackageBuilder] getMediaBlobFromRegistry called with:', { mediaId })
    
    try {
      const mediaData = await getMedia(mediaId)
      console.log('[SCORMPackageBuilder] Media data retrieved:', {
        mediaId,
        hasData: !!mediaData?.data,
        hasUrl: !!mediaData?.url,
        dataType: mediaData?.data ? typeof mediaData.data : 'undefined',
        dataSize: mediaData?.data instanceof Uint8Array ? mediaData.data.length : 
                  mediaData?.data instanceof ArrayBuffer ? mediaData.data.byteLength : 0,
        metadata: mediaData?.metadata
      })
      
      if (mediaData) {
        // Check if we have binary data
        if (mediaData.data) {
          console.log('[SCORMPackageBuilder] Using binary data for:', mediaId)
          // Handle both Uint8Array and ArrayBuffer
          const dataArray = mediaData.data instanceof ArrayBuffer ? 
            new Uint8Array(mediaData.data) : 
            new Uint8Array(mediaData.data as any)
          return new Blob([dataArray], { 
            type: mediaData.metadata?.mimeType || mediaData.metadata?.mime_type || 'application/octet-stream' 
          })
        }
        
        // If we have a blob URL but no data, we need to fetch the data
        // This can happen if the media was loaded but not with binary data
        if (mediaData.url && mediaData.url.startsWith('blob:')) {
          console.log('[SCORMPackageBuilder] Fetching from blob URL for:', mediaId)
          try {
            const response = await fetch(mediaData.url)
            const blob = await response.blob()
            console.log('[SCORMPackageBuilder] Successfully fetched blob:', {
              mediaId,
              size: blob.size,
              type: blob.type
            })
            return blob
          } catch (fetchError) {
            console.error('[SCORMPackageBuilder] Failed to fetch blob URL:', fetchError)
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
    console.log('[SCORMPackageBuilder] Loading media from UnifiedMedia')
    
    // Get all media items
    const allMediaItems = getAllMedia()
    console.log('[SCORMPackageBuilder] Found', allMediaItems.length, 'media items')
    
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
        
        // Store the remote media locally
        const mediaItem = await storage.storeMedia(blob, pageId, mediaType, {
          originalName: url.split('/').pop() || 'remote-media',
          source: 'remote',
          originalUrl: url
        })
        
        console.log('[SCORMPackageBuilder] Stored remote media with ID:', mediaItem.id)
        return mediaItem.id
      } catch (error) {
        console.error('[SCORMPackageBuilder] Failed to download remote media:', error)
        return null
      }
    }
    
    // Load media for each page
    // FIX: Use correct property name 'welcome' instead of 'welcomePage'
    if (enhancedContent.welcome) {
      // Welcome page media
      const welcomeAudio = enhancedContent.welcome.audio
      const welcomeCaption = enhancedContent.welcome.caption
      const welcomeMedia = enhancedContent.welcome.mediaReferences || []
      
      if (welcomeAudio?.id) {
        const audioBlob = await getMediaBlobFromRegistry(welcomeAudio.id)
        if (audioBlob) {
          mediaFilesRef.current.set(welcomeAudio.fileName || 'welcome.mp3', audioBlob)
          console.log('[SCORMPackageBuilder] Loaded welcome audio:', welcomeAudio.id)
        }
      }
      
      if (welcomeCaption?.id) {
        const captionBlob = await getMediaBlobFromRegistry(welcomeCaption.id)
        if (captionBlob) {
          mediaFilesRef.current.set(welcomeCaption.fileName || 'welcome.vtt', captionBlob)
          console.log('[SCORMPackageBuilder] Loaded welcome caption:', welcomeCaption.id)
        }
      }
      
      for (const mediaRef of welcomeMedia) {
        if (mediaRef.id) {
          const mediaBlob = await getMediaBlobFromRegistry(mediaRef.id)
          if (mediaBlob) {
            mediaFilesRef.current.set(mediaRef.fileName, mediaBlob)
            console.log('[SCORMPackageBuilder] Loaded welcome media:', mediaRef.id)
          }
        } else if (mediaRef.url && mediaRef.url.startsWith('http')) {
          // Handle remote media
          const newId = await handleRemoteMedia(mediaRef.url, 'image', 'welcome')
          if (newId) {
            mediaRef.id = newId // Update the media reference with the new ID
            const mediaBlob = await getMediaBlobFromRegistry(newId)
            if (mediaBlob) {
              mediaFilesRef.current.set(mediaRef.fileName || `remote-${Date.now()}.jpg`, mediaBlob)
              console.log('[SCORMPackageBuilder] Loaded remote media with new ID:', newId)
            }
          }
        }
      }
    }
    
    // FIX: Use correct property name 'objectivesPage'
    if (enhancedContent.objectivesPage) {
      // Objectives page media
      const objectivesAudio = enhancedContent.objectivesPage.audio
      const objectivesCaption = enhancedContent.objectivesPage.caption
      const objectivesMedia = enhancedContent.objectivesPage.mediaReferences || []
      
      if (objectivesAudio?.id) {
        const audioBlob = await getMediaBlobFromRegistry(objectivesAudio.id)
        if (audioBlob) {
          mediaFilesRef.current.set(objectivesAudio.fileName || 'objectives.mp3', audioBlob)
          console.log('[SCORMPackageBuilder] Loaded objectives audio:', objectivesAudio.id)
        }
      }
      
      if (objectivesCaption?.id) {
        const captionBlob = await getMediaBlobFromRegistry(objectivesCaption.id)
        if (captionBlob) {
          mediaFilesRef.current.set(objectivesCaption.fileName || 'objectives.vtt', captionBlob)
          console.log('[SCORMPackageBuilder] Loaded objectives caption:', objectivesCaption.id)
        }
      }
      
      for (const mediaRef of objectivesMedia) {
        if (mediaRef.id) {
          const mediaBlob = await getMediaBlobFromRegistry(mediaRef.id)
          if (mediaBlob) {
            mediaFilesRef.current.set(mediaRef.fileName, mediaBlob)
            console.log('[SCORMPackageBuilder] Loaded objectives media:', mediaRef.id)
          }
        } else if (mediaRef.url && mediaRef.url.startsWith('http')) {
          // Handle remote media
          const newId = await handleRemoteMedia(mediaRef.url, 'image', 'objectives')
          if (newId) {
            mediaRef.id = newId
            const mediaBlob = await getMediaBlobFromRegistry(newId)
            if (mediaBlob) {
              mediaFilesRef.current.set(mediaRef.fileName || `remote-${Date.now()}.jpg`, mediaBlob)
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
        const topicAudio = topic.audio
        const topicCaption = topic.caption
        const topicMedia = topic.mediaReferences || []
        
        if (topicAudio?.id) {
          const audioBlob = await getMediaBlobFromRegistry(topicAudio.id)
          if (audioBlob) {
            mediaFilesRef.current.set(topicAudio.fileName || `topic${topicIndex}.mp3`, audioBlob)
            console.log('[SCORMPackageBuilder] Loaded topic audio:', topicAudio.id)
          }
        }
        
        if (topicCaption?.id) {
          const captionBlob = await getMediaBlobFromRegistry(topicCaption.id)
          if (captionBlob) {
            mediaFilesRef.current.set(topicCaption.fileName || `topic${topicIndex}.vtt`, captionBlob)
            console.log('[SCORMPackageBuilder] Loaded topic caption:', topicCaption.id)
          }
        }
        
        for (const mediaRef of topicMedia) {
          if (mediaRef.id) {
            const mediaBlob = await getMediaBlobFromRegistry(mediaRef.id)
            if (mediaBlob) {
              mediaFilesRef.current.set(mediaRef.fileName, mediaBlob)
              console.log('[SCORMPackageBuilder] Loaded topic media:', mediaRef.id)
            }
          } else if (mediaRef.url && mediaRef.url.startsWith('http')) {
            // Handle remote media
            const newId = await handleRemoteMedia(mediaRef.url, 'image', `topic-${topicIndex}`)
            if (newId) {
              mediaRef.id = newId
              const mediaBlob = await getMediaBlobFromRegistry(newId)
              if (mediaBlob) {
                mediaFilesRef.current.set(mediaRef.fileName || `remote-${Date.now()}.jpg`, mediaBlob)
                console.log('[SCORMPackageBuilder] Loaded remote topic media with new ID:', newId)
              }
            }
          }
        }
      }
    }
    
    console.log('[SCORMPackageBuilder] Media loading complete. Total files:', mediaFilesRef.current.size)
  }

  const generatePackage = async () => {
    // Clear previous messages and media files
    setMessages([])
    mediaFilesRef.current.clear()  // FIX: Use ref instead of global
    setGeneratedPackage(null)
    setIsGenerating(true)
    setIsLoadingMedia(true)
    setLoadingMessage('Preparing course content...')
    
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
        await loadMediaFromRegistry(enhancedContent)
        console.log('[SCORMPackageBuilder] Media files loaded:', mediaFilesRef.current.size)
        
        // Add blob references to enhanced content for Rust generator
        // The Rust generator needs these blobs to include media in the package
        if (enhancedContent.welcome) {
          if (enhancedContent.welcome.audio?.id) {
            (enhancedContent.welcome as any).audioBlob = mediaFilesRef.current.get(
              enhancedContent.welcome.audio.fileName || 'welcome.mp3'
            )
          }
          if (enhancedContent.welcome.caption?.id) {
            (enhancedContent.welcome as any).captionBlob = mediaFilesRef.current.get(
              enhancedContent.welcome.caption.fileName || 'welcome.vtt'
            )
          }
        }
        
        if (enhancedContent.objectivesPage) {
          if (enhancedContent.objectivesPage.audio?.id) {
            (enhancedContent.objectivesPage as any).audioBlob = mediaFilesRef.current.get(
              enhancedContent.objectivesPage.audio.fileName || 'objectives.mp3'
            )
          }
          if (enhancedContent.objectivesPage.caption?.id) {
            (enhancedContent.objectivesPage as any).captionBlob = mediaFilesRef.current.get(
              enhancedContent.objectivesPage.caption.fileName || 'objectives.vtt'
            )
          }
        }
        
        if (enhancedContent.topics) {
          enhancedContent.topics.forEach((topic, index) => {
            if (topic.audio?.id) {
              (topic as any).audioBlob = mediaFilesRef.current.get(
                topic.audio.fileName || `topic${index}.mp3`
              )
            }
            if (topic.caption?.id) {
              (topic as any).captionBlob = mediaFilesRef.current.get(
                topic.caption.fileName || `topic${index}.vtt`
              )
            }
            // Handle other media in topics
            if (topic.mediaReferences) {
              topic.mediaReferences.forEach(mediaRef => {
                if (mediaRef.id && mediaRef.fileName) {
                  const blob = mediaFilesRef.current.get(mediaRef.fileName)
                  if (blob) {
                    (mediaRef as any).blob = blob
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
      
      const estimatedSeconds = Math.round(120 + (mediaCount * 4))
      setLoadingMessage(`Generating SCORM package (${mediaCount} media files, estimated ${estimatedSeconds}s)...`)
      
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
              }
            )
          } catch (rustError: any) {
            console.error('[SCORMPackageBuilder] Rust generation failed:', rustError)
            throw rustError
          }
        }
      )
      performanceMetrics.rustGenerationDuration = Date.now() - performanceMetrics.rustGenerationStart
      
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
        text: 'SCORM package generated successfully!'
      }])
      
      setLoadingMessage('')
      
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
      // Clear media files to free memory
      mediaFilesRef.current.clear()
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
          <Card className="mb-6">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon icon={CheckCircle} className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Package Ready!</h3>
              <p className="text-gray-600 mb-4">
                Your SCORM package has been generated successfully.
              </p>
              <div className="text-sm text-gray-500 mb-6">
                <p>Package size: {(generatedPackage.data.byteLength / 1024 / 1024).toFixed(2)} MB</p>
                {performanceData && (
                  <p>Generation time: {(performanceData.totalDuration / 1000).toFixed(2)} seconds</p>
                )}
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