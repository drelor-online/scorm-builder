// External packages
import { useState, useEffect, Suspense, lazy } from 'react'

// Constants
import { COLORS } from '@/constants'

// Lazy load heavy components
const CourseSeedInput = lazy(() => 
  import('@/components/CourseSeedInput').then(module => ({
    default: module.CourseSeedInput
  }))
)

const AIPromptGenerator = lazy(() => 
  import('@/components/AIPromptGenerator').then(module => ({
    default: module.AIPromptGenerator
  }))
)

const JSONImportValidator = lazy(() => 
  import('@/components/JSONImportValidator').then(module => ({
    default: module.JSONImportValidator
  }))
)

const MediaEnhancementWizard = lazy(() => 
  import('./components/MediaEnhancementWizard').then(module => ({
    default: module.MediaEnhancementWizard
  }))
)

const AudioNarrationWizard = lazy(() => 
  import('./components/AudioNarrationWizard').then(module => ({
    default: module.default
  }))
)

const ActivitiesEditor = lazy(() => 
  import('./components/ActivitiesEditor').then(module => ({
    default: module.ActivitiesEditor
  }))
)

const SCORMPackageBuilder = lazy(() => 
  import('./components/SCORMPackageBuilder').then(module => ({
    default: module.SCORMPackageBuilder
  }))
)

// Lazy load dialogs
const Settings = lazy(() => 
  import('./components/Settings').then(module => ({
    default: module.Settings
  }))
)

const HelpPage = lazy(() => 
  import('./components/HelpPage').then(module => ({
    default: module.HelpPage
  }))
)

// Types
import type { CourseSeedData } from '@/types/course'
import type { CourseContent, CourseContentUnion } from '@/types/aiPrompt'
import type { ProjectData } from '@/types/project'

// Services
import { apiKeyStorage } from '@/services/ApiKeyStorage'

// Keep essential components loaded
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'
import { NetworkStatusIndicator } from '@/components/DesignSystem'

// Enhanced loading component with better UX
const LoadingComponent = () => (
  <div style={{ 
    padding: '4rem', 
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem'
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      border: '4px solid rgba(255, 255, 255, 0.1)',
      borderTopColor: '#8fbb40',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }} />
    <div style={{ color: '#a1a1aa', fontSize: '0.875rem' }}>Loading component...</div>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg);}
      }
    `}</style>
  </div>
)

// Services
// Hooks
// import { useAutoSave } from '@/hooks/useAutoSave' // Not used in lazy version

// Config
import { envConfig } from '@/config/environment'

// Styles
import './App.css'

function App() {
  const [currentStep, setCurrentStep] = useState('seed')
  const [courseSeedData, setCourseSeedData] = useState<CourseSeedData | null>(null)
  const [courseContent, setCourseContent] = useState<CourseContent | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  // Load API keys from encrypted file or fall back to environment config
  const [apiKeys, setApiKeys] = useState({
    googleImageApiKey: envConfig.googleImageApiKey,
    googleCseId: envConfig.googleCseId,
    youtubeApiKey: envConfig.youtubeApiKey
  })
  
  // Save/Open state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string; path?: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  
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
  
  // Note: Auto-save is handled by FileStorage service internally
  // We don't need to implement it here anymore
  
  // Initialize - cleanup beforeunload as FileStorage handles auto-save
  useEffect(() => {
    // FileStorage handles auto-save internally
    
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
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleManualSave()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [projectData])
  
  // Project loading is now handled by the dashboard
  
  const handleManualSave = async () => {
    // Manual save should not be needed in lazy version
    showToast('Project is auto-saved', 'success')
  }
  
  // Project open handled by dashboard
  
  // Project delete handled by dashboard
  // setProjectToDelete is already defined as setState function above
  
  const confirmDelete = async () => {
    // Project deletion should be handled by dashboard
    showToast('Please use the project dashboard', 'error')
    setShowDeleteDialog(false)
    setProjectToDelete(null)
  }
  
  // Project duplicate handled by dashboard
  
  const handleStepClick = (stepIndex: number) => {
    // Only allow navigation to visited steps
    const stepKeys = Object.keys(stepNumbers) as Array<keyof typeof stepNumbers>
    const targetStep = stepKeys.find(key => stepNumbers[key] === stepIndex)
    
    if (targetStep) {
      const currentStepNumber = stepNumbers[currentStep as keyof typeof stepNumbers]
      
      // Can only go back or to current step
      if (stepIndex <= currentStepNumber) {
        setCurrentStep(targetStep)
      }
    }
  }
  
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }
  
  // Navigation handlers
  const handleSeedNext = (data: CourseSeedData) => {
    setCourseSeedData(data)
    setCurrentStep('prompt')
  }
  
  const handlePromptNext = () => {
    setCurrentStep('json')
  }
  
  const handlePromptBack = () => {
    setCurrentStep('seed')
  }
  
  const handleJSONNext = (content: CourseContent | CourseContentUnion) => {
    setCourseContent(content as CourseContent)
    setCurrentStep('media')
  }
  
  const handleJSONBack = () => {
    setCurrentStep('prompt')
  }
  
  const handleMediaNext = (updatedContent: CourseContentUnion) => {
    setCourseContent(updatedContent as CourseContent)
    setCurrentStep('audio')
  }
  
  const handleMediaBack = () => {
    setCurrentStep('json')
  }
  
  const handleAudioNext = (updatedContent: CourseContentUnion) => {
    setCourseContent(updatedContent as CourseContent)
    setCurrentStep('activities')
  }
  
  const handleAudioBack = () => {
    setCurrentStep('media')
  }
  
  const handleActivitiesNext = (updatedContent: CourseContentUnion) => {
    setCourseContent(updatedContent as CourseContent)
    setCurrentStep('scorm')
  }
  
  const handleActivitiesBack = () => {
    setCurrentStep('audio')
  }
  
  const handleSCORMNext = () => {
    // Final step - could show completion or restart
    showToast('SCORM package generated successfully!', 'success')
  }
  
  const handleSCORMBack = () => {
    setCurrentStep('activities')
  }
  
  const handleSettingsClick = () => {
    setShowSettings(true)
  }
  
  const handleSaveSettings = (newApiKeys: typeof apiKeys) => {
    setApiKeys(newApiKeys)
    setShowSettings(false)
    showToast('Settings saved successfully', 'success')
  }
  
  const handleOpen = () => {
    // Open should be handled by dashboard
    showToast('Please use the project dashboard', 'error')
  }
  
  const handleHelp = () => {
    setShowHelp(true)
  }
  
  const handleSaveAs = async () => {
    // Save As should be handled by the current system
    showToast('Save As feature is being updated', 'error')
  }
  
  
  return (
    <ErrorBoundary>
      <div className="app" style={{ background: COLORS.background, minHeight: '100vh' }}>
        <NetworkStatusIndicator />
        
        <main style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
          {showHelp ? (
            <Suspense fallback={<LoadingComponent />}>
              <HelpPage />
            </Suspense>
          ) : (
            <>
              {currentStep === 'seed' && (
                <Suspense fallback={<LoadingComponent />}>
                  <CourseSeedInput
                    onSubmit={handleSeedNext}
                    onSettingsClick={handleSettingsClick}
                    onHelp={handleHelp}
                    onSave={handleManualSave}
                    onStepClick={handleStepClick}
                    initialData={courseSeedData || undefined}
                  />
                </Suspense>
              )}
              
              {currentStep === 'prompt' && courseSeedData && (
                <Suspense fallback={<LoadingComponent />}>
                  <AIPromptGenerator
                    courseSeedData={courseSeedData}
                    onNext={handlePromptNext}
                    onBack={handlePromptBack}
                    onSettingsClick={handleSettingsClick}
                    onHelp={handleHelp}
                    onSave={handleManualSave}
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
                    onSettingsClick={handleSettingsClick}
                    onHelp={handleHelp}
                    onSave={handleManualSave}
                    onOpen={handleOpen}
                    onStepClick={handleStepClick}
                  />
                </Suspense>
              )}
              
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
                    onSave={handleManualSave}
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
                    onSave={handleManualSave}
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
                    onSave={handleManualSave}
                    onOpen={handleOpen}
                    onStepClick={handleStepClick}
                  />
                </Suspense>
              )}
              
              {currentStep === 'scorm' && courseContent && courseSeedData && (
                <Suspense fallback={<LoadingComponent />}>
                  <SCORMPackageBuilder
                    courseContent={courseContent}
                    courseSeedData={courseSeedData}
                    onNext={handleSCORMNext}
                    onBack={handleSCORMBack}
                    onSettingsClick={handleSettingsClick}
                    onHelp={handleHelp}
                    onSave={handleManualSave}
                    onOpen={handleOpen}
                    onStepClick={handleStepClick}
                  />
                </Suspense>
              )}
            </>
          )}
        </main>
        
        
        {/* Dialogs */}
        
        {showSettings && (
          <Suspense fallback={<LoadingComponent />}>
            <Settings
              onSave={handleSaveSettings}
            />
          </Suspense>
        )}
        
        <DeleteConfirmDialog
          isOpen={showDeleteDialog}
          projectName={projectToDelete?.name || ''}
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowDeleteDialog(false)
            setProjectToDelete(null)
          }}
        />
        
        <UnsavedChangesDialog
          isOpen={showUnsavedDialog}
          currentProjectName={courseSeedData?.courseTitle || 'Untitled Project'}
          onSave={async () => {
            await handleManualSave()
            setShowUnsavedDialog(false)
          }}
          onDiscard={() => {
            setShowUnsavedDialog(false)
          }}
          onCancel={() => {
            setShowUnsavedDialog(false)
          }}
        />
        
        {/* Toast notification */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              bottom: '2rem',
              right: '2rem',
              background: toast.type === 'success' ? COLORS.success : COLORS.error,
              color: 'white',
              padding: '1rem 1.5rem',
              borderRadius: '0.5rem',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              animation: 'slideIn 0.3s ease-out',
              zIndex: 9999
            }}
          >
            {toast.message}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App