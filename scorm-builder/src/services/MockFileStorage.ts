// Mock FileStorage for browser testing
export class MockFileStorage {
  private mockData: Record<string, any> = {}
  private currentProjectId: string | null = null
  public isInitialized = false

  async initialize(): Promise<void> {
    console.log('[MockFileStorage] Initializing...')
    this.isInitialized = true
    return Promise.resolve()
  }

  async createProject(name: string): Promise<any> {
    const projectId = Date.now().toString()
    const project = {
      id: projectId,
      name,
      path: `/mock/projects/${projectId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    this.mockData[projectId] = { project, content: {} }
    this.currentProjectId = projectId
    return project
  }

  async openProject(projectId: string): Promise<void> {
    if (!this.mockData[projectId]) {
      throw new Error('Project not found')
    }
    this.currentProjectId = projectId
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

  addStateChangeListener(callback: (state: any) => void): () => void {
    // Mock implementation
    return () => {}
  }
}

// Export a singleton instance
export const mockFileStorage = new MockFileStorage()