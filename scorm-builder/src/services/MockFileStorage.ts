// Mock FileStorage for browser testing
export class MockFileStorage {
  private mockData: Record<string, any> = {}
  private _currentProjectId: string | null = null
  private _currentProjectPath: string | null = null
  public isInitialized = false
  
  get currentProjectId(): string | null {
    return this._currentProjectId
  }

  async initialize(): Promise<void> {
    console.log('[MockFileStorage] Initializing...')
    this.isInitialized = true
    return Promise.resolve()
  }

  async createProject(name: string, projectsDir?: string): Promise<any> {
    const projectId = Date.now().toString()
    const projectPath = `/mock/projects/${projectId}`
    const project = {
      id: projectId,
      name,
      path: projectPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.mockData[projectId] = { project, content: {}, media: {} }
    this._currentProjectId = projectId
    this._currentProjectPath = projectPath
    return project
  }

  async openProject(projectId: string): Promise<void> {
    if (!this.mockData[projectId]) {
      throw new Error('Project not found')
    }
    this._currentProjectId = projectId
    this._currentProjectPath = this.mockData[projectId].project.path
  }

  async saveContent(contentId: string, content: any): Promise<void> {
    if (!this.currentProjectId) throw new Error('No project open')
    if (!this.mockData[this.currentProjectId].content) {
      this.mockData[this.currentProjectId].content = {}
    }
    this.mockData[this.currentProjectId].content[contentId] = content
  }

  async getContent(contentId: string): Promise<any> {
    if (!this.currentProjectId) return null
    return this.mockData[this.currentProjectId]?.content?.[contentId] || null
  }

  async listProjects(): Promise<any[]> {
    return Object.values(this.mockData).map(d => d.project)
  }

  async getRecentProjects(): Promise<any[]> {
    return this.listProjects()
  }

  async checkForRecovery(): Promise<{ hasBackup: boolean }> {
    return { hasBackup: false }
  }

  getCurrentProjectId(): string | null {
    return this.currentProjectId
  }


  async getCourseMetadata(): Promise<any> {
    return this.getContent('metadata')
  }

  async storeMedia(id: string, blob: Blob, mediaType: string, metadata?: any): Promise<void> {
    if (!this.currentProjectId) throw new Error('No project open')
    if (!this.mockData[this.currentProjectId].media) {
      this.mockData[this.currentProjectId].media = {}
    }

    let data: Uint8Array

    // Convert blob to Uint8Array to simulate file storage
    if (blob.arrayBuffer && typeof blob.arrayBuffer === 'function') {
      // Browser environment
      const arrayBuffer = await blob.arrayBuffer()
      data = new Uint8Array(arrayBuffer)
    } else if ((blob as any).buffer) {
      // Node.js Buffer-like object
      data = new Uint8Array((blob as any).buffer)
    } else {
      // Fallback: convert string to bytes
      const text = blob.toString()
      data = new TextEncoder().encode(text)
    }

    this.mockData[this.currentProjectId].media[id] = {
      mediaType,
      metadata: metadata || {},
      size: blob.size || data.length,
      data
    }
  }

  async getMedia(id: string): Promise<any> {
    if (!this.currentProjectId) return null
    const media = this.mockData[this.currentProjectId]?.media?.[id]
    if (!media) return null

    return {
      id: id,
      mediaType: media.mediaType,
      metadata: media.metadata,
      size: media.size,
      data: media.data.buffer  // Convert Uint8Array to ArrayBuffer to match MediaInfo interface
    }
  }
  
  async getMediaForTopic(topicId: string): Promise<any[]> {
    if (!this.currentProjectId) return []
    const topicMedia = this.mockData[this.currentProjectId]?.topicMedia?.[topicId] || []
    return topicMedia
  }
  
  async addMediaToTopic(topicId: string, blob: Blob, metadata: any): Promise<void> {
    if (!this.currentProjectId) throw new Error('No project open')
    if (!this.mockData[this.currentProjectId].topicMedia) {
      this.mockData[this.currentProjectId].topicMedia = {}
    }
    if (!this.mockData[this.currentProjectId].topicMedia[topicId]) {
      this.mockData[this.currentProjectId].topicMedia[topicId] = []
    }
    
    const media = {
      id: Date.now().toString(),
      blob,
      metadata,
      mediaType: metadata.mediaType
    }
    
    this.mockData[this.currentProjectId].topicMedia[topicId].push(media)
  }

  addStateChangeListener(_callback: (state: any) => void): () => void {
    // Mock implementation
    return () => {}
  }

  // Additional methods for testing

  getStoredMetadata(mediaId: string): any {
    if (!this.currentProjectId) return null
    const media = this.mockData[this.currentProjectId]?.media?.[mediaId]
    return media?.metadata || null
  }

  async getAllProjectMediaMetadata(): Promise<any[]> {
    if (!this.currentProjectId) return []
    const media = this.mockData[this.currentProjectId]?.media || {}

    return Object.entries(media).map(([id, mediaData]: [string, any]) => ({
      id,
      type: mediaData.mediaType,
      page_id: mediaData.metadata.page_id,
      original_name: mediaData.metadata.original_name,
      mime_type: mediaData.metadata.mime_type,
      size: mediaData.size,
      ...mediaData.metadata
    }))
  }

  async doesMediaExist(mediaId: string): Promise<boolean> {
    if (!this.currentProjectId) return false
    return !!(this.mockData[this.currentProjectId]?.media?.[mediaId])
  }

  async openProjectFromFile(): Promise<any> {
    const projectId = Date.now().toString()
    const project = {
      id: projectId,
      name: 'Opened Project',
      path: `/mock/projects/${projectId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.mockData[projectId] = { project, content: {} }
    this._currentProjectId = projectId
    return project
  }

  async openProjectFromPath(filePath: string, options?: any): Promise<void> {
    const projectId = Date.now().toString()
    const project = {
      id: projectId,
      name: 'Project from ' + filePath,
      path: filePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.mockData[projectId] = { project, content: {} }
    this._currentProjectId = projectId
  }

  async saveProject(): Promise<void> {
    // Mock save
    console.log('[MockFileStorage] Project saved')
  }


  async deleteProject(projectId: string): Promise<void> {
    delete this.mockData[projectId]
    if (this._currentProjectId === projectId) {
      this._currentProjectId = null
    }
  }

  async recoverFromBackup(backupPath: string): Promise<void> {
    console.log('[MockFileStorage] Recovering from backup:', backupPath)
  }

  async loadProjectFromFile(): Promise<any> {
    return this.openProjectFromFile()
  }

  async storeYouTubeVideo(id: string, youtubeUrl: string, metadata?: any): Promise<void> {
    // Directly store YouTube data without Blob
    if (!this.currentProjectId) throw new Error('No project open')
    if (!this.mockData[this.currentProjectId].media) {
      this.mockData[this.currentProjectId].media = {}
    }

    const data = new TextEncoder().encode(youtubeUrl)

    this.mockData[this.currentProjectId].media[id] = {
      mediaType: 'youtube',
      metadata: metadata || {},
      size: data.length,
      data
    }
  }

  async deleteMedia(id: string): Promise<boolean> {
    if (!this.currentProjectId) return false
    const media = this.mockData[this.currentProjectId]?.media
    if (media && media[id]) {
      delete media[id]
      return true
    }
    return false
  }

  async updateYouTubeMetadata(id: string, updates: any): Promise<void> {
    if (!this.currentProjectId) throw new Error('No project open')
    const media = this.mockData[this.currentProjectId]?.media?.[id]
    if (media) {
      media.metadata = { ...media.metadata, ...updates }
    }
  }


  async exportProject(): Promise<Blob> {
    const data = JSON.stringify(this.mockData[this._currentProjectId || ''])
    return new Blob([data], { type: 'application/json' })
  }

  async importProjectFromZip(zipBlob: Blob): Promise<void> {
    console.log('[MockFileStorage] Importing project from zip')
  }

  setProjectsDirectory(directory: string): void {
    console.log('[MockFileStorage] Setting projects directory:', directory)
  }

  async migrateFromLocalStorage(): Promise<any[]> {
    console.log('[MockFileStorage] Migrating from localStorage')
    return []
  }

  async clearRecentFilesCache(): Promise<void> {
    console.log('[MockFileStorage] Clearing recent files cache')
  }

  async getMediaUrl(id: string): Promise<string | null> {
    const media = await this.getMedia(id)
    return media ? `blob://mock/${id}` : null
  }

  async listMedia(projectId?: string): Promise<any[]> {
    const targetProjectId = projectId || this.currentProjectId
    if (!targetProjectId) return []

    const media = this.mockData[targetProjectId]?.media || {}
    return Object.keys(media).map(id => ({
      id,
      filename: media[id].metadata?.filename || `${id}.${media[id].mediaType}`,
      type: media[id].mediaType,
      metadata: media[id].metadata
    }))
  }

  get courseData(): any {
    if (!this.currentProjectId) return null
    return this.mockData[this.currentProjectId]?.content?.metadata || null
  }

  
  // SCORM and Settings Methods
  async saveScormConfig(config: any): Promise<void> {
    if (!this.currentProjectId) throw new Error('No project open')
    if (!this.mockData[this.currentProjectId].content) {
      this.mockData[this.currentProjectId].content = {}
    }
    this.mockData[this.currentProjectId].content.scormConfig = config
  }
  
  async getScormConfig(): Promise<any> {
    if (!this.currentProjectId) return null
    return this.mockData[this.currentProjectId]?.content?.scormConfig || null
  }
  
  async saveAudioSettings(settings: any): Promise<void> {
    if (!this.currentProjectId) throw new Error('No project open')
    if (!this.mockData[this.currentProjectId].content) {
      this.mockData[this.currentProjectId].content = {}
    }
    this.mockData[this.currentProjectId].content.audioSettings = settings
  }
  
  async getAudioSettings(): Promise<any> {
    if (!this.currentProjectId) return null
    return this.mockData[this.currentProjectId]?.content?.audioSettings || null
  }
  
  async saveAiPrompt(prompt: string): Promise<void> {
    if (!this.currentProjectId) throw new Error('No project open')
    if (!this.mockData[this.currentProjectId].content) {
      this.mockData[this.currentProjectId].content = {}
    }
    this.mockData[this.currentProjectId].content.aiPrompt = prompt
  }
  
  async getAiPrompt(): Promise<string | null> {
    if (!this.currentProjectId) return null
    return this.mockData[this.currentProjectId]?.content?.aiPrompt || null
  }
}

// Export a singleton instance
export const mockFileStorage = new MockFileStorage()