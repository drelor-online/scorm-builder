// Mock Tauri API for testing
// This provides a browser-compatible implementation of Tauri APIs

import { generateProjectId } from '../utils/idGenerator'

const mockStorage: {
  projects: Record<string, any>;
  currentProjectId: string | null;
  recentProjects: any[];
  mediaFiles: Record<string, any>;
  appInitialized: boolean;
} = {
  projects: {},
  currentProjectId: null,
  recentProjects: [],
  mediaFiles: {},
  appInitialized: false
};

const mockTauriAPI = {
  invoke: async (cmd: string, args?: any): Promise<any> => {
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
      case 'write_file': {
        const fileId = args?.path || args?.id || Date.now().toString();
        mockStorage.mediaFiles[fileId] = args?.content || args?.data;
        return fileId;
      }
        
      case 'create_project': {
        const projectId = generateProjectId();
        const project = {
          id: projectId,
          name: args?.name || 'Untitled Project',
          path: `/mock/projects/${projectId}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        mockStorage.projects[projectId] = project;
        mockStorage.currentProjectId = projectId;
        return project;
      }
        
      case 'open_project':
        mockStorage.currentProjectId = args?.projectId;
        return mockStorage.projects[args?.projectId] || null;
        
      case 'list_projects':
        return Object.values(mockStorage.projects);
        
      case 'get_recent_projects':
        return mockStorage.recentProjects;
        
      case 'save_content':
        if (!mockStorage.currentProjectId) {
          throw new Error('No project open');
        }
        if (!mockStorage.projects[mockStorage.currentProjectId].content) {
          mockStorage.projects[mockStorage.currentProjectId].content = {};
        }
        mockStorage.projects[mockStorage.currentProjectId].content[args?.contentId] = args?.content;
        return true;
        
      case 'get_content':
        if (!mockStorage.currentProjectId) {
          throw new Error('No project open');
        }
        return mockStorage.projects[mockStorage.currentProjectId]?.content?.[args?.contentId] || null;
        
      case 'check_recovery':
        return { hasBackup: false };
        
      case 'get_api_key':
        // Return mock API keys for testing
        return args?.keyName === 'murf_api_key' ? 'mock-murf-key' : null;
        
      case 'set_api_key':
        console.log('[Mock Tauri] API key set:', args?.keyName);
        return true;
        
      case 'show_save_dialog':
        // Mock file save dialog
        return `/mock/downloads/scorm-package-${Date.now()}.zip`;
        
      case 'open_path':
        console.log('[Mock Tauri] Opening path:', args?.path);
        return true;
        
      case 'take_screenshot':
        // Mock screenshot functionality
        const screenshotName = args?.filename || `screenshot-${Date.now()}.png`;
        console.log('[Mock Tauri] Taking screenshot:', screenshotName);
        // Return a mock path
        return `/mock/screenshots/${screenshotName}`;
        
      case 'save_workflow_data':
        // Mock workflow data saving
        const workflowName = args?.filename || `workflow-${Date.now()}.json`;
        console.log('[Mock Tauri] Saving workflow data:', workflowName);
        console.log('[Mock Tauri] Workflow data length:', args?.data?.length || 0);
        // Return a mock path
        return `/mock/workflow-recordings/${workflowName}`;
        
      default:
        console.warn('[Mock Tauri] Unhandled command:', cmd);
        return null;
    }
  },
  
  event: {
    listen: (event: string, _handler: Function) => {
      console.log('[Mock Tauri] Event listener registered:', event);
      return Promise.resolve(() => {
        console.log('[Mock Tauri] Event listener unregistered:', event);
      });
    }
  },
  
  path: {
    appDataDir: async () => '/mock/app/data',
    join: async (...paths: string[]) => paths.join('/')
  }
};

// Mock Tauri IPC module
const mockTauriIPC = {
  transformCallback: (callback: Function) => callback
};

// Export for use in app
export function setupMockTauri() {
  if (typeof window !== 'undefined' && !window.__TAURI__) {
    console.log('🎭 Setting up mock Tauri API for testing');
    (window as any).__TAURI__ = mockTauriAPI;
    (window as any).__TAURI_IPC__ = mockTauriIPC;
  }
}

export { mockTauriAPI, mockTauriIPC };