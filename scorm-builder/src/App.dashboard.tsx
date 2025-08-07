import { useState, useEffect } from 'react'
import { ProjectDashboard } from './components/ProjectDashboard'
import { ProjectLoadingDialog } from './components/ProjectLoadingDialog'
import { PersistentStorageProvider, useStorage } from './contexts/PersistentStorageContext'
import { UnifiedMediaProvider } from './contexts/UnifiedMediaContext'
import { handleFileAssociation } from './utils/fileAssociation'
import { DebugInfo } from './components/DebugInfo'
import { DebugPanel } from './components/DebugPanel'
import { ErrorNotification, showError, showInfo } from './components/ErrorNotification'
import App from './App'

function DashboardContent() {
  const storage = useStorage()
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
        setError(errorMessage)
        // Clear error after 5 seconds
        setTimeout(() => setError(null), 5000)
      },
      onUnsavedChanges: (filePath) => {
        // Store the pending file path to open after saving/discarding
        setPendingFilePath(filePath)
        // This will trigger the unsaved changes dialog in the App component
      }
    })
  }, [])
  
  const handleProjectSelected = async (projectId: string) => {
    console.log('[App.dashboard] handleProjectSelected called with:', projectId)
    try {
      setIsLoadingProject(true)
      setLoadingProgress({ phase: 'loading', percent: 0, message: 'Initializing...' })
      
      console.log('[App.dashboard] Opening project:', projectId)
      await storage.openProject(projectId, (progress) => {
        setLoadingProgress(progress as any)
      })
      console.log('[App.dashboard] Project opened, currentProjectId:', storage.currentProjectId)
      
      // Don't close the dialog yet - wait for media to load
      // The dialog will close when progress reaches 100%
      setShowDashboard(false)
    } catch (err: any) {
      if (err.message === 'UNSAVED_CHANGES') {
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
  
  const checkForCrashRecovery = async () => {
    try {
      const recovery = await storage.checkForRecovery()
      if (recovery.hasBackup && recovery.projectPath && recovery.projectName) {
        setRecoveryInfo({ backupPath: recovery.projectPath, projectName: recovery.projectName })
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
      const result = await storage.recoverFromBackup(recoveryInfo.backupPath)
      setShowRecoveryDialog(false)
      setRecoveryInfo(null)
      // Open the recovered project
      await storage.openProject(recoveryInfo.backupPath, (progress) => {
        setLoadingProgress(progress as any)
      })
      setShowDashboard(false)
    } catch (error: any) {
      // Show error but keep dialog open for retry
      showError(`Failed to recover: ${error.message}`)
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
        .catch((error: any) => {
          setError(error.message)
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
        .catch((error: any) => {
          setError(error.message)
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
          maxWidth: '24rem'
        }}>
          {error}
        </div>
      )}
      {showDashboard ? (
        <ProjectDashboard onProjectSelected={handleProjectSelected} />
      ) : storage.currentProjectId ? (
        <UnifiedMediaProvider projectId={storage.currentProjectId}>
          <App 
            onBackToDashboard={handleBackToDashboard}
            pendingProjectId={pendingProjectId}
            onPendingProjectHandled={() => setPendingProjectId(null)}
          />
        </UnifiedMediaProvider>
      ) : (
        <App 
          onBackToDashboard={handleBackToDashboard}
          pendingProjectId={pendingProjectId}
          onPendingProjectHandled={() => setPendingProjectId(null)}
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

export function AppWithDashboard() {
  return (
    <PersistentStorageProvider>
      <DashboardContent />
      <DebugInfo />
      <DebugPanel />
      <ErrorNotification />
    </PersistentStorageProvider>
  )
}