import React, { useState } from 'react'
import { CourseContent } from '../types/aiPrompt'
import type { CourseMetadata } from '../types/metadata'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
// import { invoke } from '@tauri-apps/api/core' // Not used
import { convertToEnhancedCourseContent } from '../services/courseContentConverter'
// import type { EnhancedCourseContent } from '../types/scorm' // Not used
import { generateRustSCORM } from '../services/rustScormGenerator'
// import { detectMediaTypeFromBlob } from '../utils/mediaExtension' // Not used
import { useStorage } from '../contexts/PersistentStorageContext'
import { useUnifiedMedia } from '../contexts/UnifiedMediaContext'
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor'

import { PageLayout } from './PageLayout'
// import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected' // Not used
import { 
  Card, 
  Button, 
  LoadingSpinner,
  Icon
} from './DesignSystem'
import { Package, Download, Loader2, AlertCircle, CheckCircle, X } from 'lucide-react'
import './DesignSystem/designSystem.css'
import type { CourseSeedData } from '../types/course'
// import { convertScormToStructuredContentSafely } from '../services/courseContentConverter' // Doesn't exist
// import { getExtensionFromMimeType } from '../utils/mediaExtension' // Doesn't exist
// import { sanitizeHtml } from '../utils/sanitization' // Wrong name

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

// Create a singleton map for tracking media files during generation
const mediaFiles = new Map<string, Blob>()

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
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [generatedPackage, setGeneratedPackage] = useState<{
    data: ArrayBuffer
    metadata: any // SCORMMetadata type not defined
  } | null>(null)
  const [loadingMessage, setLoadingMessage] = useState('Preparing SCORM package...')
  const [isUsingCache, setIsUsingCache] = useState(false)
  const [cachedMediaCount, setCachedMediaCount] = useState(0)
  const [totalMediaCount, setTotalMediaCount] = useState(0)
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
      if (mediaData) {
        console.log('[SCORMPackageBuilder] Found media:', mediaId)
        return new Blob([mediaData.data], { type: mediaData.metadata?.mimeType || 'application/octet-stream' })
      }
    } catch (error) {
      console.error('[SCORMPackageBuilder] Error getting media:', error)
    }
    
    return null
  }

  const loadMediaFromRegistry = async (enhancedContent: any) => {
    console.log('[SCORMPackageBuilder] Loading media from UnifiedMedia')
    
    // Get all media items
    const allMediaItems = getAllMedia()
    console.log('[SCORMPackageBuilder] Found', allMediaItems.length, 'media items')
    
    // Load media for each page
    if (enhancedContent.welcomePage) {
      // Welcome page media
      const welcomeAudio = enhancedContent.welcomePage.audio
      const welcomeCaption = enhancedContent.welcomePage.caption
      const welcomeMedia = enhancedContent.welcomePage.mediaReferences || []
      
      if (welcomeAudio?.id) {
        const audioBlob = await getMediaBlobFromRegistry(welcomeAudio.id)
        if (audioBlob) {
          mediaFiles.set(welcomeAudio.fileName || 'welcome.mp3', audioBlob)
          console.log('[SCORMPackageBuilder] Loaded welcome audio:', welcomeAudio.id)
        }
      }
      
      if (welcomeCaption?.id) {
        const captionBlob = await getMediaBlobFromRegistry(welcomeCaption.id)
        if (captionBlob) {
          mediaFiles.set(welcomeCaption.fileName || 'welcome.vtt', captionBlob)
          console.log('[SCORMPackageBuilder] Loaded welcome caption:', welcomeCaption.id)
        }
      }
      
      for (const mediaRef of welcomeMedia) {
        if (mediaRef.id) {
          const mediaBlob = await getMediaBlobFromRegistry(mediaRef.id)
          if (mediaBlob) {
            mediaFiles.set(mediaRef.fileName, mediaBlob)
            console.log('[SCORMPackageBuilder] Loaded welcome media:', mediaRef.id)
          }
        }
      }
    }
    
    if (enhancedContent.learningObjectivesPage) {
      // Objectives page media
      const objectivesAudio = enhancedContent.learningObjectivesPage.audio
      const objectivesCaption = enhancedContent.learningObjectivesPage.caption
      const objectivesMedia = enhancedContent.learningObjectivesPage.mediaReferences || []
      
      if (objectivesAudio?.id) {
        const audioBlob = await getMediaBlobFromRegistry(objectivesAudio.id)
        if (audioBlob) {
          mediaFiles.set(objectivesAudio.fileName || 'objectives.mp3', audioBlob)
          console.log('[SCORMPackageBuilder] Loaded objectives audio:', objectivesAudio.id)
        }
      }
      
      if (objectivesCaption?.id) {
        const captionBlob = await getMediaBlobFromRegistry(objectivesCaption.id)
        if (captionBlob) {
          mediaFiles.set(objectivesCaption.fileName || 'objectives.vtt', captionBlob)
          console.log('[SCORMPackageBuilder] Loaded objectives caption:', objectivesCaption.id)
        }
      }
      
      for (const mediaRef of objectivesMedia) {
        if (mediaRef.id) {
          const mediaBlob = await getMediaBlobFromRegistry(mediaRef.id)
          if (mediaBlob) {
            mediaFiles.set(mediaRef.fileName, mediaBlob)
            console.log('[SCORMPackageBuilder] Loaded objectives media:', mediaRef.id)
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
            mediaFiles.set(topicAudio.fileName || `topic${topicIndex}.mp3`, audioBlob)
            console.log('[SCORMPackageBuilder] Loaded topic audio:', topicAudio.id)
          }
        }
        
        if (topicCaption?.id) {
          const captionBlob = await getMediaBlobFromRegistry(topicCaption.id)
          if (captionBlob) {
            mediaFiles.set(topicCaption.fileName || `topic${topicIndex}.vtt`, captionBlob)
            console.log('[SCORMPackageBuilder] Loaded topic caption:', topicCaption.id)
          }
        }
        
        for (const mediaRef of topicMedia) {
          if (mediaRef.id) {
            const mediaBlob = await getMediaBlobFromRegistry(mediaRef.id)
            if (mediaBlob) {
              mediaFiles.set(mediaRef.fileName, mediaBlob)
              console.log('[SCORMPackageBuilder] Loaded topic media:', mediaRef.id)
            }
          }
        }
      }
    }
    
    console.log('[SCORMPackageBuilder] Media loading complete. Total files:', mediaFiles.size)
  }

  const generatePackage = async () => {
    // Clear previous messages and media files
    setMessages([])
    mediaFiles.clear()
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
      
      // Load media from MediaRegistry only
      performanceMetrics.mediaLoadStart = Date.now()
      try {
        await loadMediaFromRegistry(enhancedContent)
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
      setLoadingMessage('Generating SCORM package...')
      
      // Generate using Rust
      performanceMetrics.rustGenerationStart = Date.now()
      const result = await measureAsync(
        'scorm-generation',
        async () => {
          try {
            return await generateRustSCORM(
              enhancedContent,
              storage.currentProjectId || 'default-project'
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
      
      setGeneratedPackage({
        data: result.buffer,
        metadata: metadata
      })
      
      setMessages(prev => [...prev, {
        id: `success-${Date.now()}`,
        type: 'success',
        text: 'SCORM package generated successfully!'
      }])
      
      setLoadingMessage('')
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
      mediaFiles.clear()
    }
  }

  const downloadPackage = async () => {
    if (!generatedPackage) return
    
    setIsDownloading(true)
    try {
      // Open save dialog
      const filePath = await save({
        defaultPath: `${generatedPackage.metadata.title || 'course'}.zip`,
        filters: [{
          name: 'SCORM Package',
          extensions: ['zip']
        }]
      })
      
      if (filePath) {
        // Write the file
        await writeFile(filePath, new Uint8Array(generatedPackage.data))
        
        setMessages(prev => [...prev, {
          id: `download-success-${Date.now()}`,
          type: 'success',
          text: `SCORM package saved to: ${filePath}`
        }])
      }
    } catch (error) {
      console.error('Error saving SCORM package:', error)
      setMessages(prev => [...prev, {
        id: `download-error-${Date.now()}`,
        type: 'error',
        text: `Error saving SCORM package: ${error instanceof Error ? error.message : 'Unknown error'}`
      }])
    } finally {
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
        <Button 
          onClick={downloadPackage}
          disabled={!generatedPackage || isDownloading}
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
              <div className="text-sm text-gray-500">
                <p>Package size: {(generatedPackage.data.byteLength / 1024 / 1024).toFixed(2)} MB</p>
                {performanceData && (
                  <p>Generation time: {(performanceData.totalDuration / 1000).toFixed(2)} seconds</p>
                )}
              </div>
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