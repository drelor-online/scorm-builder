import React, { useState } from 'react'
import { CourseContent } from '../types/aiPrompt'
import type { CourseMetadata } from '../types/metadata'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { loadCourseContentConverter, loadSCORMGenerator } from '../utils/dynamicImports'

import { PageLayout } from './PageLayout'
import { CoursePreview } from './CoursePreview'
import { ProjectExportButton, ProjectImportButton } from './ProjectExportImport'
import { 
  Button, 
  Card, 
  Input, 
  Section,
  Flex,
  Grid,
  LoadingSpinner,
  Modal
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
  onBack: _onBack, 
  onSettingsClick, 
  onSave, 
  onOpen, 
  onHelp,
  onStepClick 
}) => {
  const [version, setVersion] = useState('1.0')
  const [isGenerating, setIsGenerating] = useState(false)
  const [packageGenerated, setPackageGenerated] = useState(false)
  const [isTauriEnvironment, setIsTauriEnvironment] = useState(false)
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
  
  React.useEffect(() => {
    setIsTauriEnvironment(Boolean((window as any).__TAURI__))
  }, [])
  
  const handleGenerateSCORM = async () => {
    setIsGenerating(true)
    setGenerationProgress(0)
    setGenerationMessage('Loading SCORM generator...')
    
    try {
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
      
      setGenerationProgress(60)
      setGenerationMessage('Loading SCORM package generator...')
      
      // Dynamically load SCORM generator
      const generateSCORM = await loadSCORMGenerator('1.2')
      
      setGenerationProgress(80)
      setGenerationMessage('Generating SCORM package...')
      
      // Generate SCORM package
      const result = await generateSCORM(enhancedContent)
      const buffer = result.buffer
      
      setGenerationProgress(90)
      setGenerationMessage('Preparing download...')
      
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
      
      setGenerationProgress(100)
      setGenerationMessage('SCORM package generated successfully!')
    } catch (error) {
      console.error('Error generating SCORM package:', error)
      alert('Error generating SCORM package. Please check the console for details.')
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
            style={{ marginRight: '0.75rem' }}
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
          
          <Alert type="info">
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
            <Alert type="warning">
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
            <Alert type="success">
              ✓ SCORM package generated successfully! The file has been {isTauriEnvironment ? 'saved to your selected location' : 'downloaded to your computer'}.
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
          <CoursePreview
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