// Mock FileStorage for browser testing
export class MockFileStorage {
  private mockData: Record<string, any> = {}
  private _currentProjectId: string | null = null
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
    const project = {
      id: projectId,
      name,
      path: `/mock/projects/${projectId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.mockData[projectId] = { project, content: {} }
    this._currentProjectId = projectId
    return project
  }

  async openProject(projectId: string): Promise<void> {
    if (!this.mockData[projectId]) {
      throw new Error('Project not found')
    }
    this._currentProjectId = projectId
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

  async saveCourseMetadata(metadata: any): Promise<void> {
    return this.saveContent('metadata', metadata)
  }

  async getCourseMetadata(): Promise<any> {
    return this.getContent('metadata')
  }

  async storeMedia(id: string, blob: Blob, mediaType: string, metadata?: any): Promise<void> {
    if (!this.currentProjectId) throw new Error('No project open')
    if (!this.mockData[this.currentProjectId].media) {
      this.mockData[this.currentProjectId].media = {}
    }
    this.mockData[this.currentProjectId].media[id] = { mediaType, metadata, size: blob.size }
  }

  async getMedia(id: string): Promise<any> {
    if (!this.currentProjectId) return null
    return this.mockData[this.currentProjectId]?.media?.[id] || null
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

  async saveProjectAs(): Promise<void> {
    // Mock save as
    console.log('[MockFileStorage] Project saved as')
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
    await this.storeMedia(id, new Blob([youtubeUrl], { type: 'text/plain' }), 'youtube', metadata)
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

  get courseData(): any {
    if (!this.currentProjectId) return null
    return this.mockData[this.currentProjectId]?.content?.metadata || null
  }

  updateCourseData(metadata: any): void {
    if (!this.currentProjectId) return
    if (!this.mockData[this.currentProjectId].content) {
      this.mockData[this.currentProjectId].content = {}
    }
    this.mockData[this.currentProjectId].content.metadata = metadata
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