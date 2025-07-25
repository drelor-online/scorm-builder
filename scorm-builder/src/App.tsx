// External packages
import { useState, useEffect, useCallback, Suspense } from 'react'

// Constants
import { COLORS, SPACING, DURATIONS } from '@/constants'

// Services
import { apiKeyStorage } from '@/services/ApiKeyStorage'

// Utils

// Styles - Emergency text visibility fix
// import './styles/ensure-text-visible.css' // Uncomment if text is not visible

// Components
import { CourseSeedInput } from '@/components/CourseSeedInputRefactored'
import { AIPromptGenerator } from '@/components/AIPromptGenerator'
import { JSONImportValidator } from '@/components/JSONImportValidatorRefactored'
import { Button } from '@/components/DesignSystem'

// Import components directly
import { MediaEnhancementWizard } from './components/MediaEnhancementWizardRefactored'
import { AudioNarrationWizard } from './components/AudioNarrationWizardRefactored'
import { ActivitiesEditor } from './components/ActivitiesEditorRefactored'
import { SCORMPackageBuilder } from './components/SCORMPackageBuilderRefactored'
import { TestChecklist } from './components/TestChecklist'
// Types
import type { CourseSeedData } from '@/types/course'
import type { CourseContent, CourseContentUnion, Topic, Media } from '@/types/aiPrompt'
import type { ProjectData } from '@/types/project'

// Components
// DevTools removed - not needed
import { ErrorBoundary } from '@/components/ErrorBoundary'
// Import dialog components directly
import { Settings } from './components/SettingsRefactored'
import { HelpPage } from './components/HelpPageRefactored'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { NetworkStatusIndicator } from '@/components/DesignSystem'
// LoadingComponent removed - using inline loading
const LoadingComponent = () => <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

// Services
import { exportProject, importProject } from '@/services/ProjectExportImport'
// Hooks
import { useAutoSave } from '@/hooks/useAutoSave'
import { useStorage } from './contexts/PersistentStorageContext'

// Contexts
import { StepNavigationProvider, useStepNavigation } from './contexts/StepNavigationContext'
import { AutoSaveProvider } from './contexts/AutoSaveContext'
import { MediaProvider, useMedia } from './contexts/MediaContext'

// Config
import { envConfig } from '@/config/environment'

// Styles
import './App.css'

// Import E2E tests for browser console
import './utils/browserE2ETests'
import './utils/e2eTests'
import './utils/automatedUITests'

interface AppProps {
  onBackToDashboard?: () => void
  pendingProjectId?: string | null
  onPendingProjectHandled?: () => void
}

// Inner component that uses StepNavigationContext
function AppContent({ onBackToDashboard, pendingProjectId, onPendingProjectHandled }: AppProps) {
  const storage = useStorage()
  const navigation = useStepNavigation()
  const [currentStep, setCurrentStep] = useState('seed')
  const [courseSeedData, setCourseSeedData] = useState<CourseSeedData | null>(null)
  const [courseContent, setCourseContent] = useState<CourseContent | null>(null)
  
  // Debug effect to log state changes
  useEffect(() => {
    console.log('State changed:', {
      currentStep,
      hasCourseSeedData: !!courseSeedData,
      courseSeedDataKeys: courseSeedData ? Object.keys(courseSeedData) : null,
      hasCourseContent: !!courseContent,
      courseContentKeys: courseContent ? Object.keys(courseContent) : null
    })
  }, [currentStep, courseSeedData, courseContent])
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showTestChecklist, setShowTestChecklist] = useState(false)
  // Load API keys from encrypted file or fall back to environment config
  const [apiKeys, setApiKeys] = useState({
    googleImageApiKey: envConfig.googleImageApiKey,
    googleCseId: envConfig.googleCseId,
    youtubeApiKey: envConfig.youtubeApiKey
  })
  
  // Save/Open state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Check for pending project when component mounts or pendingProjectId changes
  useEffect(() => {
    if (pendingProjectId && hasUnsavedChanges) {
      setShowUnsavedDialog(true)
    }
  }, [pendingProjectId, hasUnsavedChanges])
  
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
  
  // Create project data for saving
  const projectData: ProjectData = courseSeedData ? {
    courseTitle: courseSeedData.courseTitle,
    courseSeedData: courseSeedData,
    courseContent: courseContent || undefined,
    currentStep: stepNumbers[currentStep as keyof typeof stepNumbers],
    lastModified: new Date().toISOString(),
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
    lastModified: new Date().toISOString(),
    mediaFiles: {},
    audioFiles: {}
  }
  
  // Clear old localStorage data and load API keys on first load
  useEffect(() => {
    // Clear any old localStorage data to prevent conflicts
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('scorm_') && !key.includes('recent_files')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      console.log('Removing old localStorage key:', key)
      localStorage.removeItem(key)
    })
    
    // Test mode keyboard shortcut (Ctrl+Shift+T)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault()
        setShowTestChecklist(prev => !prev)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    // Load API keys from encrypted file
    const loadApiKeys = async () => {
      try {
        const savedKeys = await apiKeyStorage.load()
        if (savedKeys) {
          setApiKeys(savedKeys)
          console.log('API keys loaded from encrypted file')
        } else {
          console.log('No API keys found, using environment defaults')
        }
      } catch (error) {
        console.error('Unexpected error loading API keys:', error)
      }
    }
    loadApiKeys()
  }, [])

  // Load project data from PersistentStorage on mount
  useEffect(() => {
    const loadProjectData = async () => {
      console.log('loadProjectData called with:', {
        currentProjectId: storage.currentProjectId,
        isInitialized: storage.isInitialized
      })
      if (storage.currentProjectId && storage.isInitialized) {
        try {
          // Load course metadata
          const metadata = await storage.getCourseMetadata()
          console.log('Loaded metadata:', metadata)
          
          // Check if this is a new project (no topics means it's new)
          if (metadata && metadata.topics && metadata.topics.length > 0) {
            console.log('Loading existing project data...')
            console.log('Metadata topics:', metadata.topics)
            // Load topics and reconstruct course data
            const topics: Topic[] = []
            
            // Check if this is an old format where topics are stored as strings (topic names)
            const firstTopic = metadata.topics[0]
            const isOldFormat = typeof firstTopic === 'string' && !firstTopic.includes('-')
            console.log('Topic format check:', { firstTopic, isOldFormat })
            
            for (let i = 0; i < metadata.topics.length; i++) {
              const topicIdOrName = metadata.topics[i]
              console.log('Loading topic:', topicIdOrName)
              
              // Always use numeric content IDs for consistency
              const numericContentId = `content-${2 + i}` // Topics start at content-2
              const topicContent = await storage.getContent(numericContentId)
              
              // For backward compatibility, also try the old ID if numeric fails
              let fallbackContent = null
              if (!topicContent) {
                // Try old format IDs as fallback
                let oldTopicId: string
                
                if (typeof topicIdOrName === 'string' && !topicIdOrName.includes('-')) {
                  // Old format: topics are stored as names
                  oldTopicId = topicIdOrName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                } else {
                  // Already an ID
                  oldTopicId = topicIdOrName
                }
                
                fallbackContent = await storage.getContent(oldTopicId)
                console.log('Tried fallback ID:', oldTopicId, 'found:', !!fallbackContent)
              }
              console.log('Topic content loaded:', topicContent || fallbackContent)
              
              const finalContent = topicContent || fallbackContent
              
              if (finalContent) {
                // Always use numeric ID for consistency
                topics.push({
                  id: `topic-${i}`, // Simple numeric topic ID
                  title: finalContent.title || topicIdOrName,
                  content: finalContent.content,
                  narration: finalContent.narration || '',
                  imageKeywords: finalContent.imageKeywords || [],
                  imagePrompts: finalContent.imagePrompts || [],
                  videoSearchTerms: finalContent.videoSearchTerms || [],
                  duration: finalContent.duration || 5,
                  knowledgeCheck: finalContent.knowledgeCheck,
                  media: finalContent.media
                } as Topic)
              } else if (typeof topicIdOrName === 'string') {
                // For missing content, create a basic topic structure
                console.log('Creating basic topic for:', topicIdOrName)
                topics.push({
                  id: `topic-${i}`, // Simple numeric topic ID
                  title: topicIdOrName,
                  content: `<p>Content for ${topicIdOrName}</p>`,
                  narration: '',
                  imageKeywords: [],
                  imagePrompts: [],
                  videoSearchTerms: [],
                  duration: 5
                } as Topic)
              }
            }
            
            // Set course content if we have it
            if (topics.length > 0) {
              // Load additional content
              console.log('Loading additional content...')
              const assessment = await storage.getContent('assessment')
              console.log('Assessment:', assessment)
              const welcomePage = await storage.getContent('welcome')
              console.log('Welcome page:', welcomePage)
              const learningObjectivesPage = await storage.getContent('objectives')
              console.log('Learning objectives page:', learningObjectivesPage)
              
              // Load legacy activities and quiz if they exist
              const activities = await storage.getContent('activities')
              console.log('Activities:', activities)
              const quiz = await storage.getContent('quiz')
              console.log('Quiz:', quiz)
              
              // Determine format and set content accordingly
              if (assessment) {
                // New format
                const newContent = {
                  topics,
                  welcomePage: welcomePage || { 
                    id: 'content-0',
                    title: 'Welcome',
                    content: metadata.welcomeContent || '',
                    narration: '',
                    imageKeywords: [],
                    imagePrompts: [],
                    videoSearchTerms: [],
                    duration: 1
                  },
                  learningObjectivesPage: learningObjectivesPage || {
                    id: 'content-1',
                    title: 'Learning Objectives',
                    content: metadata.objectives?.join('<br>') || '',
                    narration: '',
                    imageKeywords: [],
                    imagePrompts: [],
                    videoSearchTerms: [],
                    duration: 1
                  },
                  objectives: metadata.objectives || [],
                  assessment
                } as CourseContent
                console.log('Setting course content (new format):', newContent)
                setCourseContent(newContent)
              } else if (activities || quiz) {
                // Legacy format
                const legacyContent = {
                  topics,
                  activities: activities || [],
                  quiz: quiz || { questions: [], passMark: 80 }
                } as any
                console.log('Setting course content (legacy format):', legacyContent)
                setCourseContent(legacyContent)
              } else {
                // Basic format without assessment
                const basicContent = {
                  topics,
                  welcomePage: welcomePage || { 
                    id: 'content-0',
                    title: 'Welcome',
                    content: metadata.welcomeContent || '',
                    narration: '',
                    imageKeywords: [],
                    imagePrompts: [],
                    videoSearchTerms: [],
                    duration: 1
                  },
                  learningObjectivesPage: learningObjectivesPage || {
                    id: 'content-1',
                    title: 'Learning Objectives', 
                    content: metadata.objectives?.join('<br>') || '',
                    narration: '',
                    imageKeywords: [],
                    imagePrompts: [],
                    videoSearchTerms: [],
                    duration: 1
                  },
                  objectives: metadata.objectives || [],
                  assessment: { questions: [], passMark: 80, narration: null }
                } as CourseContent
                console.log('Setting course content (basic format):', basicContent)
                setCourseContent(basicContent)
              }
            }
            
            // Try to load seed data
            const seedData = await storage.getContent('courseSeedData')
            console.log('Loaded seed data from storage:', seedData)
            if (seedData) {
              console.log('Setting course seed data with keys:', Object.keys(seedData))
              setCourseSeedData(seedData as CourseSeedData)
            } else {
              console.log('No seed data found in storage')
            }
            
            // Load current step - but only after we've loaded the data
            const stepData = await storage.getContent('currentStep')
            console.log('Loaded step data:', stepData)
            if (stepData && stepData.step) {
              console.log('Setting current step to:', stepData.step)
              
              // For json step and beyond, ensure we have courseContent
              if (stepData.step !== 'seed' && stepData.step !== 'prompt' && !topics?.length) {
                console.warn('Step requires courseContent but topics not found, defaulting to seed step')
                setCurrentStep('seed')
                navigation.navigateToStep(0)
              } else {
                setCurrentStep(stepData.step)
                // The visited steps will be loaded automatically by StepNavigationContext
              }
            }
          } else {
            console.log('New project detected, starting fresh...')
            // For new projects, just set the initial step
            setCurrentStep('seed')
            navigation.navigateToStep(0)
          }
        } catch (error) {
          console.error('Failed to load project data:', error)
        }
      }
    }
    
    loadProjectData()
  }, [storage.currentProjectId, storage.isInitialized, storage])
  
  // Debug courseContent changes
  useEffect(() => {
    console.log('courseContent state updated:', courseContent)
    console.log('Current step when courseContent updates:', currentStep)
  }, [courseContent, currentStep])

  // Track unsaved changes
  useEffect(() => {
    // Set unsaved changes if we have course data
    setHasUnsavedChanges(!!courseSeedData?.courseTitle)
  }, [courseSeedData, courseContent, currentStep])
  
  // Manual save functionality (shows toast)
  const handleSave = useCallback(async (data?: ProjectData) => {
    console.log('[handleSave] Called with data:', data)
    console.log('[handleSave] Storage initialized:', storage.isInitialized)
    console.log('[handleSave] Current project:', storage.currentProjectId)
    
    try {
      // Use passed data if provided, otherwise use state
      const dataToSave = data || projectData
      console.log('[handleSave] Data to save:', dataToSave)
      
      // Save all data from all pages
      if (dataToSave.courseSeedData) {
        console.log('[handleSave] Saving course metadata:', dataToSave.courseSeedData)
        
        // Test for circular references
        try {
          JSON.stringify(dataToSave.courseSeedData)
        } catch (e) {
          console.error('[handleSave] Circular reference in courseSeedData:', e)
          console.log('[handleSave] courseSeedData keys:', Object.keys(dataToSave.courseSeedData))
        }
        
        await storage.saveCourseMetadata(dataToSave.courseSeedData)
        await storage.saveContent('courseSeedData', dataToSave.courseSeedData)
      }
      if (dataToSave.courseContent) {
        await storage.saveContent('course-content', dataToSave.courseContent)
      }
      
      // Save AI prompt if it exists
      const aiPrompt = localStorage.getItem('aiPrompt')
      if (aiPrompt) {
        await storage.saveAiPrompt(aiPrompt)
      }
      
      // Save audio settings if they exist
      const audioSettingsStr = localStorage.getItem('audioSettings')
      if (audioSettingsStr) {
        try {
          const audioSettings = JSON.parse(audioSettingsStr)
          await storage.saveAudioSettings(audioSettings)
        } catch (e) {
          console.error('Failed to parse audio settings:', e)
        }
      }
      
      // Save SCORM config if it exists
      const scormConfigStr = localStorage.getItem('scormConfig')
      if (scormConfigStr) {
        try {
          const scormConfig = JSON.parse(scormConfigStr)
          await storage.saveScormConfig(scormConfig)
        } catch (e) {
          console.error('Failed to parse SCORM config:', e)
        }
      }
      
      await storage.saveProject()
      setToast({ message: 'Project saved successfully', type: 'success' })
      setHasUnsavedChanges(false)
      return { success: true }
    } catch (error: any) {
      console.error('[handleSave] Save error:', error)
      setToast({ message: error.message || 'Failed to save project', type: 'error' })
      return { success: false, error: error.message }
    }
  }, [storage, projectData])

  // Autosave functionality (no toast)
  const handleAutosave = useCallback(async (data: ProjectData) => {
    try {
      // Use passed data if provided, otherwise use state
      const dataToSave = data || projectData
      
      // Save all data from all pages (same as manual save)
      if (dataToSave.courseSeedData) {
        await storage.saveCourseMetadata(dataToSave.courseSeedData)
        await storage.saveContent('courseSeedData', dataToSave.courseSeedData)
      }
      if (dataToSave.courseContent) {
        await storage.saveContent('course-content', dataToSave.courseContent)
      }
      
      // Save AI prompt if it exists
      const aiPrompt = localStorage.getItem('aiPrompt')
      if (aiPrompt) {
        await storage.saveAiPrompt(aiPrompt)
      }
      
      // Save audio settings if they exist
      const audioSettingsStr = localStorage.getItem('audioSettings')
      if (audioSettingsStr) {
        try {
          const audioSettings = JSON.parse(audioSettingsStr)
          await storage.saveAudioSettings(audioSettings)
        } catch (e) {
          console.error('Failed to parse audio settings:', e)
        }
      }
      
      // Save SCORM config if it exists
      const scormConfigStr = localStorage.getItem('scormConfig')
      if (scormConfigStr) {
        try {
          const scormConfig = JSON.parse(scormConfigStr)
          await storage.saveScormConfig(scormConfig)
        } catch (e) {
          console.error('Failed to parse SCORM config:', e)
        }
      }
      
      await storage.saveProject()
      setHasUnsavedChanges(false)
      return { success: true }
    } catch (error: any) {
      // Only show error toast for autosave failures
      setToast({ message: 'Autosave failed', type: 'error' })
      return { success: false, error: error.message }
    }
  }, [storage, projectData])
  
  const autoSaveState = useAutoSave({
    data: projectData,
    onSave: handleAutosave,
    delay: DURATIONS.autosaveInterval,
    disabled: !storage.currentProjectId
  })
  
  // Toast timeout
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), DURATIONS.toastDuration)
      return () => clearTimeout(timer)
    }
  }, [toast])

  const handleCourseSeedSubmit = async (data: CourseSeedData) => {
    setCourseSeedData(data)
    setCurrentStep('prompt')
    navigation.navigateToStep(stepNumbers.prompt)
    setHasUnsavedChanges(true)
    
    // Save to PersistentStorage
    try {
      // Create a new project if we don't have one
      if (!storage.currentProjectId) {
        const project = await storage.createProject(data.courseTitle)
        if (project && project.id) {
          // Project created successfully, now save the data
          await storage.saveContent('courseSeedData', data)
          await storage.saveContent('currentStep', { step: 'prompt' })
          await storage.saveCourseMetadata({
            courseTitle: data.courseTitle,
            difficulty: data.difficulty,
            lastModified: new Date().toISOString()
          })
        }
      } else {
        // Project already exists, just save the data
        await storage.saveContent('courseSeedData', data)
        await storage.saveContent('currentStep', { step: 'prompt' })
        await storage.saveCourseMetadata({
          courseTitle: data.courseTitle,
          difficulty: data.difficulty,
          lastModified: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('Failed to save course seed data:', error)
      setToast({ message: 'Failed to save data', type: 'error' })
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
        await storage.saveContent('currentStep', { step: 'media' })
        
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
      } catch (error) {
        console.error('Failed to save course content:', error)
        setToast({ message: 'Failed to save data', type: 'error' })
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
        setToast({ message: 'Failed to save data', type: 'error' })
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
        setToast({ message: 'Failed to save data', type: 'error' })
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
        setToast({ message: 'Failed to save data', type: 'error' })
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
    setToast({ message: 'SCORM package built successfully!', type: 'success' })
    
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

  const handleSettingsClick = () => {
    setShowSettings(true)
  }

  const handleSettingsSave = (newApiKeys: typeof apiKeys) => {
    setApiKeys(newApiKeys)
    setShowSettings(false)
    // Note: The Settings component already saves to localStorage
  }

  const handleSettingsClose = () => {
    // Don't close without saving - instead trigger save
    // Get the current form data from the Settings component
    // For now, just close the modal since Settings already saves to localStorage on form submit
    setShowSettings(false)
  }
  
  // Save functionality
  const handleManualSave = async (data?: CourseSeedData) => {
    console.log('[handleManualSave] Called with data:', data)
    console.log('[handleManualSave] Current project ID:', storage.currentProjectId)
    
    // If no project is open, show error
    if (!storage.currentProjectId) {
      setToast({ message: 'Please create or open a project first', type: 'error' })
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
      setToast({ message: 'No project to save', type: 'error' })
      return
    }
    
    try {
      await storage.saveProjectAs()
      setToast({ message: 'Project saved to new file', type: 'success' })
    } catch (error: any) {
      if (error.message !== 'User cancelled') {
        setToast({ message: `Failed to save as: ${error.message}`, type: 'error' })
      }
    }
  }
  
  // Open functionality
  const handleOpen = async () => {
    // If we have a dashboard callback, use it to go back to dashboard
    if (onBackToDashboard) {
      if (hasUnsavedChanges && courseSeedData?.courseTitle) {
        setShowUnsavedDialog(true)
      } else {
        onBackToDashboard()
      }
    } else {
      // Otherwise show error as we should only use dashboard
      setToast({ message: 'Please use the project dashboard to open projects', type: 'error' })
    }
  }
  
  // Removed - using dashboard for project operations
  
  // Delete functionality - handled by dashboard
  
  // Duplicate functionality - handled by dashboard
  
  const handleConfirmDelete = async () => {
    if (projectToDelete) {
      try {
        await storage.deleteProject(projectToDelete.id)
        setToast({ message: `Deleted project: ${projectToDelete.name}`, type: 'success' })
        if (storage.currentProjectId === projectToDelete.id) {
          // Current project was deleted, need to handle this
          // TODO: Clear current project or redirect to dashboard
        }
      } catch (error: any) {
        setToast({ message: error.message || 'Failed to delete project', type: 'error' })
      }
    }
    setShowDeleteDialog(false)
    setProjectToDelete(null)
  }
  
  // Unsaved changes handling
  const handleSaveAndContinue = async () => {
    const result = await handleSave(projectData)
    if (result.success) {
      setShowUnsavedDialog(false)
      setHasUnsavedChanges(false)
      if (pendingProjectId) {
        // Handle pending project after save
        onPendingProjectHandled?.()
      }
      if (onBackToDashboard) {
        onBackToDashboard()
      }
    }
  }
  
  const handleDiscardChanges = async () => {
    setShowUnsavedDialog(false)
    setHasUnsavedChanges(false)
    if (pendingProjectId) {
      // Handle pending project after discard
      onPendingProjectHandled?.()
    }
    if (onBackToDashboard) {
      onBackToDashboard()
    }
  }
  
  // Help functionality
  const handleHelp = () => {
    setShowHelp(true)
  }
  
  // Export functionality
  const handleExport = async () => {
    try {
      const result = await exportProject({
        metadata: {
          version: '1.0',
          exportDate: new Date().toISOString(),
          projectName: projectData.courseTitle
        },
        courseData: {
          title: projectData.courseTitle,
          language: 'en',
          keywords: [],
          topics: courseContent?.topics.map((topic: Topic) => ({
            title: topic.title,
            content: topic.content,
            media: topic.media?.map((m: Media) => ({
              id: m.id,
              type: m.type as 'image' | 'audio' | 'youtube',
              url: m.url,
              name: m.title,
              filename: m.title
            }))
          })) || []
        },
        media: {
          images: [],
          audio: [],
          captions: []
        }
      })
      
      if (!result.success || !result.blob || !result.filename) {
        throw new Error(result.error || 'Export failed')
      }
      
      const { blob, filename } = result
      
      // Download the file
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      
      setToast({ message: 'Project exported successfully', type: 'success' })
    } catch (error) {
      setToast({ message: 'Failed to export project', type: 'error' })
    }
  }
  
  // Import functionality
  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.zip,.json'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      const result = await importProject(file)
      
      if (result.success && result.data) {
        // Import functionality is not fully implemented for the new format
        // For now, just show an error
        setToast({ message: 'Import functionality needs to be updated for the new format', type: 'error' })
      } else {
        setToast({ message: result.error || 'Failed to import project', type: 'error' })
      }
    }
    
    input.click()
  }

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
        if (!showSettings && !showHelp) {
          handleManualSave()
        }
      }
      // Ctrl/Cmd + O: Open
      else if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault()
        if (!showSettings && !showHelp) {
          handleOpen()
        }
      }
      // F1: Help
      else if (e.key === 'F1') {
        e.preventDefault()
        if (!showSettings) {
          setShowHelp(true)
        }
      }
      // Ctrl/Cmd + ,: Settings
      else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault()
        if (!showHelp) {
          setShowSettings(true)
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
  }, [showSettings, showHelp, handleManualSave, handleOpen])


  return (
    <ErrorBoundary>
      <MediaProvider projectId={storage.currentProjectId}>
        <MediaLoadingWrapper>
        <div style={{ backgroundColor: COLORS.background, color: COLORS.textMuted, minHeight: '100vh' }}>
        {/* Network status indicator */}
        <NetworkStatusIndicator />
      
      {/* Skip navigation link for accessibility */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      <main id="main-content">
        {showSettings && (
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
                onClick={handleSettingsClose}
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
        
        {showHelp && (
          <Suspense fallback={<LoadingComponent />}>
            <HelpPage onBack={() => setShowHelp(false)} />
          </Suspense>
        )}
        
        {!showSettings && !showHelp && (
          <AutoSaveProvider 
            isSaving={autoSaveState.isSaving}
            lastSaved={autoSaveState.lastSaved}
            hasUnsavedChanges={hasUnsavedChanges}
          >
            {currentStep === 'seed' && (
              <CourseSeedInput 
                onSettingsClick={handleSettingsClick}
                onHelp={handleHelp}
                onSave={() => handleManualSave()}
                onSaveAs={handleSaveAs}
                onOpen={handleOpen}
                onSubmit={handleCourseSeedSubmit}
                onStepClick={handleStepClick}
                initialData={courseSeedData || undefined}
                onExport={handleExport}
                onImport={handleImport}
              />
            )}
          
            {currentStep === 'prompt' && courseSeedData && (
              <AIPromptGenerator
                courseSeedData={courseSeedData}
                onNext={handlePromptNext}
                onBack={handlePromptBack}
                onSettingsClick={handleSettingsClick}
                onHelp={handleHelp}
                onSave={() => handleManualSave()}
                onSaveAs={handleSaveAs}
                onOpen={handleOpen}
                onStepClick={handleStepClick}
              />
            )}
            
            {currentStep === 'json' && (() => {
              console.log('Rendering JSON step with courseContent:', courseContent)
              return (
                <JSONImportValidator
                  onNext={handleJSONNext}
                  onBack={handleJSONBack}
                  onSettingsClick={handleSettingsClick}
                  onHelp={handleHelp}
                  onSave={() => handleManualSave()}
                  onSaveAs={handleSaveAs}
                  onOpen={handleOpen}
                  onStepClick={handleStepClick}
                  initialData={courseContent || undefined}
                />
              )
            })()}
            
            {currentStep === 'media' && courseContent && courseSeedData && (
              <Suspense fallback={<LoadingComponent />}>
                <MediaEnhancementWizard
                  courseContent={courseContent}
                  courseSeedData={courseSeedData}
                  onNext={handleMediaNext}
                  onBack={handleMediaBack}
                  apiKeys={apiKeys}
                  onSettingsClick={handleSettingsClick}
                  onHelp={handleHelp}
                  onSave={() => handleManualSave()}
                  onSaveAs={handleSaveAs}
                  onOpen={handleOpen}
                  onStepClick={handleStepClick}
                />
              </Suspense>
            )}
            
            {currentStep === 'audio' && courseContent && courseSeedData && (
              <Suspense fallback={<LoadingComponent />}>
                <AudioNarrationWizard
                  courseContent={courseContent}
                  courseSeedData={courseSeedData}
                  onNext={handleAudioNext}
                  onBack={handleAudioBack}
                  onSettingsClick={handleSettingsClick}
                  onHelp={handleHelp}
                  onSave={() => handleManualSave()}
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
                  onSettingsClick={handleSettingsClick}
                  onHelp={handleHelp}
                  onSave={() => handleManualSave()}
                  onSaveAs={handleSaveAs}
                  onOpen={handleOpen}
                  onStepClick={handleStepClick}
                />
              </Suspense>
            )}
            
            {currentStep === 'scorm' && (
              <Suspense fallback={<LoadingComponent />}>
                {(() => {
                  console.log('SCORM step render check:', {
                    currentStep,
                    hasCourseContent: !!courseContent,
                    hasCourseSeedData: !!courseSeedData,
                    courseContentKeys: courseContent ? Object.keys(courseContent) : [],
                    courseSeedDataKeys: courseSeedData ? Object.keys(courseSeedData) : [],
                    courseSeedData: courseSeedData
                  });
                  
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
                  onSettingsClick={handleSettingsClick}
                  onHelp={handleHelp}
                  onSave={() => handleManualSave()}
                  onSaveAs={handleSaveAs}
                  onOpen={handleOpen}
                  onStepClick={handleStepClick}
                      storage={storage}
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
        isOpen={showDeleteDialog}
        projectName={projectToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteDialog(false)
          setProjectToDelete(null)
        }}
      />
      
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        currentProjectName={courseSeedData?.courseTitle || 'Current Project'}
        onSave={handleSaveAndContinue}
        onDiscard={handleDiscardChanges}
        onCancel={() => setShowUnsavedDialog(false)}
      />
      
      {/* Test Checklist Modal - Press Ctrl+Shift+T to toggle */}
      {showTestChecklist && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200,
          overflowY: 'auto'
        }}>
          <div style={{
            position: 'relative',
            width: '90%',
            maxWidth: '1200px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <Button
              onClick={() => setShowTestChecklist(false)}
              style={{
                position: 'absolute',
                right: '1rem',
                top: '1rem',
                zIndex: 1
              }}
            >
              Close (Ctrl+Shift+T)
            </Button>
            <Suspense fallback={<LoadingComponent />}>
              <TestChecklist />
            </Suspense>
          </div>
        </div>
      )}
      
      {/* Toast notification */}
      {toast && (
        <div
          data-testid="toast-notification"
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: toast.type === 'success' ? COLORS.success : COLORS.error,
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
      </div>
      </MediaLoadingWrapper>
      </MediaProvider>
    </ErrorBoundary>
  )
}

// Wrapper component that blocks UI until MediaStore is loaded
function MediaLoadingWrapper({ children }: { children: React.ReactNode }) {
  const { isLoading: isMediaLoading } = useMedia()
  const [showDelayedLoading, setShowDelayedLoading] = useState(false)
  
  useEffect(() => {
    // Show loading indicator after a short delay to avoid flash
    if (isMediaLoading) {
      const timer = setTimeout(() => {
        setShowDelayedLoading(true)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setShowDelayedLoading(false)
    }
  }, [isMediaLoading])
  
  if (isMediaLoading && showDelayedLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#111827',
        color: '#f3f4f6',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '1.25rem' }}>Finalizing project load...</div>
        <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Loading media resources</div>
      </div>
    )
  }
  
  return <>{children}</>
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