import React, { useState } from 'react'
import { CourseContent } from '../types/aiPrompt'
import type { CourseMetadata } from '../types/metadata'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { convertToEnhancedCourseContent } from '../services/courseContentConverter'
import { generateSpaceEfficientSCORM12Buffer } from '../services/spaceEfficientScormGenerator'
import { useStorage } from '../contexts/PersistentStorageContext'
import { generateMediaId, getPageIndex } from '../services/idGenerator'
import { getMediaIdVariants } from '../services/mediaIdMigration'

import { PageLayout } from './PageLayout'
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected'
import { CoursePreview } from './CoursePreview'
import { ProjectExportButton, ProjectImportButton } from './ProjectExportImport'
import { 
  Card, 
  Input, 
  Section,
  Grid,
  Modal,
  Alert as DesignAlert
} from './DesignSystem'
import './DesignSystem/designSystem.css'
import { tokens } from './DesignSystem/designTokens'

import type { CourseSeedData as FullCourseSeedData, CourseTemplate } from '../types/course'

interface CourseSeedData extends Partial<FullCourseSeedData> {
  courseTitle: string
  courseDescription?: string
  audienceDescription?: string
  duration?: number
}

// Storage interface for accessing media from PersistentStorage
interface StorageInterface {
  getMedia: (id: string) => Promise<any>
  getMediaForTopic: (topicId: string) => Promise<any[]>
}

interface SCORMPackageBuilderProps {
  courseContent: CourseContent
  courseSeedData: CourseSeedData
  onNext: (content: CourseContent) => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: () => void
  onSaveAs?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
  storage?: StorageInterface
}

// Alert component
const Alert: React.FC<{ 
  type: 'info' | 'warning' | 'success'
  children: React.ReactNode 
  style?: React.CSSProperties
}> = ({ type, children, style }) => {
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
      fontSize: '0.875rem',
      ...style
    }}>
      {children}
    </div>
  )
}

export const SCORMPackageBuilder: React.FC<SCORMPackageBuilderProps> = ({ 
  courseContent, 
  courseSeedData,
  onNext: _onNext, 
  onBack, 
  onSettingsClick, 
  onSave, 
  onSaveAs,
  onOpen, 
  onHelp,
  onStepClick,
  storage: propStorage 
}) => {
  const contextStorage = useStorage()
  const storage = propStorage || contextStorage
  
  // Debug logging
  React.useEffect(() => {
    console.log('SCORMPackageBuilder rendered with:', {
      courseContent: courseContent,
      courseSeedData: courseSeedData,
      hasCourseContent: !!courseContent,
      hasCourseSeedData: !!courseSeedData,
      courseSeedDataTitle: courseSeedData?.courseTitle
    })
  }, [courseContent, courseSeedData])
  
  // Ensure courseSeedData has required fields with defaults
  const normalizedCourseSeedData = React.useMemo(() => {
    if (!courseSeedData) return null
    
    // Handle both camelCase and snake_case field names
    const seedData = courseSeedData as any
    
    return {
      courseTitle: seedData.courseTitle || '',
      courseDescription: seedData.courseDescription,
      audienceDescription: seedData.audienceDescription,
      duration: seedData.duration,
      // Add missing required fields with defaults if needed
      difficulty: seedData.difficulty ?? 3,
      // Handle both customTopics and custom_topics
      customTopics: seedData.customTopics || seedData.custom_topics || [],
      template: (seedData.template || 'None') as CourseTemplate,
      templateTopics: seedData.templateTopics || []
    }
  }, [courseSeedData])
  
  const [version, setVersion] = useState('1.0')
  const [isGenerating, setIsGenerating] = useState(false)
  const [packageGenerated, setPackageGenerated] = useState(false)
  const [isTauriEnvironment, setIsTauriEnvironment] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  
  // Clear error after 5 seconds
  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])
  
  // Clear warning after 5 seconds
  React.useEffect(() => {
    if (warning) {
      const timer = setTimeout(() => setWarning(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [warning])

  // Check if we're running in Tauri
  React.useEffect(() => {
    try {
      setIsTauriEnvironment(window && '__TAURI__' in window)
    } catch {
      setIsTauriEnvironment(false)
    }
  }, [])

  // Helper function to enhance content with media blobs from storage
  const enhanceContentWithStorageMedia = async (
    content: any, // EnhancedCourseContent type
    storage: StorageInterface
  ) => {
    try {
      let mediaLoaded = 0
      let mediaFailed = 0
      
      // Process welcome page media
      if (content.welcome.media) {
        for (const media of content.welcome.media) {
          try {
            // Try with the media ID as-is first
            let storedMedia = await storage.getMedia(media.id)
            
            // If not found and the ID doesn't already have a page prefix, try with welcome prefix
            if (!storedMedia && !media.id.startsWith('welcome-')) {
              const prefixedId = `welcome-${media.id}`
              console.log(`Trying prefixed ID for welcome media: ${prefixedId}`)
              storedMedia = await storage.getMedia(prefixedId)
            }
            
            if (storedMedia && storedMedia.blob) {
              media.blob = storedMedia.blob
              mediaLoaded++
              console.log(`Loaded welcome media: ${media.id}`)
            } else {
              console.warn(`No blob found for welcome media: ${media.id}`)
              mediaFailed++
            }
          } catch (error) {
            console.error(`Failed to load welcome media ${media.id}:`, error)
            mediaFailed++
          }
        }
      }
      
      // Process welcome page audio
      if (content.welcome.audioFile) {
        try {
          // Use numeric ID system - welcome page is index 0
          const audioId = generateMediaId('audio', getPageIndex('welcome'))
          
          const storedAudio = await storage.getMedia(audioId)
          
          if (storedAudio && storedAudio.blob) {
            content.welcome.audioBlob = storedAudio.blob
            mediaLoaded++
            console.log(`Loaded welcome page audio with ID: ${audioId}`)
          } else {
            console.warn(`No audio blob found for welcome page with ID: ${audioId}`)
            mediaFailed++
          }
        } catch (error) {
          console.error('Failed to load welcome page audio:', error)
          mediaFailed++
        }
      }
      
      // Process welcome page caption
      if (content.welcome.captionFile) {
        try {
          // Use numeric ID system - welcome page is index 0
          const captionId = generateMediaId('caption', getPageIndex('welcome'))
          
          const storedCaption = await storage.getMedia(captionId)
          
          if (storedCaption && storedCaption.blob) {
            content.welcome.captionBlob = storedCaption.blob
            mediaLoaded++
            console.log(`Loaded welcome page caption with ID: ${captionId}`)
          } else {
            console.warn(`No caption blob found for welcome page with ID: ${captionId}`)
            mediaFailed++
          }
        } catch (error) {
          console.error('Failed to load welcome page caption:', error)
          mediaFailed++
        }
      }
      
      // Process objectives page media
      if (content.objectivesPage?.media) {
        for (const media of content.objectivesPage.media) {
          try {
            // Try with the media ID as-is first
            let storedMedia = await storage.getMedia(media.id)
            
            // If not found and the ID doesn't already have a page prefix, try with objectives prefix
            if (!storedMedia && !media.id.startsWith('objectives-')) {
              const prefixedId = `objectives-${media.id}`
              console.log(`Trying prefixed ID for objectives media: ${prefixedId}`)
              storedMedia = await storage.getMedia(prefixedId)
            }
            
            if (storedMedia && storedMedia.blob) {
              media.blob = storedMedia.blob
              mediaLoaded++
              console.log(`Loaded objectives media: ${media.id}`)
            } else {
              console.warn(`No blob found for objectives media: ${media.id}`)
              mediaFailed++
            }
          } catch (error) {
            console.error(`Failed to load objectives media ${media.id}:`, error)
            mediaFailed++
          }
        }
      }
      
      // Process objectives page audio
      if (content.objectivesPage?.audioFile) {
        try {
          // Use numeric ID system - objectives page is index 1
          const audioId = generateMediaId('audio', getPageIndex('objectives'))
          const audioIdVariants = getMediaIdVariants(audioId, 'objectives')
          
          let storedAudio = null
          for (const tryId of audioIdVariants) {
            storedAudio = await storage.getMedia(tryId)
            if (storedAudio && storedAudio.blob) {
              console.log(`Found objectives audio with ID: ${tryId}`)
              break
            }
          }
          
          if (storedAudio && storedAudio.blob) {
            content.objectivesPage.audioBlob = storedAudio.blob
            mediaLoaded++
            console.log(`Loaded objectives page audio with ID: ${audioId}`)
          } else {
            console.warn(`No audio blob found for objectives page with ID: ${audioId}`)
            mediaFailed++
          }
        } catch (error) {
          console.error('Failed to load objectives page audio:', error)
          mediaFailed++
        }
      }
      
      // Process objectives page caption
      if (content.objectivesPage?.captionFile) {
        try {
          // Use numeric ID system - objectives page is index 1
          const captionId = generateMediaId('caption', getPageIndex('objectives'))
          
          const storedCaption = await storage.getMedia(captionId)
          
          if (storedCaption && storedCaption.blob) {
            content.objectivesPage.captionBlob = storedCaption.blob
            mediaLoaded++
            console.log(`Loaded objectives page caption with ID: ${captionId}`)
          } else {
            console.warn(`No caption blob found for objectives page with ID: ${captionId}`)
            mediaFailed++
          }
        } catch (error) {
          console.error('Failed to load objectives page caption:', error)
          mediaFailed++
        }
      }
      
      // Process topics
      for (let topicIndex = 0; topicIndex < content.topics.length; topicIndex++) {
        const topic = content.topics[topicIndex]
        // Process topic media
        if (topic.media) {
          for (const media of topic.media) {
            try {
              // Check if this is a YouTube video (has embedUrl)
              if (media.type === 'video' && media.embedUrl) {
                // YouTube videos don't need blob storage, they use embedUrl
                console.log(`YouTube video detected: ${media.id} for topic: ${topic.title}`)
                mediaLoaded++
                continue
              }
              
              // Try with the media ID as-is first
              let storedMedia = await storage.getMedia(media.id)
              
              // If not found and the ID doesn't already have a topic prefix, try with topic prefix
              if (!storedMedia && !media.id.startsWith(topic.id + '-')) {
                const prefixedId = `${topic.id}-${media.id}`
                console.log(`Trying prefixed ID for topic media: ${prefixedId}`)
                storedMedia = await storage.getMedia(prefixedId)
              }
              
              if (storedMedia && storedMedia.blob) {
                // Check if this is video metadata stored as JSON
                if (storedMedia.blob.type === 'application/json' && media.type === 'video') {
                  try {
                    const text = await storedMedia.blob.text()
                    const metadata = JSON.parse(text)
                    if (metadata.embedUrl) {
                      media.embedUrl = metadata.embedUrl
                      media.url = metadata.url
                      console.log(`Loaded video metadata: ${media.id} for topic: ${topic.title}`)
                      mediaLoaded++
                      continue
                    }
                  } catch (e) {
                    console.error('Failed to parse video metadata:', e)
                  }
                }
                
                media.blob = storedMedia.blob
                mediaLoaded++
                console.log(`Loaded topic media: ${media.id} for topic: ${topic.title}`)
              } else {
                // Try to get all media for the topic as a fallback
                console.warn(`No blob found for topic media: ${media.id}, trying topic-based lookup`)
                const topicMedia = await storage.getMediaForTopic(topic.id)
                const matchingMedia = topicMedia.find(m => m.id === media.id || m.id === `${topic.id}-${media.id}`)
                if (matchingMedia && matchingMedia.blob) {
                  media.blob = matchingMedia.blob
                  mediaLoaded++
                  console.log(`Loaded topic media via topic lookup: ${media.id} for topic: ${topic.title}`)
                } else {
                  console.warn(`Still no blob found for topic media: ${media.id}`)
                  mediaFailed++
                }
              }
            } catch (error) {
              console.error(`Failed to load topic media ${media.id}:`, error)
              mediaFailed++
            }
          }
        }
        
        // Process audio files
        if (topic.audioFile) {
          try {
            // Use numeric ID system - topics start at index 2
            const audioId = generateMediaId('audio', getPageIndex('topic', topicIndex))
            
            const storedAudio = await storage.getMedia(audioId)
            if (storedAudio && storedAudio.blob) {
              topic.audioBlob = storedAudio.blob
              mediaLoaded++
              console.log(`Loaded audio for topic: ${topic.title} with ID: ${audioId}`)
            } else {
              console.warn(`No audio found for topic: ${topic.title} with ID: ${audioId}`)
              mediaFailed++
            }
          } catch (error) {
            console.error(`Failed to load audio for topic: ${topic.title}:`, error)
            mediaFailed++
          }
        }
        
        // Process caption files
        if (topic.captionFile) {
          try {
            // Use numeric ID system - topics start at index 2
            const captionId = generateMediaId('caption', getPageIndex('topic', topicIndex))
            
            const storedCaption = await storage.getMedia(captionId)
            if (storedCaption && storedCaption.blob) {
              topic.captionBlob = storedCaption.blob
              mediaLoaded++
              console.log(`Loaded caption for topic: ${topic.title} with ID: ${captionId}`)
            } else {
              console.warn(`No caption found for topic: ${topic.title} with ID: ${captionId}`)
              mediaFailed++
            }
          } catch (error) {
            console.error(`Failed to load caption for topic: ${topic.title}:`, error)
            mediaFailed++
          }
        }
      }
      
      console.log(`Media loading complete: ${mediaLoaded} loaded, ${mediaFailed} failed`)
      
      // Return loading statistics for user notification
      return { mediaLoaded, mediaFailed }
    } catch (error) {
      console.error('Error enhancing content with storage media:', error)
      // Continue even if some media fails to load
      return { mediaLoaded: 0, mediaFailed: 0 }
    }
  }

  const generatePackage = async () => {
    setIsGenerating(true)
    
    try {
      // Convert metadata to proper format using course seed data
      const courseMetadata: CourseMetadata = {
        title: normalizedCourseSeedData?.courseTitle || '',
        identifier: `course-${Date.now()}`,
        description: normalizedCourseSeedData?.courseDescription || '',
        version: version,
        scormVersion: '1.2',
        duration: normalizedCourseSeedData?.duration || 30, // Default duration
        passMark: 80  // Default pass mark
      }
      
      // Convert course content to enhanced format
      const enhancedContent = convertToEnhancedCourseContent(courseContent, courseMetadata)
      
      // If storage is available, enhance content with media blobs from storage
      let mediaStats = { mediaLoaded: 0, mediaFailed: 0 }
      if (storage) {
        console.log('Storage available, loading media from PersistentStorage...')
        mediaStats = await enhanceContentWithStorageMedia(enhancedContent, storage)
        
        // Notify user about media loading results
        if (mediaStats.mediaFailed > 0) {
          setWarning(`Warning: ${mediaStats.mediaFailed} media file(s) could not be loaded. The SCORM package will be generated but may be missing some media.`)
        } else if (mediaStats.mediaLoaded > 0) {
          console.log(`Successfully loaded ${mediaStats.mediaLoaded} media file(s) from storage`)
        }
      } else {
        console.warn('Storage not available, media files may not be included in SCORM package')
      }
      
      // Generate SCORM package based on selected version
      let buffer: Uint8Array
      // For now, use SCORM 1.2 for both versions until we have a proper SCORM 2004 generator
      const result = await generateSpaceEfficientSCORM12Buffer(enhancedContent, storage)
      buffer = result.buffer
      
      if (isTauriEnvironment) {
        // Show save dialog
        const filePath = await save({
          defaultPath: `${courseSeedData.courseTitle.replace(/[^a-zA-Z0-9]/g, '_')}.zip`,
          filters: [{
            name: 'SCORM Package',
            extensions: ['zip']
          }]
        })
        
        if (filePath) {
          // Write the buffer to file using Tauri's file system API
          await writeFile(filePath, buffer)
          setPackageGenerated(true)
        }
      } else {
        // Browser fallback - download the file
        const blob = new Blob([buffer], { type: 'application/zip' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${courseSeedData.courseTitle.replace(/[^a-zA-Z0-9]/g, '_')}.zip`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setPackageGenerated(true)
      }
    } catch (error) {
      console.error('Error generating SCORM package:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Check for common Tauri-related errors
      if (errorMessage.includes('invoke') || errorMessage.includes('Tauri')) {
        setError('Error generating SCORM package: The application needs to be run in a Tauri environment. Please ensure you are running the desktop application.')
      } else {
        setError(`Error generating SCORM package: ${errorMessage}`)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  // Early return with error message if missing required data
  if (!courseContent || !normalizedCourseSeedData) {
    return (
      <PageLayout
        currentStep={6}
        title="SCORM Package Builder"
        description="Configure your SCORM package settings and generate the final course package."
        isGenerating={false}
        onSettingsClick={onSettingsClick}
        onBack={onBack}
        onGenerateSCORM={generatePackage}
        onSave={onSave}
        onSaveAs={onSaveAs}
        onOpen={onOpen}
        onHelp={onHelp}
        onStepClick={onStepClick}
        autoSaveIndicator={<AutoSaveIndicatorConnected />}
      >
        <Section>
          <Card>
            <DesignAlert variant="error">
              Unable to load course data. Please go back and ensure all required information is filled out.
            </DesignAlert>
          </Card>
        </Section>
      </PageLayout>
    )
  }

  const coursePreviewElement = (
    <CoursePreview 
      courseContent={courseContent} 
      courseSeedData={normalizedCourseSeedData}
    />
  )

  return (
    <PageLayout
      currentStep={6}
      title="SCORM Package Builder"
      description="Configure your SCORM package settings and generate the final course package."
      coursePreview={coursePreviewElement}
      isGenerating={isGenerating}
      onSettingsClick={onSettingsClick}
      onBack={onBack}
      onGenerateSCORM={generatePackage}
      onSave={onSave}
      onSaveAs={onSaveAs}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={onStepClick}
      onExport={() => setShowExportModal(true)}
      onImport={() => setShowImportModal(true)}
      autoSaveIndicator={<AutoSaveIndicatorConnected />}
    >
      {/* Error alert */}
      {error && (
        <Section>
          <DesignAlert variant="error">
            {error}
          </DesignAlert>
        </Section>
      )}
      
      {/* Warning alert */}
      {warning && (
        <Section>
          <DesignAlert variant="info">
            {warning}
          </DesignAlert>
        </Section>
      )}
      
      {/* Course Information Summary */}
      <Section>
        <Card title="Course Information">
          <Grid cols={1} gap="medium">
            <div style={{
              backgroundColor: '#18181b',
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: '0.5rem',
              padding: '1rem'
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ color: '#71717a', fontSize: '0.875rem' }}>Title: </span>
                <span style={{ color: '#e4e4e7', fontSize: '0.875rem', fontWeight: 500 }}>
                  {normalizedCourseSeedData.courseTitle}
                </span>
              </div>
              {normalizedCourseSeedData.courseDescription && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ color: '#71717a', fontSize: '0.875rem' }}>Description: </span>
                  <span style={{ color: '#e4e4e7', fontSize: '0.875rem' }}>
                    {normalizedCourseSeedData.courseDescription}
                  </span>
                </div>
              )}
              {normalizedCourseSeedData.duration && (
                <div>
                  <span style={{ color: '#71717a', fontSize: '0.875rem' }}>Duration: </span>
                  <span style={{ color: '#e4e4e7', fontSize: '0.875rem' }}>
                    {normalizedCourseSeedData.duration} minutes
                  </span>
                </div>
              )}
            </div>
          </Grid>
        </Card>
      </Section>

      {/* Package Settings */}
      <Section>
        <Card title="Package Settings">
          <Grid cols={1} gap="large">
            <div>
              <Input
                id="course-version"
                label="Course Version"
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g., 1.0"
                fullWidth
              />
            </div>
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#e4e4e7'
              }}>
                SCORM Version
              </label>
              <div style={{ 
                backgroundColor: '#18181b',
                border: `1px solid ${tokens.colors.border.default}`,
                borderRadius: '0.375rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                color: '#e4e4e7'
              }}>
                SCORM 1.2
              </div>
              <p style={{ 
                marginTop: '0.5rem', 
                fontSize: '0.75rem', 
                color: '#71717a' 
              }}>
                SCORM 1.2 provides broader compatibility with older LMS platforms.
              </p>
            </div>
          </Grid>
        </Card>
      </Section>

      {/* Package Generation Status */}
      {(packageGenerated || !isTauriEnvironment) && (
        <Section>
          <Card>
            {!isTauriEnvironment && (
              <Alert type="info" style={{ marginBottom: packageGenerated ? '1rem' : 0 }}>
                ℹ️ Running in browser mode. The SCORM package will be downloaded directly to your Downloads folder.
              </Alert>
            )}
            
            {packageGenerated && (
              <Alert type="success">
                ✓ Package generated successfully!
              </Alert>
            )}
          </Card>
        </Section>
      )}

      {/* Info Box */}
      <Section>
        <Card title="What's in your SCORM package?">
          <Alert type="info">
            <ul style={{
              margin: 0,
              paddingLeft: '1rem',
              display: 'grid',
              gap: '0.5rem'
            }}>
              <li>All course content and activities</li>
              <li>SCORM 1.2 compliant manifest</li>
              <li>Progress tracking capabilities</li>
              <li>Quiz results and scoring</li>
              <li>Media assets (images and videos)</li>
              <li>Audio narration files</li>
            </ul>
          </Alert>
        </Card>
      </Section>

      {/* Export Modal */}
      {showExportModal && (
        <Modal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          title="Export Project"
        >
          <div style={{ padding: '1rem' }}>
            <p style={{ marginBottom: '1rem' }}>
              Export your project data to share with others or create a backup.
            </p>
            <ProjectExportButton
              projectData={{
                metadata: {
                  version: '1.0',
                  exportDate: new Date().toISOString(),
                  projectName: normalizedCourseSeedData.courseTitle
                },
                courseData: {
                  title: normalizedCourseSeedData.courseTitle,
                  language: 'en',
                  keywords: [],
                  topics: courseContent.topics.map(topic => ({
                    title: topic.title,
                    content: topic.content,
                    media: topic.media?.map(m => ({
                      id: m.id,
                      type: m.type as 'image' | 'audio' | 'youtube',
                      url: m.url,
                      name: m.title,
                      filename: m.title
                    }))
                  }))
                },
                media: {
                  images: [],
                  audio: [],
                  captions: []
                }
              }}
              onExport={(result) => {
                if (result.success) {
                  setShowExportModal(false)
                }
              }}
              buttonText="Export Project Data"
            />
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <Modal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="Import Project"
        >
          <div style={{ padding: '1rem' }}>
            <p style={{ marginBottom: '1rem' }}>
              Import a previously exported project file to continue working on it.
            </p>
            <ProjectImportButton
              onImport={(result) => {
                if (result.success) {
                  // Handle successful import
                  console.log('Project imported:', result.data)
                  setShowImportModal(false)
                  // You would typically update the application state here
                }
              }}
              buttonText="Choose Project File"
              showConfirmation={true}
            />
          </div>
        </Modal>
      )}
    </PageLayout>
  )
}