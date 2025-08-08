// External packages
import { useState, useEffect, useCallback, Suspense, lazy, useMemo, useRef } from 'react'

// Constants
import { COLORS, SPACING, DURATIONS } from '@/constants'

// Services
import { apiKeyStorage } from '@/services/ApiKeyStorage'

// Utils
import { logger } from '@/utils/logger'
import { debugLogger } from '@/utils/ultraSimpleLogger'
import { initializeLoggerConfig } from '@/config/loggerConfig'

// Initialize logger configuration to reduce console noise
initializeLoggerConfig()

// Styles - Emergency text visibility fix
// import './styles/ensure-text-visible.css' // Uncomment if text is not visible

// Components
import { CourseSeedInput } from '@/components/CourseSeedInput'
import { Button } from '@/components/DesignSystem'
import { DebugPanel } from '@/components/DebugPanel'

// Lazy load step components
const AIPromptGenerator = lazy(() => 
  import('@/components/AIPromptGenerator').then(m => ({ default: m.AIPromptGenerator }))
)
const JSONImportValidator = lazy(() => 
  import('@/components/JSONImportValidator').then(m => ({ default: m.JSONImportValidator }))
)
const MediaEnhancementWizard = lazy(() => 
  import('./components/MediaEnhancementWizard').then(m => ({ default: m.MediaEnhancementWizard }))
)
const AudioNarrationWizard = lazy(() => 
  import('./components/AudioNarrationWizard').then(m => ({ default: m.default }))
)
const ActivitiesEditor = lazy(() => 
  import('./components/ActivitiesEditor').then(m => ({ default: m.ActivitiesEditor }))
)
const SCORMPackageBuilder = lazy(() => 
  import('./components/SCORMPackageBuilder').then(m => ({ default: m.SCORMPackageBuilder }))
)
// Types
import type { CourseSeedData } from '@/types/course'
import type { CourseContent, CourseContentUnion, Topic } from '@/types/aiPrompt'
import type { ProjectData } from '@/types/project'

// Components
// DevTools removed - not needed
import { ErrorBoundary } from '@/components/ErrorBoundary'
// Lazy load dialog components
const Settings = lazy(() => 
  import('./components/Settings').then(m => ({ default: m.Settings }))
)
const HelpPage = lazy(() => 
  import('./components/HelpPage').then(m => ({ default: m.HelpPage }))
)
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { NetworkStatusIndicator } from '@/components/DesignSystem'
// LoadingComponent removed - using inline loading
const LoadingComponent = () => <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

// Lazy load export/import services
// const loadExportImport = () => import('@/services/ProjectExportImport')
// Hooks
import { useAutoSave } from '@/hooks/useAutoSave'
import { useStorage } from './contexts/PersistentStorageContext'
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor'
import { useDialogManager } from '@/hooks/useDialogManager'

// Contexts
import { StepNavigationProvider, useStepNavigation } from './contexts/StepNavigationContext'
import { AutoSaveProvider } from './contexts/AutoSaveContext'
import { UnifiedMediaProvider } from './contexts/UnifiedMediaContext'

// Config
import { envConfig } from '@/config/environment'

// Styles
import './App.css'


interface AppProps {
  onBackToDashboard?: () => void
  pendingProjectId?: string | null
  onPendingProjectHandled?: () => void
}

// Inner component that uses StepNavigationContext
function AppContent({ onBackToDashboard, pendingProjectId, onPendingProjectHandled }: AppProps) {
  const storage = useStorage()
  const navigation = useStepNavigation()
  const {
    activeDialog,
    projectToDelete,
    showDialog,
    hideDialog,
    setProjectToDelete: _setProjectToDelete,
  } = useDialogManager();
  const [currentStep, setCurrentStep] = useState('seed')
  const [courseSeedData, setCourseSeedData] = useState<CourseSeedData | null>(null)
  const [courseContent, setCourseContent] = useState<CourseContent | null>(null)

  // Set up debug log export on window close
  useEffect(() => {
    // This function will be called when the component unmounts
    let unlistenTauri: (() => void) | undefined;

    const setupTauriCloseHandler = async () => {
      // Check if running in Tauri environment
      if (window.__TAURI__) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const appWindow = getCurrentWindow();

          // Listen for the close request event
          unlistenTauri = await appWindow.onCloseRequested(async (event) => {
            // VERSION MARKER: v2.0.3 - Fixed infinite loop by unlistening before close
            debugLogger.info('App v2.0.3', 'Tauri window close requested - starting cleanup...');
            console.log('[App v2.0.3] Window close requested - preventing default for cleanup');
            
            // Prevent the window from closing immediately while we clean up
            event.preventDefault();

            // 1. Cancel any pending file saves
            if (storage?.fileStorage) {
              debugLogger.info('App v2.0.3', 'Cancelling pending saves...');
              storage.fileStorage.cancelAllPendingSaves();
            }

            // 2. Export debug logs (but don't await - too slow)
            debugLogger.info('App v2.0.3', 'Triggering debug log export...');
            const report = debugLogger.createBugReport();
            if (report) {
              // Fire and forget - don't await
              debugLogger.writeToFile({
                timestamp: new Date().toISOString(),
                level: 'info' as const,
                category: 'session-export',
                message: 'Session export on close',
                data: report
              });
            }
            
            // 3. CRITICAL: Unlisten to prevent infinite loop when we call close()
            debugLogger.info('App v2.0.3', 'Removing close handler to prevent recursion...');
            if (unlistenTauri) {
              unlistenTauri();
              unlistenTauri = undefined; // Clear reference
            }
            
            // 4. Close the window after a short delay to ensure cleanup
            debugLogger.info('App v2.0.3', 'Cleanup complete, closing window...');
            console.log('[App v2.0.3] Closing window now');
            
            // Use setTimeout to ensure the cleanup happens before close
            setTimeout(() => {
              appWindow.close();
            }, 100);
          });
        } catch (error) {
          debugLogger.error('App', 'Failed to set up Tauri close handler', error);
        }
      }
    };

    setupTauriCloseHandler();

    // Cleanup the event listener when the component unmounts
    return () => {
      unlistenTauri?.();
    };
  }, [storage])
  
  // Performance monitoring
  const { measureAsync } = usePerformanceMonitor({
    componentName: 'App',
    trackRenders: false,
    trackMountTime: true
  })
  
  // Debug effect to log state changes - DISABLED to prevent console spam
  // useEffect(() => {
  //   debugLogger.info('State changed:', {
  //     currentStep,
  //     hasCourseSeedData: !!courseSeedData,
  //     courseSeedDataKeys: courseSeedData ? Object.keys(courseSeedData) : null,
  //     hasCourseContent: !!courseContent,
  //     courseContentKeys: courseContent ? Object.keys(courseContent) : null
  //   })
  // }, [currentStep, courseSeedData, courseContent])
  // Load API keys from encrypted file or fall back to environment config
  const [apiKeys, setApiKeys] = useState({
    googleImageApiKey: envConfig.googleImageApiKey,
    googleCseId: envConfig.googleCseId,
    youtubeApiKey: envConfig.youtubeApiKey
  })
  
  // Save/Open state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastLoadedProjectId, setLastLoadedProjectId] = useState<string | null>(null)
  
  // Check for pending project when component mounts or pendingProjectId changes
  useEffect(() => {
    if (pendingProjectId && hasUnsavedChanges) {
      showDialog('unsaved');
    }
  }, [pendingProjectId, hasUnsavedChanges, showDialog])
  
  // Step mapping for progress indicator
  const stepNumbers = {
    seed: 0,
    prompt: 1,
    json: 2,
    media: 3,
    audio: 4,
    activities: 5,
    scorm: 6
  }
  
  // Track last saved time separately to avoid triggering auto-save
  const [lastSavedTime, setLastSavedTime] = useState<string>(new Date().toISOString())
  
  // Create project data for saving - memoized to prevent unnecessary re-renders
  const projectData: ProjectData = useMemo(() => {
    return courseSeedData ? {
      courseTitle: courseSeedData.courseTitle,
      courseSeedData: courseSeedData,
      courseContent: courseContent || undefined,
      currentStep: stepNumbers[currentStep as keyof typeof stepNumbers],
      lastModified: lastSavedTime, // Use stable value that only updates on actual saves
      mediaFiles: {},
      audioFiles: {}
    } : {
      courseTitle: '',
      courseSeedData: {
        courseTitle: '',
        difficulty: 3,
        customTopics: [],
        template: 'None',
        templateTopics: []
      },
      currentStep: 0,
      lastModified: lastSavedTime, // Use stable value
      mediaFiles: {},
      audioFiles: {}
    }
  }, [courseSeedData, courseContent, currentStep, lastSavedTime])
  
  // Load API keys on first load
  useEffect(() => {
    // Only remove truly obsolete localStorage data
    // Keep UI preferences and non-critical data in localStorage
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Reserved for future keyboard shortcuts
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showDialog])

  useEffect(() => {
    // Load API keys from encrypted file
    const loadApiKeys = async () => {
      try {
        const savedKeys = await apiKeyStorage.load()
        if (savedKeys) {
          setApiKeys(savedKeys)
          debugLogger.info('App.init', 'API keys loaded from encrypted file')
        } else {
          debugLogger.info('App.init', 'No API keys found, using environment defaults')
        }
      } catch (error) {
        debugLogger.error('App.init', 'Unexpected error loading API keys', error)
      }
    }
    loadApiKeys()
  }, [])

  // Load project data from PersistentStorage on mount
  useEffect(() => {
    if (!storage.currentProjectId || !storage.isInitialized) {
      debugLogger.info('App.loadProject', 'Skipping load - no project or storage not initialized', {
        currentProjectId: storage.currentProjectId,
        isInitialized: storage.isInitialized
      })
      return
    }
    
    // For new projects, we should always load even if it's the same ID
    // because the project might have just been created
    if (lastLoadedProjectId === storage.currentProjectId && courseSeedData) {
      debugLogger.info('App.loadProject', 'Skipping load - already loaded this project', {
        projectId: storage.currentProjectId,
        hasCourseSeedData: !!courseSeedData
      })
      return
    }

    const loadProjectData = async () => {
      debugLogger.info('App.loadProject', 'Starting to load project data', { 
        projectId: storage.currentProjectId 
      })
      setLastLoadedProjectId(storage.currentProjectId)
      try {
        let loadedCourseContent: CourseContent | null = null
        let loadedCourseSeedData: CourseSeedData | null = null
        let loadedStep = 'seed'

        await measureAsync('loadProjectData', async () => {
          // First, always try to load the courseSeedData
          debugLogger.info('App.loadProject', 'Loading courseSeedData from storage')
          const seedData = await storage.getContent('courseSeedData')
          if (seedData) {
            debugLogger.info('App.loadProject', 'Loaded courseSeedData', seedData)
            loadedCourseSeedData = seedData as CourseSeedData
          } else {
            debugLogger.warn('App.loadProject', 'No courseSeedData found in project, will try to reconstruct')
          }
          
          // Try to load course-content directly (for projects that saved complete content)
          const directCourseContent = await storage.getContent('course-content')
          if (directCourseContent) {
            debugLogger.info('App.loadProject', 'Loaded course-content directly from storage')
            loadedCourseContent = directCourseContent as CourseContent
            
            // Validate and fix fill-in-the-blank questions
            if (loadedCourseContent.topics) {
              loadedCourseContent.topics.forEach(topic => {
                if (topic.knowledgeCheck?.questions) {
                  topic.knowledgeCheck.questions.forEach(question => {
                    if (question.type === 'fill-in-the-blank' && !question.blank) {
                      console.warn(`[App] Fill-in-the-blank question missing blank property in topic ${topic.id}`)
                      // Create a default blank text if missing
                      question.blank = question.question || `The answer is _____.`
                    }
                  })
                }
              })
            }
          }
          
          // Get metadata (which now handles unified data model internally)
          const metadata = await storage.getCourseMetadata()
          debugLogger.info('App.loadProject', 'Loaded metadata', metadata)
          
          // If we don't have seedData but have metadata, reconstruct it
          if (!loadedCourseSeedData && metadata) {
            debugLogger.info('App.loadProject', 'Reconstructing courseSeedData from metadata')
            debugLogger.debug('App.loadProject', `Title from metadata: ${metadata.title} or courseTitle: ${metadata.courseTitle}`)
            loadedCourseSeedData = {
              courseTitle: metadata.title || metadata.courseTitle || '',
              difficulty: metadata.difficulty || 3,
              customTopics: metadata.topics || [],
              template: metadata.template || 'None',
              templateTopics: []
            }
            debugLogger.info('App.loadProject', 'Reconstructed courseSeedData', loadedCourseSeedData)
          }

          // Only try reconstruction if we didn't load course content directly
          if (!loadedCourseContent && metadata && metadata.topics && metadata.topics.length > 0) {
            debugLogger.info('App.loadProject', 'Course content not found directly, attempting reconstruction from individual pieces')
            const topics: Topic[] = []
            for (let i = 0; i < metadata.topics.length; i++) {
              const topicIdOrName = metadata.topics[i]
              const numericContentId = `content-${2 + i}`
              const topicContent = await storage.getContent(numericContentId)
              let fallbackContent = null
              if (!topicContent) {
                let oldTopicId: string
                if (typeof topicIdOrName === 'string' && !topicIdOrName.includes('-')) {
                  oldTopicId = topicIdOrName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                } else {
                  oldTopicId = topicIdOrName
                }
                fallbackContent = await storage.getContent(oldTopicId)
              }
              const finalContent = topicContent || fallbackContent
              if (finalContent) {
                topics.push({
                  id: `topic-${i}`,
                  title: finalContent.title || topicIdOrName,
                  content: finalContent.content,
                  narration: finalContent.narration || '',
                  imageKeywords: finalContent.imageKeywords || [],
                  imagePrompts: finalContent.imagePrompts || [],
                  videoSearchTerms: finalContent.videoSearchTerms || [],
                  duration: finalContent.duration || 5,
                  knowledgeCheck: finalContent.knowledgeCheck,
                  media: finalContent.media,
                } as Topic)
              } else if (typeof topicIdOrName === 'string') {
                topics.push({
                  id: `topic-${i}`,
                  title: topicIdOrName,
                  content: `<p>Content for ${topicIdOrName}</p>`,
                  narration: '',
                  imageKeywords: [],
                  imagePrompts: [],
                  videoSearchTerms: [],
                  duration: 5,
                } as Topic)
              }
            }

            if (topics.length > 0) {
              const assessment = await storage.getContent('assessment')
              const welcomePage = await storage.getContent('welcome')
              const learningObjectivesPage = await storage.getContent('objectives')
              const activities = await storage.getContent('activities')
              const quiz = await storage.getContent('quiz')

              if (assessment) {
                loadedCourseContent = {
                  topics,
                  welcomePage: welcomePage || { id: 'content-0', title: 'Welcome', content: metadata.welcomeContent || '', narration: '', imageKeywords: [], imagePrompts: [], videoSearchTerms: [], duration: 1 },
                  learningObjectivesPage: learningObjectivesPage || { id: 'content-1', title: 'Learning Objectives', content: metadata.objectives?.join('<br>') || '', narration: '', imageKeywords: [], imagePrompts: [], videoSearchTerms: [], duration: 1 },
                  objectives: metadata.objectives || [],
                  assessment,
                } as CourseContent
              } else if (activities || quiz) {
                loadedCourseContent = {
                  topics,
                  activities: activities || [],
                  quiz: quiz || { questions: [], passMark: 80 },
                } as any
              } else {
                loadedCourseContent = {
                  topics,
                  welcomePage: welcomePage || { id: 'content-0', title: 'Welcome', content: metadata.welcomeContent || '', narration: '', imageKeywords: [], imagePrompts: [], videoSearchTerms: [], duration: 1 },
                  learningObjectivesPage: learningObjectivesPage || { id: 'content-1', title: 'Learning Objectives', content: metadata.objectives?.join('<br>') || '', narration: '', imageKeywords: [], imagePrompts: [], videoSearchTerms: [], duration: 1 },
                  objectives: metadata.objectives || [],
                  assessment: { questions: [], passMark: 80, narration: null },
                } as CourseContent
              }
            }
          }
          
          // Load the current step (moved outside of reconstruction logic)
          const stepData = await storage.getContent('currentStep')
          if (stepData && stepData.step) {
            // Only validate step if it requires content
            if (stepData.step !== 'seed' && stepData.step !== 'prompt' && !loadedCourseContent?.topics?.length) {
              console.warn('Step requires courseContent but topics not found, defaulting to seed step')
              loadedStep = 'seed'
            } else {
              loadedStep = stepData.step
            }
          } else {
            // No saved step - intelligently detect based on content
            debugLogger.info('App.loadProject', 'No saved currentStep, detecting from content...')
            if (loadedCourseContent?.topics && loadedCourseContent.topics.length > 0) {
              // Check if we have media content
              const hasMedia = loadedCourseContent.topics.some(topic => 
                topic.media && topic.media.length > 0
              ) || (loadedCourseContent.welcomePage?.media && loadedCourseContent.welcomePage.media.length > 0)
              
              if (hasMedia) {
                debugLogger.info('App.loadProject', 'Content has media, setting step to activities')
                loadedStep = 'activities'
              } else {
                debugLogger.info('App.loadProject', 'Content has topics but no media, setting step to media')
                loadedStep = 'media'
              }
              
              // Save the detected step for next time
              try {
                await storage.saveContent('currentStep', { step: loadedStep })
                debugLogger.info('App.loadProject', 'Saved detected step', { step: loadedStep })
              } catch (error) {
                console.warn('[App] Failed to save detected step:', error)
              }
            } else if (loadedCourseSeedData) {
              debugLogger.info('App.loadProject', 'Has seed data but no content, setting step to prompt')
              loadedStep = 'prompt'
            }
          }
        })
        
        // Map audioIds from backend if courseContent was loaded
        if (loadedCourseContent && storage.currentProjectId) {
          try {
            // Audio IDs are now handled correctly by MediaService
            debugLogger.info('App.loadProject', 'Mapped audioIds from backend')
          } catch (error) {
            console.warn('[App] Failed to map audioIds from backend:', error)
          }
        }

        // Atomic state updates
        debugLogger.info('App.loadProject', 'About to update state', {
          loadedCourseSeedData,
          loadedCourseContent: loadedCourseContent ? 'present' : 'null',
          loadedStep
        })
        setCourseContent(loadedCourseContent)
        setCourseSeedData(loadedCourseSeedData)
        setCurrentStep(loadedStep)
        debugLogger.info('App.loadProject', 'State updated', { 
          step: loadedStep, 
          hasSeedData: !!loadedCourseSeedData, 
          hasContent: !!loadedCourseContent,
          courseSeedDataTitle: (loadedCourseSeedData as any)?.courseTitle
        })
        
        // Navigate to the current step and mark all previous steps as visited
        // This ensures that when loading a project at step N, all steps 0 through N are accessible
        if (loadedStep !== 'seed') {
          const targetStep = stepNumbers[loadedStep as keyof typeof stepNumbers]
          // Mark all steps from 0 to targetStep as visited
          for (let i = 0; i <= targetStep; i++) {
            navigation.navigateToStep(i)
          }
          // End at the target step
          navigation.navigateToStep(targetStep)
        } else {
          navigation.navigateToStep(0)
        }

      } catch (error) {
        console.error('Failed to load project data:', error)
      }
    }

    loadProjectData()
  }, [storage.currentProjectId, storage.isInitialized, lastLoadedProjectId, navigation, measureAsync])
  
  // Debug courseContent changes - DISABLED to prevent console spam
  // useEffect(() => {
  //   debugLogger.info('courseContent state updated:', courseContent)
  //   debugLogger.info('Current step when courseContent updates:', currentStep)
  // }, [courseContent, currentStep])

  // Track unsaved changes
  useEffect(() => {
    // Set unsaved changes if we have course data
    setHasUnsavedChanges(!!courseSeedData?.courseTitle)
  }, [courseSeedData, courseContent, currentStep])
  
  // Manual save functionality (shows toast)
  const handleSave = useCallback(async (data?: ProjectData) => {
    debugLogger.debug('App.handleSave', 'Called with data', data)
    debugLogger.debug('App.handleSave', 'Storage state', { initialized: storage.isInitialized, projectId: storage.currentProjectId })
    
    try {
      // Use passed data if provided, otherwise use state
      const dataToSave = data || projectData
      debugLogger.debug('App.handleSave', 'Data to save', dataToSave)
      
      // Save all data from all pages
      if (dataToSave.courseSeedData) {
        debugLogger.info('App.handleSave', 'Saving course metadata', dataToSave.courseSeedData)
        
        // Test for circular references
        try {
          JSON.stringify(dataToSave.courseSeedData)
        } catch (e) {
          debugLogger.error('App.handleSave', 'Circular reference in courseSeedData', { error: e, keys: Object.keys(dataToSave.courseSeedData) })
        }
        
        await storage.saveCourseMetadata(dataToSave.courseSeedData)
        await storage.saveContent('courseSeedData', dataToSave.courseSeedData)
      }
      if (dataToSave.courseContent) {
        await storage.saveContent('course-content', dataToSave.courseContent)
      }
      
      // AI prompt, audio settings, and SCORM config are now saved directly through storage
      // No need to check localStorage anymore
      
      await storage.saveProject()
      showToast('Project saved successfully', 'success')
      setHasUnsavedChanges(false)
      setLastSavedTime(new Date().toISOString()) // Update last saved time
      return { success: true }
    } catch (error: any) {
      console.error('[handleSave] Save error:', error)
      showToast( error.message || 'Failed to save project', 'error')
      return { success: false, error: error.message }
    }
  }, [storage, projectData, setLastSavedTime])

  // Autosave functionality (no toast)
  const handleAutosave = useCallback(async (data: ProjectData) => {
    try {
      // The data is passed directly from useAutoSave, no need for fallback
      const dataToSave = data
      
      // Save all data from all pages (same as manual save)
      if (dataToSave.courseSeedData) {
        await storage.saveCourseMetadata(dataToSave.courseSeedData)
        await storage.saveContent('courseSeedData', dataToSave.courseSeedData)
      }
      if (dataToSave.courseContent) {
        await storage.saveContent('course-content', dataToSave.courseContent)
      }
      
      // AI prompt, audio settings, and SCORM config are now saved directly through storage
      // No need to check localStorage anymore
      
      await storage.saveProject()
      setHasUnsavedChanges(false)
      setLastSavedTime(new Date().toISOString()) // Update last saved time
      return { success: true }
    } catch (error: any) {
      // Only show error toast for autosave failures
      showToast('Autosave failed', 'error')
      return { success: false, error: error.message }
    }
  }, [storage, setLastSavedTime])
  
  const autoSaveState = useAutoSave({
    data: projectData,
    onSave: handleAutosave,
    delay: DURATIONS.autosaveInterval,
    disabled: !storage.currentProjectId
  })
  
  // Safe toast setter that prevents duplicates and manages timeouts
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    // Clear existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
    }
    
    // Don't show duplicate messages
    if (toast?.message === message) {
      return
    }
    
    setToast({ message, type })
    
    // Set new timeout
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null)
      toastTimeoutRef.current = null
    }, DURATIONS.toastDuration)
  }, [toast])
  
  // Clear toast on navigation
  useEffect(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
    setToast(null)
  }, [currentStep])
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current)
      }
    }
  }, [])

  const handleCourseSeedSubmit = async (data: CourseSeedData) => {
    // VERSION MARKER: v2.0.2 - Returns Promise for proper async handling
    debugLogger.info('App.handleCourseSeedSubmit v2.0.2', 'Course seed data submitted', { title: data.courseTitle })
    try {
      await measureAsync('handleCourseSeedSubmit', async () => {
        // Create a new project if we don't have one - BEFORE setting state or navigating
        if (!storage.currentProjectId) {
          debugLogger.info('App.handleCourseSeedSubmit', 'Creating new project', { title: data.courseTitle })
          const project = await storage.createProject(data.courseTitle)
          if (!project || !project.id) {
            throw new Error('Failed to create project')
          }
          // Clear lastLoadedProjectId to force reload for new project
          setLastLoadedProjectId(null)
          debugLogger.info('App.handleCourseSeedSubmit', 'Project created, forcing reload', { 
            projectId: project.id,
            currentProjectId: storage.currentProjectId 
          })
        }
      
        // Now save the COMPLETE course seed data - not just metadata
        await storage.saveContent('courseSeedData', data)
        await storage.saveContent('currentStep', { step: 'prompt' })
        
        // Also save to metadata for backward compatibility
        await storage.saveCourseMetadata({
          courseTitle: data.courseTitle,
          difficulty: data.difficulty,
          topics: data.customTopics,
          template: data.template,
          lastModified: new Date().toISOString()
        })
        
        // Only update state and navigate after everything is saved successfully
        setCourseSeedData(data)
        setCurrentStep('prompt')
        navigation.navigateToStep(stepNumbers.prompt)
        setHasUnsavedChanges(true)
        
        // Return success to resolve the promise
        return true
      }) // End of measureAsync
    } catch (error) {
      console.error('Failed to save course seed data:', error)
      setToast({ 
        message: error instanceof Error ? error.message : 'Failed to save data', 
        type: 'error' 
      })
    }
  }

  const handlePromptNext = async () => {
    setCurrentStep('json')
    navigation.navigateToStep(stepNumbers.json)
    
    // Save current step to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'json' })
      } catch (error) {
        console.error('Failed to save current step:', error)
      }
    }
  }

  const handlePromptBack = async () => {
    setCurrentStep('seed')
    navigation.navigateToStep(stepNumbers.seed)
    
    // Save current step to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'seed' })
      } catch (error) {
        console.error('Failed to save current step:', error)
      }
    }
  }

  const handleJSONNext = async (data: CourseContent) => {
    setCourseContent(data)
    setCurrentStep('media')
    navigation.navigateToStep(stepNumbers.media)
    
    // Save to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await measureAsync('saveJSONContent', async () => {
        await storage.saveContent('currentStep', { step: 'media' })
        await storage.saveContent('course-content', data)
        
        // Save course metadata
        await storage.saveCourseMetadata({
          courseTitle: courseSeedData?.courseTitle || '',
          difficulty: courseSeedData?.difficulty || 3,
          objectives: data.objectives || [],
          welcomeContent: data.welcomePage?.content || '',
          topics: data.topics.map((_, i) => `topic-${i}`), // Always use numeric topic IDs
          lastModified: new Date().toISOString()
        })
        
        // Save welcome page if it exists (new format)
        if ('welcomePage' in data && data.welcomePage) {
          await storage.saveContent('welcome', data.welcomePage)
        }
        
        // Save learning objectives page if it exists (new format)
        if ('learningObjectivesPage' in data && data.learningObjectivesPage) {
          await storage.saveContent('objectives', data.learningObjectivesPage)
        }
        
        // Save each topic content with numeric IDs
        for (let i = 0; i < data.topics.length; i++) {
          const topic = data.topics[i]
          const numericContentId = `content-${2 + i}` // Topics start at content-2
          await storage.saveContent(numericContentId, {
            title: topic.title,
            content: topic.content,
            narration: topic.narration || '',
            imageKeywords: topic.imageKeywords || [],
            imagePrompts: topic.imagePrompts || [],
            videoSearchTerms: topic.videoSearchTerms || [],
            duration: topic.duration || 5,
            knowledgeCheck: topic.knowledgeCheck,
            media: topic.media
          })
        }
        }) // End of measureAsync
      } catch (error) {
        console.error('Failed to save course content:', error)
        showToast('Failed to save data', 'error')
      }
    }
  }

  const handleJSONBack = async () => {
    setCurrentStep('prompt')
    navigation.navigateToStep(stepNumbers.prompt)
    
    // Save current step to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'prompt' })
      } catch (error) {
        console.error('Failed to save current step:', error)
      }
    }
  }

  const handleMediaNext = async (data: CourseContentUnion) => {
    setCourseContent(data as CourseContent)
    setCurrentStep('audio')
    navigation.navigateToStep(stepNumbers.audio)
    
    // Save to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'audio' })
        
        const courseData = data as CourseContent
        // Update course metadata with media info
        await storage.saveCourseMetadata({
          courseTitle: courseSeedData?.courseTitle || '',
          difficulty: courseSeedData?.difficulty || 3,
          objectives: courseData.objectives || [],
          welcomeContent: courseData.welcomePage?.content || '',
          topics: courseData.topics.map((_, i) => `topic-${i}`), // Always use numeric topic IDs
          lastModified: new Date().toISOString()
        })
        
        // Update each topic with media using numeric IDs
        for (let i = 0; i < courseData.topics.length; i++) {
          const topic = courseData.topics[i]
          const numericContentId = `content-${2 + i}` // Topics start at content-2
          await storage.saveContent(numericContentId, {
            title: topic.title,
            content: topic.content,
            narration: topic.narration || '',
            imageKeywords: topic.imageKeywords || [],
            imagePrompts: topic.imagePrompts || [],
            videoSearchTerms: topic.videoSearchTerms || [],
            duration: topic.duration || 5,
            knowledgeCheck: topic.knowledgeCheck,
            media: topic.media
          })
          
          // Store media files if they exist
          if (topic.media) {
            for (const media of topic.media) {
              // Store media metadata association
              await storage.saveContent(`media_${media.id}`, {
                topicId: topic.id,
                mediaType: media.type,
                url: media.url,
                title: media.title
              })
            }
          }
        }
      } catch (error) {
        console.error('Failed to save media-enhanced content:', error)
        showToast('Failed to save data', 'error')
      }
    }
  }

  const handleMediaBack = async () => {
    setCurrentStep('json')
    navigation.navigateToStep(stepNumbers.json)
    
    // Save current step to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'json' })
      } catch (error) {
        console.error('Failed to save current step:', error)
      }
    }
  }

  const handleAudioNext = async (data: CourseContentUnion) => {
    setCourseContent(data as CourseContent)
    setCurrentStep('activities')
    navigation.navigateToStep(stepNumbers.activities)
    
    // Save to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'activities' })
        
        const courseData = data as CourseContent
        // Update course metadata
        await storage.saveCourseMetadata({
          courseTitle: courseSeedData?.courseTitle || '',
          difficulty: courseSeedData?.difficulty || 3,
          objectives: courseData.objectives || [],
          welcomeContent: courseData.welcomePage?.content || '',
          topics: courseData.topics.map((_, i) => `topic-${i}`), // Always use numeric topic IDs
          lastModified: new Date().toISOString()
        })
        
        // Update each topic with audio using numeric IDs
        for (let i = 0; i < courseData.topics.length; i++) {
          const topic = courseData.topics[i]
          const numericContentId = `content-${2 + i}` // Topics start at content-2
          await storage.saveContent(numericContentId, {
            title: topic.title,
            content: topic.content,
            narration: topic.narration || '',
            imageKeywords: topic.imageKeywords || [],
            imagePrompts: topic.imagePrompts || [],
            videoSearchTerms: topic.videoSearchTerms || [],
            duration: topic.duration || 5,
            knowledgeCheck: topic.knowledgeCheck,
            media: topic.media
          })
        }
      } catch (error) {
        console.error('Failed to save audio-enhanced content:', error)
        showToast('Failed to save data', 'error')
      }
    }
  }

  const handleAudioBack = async () => {
    setCurrentStep('media')
    navigation.navigateToStep(stepNumbers.media)
    
    // Save current step to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'media' })
      } catch (error) {
        console.error('Failed to save current step:', error)
      }
    }
  }

  const handleActivitiesNext = async (data: CourseContentUnion) => {
    setCourseContent(data as CourseContent)
    setCurrentStep('scorm')
    navigation.navigateToStep(stepNumbers.scorm)
    
    // Save to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'scorm' })
        
        const courseData = data as CourseContent
        // Update course metadata
        await storage.saveCourseMetadata({
          courseTitle: courseSeedData?.courseTitle || '',
          difficulty: courseSeedData?.difficulty || 3,
          objectives: courseData.objectives || [],
          welcomeContent: courseData.welcomePage?.content || '',
          topics: courseData.topics.map((_, i) => `topic-${i}`), // Always use numeric topic IDs
          lastModified: new Date().toISOString()
        })
        
        // Save assessment if it exists (new format)
        if ('assessment' in courseData && courseData.assessment) {
          await storage.saveContent('assessment', courseData.assessment)
        }
        
        // Save activities and quiz if they exist (legacy format)
        if ('activities' in courseData && courseData.activities) {
          await storage.saveContent('activities', courseData.activities)
        }
        if ('quiz' in courseData && courseData.quiz) {
          await storage.saveContent('quiz', courseData.quiz)
        }
        
        // Update each topic using numeric IDs
        for (let i = 0; i < courseData.topics.length; i++) {
          const topic = courseData.topics[i]
          const numericContentId = `content-${2 + i}` // Topics start at content-2
          await storage.saveContent(numericContentId, {
            title: topic.title,
            content: topic.content,
            narration: topic.narration || '',
            imageKeywords: topic.imageKeywords || [],
            imagePrompts: topic.imagePrompts || [],
            videoSearchTerms: topic.videoSearchTerms || [],
            duration: topic.duration || 5,
            knowledgeCheck: topic.knowledgeCheck,
            media: topic.media
          })
        }
      } catch (error) {
        console.error('Failed to save activities-enhanced content:', error)
        showToast('Failed to save data', 'error')
      }
    }
  }

  const handleActivitiesBack = async () => {
    setCurrentStep('audio')
    navigation.navigateToStep(stepNumbers.audio)
    
    // Save current step to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'audio' })
      } catch (error) {
        console.error('Failed to save current step:', error)
      }
    }
  }

  const handleSCORMNext = async () => {
    // Could show a completion screen or download the package
    showToast('SCORM package built successfully!', 'success')
    
    // Save completion state to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'scorm' })
        await storage.saveCourseMetadata({
          courseTitle: courseSeedData?.courseTitle || '',
          difficulty: courseSeedData?.difficulty || 3,
          objectives: courseContent?.objectives || [],
          welcomeContent: courseContent?.welcomePage?.content || '',
          topics: courseContent?.topics.map((_, i) => `topic-${i}`) || [], // Always use numeric topic IDs
          lastModified: new Date().toISOString(),
          completed: true
        })
      } catch (error) {
        console.error('Failed to save completion state:', error)
      }
    }
  }

  const handleSCORMBack = async () => {
    setCurrentStep('activities')
    navigation.navigateToStep(stepNumbers.activities)
    
    // Save current step to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'activities' })
      } catch (error) {
        console.error('Failed to save current step:', error)
      }
    }
  }

  const handleSettingsSave = (newApiKeys: typeof apiKeys) => {
    setApiKeys(newApiKeys)
    hideDialog();
    // Note: The Settings component already saves to localStorage
  }
  
  // Save functionality
  const handleManualSave = async (data?: CourseSeedData) => {
    debugLogger.debug('App.handleManualSave', 'Called', { data, projectId: storage.currentProjectId })
    
    // If no project is open, show error
    if (!storage.currentProjectId) {
      showToast('Please create or open a project first', 'error')
      return
    }
    
    // If data is provided from CourseSeedInput, update the course seed data
    if (data) {
      setCourseSeedData(data)
      // Save the updated data
      const updatedProjectData: ProjectData = {
        ...projectData,
        courseSeedData: data
      }
      await handleSave(updatedProjectData)
    } else {
      // Just save current state
      await handleSave()
    }
  }
  
  // Save As functionality
  const handleSaveAs = async () => {
    if (!storage.currentProjectId) {
      showToast('No project to save', 'error')
      return
    }
    
    try {
      await storage.saveProjectAs()
      showToast('Project saved to new file', 'success')
    } catch (error: any) {
      if (error.message !== 'User cancelled') {
        showToast( `Failed to save as: ${error.message}`, 'error')
      }
    }
  }
  
  // Open functionality
  const handleOpen = async () => {
    // If we have a dashboard callback, use it to go back to dashboard
    if (onBackToDashboard) {
      if (hasUnsavedChanges && courseSeedData?.courseTitle) {
        showDialog('unsaved');
      } else {
        // Go back to dashboard - the dashboard will handle project switching
        onBackToDashboard()
      }
    } else {
      // Otherwise show error as we should only use dashboard
      showToast('Please use the project dashboard to open projects', 'error')
    }
  }
  
  // Removed - using dashboard for project operations
  
  // Delete functionality - handled by dashboard
  
  // Duplicate functionality - handled by dashboard
  
  const handleConfirmDelete = async () => {
    if (projectToDelete) {
      try {
        await storage.deleteProject(projectToDelete.path || projectToDelete.id)
        showToast( `Deleted project: ${projectToDelete.name}`, 'success')
        if (storage.currentProjectId === projectToDelete.id) {
          // Current project was deleted, clear state and redirect to dashboard
          // Clear state since current project was deleted
          setCourseContent(null)
          setCourseSeedData(null)
          setCurrentStep('seed')
          // The dashboard will automatically show when currentProjectId is null
        }
      } catch (error: any) {
        showToast( error.message || 'Failed to delete project', 'error')
      }
    }
    hideDialog();
  }
  
  // Unsaved changes handling
  const handleSaveAndContinue = async () => {
    const result = await handleSave(projectData)
    if (result.success) {
      hideDialog();
      setHasUnsavedChanges(false)
      if (pendingProjectId) {
        // Handle pending project after save
        onPendingProjectHandled?.()
        // Only navigate back to dashboard if we're switching projects
        if (onBackToDashboard) {
          onBackToDashboard()
        }
      }
      // If no pendingProjectId, just continue with current workflow
    }
  }
  
  const handleDiscardChanges = async () => {
    hideDialog();
    setHasUnsavedChanges(false)
    if (pendingProjectId) {
      // Handle pending project after discard
      onPendingProjectHandled?.()
      // Only navigate back to dashboard if we're switching projects
      if (onBackToDashboard) {
        onBackToDashboard()
      }
    }
    // If no pendingProjectId, just continue with current workflow
  }
  
  // Export functionality - currently unused
  // const handleExport = async () => {
  //   try {
  //     const { exportProject } = await loadExportImport()
  //     const result = await exportProject({
  //       metadata: {
  //         version: '1.0',
  //         exportDate: new Date().toISOString(),
  //         projectName: projectData.courseTitle
  //       },
  //       courseData: {
  //         title: projectData.courseTitle,
  //         language: 'en',
  //         keywords: [],
  //         topics: courseContent?.topics.map((topic: Topic) => ({
  //           title: topic.title,
  //           content: topic.content,
  //           media: topic.media?.map((m: Media) => ({
  //             id: m.id,
  //             type: m.type as 'image' | 'audio' | 'youtube',
  //             url: m.url,
  //             name: m.title,
  //             filename: m.title
  //           }))
  //         })) || []
  //       },
  //       media: {
  //         images: [],
  //         audio: [],
  //         captions: []
  //       }
  //     })
  //     
  //     if (!result.success || !result.blob || !result.filename) {
  //       throw new Error(result.error || 'Export failed')
  //     }
  //     
  //     const { blob, filename } = result
  //     
  //     // Download the file
  //     const url = URL.createObjectURL(blob)
  //     const link = document.createElement('a')
  //     link.href = url
  //     link.download = filename
  //     document.body.appendChild(link)
  //     link.click()
  //     link.remove()
  //     URL.revokeObjectURL(url)
  //     
  //     showToast('Project exported successfully', 'success')
  //   } catch (error) {
  //     showToast('Failed to export project', 'error')
  //   }
  // }
  
  // Import functionality - currently unused
  // const handleImport = async () => {
  //   const input = document.createElement('input')
  //   input.type = 'file'
  //   input.accept = '.zip,.json'
  //   
  //   input.onchange = async (e) => {
  //     const file = (e.target as HTMLInputElement).files?.[0]
  //     if (!file) return
  //     
  //     const { importProject } = await loadExportImport()
  //     const result = await importProject(file)
  //     
  //     if (result.success && result.data) {
  //       // Import functionality is not fully implemented for the new format
  //       // For now, just show an error
  //       showToast('Import functionality needs to be updated for the new format', 'error')
  //     } else {
  //       showToast( result.error || 'Failed to import project', 'error')
  //     }
  //   }
  //   
  //   input.click()
  // }

  // Handle step navigation from progress indicator
  const handleStepClick = async (stepIndex: number) => {
    // Check if navigation is allowed
    if (!navigation.canNavigateToStep(stepIndex)) {
      return
    }
    
    const stepMapping = Object.entries(stepNumbers).find(
      ([_, num]) => num === stepIndex
    )
    if (stepMapping) {
      setCurrentStep(stepMapping[0])
      navigation.navigateToStep(stepIndex)
      
      // Save current step to PersistentStorage
      if (storage.currentProjectId) {
        try {
          await storage.saveContent('currentStep', { step: stepMapping[0] })
        } catch (error) {
          console.error('Failed to save current step:', error)
        }
      }
    }
  }

  // Set up keyboard shortcuts manually
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (!activeDialog) {
          handleManualSave()
        }
      }
      // Ctrl/Cmd + O: Open
      else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        if (!activeDialog) {
          handleOpen()
        }
      }
      // F1: Help
      else if (e.key === 'F1') {
        e.preventDefault()
        if (activeDialog !== 'settings') {
          showDialog('help');
        }
      }
      // Ctrl/Cmd + ,: Settings
      else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        if (activeDialog !== 'help') {
          showDialog('settings');
        }
      }
      // Ctrl/Cmd + Shift + D: Toggle Debug Mode
      else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        const debugLogger = (window as any).debugLogger
        if (debugLogger) {
          if (debugLogger.isDebugMode()) {
            debugLogger.disable()
          } else {
            debugLogger.enable()
          }
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeDialog, handleManualSave, handleOpen, showDialog])


  return (
    <ErrorBoundary>
      <UnifiedMediaProvider projectId={storage.currentProjectId || ''}>
        <div style={{ backgroundColor: COLORS.background, color: COLORS.textMuted, minHeight: '100vh' }}>
        {/* Network status indicator */}
        <NetworkStatusIndicator />
      
      {/* Skip navigation link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      <main id="main-content">
        {activeDialog === 'settings' && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 50,
              padding: '1rem'
            }}
            onClick={(e) => {
              // Don't close modal when clicking on backdrop
              e.stopPropagation()
            }}
          >
            <div style={{
              position: 'relative',
              maxWidth: '64rem',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <button
                onClick={hideDialog}
                className="close-button"
                style={{
                  position: 'absolute',
                  top: SPACING.lg,
                  right: SPACING.lg,
                  zIndex: 10,
                  backgroundColor: COLORS.backgroundLighter,
                  color: COLORS.text,
                  borderRadius: '50%',
                  padding: SPACING.sm,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.25rem',
                  width: '2.5rem',
                  height: '2.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                aria-label="Close Settings"
                type="button"
              >
                <span aria-hidden="true">✕</span>
              </button>
              <Suspense fallback={<LoadingComponent />}>
                <Settings onSave={handleSettingsSave} />
              </Suspense>
            </div>
          </div>
        )}
        
        {activeDialog === 'help' && (
          <Suspense fallback={<LoadingComponent />}>
            <HelpPage onBack={hideDialog} />
          </Suspense>
        )}
        
        {!activeDialog && (
          <AutoSaveProvider 
            isSaving={autoSaveState.isSaving}
            lastSaved={autoSaveState.lastSaved}
            hasUnsavedChanges={hasUnsavedChanges}
          >
            {currentStep === 'seed' && (
              <CourseSeedInput 
                onSettingsClick={() => showDialog('settings')}
                onHelp={() => showDialog('help')}
                onSave={(content?: any) => {
                  if (content) {
                    setCourseSeedData(content);
                    handleManualSave();
                  } else {
                    handleManualSave();
                  }
                }}
                onSubmit={handleCourseSeedSubmit}
                onStepClick={handleStepClick}
                initialData={courseSeedData || undefined}
              />
            )}
          
            {currentStep === 'prompt' && courseSeedData && (
              <Suspense fallback={<LoadingComponent />}>
                <AIPromptGenerator
                  courseSeedData={courseSeedData}
                  onNext={handlePromptNext}
                  onBack={handlePromptBack}
                  onSettingsClick={() => showDialog('settings')}
                  onHelp={() => showDialog('help')}
                  onSave={(content?: any, silent?: boolean) => {
                  if (content) {
                    setCourseContent(content);
                    if (!silent) {
                      handleManualSave();
                    }
                  } else if (!silent) {
                    handleManualSave();
                  }
                }}
                  onSaveAs={handleSaveAs}
                  onOpen={handleOpen}
                  onStepClick={handleStepClick}
                />
              </Suspense>
            )}
            
            {currentStep === 'json' && (
              <Suspense fallback={<LoadingComponent />}>
                <JSONImportValidator
                  onNext={handleJSONNext}
                  onBack={handleJSONBack}
                  onSettingsClick={() => showDialog('settings')}
                  onHelp={() => showDialog('help')}
                  onSave={(content?: any, silent?: boolean) => {
                  if (content) {
                    setCourseContent(content);
                    if (!silent) {
                      handleManualSave();
                    }
                  } else if (!silent) {
                    handleManualSave();
                  }
                }}
                  onSaveAs={handleSaveAs}
                  onOpen={handleOpen}
                  onStepClick={handleStepClick}
                />
              </Suspense>
            )}
            
            {currentStep === 'media' && (
              <Suspense fallback={<LoadingComponent />}>
                {courseContent && courseSeedData ? (
                  <MediaEnhancementWizard
                    courseContent={courseContent}
                    courseSeedData={courseSeedData}
                    onUpdateContent={(content) => {
                      debugLogger.info('App.MediaEnhancement', 'Updating courseContent with media');
                      // Type guard to ensure we have CourseContent, not LegacyCourseContent
                      if ('welcomePage' in content) {
                        setCourseContent(content as CourseContent);
                        // Save the updated content to backend
                        handleSave({
                          ...projectData,
                          courseContent: content as CourseContent
                        });
                      }
                    }}
                    onNext={handleMediaNext}
                    onBack={handleMediaBack}
                    apiKeys={apiKeys}
                    onSettingsClick={() => showDialog('settings')}
                    onHelp={() => showDialog('help')}
                    onSave={(content?: any, silent?: boolean) => {
                    if (content) {
                      setCourseContent(content);
                      if (!silent) {
                        handleManualSave();
                      }
                    } else if (!silent) {
                      handleManualSave();
                    }
                  }}
                    onSaveAs={handleSaveAs}
                    onOpen={handleOpen}
                    onStepClick={handleStepClick}
                  />
                ) : (
                  <div style={{ 
                    padding: '2rem', 
                    textAlign: 'center',
                    backgroundColor: COLORS.background,
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <h2 style={{ color: COLORS.text, marginBottom: SPACING.lg }}>Loading Course Content...</h2>
                    <p style={{ color: COLORS.textMuted, marginBottom: SPACING.xl }}>
                      {!courseContent ? 'Course content is not available. Please go back to the JSON Import step.' : 'Course seed data is missing.'}
                    </p>
                    <Button onClick={handleMediaBack} variant="secondary">
                      Go Back
                    </Button>
                  </div>
                )}
              </Suspense>
            )}
            
            {currentStep === 'audio' && courseContent && courseSeedData && (
              <Suspense fallback={<LoadingComponent />}>
                <AudioNarrationWizard
                  courseContent={courseContent}
                  courseSeedData={courseSeedData}
                  onNext={handleAudioNext}
                  onBack={handleAudioBack}
                  onSettingsClick={() => showDialog('settings')}
                  onHelp={() => showDialog('help')}
                  onSave={async (content?: any, silent?: boolean) => {
                  logger.log('[App] AudioNarrationWizard onSave called', { hasContent: !!content, silent })
                  
                  if (content) {
                    // Update local state with the new content
                    setCourseContent(content);
                    
                    // If not silent, save to storage with updated content
                    if (!silent) {
                      logger.log('[App] Saving updated content from AudioNarrationWizard')
                      // Create updated project data for save
                      const updatedProjectData = {
                        ...projectData,
                        courseContent: content
                      };
                      await handleSave(updatedProjectData);
                    } else {
                      // For silent saves, just save to storage without toast
                      logger.log('[App] Silent save from AudioNarrationWizard')
                      if (storage.currentProjectId) {
                        await storage.saveContent('course-content', content);
                      }
                    }
                  } else if (!silent) {
                    // No content provided, just trigger a regular save
                    await handleManualSave();
                  }
                }}
                  onSaveAs={handleSaveAs}
                  onOpen={handleOpen}
                  onStepClick={handleStepClick}
                />
              </Suspense>
            )}
            
            {currentStep === 'activities' && courseContent && courseSeedData && (
              <Suspense fallback={<LoadingComponent />}>
                <ActivitiesEditor
                  courseContent={courseContent}
                  courseSeedData={courseSeedData}
                  onNext={handleActivitiesNext}
                  onBack={handleActivitiesBack}
                  onSettingsClick={() => showDialog('settings')}
                  onHelp={() => showDialog('help')}
                  onSave={(content?: any, silent?: boolean) => {
                  if (content) {
                    setCourseContent(content);
                    if (!silent) {
                      handleManualSave();
                    }
                  } else if (!silent) {
                    handleManualSave();
                  }
                }}
                  onSaveAs={handleSaveAs}
                  onOpen={handleOpen}
                  onStepClick={handleStepClick}
                />
              </Suspense>
            )}
            
            {currentStep === 'scorm' && (
              <Suspense fallback={<LoadingComponent />}>
                {(() => {
                  // Debug logging removed to prevent excessive console output
                  
                  if (!courseContent || !courseSeedData) {
                    return (
                      <div style={{ padding: '2rem', color: 'red' }}>
                        <h2>Missing Required Data</h2>
                        <p>Course Content: {courseContent ? 'Present' : 'Missing'}</p>
                        <p>Course Seed Data: {courseSeedData ? 'Present' : 'Missing'}</p>
                        {courseSeedData && <pre>{JSON.stringify(courseSeedData, null, 2)}</pre>}
                      </div>
                    );
                  }
                  
                  return (
                    <SCORMPackageBuilder
                      courseContent={courseContent}
                      courseSeedData={courseSeedData}
                      onNext={handleSCORMNext}
                  onBack={handleSCORMBack}
                  onSettingsClick={() => showDialog('settings')}
                  onHelp={() => showDialog('help')}
                  onSave={(content?: any, silent?: boolean) => {
                  if (content) {
                    setCourseContent(content);
                    if (!silent) {
                      handleManualSave();
                    }
                  } else if (!silent) {
                    handleManualSave();
                  }
                }}
                  onSaveAs={handleSaveAs}
                  onOpen={handleOpen}
                  onStepClick={handleStepClick}
                    />
                  );
                })()}
              </Suspense>
            )}
          </AutoSaveProvider>
        )}
      </main>
      
      
      {/* Dialogs */}
      <DeleteConfirmDialog
        isOpen={activeDialog === 'delete'}
        projectName={projectToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={hideDialog}
      />
      
      <UnsavedChangesDialog
        isOpen={activeDialog === 'unsaved'}
        currentProjectName={courseSeedData?.courseTitle || 'Current Project'}
        onSave={handleSaveAndContinue}
        onDiscard={handleDiscardChanges}
        onCancel={hideDialog}
      />
      
      
      {/* Toast notification */}
      {toast && (
        <div
          data-testid="toast-notification"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: toast.type === 'success' ? COLORS.success : toast.type === 'error' ? COLORS.error : COLORS.primary,
            color: 'white',
            padding: '1rem 1.5rem',
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          {toast.message}
        </div>
      )}
      
      {/* Debug Panel - Always accessible */}
      <DebugPanel />
      
      </div>
      </UnifiedMediaProvider>
    </ErrorBoundary>
  )
}

// Inner wrapper that has access to storage context
function AppWithNavigation(props: AppProps) {
  // Get initial step from the component state if available
  const initialStep = 0 // Start at step 0 (seed)
  
  return (
    <StepNavigationProvider initialStep={initialStep}>
      <AppContent {...props} />
    </StepNavigationProvider>
  )
}

// Wrapper component that provides contexts
function App(props: AppProps = {}) {
  return <AppWithNavigation {...props} />
}

export default App