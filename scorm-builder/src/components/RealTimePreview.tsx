import { useState, useEffect, useRef } from 'react'
import { useStorage } from '../contexts/PersistentStorageContext'
import { generatePreviewHTML } from '../services/previewGenerator'
import { LoadingSpinner } from './DesignSystem/LoadingSpinner'
import { Button } from './DesignSystem/Button'
import { Alert } from './DesignSystem/Alert'

interface RealTimePreviewProps {
  embedded?: boolean // When true, preview is embedded in modal
}

export function RealTimePreview({ embedded = false }: RealTimePreviewProps = {}) {
  const storage = useStorage()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  useEffect(() => {
    generatePreview()
  }, [storage.currentProjectId])
  
  async function generatePreview() {
    if (!storage.isInitialized || !storage.currentProjectId) {
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      
      // Get course metadata
      const metadata = await storage.getCourseMetadata()
      if (!metadata) {
        setPreviewUrl(null)
        setLoading(false)
        return
      }
      
      // Build course content from stored data
      const courseContent = {
        title: metadata.title || 'Untitled Course',
        duration: metadata.duration || 30,
        passMark: metadata.passMark || 80,
        navigationMode: 'linear' as const,
        allowRetake: true,
        welcome: {
          title: 'Welcome',
          content: metadata.welcomeContent || 'Welcome to the course',
          startButtonText: 'Start Course',
          media: [] as any[]
        },
        objectives: metadata.objectives || [],
        learningObjectivesPage: {
          title: 'Learning Objectives',
          content: metadata.objectivesContent || '',
          media: [] as any[]
        },
        topics: [],
        assessment: { questions: [] }
      }
      
      // Load media for welcome page
      const welcomeMedia = await storage.getMediaForTopic('welcome')
      for (const media of welcomeMedia) {
        if (media.mediaType === 'image') {
          courseContent.welcome.media.push({
            id: media.id,
            type: 'image',
            title: media.metadata?.title || 'Image',
            url: URL.createObjectURL(media.blob),
            blob: media.blob
          })
        } else if (media.mediaType === 'audio') {
          (courseContent.welcome as any).audioFile = media.metadata?.fileName || 'welcome-audio.mp3'
          ;(courseContent.welcome as any).audioBlob = media.blob
          ;(courseContent.welcome as any).audioUrl = URL.createObjectURL(media.blob)
        } else if (media.mediaType === 'caption' || (media.mediaType === 'video' && media.metadata?.isCaption)) {
          (courseContent.welcome as any).captionFile = media.metadata?.fileName || 'welcome-captions.vtt'
          ;(courseContent.welcome as any).captionBlob = media.blob
          ;(courseContent.welcome as any).captionUrl = URL.createObjectURL(media.blob)
        }
      }
      
      // Load media for objectives page
      const objectivesMedia = await storage.getMediaForTopic('objectives')
      for (const media of objectivesMedia) {
        if (media.mediaType === 'image') {
          (courseContent.learningObjectivesPage as any).media.push({
            id: media.id,
            type: 'image',
            title: media.metadata?.title || 'Image',
            url: URL.createObjectURL(media.blob),
            blob: media.blob
          })
        } else if (media.mediaType === 'audio') {
          (courseContent.learningObjectivesPage as any).audioFile = media.metadata?.fileName || 'objectives-audio.mp3'
          ;(courseContent.learningObjectivesPage as any).audioBlob = media.blob
          ;(courseContent.learningObjectivesPage as any).audioUrl = URL.createObjectURL(media.blob)
        } else if (media.mediaType === 'caption' || (media.mediaType === 'video' && media.metadata?.isCaption)) {
          (courseContent.learningObjectivesPage as any).captionFile = media.metadata?.fileName || 'objectives-captions.vtt'
          ;(courseContent.learningObjectivesPage as any).captionBlob = media.blob
          ;(courseContent.learningObjectivesPage as any).captionUrl = URL.createObjectURL(media.blob)
        }
      }
      
      // Load topics with their content and media
      if (metadata.topics) {
        for (const topicId of metadata.topics) {
          const topicContent = await storage.getContent(topicId)
          if (topicContent) {
            const topic = {
              id: topicId,
              title: topicContent.title || 'Untitled Topic',
              content: topicContent.content || '',
              media: [] as any[],
              audioFile: undefined as string | undefined,
              audioBlob: undefined as Blob | undefined,
              captionFile: undefined as string | undefined,
              captionBlob: undefined as Blob | undefined,
              knowledgeCheck: topicContent.knowledgeCheck
            }
            
            // Load media for this topic
            const topicMedia = await storage.getMediaForTopic(topicId)
            for (const media of topicMedia) {
              if (media.mediaType === 'image') {
                topic.media.push({
                  id: media.id,
                  type: 'image',
                  title: media.metadata?.title || 'Image',
                  url: URL.createObjectURL(media.blob),
                  blob: media.blob
                })
              } else if (media.mediaType === 'audio') {
                topic.audioFile = media.metadata?.fileName || `${topicId}-audio.mp3`
                topic.audioBlob = media.blob
                ;(topic as any).audioUrl = URL.createObjectURL(media.blob)
              } else if (media.mediaType === 'caption' || (media.mediaType === 'video' && media.metadata?.isCaption)) {
                topic.captionFile = media.metadata?.fileName || `${topicId}-captions.vtt`
                topic.captionBlob = media.blob
                ;(topic as any).captionUrl = URL.createObjectURL(media.blob)
              }
            }
            
            (courseContent.topics as any[]).push(topic)
          }
        }
      }
      
      // Load assessment data
      const assessmentData = await storage.getContent('assessment')
      if (assessmentData && assessmentData.assessment) {
        courseContent.assessment = assessmentData.assessment
      }
      
      // Generate preview HTML
      const previewHTML = await generatePreviewHTML(courseContent)
      
      // Create blob URL for preview
      const blob = new Blob([previewHTML], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      
      // Revoke old URL if exists
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      
      setPreviewUrl(url)
    } catch (err) {
      console.error('Failed to generate preview:', err)
      setError('Failed to generate preview')
    } finally {
      setLoading(false)
    }
  }
  
  function handleRefresh() {
    generatePreview()
  }
  
  if (!storage.currentProjectId) {
    return (
      <div className="preview-container">
        <div className="empty-state">
          <h3>No content to preview</h3>
          <p>Start adding content to see the preview</p>
        </div>
      </div>
    )
  }
  
  if (loading) {
    return (
      <div className="preview-container">
        <LoadingSpinner />
        <p>Generating preview...</p>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="preview-container">
        <Alert variant="error">
          <p>{error}</p>
          <Button variant="secondary" onClick={handleRefresh}>
            Try again
          </Button>
        </Alert>
      </div>
    )
  }
  
  return (
    <div className="preview-container">
      <div className="preview-header">
        <h3>Course Preview</h3>
        <Button
          variant="secondary"
          size="small"
          onClick={handleRefresh}
          aria-label="Refresh preview"
        >
          🔄 Refresh
        </Button>
      </div>
      
      {previewUrl ? (
        <div className="preview-frame-container">
          <iframe
            ref={iframeRef}
            src={previewUrl}
            title="Course Preview"
            className="preview-frame"
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
          />
        </div>
      ) : (
        <div className="empty-state">
          <h3>No content to preview</h3>
          <p>Start adding content to see the preview</p>
        </div>
      )}
      
      <style>{`
        .preview-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: ${embedded ? 'transparent' : '#f8f9fa'};
        }
        
        .preview-header {
          display: ${embedded ? 'none' : 'flex'};
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: white;
          border-bottom: 1px solid #e9ecef;
        }
        
        .preview-header h3 {
          margin: 0;
          font-size: 1.125rem;
          color: #241f20;
        }
        
        .preview-frame-container {
          flex: 1;
          padding: ${embedded ? '0' : '1rem'};
          min-height: 0;
        }
        
        .preview-frame {
          width: 100%;
          height: 100%;
          border: ${embedded ? 'none' : '1px solid #e9ecef'};
          border-radius: ${embedded ? '0' : '4px'};
          background: white;
        }
        
        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2rem;
        }
        
        .empty-state h3 {
          margin: 0 0 0.5rem 0;
          color: #241f20;
        }
        
        .empty-state p {
          margin: 0;
          color: #5d6771;
        }
      `}</style>
    </div>
  )
}