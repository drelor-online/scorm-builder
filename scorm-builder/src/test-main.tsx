import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'

// Mock PersistentStorageProvider for testing
const MockStorageProvider = ({ children }: { children: React.ReactNode }) => {
  const mockStorage = {
    isInitialized: true,
    currentProjectId: 'test-project',
    error: null,
    createProject: async () => ({ id: 'test-project', name: 'Test Project' }),
    openProject: async () => {},
    openProjectFromFile: async () => {},
    openProjectFromPath: async () => {},
    saveProject: async () => {},
    saveProjectAs: async () => {},
    listProjects: async () => [],
    getRecentProjects: async () => [],
    checkForRecovery: async () => ({ hasBackup: false }),
    recoverFromBackup: async () => {},
    storeMedia: async () => {},
    storeYouTubeVideo: async () => {},
    getMedia: async () => null,
    getMediaForTopic: async () => [],
    saveContent: async () => {},
    getContent: async () => null,
    saveCourseMetadata: async () => {},
    getCourseMetadata: async () => null,
    saveAiPrompt: async () => {},
    getAiPrompt: async () => null,
    saveAudioSettings: async () => {},
    getAudioSettings: async () => null,
    saveScormConfig: async () => {},
    getScormConfig: async () => null,
    deleteProject: async () => {},
    exportProject: async () => new Blob(),
    importProjectFromZip: async () => {},
    getCurrentProjectId: () => 'test-project',
    setProjectsDirectory: () => {},
    migrateFromLocalStorage: async () => [],
    clearRecentFilesCache: async () => {}
  }

  return (
    <div>
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && child.type === App) {
          // Render App directly without dashboard wrapper
          return <App />
        }
        return child
      })}
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <MockStorageProvider>
          <App />
        </MockStorageProvider>
      </ErrorBoundary>
    </React.StrictMode>
  )
}