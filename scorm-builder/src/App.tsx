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
import { createMutationSafeContent, validateImmutableUpdate } from '@/utils/mutationSafety'
import { cleanupOrphanedMediaReferences } from '@/utils/orphanedMediaCleaner'

// Initialize logger configuration to reduce console noise
initializeLoggerConfig()

// Styles - Emergency text visibility fix
// import './styles/ensure-text-visible.css' // Uncomment if text is not visible

// Components
import { CourseSeedInput } from '@/components/CourseSeedInput'
import { Button } from '@/components/DesignSystem'
import { StatusPanel } from '@/components/StatusPanel'

// Lazy load step components
const AIPromptGenerator = lazy(() => 
  import('@/components/AIPromptGenerator')
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
import type { CourseContent, CourseContentUnion, Topic, Media } from '@/types/aiPrompt'
import type { ProjectData } from '@/types/project'

// Type guards
function isNewFormat(content: CourseContentUnion): content is CourseContent {
  return content != null && 'welcomePage' in content && 'learningObjectivesPage' in content && 'assessment' in content
}

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
import { useStatusMessages } from '@/hooks/useStatusMessages'

// Contexts
import { StepNavigationProvider, useStepNavigation } from './contexts/StepNavigationContext'
import { AutoSaveProvider } from './contexts/AutoSaveContext'
import { UnifiedMediaProvider, useUnifiedMedia } from './contexts/UnifiedMediaContext'
import { useNotifications } from './contexts/NotificationContext'
import { useUnsavedChanges } from './contexts/UnsavedChangesContext'
import MediaLoadingOverlay from './components/MediaLoadingOverlay'
import ProjectLoadingOverlay from './components/ProjectLoadingOverlay'

// Config
import { envConfig } from '@/config/environment'

// Styles
import './App.css'


interface AppProps {
  onBackToDashboard?: () => void
  pendingProjectId?: string | null
  onPendingProjectHandled?: () => void
}

// Stable empty objects to prevent unnecessary projectData recalculations
const EMPTY_MEDIA_FILES = {}
const EMPTY_AUDIO_FILES = {}
const EMPTY_CUSTOM_TOPICS: string[] = []

// DEBUG: Track loadProject calls to identify infinite loops
let loadProjectCallCount = 0

// Inner component that uses StepNavigationContext
function AppContent({ onBackToDashboard, pendingProjectId, onPendingProjectHandled }: AppProps) {
  const storage = useStorage()
  const navigation = useStepNavigation()
  const { hasUnsavedChanges, resetAll: resetAllUnsavedChanges, markDirty } = useUnsavedChanges()
  const {
    activeDialog,
    projectToDelete,
    showDialog,
    hideDialog,
  } = useDialogManager();
  const statusMessages = useStatusMessages();
  const { deleteAllMedia, getMedia } = useUnifiedMedia();
  
  // Focus management for modals
  const settingsCloseButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  
  const [currentStep, setCurrentStep] = useState('seed')
  const [courseSeedData, setCourseSeedData] = useState<CourseSeedData | null>(null)
  const [courseContent, setCourseContent] = useState<CourseContent | null>(null)
  const [isStatusPanelDocked, setIsStatusPanelDocked] = useState(true)

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

            // 2. Save current course seed data before closing
            if (storage?.saveCourseSeedData && courseSeedData) {
              debugLogger.info('App v2.0.3', 'Flushing course seed data...');
              try {
                await storage.saveCourseSeedData(courseSeedData);
                debugLogger.info('App v2.0.3', 'Course seed data saved successfully');
              } catch (error) {
                debugLogger.error('App v2.0.3', 'Failed to save seed data on close', error);
              }
            }

            // 3. Export debug logs (but don't await - too slow)
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
            
            // 4. CRITICAL: Unlisten to prevent infinite loop when we call close()
            debugLogger.info('App v2.0.3', 'Removing close handler to prevent recursion...');
            if (unlistenTauri) {
              unlistenTauri();
              unlistenTauri = undefined; // Clear reference
            }
            
            // 5. Close the window after a short delay to ensure cleanup
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
  
  // Use notification context instead of local toast state
  const { success, error: showError, info } = useNotifications()
  const [pendingNavigationAction, setPendingNavigationAction] = useState<(() => void) | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState<{
    current: number
    total: number
    phase: string
  } | undefined>()
  
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
  // Using useRef instead of useState to prevent re-renders that trigger autosave loops
  const lastSavedTimeRef = useRef<string>(new Date().toISOString())
  
  // Track if we have already loaded this project to prevent duplicate loads
  const hasLoadedProjectRef = useRef<string | null>(null)
  
  // Create stable data snapshot for autosave
  const autoSaveDataRef = useRef<ProjectData | null>(null)
  
  // Update autoSaveDataRef whenever project data changes
  // The useAutoSave hook will only save when hasUnsavedChanges is true, but the ref needs current data
  useEffect(() => {
    if (courseSeedData) {
      autoSaveDataRef.current = {
        courseTitle: courseSeedData.courseTitle,
        courseSeedData: courseSeedData,
        courseContent: courseContent || undefined,
        currentStep: currentStep,
        lastModified: lastSavedTimeRef.current,
        mediaFiles: EMPTY_MEDIA_FILES,
        audioFiles: EMPTY_AUDIO_FILES
      }
    }
  }, [courseSeedData, courseContent, currentStep]) // Update ref when data changes, autosave controlled by hasUnsavedChanges
  
  // Create project data for saving - memoized to prevent unnecessary re-renders
  // IMPORTANT: lastModified is NOT included in dependencies to prevent autosave loop
  const projectData: ProjectData = useMemo(() => {
    debugLogger.debug('App.projectData', 'Recalculating projectData useMemo', {
      hasSeedData: !!courseSeedData,
      hasContent: !!courseContent,
      currentStep,
      seedDataTitle: courseSeedData?.courseTitle
    })
    
    return courseSeedData ? {
      courseTitle: courseSeedData.courseTitle,
      courseSeedData: courseSeedData,
      courseContent: courseContent || undefined,
      currentStep: currentStep,
      lastModified: lastSavedTimeRef.current, // Include in data but not dependencies
      mediaFiles: EMPTY_MEDIA_FILES, // Use stable reference
      audioFiles: EMPTY_AUDIO_FILES   // Use stable reference
    } : {
      courseTitle: '',
      courseSeedData: {
        courseTitle: '',
        difficulty: 3,
        customTopics: EMPTY_CUSTOM_TOPICS, // Use stable reference
        template: 'None',
        templateTopics: EMPTY_CUSTOM_TOPICS // Use stable reference
      },
      currentStep: 'seed',
      lastModified: lastSavedTimeRef.current, // Include in data but not dependencies
      mediaFiles: EMPTY_MEDIA_FILES, // Use stable reference
      audioFiles: EMPTY_AUDIO_FILES   // Use stable reference
    }
  }, [courseSeedData, courseContent, currentStep]) // lastSavedTime removed from deps
  
  // Load API keys on first load
  useEffect(() => {
    // Only remove truly obsolete localStorage data
    // Keep UI preferences and non-critical data in localStorage
    
    const handleKeyDown = () => {
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
    // Reset counters when project ID changes
    if (hasLoadedProjectRef.current !== storage.currentProjectId) {
      loadProjectCallCount = 0
      hasLoadedProjectRef.current = null
    }
    
    // DEBUG: Track how many times this effect runs
    loadProjectCallCount++
    console.log(`[DEBUG] loadProject useEffect called ${loadProjectCallCount} times for project:`, storage.currentProjectId)
    if (loadProjectCallCount > 3) {
      console.error('[ERROR] loadProject called too many times! This indicates an infinite loop.')
      console.trace('Stack trace for excessive loadProject calls')
      return
    }
    
    if (!storage.currentProjectId || !storage.isInitialized) {
      debugLogger.info('App.loadProject', 'Skipping load - no project or storage not initialized', {
        currentProjectId: storage.currentProjectId,
        isInitialized: storage.isInitialized
      })
      
      // If no project ID, reset the tracking refs to allow loading next project
      if (!storage.currentProjectId) {
        hasLoadedProjectRef.current = null
        loadProjectCallCount = 0
      }
      return
    }
    
    // Check if already loading - CRITICAL: Do this check first
    if (isLoadingProject) {
      debugLogger.info('App.loadProject', 'Already loading project, skipping duplicate load')
      return
    }
    
    // Use hasLoadedProjectRef to prevent duplicate loads
    if (hasLoadedProjectRef.current === storage.currentProjectId) {
      debugLogger.info('App.loadProject', 'Skipping load - already loaded this project', {
        projectId: storage.currentProjectId
      })
      return
    }

    // IMPORTANT: Set loading state IMMEDIATELY to prevent race conditions
    setIsLoadingProject(true)

    const loadProjectData = async () => {
      setLoadingProgress({ current: 0, total: 5, phase: 'Initializing...' })
      debugLogger.info('App.loadProject', 'Starting to load project data', { 
        projectId: storage.currentProjectId 
      })
      hasLoadedProjectRef.current = storage.currentProjectId
      try {
        let loadedCourseContent: CourseContent | null = null
        let loadedCourseSeedData: CourseSeedData | null = null
        let loadedStep = 'seed'

        await measureAsync('loadProjectData', async () => {
          // First, always try to load the courseSeedData using the helper method
          setLoadingProgress({ current: 1, total: 5, phase: 'Loading course metadata...' })
          debugLogger.info('App.loadProject', 'Loading courseSeedData from storage')
          const seedData = await storage.getCourseSeedData()
          if (seedData) {
            debugLogger.info('App.loadProject', 'Loaded courseSeedData', seedData)
            
            // Handle both wrapped and unwrapped data formats
            // Sometimes data comes back wrapped with cache metadata: {data: {...}, key: "...", retryCount: 0, timestamp: ...}
            if (seedData && typeof seedData === 'object' && 'data' in seedData && typeof seedData.data === 'object') {
              debugLogger.info('App.loadProject', 'Unwrapping cached courseSeedData')
              loadedCourseSeedData = seedData.data as CourseSeedData
            } else {
              // Direct format
              loadedCourseSeedData = seedData as CourseSeedData
            }
          } else {
            debugLogger.warn('App.loadProject', 'No courseSeedData found in project')
          }
          
          // Try to load course-content directly (for projects that saved complete content)
          setLoadingProgress({ current: 2, total: 5, phase: 'Loading course content...' })
          const directCourseContent = await storage.getCourseContent()
          if (directCourseContent) {
            debugLogger.info('App.loadProject', 'Loaded course-content directly from storage')
            loadedCourseContent = directCourseContent as CourseContent
            
            // Also load audioNarration and media-enhancements to populate media arrays
            setLoadingProgress({ current: 3, total: 5, phase: 'Loading media data...' })
            const audioNarrationData = await storage.getContent('audioNarration')
            const mediaEnhancementsData = await storage.getContent('media-enhancements')
            
            debugLogger.info('App.loadProject', 'Loading media persistence data', {
              hasAudioNarration: !!audioNarrationData,
              hasMediaEnhancements: !!mediaEnhancementsData
            })
            
            // Populate media arrays with saved media IDs if they exist
            if (loadedCourseContent && (audioNarrationData || mediaEnhancementsData)) {
              // Process welcome page
              if (loadedCourseContent.welcomePage) {
                if (!loadedCourseContent.welcomePage.media) {
                  loadedCourseContent.welcomePage.media = []
                }
                // Add audio references - handle both string IDs and object formats
                if (audioNarrationData?.welcome) {
                  let audioId: string | null = null
                  
                  // Handle different audio data formats
                  if (typeof audioNarrationData.welcome === 'string') {
                    audioId = audioNarrationData.welcome
                  } else if (audioNarrationData.welcome && typeof audioNarrationData.welcome === 'object' && audioNarrationData.welcome.id) {
                    audioId = audioNarrationData.welcome.id
                  }
                  
                  if (audioId) {
                    const audioItem = { 
                      id: audioId,
                      type: 'audio' as const,
                      url: '',
                      title: 'Audio Narration',
                      pageId: 'welcome'
                    }
                    if (!loadedCourseContent.welcomePage.media.some(m => m.id === audioItem.id)) {
                      loadedCourseContent.welcomePage.media.push(audioItem)
                    }
                  }
                }
                // Add media enhancement references
                if (mediaEnhancementsData?.welcome) {
                  const mediaItems = Array.isArray(mediaEnhancementsData.welcome) 
                    ? mediaEnhancementsData.welcome 
                    : [mediaEnhancementsData.welcome]
                  mediaItems.forEach((item: Media) => {
                    if (loadedCourseContent && !loadedCourseContent.welcomePage!.media!.some(m => m.id === item.id)) {
                      loadedCourseContent.welcomePage!.media!.push(item)
                    }
                  })
                }
              }
              
              // Process learning objectives page
              if (loadedCourseContent.learningObjectivesPage) {
                if (!loadedCourseContent.learningObjectivesPage.media) {
                  loadedCourseContent.learningObjectivesPage.media = []
                }
                // Add audio references - handle both string IDs and object formats
                if (audioNarrationData?.objectives) {
                  let audioId: string | null = null
                  
                  // Handle different audio data formats
                  if (typeof audioNarrationData.objectives === 'string') {
                    audioId = audioNarrationData.objectives
                  } else if (audioNarrationData.objectives && typeof audioNarrationData.objectives === 'object' && audioNarrationData.objectives.id) {
                    audioId = audioNarrationData.objectives.id
                  }
                  
                  if (audioId) {
                    const audioItem = {
                      id: audioId,
                      type: 'audio' as const,
                      url: '',
                      title: 'Audio Narration',
                      pageId: 'objectives'
                    }
                    if (!loadedCourseContent.learningObjectivesPage.media.some(m => m.id === audioItem.id)) {
                      loadedCourseContent.learningObjectivesPage.media.push(audioItem)
                    }
                  }
                }
                // Add media enhancement references
                if (mediaEnhancementsData?.objectives) {
                  const mediaItems = Array.isArray(mediaEnhancementsData.objectives)
                    ? mediaEnhancementsData.objectives
                    : [mediaEnhancementsData.objectives]
                  mediaItems.forEach((item: Media) => {
                    if (loadedCourseContent && !loadedCourseContent.learningObjectivesPage!.media!.some(m => m.id === item.id)) {
                      loadedCourseContent.learningObjectivesPage!.media!.push(item)
                    }
                  })
                }
              }
              
              // Process topics
              if (loadedCourseContent.topics) {
                loadedCourseContent.topics.forEach((topic, index) => {
                  if (!topic.media) {
                    topic.media = []
                  }
                  const topicKey = `topic-${index}`
                  
                  // Add audio references - handle both string IDs and object formats
                  if (audioNarrationData?.[topicKey]) {
                    let audioId: string | null = null
                    
                    // Handle different audio data formats
                    if (typeof audioNarrationData[topicKey] === 'string') {
                      audioId = audioNarrationData[topicKey]
                    } else if (audioNarrationData[topicKey] && typeof audioNarrationData[topicKey] === 'object' && audioNarrationData[topicKey].id) {
                      audioId = audioNarrationData[topicKey].id
                    }
                    
                    if (audioId) {
                      const audioItem = {
                        id: audioId,
                        type: 'audio' as const,
                        url: '',
                        title: 'Audio Narration',
                        pageId: topicKey
                      }
                      if (!topic.media.some(m => m.id === audioItem.id)) {
                        topic.media.push(audioItem)
                      }
                    }
                  }
                  
                  // Add media enhancement references
                  if (mediaEnhancementsData?.[topicKey]) {
                    const mediaItems = Array.isArray(mediaEnhancementsData[topicKey])
                      ? mediaEnhancementsData[topicKey]
                      : [mediaEnhancementsData[topicKey]]
                    mediaItems.forEach((item: Media) => {
                      if (!topic.media!.some(m => m.id === item.id)) {
                        topic.media!.push(item)
                      }
                    })
                  }
                })
              }
              
              debugLogger.info('App.loadProject', 'Populated media arrays from persistence data')
            }
            
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
        setLoadingProgress({ current: 4, total: 5, phase: 'Finalizing...' })
        debugLogger.info('App.loadProject', 'About to update state', {
          loadedCourseSeedData,
          loadedCourseContent: loadedCourseContent ? 'present' : 'null',
          loadedStep
        })
        setCourseContent(loadedCourseContent)
        setCourseSeedData(loadedCourseSeedData)
        setCurrentStep(loadedStep)
        
        // Update autosave ref immediately with loaded data
        if (loadedCourseSeedData) {
          const seedData = loadedCourseSeedData as CourseSeedData;
          autoSaveDataRef.current = {
            courseTitle: seedData.courseTitle || '',
            courseSeedData: seedData,
            courseContent: loadedCourseContent || undefined,
            currentStep: loadedStep,
            lastModified: lastSavedTimeRef.current || new Date().toISOString(),
            mediaFiles: EMPTY_MEDIA_FILES,
            audioFiles: EMPTY_AUDIO_FILES
          }
        }
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
        // Reset loading state and ref on error
        hasLoadedProjectRef.current = null
        setIsLoadingProject(false)
        setLoadingProgress(undefined)
      } finally {
        setLoadingProgress({ current: 5, total: 5, phase: 'Complete!' })
        // Clear loading state after a brief moment to show completion
        setTimeout(() => {
          setIsLoadingProject(false)
          setLoadingProgress(undefined)
        }, 500)
      }
    }

    loadProjectData().catch((error) => {
      console.error('loadProjectData async error:', error)
      setIsLoadingProject(false)
      setLoadingProgress(undefined)
    })
  }, [storage.currentProjectId, storage.isInitialized])
  
  // Debug courseContent changes - DISABLED to prevent console spam
  // useEffect(() => {
  //   debugLogger.info('courseContent state updated:', courseContent)
  //   debugLogger.info('Current step when courseContent updates:', currentStep)
  // }, [courseContent, currentStep])

  // DISABLED: This was causing re-render loops by setting hasUnsavedChanges on every state change
  // Track unsaved changes - NOW ONLY SET ON USER ACTIONS
  // Re-enable unsaved changes tracking with debouncing to prevent render loops
  useEffect(() => {
    const handler = setTimeout(() => {
      // Only set unsaved changes if we have actual data and aren't currently loading
      if (!isLoadingProject && (courseSeedData?.courseTitle || courseContent?.topics?.length)) {
        debugLogger.debug('App.unsavedChanges', 'Marking project as dirty', {
          hasSeedData: !!courseSeedData?.courseTitle,
          hasContent: !!courseContent?.topics?.length,
          currentStep
        })
        
        // Mark appropriate sections as dirty based on what data we have
        if (courseSeedData?.courseTitle) {
          markDirty('courseSeed')
        }
        if (courseContent?.topics?.length) {
          markDirty('courseContent')
        }
      }
    }, 200) // Debounce by 200ms to prevent loops
    
    return () => clearTimeout(handler)
  }, [courseSeedData, courseContent, isLoadingProject, currentStep, markDirty])

  // DEBUG: Track state changes to identify what's triggering re-renders (DISABLED to reduce console noise)
  // useEffect(() => {
  //   console.log('[DEBUG] State Change Detected:', {
  //     courseSeedDataTitle: courseSeedData?.courseTitle,
  //     hasCourseContent: !!courseContent,
  //     currentStep,
  //     hasUnsavedChanges,
  //     isLoadingProject,
  //     timestamp: new Date().toISOString(),
  //     stackTrace: new Error().stack?.split('\n').slice(1, 4).join('\n')
  //   })
  // }) // No dependencies - runs on every render to catch all changes
  
  // DEBUG: Track hasUnsavedChanges flag changes for autosave monitoring
  useEffect(() => {
    debugLogger.debug('App.autosave', 'hasUnsavedChanges flag changed', { 
      hasUnsavedChanges, 
      hasData: !!autoSaveDataRef.current,
      hasProjectId: !!storage.currentProjectId,
      autosaveWillTrigger: hasUnsavedChanges && !!autoSaveDataRef.current && !!storage.currentProjectId
    })
  }, [hasUnsavedChanges, storage.currentProjectId])
  
  // Manual save functionality (shows toast)
  const handleSave = useCallback(async (data?: ProjectData) => {
    debugLogger.debug('App.handleSave', 'Called with data', data)
    debugLogger.debug('App.handleSave', 'Storage state', { initialized: storage.isInitialized, projectId: storage.currentProjectId })
    
    setIsSaving(true)
    try {
      // Use passed data if provided, otherwise use state
      const dataToSave = data || projectData
      debugLogger.debug('App.handleSave', 'Data to save', dataToSave)
      
      // Save all data from all pages
      if (dataToSave.courseSeedData) {
        debugLogger.info('App.handleSave', 'Saving course seed data', dataToSave.courseSeedData)
        
        // Test for circular references
        try {
          JSON.stringify(dataToSave.courseSeedData)
        } catch (e) {
          debugLogger.error('App.handleSave', 'Circular reference in courseSeedData', { error: e, keys: Object.keys(dataToSave.courseSeedData) })
        }
        
        await storage.saveCourseSeedData(dataToSave.courseSeedData)
      }
      if (dataToSave.courseContent) {
        debugLogger.info('App.handleSave', 'Saving course content', {
          hasWelcomePage: !!(dataToSave.courseContent as any).welcomePage,
          hasObjectivesPage: !!(dataToSave.courseContent as any).learningObjectivesPage,
          topicsCount: dataToSave.courseContent.topics?.length || 0,
          assessmentQuestionsCount: (dataToSave.courseContent as any).assessment?.questions?.length || 0
        })
        await storage.saveCourseContent(dataToSave.courseContent)
      }
      
      // Save current step
      await storage.saveContent('currentStep', { step: dataToSave.currentStep })
      
      // AI prompt, audio settings, and SCORM config are now saved directly through storage
      // No need to check localStorage anymore
      
      await storage.saveProject()
      debugLogger.info('App.handleSave', 'Manual save completed successfully', {
        projectId: storage.currentProjectId,
        timestamp: new Date().toISOString()
      })
      // Use only StatusPanel notifications, not the old blue popup system
      statusMessages.addSuccess('Project Saved', 'All changes have been saved successfully')
      resetAllUnsavedChanges()
      lastSavedTimeRef.current = new Date().toISOString() // Update last saved time
      return { success: true }
    } catch (error: unknown) {
      console.error('[handleSave] Save error:', error)
      const errorMessage = (error instanceof Error ? error.message : String(error)) || 'Failed to save project'
      showError(errorMessage)
      statusMessages.addError('Save Failed', errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsSaving(false)
    }
  }, [storage, projectData])


  // Autosave functionality (no toast)
  const handleAutosave = useCallback(async (data: ProjectData) => {
    debugLogger.debug('App.autoSave', 'Autosave triggered', { 
      hasCourseSeedData: !!data.courseSeedData,
      hasCourseContent: !!data.courseContent,
      projectId: storage.currentProjectId
    })
    try {
      // The data is passed directly from useAutoSave, no need for fallback
      const dataToSave = data
      
      // Save all data from all pages (same as manual save)
      if (dataToSave.courseSeedData) {
        debugLogger.info('App.handleAutosave', 'Auto-saving course seed data')
        await storage.saveCourseSeedData(dataToSave.courseSeedData)
      }
      if (dataToSave.courseContent) {
        debugLogger.info('App.handleAutosave', 'Auto-saving course content', {
          hasWelcomePage: !!(dataToSave.courseContent as any).welcomePage,
          hasObjectivesPage: !!(dataToSave.courseContent as any).learningObjectivesPage,
          topicsCount: dataToSave.courseContent.topics?.length || 0,
          assessmentQuestionsCount: (dataToSave.courseContent as any).assessment?.questions?.length || 0
        })
        await storage.saveCourseContent(dataToSave.courseContent)
      }
      
      // Save current step
      await storage.saveContent('currentStep', { step: dataToSave.currentStep })
      
      // AI prompt, audio settings, and SCORM config are now saved directly through storage
      // No need to check localStorage anymore
      
      await storage.saveProject()
      debugLogger.info('App.handleAutosave', 'Auto-save completed successfully', {
        projectId: storage.currentProjectId,
        timestamp: new Date().toISOString()
      })
      statusMessages.addInfo('Auto-save', 'Project changes saved automatically')
      resetAllUnsavedChanges()
      lastSavedTimeRef.current = new Date().toISOString() // Update last saved time
      return { success: true }
    } catch (error: unknown) {
      // Only show error toast for autosave failures
      showError('Autosave failed')
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  }, [storage])
  
  /*
   * UNIFIED SAVE ARCHITECTURE:
   * 
   * This application uses a simple, unified save architecture:
   * 
   * 1. UNIFIED SAVE METHODS (FileStorage.ts):
   *    - saveCourseContent(): Saves complete course structure to root-level course_content field
   *    - saveCourseSeedData(): Saves seed data to courseSeedData field
   *    - All data is stored in the unified project file format
   * 
   * 2. SAVE TRIGGERS:
   *    - handleSave(): Manual save (Ctrl+S) - saves both seed data and course content
   *    - handleAutosave(): Automatic save - same as manual but without notifications
   *    - Step handlers (handleJSONNext, handleMediaNext, etc.): Save on navigation between steps
   * 
   * 3. UNSAVED CHANGES TRACKING:
   *    - UnsavedChangesContext tracks dirty state across all sections
   *    - Components call markDirty() when user makes changes
   *    - Auto-save only triggers when hasUnsavedChanges is true
   * 
   * 4. MUTATION SAFETY (Development):
   *    - courseContent is frozen in development to catch accidental mutations
   *    - validateImmutableUpdate() warns if same object reference is reused
   * 
   * 5. PERFORMANCE BENEFITS:
   *    - Single atomic save operation per step navigation
   *    - No redundant metadata saves or individual page saves
   *    - Consistent data structure across all course components
   */
  
  // Re-enabled autosave with proper safeguards to prevent infinite loops
  const autoSaveState = useAutoSave({
    data: autoSaveDataRef.current,
    onSave: handleAutosave,
    delay: DURATIONS.autosaveInterval,
    disabled: !hasUnsavedChanges || !storage.currentProjectId, // Only save when dirty AND project exists
    isDirty: hasUnsavedChanges,
    onSaveComplete: () => {
      debugLogger.debug('App.autoSave', 'Save completed, resetting all dirty flags')
      resetAllUnsavedChanges()
    },
    minSaveInterval: 5000, // Minimum 5 seconds between saves as safety layer
    showNotifications: false // Disable notifications for auto-saves since manual saves handle their own
  })
  
  // Notification wrapper for backwards compatibility
  
  // Clear notifications on navigation is now handled by NotificationContext

  const handleCourseSeedSubmit = async (data: CourseSeedData) => {
    // VERSION MARKER: v2.0.2 - Returns Promise for proper async handling
    debugLogger.info('App.handleCourseSeedSubmit v2.0.2', 'Course seed data submitted', { title: data.courseTitle })
    // Note: CourseSeedInput component handles marking 'courseSeed' section dirty automatically
    try {
      await measureAsync('handleCourseSeedSubmit', async () => {
        // Create a new project if we don't have one - BEFORE setting state or navigating
        if (!storage.currentProjectId) {
          debugLogger.info('App.handleCourseSeedSubmit', 'Creating new project', { title: data.courseTitle })
          const project = await storage.createProject(data.courseTitle)
          if (!project || !project.id) {
            throw new Error('Failed to create project')
          }
          // Clear loaded project reference to force reload for new project
          setIsLoadingProject(false)
          debugLogger.info('App.handleCourseSeedSubmit', 'Project created, forcing reload', { 
            projectId: project.id,
            currentProjectId: storage.currentProjectId 
          })
        }
      
        // Now save the COMPLETE course seed data (includes metadata for backward compatibility)
        await storage.saveCourseSeedData(data)
        await storage.saveContent('currentStep', { step: 'prompt' })
        
        // Only update state and navigate after everything is saved successfully
        setCourseSeedData(data)
        setCurrentStep('prompt')
        navigation.navigateToStep(stepNumbers.prompt)
        statusMessages.addSuccess('Course Setup Complete', `Ready to generate content for "${data.courseTitle}"`)
        // Note: Dirty state is handled automatically by components
        
        // Return success to resolve the promise
        return true
      }) // End of measureAsync
    } catch (error) {
      console.error('Failed to save course seed data:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to save data'
      showError(errorMessage)
      statusMessages.addError('Setup Failed', errorMessage)
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

  const handleClearCourseContent = async () => {
    debugLogger.info('App', 'Clearing course content and all associated media files')
    
    // Clear all course content when JSON is cleared
    setCourseContent(null)
    
    // Navigate back to JSON step when course content is cleared
    navigation.navigateToStep(2) // JSON step
    
    // FIRST: Save the cleared course content to storage to remove all media references
    // This prevents other components from accessing stale course content with media references
    if (storage.currentProjectId) {
      try {
        debugLogger.info('App', 'Saving cleared course content to prevent stale media references')
        await storage.saveCourseContent(null)
        await storage.saveContent('currentStep', { step: 'json' })
        debugLogger.info('App', 'Course content cleared and saved to storage successfully')
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        debugLogger.error('App', 'CRITICAL: Failed to save cleared course content state', { 
          error: errorMessage,
          projectId: storage.currentProjectId 
        })
        console.error('CRITICAL: Failed to save cleared course content state:', error)
        
        // This is a critical failure - course content references won't be cleared
        // Alert the user and potentially abort the operation
        alert(`Failed to clear course content from storage: ${errorMessage}\n\nThis may leave orphaned media references. Please try again.`)
        return // Abort the operation to prevent inconsistent state
      }
    }
    
    // SECOND: Delete all media files (now orphaned since course content is cleared)
    if (storage.currentProjectId) {
      try {
        debugLogger.info('App', 'Deleting orphaned media files for project', { projectId: storage.currentProjectId })
        await deleteAllMedia(storage.currentProjectId)
        debugLogger.info('App', 'Successfully deleted all orphaned media files')
      } catch (error) {
        debugLogger.error('App', 'Failed to delete media files during course content clear', { 
          error: error instanceof Error ? error.message : String(error) 
        })
        console.error('Failed to delete media files during course content clear:', error)
        // Media deletion failure doesn't affect course content clearing
        // The course content is already cleared, so the user isn't left in an inconsistent state
      }
    }
    
    debugLogger.info('App', 'Course content and media cleanup completed')
  }

  const handleJSONNext = async (data: CourseContent) => {
    // Note: JSONImportValidator component handles marking 'courseContent' section dirty automatically
    setCourseContent(data)
    setCurrentStep('media')
    navigation.navigateToStep(stepNumbers.media)
    
    // Save to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await measureAsync('saveJSONContent', async () => {
        await storage.saveContent('currentStep', { step: 'media' })
        await storage.saveCourseContent(data)
        
        // Post-save failsafe: Clean up any orphaned media references that might have been missed
        try {
          debugLogger.info('App.handleJSONNext', '🔧 Running post-save orphaned media cleanup validation')
          
          const mediaExistsChecker = async (mediaId: string): Promise<boolean> => {
            try {
              const result = await getMedia(mediaId)
              const exists = result !== null
              debugLogger.debug('App.handleJSONNext', `Post-save media check: ${mediaId} exists: ${exists}`)
              return exists
            } catch (error) {
              debugLogger.debug('App.handleJSONNext', `Post-save media check error for ${mediaId}:`, error)
              return false
            }
          }
          
          const cleanupResult = await cleanupOrphanedMediaReferences(data, mediaExistsChecker)
          
          if (cleanupResult.removedMediaIds.length > 0) {
            debugLogger.info('App.handleJSONNext', '🧹 Post-save cleanup found and removed orphaned media references:', {
              removedMediaIds: Array.from(cleanupResult.removedMediaIds),
              count: cleanupResult.removedMediaIds.length
            })
            
            // Update course content with the cleaned version
            setCourseContent(cleanupResult.cleanedContent)
            await storage.saveCourseContent(cleanupResult.cleanedContent)
            
            info(`🧹 Removed ${cleanupResult.removedMediaIds.length} orphaned media references that were pointing to deleted files.`)
          } else {
            debugLogger.debug('App.handleJSONNext', '✅ Post-save cleanup found no orphaned media references')
          }
        } catch (cleanupError) {
          debugLogger.error('App.handleJSONNext', '❌ Post-save cleanup failed:', cleanupError)
          // Don't fail the entire save operation if cleanup fails
        }
        
        // NOTE: Individual page saves removed - saveCourseContent() above already saves 
        // the complete course structure including welcomePage, learningObjectivesPage, and all topics
        }) // End of measureAsync
      } catch (error) {
        console.error('Failed to save course content:', error)
        showError('Failed to save data')
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
    // Note: MediaEnhancementWizard component handles marking 'media' section dirty automatically
    setCourseContent(data as CourseContent)
    setCurrentStep('audio')
    navigation.navigateToStep(stepNumbers.audio)
    
    // Save to PersistentStorage
    if (storage.currentProjectId) {
      try {
        debugLogger.info('App.handleMediaNext', 'Saving step navigation', { step: 'audio' })
        await storage.saveContent('currentStep', { step: 'audio' })
        
        const courseData = data as CourseContent
        // Save complete course content using unified method
        await storage.saveCourseContent(courseData)
        
        
        // NOTE: Individual page saves removed - saveCourseContent() above already saves 
        // the complete course structure including all media associations
      } catch (error) {
        console.error('Failed to save media-enhanced content:', error)
        showError('Failed to save data')
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

  const handleAudioNext = useCallback(async (data: CourseContentUnion) => {
    // Note: AudioNarrationWizard component handles marking 'media' section dirty automatically
    setCourseContent(data as CourseContent)
    setCurrentStep('activities')
    navigation.navigateToStep(stepNumbers.activities)
    
    // Save to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'activities' })
        
        const courseData = data as CourseContent
        // Save complete course content using unified method
        await storage.saveCourseContent(courseData)
        
        // NOTE: Individual page saves removed - saveCourseContent() above already saves 
        // the complete course structure including all audio/media
      } catch (error) {
        console.error('Failed to save audio-enhanced content:', error)
        showError('Failed to save data')
      }
    }
  }, [storage, courseSeedData, navigation, stepNumbers.activities])

  const handleAudioBack = useCallback(async () => {
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
  }, [storage, navigation, stepNumbers.media])

  const handleActivitiesNext = async (data: CourseContentUnion) => {
    // Note: ActivitiesEditor component handles marking 'activities' section dirty automatically
    setCourseContent(data as CourseContent)
    setCurrentStep('scorm')
    navigation.navigateToStep(stepNumbers.scorm)
    
    // Save to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'scorm' })
        
        const courseData = data as CourseContent
        // Save complete course content using unified method
        await storage.saveCourseContent(courseData)
        
        // NOTE: Individual content saves removed - saveCourseContent() above already saves 
        // the complete course structure including assessment, activities, quiz, and all topics
      } catch (error) {
        console.error('Failed to save activities-enhanced content:', error)
        showError('Failed to save data')
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
    success('SCORM package built successfully!')
    
    // Save completion state to PersistentStorage
    if (storage.currentProjectId) {
      try {
        await storage.saveContent('currentStep', { step: 'scorm' })
        // NOTE: Completion state is tracked in the course content, no separate metadata needed
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
      showError('Please create or open a project first')
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
    
    // Manual save already resets unsaved changes, no need to force autosave
  }
  
  
  // Open functionality
  const handleOpen = async () => {
    // If we have a dashboard callback, use it to go back to dashboard
    if (onBackToDashboard) {
      if (hasUnsavedChanges && courseSeedData?.courseTitle) {
        // Store the navigation action to execute after handling unsaved changes
        setPendingNavigationAction(() => () => onBackToDashboard())
        showDialog('unsaved');
      } else {
        // Go back to dashboard - the dashboard will handle project switching
        onBackToDashboard()
      }
    } else {
      // Otherwise show error as we should only use dashboard
      showError('Please use the project dashboard to open projects')
    }
  }
  
  // Removed - using dashboard for project operations
  
  // Delete functionality - handled by dashboard
  
  // Duplicate functionality - handled by dashboard
  
  const handleConfirmDelete = async () => {
    if (projectToDelete) {
      try {
        await storage.deleteProject(projectToDelete.path || projectToDelete.id)
        success(`Deleted project: ${projectToDelete.name}`)
        if (storage.currentProjectId === projectToDelete.id) {
          // Current project was deleted, clear state and redirect to dashboard
          // Clear state since current project was deleted
          setCourseContent(null)
          setCourseSeedData(null)
          setCurrentStep('seed')
          // The dashboard will automatically show when currentProjectId is null
        }
      } catch (error: unknown) {
        showError((error instanceof Error ? error.message : String(error)) || 'Failed to delete project')
      }
    }
    hideDialog();
  }
  
  // Unsaved changes handling
  const handleSaveAndContinue = async () => {
    const result = await handleSave(projectData)
    if (result.success) {
      hideDialog();
      // Note: handleSave already resets all dirty flags
      
      // Execute pending navigation action if exists (e.g., Exit to Dashboard)
      if (pendingNavigationAction) {
        pendingNavigationAction();
        setPendingNavigationAction(null);
      } else if (pendingProjectId) {
        // Handle pending project after save
        onPendingProjectHandled?.()
        // Only navigate back to dashboard if we're switching projects
        if (onBackToDashboard) {
          onBackToDashboard()
        }
      }
      // If no pendingProjectId or navigation action, just continue with current workflow
    }
  }
  
  const handleDiscardChanges = async () => {
    hideDialog();
    resetAllUnsavedChanges()
    
    // Execute pending navigation action if exists (e.g., Exit to Dashboard)
    if (pendingNavigationAction) {
      pendingNavigationAction();
      setPendingNavigationAction(null);
    } else if (pendingProjectId) {
      // Handle pending project after discard
      onPendingProjectHandled?.()
      // Only navigate back to dashboard if we're switching projects
      if (onBackToDashboard) {
        onBackToDashboard()
      }
    }
    // If no pendingProjectId or navigation action, just continue with current workflow
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
      (entry) => entry[1] === stepIndex
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
      // Escape: Close active dialog
      else if (e.key === 'Escape') {
        e.preventDefault()
        if (activeDialog) {
          hideDialog()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeDialog, handleManualSave, handleOpen, showDialog, hideDialog])

  // Focus management for modal dialogs
  useEffect(() => {
    if (activeDialog) {
      // Store the previously focused element when any dialog opens
      if (!previousFocusRef.current) {
        previousFocusRef.current = document.activeElement
      }
      
      // Focus specific elements based on dialog type
      if (activeDialog === 'settings') {
        setTimeout(() => {
          settingsCloseButtonRef.current?.focus()
        }, 100)
      } else if (activeDialog === 'help') {
        // For HelpPage, focus will be managed by the component itself
        // The HelpPage component should handle its own focus management
        setTimeout(() => {
          // Try to focus the first focusable element in the help page
          const helpPage = document.querySelector('[data-component="help-page"]')
          const firstFocusable = helpPage?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
          ;(firstFocusable as HTMLElement)?.focus?.()
        }, 100)
      }
    } else if (previousFocusRef.current) {
      // Return focus to the previously focused element when modal closes
      setTimeout(() => {
        (previousFocusRef.current as HTMLElement)?.focus?.()
        previousFocusRef.current = null
      }, 100)
    }
  }, [activeDialog])

  // StatusPanel handlers
  const handleStatusPanelDock = () => {
    setIsStatusPanelDocked(true)
  }

  const handleStatusPanelUndock = () => {
    setIsStatusPanelDocked(false)
  }

  return (
    <ErrorBoundary>
        <UnifiedMediaProvider projectId={storage.currentProjectId || ''}>
          <div style={{ backgroundColor: COLORS.background, color: COLORS.textMuted, minHeight: '100vh' }}>
        {/* Media loading overlay */}
        <MediaLoadingOverlay 
          message="Optimizing your media for instant access..." 
          showProgress={true} 
        />
        
        {/* Project loading overlay */}
        <ProjectLoadingOverlay 
          isLoading={isLoadingProject}
          loadingProgress={loadingProgress}
        />
        
        {/* Network status indicator */}
        <NetworkStatusIndicator />
        
        {/* Status Panel */}
        <StatusPanel 
          messages={statusMessages.messages}
          onDismiss={statusMessages.dismissMessage}
          onClearAll={statusMessages.clearAllMessages}
          isDocked={isStatusPanelDocked}
          onDock={handleStatusPanelDock}
          onUndock={handleStatusPanelUndock}
        />
        
        {/* Notification Panel is now rendered at the app root level */}
      
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
                ref={settingsCloseButtonRef}
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
        
        <div style={{ display: activeDialog ? 'none' : 'block' }}>
          <AutoSaveProvider 
            isSaving={autoSaveState.isSaving || isSaving}
            lastSaved={autoSaveState.lastSaved}
            hasUnsavedChanges={hasUnsavedChanges}
            isManualSave={isSaving}
          >
            {currentStep === 'seed' && (
              <CourseSeedInput 
                onBack={onBackToDashboard}
                onSettingsClick={() => showDialog('settings')}
                onHelp={() => showDialog('help')}
                onOpen={handleOpen}
                isSaving={isSaving}
                onSave={async (content?: CourseSeedData) => {
                  // Manual save from Save button - use handleManualSave with proper notifications
                  await handleManualSave(content);
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
                  onSave={(content?: CourseContentUnion, silent?: boolean) => {
                  if (content && isNewFormat(content)) {
                    setCourseContent(content);
                    if (!silent) {
                      handleManualSave();
                    }
                  } else if (!silent) {
                    handleManualSave();
                  }
                }}
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
                  onClearData={handleClearCourseContent}
                  onSettingsClick={() => showDialog('settings')}
                  onHelp={() => showDialog('help')}
                  onSave={(content?: CourseContentUnion, silent?: boolean) => {
                  if (content && isNewFormat(content)) {
                    setCourseContent(content);
                    if (!silent) {
                      handleManualSave();
                    }
                  } else if (!silent) {
                    handleManualSave();
                  }
                }}
                  onOpen={handleOpen}
                  onStepClick={handleStepClick}
                />
              </Suspense>
            )}
            
            {currentStep === 'media' && (
              <Suspense fallback={<LoadingComponent />}>
                {courseContent && courseSeedData ? (
                  <MediaEnhancementWizard
                    courseContent={createMutationSafeContent(courseContent)}
                    courseSeedData={courseSeedData}
                    onUpdateContent={(content) => {
                      debugLogger.info('App.MediaEnhancement', 'Updating courseContent with media');
                      // Type guard to ensure we have CourseContent, not LegacyCourseContent
                      if ('welcomePage' in content) {
                        validateImmutableUpdate(courseContent, content, 'MediaEnhancementWizard.onUpdateContent');
                        setCourseContent(content as CourseContent);
                        // onUpdateContent should only update state, not trigger saves
                        // Saves are handled by the onSave callback below
                      }
                    }}
                    onNext={handleMediaNext}
                    onBack={handleMediaBack}
                    apiKeys={apiKeys}
                    onSettingsClick={() => showDialog('settings')}
                    onHelp={() => showDialog('help')}
                    onSave={(content?: CourseContentUnion, silent?: boolean) => {
                    if (content && isNewFormat(content)) {
                      setCourseContent(content);
                      if (!silent) {
                        handleManualSave();
                      }
                    } else if (!silent) {
                      handleManualSave();
                    }
                  }}
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
                    <h2 style={{ color: COLORS.text, marginBottom: SPACING.lg }}>Media Enhancement Locked</h2>
                    <p style={{ color: COLORS.textMuted, marginBottom: SPACING.xl }}>
                      {!courseContent ? 'Please import JSON data first to unlock this page.' : 'Course seed data is missing.'}
                    </p>
                    <Button onClick={handleMediaBack} variant="secondary">
                      Go Back to JSON Import
                    </Button>
                  </div>
                )}
              </Suspense>
            )}
            
            {currentStep === 'audio' && (
              <Suspense fallback={<LoadingComponent />}>
                {courseContent && courseSeedData ? (
                  <AudioNarrationWizard
                  courseContent={createMutationSafeContent(courseContent)}
                  courseSeedData={courseSeedData}
                  onNext={handleAudioNext}
                  onBack={handleAudioBack}
                  onUpdateContent={(content: CourseContentUnion) => {
                    validateImmutableUpdate(courseContent, content, 'AudioNarrationWizard.onUpdateContent');
                    setCourseContent(content as CourseContent)
                  }}
                  onSettingsClick={() => showDialog('settings')}
                  onHelp={() => showDialog('help')}
                  onSave={async (content?: CourseContentUnion, silent?: boolean) => {
                  logger.log('[App] AudioNarrationWizard onSave called', { hasContent: !!content, silent })
                  
                  if (content && isNewFormat(content)) {
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
                        await storage.saveCourseContent(content);
                      }
                    }
                  } else if (!silent) {
                    // No content provided, just trigger a regular save
                    await handleManualSave();
                  }
                }}
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
                    <h2 style={{ color: COLORS.text, marginBottom: SPACING.lg }}>Audio Narration Locked</h2>
                    <p style={{ color: COLORS.textMuted, marginBottom: SPACING.xl }}>
                      {!courseContent ? 'Please import JSON data first to unlock this page.' : 'Course seed data is missing.'}
                    </p>
                    <Button onClick={handleAudioBack} variant="secondary">
                      Go Back to JSON Import
                    </Button>
                  </div>
                )}
              </Suspense>
            )}
            
            {currentStep === 'activities' && (
              <Suspense fallback={<LoadingComponent />}>
                {courseContent && courseSeedData ? (
                  <ActivitiesEditor
                  courseContent={createMutationSafeContent(courseContent)}
                  courseSeedData={courseSeedData}
                  onNext={handleActivitiesNext}
                  onBack={handleActivitiesBack}
                  onUpdateContent={(content: CourseContentUnion) => {
                    validateImmutableUpdate(courseContent, content, 'ActivitiesEditor.onUpdateContent');
                    setCourseContent(content as CourseContent)
                  }}
                  onSettingsClick={() => showDialog('settings')}
                  onHelp={() => showDialog('help')}
                  onSave={(content?: CourseContentUnion, silent?: boolean) => {
                  if (content && isNewFormat(content)) {
                    setCourseContent(content);
                    if (!silent) {
                      handleManualSave();
                    }
                  } else if (!silent) {
                    handleManualSave();
                  }
                }}
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
                    <h2 style={{ color: COLORS.text, marginBottom: SPACING.lg }}>Activities Editor Locked</h2>
                    <p style={{ color: COLORS.textMuted, marginBottom: SPACING.xl }}>
                      {!courseContent ? 'Please import JSON data first to unlock this page.' : 'Course seed data is missing.'}
                    </p>
                    <Button onClick={handleActivitiesBack} variant="secondary">
                      Go Back to JSON Import
                    </Button>
                  </div>
                )}
              </Suspense>
            )}
            
            {currentStep === 'scorm' && (
              <Suspense fallback={<LoadingComponent />}>
                {(() => {
                  // Debug logging removed to prevent excessive console output
                  
                  if (!courseContent || !courseSeedData) {
                    return (
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
                        <h2 style={{ color: COLORS.text, marginBottom: SPACING.lg }}>SCORM Package Builder Locked</h2>
                        <p style={{ color: COLORS.textMuted, marginBottom: SPACING.xl }}>
                          {!courseContent ? 'Please import JSON data first to unlock this page.' : 'Course seed data is missing.'}
                        </p>
                        <Button onClick={handleSCORMBack} variant="secondary">
                          Go Back to JSON Import
                        </Button>
                      </div>
                    );
                  }
                  
                  return (
                    <SCORMPackageBuilder
                      courseContent={createMutationSafeContent(courseContent)}
                      courseSeedData={courseSeedData}
                      onNext={handleSCORMNext}
                  onBack={handleSCORMBack}
                  onSettingsClick={() => showDialog('settings')}
                  onHelp={() => showDialog('help')}
                  onSave={(content?: CourseContentUnion, silent?: boolean) => {
                  if (content && isNewFormat(content)) {
                    setCourseContent(content);
                    if (!silent) {
                      handleManualSave();
                    }
                  } else if (!silent) {
                    handleManualSave();
                  }
                }}
                  onOpen={handleOpen}
                  onStepClick={handleStepClick}
                    />
                  );
                })()}
              </Suspense>
            )}
          </AutoSaveProvider>
        </div>
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
        onCancel={() => {
          hideDialog();
          setPendingNavigationAction(null); // Clear pending navigation on cancel
        }}
      />
      
      
      
      
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