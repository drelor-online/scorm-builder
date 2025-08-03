import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileStorage } from '../FileStorage';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}));

describe('FileStorage - Tauri Integration', () => {
  let fileStorage: FileStorage;
  const mockInvoke = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the invoke function
    vi.doMock('@tauri-apps/api/core', () => ({
      invoke: mockInvoke
    }));
    fileStorage = new FileStorage();
  });

  describe('createProject', () => {
    it('should create a .scormproj file with proper structure', async () => {
      const projectName = 'Test Project';
      const mockProjectsDir = '/Users/test/projects';
      
      // Mock get_projects_dir
      mockInvoke.mockResolvedValueOnce(mockProjectsDir);
      // Mock save_project
      mockInvoke.mockResolvedValueOnce(undefined);

      const project = await fileStorage.createProject(projectName);

      // Verify get_projects_dir was called
      expect(mockInvoke).toHaveBeenCalledWith('get_projects_dir');

      // Verify save_project was called with correct structure
      expect(mockInvoke).toHaveBeenCalledWith('save_project', {
        file_path: expect.stringContaining('.scormproj'),
        project_data: {
          project: {
            id: expect.any(String),
            name: projectName,
            created: expect.any(String),
            last_modified: expect.any(String)
          },
          course_data: {
            title: projectName,
            difficulty: 1,
            template: 'default',
            topics: [],
            custom_topics: null
          },
          ai_prompt: null,
          course_content: null,
          media: {
            images: [],
            videos: [],
            audio: [],
            captions: []
          },
          audio_settings: {
            voice: 'default',
            speed: 1.0
          },
          scorm_config: {
            version: 'SCORM_2004',
            completion_criteria: 'all'
          }
        }
      });

      // Verify return value
      expect(project).toEqual({
        id: expect.any(String),
        name: projectName,
        path: expect.stringContaining('.scormproj'),
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
    });
  });

  describe('storeMedia', () => {
    it('should store media with proper folder structure', async () => {
      fileStorage['_currentProjectId'] = 'test-project-123';
      
      const mediaId = 'media-456';
      const blob = new Blob(['test data'], { type: 'image/png' });
      const metadata = {
        page_id: 'topic-1',
        original_name: 'test.png'
      };

      mockInvoke.mockResolvedValueOnce(undefined);

      await fileStorage.storeMedia(mediaId, blob, 'image', metadata);

      expect(mockInvoke).toHaveBeenCalledWith('store_media', {
        id: mediaId,
        projectId: 'test-project-123',
        data: expect.any(Array),
        metadata: {
          page_id: 'topic-1',
          type: 'image',
          original_name: 'test.png',
          mime_type: 'image/png',
          source: undefined,
          embed_url: undefined,
          title: undefined
        }
      });
    });
  });

  describe('openProject', () => {
    it('should load .scormproj file and associated media', async () => {
      const projectPath = '/path/to/project.scormproj';
      const mockProjectFile = {
        project: {
          id: 'project-123',
          name: 'Test Project',
          created: '2024-01-01T00:00:00Z',
          last_modified: '2024-01-01T00:00:00Z'
        },
        course_data: { title: 'Test' },
        media: { images: [], videos: [], audio: [] }
      };

      mockInvoke.mockResolvedValueOnce(mockProjectFile);

      await fileStorage.openProject(projectPath);

      expect(mockInvoke).toHaveBeenCalledWith('load_project', {
        file_path: projectPath
      });

      expect(fileStorage.currentProjectId).toBe('project-123');
    });
  });
});