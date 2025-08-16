import { createContext, useContext, ReactNode } from 'react'
import { usePersistentStorage } from '../hooks/usePersistentStorage'
import type { FileStorage } from '../services/FileStorage'

interface PersistentStorageContextValue {
  isInitialized: boolean
  currentProjectId: string | null
  error: string | null
  createProject: (name: string, defaultFolder?: string) => Promise<any>
  openProject: (projectId: string, onProgress?: (progress: { phase: string; percent: number; message: string; itemsLoaded?: number; totalItems?: number }) => void) => Promise<void>
  openProjectFromFile: () => Promise<void>
  openProjectFromPath: (filePath: string, options?: { skipUnsavedCheck?: boolean; onProgress?: (progress: { phase: string; percent: number; message: string; itemsLoaded?: number; totalItems?: number }) => void }) => Promise<void>
  saveProject: () => Promise<void>
  listProjects: () => Promise<any[]>
  getRecentProjects: () => Promise<any[]>
  checkForRecovery: () => Promise<{ hasBackup: boolean; backupPath?: string; projectName?: string }>
  recoverFromBackup: (backupPath: string) => Promise<void>
  storeMedia: (id: string, blob: Blob, mediaType: 'image' | 'video' | 'audio' | 'caption', metadata?: Record<string, any>) => Promise<void>
  storeYouTubeVideo: (id: string, youtubeUrl: string, metadata?: Record<string, any>) => Promise<void>
  getMedia: (id: string) => Promise<any>
  getMediaForTopic: (topicId: string) => Promise<any[]>
  saveContent: (id: string, content: any) => Promise<void>
  getContent: (id: string) => Promise<any>
  saveCourseMetadata: (metadata: any) => Promise<void>
  getCourseMetadata: () => Promise<any>
  saveCourseSeedData: (seedData: any) => Promise<void>
  getCourseSeedData: () => Promise<any>
  saveAiPrompt: (prompt: string) => Promise<void>
  getAiPrompt: () => Promise<string | null>
  saveAudioSettings: (settings: any) => Promise<void>
  getAudioSettings: () => Promise<any>
  saveScormConfig: (config: any) => Promise<void>
  getScormConfig: () => Promise<any>;
  deleteProject: (projectId: string) => Promise<void>;
  renameProject: (projectId: string, newName: string) => Promise<any>;
  exportProject: () => Promise<Blob>;
  importProjectFromZip: (zipBlob: Blob) => Promise<void>;
  getCurrentProjectId: () => string | null;
  setProjectsDirectory: (directory: string) => void;
  migrateFromLocalStorage: () => Promise<any[]>;
  clearRecentFilesCache: () => Promise<void>;
  fileStorage: FileStorage;  // Expose FileStorage instance
}

const PersistentStorageContext = createContext<PersistentStorageContextValue | null>(null)

export function PersistentStorageProvider({ children }: { children: ReactNode }) {
  const storage = usePersistentStorage()
  
  return (
    <PersistentStorageContext.Provider value={storage}>
      {children}
    </PersistentStorageContext.Provider>
  )
}

export function useStorage() {
  const context = useContext(PersistentStorageContext)
  if (!context) {
    throw new Error('useStorage must be used within a PersistentStorageProvider')
  }
  return context
}