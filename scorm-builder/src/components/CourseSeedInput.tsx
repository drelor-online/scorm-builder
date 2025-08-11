import React, { useState, useEffect, useRef } from 'react';
import { CourseSeedData, CourseTemplate, templateTopics } from '../types/course';
import { PageLayout } from './PageLayout';
import { TemplateEditor } from './TemplateEditor';
import { useFormChanges } from '../hooks/useFormChanges';
import { AutoSaveIndicatorConnected } from './AutoSaveIndicatorConnected';
import { 
  Card, 
  Button,
  Input,
  ButtonGroup,
  Section,
  Grid,
  Flex,
  Modal,
  Alert
} from './DesignSystem';
import { tokens } from './DesignSystem/designTokens';
import './DesignSystem/designSystem.css';
import styles from './CourseSeedInput.module.css';
import { useStorage } from '../contexts/PersistentStorageContext';
import { debugLogger } from '../utils/ultraSimpleLogger';

interface CourseSeedInputProps {
  // Make onSubmit return a Promise so we can await it
  onSubmit: (data: CourseSeedData) => Promise<void>;
  onBack?: () => void;
  onSettingsClick?: () => void;
  onSave?: (data?: CourseSeedData) => void;
  onHelp?: () => void;
  onStepClick?: (stepIndex: number) => void;
  initialData?: CourseSeedData;
}

// Alert component removed - using DesignSystem Alert

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
        className={`input ${styles.selectField}`}
        data-testid={dataTestId}
      >
        {children}
      </select>
    </div>
  )
}

export const CourseSeedInput: React.FC<CourseSeedInputProps> = ({
  onSubmit,
  onBack,
  onSettingsClick,
  onSave,
  onHelp,
  onStepClick,
  initialData
}) => {
  // VERSION MARKER: v2.0.4 - Fixed infinite loop and Next button
  debugLogger.info('CourseSeedInput v2.0.4', 'Component mounted/updated', {
    hasInitialData: !!initialData,
    initialTitle: initialData?.courseTitle,
    initialDifficulty: initialData?.difficulty,
    initialTemplate: initialData?.template
  });
  
  const storage = useStorage()
  const formRef = useRef<HTMLFormElement>(null)
  const [template, setTemplate] = useState<CourseTemplate>(initialData?.template || 'None')
  const [customTopics, setCustomTopics] = useState(initialData?.customTopics?.join('\n') || '')
  const [courseTitle, setCourseTitle] = useState(initialData?.courseTitle || '')
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || 3)
  const [error, setError] = useState('')
  const [showTemplateEditor, setShowTemplateEditor] = useState(false)
  const [showTopicWarning, setShowTopicWarning] = useState(false)
  const [showComingSoon, setShowComingSoon] = useState(false)
  const [customTemplates, setCustomTemplates] = useState<Record<string, any>>({})
  const [isTitleLocked, setIsTitleLocked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isTopicsEditable, setIsTopicsEditable] = useState(true)
  
  // Sync state when initialData changes (for when component receives data after mounting)
  useEffect(() => {
    if (initialData?.courseTitle && !courseTitle) {
      debugLogger.info('CourseSeedInput', 'Updating title from initialData', {
        newTitle: initialData.courseTitle
      });
      setCourseTitle(initialData.courseTitle);
    }
    if (initialData?.difficulty && difficulty === 3) {
      setDifficulty(initialData.difficulty);
    }
    if (initialData?.template && template === 'None') {
      setTemplate(initialData.template);
    }
    if (initialData?.customTopics && !customTopics) {
      setCustomTopics(initialData.customTopics.join('\n'));
    }
  }, [initialData])
  
  // Load custom templates from file storage
  useEffect(() => {
    const loadCustomTemplates = async () => {
      if (storage && storage.isInitialized) {
        try {
          const templates = await storage.getContent('custom-templates')
          if (templates) {
            setCustomTemplates(templates)
          }
        } catch (error) {
          console.error('Failed to load custom templates:', error)
        }
      }
    }
    loadCustomTemplates()
  }, [storage?.isInitialized])
  const [showDraftLoaded] = useState(false)
  
  // Load project name as course title and check if it should be locked
  useEffect(() => {
    const loadProjectData = async () => {
      if (storage && storage.currentProjectId && storage.isInitialized) {
        try {
          // Check if we have saved course data
          const savedData = await storage.getContent('courseSeedData')
          
          // If we don't have a title from initial data, load from project name or saved data
          if (!initialData?.courseTitle && !courseTitle) {
            // First check if we have saved course data with a title
            if (savedData?.courseTitle) {
              debugLogger.info('CourseSeedInput', 'Loading title from saved course data', {
                title: savedData.courseTitle
              });
              setCourseTitle(savedData.courseTitle);
              setIsTitleLocked(true);
            } else {
              // Otherwise, try to get the project name
              const projects = await storage.listProjects()
              const currentProject = projects.find(p => p.id === storage.currentProjectId)
              if (currentProject?.name) {
                debugLogger.info('CourseSeedInput', 'Loading title from project name', {
                  projectName: currentProject.name,
                  isNewProject: !savedData
                });
                setCourseTitle(currentProject.name);
                // Lock the title if we have saved data (not a new project)
                if (savedData) {
                  setIsTitleLocked(true)
                }
              }
            }
          } else if (savedData) {
            // If we already have a title but also have saved data, lock it
            setIsTitleLocked(true)
          }
        } catch (error) {
          console.error('Failed to load project data:', error)
        }
      }
    }
    
    loadProjectData()
  }, [storage, storage?.currentProjectId, storage?.isInitialized, initialData])
  
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
  
  // Track if we've mounted to prevent initial save
  const hasMountedRef = useRef(false)
  const isSubmittingRef = useRef(false)
  const previousValuesRef = useRef({
    courseTitle,
    difficulty,
    customTopics,
    template
  })
  
  // Auto-save course metadata when values change
  useEffect(() => {
    // Skip the initial mount
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      previousValuesRef.current = {
        courseTitle,
        difficulty,
        customTopics,
        template
      }
      return
    }
    
    // Check if values actually changed
    const hasChanged = 
      previousValuesRef.current.courseTitle !== courseTitle ||
      previousValuesRef.current.difficulty !== difficulty ||
      previousValuesRef.current.customTopics !== customTopics ||
      previousValuesRef.current.template !== template
    
    if (!hasChanged) {
      return // No changes, don't save
    }
    
    // Update previous values
    previousValuesRef.current = {
      courseTitle,
      difficulty,
      customTopics,
      template
    }
    
    const saveMetadata = async () => {
      // Don't autosave while submitting to prevent race conditions
      if (isSubmittingRef.current) {
        return
      }
      
      if (courseTitle && storage?.currentProjectId && storage?.isInitialized) {
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
  }, [courseTitle, difficulty, customTopics, template, storage?.currentProjectId, storage?.isInitialized, onSave])
  
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
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // VERSION MARKER: v2.0.4 - Enhanced submission logging
    debugLogger.info('CourseSeedInput v2.0.4', 'Form submit event triggered', {
      isSubmitting,
      courseTitle,
      hasTopics: customTopics.trim().length > 0
    });
    
    if (isSubmitting) {
      debugLogger.info('CourseSeedInput v2.0.4', 'Preventing double submission');
      console.log('[CourseSeedInput v2.0.4] Form already submitting, ignoring duplicate submit');
      return;
    }
    
    setError('');
    
    // Validation checks
    if (!courseTitle.trim()) {
      debugLogger.warn('CourseSeedInput v2.0.4', 'Validation failed: No course title');
      setError('Course title is required');
      return;
    }
    
    // Get topics from customTopics or template
    let topicsArray = customTopics
      .split(/\n/)
      .map(topic => topic.trim())
      .filter(topic => topic.length > 0);
    
    // If customTopics is empty but we have a template selected, use template topics
    if (topicsArray.length === 0 && template !== 'None') {
      if (customTemplates[template]) {
        topicsArray = customTemplates[template].topics;
      } else if (templateTopics[template]) {
        topicsArray = templateTopics[template];
      }
    }
    
    if (topicsArray.length === 0) {
      debugLogger.warn('CourseSeedInput v2.0.4', 'Validation failed: No topics');
      setError('At least one topic is required');
      return;
    }
    
    // Set submitting flag and prepare data
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    debugLogger.info('CourseSeedInput v2.0.4', 'Submitting form data', { 
      courseTitle, 
      topicsCount: topicsArray.length,
      difficulty,
      template
    });
    
    const data = {
      courseTitle,
      difficulty,
      customTopics: topicsArray,
      template,
      templateTopics: []
    };
    
    try {
      // Await the submission process from the parent component
      debugLogger.info('CourseSeedInput v2.0.4', 'Calling onSubmit callback');
      await onSubmit(data);
      debugLogger.info('CourseSeedInput v2.0.4', 'onSubmit completed successfully');

      // Update the form's initial values only after a successful submission
      updateInitialValues({
        template,
        customTopics,
        courseTitle,
        difficulty
      });
    } catch (error) {
      // The parent component will show a toast, but we can log here too
      debugLogger.error('CourseSeedInput v2.0.4', 'Submission failed', error);
      console.error('[CourseSeedInput v2.0.4] Submission failed', error);
      setError('Failed to create course. Please check the logs and try again.');
    } finally {
      // Reliably reset the submitting flag when the operation is complete
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      debugLogger.info('CourseSeedInput v2.0.4', 'Submission complete, reset submitting flag');
    }
  }
  
  const autoSaveIndicator = (
    <AutoSaveIndicatorConnected />
  )


  const difficultyLabels = ['Basic', 'Easy', 'Medium', 'Hard', 'Expert']
  
  // Form validation
  const isFormValid = () => {
    const hasTitle = courseTitle.trim().length > 0
    
    // Check if we have topics from customTopics or template
    let topicsArray = customTopics
      .split(/\n/)
      .map(topic => topic.trim())
      .filter(topic => topic.length > 0)
    
    // If no custom topics but template is selected, that's valid
    const hasTopics = topicsArray.length > 0 || 
      (template !== 'None' && (customTemplates[template] || templateTopics[template]))
    
    return hasTitle && hasTopics
  }
  

  return (
    <>
      <PageLayout
      currentStep={0}
      title="Course Configuration"
      description="Set up your course fundamentals to generate targeted learning content"
      autoSaveIndicator={autoSaveIndicator}
      onBack={onBack}
      onSettingsClick={onSettingsClick}
      onNext={() => {
        // VERSION MARKER: v2.0.4 - Enhanced debug logging for Next button
        debugLogger.info('CourseSeedInput v2.0.4', 'Next button clicked', {
          isSubmitting,
          formRefExists: !!formRef.current,
          isFormValid: isFormValid()
        })
        
        if (isSubmitting) {
          debugLogger.info('CourseSeedInput v2.0.4', 'Next button clicked but already submitting')
          console.log('[CourseSeedInput v2.0.4] Ignoring Next click - already submitting')
          return
        }
        
        // Programmatically submit the form with Tauri fallback
        if (formRef.current) {
          debugLogger.info('CourseSeedInput v2.0.4', 'Submitting form programmatically', {
            hasRequestSubmit: typeof formRef.current.requestSubmit === 'function'
          })
          
          // Check if requestSubmit is available (not in Tauri webview)
          if (typeof formRef.current.requestSubmit === 'function') {
            debugLogger.info('CourseSeedInput v2.0.4', 'Using requestSubmit API')
            formRef.current.requestSubmit()
          } else {
            // Fallback for Tauri: dispatch submit event
            debugLogger.info('CourseSeedInput v2.0.4', 'Using submit event fallback for Tauri')
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
            const dispatched = formRef.current.dispatchEvent(submitEvent)
            debugLogger.info('CourseSeedInput v2.0.4', 'Submit event dispatched', { dispatched })
          }
        } else {
          debugLogger.error('CourseSeedInput v2.0.4', 'Form ref is null, cannot submit')
        }
      }}
      nextDisabled={!isFormValid() || isSubmitting}
      onHelp={onHelp}
      onStepClick={handleStepClick}
    >
      <form ref={formRef} aria-label="Course Seed Input" data-testid="course-seed-input-form" onSubmit={handleSubmit}>
        {/* Error announcement region for screen readers */}
        <div role="alert" aria-live="assertive" className={styles.srOnly}>
          {error}
        </div>
        
        {/* Draft loaded notification */}
        {showDraftLoaded && (
          <Alert variant="info">Draft loaded from your previous session</Alert>
        )}
        
        {/* Required field legend */}
        <div className={styles.requiredNote}>
          <span className={styles.requiredStar}>*</span> indicates required field
        </div>
        
        {/* Course Details Section */}
        <Section>
          <Card title="Course Details">
            {/* Course Title */}
            <div className={styles.formSection}>
              <div className="input-wrapper">
                <label htmlFor="course-title" className={`input-label ${styles.inputLabel}`}>
                  Course Title <span className={styles.requiredStar}>*</span>
                  {isTitleLocked && (
                    <span 
                      data-testid="title-lock-icon"
                      title="Title is locked from project creation"
                      className={styles.lockIcon}
                    >
                      🔒
                    </span>
                  )}
                </label>
                <input
                  id="course-title"
                  placeholder="Enter your course title"
                  value={courseTitle}
                  onChange={(e) => !isTitleLocked && setCourseTitle(e.target.value)}
                  required
                  readOnly={isTitleLocked}
                  data-testid="course-title-input"
                  className={isTitleLocked ? styles.inputFieldLocked : styles.inputFieldNormal}
                />
              </div>
              <div className={styles.characterCount}>
                {courseTitle.length}/100 characters
                {isTitleLocked && ' (locked from project)'}
              </div>
            </div>
            
            {/* Two column grid for Difficulty and Template */}
            <Grid cols={2} gap="large">
              {/* Difficulty */}
              <div>
                <label htmlFor="difficulty-slider" className={`input-label ${styles.inputLabelOptional}`}>
                  Difficulty Level
                </label>
                <div>
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
                  <div className={styles.difficultyHelpText}>
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
                    className={styles.difficultySlider}
                  />
                </div>
              </div>

              {/* Template */}
              <div>
                <label htmlFor="course-template-select" className={`input-label ${styles.inputLabelOptional}`}>Course Template (Optional)</label>
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
              <Flex justify="space-between" align="center" style={{ marginBottom: '0.5rem' }}>
                <label htmlFor="topics-textarea" className="input-label" style={{ marginBottom: 0 }}>
                  Topics <span className={styles.requiredStar}>*</span>
                </label>
                <ButtonGroup gap="small">
                  {customTopics.trim() && (
                    <>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => setIsTopicsEditable(!isTopicsEditable)}
                        type="button"
                      >
                        {isTopicsEditable ? '🔒 Lock Topics' : '✏️ Edit Topics'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          if (window.confirm('Clear all topics? This cannot be undone.')) {
                            setCustomTopics('')
                            setIsTopicsEditable(true)
                          }
                        }}
                        type="button"
                      >
                        🗑️ Clear Topics
                      </Button>
                    </>
                  )}
                </ButtonGroup>
              </Flex>
              <textarea
                id="topics-textarea"
                placeholder={`List your course topics (one per line):\n\n• Introduction to workplace safety\n• Hazard identification techniques\n• Personal protective equipment\n• Emergency response procedures\n• Incident reporting protocols`}
                value={customTopics}
                onChange={(e) => {
                  if (isTopicsEditable) {
                    const value = e.target.value
                    // Just set the value as-is - topics are only separated by newlines
                    setCustomTopics(value)
                  }
                }}
                data-testid="topics-textarea"
                required
                className={styles.textareaField}
                readOnly={!isTopicsEditable}
                style={{ 
                  backgroundColor: isTopicsEditable ? 'white' : '#f5f5f5',
                  cursor: isTopicsEditable ? 'text' : 'not-allowed'
                }}
              />
            </div>
            <Flex gap="large" className={styles.tipText}>
              <span className={styles.tipItem}>📝 Recommended: 10-20 topics</span>
              <span className={styles.tipItem}>⏱️ Aim for 2-3 minutes per topic</span>
            </Flex>
          </Card>
        </Section>
        
        {/* Note about automatic pages */}
        <Alert variant="info">
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
          <div className={styles.modalContent}>
            <p className={styles.modalMessage}>
              Your existing topics will be cleared and replaced with the template topics. 
              This action cannot be undone.
            </p>
            <div className={styles.modalActions}>
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
          <div className={styles.modalContent}>
            <p className={styles.modalMessage}>
              The template management feature will be implemented in a future release. 
              Stay tuned for updates!
            </p>
            <div className={styles.modalActions}>
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
            onSave={async () => {
              // Reload custom templates from file storage
              if (storage && storage.isInitialized) {
                try {
                  const templates = await storage.getContent('custom-templates')
                  if (templates) {
                    setCustomTemplates(templates)
                  }
                } catch (error) {
                  console.error('Failed to reload custom templates:', error)
                }
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