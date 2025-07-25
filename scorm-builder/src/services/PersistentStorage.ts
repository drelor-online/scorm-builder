/**
 * PersistentStorage Service
 * Handles all data persistence using IndexedDB for binary data and localStorage for text
 */

interface MediaItem {
  id: string
  blob: Blob
  type: string // Store full mime type
  mediaType: 'image' | 'video' | 'audio' // Store media category
  metadata?: Record<string, any>
  timestamp: number
}

interface ContentItem {
  topicId: string
  title?: string
  content?: string
  narration?: string
  [key: string]: any
}

interface Project {
  id: string
  name: string
  created: string
  lastAccessed: string
  metadata?: Record<string, any>
}

export class PersistentStorage {
  private db: IDBDatabase | null = null
  private currentProjectId: string | null = null
  private readonly DB_NAME = 'SCORMBuilderDB'
  private readonly DB_VERSION = 1
  private readonly MEDIA_STORE = 'media'
  private readonly CONTENT_PREFIX = 'scorm_content_'
  private readonly PROJECT_PREFIX = 'scorm_project_'
  private readonly METADATA_KEY = 'scorm_course_metadata'
  
  async initialize(): Promise<void> {
    // Initialize IndexedDB for media storage
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)
      
      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Create media store
        if (!db.objectStoreNames.contains(this.MEDIA_STORE)) {
          const mediaStore = db.createObjectStore(this.MEDIA_STORE, { keyPath: 'id' })
          mediaStore.createIndex('type', 'type', { unique: false })
          mediaStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }
  
  // Media Storage Methods
  async storeMedia(id: string, blob: Blob, mediaType: 'image' | 'video' | 'audio', metadata?: Record<string, any>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    // Check storage quota
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate()
        const usage = estimate.usage || 0
        const quota = estimate.quota || Number.MAX_SAFE_INTEGER
        
        // If quota is very large (likely in test environments), check blob size directly
        if (quota > 1000 * 1024 * 1024 * 1024 && blob.size > 50 * 1024 * 1024) { // 50MB threshold
          throw new Error('Storage quota exceeded - file too large')
        }
        
        if (usage + blob.size > quota * 0.9) { // 90% threshold
          throw new Error('Storage quota exceeded')
        }
      } catch (error) {
        // If storage estimation fails, still check for very large files
        if (blob.size > 50 * 1024 * 1024) { // 50MB threshold
          throw new Error('Storage quota exceeded - file too large')
        }
      }
    } else {
      // Fallback for environments without storage API
      if (blob.size > 50 * 1024 * 1024) { // 50MB threshold
        throw new Error('Storage quota exceeded - file too large')
      }
    }
    
    const mediaItem: MediaItem = {
      id,
      blob,
      type: blob.type, // Store the full mime type from the blob
      mediaType, // Store the media category
      metadata,
      timestamp: Date.now()
    }
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.MEDIA_STORE], 'readwrite')
      const store = transaction.objectStore(this.MEDIA_STORE)
      const request = store.put(mediaItem)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
  
  async getMedia(id: string): Promise<MediaItem | null> {
    if (!this.db) throw new Error('Database not initialized')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.MEDIA_STORE], 'readonly')
      const store = transaction.objectStore(this.MEDIA_STORE)
      const request = store.get(id)
      
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }
  
  async getMediaForTopic(topicId: string): Promise<MediaItem[]> {
    if (!this.db) throw new Error('Database not initialized')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.MEDIA_STORE], 'readonly')
      const store = transaction.objectStore(this.MEDIA_STORE)
      const request = store.getAll()
      
      request.onsuccess = () => {
        const allMedia = request.result || []
        // Special case: return all media when topicId is '*'
        if (topicId === '*') {
          resolve(allMedia)
        } else {
          const topicMedia = allMedia.filter(item => item.id.startsWith(topicId))
          resolve(topicMedia)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }
  
  // Content Storage Methods
  async saveContent(id: string, content: ContentItem): Promise<void> {
    const key = `${this.CONTENT_PREFIX}${this.currentProjectId}_${id}`
    localStorage.setItem(key, JSON.stringify(content))
  }
  
  async getContent(id: string): Promise<ContentItem | null> {
    const key = `${this.CONTENT_PREFIX}${this.currentProjectId}_${id}`
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  }
  
  // Course Metadata Methods
  async saveCourseMetadata(metadata: Record<string, any>): Promise<void> {
    const key = `${this.METADATA_KEY}_${this.currentProjectId}`
    localStorage.setItem(key, JSON.stringify(metadata))
  }
  
  async getCourseMetadata(): Promise<Record<string, any> | null> {
    const key = `${this.METADATA_KEY}_${this.currentProjectId}`
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : null
  }
  
  // Project Management Methods
  async createProject(name: string, defaultFolder?: string): Promise<Project> {
    const project: Project = {
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      created: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      // Store the default folder in metadata if provided
      ...(defaultFolder ? { metadata: { defaultFolder } } : {})
    }
    
    const key = `${this.PROJECT_PREFIX}${project.id}`
    localStorage.setItem(key, JSON.stringify(project))
    
    return project
  }
  
  async openProject(projectId: string): Promise<void> {
    this.currentProjectId = projectId
    
    // Update last accessed time
    const key = `${this.PROJECT_PREFIX}${projectId}`
    const data = localStorage.getItem(key)
    
    if (data) {
      const project = JSON.parse(data)
      project.lastAccessed = new Date().toISOString()
      localStorage.setItem(key, JSON.stringify(project))
    }
  }
  
  async listProjects(): Promise<Project[]> {
    const projects: Project[] = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.PROJECT_PREFIX)) {
        const data = localStorage.getItem(key)
        if (data) {
          projects.push(JSON.parse(data))
        }
      }
    }
    
    // Sort by last accessed, most recent first
    return projects.sort((a, b) => 
      new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime()
    )
  }
  
  // Cleanup Methods
  async deleteProject(projectId: string): Promise<void> {
    // Delete all content for this project
    const keysToDelete: string[] = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.includes(projectId)) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => localStorage.removeItem(key))
    
    // Delete all media for this project
    if (this.db) {
      const transaction = this.db.transaction([this.MEDIA_STORE], 'readwrite')
      const store = transaction.objectStore(this.MEDIA_STORE)
      const request = store.getAll()
      
      request.onsuccess = () => {
        const allMedia = request.result || []
        allMedia.forEach(item => {
          if (item.id.includes(projectId)) {
            store.delete(item.id)
          }
        })
      }
    }
  }
  
  // Export/Import Methods
  async exportProject(projectId: string): Promise<Blob> {
    // Gather all data for the project
    const projectData: any = {
      metadata: {},
      content: {},
      media: []
    }
    
    // Get project metadata
    const projectKey = `${this.PROJECT_PREFIX}${projectId}`
    const projectMeta = localStorage.getItem(projectKey)
    if (projectMeta) {
      projectData.project = JSON.parse(projectMeta)
    }
    
    // Get all content
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.includes(projectId) && key.startsWith(this.CONTENT_PREFIX)) {
        const data = localStorage.getItem(key)
        if (data) {
          const contentKey = key.replace(`${this.CONTENT_PREFIX}${projectId}_`, '')
          projectData.content[contentKey] = JSON.parse(data)
        }
      }
    }
    
    // Get course metadata
    const metadataKey = `${this.METADATA_KEY}_${projectId}`
    const metadata = localStorage.getItem(metadataKey)
    if (metadata) {
      projectData.metadata = JSON.parse(metadata)
    }
    
    // Convert to blob
    return new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' })
  }
  
  getCurrentProjectId(): string | null {
    return this.currentProjectId
  }
  
  // Delete a specific media item
  async deleteMedia(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized')
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.MEDIA_STORE], 'readwrite')
      const store = transaction.objectStore(this.MEDIA_STORE)
      const request = store.delete(id)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}