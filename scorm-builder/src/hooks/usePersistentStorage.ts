import { useEffect, useCallback, useState } from 'react';
import { MockFileStorage } from '../services/MockFileStorage';
import { FileStorage } from '../services/FileStorage';
import { isTauriEnvironment } from '../config/environment';
import { extractProjectId } from '../utils/projectIdExtraction';

export function usePersistentStorage(providedFileStorage?: FileStorage) {
  // Use provided FileStorage instance (for testing) or create singleton instance
  const [fileStorage] = useState<FileStorage>(() => {
    if (providedFileStorage) {
      return providedFileStorage;
    }
    return isTauriEnvironment()
      ? FileStorage.getInstance()
      : new MockFileStorage() as any as FileStorage;
  });
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
        await fileStorage.initialize();
        // Sync initial state with FileStorage
        setCurrentProjectId(fileStorage.currentProjectId);
        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize storage');
      }
    }
    initialize();
  }, []);

  // Polling mechanism to keep React state synchronized with FileStorage
  useEffect(() => {
    if (!isInitialized) return;

    const syncInterval = setInterval(() => {
      const actualProjectId = fileStorage.currentProjectId;
      if (actualProjectId !== currentProjectId) {
        console.log('[usePersistentStorage] Syncing React state with FileStorage:', {
          reactState: currentProjectId,
          fileStorageState: actualProjectId
        });
        setCurrentProjectId(actualProjectId);
      }
    }, 100); // Check every 100ms for sync

    return () => clearInterval(syncInterval);
  }, [isInitialized, currentProjectId, fileStorage]);

  const createProject = useCallback(async (name: string) => {
    const project = await fileStorage.createProject(name);
    // Use fileStorage.currentProjectId to ensure consistency
    setCurrentProjectId(fileStorage.currentProjectId);
    return project;
  }, []);

  const openProject = useCallback(async (projectId: string, onProgress?: (progress: any) => void) => {
    try {
      // Report initial phase
      onProgress?.({ phase: 'loading', percent: 5, message: 'Opening project file...' });
      
      // Load project metadata
      onProgress?.({ phase: 'loading', percent: 10, message: 'Reading project metadata...' });
      await fileStorage.openProject(projectId);
      
      // Report media loading phase
      onProgress?.({ phase: 'media', percent: 20, message: 'Initializing media store...' });
      
      // Load media through MediaRegistry (which will handle the actual loading)
      // The MediaRegistry.loadProject will be called by MediaProvider
      // We just need to simulate the progress here based on what we know
      
      // Media loading is now handled by MediaRegistry
      // Report media loading phase for UI consistency
      onProgress?.({ 
        phase: 'media', 
        percent: 70, 
        message: 'Loading media files...'
      });
      
      // Small delay to show media loading progress (skip in tests)
      if (!import.meta.env.VITEST) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Report content loading phase
      onProgress?.({ phase: 'content', percent: 75, message: 'Loading course structure...' });
      const courseContent = await fileStorage.getContent('course-content');
      
      onProgress?.({ phase: 'content', percent: 80, message: 'Loading topic content...' });
      // Count topics if available
      const topicCount = courseContent?.topics?.length || 0;
      if (topicCount > 0) {
        onProgress?.({ phase: 'content', percent: 82, message: `Loading ${topicCount} topic${topicCount > 1 ? 's' : ''}...` });
      }
      
      onProgress?.({ phase: 'content', percent: 85, message: 'Loading assessment data...' });
      // Course metadata is loaded automatically with the project
      
      onProgress?.({ phase: 'content', percent: 90, message: 'Preparing user interface...' });
      
      // Report finalizing phase
      onProgress?.({ phase: 'finalizing', percent: 95, message: 'Finalizing workspace setup...' });

      // FIXED STATE SYNCHRONIZATION: Set React state and verify FileStorage consistency
      const actualProjectId = fileStorage.currentProjectId;
      setCurrentProjectId(actualProjectId);

      // Wait for FileStorage to be in a consistent state (no closure issues)
      // CONSISTENCY FIX: Use extractProjectId for comparison to match coordinatedProjectLoading
      const expectedProjectId = extractProjectId(projectId);
      const maxAttempts = 10; // 1 second max wait
      let attempts = 0;
      while (attempts < maxAttempts) {
        // Check FileStorage directly (not closure variables)
        const freshProjectId = fileStorage.currentProjectId;
        if (freshProjectId === expectedProjectId && freshProjectId !== null) {
          console.log('[usePersistentStorage] FileStorage state verified after', attempts * 100, 'ms', {
            originalProjectId: projectId,
            expectedProjectId,
            freshProjectId
          });
          // Force final React state update with the verified value
          setCurrentProjectId(freshProjectId);
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (attempts >= maxAttempts) {
        console.warn('[usePersistentStorage] State synchronization timeout - proceeding anyway');
        // Force final update even if timeout
        setCurrentProjectId(fileStorage.currentProjectId);
      }
      
      // Complete
      onProgress?.({ phase: 'finalizing', percent: 100, message: 'Project ready!' });
    } catch (error) {
      console.error('Failed to open project:', error);
      throw error;
    }
  }, []);

  const openProjectFromFile = useCallback(async () => {
    const project = await fileStorage.loadProjectFromFile();
    if (project) {
      // Use fileStorage.currentProjectId to ensure consistency
      setCurrentProjectId(fileStorage.currentProjectId);
    }
  }, []);

  const saveProject = useCallback(async () => {
    await fileStorage.saveProject();
  }, []);

  const listProjects = useCallback(async () => {
    return fileStorage.listProjects();
  }, []);

  const deleteProject = useCallback(async (projectId: string) => {
    await fileStorage.deleteProject(projectId);
    if (currentProjectId === projectId) {
      setCurrentProjectId(null);
    }
  }, [currentProjectId]);

  const renameProject = useCallback(async (projectId: string, newName: string) => {
    return await fileStorage.renameProject(projectId, newName);
  }, []);

  const storeMedia = useCallback(
    async (id: string, blob: Blob, mediaType: 'image' | 'video' | 'audio' | 'caption', metadata?: Record<string, any>) => {
      // Ensure required MediaMetadata fields are present
      const fullMetadata = {
        page_id: metadata?.page_id || '',
        original_name: metadata?.original_name || 'unknown',
        ...metadata,
        type: mediaType
      };
      await fileStorage.storeMedia(id, blob, mediaType, fullMetadata);
    },
    []
  );

  const storeYouTubeVideo = useCallback(
    async (id: string, youtubeUrl: string, metadata?: Record<string, any>) => {
      await fileStorage.storeYouTubeVideo(id, youtubeUrl, metadata);
    },
    []
  );

  const getMediaForTopic = useCallback(async (topicId: string) => {
    return fileStorage.getMediaForTopic(topicId);
  }, []);

  const getContent = useCallback(async (id: string) => {
    return fileStorage.getContent(id);
  }, []);

  const saveContent = useCallback(async (id: string, content: any) => {
    await fileStorage.saveContent(id, content);
  }, []);

  const getCourseMetadata = useCallback(async () => {
    return fileStorage.courseData;
  }, []);

  const getRecentProjects = useCallback(async () => {
    return fileStorage.getRecentProjects();
  }, []);

  const checkForRecovery = useCallback(async () => {
    return fileStorage.checkForRecovery();
  }, []);

  const recoverFromBackup = useCallback(async (backupPath: string) => {
    await fileStorage.recoverFromBackup(backupPath);
  }, []);


  const exportProject = useCallback(async () => {
    return fileStorage.exportProject();
  }, []);

  const importProjectFromZip = useCallback(async (zipBlob: Blob) => {
    await fileStorage.importProjectFromZip(zipBlob);
  }, []);

  const getCurrentProjectId = useCallback(() => {
    return fileStorage.currentProjectId;
  }, []);

  const setProjectsDirectory = useCallback((directory: string) => {
    fileStorage.setProjectsDirectory(directory);
  }, []);

  const migrateFromLocalStorage = useCallback(async () => {
    return fileStorage.migrateFromLocalStorage();
  }, []);

  const clearRecentFilesCache = useCallback(async () => {
    await fileStorage.clearRecentFilesCache();
  }, []);

  // Add missing methods from interface
  const openProjectFromPath = useCallback(async (filePath: string, options?: any) => {
    await fileStorage.openProjectFromPath(filePath, options);
    setCurrentProjectId(fileStorage.currentProjectId);
  }, []);

  const getMedia = useCallback(async (id: string) => {
    // getMedia should delegate to getMediaUrl
    return fileStorage.getMediaUrl(id);
  }, []);


  const saveCourseSeedData = useCallback(async (seedData: any) => {
    return fileStorage.saveCourseSeedData(seedData);
  }, []);

  const getCourseSeedData = useCallback(async () => {
    return fileStorage.getCourseSeedData();
  }, []);

  const saveCourseContent = useCallback(async (content: any) => {
    return fileStorage.saveCourseContent(content);
  }, []);

  const getCourseContent = useCallback(async () => {
    return fileStorage.getCourseContent();
  }, []);

  const saveAiPrompt = useCallback(async (prompt: string) => {
    await fileStorage.saveContent('aiPrompt', prompt);
  }, []);

  const getAiPrompt = useCallback(async () => {
    return fileStorage.getContent('aiPrompt');
  }, []);

  const saveAudioSettings = useCallback(async (settings: any) => {
    await fileStorage.saveContent('audioSettings', settings);
  }, []);

  const getAudioSettings = useCallback(async () => {
    return fileStorage.getContent('audioSettings');
  }, []);

  const saveScormConfig = useCallback(async (config: any) => {
    await fileStorage.saveContent('scormConfig', config);
  }, []);

  const getScormConfig = useCallback(async () => {
    return fileStorage.getContent('scormConfig');
  }, []);

  return {
    isInitialized,
    currentProjectId,
    error,
    createProject,
    openProject,
    openProjectFromFile,
    openProjectFromPath,
    saveProject,
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
    getCourseMetadata,
    saveCourseSeedData,
    getCourseSeedData,
    saveCourseContent,
    getCourseContent,
    saveAiPrompt,
    getAiPrompt,
    saveAudioSettings,
    getAudioSettings,
    saveScormConfig,
    getScormConfig,
    deleteProject,
    renameProject,
    exportProject,
    importProjectFromZip,
    getCurrentProjectId,
    setProjectsDirectory,
    migrateFromLocalStorage,
    clearRecentFilesCache,
    fileStorage,  // Expose the FileStorage instance
  };
}
