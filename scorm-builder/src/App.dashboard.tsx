import { useState, useEffect, useCallback, useRef } from 'react'
import { ProjectDashboard } from './components/ProjectDashboard'
import { ProjectLoadingDialog } from './components/ProjectLoadingDialog'
import { PersistentStorageProvider, useStorage } from './contexts/PersistentStorageContext'
import { UnifiedMediaProvider } from './contexts/UnifiedMediaContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { UnsavedChangesProvider } from './contexts/UnsavedChangesContext'
import { handleFileAssociation } from './utils/fileAssociation'
import { isErrorDismissed, dismissError } from './utils/errorDismissal'
import { DebugInfo } from './components/DebugInfo'
import { ErrorNotification, showError, showInfo } from './components/ErrorNotification'
import { StatusPanel } from './components/StatusPanel'
import { useStatusMessages } from './hooks/useStatusMessages'
import { NotificationToStatusBridge } from './components/NotificationToStatusBridge'
import { WorkflowRecorder } from './components/WorkflowRecorder'
import App from './App'
import { openProjectWithCoordination } from './utils/coordinatedProjectLoading'
import { startRustLogListener } from './services/rustLogListener'
import { isTauriEnvironment } from './config/environment'
import { safeLog } from './utils/productionLogger'

interface DashboardContentProps {
  onSecretClick?: () => void
}

function DashboardContent({ onSecretClick }: DashboardContentProps) {
  const storage = useStorage()
  // Note: Media context not available during dashboard phase - will be null during project selection
  const [showDashboard, setShowDashboard] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null)
  const [pendingProjectId, setPendingProjectId] = useState<string | null>(null)
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [recoveryInfo, setRecoveryInfo] = useState<{ backupPath: string; projectName: string } | null>(null)
  // Loading dialog state
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState<{
    phase: 'loading' | 'media' | 'content' | 'finalizing'
    percent: number
    message: string
    itemsLoaded?: number
    totalItems?: number
  }>({ phase: 'loading', percent: 0, message: 'Initializing...' })
  
  // StrictMode protection: Prevent duplicate project loading calls
  const isLoadingRef = useRef(false)
  
  useEffect(() => {
    // Check if we have a current project
    if (storage.currentProjectId) {
      setShowDashboard(false)
    }
  }, [storage.currentProjectId])
  
  useEffect(() => {
    // Check for crash recovery on startup (only if storage is initialized)
    if (storage.isInitialized) {
      checkForCrashRecovery()
    }
    
    // Set up keyboard shortcuts
    const handleKeyPress = async (e: KeyboardEvent) => {
      // Toggle debug panel
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        const debugPanel = document.getElementById('debug-panel')
        if (debugPanel) {
          debugPanel.style.display = debugPanel.style.display === 'none' ? 'flex' : 'none'
        }
      }
      
      // Open developer tools (F12)
      if (e.key === 'F12') {
        e.preventDefault()
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window')
          const window = getCurrentWindow()
          // This will open devtools if they're enabled in tauri.conf.json
          ;(window as any).openDevtools?.()
        } catch (error) {
          console.error('Failed to open devtools:', error)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [storage.isInitialized])
  
  useEffect(() => {
    // Set up file association handling
    handleFileAssociation({
      onProjectOpened: async (projectId) => {
        // Navigate to the opened project
        await handleProjectSelected(projectId)
      },
      onError: (errorMessage) => {
        // Only show error if it hasn't been dismissed before
        if (!isErrorDismissed(errorMessage)) {
          setError(errorMessage)
          // Clear error after 5 seconds (but don't mark as dismissed)
          setTimeout(() => setError(null), 5000)
        }
      },
      onUnsavedChanges: (filePath) => {
        // Store the pending file path to open after saving/discarding
        setPendingFilePath(filePath)
        // This will trigger the unsaved changes dialog in the App component
      }
    })
  }, [])

  useEffect(() => {
    // Start listening to Rust logs
    if (isTauriEnvironment()) {
      startRustLogListener()
      safeLog('App.dashboard', 'Started Rust log listener')

      // Test Rust logging by calling diagnostic command
      setTimeout(async () => {
        try {
          const { invoke } = await import('@tauri-apps/api/core')
          const diagnostics = await invoke('diagnose_projects_directory')
          safeLog('App.dashboard', 'Project directory diagnostics', diagnostics)
        } catch (error) {
          console.error('[App.dashboard] Failed to call diagnostics:', error)
        }
      }, 1000) // Delay to ensure logger is initialized
    }
  }, [])

  const handleProjectSelected = async (projectId: string) => {
    safeLog('App.dashboard', 'handleProjectSelected called with', { projectId })
    
    // StrictMode protection: Ignore duplicate calls during loading
    if (isLoadingRef.current) {
      safeLog('App.dashboard', '⚠️ Ignoring duplicate project loading call (StrictMode protection)')
      return
    }
    
    try {
      isLoadingRef.current = true
      setIsLoadingProject(true)
      setLoadingProgress({ phase: 'loading', percent: 0, message: 'Initializing...' })
      
      safeLog('App.dashboard', 'Opening project with coordination', { projectId })
      
      // LOADING COORDINATION FIX: Use coordinated loading instead of direct storage call
      // Note: Media context is null during dashboard phase - coordination will handle this gracefully
      await openProjectWithCoordination({
        projectId,
        storage,
        mediaContext: null, // No media context available during dashboard phase
        onProgress: (progress) => {
          setLoadingProgress(progress as any)
        }
      })
      
      safeLog('App.dashboard', 'Coordinated project loading completed', { currentProjectId: storage.currentProjectId })
      
      // Verify that currentProjectId is set after coordination
      if (!storage.currentProjectId) {
        console.error('[App.dashboard] ⚠️ WARNING: currentProjectId is null after coordinated loading!')
        console.error('[App.dashboard] This may indicate a coordination issue - the project may not have opened properly')
      } else {
        safeLog('App.dashboard', '✅ Project ID verified after coordination', { currentProjectId: storage.currentProjectId })
      }
      
      // Don't close the dialog yet - wait for media to load
      // The dialog will close when progress reaches 100%
      setShowDashboard(false)
    } catch (err: unknown) {
      isLoadingRef.current = false
      if (err instanceof Error && err.message === 'UNSAVED_CHANGES') {
        // Store the pending project ID to open after saving/discarding
        setPendingProjectId(projectId)
        // Show dashboard is already false, which will show the App component
        // The App component will show the unsaved changes dialog
        setShowDashboard(false)
      } else {
        showError(err instanceof Error ? err.message : 'Failed to open project', {
          label: 'Retry',
          onClick: () => handleProjectSelected(projectId)
        })
      }
      setIsLoadingProject(false)
    }
  }

  // Monitor loading progress to close dialog only when truly complete
  useEffect(() => {
    if (isLoadingProject && loadingProgress.percent === 100 && loadingProgress.phase === 'finalizing') {
      // Give a small delay to ensure smooth transition
      setTimeout(() => {
        setIsLoadingProject(false)
        showInfo('Project opened successfully')
      }, 300)
    }
  }, [isLoadingProject, loadingProgress])
  
  // SAFETY: Close overlay if project data is clearly ready (prevents race condition stranding)
  useEffect(() => {
    if (!isLoadingProject) return
    
    // Close overlay as soon as we have clear evidence the project is ready
    // This prevents getting stranded on React state update timing issues
    if (storage.currentProjectId) {
      safeLog('Dashboard', '🔐 Safety trigger: Project data detected, closing overlay', {
        hasCurrentProjectId: !!storage.currentProjectId,
        loadingProgress: loadingProgress.percent
      })
      setIsLoadingProject(false)
      isLoadingRef.current = false
      showInfo('Project opened successfully')
    }
  }, [isLoadingProject, storage.currentProjectId, loadingProgress.percent])
  
  const checkForCrashRecovery = async () => {
    try {
      const recovery = await storage.checkForRecovery()
      if (recovery.hasBackup && recovery.backupPath && recovery.projectName) {
        setRecoveryInfo({ backupPath: recovery.backupPath, projectName: recovery.projectName })
        setShowRecoveryDialog(true)
      }
    } catch (error) {
      console.error('Failed to check for recovery:', error)
    }
  }
  
  const handleRecover = async () => {
    if (!recoveryInfo) return
    
    try {
      // recoverFromBackup expects the project path, not the backup path
      await storage.recoverFromBackup(recoveryInfo.backupPath)
      setShowRecoveryDialog(false)
      setRecoveryInfo(null)
      // Open the recovered project
      await storage.openProject(recoveryInfo.backupPath, (progress) => {
        setLoadingProgress(progress as any)
      })
      setShowDashboard(false)
    } catch (error: unknown) {
      // Show error but keep dialog open for retry
      showError(`Failed to recover: ${error instanceof Error ? error.message : String(error)}`)
      // Dialog stays open so user can retry
    }
  }
  
  const handleDiscardRecovery = async () => {
    if (!recoveryInfo) return
    
    try {
      // Delete the backup file directly using invoke
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('delete_project', { filePath: recoveryInfo.backupPath })
      setShowRecoveryDialog(false)
      setRecoveryInfo(null)
    } catch (error) {
      console.error('Failed to delete backup:', error)
    }
  }
  
  const handleBackToDashboard = () => {
    setShowDashboard(true)
    // If there's a pending file to open, try opening it now
    if (pendingFilePath) {
      setIsLoadingProject(true)
      setLoadingProgress({ phase: 'loading', percent: 0, message: 'Initializing...' })
      
      storage.openProjectFromPath(pendingFilePath, { 
        skipUnsavedCheck: true,
        onProgress: (progress) => {
          setLoadingProgress(progress as any)
        }
      })
        .then(() => {
          if (storage.currentProjectId) {
            setShowDashboard(false)
            // Don't show success message yet - wait for 100% completion
          }
        })
        .catch((error: unknown) => {
          setError(error instanceof Error ? error.message : String(error))
          setTimeout(() => setError(null), 5000)
          setIsLoadingProject(false)
        })
        .finally(() => {
          setPendingFilePath(null)
          // Don't set loading to false here - wait for 100% completion
        })
    } else if (pendingProjectId) {
      // If there's a pending project ID to open, try opening it now
      setIsLoadingProject(true)
      setLoadingProgress({ phase: 'loading', percent: 0, message: 'Initializing...' })
      
      storage.openProject(pendingProjectId, (progress) => {
        setLoadingProgress(progress as any)
      })
        .then(() => {
          setShowDashboard(false)
          // Don't show success message yet - wait for 100% completion
        })
        .catch((error: unknown) => {
          setError(error instanceof Error ? error.message : String(error))
          setTimeout(() => setError(null), 5000)
          setIsLoadingProject(false)
        })
        .finally(() => {
          setPendingProjectId(null)
          // Don't set loading to false here - wait for 100% completion
        })
    }
  }
  
  // Show loading state while storage initializes
  if (!storage.isInitialized) {
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
        <div style={{ fontSize: '1.5rem' }}>
          {storage.error ? 'Storage Initialization Failed' : 'Initializing SCORM Builder...'}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
          {storage.error ? storage.error : 'Setting up file storage system'}
        </div>
        {storage.error && (
          <>
            <div style={{ 
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#1f2937',
              borderRadius: '0.5rem',
              maxWidth: '400px',
              textAlign: 'center'
            }}>
              <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                This usually means the Tauri backend isn't responding.
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                Make sure you're running the app with 'npm run tauri dev'
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Retry
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {error && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          backgroundColor: '#dc2626',
          color: 'white',
          padding: '0.75rem 1rem',
          borderRadius: '0.375rem',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          maxWidth: '24rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem'
        }}>
          <span>{error}</span>
          <button
            onClick={() => {
              if (error) {
                dismissError(error)
              }
              setError(null)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: '1',
              padding: '0',
              opacity: 0.8
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
            aria-label="Dismiss error"
            title="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      {showDashboard ? (
        <ProjectDashboard onProjectSelected={handleProjectSelected} onSecretClick={onSecretClick} />
      ) : storage.currentProjectId ? (
        <UnifiedMediaProvider projectId={storage.currentProjectId}>
          <App 
            onBackToDashboard={handleBackToDashboard}
            pendingProjectId={pendingProjectId}
            onPendingProjectHandled={() => setPendingProjectId(null)}
            skipInitialLoad={true}
          />
        </UnifiedMediaProvider>
      ) : (
        <App 
          onBackToDashboard={handleBackToDashboard}
          pendingProjectId={pendingProjectId}
          onPendingProjectHandled={() => setPendingProjectId(null)}
          skipInitialLoad={false}
        />
      )}
      
      {showRecoveryDialog && recoveryInfo && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#1f2937',
            padding: '2rem',
            borderRadius: '0.5rem',
            maxWidth: '28rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', color: '#f3f4f6' }}>
              Recover Unsaved Work?
            </h2>
            <p style={{ color: '#d1d5db', marginBottom: '1.5rem' }}>
              We found unsaved work from a previous session for the project "{recoveryInfo.projectName}". 
              Would you like to recover it?
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={handleDiscardRecovery}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#374151',
                  color: '#f3f4f6',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              >
                Discard
              </button>
              <button
                onClick={handleRecover}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              >
                Recover
              </button>
            </div>
          </div>
        </div>
      )}
      
      <ProjectLoadingDialog 
        isOpen={isLoadingProject}
        progress={loadingProgress}
      />
    </>
  )
}

function DashboardWithStatusPanel() {
  const statusMessages = useStatusMessages()
  const storage = useStorage()
  const [showDashboard, setShowDashboard] = useState(true)
  
  // Workflow Recorder visibility state with multiple activation methods
  const [showWorkflowRecorder, setShowWorkflowRecorder] = useState(() => {
    // Check localStorage first for persistent setting
    const stored = localStorage.getItem('workflow_recorder_enabled')
    if (stored === 'true') return true
    if (stored === 'false') return false
    
    // Check URL parameters for one-time activation
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('beta') === 'recorder' || params.get('workflow') === '1') {
        // Enable and persist for this browser
        localStorage.setItem('workflow_recorder_enabled', 'true')
        return true
      }
    } catch (e) {
      // URL parsing failed, ignore
    }
    
    // Default: show in development, hide in production
    return import.meta.env.DEV
  })

  // Keyboard shortcut handler for workflow recorder
  useEffect(() => {
    const handleWorkflowRecorderKeyPress = (e: KeyboardEvent) => {
      // Toggle workflow recorder (Ctrl+Shift+W)
      if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault()
        setShowWorkflowRecorder(prev => {
          const newState = !prev
          localStorage.setItem('workflow_recorder_enabled', String(newState))
          safeLog('Beta', `Workflow Recorder ${newState ? 'enabled' : 'disabled'} via keyboard shortcut`)
          return newState
        })
      }
    }
    
    window.addEventListener('keydown', handleWorkflowRecorderKeyPress)
    return () => window.removeEventListener('keydown', handleWorkflowRecorderKeyPress)
  }, [])

  // Check if we have a current project
  useEffect(() => {
    if (storage.currentProjectId) {
      // When there's a project, hide dashboard elements (user is working on project)
      setShowDashboard(false)
    } else {
      // When no project, show dashboard elements (main dashboard view)
      setShowDashboard(true)
    }
  }, [storage.currentProjectId])

  // Secret click handler for beta feature activation
  const handleSecretClick = useCallback(() => {
    setShowWorkflowRecorder(true)
    localStorage.setItem('workflow_recorder_enabled', 'true')
    safeLog('Beta', 'Workflow Recorder enabled via secret click (5 clicks on title)')
  }, [])

  return (
    <>
      <DashboardContent onSecretClick={handleSecretClick} />
      <DebugInfo />
      <ErrorNotification />
      <NotificationToStatusBridge onAddStatusMessage={statusMessages.addMessage} />
      {/* StatusPanel is handled by App.tsx - do not show on dashboard to avoid duplication */}
      {false && (
        <StatusPanel 
          messages={statusMessages.messages}
          onDismiss={statusMessages.dismissMessage}
          onClearAll={statusMessages.clearAllMessages}
        />
      )}
      {/* Workflow Recorder - available for beta testers */}
      {showWorkflowRecorder && (
        <WorkflowRecorder 
          onClose={() => {
            setShowWorkflowRecorder(false)
            localStorage.setItem('workflow_recorder_enabled', 'false')
            safeLog('Beta', 'Workflow Recorder disabled via close button')
          }}
        />
      )}
    </>
  )
}

export function AppWithDashboard() {
  return (
    <PersistentStorageProvider>
      <NotificationProvider>
        <UnsavedChangesProvider>
          <DashboardWithStatusPanel />
        </UnsavedChangesProvider>
      </NotificationProvider>
    </PersistentStorageProvider>
  )
}
