import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Tauri API - must be hoisted
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn()
}));

import { FileStorage } from '../FileStorage';
import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

describe('FileStorage Export/Import', () => {
  let storage: FileStorage;
  
  beforeEach(() => {
    storage = new FileStorage();
    mockInvoke.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Export Project', () => {
    it('should export project as ZIP with media files', async () => {
      // Setup: Mock a loaded project
      const projectPath = 'C:\\Projects\\test_project_123.scormproj';
      const projectId = '123';
      
      // First mock the project loading
      mockInvoke.mockImplementationOnce(() => Promise.resolve({
        project: { id: projectId, name: 'Test Project' },
        metadata: { version: '1.0.0' }
      }));
      
      await storage.openProject(projectPath);
      
      // Manually set the internal state since the mock doesn't do it
      (storage as any)._currentProjectPath = projectPath;
      (storage as any)._currentProjectId = projectId;
      
      // Setup mock for ZIP creation
      const mockZipData = new Uint8Array([1, 2, 3, 4, 5]); // Mock ZIP bytes
      mockInvoke.mockImplementationOnce(() => Promise.resolve({
        zipData: mockZipData,
        fileCount: 5,
        totalSize: 1024
      }));
      
      // Act: Export the project
      const blob = await storage.exportProject();
      
      // Assert
      expect(mockInvoke).toHaveBeenCalledWith('create_project_zip', {
        projectPath,
        projectId,
        includeMedia: true
      });
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/zip');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should handle export error when command not found', async () => {
      // Setup: Mock a loaded project
      const projectPath = 'C:\\Projects\\test_project_123.scormproj';
      const projectId = '123';
      
      mockInvoke.mockImplementationOnce(() => Promise.resolve({
        project: { id: projectId, name: 'Test Project' },
        metadata: { version: '1.0.0' }
      }));
      
      await storage.openProject(projectPath);
      
      // Manually set the internal state
      (storage as any)._currentProjectPath = projectPath;
      (storage as any)._currentProjectId = projectId;
      
      // Mock the command not found error
      mockInvoke.mockRejectedValueOnce(new Error('Command create_project_zip not found'));
      
      // Also mock the fallback load_project call
      mockInvoke.mockImplementationOnce(() => Promise.resolve({
        project: { id: '123', name: 'Test Project' },
        metadata: { version: '1.0.0' }
      }));
      
      // Act: Export should fall back to JSON export
      const blob = await storage.exportProject();
      
      // Assert: Should get JSON blob as fallback
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    it('should export project with progress callback', async () => {
      // Setup
      const projectPath = 'C:\\Projects\\test_project_123.scormproj';
      const projectId = '123';
      const progressCallback = vi.fn();
      
      mockInvoke.mockImplementationOnce(() => Promise.resolve({
        project: { id: projectId, name: 'Test Project' },
        metadata: { version: '1.0.0' }
      }));
      
      await storage.openProject(projectPath);
      
      // Manually set the internal state
      (storage as any)._currentProjectPath = projectPath;
      (storage as any)._currentProjectId = projectId;
      
      mockInvoke.mockImplementationOnce(() => Promise.resolve({
        zipData: new Uint8Array([1, 2, 3]),
        fileCount: 3,
        totalSize: 512
      }));
      
      // Act
      const blob = await storage.exportProjectWithProgress(progressCallback);
      
      // Assert
      expect(mockInvoke).toHaveBeenCalledWith('create_project_zip_with_progress', {
        projectPath,
        projectId,
        includeMedia: true,
        progressCallback: true
      });
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/zip');
    });
  });

  describe('Import Project', () => {
    it('should import project from ZIP with media files', async () => {
      // Setup: Create a mock ZIP blob
      const zipData = new Uint8Array([1, 2, 3, 4, 5]);
      const zipBlob = new Blob([zipData], { type: 'application/zip' });
      
      // Mock get_projects_dir
      mockInvoke.mockImplementationOnce(() => 
        Promise.resolve('C:\\Users\\test\\Documents\\SCORM Projects')
      );
      
      // Mock extract_project_zip
      mockInvoke.mockImplementationOnce(() => Promise.resolve({
        projectData: {
          project: { 
            id: 'old_123', 
            name: 'Imported Project',
            description: 'Test project'
          },
          metadata: { version: '1.0.0' }
        },
        mediaFiles: [
          { id: 'media1', data: [1, 2, 3], metadata: { page_id: 'page1', media_type: 'image' } },
          { id: 'media2', data: [4, 5, 6], metadata: { page_id: 'page2', media_type: 'video' } }
        ]
      }));
      
      // Mock save_project_with_media
      const newProjectPath = 'C:\\Users\\test\\Documents\\SCORM Projects\\imported_456.scormproj';
      mockInvoke.mockImplementationOnce(() => Promise.resolve({
        projectPath: newProjectPath
      }));
      
      // Mock update_imported_media_paths
      mockInvoke.mockImplementationOnce(() => Promise.resolve());
      
      // Act
      await storage.importProjectFromZip(zipBlob);
      
      // Assert
      expect(mockInvoke).toHaveBeenCalledWith('extract_project_zip', {
        zipData: expect.any(Object) // ArrayBuffer
      });
      
      expect(mockInvoke).toHaveBeenCalledWith('save_project_with_media', 
        expect.objectContaining({
          filePath: expect.stringContaining('imported_'),
          projectData: expect.objectContaining({
            project: expect.objectContaining({
              name: 'Imported Project'
            })
          }),
          mediaFiles: expect.arrayContaining([
            expect.objectContaining({ id: 'media1' }),
            expect.objectContaining({ id: 'media2' })
          ])
        })
      );
      
      expect(mockInvoke).toHaveBeenCalledWith('update_imported_media_paths',
        expect.objectContaining({
          oldProjectId: 'old_123',
          newProjectId: expect.any(String)
        })
      );
    });

    it('should handle import error for invalid ZIP', async () => {
      // Setup
      const invalidZip = new Blob(['invalid'], { type: 'text/plain' });
      
      mockInvoke.mockImplementationOnce(() => 
        Promise.resolve('C:\\Users\\test\\Documents\\SCORM Projects')
      );
      
      mockInvoke.mockRejectedValueOnce(new Error('Invalid ZIP file'));
      
      // Act & Assert
      await expect(storage.importProjectFromZip(invalidZip))
        .rejects.toThrow('Invalid ZIP file');
    });

    it('should validate and sanitize project data on import', async () => {
      // Setup: ZIP with malicious project ID
      const zipBlob = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/zip' });
      
      mockInvoke.mockImplementationOnce(() => 
        Promise.resolve('C:\\Users\\test\\Documents\\SCORM Projects')
      );
      
      // Extract returns project with path traversal attempt in ID
      mockInvoke.mockImplementationOnce(() => Promise.resolve({
        projectData: {
          project: { 
            id: '../../../etc/passwd', 
            name: 'Malicious Project'
          },
          metadata: { version: '1.0.0' }
        },
        mediaFiles: []
      }));
      
      mockInvoke.mockImplementationOnce(() => Promise.resolve({
        projectPath: 'C:\\Users\\test\\Documents\\SCORM Projects\\imported_789.scormproj'
      }));
      
      // Act
      await storage.importProjectFromZip(zipBlob);
      
      // Assert: Project ID should be sanitized in save call
      expect(mockInvoke).toHaveBeenCalledWith('save_project_with_media',
        expect.objectContaining({
          projectData: expect.objectContaining({
            project: expect.objectContaining({
              id: expect.not.stringContaining('../')
            })
          })
        })
      );
    });
  });
});