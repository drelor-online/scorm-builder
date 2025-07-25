import { useEffect, useCallback, useState } from 'react'
import { fileStorage } from '../services/FileStorage'

export function usePersistentStorage() {
  // Check if fileStorage is already initialized (e.g., from HMR)
  const [isInitialized, setIsInitialized] = useState(fileStorage.isInitialized)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(fileStorage.getCurrentProjectId())
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3
  
  // Initialize storage singleton with retry logic
  useEffect(() => {
    let mounted = true
    let retryTimeout: NodeJS.Timeout
    
    async function initWithRetry() {
      // Skip if already initialized
      if (fileStorage.isInitialized) {
        console.log('[usePersistentStorage] FileStorage already initialized, skipping init')
        setIsInitialized(true)
        setCurrentProjectId(fileStorage.getCurrentProjectId())
        setError(null)
        return
      }
      
      try {
        console.log('[usePersistentStorage] Initializing FileStorage...')
        await fileStorage.initialize()
        if (mounted) {
          console.log('[usePersistentStorage] FileStorage initialized:', fileStorage.isInitialized)
          setIsInitialized(fileStorage.isInitialized)
          setCurrentProjectId(fileStorage.getCurrentProjectId())
          setError(null)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize storage'
        console.error(`Storage initialization failed (attempt ${retryCount + 1}/${MAX_RETRIES}):`, errorMessage)
        
        if (mounted) {
          setError(errorMessage)
          setIsInitialized(false)
          
          // Retry with exponential backoff
          if (retryCount < MAX_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) // Max 10 seconds
            console.log(`Retrying storage initialization in ${delay}ms...`)
            retryTimeout = setTimeout(() => {
              setRetryCount(prev => prev + 1)
            }, delay)
          }
        }
      }
    }
    
    initWithRetry()
    
    return () => {
      mounted = false
      if (retryTimeout) clearTimeout(retryTimeout)
    }
  }, [retryCount])
  
  // Subscribe to FileStorage state changes
  useEffect(() => {
    if (!isInitialized) return
    
    const unsubscribe = fileStorage.addStateChangeListener((state) => {
      setCurrentProjectId(state.projectId)
    })
    
    return unsubscribe
  }, [isInitialized])
  
  const createProject = useCallback(async (name: string, defaultFolder?: string) => {
    try {
      console.log('[usePersistentStorage] createProject called with:', name, defaultFolder)
      const project = await fileStorage.createProject(name, defaultFolder)
      console.log('[usePersistentStorage] createProject returned:', project)
      setCurrentProjectId(project.id)
      
      // Log state change for debug monitoring
      if ((window as any).__debugLogStateChange) {
        (window as any).__debugLogStateChange('project', { 
          action: 'create', 
          projectId: project.id, 
          name 
        })
      }
      
      return project
    } catch (error) {
      console.error('[usePersistentStorage] createProject error:', error)
      throw error
    }
  }, [])
  
  const openProject = useCallback(async (projectId: string, onProgress?: (progress: { phase: string; percent: number; message: string; itemsLoaded?: number; totalItems?: number }) => void) => {
    await fileStorage.openProject(projectId, onProgress)
    setCurrentProjectId(fileStorage.getCurrentProjectId())
    
    // Log state change for debug monitoring
    if ((window as any).__debugLogStateChange) {
      (window as any).__debugLogStateChange('project', { 
        action: 'open', 
        projectId 
      })
    }
  }, [])
  
  const openProjectFromFile = useCallback(async () => {
    await fileStorage.openProjectFromFile()
    setCurrentProjectId(fileStorage.getCurrentProjectId())
  }, [])
  
  const openProjectFromPath = useCallback(async (filePath: string, options?: { skipUnsavedCheck?: boolean; onProgress?: (progress: { phase: string; percent: number; message: string; itemsLoaded?: number; totalItems?: number }) => void }) => {
    await fileStorage.openProjectFromPath(filePath, options)
    setCurrentProjectId(fileStorage.getCurrentProjectId())
  }, [])
  
  const saveProject = useCallback(async () => {
    await fileStorage.saveProject()
  }, [])
  
  const saveProjectAs = useCallback(async () => {
    await fileStorage.saveProjectAs()
  }, [])
  
  const listProjects = useCallback(async () => {
    return fileStorage.listProjects()
  }, [])
  
  const getRecentProjects = useCallback(async () => {
    return fileStorage.getRecentProjects()
  }, [])
  
  const checkForRecovery = useCallback(async () => {
    return fileStorage.checkForRecovery()
  }, [])
  
  const recoverFromBackup = useCallback(async (backupPath: string) => {
    await fileStorage.recoverFromBackup(backupPath)
    setCurrentProjectId(fileStorage.getCurrentProjectId())
  }, [])
  
  const storeMedia = useCallback(async (
    id: string,
    blob: Blob,
    mediaType: 'image' | 'video' | 'audio' | 'caption',
    metadata?: Record<string, any>
  ) => {
    return fileStorage.storeMedia(id, blob, mediaType, metadata)
  }, [])
  
  const storeYouTubeVideo = useCallback(async (
    id: string,
    youtubeUrl: string,
    metadata?: Record<string, any>
  ) => {
    return fileStorage.storeYouTubeVideo(id, youtubeUrl, metadata)
  }, [])
  
  const getMedia = useCallback(async (id: string) => {
    return fileStorage.getMedia(id)
  }, [])
  
  const getMediaForTopic = useCallback(async (topicId: string) => {
    return fileStorage.getMediaForTopic(topicId)
  }, [])
  
  const saveContent = useCallback(async (id: string, content: any) => {
    await fileStorage.saveContent(id, content)
    
    // Log state change for debug monitoring
    if ((window as any).__debugLogStateChange) {
      (window as any).__debugLogStateChange('content', { 
        action: 'save', 
        contentId: id,
        contentType: content?.topicId ? 'topic' : 'unknown'
      })
    }
  }, [])
  
  const getContent = useCallback(async (id: string) => {
    return fileStorage.getContent(id)
  }, [])
  
  const saveCourseMetadata = useCallback(async (metadata: any) => {
    return fileStorage.saveCourseMetadata(metadata)
  }, [])
  
  const getCourseMetadata = useCallback(async () => {
    return fileStorage.getCourseMetadata()
  }, [])
  
  const saveAiPrompt = useCallback(async (prompt: string) => {
    return fileStorage.saveAiPrompt(prompt)
  }, [])
  
  const getAiPrompt = useCallback(async () => {
    return fileStorage.getAiPrompt()
  }, [])
  
  const saveAudioSettings = useCallback(async (settings: any) => {
    return fileStorage.saveAudioSettings(settings)
  }, [])
  
  const getAudioSettings = useCallback(async () => {
    return fileStorage.getAudioSettings()
  }, [])
  
  const saveScormConfig = useCallback(async (config: any) => {
    return fileStorage.saveScormConfig(config)
  }, [])
  
  const getScormConfig = useCallback(async () => {
    return fileStorage.getScormConfig()
  }, [])
  
  const deleteProject = useCallback(async (projectId: string, filePath?: string) => {
    await fileStorage.deleteProject(projectId, filePath)
    if (currentProjectId === projectId) {
      setCurrentProjectId(null)
    }
  }, [currentProjectId])
  
  const exportProject = useCallback(async () => {
    return fileStorage.exportProject()
  }, [])
  
  const migrateFromLocalStorage = useCallback(async () => {
    return fileStorage.migrateFromLocalStorage()
  }, [])
  
  const clearRecentFilesCache = useCallback(async () => {
    return fileStorage.clearRecentFilesCache()
  }, [])
  
  const importProjectFromZip = useCallback(async (zipBlob: Blob) => {
    await fileStorage.importProjectFromZip(zipBlob)
    setCurrentProjectId(fileStorage.getCurrentProjectId())
  }, [])
  
  const getCurrentProjectId = useCallback(() => {
    return fileStorage.getCurrentProjectId()
  }, [])
  
  const setProjectsDirectory = useCallback((directory: string) => {
    fileStorage.setProjectsDirectory(directory)
  }, [])
  
  // Force re-initialization (for debugging)
  const forceInitialize = useCallback(async () => {
    console.log('[usePersistentStorage] Force initializing storage...')
    try {
      await fileStorage.initialize()
      setIsInitialized(fileStorage.isInitialized)
      setCurrentProjectId(fileStorage.getCurrentProjectId())
      setError(null)
      console.log('[usePersistentStorage] Force initialization complete:', fileStorage.isInitialized)
    } catch (err) {
      console.error('[usePersistentStorage] Force initialization failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize')
    }
  }, [])
  
  // Expose for debugging
  if (typeof window !== 'undefined') {
    (window as any).__forceInitStorage = forceInitialize
  }
  
  return {
    isInitialized,
    currentProjectId,
    error,
    createProject,
    openProject,
    openProjectFromFile,
    openProjectFromPath,
    saveProject,
    saveProjectAs,
    listProjects,
    getRecentProjects,
    checkForRecovery,
    recoverFromBackup,
    storeMedia,
    storeYouTubeVideo,
    getMedia,
    getMediaForTopic,
    saveContent,
    getContent,
    saveCourseMetadata,
    getCourseMetadata,
    saveAiPrompt,
    getAiPrompt,
    saveAudioSettings,
    getAudioSettings,
    saveScormConfig,
    getScormConfig,
    deleteProject,
    exportProject,
    importProjectFromZip,
    getCurrentProjectId,
    setProjectsDirectory,
    migrateFromLocalStorage,
    clearRecentFilesCache
  }
}