import React, { useState, useEffect } from 'react';
import { CourseSeedData, CourseTemplate, templateTopics } from '../types/course';
import { PageLayout } from './PageLayout';
import { TemplateEditor } from './TemplateEditor';
import { useFormChanges } from '../hooks/useFormChanges';
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected';
import { Input } from './Input';
import { 
  Card, 
  Button,
  ButtonGroup,
  Section,
  Grid,
  Flex,
  Modal
} from './DesignSystem';
import './DesignSystem/designSystem.css';
import { useStorage } from '../contexts/PersistentStorageContext';

interface CourseSeedInputProps {
  onSubmit: (data: CourseSeedData) => void;
  onSettingsClick?: () => void;
  onSave?: (data?: CourseSeedData) => void;
  onHelp?: () => void;
  onStepClick?: (stepIndex: number) => void;
  initialData?: CourseSeedData;
}

// Alert component for error messages
const Alert: React.FC<{ type: 'error' | 'info'; children: React.ReactNode }> = ({ type, children }) => (
  <div className={`alert alert-${type}`} style={{
    padding: '1rem',
    backgroundColor: type === 'error' ? 'rgba(185, 28, 28, 0.2)' : 'rgba(59, 130, 246, 0.1)',
    border: `1px solid ${type === 'error' ? 'rgba(185, 28, 28, 0.3)' : 'rgba(59, 130, 246, 0.2)'}`,
    borderRadius: '0.5rem',
    color: type === 'error' ? '#f87171' : '#93c5fd',
    fontSize: '0.875rem',
    marginBottom: '1.5rem'
  }}>
    {children}
  </div>
)

// Select component wrapper
const Select: React.FC<{
  label?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode
  id?: string
  'data-testid'?: string
}> = ({ label, value, onChange, children, id, 'data-testid': dataTestId }) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
  
  return (
    <div className="input-wrapper">
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <select
        id={inputId}
        value={value}
        onChange={onChange}
        className="input"
        data-testid={dataTestId}
        style={{
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.7rem center',
          backgroundSize: '1.5em 1.5em',
          paddingRight: '2.5rem',
          color: 'var(--color-text-primary, #e5e7eb)'
        }}
      >
        {children}
      </select>
    </div>
  )
}

export const CourseSeedInput: React.FC<CourseSeedInputProps> = ({
  onSubmit,
  onSettingsClick,
  onSave,
  onHelp,
  onStepClick,
  initialData
}) => {
  const storage = useStorage()
  const [template, setTemplate] = useState<CourseTemplate>(initialData?.template || 'None')
  const [customTopics, setCustomTopics] = useState(initialData?.customTopics?.join('\n') || '')
  const [courseTitle, setCourseTitle] = useState(initialData?.courseTitle || '')
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || 3)
  const [error, setError] = useState('')
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [showTopicWarning, setShowTopicWarning] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<Record<string, any>>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('customTemplates')
    return saved ? JSON.parse(saved) : {}
  })
  const [showDraftLoaded] = useState(false)
  
  // Load project name as course title if it's a new course
  useEffect(() => {
    const loadProjectName = async () => {
      if (!courseTitle && storage.currentProjectId && storage.isInitialized) {
        try {
          const projects = await storage.listProjects()
          const currentProject = projects.find(p => p.id === storage.currentProjectId)
          if (currentProject?.name) {
            setCourseTitle(currentProject.name)
          }
        } catch (error) {
          console.error('Failed to load project name:', error)
        }
      }
    }
    
    loadProjectName()
  }, [storage.currentProjectId, storage.isInitialized])
  
  // Navigation guard hook
  const {
    checkForChanges,
    attemptNavigation,
    updateInitialValues
  } = useFormChanges({
    initialValues: {
      template: initialData?.template || 'None',
      customTopics: initialData?.customTopics?.join('\n') || '',
      courseTitle: initialData?.courseTitle || '',
      difficulty: initialData?.difficulty || 3
    }
  })
  
  // Form data tracking for changes
  
  // Track form changes
  useEffect(() => {
    checkForChanges({
      template,
      customTopics,
      courseTitle,
      difficulty
    })
  }, [template, customTopics, courseTitle, difficulty])
  
  // Auto-save course metadata when title changes
  useEffect(() => {
    const saveMetadata = async () => {
      if (courseTitle && storage.currentProjectId && storage.isInitialized) {
        try {
          const topicsArray = customTopics
            .split('\n')
            .map(topic => topic.trim())
            .filter(topic => topic.length > 0)
          
          await storage.saveCourseMetadata({
            courseTitle,
            difficulty,
            topics: topicsArray,
            lastModified: new Date().toISOString()
          })
          
          // Also trigger onSave callback for silent save
          if (onSave) {
            const data: CourseSeedData = {
              courseTitle,
              difficulty,
              customTopics: topicsArray,
              template,
              templateTopics: []
            }
            onSave(data)
          }
        } catch (error) {
          console.error('Failed to save course metadata:', error)
        }
      }
    }
    
    // Debounce the save
    const timer = setTimeout(saveMetadata, 1000)
    return () => clearTimeout(timer)
  }, [courseTitle, difficulty, customTopics, storage, template, onSave])
  
  // Wrapped navigation handlers
  const handleStepClick = (stepIndex: number) => {
    if (onStepClick) {
      attemptNavigation(() => onStepClick(stepIndex))
    }
  }
  
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTemplate = e.target.value
    setTemplate(selectedTemplate as CourseTemplate)
    
    // If it's a custom template, immediately populate topics
    if (customTemplates[selectedTemplate]) {
      const topics = customTemplates[selectedTemplate].topics.join('\n')
      setCustomTopics(topics)
    }
  }
  
  const addTemplateTopics = () => {
    if (template !== 'None') {
      // Check if there are existing topics
      const hasExistingTopics = customTopics.trim().length > 0
      
      if (hasExistingTopics) {
        // Show warning dialog
        setShowTopicWarning(true)
      } else {
        // No existing topics, just add template topics
        replaceTopicsWithTemplate()
      }
    }
  }
  
  const replaceTopicsWithTemplate = () => {
    if (template !== 'None') {
      // Check if it's a custom template first
      if (customTemplates[template]) {
        const topics = customTemplates[template].topics.join('\n')
        setCustomTopics(topics)
      } else if (templateTopics[template]) {
        // Otherwise use default template topics
        const topics = templateTopics[template].join('\n')
        setCustomTopics(topics)
      }
    }
    setShowTopicWarning(false)
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!courseTitle.trim()) {
      setError('Course title is required')
      return
    }
    
    const topicsArray = customTopics
      .split(/[\n,]/)
      .map(topic => topic.trim())
      .filter(topic => topic.length > 0)
    
    if (topicsArray.length === 0) {
      setError('At least one topic is required')
      return
    }
    
    const data = {
      courseTitle,
      difficulty,
      customTopics: topicsArray,
      template,
      templateTopics: []
    }
    
    // Update initial values after successful submit
    updateInitialValues({
      template,
      customTopics,
      courseTitle,
      difficulty
    })
    
    onSubmit(data)
  }
  
  const autoSaveIndicator = (
    <AutoSaveIndicatorConnected />
  )


  const difficultyLabels = ['Basic', 'Easy', 'Medium', 'Hard', 'Expert']
  
  // Form validation
  const isFormValid = () => {
    const hasTitle = courseTitle.trim().length > 0
    const topicsArray = customTopics
      .split(/[\n,]/)
      .map(topic => topic.trim())
      .filter(topic => topic.length > 0)
    const hasTopics = topicsArray.length > 0
    return hasTitle && hasTopics
  }
  

  return (
    <>
      <PageLayout
      currentStep={0}
      title="Course Configuration"
      description="Set up your course fundamentals to generate targeted learning content"
      autoSaveIndicator={autoSaveIndicator}
      onSettingsClick={onSettingsClick}
      onNext={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
      nextDisabled={!isFormValid()}
      onHelp={onHelp}
      onStepClick={handleStepClick}
    >
      <form aria-label="Course Seed Input" data-testid="course-seed-input-form" onSubmit={handleSubmit}>
        {/* Error announcement region for screen readers */}
        <div role="alert" aria-live="assertive" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
          {error}
        </div>
        
        {/* Draft loaded notification */}
        {showDraftLoaded && (
          <Alert type="info">Draft loaded from your previous session</Alert>
        )}
        
        {/* Required field legend */}
        <div style={{ fontSize: '0.875rem', color: '#71717a', marginBottom: '1rem' }}>
          <span style={{ color: 'rgb(220, 38, 38)' }}>*</span> indicates required field
        </div>
        
        {/* Course Details Section */}
        <Section>
          <Card title="Course Details">
            {/* Course Title */}
            <div style={{ marginBottom: '2rem' }}>
              <div className="input-wrapper">
                <label htmlFor="course-title" className="input-label">
                  Course Title <span style={{ color: 'rgb(220, 38, 38)' }}>*</span>
                </label>
                <Input
                  id="course-title"
                  placeholder="Enter your course title"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  required
                  data-testid="course-title-input"
                />
              </div>
              <div style={{ 
                fontSize: '0.75rem', 
                color: '#71717a', 
                marginTop: '0.25rem',
                textAlign: 'right'
              }}>
                {courseTitle.length}/100 characters
              </div>
            </div>
            
            {/* Two column grid for Difficulty and Template */}
            <Grid cols={2} gap="large">
              {/* Difficulty */}
              <div>
                <label htmlFor="difficulty-slider" className="input-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
                  Difficulty Level
                </label>
                <div style={{ width: 'fit-content' }}>
                  <ButtonGroup gap="small" className="difficulty-button-group">
                    {difficultyLabels.map((label, index) => {
                      const isSelected = difficulty === index + 1
                      return (
                        <Button
                          key={label}
                          variant={isSelected ? 'primary' : 'secondary'}
                          onClick={() => setDifficulty(index + 1)}
                          type="button"
                          size="medium"
                          aria-pressed={isSelected}
                          aria-label={`Level ${index + 1}`}
                          data-testid={`difficulty-${index + 1}`}
                          data-selected={isSelected}
                          className={isSelected ? 'selected' : ''}
                        >
                          {label}
                        </Button>
                      )
                    })}
                  </ButtonGroup>
                  <div style={{ fontSize: '0.75rem', color: '#71717a', marginTop: '0.5rem' }}>
                    Select the complexity level for your learners
                  </div>
                  <input
                    id="difficulty-slider"
                    data-testid="difficulty-slider"
                    type="range"
                    min="1"
                    max="5"
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value))}
                    aria-label="Difficulty Level"
                    aria-valuemin={1}
                    aria-valuemax={5}
                    aria-valuenow={difficulty}
                    style={{
                      width: '100%',
                      marginTop: '0.5rem',
                      accentColor: '#3b82f6'
                    }}
                  />
                </div>
              </div>

              {/* Template */}
              <div>
                <label htmlFor="course-template-select" className="input-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Course Template (Optional)</label>
                <Select
                  id="course-template-select"
                  value={template}
                  onChange={handleTemplateChange}
                  data-testid="template-select"
                >
                  <option value="None">Choose a template...</option>
                  <option value="How-to Guide">How-to Guide</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Technical">Technical</option>
                  <option value="Safety">Safety</option>
                  <option value="Business Development">Business Development</option>
                  <option value="Human Resources">Human Resources</option>
                  {/* Add custom templates from localStorage */}
                  {Object.keys(customTemplates).map(templateName => (
                    <option key={templateName} value={templateName}>{templateName}</option>
                  ))}
                </Select>
                {template !== 'None' && (
                  <Button
                    variant="secondary"
                    onClick={addTemplateTopics}
                    type="button"
                    data-testid="add-template-topics"
                  >
                    + Add Template Topics
                  </Button>
                )}
              </div>
            </Grid>
          </Card>
        </Section>

        {/* Learning Topics Section */}
        <Section>
          <Card title="Learning Topics">
            <div className="input-wrapper">
              <label htmlFor="topics-textarea" className="input-label">
                Topics <span style={{ color: 'rgb(220, 38, 38)' }}>*</span>
              </label>
              <textarea
                id="topics-textarea"
                placeholder={`List your course topics (one per line):\n\n• Introduction to workplace safety\n• Hazard identification techniques\n• Personal protective equipment\n• Emergency response procedures\n• Incident reporting protocols`}
                value={customTopics}
                onChange={(e) => {
                  const value = e.target.value
                  // Only normalize if value contains commas or user just typed a comma
                  if (value.includes(',')) {
                    // Split by both commas and newlines, clean up, and rejoin with newlines
                    const topics = value
                      .split(/[,\n]/)
                      .map(t => t.trim())
                      .filter(t => t)
                    setCustomTopics(topics.join('\n'))
                  } else {
                    // Otherwise, just set the value as-is to allow normal typing
                    setCustomTopics(value)
                  }
                }}
                data-testid="topics-textarea"
                required
                style={{
                  width: '100%',
                  minHeight: '200px',
                  padding: 'var(--spacing-sm)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius)',
                  fontFamily: 'var(--font-family)',
                  fontSize: 'var(--font-size-base)',
                  backgroundColor: 'var(--input-background-color)',
                  color: 'var(--text-color)',
                  resize: 'vertical'
                }}
              />
            </div>
            <Flex gap="large" style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#71717a' }}>
              <span style={{ whiteSpace: 'nowrap' }}>📝 Recommended: 10-20 topics</span>
              <span style={{ whiteSpace: 'nowrap' }}>⏱️ Aim for 2-3 minutes per topic</span>
            </Flex>
          </Card>
        </Section>
        
        {/* Note about automatic pages */}
        <Alert type="info">
          <strong>Note:</strong> Welcome and Learning Objectives pages will be automatically generated based on your course configuration.
        </Alert>
        
      </form>
      
      {/* Topic Warning Modal */}
      {showTopicWarning && (
        <Modal
          isOpen={showTopicWarning}
          onClose={() => setShowTopicWarning(false)}
          title="Replace Existing Topics?"
        >
          <div style={{ padding: '1rem' }}>
            <p style={{ marginBottom: '1rem' }}>
              Your existing topics will be cleared and replaced with the template topics. 
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button
                variant="secondary"
                onClick={() => setShowTopicWarning(false)}
                data-testid="cancel-replace-topics"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={replaceTopicsWithTemplate}
                data-testid="confirm-replace-topics"
              >
                Confirm
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Coming Soon Modal */}
      {showComingSoon && (
        <Modal
          isOpen={showComingSoon}
          onClose={() => setShowComingSoon(false)}
          title="Coming Soon"
        >
          <div style={{ padding: '1rem' }}>
            <p style={{ marginBottom: '1rem' }}>
              The template management feature will be implemented in a future release. 
              Stay tuned for updates!
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                onClick={() => setShowComingSoon(false)}
                data-testid="coming-soon-ok"
              >
                OK
              </Button>
            </div>
          </div>
        </Modal>
      )}
      
      {/* Template Editor Modal (disabled for now) */}
      {showTemplateEditor && false && (
        <Modal
          isOpen={showTemplateEditor}
          onClose={() => setShowTemplateEditor(false)}
          title="Template Editor"
          size="large"
        >
          <TemplateEditor
            onClose={() => setShowTemplateEditor(false)}
            onSave={() => {
              // Reload custom templates from localStorage
              const saved = localStorage.getItem('customTemplates')
              if (saved) {
                setCustomTemplates(JSON.parse(saved))
              }
            }}
          />
        </Modal>
      )}
    </PageLayout>
    
  </>
  )
}

export default CourseSeedInput;