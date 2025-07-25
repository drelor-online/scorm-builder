import React, { useState } from 'react'
import { Button, Modal } from './DesignSystem'
import { tokens } from './DesignSystem/designTokens'
import type { CourseContent } from '../types/aiPrompt'
import type { CourseSeedData } from '../types/course'
import { RealTimePreview } from './RealTimePreview'
import { useStorage } from '../contexts/PersistentStorageContext'

interface CoursePreviewProps {
  courseContent?: CourseContent | null
  courseSeedData: CourseSeedData
}

type DeviceType = 'desktop' | 'tablet' | 'mobile'

const DEVICE_SIZES: Record<DeviceType, { width: string; height: string }> = {
  desktop: { width: '100%', height: '100%' },
  tablet: { width: '768px', height: '1024px' },
  mobile: { width: '375px', height: '667px' }
}

export const CoursePreview: React.FC<CoursePreviewProps> = ({
  courseContent,
  courseSeedData
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>('desktop')
  const storage = useStorage()

  // Store course data in PersistentStorage when modal opens
  React.useEffect(() => {
    if (isOpen && courseContent && storage.isInitialized) {
      // Save course metadata for preview
      const saveCourseData = async () => {
        try {
          // Use existing project for preview
          // const projectId = storage.currentProjectId || 'preview-' + Date.now()
          
          // Save course metadata
          await storage.saveCourseMetadata({
            title: (courseContent as any).title || courseSeedData.courseTitle,
            duration: 30,
            passMark: 80,
            objectives: (courseContent as any).objectives || [],
            welcomeContent: courseContent.welcomePage?.content || '',
            topics: courseContent.topics?.map((_, i) => `topic-${i}`) || [] // Always use numeric topic IDs
          })
          
          // Save topic content with numeric IDs
          for (let i = 0; i < (courseContent.topics || []).length; i++) {
            const topic = courseContent.topics[i]
            const numericContentId = `content-${2 + i}` // Topics start at content-2
            await storage.saveContent(numericContentId, {
              topicId: topic.id,
              title: topic.title,
              content: topic.content,
              knowledgeCheck: topic.knowledgeCheck
            })
          }
          
          // Save assessment data if available
          if ((courseContent as any).assessment) {
            await storage.saveContent('assessment', {
              assessment: (courseContent as any).assessment
            })
          }
        } catch (error) {
          console.error('Failed to save preview data:', error)
        }
      }
      
      saveCourseData()
    }
  }, [isOpen, courseContent, courseSeedData, storage])

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
          {/* Device selector and navigation */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: `0 ${tokens.spacing.md}`,
            borderBottom: `1px solid ${tokens.colors.border.light}`,
            paddingBottom: tokens.spacing.md
          }}>
            {/* Device selector */}
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
              transition: 'all 0.3s ease'
            }}>
              <RealTimePreview embedded />
            </div>
          </div>

          {/* Footer actions */}
          <div className="modal-footer" style={{
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