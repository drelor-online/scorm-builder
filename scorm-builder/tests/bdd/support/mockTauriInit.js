// This script will be injected into the page before any other scripts run
// It sets up the mock Tauri API

// Create a mock storage in memory
const mockStorage = {
  projects: {},
  currentProjectId: null,
  recentProjects: [],
  appInitialized: false,
  mediaFiles: {}
};

// Mock Tauri API
window.__TAURI__ = {
  invoke: async (cmd, args) => {
    console.log('[Mock Tauri] invoke:', cmd, args);
    
    switch (cmd) {
      case 'check_app_dir':
        mockStorage.appInitialized = true;
        return { exists: true, path: '/mock/app/dir' };
        
      case 'ensure_directories':
        return true;
        
      case 'get_projects_dir':
        return '/mock/projects';
        
      case 'create_file':
      case 'write_file':
        const fileId = args?.path || args?.id || Date.now().toString();
        mockStorage.mediaFiles[fileId] = args?.content || args?.data;
        return fileId;
        
      case 'create_project':
        const projectId = Date.now().toString();
        const project = {
          id: projectId,
          name: args?.name,
          path: `/mock/projects/${projectId}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        mockStorage.projects[projectId] = project;
        mockStorage.currentProjectId = projectId;
        return project;
        
      case 'open_project':
        mockStorage.currentProjectId = args?.projectId;
        return mockStorage.projects[args?.projectId];
        
      case 'list_projects':
        return Object.values(mockStorage.projects);
        
      case 'get_recent_projects':
        return mockStorage.recentProjects;
        
      case 'save_content':
        if (!mockStorage.currentProjectId) throw new Error('No project open');
        if (!mockStorage.projects[mockStorage.currentProjectId].content) {
          mockStorage.projects[mockStorage.currentProjectId].content = {};
        }
        mockStorage.projects[mockStorage.currentProjectId].content[args?.contentId] = args?.content;
        return true;
        
      case 'get_content':
        if (!mockStorage.currentProjectId) throw new Error('No project open');
        return mockStorage.projects[mockStorage.currentProjectId]?.content?.[args?.contentId] || null;
        
      case 'check_recovery':
        return { hasBackup: false };
        
      default:
        console.warn('[Mock Tauri] Unhandled command:', cmd);
        return null;
    }
  }
};

// Mock Tauri modules
window.__TAURI_IPC__ = {
  transformCallback: () => () => {}
};

// Add mock event listener for file drops
window.__TAURI__.event = {
  listen: () => Promise.resolve(() => {})
};

// Add path module mock
window.__TAURI__.path = {
  appDataDir: async () => '/mock/app/data',
  join: async (...paths) => paths.join('/')
};

console.log('[Mock Tauri] ✅ Mock Tauri API initialized');