import React, { useState, useEffect, useMemo } from 'react'
import { Button, Modal } from './DesignSystem'
import { tokens } from './DesignSystem/designTokens'
import type { CourseContent } from '../types/aiPrompt'
import type { CourseSeedData } from '../types/course'
import type { CourseMetadata } from '../types/metadata'
import { convertToEnhancedCourseContent } from '../services/courseContentConverter'
import { generatePreviewHTML } from '../services/previewGenerator'
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor'
import { useStorage } from '../contexts/PersistentStorageContext'
import { blobUrlManager } from '../utils/blobUrlManager'

interface CoursePreviewAccurateProps {
  courseContent?: CourseContent | null
  courseSeedData: CourseSeedData | Partial<CourseSeedData>
  currentStep?: string
}

type DeviceType = 'desktop' | 'tablet' | 'mobile'

const DEVICE_SIZES: Record<DeviceType, { width: string; height: string }> = {
  desktop: { width: '100%', height: '100%' },
  tablet: { width: '768px', height: '1024px' },
  mobile: { width: '375px', height: '667px' }
}

export const CoursePreviewAccurate: React.FC<CoursePreviewAccurateProps> = ({
  courseContent,
  courseSeedData,
  currentStep = 'seed'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>('desktop')
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [loading, setLoading] = useState(false)
  
  const { measureAsync } = usePerformanceMonitor({
    componentName: 'CoursePreviewAccurate',
    trackRenders: false
  })
  
  const storage = useStorage()

  // Define helper functions first to avoid initialization errors
  const removeMediaFromContent = (content: any) => {
    // Remove media from all sections
    if (content.welcome) {
      content.welcome.media = []
      delete content.welcome.imageUrl
      delete content.welcome.embedUrl
    }
    if (content.objectivesPage) {
      content.objectivesPage.media = []
      delete content.objectivesPage.imageUrl
      delete content.objectivesPage.embedUrl
    }
    content.topics.forEach((topic: any) => {
      topic.media = []
      delete topic.imageUrl
      delete topic.embedUrl
    })
  }

  const removeAudioFromContent = (content: any) => {
    // Remove audio from all sections
    if (content.welcome) {
      delete content.welcome.audioFile
      delete content.welcome.audioBlob
      delete content.welcome.captionFile
      delete content.welcome.captionBlob
    }
    if (content.objectivesPage) {
      delete content.objectivesPage.audioFile
      delete content.objectivesPage.audioBlob
      delete content.objectivesPage.captionFile
      delete content.objectivesPage.captionBlob
    }
    content.topics.forEach((topic: any) => {
      delete topic.audioFile
      delete topic.audioBlob
      delete topic.captionFile
      delete topic.captionBlob
    })
  }

  const processContentForPreview = async (content: any, step: string) => {
    // Clone the content to avoid modifying original
    const processed = JSON.parse(JSON.stringify(content))
    
    // Based on current step, remove content that wouldn't be available yet
    switch (step) {
      case 'json':
        // At JSON step, we have topics but no media/audio
        removeMediaFromContent(processed)
        removeAudioFromContent(processed)
        break
      case 'media':
        // At media step, we have media but no audio
        removeAudioFromContent(processed)
        // Load media blob URLs
        await loadMediaUrls(processed)
        break
      case 'audio':
      case 'activities':
      case 'scorm':
        // At audio step and beyond, we have everything including assessment questions
        // Load both media and audio/caption URLs
        await loadMediaUrls(processed)
        await loadAudioUrls(processed)
        break
      // activities and scorm steps have everything
    }
    
    return processed
  }
  
  const loadMediaUrls = async (content: any) => {
    if (!storage || !storage.isInitialized) return
    
    // Load welcome page media
    if (content.welcome?.media) {
      for (const media of content.welcome.media) {
        if (media.storageId && !media.url) {
          try {
            const mediaData = await storage.getMedia(media.storageId)
            if (mediaData?.blob) {
              const url = blobUrlManager.getOrCreateUrl(`preview-${media.storageId}`, mediaData.blob)
              media.url = url
            }
          } catch (error) {
            console.error('Error loading media:', error)
          }
        }
      }
    }
    
    // Load objectives page media
    if (content.objectivesPage?.media) {
      for (const media of content.objectivesPage.media) {
        if (media.storageId && !media.url) {
          try {
            const mediaData = await storage.getMedia(media.storageId)
            if (mediaData?.blob) {
              const url = blobUrlManager.getOrCreateUrl(`preview-${media.storageId}`, mediaData.blob)
              media.url = url
            }
          } catch (error) {
            console.error('Error loading media:', error)
          }
        }
      }
    }
    
    // Load topic media
    if (content.topics) {
      for (const topic of content.topics) {
        if (topic.media) {
          for (const media of topic.media) {
            if (media.storageId && !media.url) {
              try {
                const mediaData = await storage.getMedia(media.storageId)
                if (mediaData?.blob) {
                  const url = blobUrlManager.getOrCreateUrl(`preview-${media.storageId}`, mediaData.blob)
                  media.url = url
                }
              } catch (error) {
                console.error('Error loading media:', error)
              }
            }
          }
        }
      }
    }
  }
  
  const loadAudioUrls = async (content: any) => {
    if (!storage || !storage.isInitialized) return
    
    // Helper to load audio and caption for a section
    const loadSectionAudio = async (section: any, prefix: string) => {
      if (section.audioFile && !section.audioUrl) {
        try {
          // For audio, we need to get media by ID pattern
          // Audio files are named like 0000-welcome.mp3, and stored as audio-0, audio-1, etc.
          let audioId: string | null = null
          
          if (prefix === 'welcome') {
            audioId = 'audio-0'
          } else if (prefix === 'objectives') {
            audioId = 'audio-1'
          } else if (prefix.startsWith('topic-')) {
            const topicIndex = parseInt(prefix.replace('topic-', ''))
            audioId = `audio-${topicIndex + 2}` // Topics start at audio-2
          }
          
          if (audioId) {
            const audioMedia = await storage.getMedia(audioId)
            if (audioMedia?.blob) {
              const url = blobUrlManager.getOrCreateUrl(`preview-${audioId}`, audioMedia.blob)
              section.audioUrl = url
            }
          }
        } catch (error) {
          console.error('Error loading audio:', error)
        }
      }
      
      if (section.captionFile && !section.captionUrl) {
        try {
          // For captions, we need to get media by ID pattern
          // Caption files are named like 0000-welcome.vtt, and stored as caption-0, caption-1, etc.
          let captionId: string | null = null
          
          if (prefix === 'welcome') {
            captionId = 'caption-0'
          } else if (prefix === 'objectives') {
            captionId = 'caption-1'
          } else if (prefix.startsWith('topic-')) {
            const topicIndex = parseInt(prefix.replace('topic-', ''))
            captionId = `caption-${topicIndex + 2}` // Topics start at caption-2
          }
          
          if (captionId) {
            const captionMedia = await storage.getMedia(captionId)
            if (captionMedia?.blob) {
              const url = blobUrlManager.getOrCreateUrl(`preview-${captionId}`, captionMedia.blob)
              section.captionUrl = url
            }
          }
        } catch (error) {
          console.error('Error loading caption:', error)
        }
      }
    }
    
    // Load welcome audio/captions
    if (content.welcome) {
      await loadSectionAudio(content.welcome, 'welcome')
    }
    
    // Load objectives audio/captions
    if (content.objectivesPage) {
      await loadSectionAudio(content.objectivesPage, 'objectives')
    }
    
    // Load topic audio/captions
    if (content.topics) {
      for (let i = 0; i < content.topics.length; i++) {
        await loadSectionAudio(content.topics[i], `topic-${i}`)
      }
    }
  }

  const buildEnhancedContent = async () => {
    // For early steps, we don't have enough content to preview
    if (!courseContent || currentStep === 'seed' || currentStep === 'prompt') {
      return null
    }

    // Create course metadata
    const courseMetadata: CourseMetadata = {
      title: courseSeedData?.courseTitle || 'Untitled Course',
      identifier: `course-preview-${Date.now()}`,
      description: '',
      version: '1.0',
      scormVersion: '1.2',
      duration: 30,
      passMark: 80
    }

    try {
      // Use the same converter that SCORM generator uses
      const enhancedContent = convertToEnhancedCourseContent(courseContent, courseMetadata)
      
      // For preview, we need to handle missing media gracefully
      // Convert blob URLs to data URLs for preview
      return await processContentForPreview(enhancedContent, currentStep)
    } catch (error) {
      console.error('Failed to convert content:', error)
      return null
    }
  }

  const generatePlaceholderHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 40px;
            background: #f5f5f5;
            color: #333;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            text-align: center;
          }
          .placeholder {
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            max-width: 500px;
          }
          h2 {
            color: #241f20;
            margin-bottom: 16px;
          }
          p {
            color: #666;
            line-height: 1.5;
          }
          .course-title {
            color: #8fbb40;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="placeholder">
          <div class="course-title">${courseSeedData?.courseTitle || 'Course Preview'}</div>
          <h2>Preview Not Available Yet</h2>
          <p>
            ${currentStep === 'seed' ? 
              'Complete the course setup to see a preview of your course.' :
              'Generate the course content to see a preview of your course.'
            }
          </p>
          <p style="margin-top: 20px; font-size: 14px; color: #999;">
            Current step: ${currentStep}
          </p>
        </div>
      </body>
      </html>
    `
  }

  const generatePreview = async () => {
    setLoading(true)
    try {
      await measureAsync('generatePreviewHTML', async () => {
        // Build enhanced content based on what's available at current step
        const enhancedContent = await buildEnhancedContent()
        
        if (enhancedContent) {
          // Generate the exact same HTML that SCORM generator would create
          const html = await generatePreviewHTML(enhancedContent)
          setPreviewHtml(html)
        } else {
          // Show placeholder for early steps
          setPreviewHtml(generatePlaceholderHTML())
        }
      })
    } catch (error) {
      console.error('Failed to generate preview:', error)
      setPreviewHtml('<div style="padding: 20px;">Failed to generate preview</div>')
    } finally {
      setLoading(false)
    }
  }

  // Generate preview HTML when modal opens or content changes
  useEffect(() => {
    if (isOpen) {
      generatePreview()
    }
  }, [isOpen, courseContent, courseSeedData, currentStep])

  const previewUrl = useMemo(() => {
    if (!previewHtml) return null
    const blob = new Blob([previewHtml], { type: 'text/html' })
    return URL.createObjectURL(blob)
  }, [previewHtml])

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setIsOpen(true)}
        style={{ marginRight: tokens.spacing.md }}
      >
        Preview Course
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Course Preview"
        size="xlarge"
        data-testid="course-preview-modal"
      >
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '80vh',
          gap: tokens.spacing.lg
        }}>
          {/* Device selector */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `0 ${tokens.spacing.md}`,
            borderBottom: `1px solid ${tokens.colors.border.light}`,
            paddingBottom: tokens.spacing.md
          }}>
            <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
              {(['desktop', 'tablet', 'mobile'] as DeviceType[]).map(device => (
                <Button
                  key={device}
                  variant={selectedDevice === device ? 'primary' : 'tertiary'}
                  size="small"
                  onClick={() => setSelectedDevice(device)}
                >
                  {device.charAt(0).toUpperCase() + device.slice(1)}
                </Button>
              ))}
            </div>
            <div style={{ 
              fontSize: tokens.typography.fontSize.sm, 
              color: tokens.colors.text.secondary 
            }}>
              {currentStep === 'seed' || currentStep === 'prompt' ? 
                'Limited preview - complete content generation for full preview' :
                `Showing content available at "${currentStep}" step`
              }
            </div>
          </div>

          {/* Preview content */}
          <div style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: tokens.colors.background.tertiary,
            borderRadius: tokens.borderRadius.lg,
            padding: tokens.spacing.xl,
            overflow: 'hidden'
          }}>
            <div style={{
              width: DEVICE_SIZES[selectedDevice].width,
              height: DEVICE_SIZES[selectedDevice].height,
              maxWidth: '100%',
              maxHeight: '100%',
              boxShadow: selectedDevice !== 'desktop' 
                ? `0 10px 40px rgba(0, 0, 0, 0.15)` 
                : 'none',
              borderRadius: selectedDevice !== 'desktop' 
                ? tokens.borderRadius.md 
                : 0,
              overflow: 'hidden',
              backgroundColor: 'white',
              transition: 'all 0.3s ease',
              position: 'relative'
            }}>
              {loading ? (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)'
                }}>
                  <div>Generating preview...</div>
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  title="Course Preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  sandbox="allow-scripts allow-forms allow-popups allow-modals"
                />
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: tokens.colors.text.tertiary
                }}>
                  No preview available
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: tokens.spacing.lg,
            padding: `0 ${tokens.spacing.md}`,
            borderTop: `1px solid ${tokens.colors.border.light}`,
            paddingTop: tokens.spacing.xl
          }}>
            <Button
              variant="tertiary"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}