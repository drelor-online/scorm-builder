// Mock Tauri API for browser testing

declare global {
  interface Window {
    __TAURI__?: {
      invoke: (cmd: string, args?: any) => Promise<any>
    }
    __TAURI_IPC__?: any
  }
}

export function setupMockTauri() {
  // Check if Tauri is already available
  if (window.__TAURI__) {
    return
  }

  // Create a mock storage in memory
  const mockStorage: Record<string, any> = {
    projects: {},
    currentProjectId: null,
    recentProjects: []
  }

  // Mock Tauri API
  window.__TAURI__ = {
    invoke: async (cmd: string, args?: any): Promise<any> => {
      console.log('[Mock Tauri] invoke:', cmd, args)
      
      switch (cmd) {
        case 'check_app_dir':
          return { exists: true, path: '/mock/app/dir' }
          
        case 'create_project':
          const projectId = Date.now().toString()
          const project = {
            id: projectId,
            name: args.name,
            path: `/mock/projects/${projectId}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
          mockStorage.projects[projectId] = project
          mockStorage.currentProjectId = projectId
          return project
          
        case 'open_project':
          mockStorage.currentProjectId = args.projectId
          return mockStorage.projects[args.projectId]
          
        case 'list_projects':
          return Object.values(mockStorage.projects)
          
        case 'get_recent_projects':
          return mockStorage.recentProjects
          
        case 'save_content':
          if (!mockStorage.currentProjectId) throw new Error('No project open')
          if (!mockStorage.projects[mockStorage.currentProjectId].content) {
            mockStorage.projects[mockStorage.currentProjectId].content = {}
          }
          mockStorage.projects[mockStorage.currentProjectId].content[args.contentId] = args.content
          return true
          
        case 'get_content':
          if (!mockStorage.currentProjectId) throw new Error('No project open')
          return mockStorage.projects[mockStorage.currentProjectId]?.content?.[args.contentId] || null
          
        case 'store_media':
          if (!mockStorage.currentProjectId) throw new Error('No project open')
          if (!mockStorage.projects[mockStorage.currentProjectId].media) {
            mockStorage.projects[mockStorage.currentProjectId].media = {}
          }
          // Convert blob to base64 for storage
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(args.blob)
          })
          mockStorage.projects[mockStorage.currentProjectId].media[args.id] = {
            base64,
            mediaType: args.mediaType,
            metadata: args.metadata
          }
          return true
          
        case 'get_media':
          if (!mockStorage.currentProjectId) throw new Error('No project open')
          return mockStorage.projects[mockStorage.currentProjectId]?.media?.[args.id] || null
          
        case 'save_course_metadata':
          if (!mockStorage.currentProjectId) throw new Error('No project open')
          mockStorage.projects[mockStorage.currentProjectId].metadata = args.metadata
          return true
          
        case 'get_course_metadata':
          if (!mockStorage.currentProjectId) throw new Error('No project open')
          return mockStorage.projects[mockStorage.currentProjectId]?.metadata || null
          
        case 'check_recovery':
          return { hasBackup: false }
          
        default:
          console.warn('[Mock Tauri] Unhandled command:', cmd)
          return null
      }
    }
  }

  // Mock Tauri modules
  ;(window as any).__TAURI_IPC__ = {
    transformCallback: () => () => {}
  }
  
  // Add mock event listener for file drops
  ;(window as any).tauriEvent = {
    listen: () => Promise.resolve(() => {})
  }
}