import React, { useState } from 'react'
import { CourseContent } from '../types/aiPrompt'
import type { CourseMetadata } from '../types/metadata'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { loadCourseContentConverter, loadSCORMGenerator } from '../utils/dynamicImports'
import { useStorage } from '../contexts/PersistentStorageContext'

import { PageLayout } from './PageLayout'
import { CoursePreviewAccurate } from './CoursePreviewAccurate'
import { ProjectExportButton, ProjectImportButton } from './ProjectExportImport'
import { 
  Button, 
  Card, 
  Input, 
  Section,
  Flex,
  Grid,
  LoadingSpinner,
  Modal,
  Alert
} from './DesignSystem'
import './DesignSystem/designSystem.css'

import type { CourseSeedData as FullCourseSeedData } from '../types/course'

interface CourseSeedData extends Partial<FullCourseSeedData> {
  courseTitle: string
  courseDescription?: string
  audienceDescription?: string
  duration?: number
  difficulty?: number
}

interface SCORMPackageBuilderProps {
  courseContent: CourseContent
  courseSeedData: CourseSeedData
  onNext: () => void
  onBack: () => void
  onSettingsClick?: () => void
  onSave?: () => void
  onOpen?: () => void
  onHelp?: () => void
  onStepClick?: (stepIndex: number) => void
}

// Custom Alert component removed - using DesignSystem Alert

export const SCORMPackageBuilder: React.FC<SCORMPackageBuilderProps> = ({ 
  courseContent, 
  courseSeedData,
  onNext: _onNext, 
  onBack: _onBack, 
  onSettingsClick, 
  onSave, 
  onOpen, 
  onHelp,
  onStepClick 
}) => {
  const storage = useStorage()
  const [version, setVersion] = useState('1.0')
  const [isGenerating, setIsGenerating] = useState(false)
  const [packageGenerated, setPackageGenerated] = useState(false)
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generationMessage, setGenerationMessage] = useState('')
  
  const handleStepClick = (step: number) => {
    if (onStepClick) {
      onStepClick(step)
    }
  }
  
  const handleGenerateSCORM = async () => {
    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerationMessage('Loading SCORM generator...')
    setSavedFilePath(null) // Reset previous file path
    
    try {
      console.log('[SCORM Export] Starting SCORM generation...')
      // Dynamic imports with progress updates
      setGenerationProgress(20)
      setGenerationMessage('Loading content converter...')
      const convertToEnhancedCourseContent = await loadCourseContentConverter()
      
      setGenerationProgress(40)
      setGenerationMessage('Converting course content...')
      
      // Convert metadata to proper format using course seed data
      const courseMetadata: CourseMetadata = {
        title: courseSeedData.courseTitle,
        identifier: `course-${Date.now()}`,
        description: courseSeedData.courseDescription || '',
        version: version,
        scormVersion: '1.2',
        duration: courseSeedData.duration || 30,
        passMark: 80
      }
      
      // Convert course content to enhanced format
      const enhancedContent = convertToEnhancedCourseContent(courseContent, courseMetadata)
      
      // Add title to the enhanced content if not already present
      if (!enhancedContent.title) {
        enhancedContent.title = courseSeedData.courseTitle
      }
      
      setGenerationProgress(60)
      setGenerationMessage('Loading SCORM package generator...')
      
      // Dynamically load SCORM generator
      const generateSCORM = await loadSCORMGenerator('1.2')
      
      // Count media files for better progress feedback
      const mediaCount = courseContent.topics.reduce((count, topic) => {
        let topicCount = 0
        if (topic.audioFile) topicCount++
        if (topic.captionFile) topicCount++
        if (topic.media?.length) topicCount += topic.media.length
        return count + topicCount
      }, 0) + 
      (courseContent.welcomePage?.audioFile ? 1 : 0) +
      (courseContent.welcomePage?.captionFile ? 1 : 0) +
      (courseContent.welcomePage?.media?.length || 0) +
      (courseContent.learningObjectivesPage?.audioFile ? 1 : 0) +
      (courseContent.learningObjectivesPage?.captionFile ? 1 : 0) +
      (courseContent.learningObjectivesPage?.media?.length || 0)
      
      const estimatedTime = Math.round(120 + (mediaCount * 4))
      
      setGenerationProgress(80)
      setGenerationMessage(`Generating SCORM package (${mediaCount} media files, ~${estimatedTime}s)...`)
      
      // Generate SCORM package with all required parameters
      console.log('[SCORM Export] Calling generateSCORM with projectId:', storage?.currentProjectId)
      const projectId = storage?.currentProjectId || 'default-project'
      
      // Create progress callback that updates UI
      const onProgressCallback = (message: string, progress: number) => {
        console.log('[SCORM Export] Progress:', message, progress)
        setGenerationMessage(message)
        setGenerationProgress(progress)
      }
      
      const result = await generateSCORM(enhancedContent, projectId, onProgressCallback)
      console.log('[SCORM Export] Generated result type:', typeof result, 'length:', result?.length)
      // generateRustSCORM returns the buffer directly as a Uint8Array
      const buffer = result
      
      if (!buffer || buffer.length === 0) {
        throw new Error('SCORM generation returned empty buffer')
      }
      
      setGenerationProgress(90)
      setGenerationMessage('Opening save dialog...')
      
      console.log('[SCORM Export] Opening save dialog with buffer size:', buffer.length)
      console.log('[SCORM Export] Window.__TAURI__ exists:', typeof window !== 'undefined' && '__TAURI__' in window)
      console.log('[SCORM Export] Save function exists:', typeof save === 'function')
      
      // Show save dialog - this is a Tauri app, always use native dialog
      let filePath: string | null = null
      try {
        // Check if we're in Tauri environment
        if (typeof window === 'undefined' || !('__TAURI__' in window)) {
          throw new Error('Not running in Tauri environment. Save dialog requires Tauri.')
        }
        
        console.log('[SCORM Export] Calling save() with:', {
          defaultPath: `${courseSeedData.courseTitle.replace(/[^a-zA-Z0-9]/g, '_')}.zip`,
          filters: [{
            name: 'SCORM Package',
            extensions: ['zip']
          }]
        })
        
        // Ensure the save function is available
        if (typeof save !== 'function') {
          throw new Error('Save dialog function not available. Check @tauri-apps/plugin-dialog import.')
        }
        
        filePath = await save({
          defaultPath: `${courseSeedData.courseTitle.replace(/[^a-zA-Z0-9]/g, '_')}.zip`,
          filters: [{
            name: 'SCORM Package',
            extensions: ['zip']
          }]
        })
        
        console.log('[SCORM Export] Save dialog returned:', filePath)
      } catch (saveError) {
        console.error('[SCORM Export] Failed to open save dialog:', saveError)
        setGenerationMessage(`Error: ${saveError instanceof Error ? saveError.message : 'Unknown error opening dialog'}`)
        throw saveError
      }
      
      console.log('[SCORM Export] Save dialog result:', filePath)
      
      if (filePath) {
        setGenerationMessage('Saving file...')
        console.log('[SCORM Export] Writing file to:', filePath)
        
        // Write the buffer to file using Tauri's file system API
        await writeFile(filePath, buffer)
        
        console.log('[SCORM Export] File saved successfully')
        setSavedFilePath(filePath)
        setPackageGenerated(true)
        setGenerationProgress(100)
        setGenerationMessage('SCORM package saved successfully!')
      } else {
        // Dialog was cancelled or failed to open
        const errorMsg = '[SCORM Export] Export cancelled: Save dialog returned null (dialog may not be opening)'
        console.error(errorMsg, 'This usually means the Tauri dialog API is not working correctly')
        setGenerationMessage('Failed: Save dialog did not open')
        setGenerationProgress(0)
        
        // Throw error to make the issue visible
        throw new Error('Save dialog failed to open or was cancelled. Please check Tauri dialog permissions.')
      }
    } catch (error) {
      console.error('[SCORM Export] Failed to generate or save SCORM package:', error)
      
      // More detailed error message
      let errorMessage = 'SCORM Export Failed:\n\n'
      if (error instanceof Error) {
        errorMessage += error.message
        // Add stack trace to console for debugging
        console.error('[SCORM Export] Stack trace:', error.stack)
      } else {
        errorMessage += String(error)
      }
      
      // Show error in UI
      setGenerationMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setGenerationProgress(0)
      
      // Also show alert for visibility
      alert(errorMessage)
    } finally {
      setIsGenerating(false)
      setTimeout(() => {
        setGenerationProgress(0)
        setGenerationMessage('')
      }, 2000)
    }
  }
  
  const handlePreview = () => {
    setShowPreview(true)
  }
  
  return (
    <PageLayout
      currentStep={6}
      title="SCORM Package Generation"
      description="Configure and generate your SCORM-compliant e-learning package"
      onSettingsClick={onSettingsClick}
      onSave={onSave}
      onOpen={onOpen}
      onHelp={onHelp}
      onStepClick={handleStepClick}
      actions={
        <Flex gap="medium">
          <Button 
            variant="secondary" 
            onClick={handlePreview}
          >
            Preview Course
          </Button>
          <Button 
            variant="primary" 
            size="large"
            onClick={handleGenerateSCORM}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate SCORM Package'}
          </Button>
        </Flex>
      }
      onExport={() => setShowExportModal(true)}
      onImport={() => setShowImportModal(true)}
    >
      <Section title="Course Information">
        <Card>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#f3f4f6', marginBottom: '0.5rem' }}>
              {courseSeedData.courseTitle}
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
              {('learningObjectivesPage' in courseContent && courseContent.learningObjectivesPage) ? '✓' : '0'} objectives • 
              {courseContent.topics?.length || 0} topics • 
              {courseContent.assessment?.questions?.length || 0} assessment questions
            </p>
          </div>
          
          <Alert variant="info">
            Your course content is ready for packaging. The generated SCORM package will be compatible with most Learning Management Systems (LMS).
          </Alert>
        </Card>
      </Section>
      
      <Section title="Package Configuration">
        <Card>
          <Grid cols={2} gap="large">
            <div>
              <Input
                label="Package Version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0"
                fullWidth
              />
              <p style={{ 
                marginTop: '0.5rem', 
                fontSize: '0.75rem', 
                color: '#71717a' 
              }}>
                Version number for this package release
              </p>
            </div>
            
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '0.5rem', 
                fontSize: '0.875rem',
                color: '#e4e4e7' 
              }}>
                SCORM Version
              </label>
              <div style={{ 
                padding: '0.75rem', 
                background: 'rgba(255, 255, 255, 0.05)', 
                borderRadius: '0.375rem',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div style={{ 
                  fontWeight: '500', 
                  color: '#f3f4f6',
                  marginBottom: '0.25rem'
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
            </div>
          </Grid>
        </Card>
      </Section>
      
      <Section title="Generation Status">
        <Card>
          {!packageGenerated && !isGenerating && (
            <Alert variant="warning">
              No package has been generated yet. Click "Generate SCORM Package" to create your course package.
            </Alert>
          )}
          
          {isGenerating && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <LoadingSpinner size="large" />
              <p style={{ marginTop: '1rem', color: '#9ca3af' }}>
                {generationMessage || 'Generating SCORM package...'}
              </p>
              {generationProgress > 0 && (
                <div style={{
                  marginTop: '1rem',
                  width: '100%',
                  maxWidth: '300px',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  margin: '1rem auto'
                }}>
                  <div style={{
                    width: `${generationProgress}%`,
                    height: '100%',
                    background: '#8fbb40',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              )}
            </div>
          )}
          
          {packageGenerated && !isGenerating && (
            <Alert variant="success">
              <div>✓ SCORM package saved successfully!</div>
              {savedFilePath && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85em', opacity: 0.9 }}>
                  File saved to: {savedFilePath}
                </div>
              )}
            </Alert>
          )}
        </Card>
      </Section>
      
      <Section title="Next Steps">
        <Card>
          <h4 style={{ color: '#f3f4f6', marginBottom: '1rem' }}>
            After generating your SCORM package:
          </h4>
          <ol style={{ 
            color: '#d1d5db', 
            paddingLeft: '1.5rem',
            lineHeight: '1.8'
          }}>
            <li>Upload the ZIP file to your Learning Management System (LMS)</li>
            <li>Configure course settings in your LMS (enrollment, completion criteria, etc.)</li>
            <li>Test the course to ensure proper functionality</li>
            <li>Publish the course for your learners</li>
          </ol>
        </Card>
      </Section>
      
      {/* Modals */}
      {showExportModal && (
        <Modal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          title="Export Project"
        >
          <ProjectExportButton
            projectData={{
              metadata: {
                version: '1.0.0',
                exportDate: new Date().toISOString(),
                projectName: courseSeedData.courseTitle
              },
              courseData: {
                title: courseSeedData.courseTitle,
                language: 'en',
                keywords: [],
                topics: courseContent.topics?.map(topic => ({
                  title: topic.title,
                  content: topic.content,
                  media: topic.media?.map(m => ({
                    id: `media-${Math.random().toString(36).substr(2, 9)}`,
                    name: m.url || '',
                    url: m.url,
                    type: m.type as 'image' | 'audio' | 'youtube',
                    filename: m.url?.split('/').pop()
                  }))
                })) || []
              },
              media: {
                images: [],
                audio: [],
                captions: []
              }
            }}
          />
        </Modal>
      )}
      
      {showImportModal && (
        <Modal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="Import Project"
        >
          <ProjectImportButton
            onImport={async () => {
              setShowImportModal(false)
            }}
          />
        </Modal>
      )}
      
      {showPreview && (
        <Modal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          title="Course Preview"
          size="large"
        >
          <CoursePreviewAccurate
            courseContent={courseContent}
            courseSeedData={{
              ...courseSeedData,
              difficulty: courseSeedData.difficulty || 3,
              customTopics: [],
              template: 'None' as const,
              templateTopics: []
            }}
          />
        </Modal>
      )}
    </PageLayout>
  )
}