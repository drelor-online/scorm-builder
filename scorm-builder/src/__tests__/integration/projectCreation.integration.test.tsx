import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('Project Creation Integration Test', () => {
  let fileStorage: FileStorage;
  
  beforeEach(() => {
    vi.clearAllMocks();
    fileStorage = new FileStorage();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should create project with proper folder structure', async () => {
    const projectName = 'Test Project';
    const mockProjectMetadata = {
      id: '1754140000000',
      name: projectName,
      created: '2025-02-01T12:00:00Z',
      last_modified: '2025-02-01T12:00:00Z',
      path: `C:\\Users\\test\\Documents\\SCORM Projects\\${projectName}_1754140000000.scormproj`
    };
    
    // Mock the create_project command
    vi.mocked(invoke).mockResolvedValueOnce(mockProjectMetadata);
    
    // Create project
    const project = await fileStorage.createProject(projectName);
    
    // Verify create_project was called with correct parameters
    expect(invoke).toHaveBeenCalledWith('create_project', { name: projectName });
    
    // Verify returned project structure
    expect(project).toEqual({
      id: mockProjectMetadata.id,
      name: mockProjectMetadata.name,
      path: mockProjectMetadata.path,
      createdAt: mockProjectMetadata.created,
      updatedAt: mockProjectMetadata.last_modified
    });
    
    // Verify internal state is updated
    expect(fileStorage.currentProjectId).toBe(mockProjectMetadata.id);
  });
  
  it('should store media in project folder', async () => {
    const projectId = '1754140000000';
    const mediaId = 'test-media-123';
    const testContent = 'test content';
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(testContent);
    
    // Create a mock Blob with arrayBuffer method
    const mediaBlob = {
      type: 'image/png',
      arrayBuffer: vi.fn().mockResolvedValue(uint8Array.buffer)
    } as unknown as Blob;
    
    const metadata = {
      page_id: 'welcome',
      original_name: 'test.png',
      source: 'upload'
    };
    
    // Set up project state
    fileStorage['_currentProjectId'] = projectId;
    
    // Mock the store_media command
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    
    // Store media
    await fileStorage.storeMedia(mediaId, mediaBlob, 'image', metadata);
    
    // Verify store_media was called with correct parameters
    expect(invoke).toHaveBeenCalledWith('store_media', {
      id: mediaId,
      projectId: projectId,
      data: expect.any(Array), // ArrayBuffer converted to array
      metadata: {
        page_id: 'welcome',
        type: 'image',
        original_name: 'test.png',
        mime_type: 'image/png',
        source: 'upload',
        embed_url: undefined,
        title: undefined
      }
    });
  });
  
  it('should handle YouTube video storage', async () => {
    const projectId = '1754140000000';
    const videoId = 'youtube-123';
    const youtubeUrl = 'https://www.youtube.com/watch?v=abc123';
    const metadata = {
      title: 'Test Video',
      page_id: 'topic-1'
    };
    
    // Set up project state
    fileStorage['_currentProjectId'] = projectId;
    
    // Mock the store_media command
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    
    // Mock the internal storeMedia to bypass Blob creation
    const storeMediaSpy = vi.spyOn(fileStorage, 'storeMedia').mockResolvedValueOnce(undefined);
    
    // Store YouTube video
    await fileStorage.storeYouTubeVideo(videoId, youtubeUrl, metadata);
    
    // Verify storeMedia was called with correct parameters
    expect(storeMediaSpy).toHaveBeenCalledWith(
      videoId,
      expect.any(Object), // The Blob
      'youtube',
      expect.objectContaining({
        title: 'Test Video',
        page_id: 'topic-1',
        embed_url: youtubeUrl,
        source: 'youtube'
      })
    );
  });
  
  it.skip('should handle project paths correctly when opening and deleting', async () => {
    const projectPath = 'C:\\Users\\test\\Documents\\SCORM Projects\\Test_1754140000000.scormproj';
    const projectData = {
      project: { 
        id: '1754140000000', 
        name: 'Test Project',
        created: '2025-02-01T12:00:00Z',
        last_modified: '2025-02-01T12:00:00Z'
      },
      course_data: { 
        title: 'Test Project',
        difficulty: 1,
        template: 'default',
        topics: []
      }
    };
    
    // Clear mocks to ensure clean state
    vi.clearAllMocks();
    
    // Mock load_project
    vi.mocked(invoke).mockImplementation((cmd, args) => {
      if (cmd === 'load_project') {
        return Promise.resolve(projectData);
      }
      if (cmd === 'delete_project') {
        return Promise.resolve(undefined);
      }
      return Promise.reject(new Error(`Unexpected command: ${cmd}`));
    });
    
    // Test opening project by path
    await fileStorage.openProject(projectPath);
    
    expect(invoke).toHaveBeenCalledWith('load_project', { filePath: projectPath });
    expect(fileStorage.currentProjectId).toBe('1754140000000');
    
    // Test deleting project by path
    await fileStorage.deleteProject(projectPath);
    
    expect(invoke).toHaveBeenCalledWith('delete_project', { filePath: projectPath });
  });
});