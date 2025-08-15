/**
 * Integration tests for project operations to ensure
 * all Tauri invoke calls use the correct file_path parameter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { FileStorage } from '../../services/FileStorage';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}));

describe('Project Operations - Parameter Naming', () => {
  let fileStorage: FileStorage;
  const mockInvoke = invoke as any;

  beforeEach(() => {
    vi.clearAllMocks();
    fileStorage = new FileStorage();
    fileStorage.isInitialized = true;
  });

  describe('Create Project', () => {
    it('should use correct parameters when creating a project', async () => {
      const mockProject = {
        id: 'test-123',
        name: 'Test Project',
        path: '/path/to/project.scormproj',
        created: new Date().toISOString(),
        last_modified: new Date().toISOString()
      };

      mockInvoke.mockResolvedValueOnce(mockProject);

      await fileStorage.createProject('Test Project');

      // Verify invoke was called with correct command and parameters
      expect(mockInvoke).toHaveBeenCalledWith('create_project', { name: 'Test Project' });
      expect(mockInvoke).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ filePath: expect.anything() })
      );
    });
  });

  describe('Load Project', () => {
    it('should use file_path parameter when loading a project', async () => {
      const mockProjectFile = {
        project: {
          id: 'test-123',
          name: 'Test Project',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString()
        },
        course_data: {
          title: 'Test Course',
          difficulty: 1,
          template: 'default',
          topics: [],
          custom_topics: null
        }
      };

      mockInvoke.mockResolvedValueOnce(mockProjectFile);

      await fileStorage.openProject('/path/to/project.scormproj');

      // Verify invoke was called with filePath (Tauri v2 camelCase convention)
      expect(mockInvoke).toHaveBeenCalledWith('load_project', { 
        filePath: '/path/to/project.scormproj' 
      });
      expect(mockInvoke).not.toHaveBeenCalledWith(
        'load_project',
        expect.objectContaining({ file_path: expect.anything() })
      );
    });

    it('should use file_path when loading in getContent', async () => {
      const mockProjectFile = {
        course_data: { title: 'Test' }
      };

      mockInvoke.mockResolvedValueOnce(mockProjectFile);
      
      // Set current project path
      (fileStorage as any)._currentProjectPath = '/test/path.scormproj';
      
      await fileStorage.getContent('metadata');

      expect(mockInvoke).toHaveBeenCalledWith('load_project', { 
        filePath: '/test/path.scormproj' 
      });
      expect(mockInvoke).not.toHaveBeenCalledWith(
        'load_project',
        expect.objectContaining({ filePath: expect.anything() })
      );
    });

    it('should use file_path when loading in getCourseMetadata', async () => {
      const mockProjectFile = {
        course_data: {
          title: 'Test Course',
          topics: ['Topic 1']
        }
      };

      mockInvoke.mockResolvedValueOnce(mockProjectFile);
      
      // Set current project path
      (fileStorage as any)._currentProjectPath = '/test/metadata.scormproj';
      
      await fileStorage.getCourseMetadata();

      expect(mockInvoke).toHaveBeenCalledWith('load_project', { 
        filePath: '/test/metadata.scormproj' 
      });
      expect(mockInvoke).not.toHaveBeenCalledWith(
        'load_project',
        expect.objectContaining({ filePath: expect.anything() })
      );
    });
  });

  describe('Save Project', () => {
    it('should use file_path parameter when saving a project', async () => {
      const mockProjectFile = {
        project: {
          id: 'test-123',
          name: 'Test Project',
          last_modified: new Date().toISOString()
        },
        course_data: {}
      };

      // Set current project path
      (fileStorage as any)._currentProjectPath = '/path/to/save.scormproj';
      
      // Mock load and save
      mockInvoke
        .mockResolvedValueOnce(mockProjectFile) // for load_project
        .mockResolvedValueOnce(undefined); // for save_project

      await fileStorage.saveProject();

      // Verify both load and save use file_path
      expect(mockInvoke).toHaveBeenCalledWith('load_project', { 
        filePath: '/path/to/save.scormproj' 
      });
      expect(mockInvoke).toHaveBeenCalledWith('save_project', { 
        filePath: '/path/to/save.scormproj',
        projectData: expect.any(Object)
      });
      
      // Ensure filePath was never used
      const calls = mockInvoke.mock.calls;
      calls.forEach(([command, params]: [string, any]) => {
        expect(params).not.toHaveProperty('filePath');
      });
    });

    it('should use file_path when saving content', async () => {
      const mockProjectFile = {
        course_data: {},
        course_content: {}
      };

      (fileStorage as any)._currentProjectPath = '/path/to/content.scormproj';
      
      mockInvoke
        .mockResolvedValueOnce(mockProjectFile) // for load_project
        .mockResolvedValueOnce(undefined); // for save_project

      await fileStorage.saveContent('test-content', { data: 'test' });

      // Verify file_path is used consistently
      expect(mockInvoke).toHaveBeenCalledWith('load_project', { 
        filePath: '/path/to/content.scormproj' 
      });
      expect(mockInvoke).toHaveBeenCalledWith('save_project', { 
        filePath: '/path/to/content.scormproj',
        projectData: expect.any(Object)
      });
    });
  });

  describe('Delete Project', () => {
    it('should use file_path parameter when deleting a project', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await fileStorage.deleteProject('/path/to/delete.scormproj');

      // Verify invoke was called with file_path, not filePath
      expect(mockInvoke).toHaveBeenCalledWith('delete_project', { 
        filePath: '/path/to/delete.scormproj' 
      });
      expect(mockInvoke).not.toHaveBeenCalledWith(
        'delete_project',
        expect.objectContaining({ filePath: expect.anything() })
      );
    });
  });

  describe('Open Project from File', () => {
    it('should use file_path when opening from file dialog', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const mockOpen = open as any;
      
      mockOpen.mockResolvedValueOnce('/selected/project.scormproj');
      
      const mockProjectFile = {
        project: {
          id: 'selected-123',
          name: 'Selected Project',
          created: new Date().toISOString(),
          last_modified: new Date().toISOString()
        }
      };

      mockInvoke.mockResolvedValueOnce(mockProjectFile);

      await fileStorage.openProjectFromFile();

      expect(mockInvoke).toHaveBeenCalledWith('load_project', { 
        filePath: '/selected/project.scormproj' 
      });
      expect(mockInvoke).not.toHaveBeenCalledWith(
        'load_project',
        expect.objectContaining({ filePath: expect.anything() })
      );
    });
  });

  describe('Open Project from Path', () => {
    it('should use file_path when opening from specific path', async () => {
      const mockProjectFile = {
        project: {
          id: 'path-123',
          name: 'Path Project'
        }
      };

      mockInvoke.mockResolvedValueOnce(mockProjectFile);

      await fileStorage.openProjectFromPath('/specific/path.scormproj');

      expect(mockInvoke).toHaveBeenCalledWith('load_project', { 
        filePath: '/specific/path.scormproj' 
      });
      expect(mockInvoke).not.toHaveBeenCalledWith(
        'load_project',
        expect.objectContaining({ filePath: expect.anything() })
      );
    });
  });

  describe('All Operations', () => {
    it('should never use filePath parameter in any operation', async () => {
      const operations = [
        { method: 'createProject', args: ['Test'] },
        { method: 'openProject', args: ['/test.scormproj'] },
        { method: 'deleteProject', args: ['/delete.scormproj'] },
        { method: 'openProjectFromPath', args: ['/path.scormproj'] }
      ];

      // Mock responses for all operations
      mockInvoke.mockImplementation((command: string) => {
        if (command === 'create_project') {
          return Promise.resolve({
            id: 'test',
            name: 'Test',
            path: '/test.scormproj',
            created: new Date().toISOString(),
            last_modified: new Date().toISOString()
          });
        }
        if (command === 'load_project') {
          return Promise.resolve({
            project: { id: 'test', name: 'Test' }
          });
        }
        return Promise.resolve(undefined);
      });

      // Execute all operations
      for (const op of operations) {
        const method = (fileStorage as any)[op.method];
        await method.apply(fileStorage, op.args);
      }

      // Check all invoke calls
      const allCalls = mockInvoke.mock.calls;
      allCalls.forEach(([_command, params]: [string, any]) => {
        // Ensure no call contains filePath parameter
        expect(params).not.toHaveProperty('filePath');
        
        // If it's a command that should have file_path, verify it exists
        if (_command === 'load_project' || _command === 'delete_project' || _command === 'save_project') {
          expect(params).toHaveProperty('file_path');
        }
      });
    });
  });
});