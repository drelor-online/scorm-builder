import React, { useState, useEffect, useRef } from 'react';
import { CourseSeedData, CourseTemplate, templateTopics } from '../types/course';
import { PageLayout } from './PageLayout';
import { TemplateEditor } from './TemplateEditor';
import { useFormChanges } from '../hooks/useFormChanges';
import { AutoSaveBadge } from './AutoSaveBadge';
import { 
  Card, 
  Button,
  Input,
  ButtonGroup,
  Section,
  Grid,
  Flex,
  Modal,
  Alert,
  Icon
} from './DesignSystem';
import { Lock, Edit2, FileText, Trash2, Clock, List } from 'lucide-react';
import { tokens } from './DesignSystem/designTokens';
import './DesignSystem/designSystem.css';
import styles from './CourseSeedInput.module.css';
import { useStorage } from '../contexts/PersistentStorageContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';
import { debugLogger } from '../utils/ultraSimpleLogger';
import { ConfirmDialog } from './ConfirmDialog';

interface CourseSeedInputProps {
  // Make onSubmit return a Promise so we can await it
  onSubmit: (data: CourseSeedData) => Promise<void>;
  onBack?: () => void;
  onSettingsClick?: () => void;
  onSave?: (data?: CourseSeedData) => void;
  onOpen?: () => void;
  onHelp?: () => void;
  onStepClick?: (stepIndex: number) => void;
  initialData?: CourseSeedData;
  isSaving?: boolean;
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
  onOpen,
  onHelp,
  onStepClick,
  initialData,
  isSaving
}) => {
  const { success, error: notifyError, info } = useNotifications();
  const { markDirty, resetDirty } = useUnsavedChanges();
  
  // VERSION MARKER: v2.0.4 - Fixed infinite loop and Next button
  debugLogger.info('CourseSeedInput v2.0.4', 'Component mounted/updated', {
    hasInitialData: !!initialData,
    initialTitle: initialData?.courseTitle,
    initialDifficulty: initialData?.difficulty,
    initialTemplate: initialData?.template
  });
  
  const storage = useStorage()
  const formRef = useRef<HTMLFormElement>(null)
  const hasMountedRef = useRef(false)
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
  const [showClearTopicsConfirm, setShowClearTopicsConfirm] = useState(false)
  const [topicsExplicitlyCleared, setTopicsExplicitlyCleared] = useState(false)
  
  
  
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
  
  // Get project name for new projects (only when no initialData is provided)
  useEffect(() => {
    const loadProjectName = async () => {
      if (storage && storage.currentProjectId && storage.isInitialized && !initialData?.courseTitle && !courseTitle) {
        try {
          const projects = await storage.listProjects()
          const currentProject = projects.find(p => p.id === storage.currentProjectId)
          if (currentProject?.name) {
            debugLogger.info('CourseSeedInput', 'Loading title from project name (new project)', {
              projectName: currentProject.name
            });
            setCourseTitle(currentProject.name);
          }
        } catch (error) {
          console.error('Failed to load project name:', error)
        }
      }
    }
    
    loadProjectName()
  }, [storage, storage?.currentProjectId, storage?.isInitialized, initialData?.courseTitle, courseTitle])
  
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
  
  // Sync state when initialData changes (for when component receives data after mounting)
  // Only update fields that are currently empty to avoid overriding user selections
  useEffect(() => {
    if (initialData) {
      // Prevent rapid re-syncs (debounce syncing to max once per 100ms)
      const now = Date.now()
      const timeSinceLastSync = now - lastSyncTimeRef.current
      
      if (timeSinceLastSync < 100) {
        return // Skip sync if it's too soon after last sync
      }
      
      // Don't sync if user is actively editing
      if (isActivelyEditingRef.current) {
        return // Skip sync if user is currently typing
      }
      
      lastSyncTimeRef.current = now
      
      debugLogger.info('CourseSeedInput', 'Syncing state with initialData', {
        hasTitle: !!initialData.courseTitle,
        hasDifficulty: !!initialData.difficulty,
        hasTemplate: !!initialData.template,
        hasCustomTopics: !!initialData.customTopics?.length,
        currentTemplate: template,
        currentTitle: courseTitle,
        hasMounted: hasMountedRef.current,
        willSync: true,
        timeSinceLastSync: timeSinceLastSync,
        isActivelyEditing: isActivelyEditingRef.current
      });
      
      const newValues = {
        courseTitle: courseTitle,
        difficulty: difficulty,
        template: template,
        customTopics: customTopics
      }
      
      // Only update fields that are currently empty/default to avoid overriding user selections
      // But always allow loading saved data on first sync (when component hasn't mounted yet)
      const userHasChangedTemplate = hasMountedRef.current && template !== 'None' && template !== initialData.template
      // Improved logic: Only consider topics "changed by user" if they are actively different from saved data
      // AND the user has actually mounted the component (not on initial load)
      const userHasChangedTopics = hasMountedRef.current && (
        customTopics.trim().length > 0 || topicsExplicitlyCleared
      ) && (
        !initialData.customTopics?.length || 
        customTopics.trim() !== initialData.customTopics?.join('\n').trim()
      )
      
      // Additional protection: check if user has made changes compared to the original defaults
      const userHasChangedTitle = courseTitle.trim().length > 0 && courseTitle !== initialData.courseTitle
      const userHasChangedDifficulty = difficulty !== 3 && difficulty !== initialData.difficulty
      
      if (!courseTitle && initialData.courseTitle && !userHasChangedTitle) {
        setCourseTitle(initialData.courseTitle)
        newValues.courseTitle = initialData.courseTitle
      }
      
      if (template === 'None' && initialData.template && !userHasChangedTemplate) {
        setTemplate(initialData.template)
        newValues.template = initialData.template
      }
      
      if (difficulty === 3 && initialData.difficulty && !userHasChangedDifficulty) {
        setDifficulty(initialData.difficulty)
        newValues.difficulty = initialData.difficulty
      }
      
      // Only sync topics if the user hasn't added any topics AND initialData has topics
      // AND we're not overriding user-added template topics AND user hasn't explicitly cleared topics
      if (!customTopics.trim() && initialData.customTopics?.length && !userHasChangedTopics && !topicsExplicitlyCleared) {
        const topicsStr = initialData.customTopics.join('\n')
        setCustomTopics(topicsStr)
        newValues.customTopics = topicsStr
      }
      
      // Update the form's initial values to prevent unsaved changes warnings
      updateInitialValues(newValues)
    }
  }, [initialData, updateInitialValues])
  
  // Track if we've mounted to prevent initial save
  const isSubmittingRef = useRef(false)
  const lastSyncTimeRef = useRef(0)
  const isActivelyEditingRef = useRef(false)
  const isTopicsTextareaFocusedRef = useRef(false)
  const previousValuesRef = useRef({
    courseTitle,
    difficulty,
    customTopics,
    template
  })
  
  // 🚀 MOUNTING STABILITY FIX: Use refs to capture latest callbacks without triggering re-renders
  const onSaveRef = useRef(onSave)
  const markDirtyRef = useRef(markDirty)
  
  // Update refs when callbacks change
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])
  
  useEffect(() => {
    markDirtyRef.current = markDirty  
  }, [markDirty])
  
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
      
      // Don't autosave while user is focused on topics textarea
      if (isTopicsTextareaFocusedRef.current) {
        debugLogger.info('CourseSeedInput', 'Skipping autosave - topics textarea is focused')
        return
      }
      
      if (courseTitle && storage?.currentProjectId && storage?.isInitialized) {
        let savedSuccessfully = false
        try {
          const topicsArray = customTopics
            .split('\n')
            .map(topic => topic.trim())
            .filter(topic => topic.length > 0)
          
          const seedData: CourseSeedData = {
            courseTitle,
            difficulty,
            customTopics: topicsArray,
            template,
            templateTopics: []
          }
          
          // Mark section as dirty to enable manual save button
          if (markDirtyRef.current) {
            markDirtyRef.current('courseSeed')
          }
          
          // Call onSave callback to trigger unified save through App.tsx
          // This ensures both App state synchronization AND storage persistence
          // The parent's handleManualSave will handle the actual storage operation
          if (onSaveRef.current) {
            onSaveRef.current(seedData)
            savedSuccessfully = true
          } else {
            // Fallback: if no parent callback, save directly to storage
            // This maintains backward compatibility for standalone usage
            await storage.saveCourseSeedData(seedData)
            savedSuccessfully = true
          }
        } catch (error) {
          // Enhanced error logging with context
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error('Auto-save failed for course seed data:', {
            error: errorMessage,
            courseTitle,
            projectId: storage?.currentProjectId,
            hasTopics: customTopics.trim().length > 0
          })
          
          // Could potentially show a non-intrusive error notification here
          // but auto-save failures should generally be silent to avoid disrupting UX
        } finally {
          // Ensure proper cleanup regardless of save success/failure
          // Auto-save doesn't maintain loading state, so no state cleanup needed
          // But we could add telemetry/analytics here if needed
          if (savedSuccessfully) {
            debugLogger.info('CourseSeedInput', 'Auto-save completed successfully', {
              courseTitle,
              projectId: storage?.currentProjectId
            })
          }
        }
      }
    }
    
    // Debounce the save (5 seconds to give users more time to type)
    const timer = setTimeout(saveMetadata, 5000)
    return () => clearTimeout(timer)
  }, [courseTitle, difficulty, customTopics, template, storage?.currentProjectId, storage?.isInitialized]) // 🚀 REMOVED callback dependencies to prevent excessive re-renders
  
  // Wrapped navigation handlers
  const handleStepClick = (stepIndex: number) => {
    if (onStepClick) {
      attemptNavigation(() => onStepClick(stepIndex))
    }
  }
  
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedTemplate = e.target.value
    setTemplate(selectedTemplate as CourseTemplate)
    markDirty('courseSeed')
    
    // If it's a custom template, immediately populate topics
    if (customTemplates[selectedTemplate]) {
      const topics = customTemplates[selectedTemplate].topics.join('\n')
      setCustomTopics(topics)
      // Don't need to markDirty again since we already did it above
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
        markDirty('courseSeed')
      } else if (templateTopics[template]) {
        // Otherwise use default template topics
        const topics = templateTopics[template].join('\n')
        setCustomTopics(topics)
        markDirty('courseSeed')
      }
    }
    setShowTopicWarning(false)
  }

  // Clear topics confirmation handlers
  const handleConfirmClearTopics = () => {
    setCustomTopics('')
    setIsTopicsEditable(true)
    setTopicsExplicitlyCleared(true)
    markDirty('courseSeed')
    
    // Save the cleared topics to storage
    if (onSave) {
      const seedData: CourseSeedData = {
        template,
        customTopics: [], // Empty array
        courseTitle,
        difficulty,
        templateTopics: template !== 'None' ? templateTopics[template] || [] : []
      }
      onSave(seedData)
    }
    
    setShowClearTopicsConfirm(false)
  }
  
  const handleCancelClearTopics = () => {
    setShowClearTopicsConfirm(false)
  }

  // Helper function to trigger immediate save (for blur events)
  const triggerImmediateSave = async () => {
    if (isSubmittingRef.current || !courseTitle || !storage?.currentProjectId || !storage?.isInitialized) {
      return
    }

    try {
      const topicsArray = customTopics
        .split('\n')
        .map(topic => topic.trim())
        .filter(topic => topic.length > 0)
      
      const seedData: CourseSeedData = {
        courseTitle,
        difficulty,
        customTopics: topicsArray,
        template,
        templateTopics: []
      }
      
      markDirty('courseSeed')
      
      if (onSave) {
        onSave(seedData)
      } else {
        await storage.saveCourseSeedData(seedData)
      }
      
      debugLogger.info('CourseSeedInput', 'Immediate save completed on blur', {
        courseTitle,
        projectId: storage?.currentProjectId
      })
    } catch (error) {
      console.error('Immediate save failed:', error)
    }
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
      info('Generating course content...');
      await onSubmit(data);
      debugLogger.info('CourseSeedInput v2.0.4', 'onSubmit completed successfully');
      success('Course content generated successfully!');

      // Update the form's initial values only after a successful submission
      updateInitialValues({
        template,
        customTopics,
        courseTitle,
        difficulty
      });
      
      // Reset dirty flag after successful submission
      resetDirty('courseSeed');
    } catch (error) {
      // The parent component will show a toast, but we can log here too
      debugLogger.error('CourseSeedInput v2.0.4', 'Submission failed', error);
      console.error('[CourseSeedInput v2.0.4] Submission failed', error);
      const errorMessage = 'Failed to create course. Please check the logs and try again.';
      setError(errorMessage);
      notifyError(errorMessage);
    } finally {
      // Reliably reset the submitting flag when the operation is complete
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      debugLogger.info('CourseSeedInput v2.0.4', 'Submission complete, reset submitting flag');
      
      // Fallback timeout to ensure isSubmitting doesn't get stuck
      setTimeout(() => {
        if (isSubmittingRef.current) {
          debugLogger.warn('CourseSeedInput', 'Force-resetting stuck isSubmitting flag');
          setIsSubmitting(false);
          isSubmittingRef.current = false;
        }
      }, 30000); // 30 second timeout
    }
  }
  
  const autoSaveIndicator = (
    <AutoSaveBadge />
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
  
  // Handle manual save button clicks
  const handleManualSave = async () => {
    if (onSave && courseTitle) {
      try {
        const topicsArray = customTopics
          .split('\n')
          .map(topic => topic.trim())
          .filter(topic => topic.length > 0)
        
        const seedData = {
          courseTitle,
          difficulty,
          customTopics: topicsArray,
          template,
          templateTopics: []
        }
        
        await onSave(seedData)
      } catch (error) {
        console.error('Manual save failed:', error)
      }
    }
  }

  // Keyboard shortcuts (placed after handleManualSave is defined)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (onSave && !isSubmitting && courseTitle.trim().length > 0) {
          handleManualSave()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onSave, isSubmitting, courseTitle, handleManualSave])

  return (
    <>
      <PageLayout
      currentStep={0}
      title="Course Configuration"
      description="Set up your course fundamentals to generate targeted learning content"
      autoSaveIndicator={autoSaveIndicator}
      isSaving={isSaving}
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
        
        // Don't show validation alert - the button being disabled is sufficient feedback
        // The nextDisabled prop already prevents clicking when invalid
        
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
      onOpen={onOpen}
      onStepClick={handleStepClick}
      onSave={onSave ? handleManualSave : undefined}
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
                      <Icon icon={Lock} size="sm" />
                    </span>
                  )}
                </label>
                <input
                  id="course-title"
                  placeholder="Enter your course title"
                  value={courseTitle}
                  onChange={(e) => {
                    if (!isTitleLocked) {
                      setCourseTitle(e.target.value)
                      markDirty('courseSeed')
                    }
                  }}
                  required
                  aria-required="true"
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
                          onClick={() => {
                            setDifficulty(index + 1)
                            markDirty('courseSeed')
                          }}
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
                </div>
              </div>

              {/* Template */}
              <div>
                <label htmlFor="course-template-select" className={`input-label ${styles.inputLabelOptional}`}>Course Template (Optional)</label>
                <div style={{ position: 'relative', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
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
                  </div>
                </div>
                
                {template !== 'None' && (
                  <Button
                    variant="secondary"
                    onClick={addTemplateTopics}
                    type="button"
                    data-testid="add-template-topics"
                    className={styles.templateButtonSpacing}
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
                <label htmlFor="topics-textarea" className="input-label" style={{ marginBottom: '0.25rem' }}>
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
                        data-testid="edit-topics-button"
                      >
                        <>
                          <Icon icon={isTopicsEditable ? Lock : Edit2} size="sm" />
                          {isTopicsEditable ? ' Lock Topics' : ' Edit Topics'}
                        </>
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => {
                          setShowClearTopicsConfirm(true)
                        }}
                        type="button"
                        data-testid="clear-topics-button"
                      >
                        <>
                          <Icon icon={Trash2} size="sm" />
                          Clear Topics
                        </>
                      </Button>
                      
                    </>
                  )}
                </ButtonGroup>
              </Flex>
              {/* Topics textarea */}
                <textarea
                  id="topics-textarea"
                  placeholder={`List your course topics (one per line):\n\n• Introduction to workplace safety\n• Hazard identification techniques\n• Personal protective equipment\n• Emergency response procedures\n• Incident reporting protocols`}
                  value={customTopics}
                  onFocus={() => {
                    isTopicsTextareaFocusedRef.current = true
                    debugLogger.info('CourseSeedInput', 'Topics textarea focused - autosave disabled')
                  }}
                  onBlur={() => {
                    isTopicsTextareaFocusedRef.current = false
                    debugLogger.info('CourseSeedInput', 'Topics textarea blurred - triggering immediate save')
                    // Trigger immediate save when user finishes editing
                    triggerImmediateSave()
                  }}
                  onChange={(e) => {
                    if (isTopicsEditable) {
                      const value = e.target.value
                      // Mark as actively editing to prevent sync interference
                      isActivelyEditingRef.current = true
                      // Just set the value as-is - topics are only separated by newlines
                      setCustomTopics(value)
                      // If user types something after clearing, allow auto-restore again
                      if (value.trim() && topicsExplicitlyCleared) {
                        setTopicsExplicitlyCleared(false)
                      }
                      markDirty('courseSeed')
                      
                      // Clear the actively editing flag after a brief delay
                      setTimeout(() => {
                        isActivelyEditingRef.current = false
                      }, 300)
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
              <span className={styles.tipItem}>
                <Icon icon={FileText} size="sm" />
                Recommended: 10-20 topics
              </span>
              <span className={styles.tipItem}>
                <Icon icon={Clock} size="sm" />
                Aim for 2-3 minutes per topic
              </span>
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

      {/* Clear Topics Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showClearTopicsConfirm}
        title="Clear Topics"
        message="Clear all topics? This cannot be undone."
        confirmText="Clear Topics"
        cancelText="Cancel"
        variant="warning"
        onConfirm={handleConfirmClearTopics}
        onCancel={handleCancelClearTopics}
      />

      {/* Removed validation alert - the disabled Next button provides sufficient feedback */}
    </PageLayout>
    
  </>
  )
}

export default CourseSeedInput;