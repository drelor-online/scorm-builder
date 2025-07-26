import { invoke } from '@tauri-apps/api/core'
import * as dialog from '@tauri-apps/plugin-dialog'
import { join } from '@tauri-apps/api/path'
import { exists } from '@tauri-apps/plugin-fs'
import { updateWindowTitle } from '../utils/windowTitle'
import { sanitizeContentItem } from '../utils/contentSanitizer'
import { logger } from '../utils/logger'
import { generateMediaId, getPageIndex } from './idGenerator'
import { mediaStore } from './MediaStore'
import type { MediaMetadata } from './MediaStore'

// Types matching Rust structures
export interface ProjectFile {
  project: ProjectMetadata
  course_data: CourseData
  ai_prompt: AiPromptData | null
  course_content: any | null
  media: MediaData
  audio_settings: AudioSettings
  scorm_config: ScormConfig
}

export interface ProjectMetadata {
  id: string
  name: string
  created: string
  last_modified: string
}

export interface CourseData {
  title: string
  difficulty: number
  template: string
  topics: string[]
  custom_topics: string | null
}

export interface AiPromptData {
  prompt: string
  generated_at: string
}

export interface MediaData {
  images: MediaItem[]
  videos: VideoItem[]
  audio: MediaItem[]
  captions?: MediaItem[]
}

export interface MediaItem {
  id: string
  filename: string
  base64Data?: string // Optional for backward compatibility
  relativePath?: string // Path relative to project root
  type?: 'image' | 'audio' | 'caption'
  metadata?: any
}

export interface VideoItem {
  id: string
  youtubeUrl: string
  type?: 'video'
  metadata?: any
}

export interface AudioSettings {
  voice: string
  speed: number
  pitch: number
}

export interface ScormConfig {
  version: string
  completion_criteria: string
  passing_score: number
}

interface ContentItem {
  topicId: string
  title?: string
  content?: string
  narration?: string
  [key: string]: any
}

export class FileStorage {
  private _projectsDirectory: string = ''
  private currentProject: ProjectFile | null = null
  private currentFilePath: string | null = null
  private saveDebounceTimer: NodeJS.Timeout | null = null
  private readonly SAVE_DEBOUNCE_MS = 1500
  private autoBackupTimer: NodeJS.Timeout | null = null
  private AUTO_BACKUP_INTERVAL_MS = 60000 // 1 minute default
  private autoBackupEnabled = true // Can be configured
  private stateChangeListeners: Set<(state: { projectId: string | null, hasUnsavedChanges: boolean }) => void> = new Set()
  
  private _isInitialized: boolean = false
  currentProjectId: string | null = null
  
  get isInitialized(): boolean {
    return this._isInitialized
  }
  
  get projectsDirectory(): string {
    return this._projectsDirectory
  }
  
  setProjectsDirectory(directory: string): void {
    this._projectsDirectory = directory
    logger.info('Projects directory updated to:', directory)
  }
  
  async initialize(): Promise<void> {
    // Skip if already initialized
    if (this._isInitialized) {
      logger.debug('FileStorage: Already initialized, skipping...')
      return
    }
    
    try {
      logger.debug('FileStorage: Initializing...', 'Current state:', this._isInitialized)
      
      // Check for user-selected project folder first
      const userSelectedFolder = localStorage.getItem('defaultProjectFolder')
      if (userSelectedFolder) {
        this._projectsDirectory = userSelectedFolder
        logger.debug('FileStorage: Using user-selected projects directory:', this._projectsDirectory)
      } else {
        // Fall back to default directory
        this._projectsDirectory = await invoke<string>('get_projects_dir')
        logger.debug('FileStorage: Using default projects directory:', this._projectsDirectory)
      }
      
      if (!this._projectsDirectory) {
        throw new Error('Failed to get projects directory from Tauri')
      }
      
      // Load auto-backup settings from localStorage
      const savedBackupInterval = localStorage.getItem('autoBackupInterval')
      if (savedBackupInterval) {
        const interval = parseInt(savedBackupInterval)
        if (!isNaN(interval) && interval >= 30000) { // Minimum 30 seconds
          this.AUTO_BACKUP_INTERVAL_MS = interval
        }
      }
      
      const savedBackupEnabled = localStorage.getItem('autoBackupEnabled')
      if (savedBackupEnabled !== null) {
        this.autoBackupEnabled = savedBackupEnabled === 'true'
      }
      
      this._isInitialized = true
      logger.debug('FileStorage: Initialized successfully, isInitialized:', this._isInitialized)
    } catch (error) {
      this._isInitialized = false
      logger.error('FileStorage: Failed to initialize:', error)
      throw error
    }
  }
  
  // Project Management
  async createProject(name: string, defaultFolder?: string): Promise<ProjectMetadata> {
    logger.debug('FileStorage.createProject called with name:', name)
    logger.debug('FileStorage.isInitialized:', this.isInitialized)
    logger.debug('FileStorage.projectsDirectory:', this._projectsDirectory)
    
    if (!this._isInitialized || !this._projectsDirectory) {
      logger.error('FileStorage state:', {
        isInitialized: this._isInitialized,
        projectsDirectory: this._projectsDirectory,
        thisObject: this
      })
      throw new Error('Storage not initialized')
    }
    
    // Show save dialog immediately
    const baseFolder = defaultFolder || this._projectsDirectory
    const suggestedPath = await join(baseFolder, `${name}.scormproj`)
    const filePath = await dialog.save({
      filters: [{
        name: 'SCORM Project',
        extensions: ['scormproj']
      }],
      defaultPath: suggestedPath,
      title: 'Save New Project'
    })
    
    // User cancelled
    if (!filePath) {
      throw new Error('Project creation cancelled')
    }
    
    // Extract the actual filename from the chosen path
    const pathParts = filePath.split(/[\\\/]/)
    const filename = pathParts[pathParts.length - 1]
    // Trim whitespace from the project name
    const projectName = filename.replace('.scormproj', '').trim()
    
    // Validate the extracted project name
    if (!projectName) {
      throw new Error('Project name cannot be empty')
    }
    
    // Create a sanitized folder name based on the project name
    const sanitizedName = projectName
      .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .toLowerCase()
      .substring(0, 50) // Limit length
    
    // Add timestamp to ensure uniqueness
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    let projectId = `${sanitizedName}-project-files-${timestamp}`
    
    // Check if folder already exists and add a counter if needed
    let counter = 1
    let testPath = await join(this._projectsDirectory, projectId)
    while (await exists(testPath)) {
      projectId = `${sanitizedName}-project-files-${timestamp}-${counter}`
      testPath = await join(this._projectsDirectory, projectId)
      counter++
    }
    
    const project: ProjectMetadata = {
      id: projectId,
      name: projectName,
      created: new Date().toISOString(),
      last_modified: new Date().toISOString()
    }
    logger.debug('Created project metadata:', project)
    
    this.currentProject = {
      project,
      course_data: {
        title: projectName,
        difficulty: 3,
        template: 'standard',
        topics: [],
        custom_topics: null
      },
      ai_prompt: null,
      course_content: null,
      media: {
        images: [],
        videos: [],
        audio: []
      },
      audio_settings: {
        voice: 'en-US-JennyNeural',
        speed: 1.0,
        pitch: 1.0
      },
      scorm_config: {
        version: '2004',
        completion_criteria: 'all_pages',
        passing_score: 80
      }
    }
    
    this.currentProjectId = project.id
    this.currentFilePath = filePath
    logger.debug('Project file path:', this.currentFilePath)
    
    // Initialize the current project data structure
    this.currentProject = {
      project: project,
      course_data: {
        title: project.name,
        difficulty: 1,
        template: 'standard',
        topics: [],
        custom_topics: null
      },
      ai_prompt: null,
      course_content: null,
      media: {
        images: [],
        videos: [],
        audio: []
      },
      audio_settings: {
        voice: 'en-US-JennyNeural',
        speed: 1.0,
        pitch: 1.0
      },
      scorm_config: {
        version: '2004',
        completion_criteria: 'all_pages',
        passing_score: 80
      }
    }
    
    // Save to the chosen location
    logger.debug('Saving new project...')
    try {
      await this.saveProject()
      logger.debug('Project saved successfully')
    } catch (error) {
      logger.error('Failed to save new project:', error)
      throw error
    }
    
    // Track this file in recent files
    await this.trackRecentFile(filePath, project)
    
    // Initialize MediaStore for the new project
    if (project.id) {
      logger.debug('[createProject] Initializing MediaStore for new project')
      await mediaStore.loadProject(project.id)
    }
    
    // Start auto-backup
    this.startAutoBackup()
    
    // Update window title
    await updateWindowTitle(project.name, false)
    
    // Notify listeners
    this.notifyStateChange()
    
    logger.debug('[createProject] Project creation complete')
    logger.debug('[createProject] Project ID:', project.id)
    logger.debug('[createProject] File path:', this.currentFilePath)
    return project
  }
  
  async openProject(projectId: string, onProgress?: (progress: { phase: string; percent: number; message: string; itemsLoaded?: number; totalItems?: number }) => void): Promise<void> {
    // First check if we have the actual file path from recent files
    let filePath: string
    
    // Report initial progress
    onProgress?.({ phase: 'loading', percent: 10, message: 'Locating project file...' })
    
    // Check recent files first to get the actual file path
    const recentFiles = await this.getRecentFiles()
    const recentFile = recentFiles.find(f => f.id === projectId)
    if (recentFile && (recentFile as any).path) {
      filePath = (recentFile as any).path
    } else {
      // Fall back to default location if not in recent files
      filePath = await join(this._projectsDirectory, `${projectId}.scormproj`)
    }
    
    this.currentFilePath = filePath
    
    try {
      // Load project file
      onProgress?.({ phase: 'loading', percent: 25, message: 'Reading project file...' })
      const projectData = await invoke<ProjectFile>('load_project', { filePath })
      
      // Don't convert - keep snake_case internally
      this.currentProject = projectData
      this.currentProjectId = projectData.project.id
      
      // Initialize captions array if it doesn't exist (for backward compatibility)
      if (this.currentProject.media && !this.currentProject.media.captions) {
        this.currentProject.media.captions = []
      }
      
      // Load captions from disk if the array is empty but caption files exist
      onProgress?.({ phase: 'content', percent: 40, message: 'Loading captions...' })
      await this.loadCaptionsFromDisk()
      
      // Count total media items
      const totalMediaItems = (this.currentProject.media.images?.length || 0) + 
                            (this.currentProject.media.audio?.length || 0) + 
                            (this.currentProject.media.videos?.length || 0) +
                            (this.currentProject.media.captions?.length || 0)
      
      // Load media into MediaStore
      if (this.currentProjectId) {
        logger.debug('[openProject] Loading project media into MediaStore')
        onProgress?.({ 
          phase: 'media', 
          percent: 50, 
          message: 'Loading media files...', 
          itemsLoaded: 0, 
          totalItems: totalMediaItems 
        })
        
        // Create a progress wrapper for MediaStore
        const originalLoadProject = mediaStore.loadProject.bind(mediaStore)
        let mediaLoaded = 0
        
        // Temporarily override console.log to track progress
        const originalLog = console.log
        console.log = (...args) => {
          originalLog(...args)
          if (args[0]?.includes('[MediaStore] Cached media:')) {
            mediaLoaded++
            onProgress?.({ 
              phase: 'media', 
              percent: 50 + (mediaLoaded / totalMediaItems) * 40, 
              message: `Loading media file ${mediaLoaded} of ${totalMediaItems}...`, 
              itemsLoaded: mediaLoaded, 
              totalItems: totalMediaItems 
            })
          }
        }
        
        await originalLoadProject(this.currentProjectId)
        
        // Restore original console.log
        console.log = originalLog
      }
      
      // Finalize
      onProgress?.({ phase: 'finalizing', percent: 90, message: 'Finalizing project...' })
      
      // Update last accessed time
      if (this.currentProject && this.currentProject.project) {
        this.currentProject.project.last_modified = new Date().toISOString()
      }
      
      // Only save if we're actually opening an existing project
      // Skip save if this is being called right after createProject
      const isJustCreated = this.currentFilePath === filePath && 
        this.currentProject?.project?.created === this.currentProject?.project?.last_modified
      if (!isJustCreated) {
        logger.debug('[openProject] Saving project after updating last_modified')
        await this.saveProject()
      } else {
        logger.debug('[openProject] Skipping save - project was just created')
      }
      
      // Track recently opened file (updates the path if it changed)
      await this.trackRecentFile(filePath, projectData.project)
      
      // Start auto-backup
      this.startAutoBackup()
      
      // Update window title
      if (this.currentProject?.project?.name) {
        await updateWindowTitle(this.currentProject.project.name, false)
      }
      
      // Complete
      onProgress?.({ phase: 'finalizing', percent: 100, message: 'Project loaded successfully!' })
    } catch (error) {
      throw new Error(`Failed to open project: ${error}`)
    }
  }
  
  async openProjectFromFile(): Promise<void> {
    const selected = await dialog.open({
      multiple: false,
      filters: [{
        name: 'SCORM Project',
        extensions: ['scormproj']
      }]
    })
    
    if (!selected) return
    
    await this.openProjectFromPath(selected)
  }
  
  async openProjectFromPath(filePath: string, options?: { skipUnsavedCheck?: boolean; onProgress?: (progress: { phase: string; percent: number; message: string; itemsLoaded?: number; totalItems?: number }) => void }): Promise<void> {
    // Check for unsaved changes unless explicitly skipped
    if (!options?.skipUnsavedCheck && this.hasUnsavedChanges()) {
      throw new Error('UNSAVED_CHANGES')
    }
    
    this.currentFilePath = filePath
    const onProgress = options?.onProgress
    
    try {
      // Load project file
      onProgress?.({ phase: 'loading', percent: 25, message: 'Reading project file...' })
      const projectData = await invoke<ProjectFile>('load_project', { filePath })
      
      // Validate project data
      this.validateProjectData(projectData)
      
      // Don't convert - keep snake_case internally
      this.currentProject = projectData
      this.currentProjectId = projectData.project.id
      
      // Initialize captions array if it doesn't exist (for backward compatibility)
      if (this.currentProject.media && !this.currentProject.media.captions) {
        this.currentProject.media.captions = []
      }
      
      // Load captions from disk if the array is empty but caption files exist
      onProgress?.({ phase: 'content', percent: 40, message: 'Loading captions...' })
      await this.loadCaptionsFromDisk()
      
      // Count total media items
      const totalMediaItems = (this.currentProject.media.images?.length || 0) + 
                            (this.currentProject.media.audio?.length || 0) + 
                            (this.currentProject.media.videos?.length || 0) +
                            (this.currentProject.media.captions?.length || 0)
      
      // Load media into MediaStore
      if (this.currentProjectId && totalMediaItems > 0) {
        onProgress?.({ 
          phase: 'media', 
          percent: 50, 
          message: 'Loading media files...', 
          itemsLoaded: 0, 
          totalItems: totalMediaItems 
        })
        
        // Load media with progress callback
        await mediaStore.loadProject(this.currentProjectId, (loaded, total) => {
          onProgress?.({ 
            phase: 'media', 
            percent: 50 + (loaded / total) * 40, 
            message: `Loading media file ${loaded} of ${total}...`, 
            itemsLoaded: loaded, 
            totalItems: total 
          })
        })
      } else if (this.currentProjectId) {
        // Still need to initialize MediaStore even if no media
        await mediaStore.loadProject(this.currentProjectId)
      }
      
      // Finalize
      onProgress?.({ phase: 'finalizing', percent: 90, message: 'Finalizing project...' })
      
      // Update last accessed time
      if (this.currentProject && this.currentProject.project) {
        this.currentProject.project.last_modified = new Date().toISOString()
      }
      await this.saveProject()
      
      // Track recently opened file
      await this.trackRecentFile(filePath, projectData.project)
      
      // Start auto-backup
      this.startAutoBackup()
      
      // Update window title
      if (this.currentProject?.project?.name) {
        await updateWindowTitle(this.currentProject.project.name, false)
      }
      
      // Complete
      onProgress?.({ phase: 'finalizing', percent: 100, message: 'Project loaded successfully!' })
    } catch (error: any) {
      // Only reset state on critical errors
      const shouldResetState = 
        error.message?.includes('Invalid project file') ||
        error.message?.includes('No such file') ||
        error.message?.includes('Permission denied') ||
        error.message?.includes('not found')
      
      if (shouldResetState) {
        this.currentFilePath = null
      }
      
      if (error.message === 'UNSAVED_CHANGES') {
        throw error
      } else if (error.message?.includes('Invalid project file')) {
        throw new Error(`Invalid project file format: ${error.message}`)
      } else if (error.message?.includes('No such file')) {
        throw new Error('Project file not found')
      } else if (error.message?.includes('Permission denied')) {
        throw new Error('Permission denied: Cannot access project file')
      } else {
        throw new Error(`Failed to load project file: ${error.message || error}`)
      }
    }
  }
  
  async saveProject(): Promise<void> {
    logger.debug('[FileStorage.saveProject] Called')
    logger.debug('[FileStorage.saveProject] Current project ID:', this.currentProjectId)
    logger.debug('[FileStorage.saveProject] Current file path:', this.currentFilePath)
    logger.debug('[FileStorage.saveProject] Stack trace:', new Error().stack)
    
    if (!this.currentProject) {
      throw new Error('No project currently open - project data is missing')
    }
    
    if (!this.currentFilePath) {
      logger.error('[FileStorage.saveProject] currentFilePath is null but project exists:', {
        projectId: this.currentProjectId,
        projectName: this.currentProject?.project?.name
      })
      throw new Error('No project file path set - cannot save project')
    }
    
    try {
      logger.debug('Calling Tauri invoke save_project...')
      
      // Use structured cloning when available (modern browsers)
      let cleanProject: any
      if (typeof structuredClone === 'function') {
        try {
          // First try structured clone which handles circular references automatically
          cleanProject = structuredClone(this.currentProject)
          logger.debug('[saveProject] Successfully used structuredClone')
        } catch (e) {
          logger.debug('[saveProject] structuredClone failed, falling back to manual clone:', e)
          cleanProject = null
        }
      }
      
      // Fallback to manual deep clone
      const createCleanCopy = (obj: any, visited = new Map(), path: string[] = []): any => {
        if (obj === null || typeof obj !== 'object') return obj
        
        // Check if we've already cloned this object
        if (visited.has(obj)) {
          // Return the already cloned version to maintain references
          return visited.get(obj)
        }
        
        // Special handling for known types
        if (obj instanceof Date) return new Date(obj.getTime())
        if (obj === window || obj instanceof Window || obj instanceof Element || obj instanceof Event) return undefined
        if (obj.nativeEvent && obj.preventDefault) return undefined // React SyntheticEvent
        
        // Handle arrays
        if (obj instanceof Array) {
          const clonedArray: any[] = []
          visited.set(obj, clonedArray) // Store reference before recursing
          obj.forEach((item, index) => {
            clonedArray[index] = createCleanCopy(item, visited, [...path, `[${index}]`])
          })
          return clonedArray
        }
        
        // Handle objects
        const clonedObj: any = {}
        visited.set(obj, clonedObj) // Store reference before recursing
        
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            const cleanValue = createCleanCopy(obj[key], visited, [...path, key])
            if (cleanValue !== undefined) {
              clonedObj[key] = cleanValue
            }
          }
        }
        return clonedObj
      }
      
      // Create a clean copy if we haven't already
      if (!cleanProject) {
        cleanProject = createCleanCopy(this.currentProject)
      }
      
      // Convert camelCase to snake_case for Rust backend
      const convertToSnakeCase = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj
        if (obj instanceof Array) return obj.map(convertToSnakeCase)
        
        const converted: any = {}
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            // Convert specific known fields
            let snakeKey = key
            if (key === 'base64Data') snakeKey = 'base64_data'
            else if (key === 'youtubeUrl') snakeKey = 'youtube_url'
            else if (key === 'customTopics') snakeKey = 'custom_topics'
            else if (key === 'courseData') snakeKey = 'course_data'
            else if (key === 'aiPrompt') snakeKey = 'ai_prompt'
            else if (key === 'courseContent') snakeKey = 'course_content'
            else if (key === 'audioSettings') snakeKey = 'audio_settings'
            else if (key === 'scormConfig') snakeKey = 'scorm_config'
            else if (key === 'lastModified') snakeKey = 'last_modified'
            else if (key === 'relativePath') snakeKey = 'relative_path'
            
            converted[snakeKey] = convertToSnakeCase(obj[key])
          }
        }
        return converted
      }
      
      const snakeCaseProject = convertToSnakeCase(cleanProject)
      
      logger.debug('[saveProject] Type of cleanProject:', typeof cleanProject)
      logger.debug('[saveProject] cleanProject structure:', JSON.stringify(snakeCaseProject, null, 2).substring(0, 500))
      
      // Use the common save method
      await this.saveProjectToPath(this.currentFilePath)
      logger.debug('Tauri save_project completed successfully')
    } catch (error) {
      logger.error('Tauri save_project failed:', error)
      throw error
    }
  }
  
  async saveProjectAs(): Promise<void> {
    if (!this.currentProject) {
      throw new Error('No project currently open')
    }
    
    const filePath = await dialog.save({
      filters: [{
        name: 'SCORM Project',
        extensions: ['scormproj']
      }],
      defaultPath: `${this.currentProject.project.name}.scormproj`
    })
    
    if (!filePath) return
    
    this.currentFilePath = filePath
    await this.saveProject()
  }
  
  async listProjects(): Promise<ProjectMetadata[]> {
    let filePaths: string[] = []
    try {
      filePaths = await invoke<string[]>('list_projects')
    } catch (error) {
      logger.error('Failed to get project list from backend:', error)
      // Continue with empty list if backend fails
    }
    
    const projects: ProjectMetadata[] = []
    const problematicFiles: string[] = []
    
    // Load metadata from each file
    for (const filePath of filePaths) {
      try {
        const projectData = await invoke<ProjectFile>('load_project', { filePath })
        // Validate project data
        if (projectData && projectData.project && projectData.project.id && projectData.project.name) {
          // Add the file path to the project metadata
          const projectWithPath = { ...projectData.project, path: filePath }
          projects.push(projectWithPath)
        } else {
          logger.warn(`Invalid project data in file: ${filePath}`)
          problematicFiles.push(filePath)
        }
      } catch (error) {
        logger.error(`Failed to load project metadata from ${filePath}:`, error)
        problematicFiles.push(filePath)
      }
    }
    
    // Log problematic files for debugging
    if (problematicFiles.length > 0) {
      logger.warn('Problematic project files found:', problematicFiles)
      // Store in window for manual cleanup if needed
      if (typeof window !== 'undefined') {
        (window as any).__problematicProjectFiles = problematicFiles
      }
    }
    
    // Also load recently opened files from outside projects directory
    const recentFiles = await this.getRecentFiles()
    for (const recentFile of recentFiles) {
      // Skip if already in projects list
      if (!projects.find(p => p.id === recentFile.id)) {
        projects.push(recentFile)
      }
    }
    
    // Sort by last modified date (most recent first)
    projects.sort((a, b) => {
      const dateA = new Date(a.last_modified || a.created).getTime()
      const dateB = new Date(b.last_modified || b.created).getTime()
      return dateB - dateA
    })
    
    return projects
  }
  
  async getRecentProjects(): Promise<ProjectMetadata[]> {
    return this.getRecentFiles()
  }
  
  async deleteProject(projectId: string, filePath?: string): Promise<void> {
    // If no file path provided, try to find it from recent files or default location
    if (!filePath) {
      // Check recent files first
      const recentFiles = await this.getRecentFiles()
      const recentFile = recentFiles.find(f => f.id === projectId)
      if (recentFile && (recentFile as any).path) {
        filePath = (recentFile as any).path
      } else {
        // Fall back to default location
        filePath = await join(this._projectsDirectory, `${projectId}.scormproj`)
      }
    }
    
    try {
      await invoke('delete_project', { filePath })
    } catch (error: any) {
      if (error.message?.includes('not found')) {
        throw new Error(`Project file not found: ${filePath}`)
      }
      throw error
    }
    
    if (this.currentProjectId === projectId) {
      this.currentProject = null
      this.currentProjectId = null
      this.currentFilePath = null
    }
  }
  
  // Data Access Methods
  async saveCourseMetadata(metadata: Record<string, any>): Promise<void> {
    if (!this.currentProject) throw new Error('No project open')
    
    // Note: We store in snake_case internally
    this.currentProject.course_data = {
      title: metadata.courseTitle || this.currentProject.course_data.title,
      difficulty: metadata.difficulty || this.currentProject.course_data.difficulty,
      template: metadata.template || this.currentProject.course_data.template,
      topics: metadata.topics || this.currentProject.course_data.topics, // Always use topics which contains numeric IDs
      custom_topics: Array.isArray(metadata.customTopics) ? metadata.customTopics.join('\n') : (metadata.customTopics || this.currentProject.course_data.custom_topics)
    }
    
    this.scheduleAutoSave()
  }
  
  async getCourseMetadata(): Promise<Record<string, any> | null> {
    if (!this.currentProject) return null
    
    return {
      courseTitle: this.currentProject.course_data.title,
      difficulty: this.currentProject.course_data.difficulty,
      topics: this.currentProject.course_data.topics
    }
  }
  
  async saveContent(id: string, content: ContentItem): Promise<void> {
    if (!this.currentProject) throw new Error('No project open')
    
    if (!this.currentProject.course_content) {
      this.currentProject.course_content = {}
    }
    
    // Sanitize content before saving to prevent XSS
    this.currentProject.course_content[id] = sanitizeContentItem(content)
    this.scheduleAutoSave()
  }
  
  async getContent(id: string): Promise<ContentItem | null> {
    if (!this.currentProject || !this.currentProject.course_content) return null
    return this.currentProject.course_content[id] || null
  }
  
  // Media Storage
  async storeMedia(id: string, blob: Blob, mediaType: 'image' | 'video' | 'audio' | 'caption', metadata?: Record<string, any>): Promise<void> {
    if (!this.currentProject) throw new Error('No project open')
    
    logger.debug(`[FileStorage.storeMedia] Storing ${mediaType} with id: ${id}`)
    
    // Check file size limit (10 MB)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB in bytes
    if (blob.size > MAX_FILE_SIZE) {
      throw new Error(`File size (${(blob.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed size of 10 MB`)
    }
    
    // Convert metadata to MediaMetadata format
    const mediaMetadata: MediaMetadata = {
      page_id: metadata?.pageId || 'unknown',
      type: mediaType as 'image' | 'video' | 'audio',
      original_name: metadata?.originalName || `${id}.${this.getExtensionFromMimeType(blob.type)}`,
      mime_type: blob.type,
      source: metadata?.source,
      embed_url: metadata?.embedUrl,
      title: metadata?.title
    }
    
    // Use the new MediaStore for centralized storage
    await mediaStore.storeMedia(id, blob, mediaMetadata)
    
    // For backward compatibility, also update the old project structure
    const extension = this.getExtensionFromMimeType(blob.type)
    const filename = `${id}.${extension}`
    const subdir = mediaType === 'caption' ? 'captions' : mediaType === 'audio' ? 'audio' : `${mediaType}s`
    const relativePath = `media/${subdir}/${filename}`
    
    // Store reference in project file for backward compatibility
    const mediaItem: MediaItem = {
      id,
      filename,
      relativePath,
      type: mediaType === 'video' ? undefined : mediaType,
      metadata
    } as any
    
    if (mediaType === 'image') {
      this.currentProject.media.images.push(mediaItem)
      logger.debug(`[FileStorage.storeMedia] Added image. Total images: ${this.currentProject.media.images.length}`)
    } else if (mediaType === 'audio') {
      this.currentProject.media.audio.push(mediaItem)
      logger.debug(`[FileStorage.storeMedia] Added audio. Total audio: ${this.currentProject.media.audio.length}`)
    } else if (mediaType === 'caption') {
      // Store captions in the same way as audio (they're both text-based media)
      if (!this.currentProject.media.captions) {
        this.currentProject.media.captions = []
      }
      this.currentProject.media.captions.push(mediaItem)
      logger.debug(`[FileStorage.storeMedia] Added caption. Total captions: ${this.currentProject.media.captions.length}`)
    }
    
    this.scheduleAutoSave()
  }
  
  async storeYouTubeVideo(id: string, youtubeUrl: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.currentProject) throw new Error('No project open')
    
    const videoItem: VideoItem = {
      id,
      youtubeUrl,
      metadata
    }
    
    this.currentProject.media.videos.push(videoItem)
    this.scheduleAutoSave()
  }
  
  async getMedia(id: string): Promise<any> {
    if (!this.currentProject) return null
    
    // First try to get from MediaStore (new system)
    const mediaUrl = mediaStore.getMediaUrl(id)
    if (mediaUrl) {
      const media = mediaStore.getMedia(id)
      if (media) {
        // Convert to blob for backward compatibility
        try {
          const response = await fetch(mediaUrl)
          const blob = await response.blob()
          return {
            id,
            blob,
            mediaType: media.metadata.type,
            url: mediaUrl,
            metadata: media.metadata
          }
        } catch (error) {
          logger.error(`[FileStorage.getMedia] Failed to fetch media from URL: ${error}`)
        }
      }
    }
    
    // Fall back to old system for backward compatibility
    // Check images
    const image = this.currentProject.media.images.find(item => item.id === id)
    if (image) {
      // Convert to return format expected by UI
      let blob: Blob | undefined
      
      // Load from disk - use flat storage structure
      const flatPath = `media/${id}.bin`
      try {
        const base64Content = await invoke<string>('read_file', {
          projectId: this.currentProjectId,
          relativePath: flatPath
        })
        blob = await this.base64ToBlob(base64Content)
      } catch (error) {
        logger.error(`[FileStorage.getMedia] Failed to read file ${flatPath}: ${error}`)
        return { ...image, error: 'File not found', mediaType: 'image' }
      }
      
      const result = {
        ...image,
        blob,
        mediaType: 'image'
      }
      logger.debug(`[FileStorage.getMedia] Found image ${id}, has blob: ${!!result.blob}`)
      return result
    }
    
    // Check videos
    const video = this.currentProject.media.videos.find(item => item.id === id)
    if (video) {
      logger.debug(`[FileStorage.getMedia] Found video ${id}`)
      return {
        ...video,
        mediaType: 'video'
      }
    }
    
    // Check audio
    const audio = this.currentProject.media.audio.find(item => item.id === id)
    if (audio) {
      // Convert to return format expected by UI
      let blob: Blob | undefined
      
      // Load from disk - use flat storage structure
      const flatPath = `media/${id}.bin`
      try {
        const base64Content = await invoke<string>('read_file', {
          projectId: this.currentProjectId,
          relativePath: flatPath
        })
        blob = await this.base64ToBlob(base64Content)
      } catch (error) {
        logger.error(`[FileStorage.getMedia] Failed to read file ${flatPath}: ${error}`)
        return { ...audio, error: 'File not found', mediaType: 'audio' }
      }
      
      const result = {
        ...audio,
        blob,
        mediaType: 'audio'
      }
      logger.debug(`[FileStorage.getMedia] Found audio ${id}, has blob: ${!!result.blob}`)
      return result
    }
    
    // Check captions
    if (this.currentProject.media.captions) {
      const caption = this.currentProject.media.captions.find(item => item.id === id)
      if (caption) {
        // Convert to return format expected by UI
        let blob: Blob | undefined
        
        // Load from disk - use flat storage structure
        const flatPath = `media/${id}.bin`
        try {
          const base64Content = await invoke<string>('read_file', {
            projectId: this.currentProjectId,
            relativePath: flatPath
          })
          blob = await this.base64ToBlob(base64Content)
        } catch (error) {
          logger.error(`[FileStorage.getMedia] Failed to read file ${flatPath}: ${error}`)
          return { ...caption, error: 'File not found', mediaType: 'caption' }
        }
        
        const result = {
          ...caption,
          blob,
          mediaType: 'caption'
        }
        logger.debug(`[FileStorage.getMedia] Found caption ${id}, has blob: ${!!result.blob}`)
        return result
      }
    }
    
    logger.debug(`[FileStorage.getMedia] No media found for id: ${id}`)
    return null
  }
  
  async loadCaptionsFromDisk(): Promise<void> {
    if (!this.currentProject) return
    
    try {
      // Initialize captions array if needed
      if (!this.currentProject.media.captions) {
        this.currentProject.media.captions = []
      }
      
      // If captions are already loaded, skip
      if (this.currentProject.media.captions.length > 0) {
        logger.debug('[FileStorage.loadCaptionsFromDisk] Captions already loaded')
        return
      }
      
      // Check for caption files based on audio files pattern
      // Audio files follow the pattern audio-XXXX, so captions should be caption-XXXX
      const audioFiles = this.currentProject.media.audio
      logger.debug(`[FileStorage.loadCaptionsFromDisk] Checking for captions based on ${audioFiles.length} audio files`)
      
      for (const audio of audioFiles) {
        // Extract block number from audio ID (e.g., audio-0001 -> 0001)
        const blockMatch = audio.id.match(/audio-(\d+)/)
        if (blockMatch) {
          const blockNumber = blockMatch[1]
          const captionId = `caption-${blockNumber}`
          
          // Check if this caption is already loaded
          if (this.currentProject.media.captions.some(c => c.id === captionId)) {
            continue
          }
          
          // Add caption metadata to the array
          // The actual file will be loaded when needed via getMedia
          const captionItem: MediaItem = {
            id: captionId,
            filename: `${captionId}.bin`,
            relativePath: `media/${captionId}.bin`,
            type: 'caption',
            metadata: {
              blockNumber: blockNumber,
              // Copy topic metadata from corresponding audio
              topicId: audio.metadata?.topicId
            }
          }
          
          this.currentProject.media.captions.push(captionItem)
          logger.debug(`[FileStorage.loadCaptionsFromDisk] Added caption: ${captionId} for topic: ${audio.metadata?.topicId}`)
        }
      }
      
      logger.debug(`[FileStorage.loadCaptionsFromDisk] Total captions loaded: ${this.currentProject.media.captions.length}`)
    } catch (error) {
      logger.error('[FileStorage.loadCaptionsFromDisk] Failed to load captions:', error)
      // Continue without captions if loading fails
    }
  }
  
  async getMediaForTopic(topicId: string): Promise<any[]> {
    if (!this.currentProject) return []
    
    const allMedia: (MediaItem | VideoItem)[] = [
      ...this.currentProject.media.images,
      ...this.currentProject.media.videos,
      ...this.currentProject.media.audio,
      ...(this.currentProject.media.captions || [])
    ]
    
    console.log(`[FileStorage.getMediaForTopic] Looking for media for topic: ${topicId}`)
    console.log(`[FileStorage.getMediaForTopic] Total images: ${this.currentProject.media.images.length}`)
    console.log(`[FileStorage.getMediaForTopic] Total videos: ${this.currentProject.media.videos.length}`)
    console.log(`[FileStorage.getMediaForTopic] Total audio: ${this.currentProject.media.audio.length}`)
    console.log(`[FileStorage.getMediaForTopic] Total captions: ${this.currentProject.media.captions?.length || 0}`)
    console.log(`[FileStorage.getMediaForTopic] First 3 media items:`, allMedia.slice(0, 3).map(item => ({ id: item.id, type: (item as any).mediaType || 'unknown' })))
    
    // Log sample audio item structure for debugging
    if (this.currentProject.media.audio.length > 0) {
      console.log('[FileStorage.getMediaForTopic] Sample audio item structure:', JSON.stringify(this.currentProject.media.audio[0], null, 2))
    }
    
    // Reduce logging to prevent memory issues
    // logger.debug(`[FileStorage.getMediaForTopic] Looking for media for topic: ${topicId}`)
    // logger.debug(`[FileStorage.getMediaForTopic] Total media items: ${allMedia.length}`)
    
    // Log first few media IDs for debugging
    if (allMedia.length > 0) {
      logger.debug(`[FileStorage.getMediaForTopic] Sample media IDs: ${allMedia.slice(0, 3).map(m => m.id).join(', ')}`)
    }
    
    // Extract numeric index from topic ID if it's in topic-N format
    let topicIndex = -1
    if (topicId.startsWith('topic-')) {
      topicIndex = parseInt(topicId.replace('topic-', ''))
    }
    
    // Convert base64Data to blob for items that have it
    const filteredMedia = allMedia.filter(item => {
      // Check if item ID starts with topic ID
      if (item.id.startsWith(topicId)) {
        console.log(`[FileStorage.getMediaForTopic] Found by ID prefix: ${item.id}`)
        return true
      }
      
      // For numeric audio/caption/image files, check by index
      if (topicIndex >= 0) {
        if (item.id.startsWith('audio-') || item.id.startsWith('caption-')) {
          const expectedAudioId = generateMediaId('audio', getPageIndex('topic', topicIndex))
          const expectedCaptionId = generateMediaId('caption', getPageIndex('topic', topicIndex))
          
          if (item.id === expectedAudioId || item.id === expectedCaptionId) {
            console.log(`[FileStorage.getMediaForTopic] Found by numeric ID: ${item.id} for topic index ${topicIndex}`)
            return true
          }
        }
        
        // Check for numeric image IDs like image-3, image-4, etc. (topics start at index 2)
        if (item.id.startsWith('image-')) {
          const imageIndex = parseInt(item.id.replace('image-', ''))
          const expectedImageIndex = getPageIndex('topic', topicIndex)
          if (imageIndex === expectedImageIndex) {
            console.log(`[FileStorage.getMediaForTopic] Found image by numeric ID: ${item.id} for topic index ${topicIndex}`)
            return true
          }
        }
      }
      
      // For media with metadata, check both topicId and topicIndex
      if ('metadata' in item && item.metadata) {
        // Check numeric index first (most reliable)
        if (topicIndex >= 0 && item.metadata.topicIndex === topicIndex) {
          console.log(`[FileStorage.getMediaForTopic] Found by topic index in metadata: ${item.id} for topic index ${topicIndex}`)
          return true
        }
        
        // Check topic ID match
        if (item.metadata.topicId === topicId) {
          console.log(`[FileStorage.getMediaForTopic] Found by topic ID in metadata: ${item.id} for topic ${topicId}`)
          return true
        }
      }
      
      return false
    })
    
    console.log(`[FileStorage.getMediaForTopic] Filtered media count: ${filteredMedia.length}`)
    
    // logger.debug(`[FileStorage.getMediaForTopic] Filtered media items: ${filteredMedia.length}`)
    
    const convertedMedia = await Promise.all(
      filteredMedia.map(async (item) => {
        // Determine media type based on which array it came from or from the type field
        let mediaType: string = 'image';
        if ('type' in item && item.type) {
          mediaType = item.type;
        } else if ('youtubeUrl' in item) {
          mediaType = 'video';
        } else if (this.currentProject!.media.videos.some(v => v.id === item.id)) {
          mediaType = 'video';
        } else if (this.currentProject!.media.audio.some(a => a.id === item.id)) {
          mediaType = 'audio';
        } else if (this.currentProject!.media.captions?.some(c => c.id === item.id)) {
          mediaType = 'caption';
        }
        
        // Handle both file-based and embedded media
        let blob: Blob | undefined
        let relativePath = (item as any).relativePath
        
        // For file-based storage, always use flat structure with .bin extension
        // This overrides any legacy paths that might be in the project file
        relativePath = `media/${item.id}.bin`
        console.log(`[FileStorage.getMediaForTopic] Using flat storage path for ${item.id}: ${relativePath}`)
        
        if (relativePath) {
          // Load from disk
          try {
            console.log(`[FileStorage.getMediaForTopic] Loading blob from relativePath: ${relativePath} for item ${item.id}`)
            console.log(`[FileStorage.getMediaForTopic] Using projectId: ${this.currentProjectId}`)
            const base64Content = await invoke<string>('read_file', {
              projectId: this.currentProjectId,
              relativePath: relativePath
            })
            blob = await this.base64ToBlob(base64Content)
            console.log(`[FileStorage.getMediaForTopic] Successfully loaded blob for ${item.id}, size: ${blob?.size}`)
          } catch (error) {
            logger.error(`[FileStorage.getMediaForTopic] Failed to read file ${relativePath}: ${error}`)
            console.error(`[FileStorage.getMediaForTopic] Failed to read file ${relativePath}: ${error}`)
            console.error(`[FileStorage.getMediaForTopic] Full path would be: Documents/SCORM Projects/${this.currentProjectId}/${relativePath}`)
          }
        } else {
          // Fall back to embedded base64 data for legacy projects
          const base64Data = (item as any).base64Data || (item as any).base64_data;
          if (base64Data) {
            console.log(`[FileStorage.getMediaForTopic] Loading blob from base64Data for item ${item.id}`)
            blob = await this.base64ToBlob(base64Data)
          } else {
            console.log(`[FileStorage.getMediaForTopic] No relativePath or base64Data for item ${item.id}, keys:`, Object.keys(item))
          }
        }
        
        return {
          ...item,
          blob,
          mediaType
        }
      })
    )
    
    return convertedMedia
  }
  
  // AI Prompt
  async saveAiPrompt(prompt: string): Promise<void> {
    if (!this.currentProject) throw new Error('No project open')
    
    this.currentProject.ai_prompt = {
      prompt,
      generated_at: new Date().toISOString()
    }
    
    this.scheduleAutoSave()
  }
  
  async getAiPrompt(): Promise<string | null> {
    if (!this.currentProject || !this.currentProject.ai_prompt) return null
    return this.currentProject.ai_prompt.prompt
  }
  
  // Audio Settings
  async saveAudioSettings(settings: Partial<AudioSettings>): Promise<void> {
    if (!this.currentProject) throw new Error('No project open')
    
    this.currentProject.audio_settings = {
      ...this.currentProject.audio_settings,
      ...settings
    }
    
    this.scheduleAutoSave()
  }
  
  async getAudioSettings(): Promise<AudioSettings | null> {
    if (!this.currentProject) return null
    return this.currentProject.audio_settings
  }
  
  // SCORM Config
  async saveScormConfig(config: Partial<ScormConfig>): Promise<void> {
    if (!this.currentProject) throw new Error('No project open')
    
    this.currentProject.scorm_config = {
      ...this.currentProject.scorm_config,
      ...config
    }
    
    this.scheduleAutoSave()
  }
  
  async getScormConfig(): Promise<ScormConfig | null> {
    if (!this.currentProject) return null
    return this.currentProject.scorm_config
  }
  
  // Utility Methods
  getCurrentProjectId(): string | null {
    return this.currentProjectId
  }
  
  getCurrentProjectData(): ProjectFile | null {
    // Return converted data for UI consumption
    if (!this.currentProject) return null
    return this.convertProjectFromSnakeCase(this.currentProject)
  }
  
  clearCurrentProject(): void {
    this.currentProject = null
    this.currentProjectId = null
    this.currentFilePath = null
    
    // Clear timers
    this.stopAutoBackup()
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
      this.saveDebounceTimer = null
    }
    
    // Clear window title
    updateWindowTitle(undefined, false)
    
    // Notify listeners
    this.notifyStateChange()
  }
  
  // State change listener management
  addStateChangeListener(listener: (state: { projectId: string | null, hasUnsavedChanges: boolean }) => void): () => void {
    this.stateChangeListeners.add(listener)
    return () => {
      this.stateChangeListeners.delete(listener)
    }
  }
  
  private convertProjectFromSnakeCase(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj
    if (obj instanceof Array) return obj.map(item => this.convertProjectFromSnakeCase(item))
    
    const converted: any = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        // Convert specific known fields
        let camelKey = key
        if (key === 'base64_data') camelKey = 'base64Data'
        else if (key === 'youtube_url') camelKey = 'youtubeUrl'
        else if (key === 'custom_topics') camelKey = 'customTopics'
        else if (key === 'course_data') camelKey = 'courseData'
        else if (key === 'ai_prompt') camelKey = 'aiPrompt'
        else if (key === 'course_content') camelKey = 'courseContent'
        else if (key === 'audio_settings') camelKey = 'audioSettings'
        else if (key === 'scorm_config') camelKey = 'scormConfig'
        else if (key === 'last_modified') camelKey = 'lastModified'
        
        converted[camelKey] = this.convertProjectFromSnakeCase(obj[key])
      }
    }
    return converted
  }

  private notifyStateChange(): void {
    const state = {
      projectId: this.currentProjectId,
      hasUnsavedChanges: this.hasUnsavedChanges()
    }
    this.stateChangeListeners.forEach(listener => listener(state))
  }
  
  
  // Migration from localStorage
  async migrateFromLocalStorage(): Promise<ProjectMetadata[]> {
    const migratedProjects: ProjectMetadata[] = []
    const projectPrefix = 'scorm_project_'
    const contentPrefix = 'scorm_content_'
    const metadataKey = 'scorm_course_metadata'
    const mediaPrefix = 'scorm_media_'
    const aiPromptKey = 'scorm_ai_prompt'
    const audioSettingsKey = 'scorm_audio_settings'
    const scormConfigKey = 'scorm_config'
    
    // Find all projects in localStorage
    const projectIds = new Set<string>()
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(projectPrefix)) {
        const projectId = key.replace(projectPrefix, '')
        projectIds.add(projectId)
      }
    }
    
    // Migrate each project
    for (const projectId of projectIds) {
      try {
        // Load old project data
        const projectKey = `${projectPrefix}${projectId}`
        const projectData = localStorage.getItem(projectKey)
        if (!projectData) continue
        
        let oldProject
        try {
          oldProject = JSON.parse(projectData)
        } catch (e) {
          logger.error(`Failed to parse project data for ${projectId}:`, e)
          continue
        }
        
        // Validate required fields
        if (!oldProject.id) {
          logger.error(`Project missing ID: ${projectKey}`)
          continue
        }
        
        if (!oldProject.name) {
          logger.error(`Project missing name: ${projectKey}`)
          continue
        }
        
        // Create new project structure
        const newProject: ProjectFile = {
          project: {
            id: oldProject.id || projectId,
            name: oldProject.name || 'Migrated Project',
            created: oldProject.created || new Date().toISOString(),
            last_modified: oldProject.lastAccessed || oldProject.created || new Date().toISOString()
          },
          course_data: {
            title: '',
            difficulty: 3,
            template: 'standard',
            topics: [],
            custom_topics: null
          },
          ai_prompt: null,
          course_content: {},
          media: {
            images: [],
            videos: [],
            audio: []
          },
          audio_settings: {
            voice: 'en-US-JennyNeural',
            speed: 1.0,
            pitch: 1.0
          },
          scorm_config: {
            version: '2004',
            completion_criteria: 'all_pages',
            passing_score: 80
          }
        }
        
        // Load metadata
        const metadataData = localStorage.getItem(`${metadataKey}_${projectId}`)
        if (metadataData) {
          try {
            const metadata = JSON.parse(metadataData)
            newProject.course_data.title = metadata.courseTitle || ''
            newProject.course_data.difficulty = metadata.difficulty || 3
            newProject.course_data.topics = metadata.topics || []
            newProject.course_data.custom_topics = metadata.customTopics || null
            if (metadata.template) {
              newProject.course_data.template = metadata.template
            }
          } catch (e) {
            logger.error(`Failed to parse metadata for ${projectId}:`, e)
          }
        }
        
        // Load AI prompt
        const aiPromptData = localStorage.getItem(`${aiPromptKey}_${projectId}`)
        if (aiPromptData) {
          try {
            const aiPrompt = JSON.parse(aiPromptData)
            newProject.ai_prompt = {
              prompt: aiPrompt.prompt || '',
              generated_at: aiPrompt.generatedAt || new Date().toISOString()
            }
          } catch (e) {
            logger.error(`Failed to parse AI prompt for ${projectId}:`, e)
          }
        }
        
        // Load audio settings
        const audioSettingsData = localStorage.getItem(`${audioSettingsKey}_${projectId}`)
        if (audioSettingsData) {
          try {
            const audioSettings = JSON.parse(audioSettingsData)
            newProject.audio_settings = {
              voice: audioSettings.voice || 'en-US-JennyNeural',
              speed: audioSettings.speed || 1.0,
              pitch: audioSettings.pitch || 1.0
            }
          } catch (e) {
            logger.error(`Failed to parse audio settings for ${projectId}:`, e)
          }
        }
        
        // Load SCORM config
        const scormConfigData = localStorage.getItem(`${scormConfigKey}_${projectId}`)
        if (scormConfigData) {
          try {
            const scormConfig = JSON.parse(scormConfigData)
            newProject.scorm_config = {
              version: scormConfig.version || '2004',
              completion_criteria: scormConfig.completionCriteria || 'all_pages',
              passing_score: scormConfig.passingScore || 80
            }
          } catch (e) {
            logger.error(`Failed to parse SCORM config for ${projectId}:`, e)
          }
        }
        
        // Load content
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.includes(projectId) && key.startsWith(contentPrefix)) {
            const contentKey = key.replace(`${contentPrefix}${projectId}_`, '')
            const contentData = localStorage.getItem(key)
            if (contentData) {
              try {
                newProject.course_content[contentKey] = JSON.parse(contentData)
              } catch (e) {
                logger.error(`Failed to parse content ${key}:`, e)
              }
            }
          }
        }
        
        // Load media metadata
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.includes(projectId) && key.startsWith(mediaPrefix)) {
            const mediaData = localStorage.getItem(key)
            if (mediaData) {
              try {
                const media = JSON.parse(mediaData)
                if (media.type === 'image') {
                  newProject.media.images.push({
                    id: media.id,
                    filename: media.filename || `${media.id}.jpg`,
                    base64Data: '', // Would need to load from IndexedDB
                    metadata: media.metadata
                  })
                } else if (media.type === 'video' && media.youtubeUrl) {
                  newProject.media.videos.push({
                    id: media.id,
                    youtubeUrl: media.youtubeUrl,
                    metadata: media.metadata
                  })
                } else if (media.type === 'audio') {
                  newProject.media.audio.push({
                    id: media.id,
                    filename: media.filename || `${media.id}.mp3`,
                    base64Data: '', // Would need to load from IndexedDB
                    metadata: media.metadata
                  })
                }
              } catch (e) {
                logger.error(`Failed to parse media ${key}:`, e)
              }
            }
          }
        }
        
        // Save migrated project
        const filePath = await join(this._projectsDirectory, `${newProject.project.id}.scormproj`)
        await invoke('save_project', {
          projectData: newProject,
          filePath
        })
        
        migratedProjects.push(newProject.project)
        
        // Clean up localStorage - remove all keys related to this project
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.includes(projectId) && key.startsWith('scorm_'))) {
            keysToRemove.push(key)
          }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key))
        
      } catch (error) {
        logger.error(`Failed to migrate project ${projectId}:`, error)
      }
    }
    
    return migratedProjects
  }
  
  // Private helper methods
  private hasUnsavedChanges(): boolean {
    return this.saveDebounceTimer !== null
  }
  
  private validateProjectData(data: ProjectFile): void {
    // Check required fields
    if (!data.project?.id || !data.project?.name) {
      throw new Error('Invalid project file: missing project metadata')
    }
    
    if (!data.course_data) {
      throw new Error('Invalid project file: missing course data')
    }
    
    // Ensure all required fields have defaults
    this.migrateProjectData(data)
  }
  
  private migrateProjectData(data: ProjectFile): void {
    // Ensure all required fields have defaults
    if (!data.media) {
      data.media = {
        images: [],
        videos: [],
        audio: []
      }
    }
    
    if (!data.audio_settings) {
      data.audio_settings = {
        voice: 'en-US-JennyNeural',
        speed: 1.0,
        pitch: 1.0
      }
    }
    
    if (!data.scorm_config) {
      data.scorm_config = {
        version: '2004',
        completion_criteria: 'all_pages',
        passing_score: 80
      }
    }
    
    // Ensure courseData has all required fields
    if (!data.course_data.template) {
      data.course_data.template = 'standard'
    }
    
    if (!data.course_data.topics) {
      data.course_data.topics = []
    }
  }
  
  private scheduleAutoSave(): void {
    // Clear existing timer
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer)
      this.saveDebounceTimer = null
    }
    
    // Show unsaved changes indicator immediately
    if (this.currentProject) {
      updateWindowTitle(this.currentProject.project.name, true)
    }
    
    // Notify state change
    this.notifyStateChange()
    
    // Schedule save
    this.saveDebounceTimer = setTimeout(async () => {
      if (!this.currentProject || !this.currentFilePath) {
        this.saveDebounceTimer = null
        return
      }
      
      try {
        await this.saveProject()
        // Clear unsaved changes indicator after successful save
        if (this.currentProject) {
          await updateWindowTitle(this.currentProject.project.name, false)
        }
      } catch (error) {
        logger.error('Auto-save failed:', error)
        // Import showError dynamically to avoid circular dependency
        const { showError } = await import('../components/ErrorNotification')
        showError('Auto-save failed. Your changes may not be saved.', {
          label: 'Save Now',
          onClick: async () => {
            try {
              await this.saveProject()
            } catch (err) {
              logger.error('Manual save also failed:', err)
            }
          }
        })
      } finally {
        this.saveDebounceTimer = null
        this.notifyStateChange()
      }
    }, this.SAVE_DEBOUNCE_MS)
  }
  
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        resolve(base64.split(',')[1]) // Remove data:type;base64, prefix
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  
  private async base64ToBlob(base64Data: string): Promise<Blob> {
    try {
      // Add data URL prefix if not present
      const base64 = base64Data.includes('data:') ? base64Data : `data:application/octet-stream;base64,${base64Data}`
      const response = await fetch(base64)
      const blob = await response.blob()
      // logger.debug(`[FileStorage.base64ToBlob] Created blob, size: ${blob.size}, type: ${blob.type}`)
      return blob
    } catch (error) {
      logger.error('[FileStorage.base64ToBlob] Error converting base64 to blob:', error)
      throw error
    }
  }
  
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'video/mp4': 'mp4',
      'video/webm': 'webm'
    }
    return mimeToExt[mimeType] || 'bin'
  }
  
  // Auto-backup functionality
  private startAutoBackup(): void {
    if (!this.autoBackupEnabled) {
      logger.debug('Auto-backup is disabled')
      return
    }
    
    this.stopAutoBackup()
    
    this.autoBackupTimer = setInterval(async () => {
      if (this.currentProject && this.currentFilePath) {
        try {
          await this.createBackup()
        } catch (error) {
          logger.error('Auto-backup failed:', error)
        }
      }
    }, this.AUTO_BACKUP_INTERVAL_MS)
  }
  
  private stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer)
      this.autoBackupTimer = null
    }
  }
  
  private async createBackup(): Promise<void> {
    if (!this.currentProject || !this.currentFilePath) return
    
    const backupPath = `${this.currentFilePath}.backup`
    try {
      // Use the same logic as saveProject to prepare the data
      await this.saveProjectToPath(backupPath)
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`)
    }
  }
  
  private async saveProjectToPath(filePath: string): Promise<void> {
    if (!this.currentProject) throw new Error('No project loaded')
    
    // Create clean copy helper function
    const createCleanCopy = (obj: any, visited = new Map(), path: string[] = []): any => {
      if (obj === null || typeof obj !== 'object') return obj
      
      // Check if we've already cloned this object
      if (visited.has(obj)) {
        return visited.get(obj)
      }
      
      // Special handling for known types
      if (obj instanceof Date) return new Date(obj.getTime())
      if (obj === window || obj instanceof Window || obj instanceof Element || obj instanceof Event) return undefined
      if (obj.nativeEvent && obj.preventDefault) return undefined // React SyntheticEvent
      
      // Handle arrays
      if (obj instanceof Array) {
        const clonedArray: any[] = []
        visited.set(obj, clonedArray)
        obj.forEach((item, index) => {
          clonedArray[index] = createCleanCopy(item, visited, [...path, `[${index}]`])
        })
        return clonedArray
      }
      
      // Handle objects
      const clonedObj: any = {}
      visited.set(obj, clonedObj)
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const cleanValue = createCleanCopy(obj[key], visited, [...path, key])
          if (cleanValue !== undefined) {
            clonedObj[key] = cleanValue
          }
        }
      }
      return clonedObj
    }
    
    // Convert to snake_case for Rust backend
    const convertToSnakeCase = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj
      if (obj instanceof Array) return obj.map(convertToSnakeCase)
      
      const converted: any = {}
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          let snakeKey = key
          if (key === 'base64Data') snakeKey = 'base64_data'
          else if (key === 'youtubeUrl') snakeKey = 'youtube_url'
          else if (key === 'customTopics') snakeKey = 'custom_topics'
          else if (key === 'courseData') snakeKey = 'course_data'
          else if (key === 'aiPrompt') snakeKey = 'ai_prompt'
          else if (key === 'courseContent') snakeKey = 'course_content'
          else if (key === 'audioSettings') snakeKey = 'audio_settings'
          else if (key === 'scormConfig') snakeKey = 'scorm_config'
          else if (key === 'lastModified') snakeKey = 'last_modified'
          
          converted[snakeKey] = convertToSnakeCase(obj[key])
        }
      }
      return converted
    }
    
    const cleanProject = createCleanCopy(this.currentProject)
    const snakeCaseProject = convertToSnakeCase(cleanProject)
    
    await invoke('save_project', {
      projectData: snakeCaseProject,
      filePath: filePath
    })
  }
  
  async checkForRecovery(): Promise<{ hasBackup: boolean; backupPath?: string; projectName?: string }> {
    try {
      // Check for orphaned backup files
      const filePaths = await invoke<string[]>('list_projects')
      
      for (const filePath of filePaths) {
        if (filePath.endsWith('.backup')) {
          // Check if the original file exists
          const originalPath = filePath.replace('.backup', '')
          try {
            // Try to load the original
            await invoke<ProjectFile>('load_project', { filePath: originalPath })
            // Original exists, delete the backup
            await invoke('delete_project', { filePath })
          } catch {
            // Original doesn't exist, we have an orphaned backup
            try {
              const backupData = await invoke<ProjectFile>('load_project', { filePath })
              return {
                hasBackup: true,
                backupPath: filePath,
                projectName: backupData.project.name
              }
            } catch {
              // Backup is corrupted, delete it
              await invoke('delete_project', { filePath })
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to check for recovery:', error)
    }
    
    return { hasBackup: false }
  }
  
  async recoverFromBackup(backupPath: string): Promise<void> {
    try {
      const backupData = await invoke<ProjectFile>('load_project', { filePath: backupPath })
      
      // Restore to original path
      const originalPath = backupPath.replace('.backup', '')
      
      // Convert back to snake_case for saving
      const convertToSnakeCase = (obj: any): any => {
        if (!obj || typeof obj !== 'object') return obj
        if (obj instanceof Array) return obj.map(convertToSnakeCase)
        
        const converted: any = {}
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            // Convert specific known fields
            let snakeKey = key
            if (key === 'base64Data') snakeKey = 'base64_data'
            else if (key === 'youtubeUrl') snakeKey = 'youtube_url'
            else if (key === 'customTopics') snakeKey = 'custom_topics'
            else if (key === 'courseData') snakeKey = 'course_data'
            else if (key === 'aiPrompt') snakeKey = 'ai_prompt'
            else if (key === 'courseContent') snakeKey = 'course_content'
            else if (key === 'audioSettings') snakeKey = 'audio_settings'
            else if (key === 'scormConfig') snakeKey = 'scorm_config'
            else if (key === 'lastModified') snakeKey = 'last_modified'
            else if (key === 'relativePath') snakeKey = 'relative_path'
            
            converted[snakeKey] = convertToSnakeCase(obj[key])
          }
        }
        return converted
      }
      
      const snakeCaseBackup = convertToSnakeCase(backupData)
      
      await invoke('save_project', {
        projectData: snakeCaseBackup,
        filePath: originalPath
      })
      
      // Delete backup
      await invoke('delete_project', { filePath: backupPath })
      
      // Open the recovered project
      this.currentFilePath = originalPath
      this.currentProject = backupData
      this.currentProjectId = backupData.project.id
      
      // Start auto-backup
      this.startAutoBackup()
      
      // Update window title
      await updateWindowTitle(this.currentProject.project.name, false)
    } catch (error) {
      throw new Error(`Failed to recover from backup: ${error}`)
    }
  }
  
  // Export/Import for sharing
  async exportProject(): Promise<Blob> {
    if (!this.currentProject) throw new Error('No project open')
    
    try {
      // Export project as a zip file containing all media
      const zipPath = await invoke<string>('export_project_to_zip', {
        project_id: this.currentProjectId
      })
      
      // Read the zip file and return as blob
      const zipContent = await invoke<string>('read_zip_file', {
        path: zipPath
      })
      
      return await this.base64ToBlob(zipContent)
    } catch (error) {
      logger.error(`[FileStorage.exportProject] Failed to export project: ${error}`)
      throw new Error(`Failed to export project: ${error}`)
    }
  }
  
  async importProjectFromZip(zipBlob: Blob): Promise<void> {
    try {
      // Convert blob to base64
      const base64Data = await this.blobToBase64(zipBlob)
      
      // Import the zip file
      const projectData = await invoke<any>('import_project_from_zip', {
        zip_content: base64Data
      })
      
      // Set the imported project as current
      this.currentProject = projectData.project
      this.currentProjectId = projectData.project.id
      
      logger.debug(`[FileStorage.importProjectFromZip] Imported project: ${this.currentProjectId}`)
    } catch (error) {
      logger.error(`[FileStorage.importProjectFromZip] Failed to import project: ${error}`)
      throw new Error(`Failed to import project: ${error}`)
    }
  }
  
  async validateProjectFile(filePath: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const projectData = await invoke<ProjectFile>('load_project', { filePath })
      this.validateProjectData(projectData)
      return { valid: true }
    } catch (error: any) {
      return { valid: false, error: error.message || 'Invalid project file' }
    }
  }
  
  // Recent files tracking
  private async trackRecentFile(filePath: string, metadata: ProjectMetadata): Promise<void> {
    const recentFilesKey = 'scorm_recent_files'
    const maxRecentFiles = 10
    
    try {
      const recentFilesData = localStorage.getItem(recentFilesKey)
      let recentFiles: Array<{ path: string; metadata: ProjectMetadata }> = recentFilesData ? JSON.parse(recentFilesData) : []
      
      // Remove if already exists
      recentFiles = recentFiles.filter(f => f.path !== filePath)
      
      // Add to beginning
      recentFiles.unshift({ path: filePath, metadata })
      
      // Keep only max recent files
      recentFiles = recentFiles.slice(0, maxRecentFiles)
      
      localStorage.setItem(recentFilesKey, JSON.stringify(recentFiles))
    } catch (error) {
      logger.error('Failed to track recent file:', error)
    }
  }
  
  private async getRecentFiles(): Promise<(ProjectMetadata & { path?: string })[]> {
    const recentFilesKey = 'scorm_recent_files'
    
    try {
      const recentFilesData = localStorage.getItem(recentFilesKey)
      if (!recentFilesData) return []
      
      const recentFiles: Array<{ path: string; metadata: ProjectMetadata }> = JSON.parse(recentFilesData)
      const validProjects: (ProjectMetadata & { path?: string })[] = []
      const validRecentFiles: Array<{ path: string; metadata: ProjectMetadata }> = []
      
      // Verify files still exist and update metadata
      for (const file of recentFiles) {
        try {
          // Check if file still exists by trying to load it
          const projectData = await invoke<ProjectFile>('load_project', { filePath: file.path })
          // Add the path to the metadata so we can find the file later
          const projectWithPath = { ...projectData.project, path: file.path }
          validProjects.push(projectWithPath)
          validRecentFiles.push({ path: file.path, metadata: projectData.project })
        } catch (error) {
          // File no longer exists, skip it
          logger.debug(`Recent file no longer exists: ${file.path}`)
        }
      }
      
      // Update localStorage with only valid files
      if (validRecentFiles.length !== recentFiles.length) {
        localStorage.setItem(recentFilesKey, JSON.stringify(validRecentFiles))
      }
      
      return validProjects
    } catch (error) {
      logger.error('Failed to get recent files:', error)
      return []
    }
  }
  
  // Public method to clear recent files cache
  async clearRecentFilesCache(): Promise<void> {
    const recentFilesKey = 'scorm_recent_files'
    localStorage.removeItem(recentFilesKey)
    logger.debug('Recent files cache cleared')
  }
  
  // Auto-backup configuration methods
  setAutoBackupEnabled(enabled: boolean): void {
    this.autoBackupEnabled = enabled
    localStorage.setItem('autoBackupEnabled', enabled.toString())
    
    if (enabled && this.currentProject && this.currentFilePath) {
      this.startAutoBackup()
    } else if (!enabled) {
      this.stopAutoBackup()
    }
  }
  
  setAutoBackupInterval(intervalMs: number): void {
    if (intervalMs < 30000) { // Minimum 30 seconds
      throw new Error('Auto-backup interval must be at least 30 seconds')
    }
    
    this.AUTO_BACKUP_INTERVAL_MS = intervalMs
    localStorage.setItem('autoBackupInterval', intervalMs.toString())
    
    // Restart auto-backup with new interval if it's running
    if (this.autoBackupEnabled && this.autoBackupTimer && this.currentProject && this.currentFilePath) {
      this.startAutoBackup()
    }
  }
  
  getAutoBackupSettings(): { enabled: boolean; intervalMs: number } {
    return {
      enabled: this.autoBackupEnabled,
      intervalMs: this.AUTO_BACKUP_INTERVAL_MS
    }
  }
  
  // Test helper method - only available in test environment
  __resetForTesting(): void {
    if (process.env.NODE_ENV === 'test') {
      // Reset instance by creating a new one
      const newInstance = new FileStorage()
      Object.setPrototypeOf(this, Object.getPrototypeOf(newInstance))
      Object.assign(this, newInstance)
    }
  }
}

// Singleton instance - preserve across HMR
let instance: FileStorage

// Reset function for debugging
export function resetFileStorage() {
  if (typeof window !== 'undefined') {
    delete (window as any).__fileStorageInstance
  }
  instance = new FileStorage()
  if (typeof window !== 'undefined') {
    (window as any).__fileStorageInstance = instance
  }
  return instance
}

// Expose cache clearing function for immediate use in console
if (typeof window !== 'undefined') {
  (window as any).__clearProjectCache = () => {
    logger.debug('Clearing project cache...')
    
    // Clear recent files
    localStorage.removeItem('scorm_recent_files')
    
    // Clear any other project-related localStorage items
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.includes('project') || key.includes('scorm'))) {
        keysToRemove.push(key)
        logger.debug(`Found project-related key: ${key}`)
      }
    }
    
    // Remove all project-related keys
    keysToRemove.forEach(key => {
      logger.debug(`Removing: ${key}`)
      localStorage.removeItem(key)
    })
    
    logger.debug('Cache cleared! Please refresh the page.')
    return 'Cache cleared successfully'
  }
  
  // Debug function to see what's in localStorage
  (window as any).__debugProjectStorage = () => {
    logger.debug('=== Project Storage Debug ===')
    logger.debug('Recent files:', localStorage.getItem('scorm_recent_files'))
    logger.debug('All localStorage keys:')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.includes('project') || key.includes('scorm'))) {
        logger.debug(`${key}:`, localStorage.getItem(key))
      }
    }
    return '=== End Debug ==='
  }
}

// Check if we already have an instance (e.g. from HMR)
if (typeof window !== 'undefined' && (window as any).__fileStorageInstance) {
  // Reuse the existing instance but update its prototype to the new class
  instance = (window as any).__fileStorageInstance
  // Ensure the instance has the latest methods
  Object.setPrototypeOf(instance, FileStorage.prototype)
  logger.debug('FileStorage: Reusing existing instance from HMR, initialized:', instance.isInitialized, 'directory:', instance.projectsDirectory)
} else {
  instance = new FileStorage()
  logger.debug('FileStorage: Creating new instance')
  // Store on window for HMR
  if (typeof window !== 'undefined') {
    (window as any).__fileStorageInstance = instance
  }
}

export const fileStorage = instance