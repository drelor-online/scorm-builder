/**
 * FileMediaManager Tests
 * Intent-based tests following TDD red-green-refactor approach
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileMediaManager } from '../fileMediaManager';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts: string[]) => parts.join('/'))
}));

import { invoke } from '@tauri-apps/api/core';

describe('FileMediaManager', () => {
  let manager: FileMediaManager;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new FileMediaManager(mockProjectPath);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Project Structure Initialization', () => {
    it('should create all necessary directories when initializing a new project', async () => {
      // Intent: When starting a new project, all required directories should be created
      const expectedDirectories = [
        '/test/project/media/audio',
        '/test/project/media/images',
        '/test/project/media/video',
        '/test/project/captions',
        '/test/project/activities',
        '/test/project/temp'
      ];

      await manager.initializeProjectStructure();

      expect(invoke).toHaveBeenCalledTimes(6);
      expectedDirectories.forEach(dir => {
        expect(invoke).toHaveBeenCalledWith('create_directory', { path: dir });
      });
    });

    it('should handle directory creation failures gracefully', async () => {
      // Intent: If directory creation fails, the error should be logged and re-thrown
      const mockError = new Error('Permission denied');
      vi.mocked(invoke).mockRejectedValueOnce(mockError);

      await expect(manager.initializeProjectStructure()).rejects.toThrow('Permission denied');
    });
  });

  describe('Saving Media Files', () => {
    it('should save an audio file with correct naming convention', async () => {
      // Intent: Audio files should be saved with block number prefix (e.g., 0001-welcome.mp3)
      // Create a mock File with arrayBuffer method
      const audioContent = new TextEncoder().encode('audio content');
      const audioFile = new File([audioContent], 'welcome.mp3', { type: 'audio/mpeg' });
      audioFile.arrayBuffer = vi.fn().mockResolvedValue(audioContent.buffer);
      const reference: MediaReference = {
        id: 'audio-0001',
        filename: '0001-welcome.mp3',
        relativePath: 'media/audio/0001-welcome.mp3',
        type: 'audio',
        size: audioFile.size,
        lastModified: Date.now(),
        metadata: {
          blockNumber: '0001',
          topicId: 'welcome'
        }
      };

      await manager.saveMediaFile(audioFile, reference);

      expect(invoke).toHaveBeenCalledWith('write_binary_file', {
        path: '/test/project/media/audio/0001-welcome.mp3',
        contents: expect.any(String) // base64 encoded
      });
    });

    it('should handle large files by converting to base64 correctly', async () => {
      // Intent: Large files should be properly converted to base64 for Tauri
      const largeContent = new Uint8Array(1024 * 1024); // 1MB
      const largeFile = new File([largeContent], 'large.mp3', { type: 'audio/mpeg' });
      largeFile.arrayBuffer = vi.fn().mockResolvedValue(largeContent.buffer);
      const reference: MediaReference = {
        id: 'audio-0002',
        filename: '0002-large.mp3',
        relativePath: 'media/audio/0002-large.mp3',
        type: 'audio',
        size: largeFile.size,
        lastModified: Date.now()
      };

      await manager.saveMediaFile(largeFile, reference);

      expect(invoke).toHaveBeenCalledWith('write_binary_file', {
        path: '/test/project/media/audio/0002-large.mp3',
        contents: expect.any(String)
      });
    });

    it('should reject save attempts when file write fails', async () => {
      // Intent: File write failures should be properly handled and reported
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Disk full'));
      
      const fileContent = new TextEncoder().encode('content');
      const file = new File([fileContent], 'test.mp3', { type: 'audio/mpeg' });
      file.arrayBuffer = vi.fn().mockResolvedValue(fileContent.buffer);
      const reference: MediaReference = {
        id: 'audio-0003',
        filename: '0003-test.mp3',
        relativePath: 'media/audio/0003-test.mp3',
        type: 'audio',
        size: file.size,
        lastModified: Date.now()
      };

      await expect(manager.saveMediaFile(file, reference)).rejects.toThrow('Disk full');
    });
  });

  describe('Reading Media Files', () => {
    it('should read an audio file and return it as a blob with correct mime type', async () => {
      // Intent: Files should be read from disk and converted back to blobs
      const base64Content = btoa('audio content');
      vi.mocked(invoke).mockResolvedValueOnce(base64Content);

      const reference: MediaReference = {
        id: 'audio-0001',
        filename: '0001-welcome.mp3',
        relativePath: 'media/audio/0001-welcome.mp3',
        type: 'audio',
        size: 1234,
        lastModified: Date.now()
      };

      const blob = await manager.readMediaFile(reference);

      expect(invoke).toHaveBeenCalledWith('read_binary_file', {
        path: '/test/project/media/audio/0001-welcome.mp3'
      });
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/mpeg');
    });

    it('should handle missing files gracefully', async () => {
      // Intent: Missing files should throw descriptive errors
      vi.mocked(invoke).mockRejectedValueOnce(new Error('File not found'));

      const reference: MediaReference = {
        id: 'audio-missing',
        filename: 'missing.mp3',
        relativePath: 'media/audio/missing.mp3',
        type: 'audio',
        size: 0,
        lastModified: Date.now()
      };

      await expect(manager.readMediaFile(reference)).rejects.toThrow('File not found');
    });
  });

  describe('Deleting Media Files', () => {
    it('should delete a media file from disk', async () => {
      // Intent: Files should be permanently removed from disk when deleted
      const reference: MediaReference = {
        id: 'audio-0001',
        filename: '0001-welcome.mp3',
        relativePath: 'media/audio/0001-welcome.mp3',
        type: 'audio',
        size: 1234,
        lastModified: Date.now()
      };

      await manager.deleteMediaFile(reference);

      expect(invoke).toHaveBeenCalledWith('remove_file', {
        path: '/test/project/media/audio/0001-welcome.mp3'
      });
    });

    it('should handle deletion failures', async () => {
      // Intent: Deletion failures should be handled gracefully
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Permission denied'));

      const reference: MediaReference = {
        id: 'audio-protected',
        filename: 'protected.mp3',
        relativePath: 'media/audio/protected.mp3',
        type: 'audio',
        size: 1234,
        lastModified: Date.now()
      };

      await expect(manager.deleteMediaFile(reference)).rejects.toThrow('Permission denied');
    });
  });

  describe('Scanning Media Directories', () => {
    it('should scan audio directory and return all audio files with metadata', async () => {
      // Intent: Directory scanning should discover all media files and extract metadata
      const mockFiles = ['0001-welcome.mp3', '0002-objectives.mp3', '0003-topic1.mp3'];
      const mockStats = { size: 1234567, modified: Date.now() };

      vi.mocked(invoke)
        .mockResolvedValueOnce(mockFiles) // read_directory
        .mockResolvedValue(mockStats); // get_file_stats (3 times)

      const references = await manager.scanMediaDirectory('audio');

      expect(references).toHaveLength(3);
      expect(references[0]).toEqual({
        id: 'audio-0001',
        filename: '0001-welcome.mp3',
        relativePath: 'media/audio/0001-welcome.mp3',
        type: 'audio',
        size: mockStats.size,
        lastModified: mockStats.modified,
        metadata: {
          blockNumber: '0001',
          topicId: 'welcome'
        }
      });
    });

    it('should handle empty directories', async () => {
      // Intent: Empty directories should return empty arrays, not errors
      vi.mocked(invoke).mockResolvedValueOnce([]);

      const references = await manager.scanMediaDirectory('images');

      expect(references).toEqual([]);
    });

    it('should handle directory read failures gracefully', async () => {
      // Intent: Directory access failures should return empty arrays with error logging
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Directory not found'));

      const references = await manager.scanMediaDirectory('video');

      expect(references).toEqual([]);
    });
  });

  describe('Media Type and ID Generation', () => {
    it('should generate correct IDs from filenames', async () => {
      // Intent: File IDs should be consistently generated from filename patterns
      const testCases = [
        { filename: '0001-welcome.mp3', expectedId: 'audio-0001' },
        { filename: '0002-safety.jpg', expectedId: 'image-0002' },
        { filename: '0003-demo.mp4', expectedId: 'video-0003' },
        { filename: '0004-transcript.vtt', expectedId: 'caption-0004' },
        { filename: 'random-file.txt', expectedId: 'file-pattern' } // Special marker for pattern matching
      ];

      for (const testCase of testCases) {
        const mockStats = { size: 1000, modified: Date.now() };
        vi.mocked(invoke)
          .mockResolvedValueOnce([testCase.filename])
          .mockResolvedValueOnce(mockStats);

        const refs = await manager.scanMediaDirectory('audio');
        
        if (testCase.expectedId === 'file-pattern') {
          expect(refs[0].id).toMatch(/^file-\d+$/);
        } else {
          expect(refs[0].id).toBe(testCase.expectedId);
        }
      }
    });

    it('should extract metadata from filenames correctly', async () => {
      // Intent: Metadata should be parsed from filename conventions
      const mockFiles = ['0001-learning-objectives.mp3'];
      const mockStats = { size: 1000, modified: Date.now() };
      
      vi.mocked(invoke)
        .mockResolvedValueOnce(mockFiles)
        .mockResolvedValueOnce(mockStats);

      const refs = await manager.scanMediaDirectory('audio');

      expect(refs[0].metadata).toEqual({
        blockNumber: '0001',
        topicId: 'learning-objectives'
      });
    });
  });

  describe('MIME Type Detection', () => {
    it('should detect correct MIME types for all supported formats', async () => {
      // Intent: All supported file types should have correct MIME types
      const testFiles = [
        { name: 'audio.mp3', expectedType: 'audio/mpeg' },
        { name: 'audio.wav', expectedType: 'audio/wav' },
        { name: 'image.jpg', expectedType: 'image/jpeg' },
        { name: 'image.jpeg', expectedType: 'image/jpeg' },
        { name: 'image.png', expectedType: 'image/png' },
        { name: 'image.gif', expectedType: 'image/gif' },
        { name: 'video.mp4', expectedType: 'video/mp4' },
        { name: 'caption.vtt', expectedType: 'text/vtt' },
        { name: 'unknown.xyz', expectedType: 'application/octet-stream' }
      ];

      for (const testFile of testFiles) {
        const base64 = btoa('test content');
        vi.mocked(invoke).mockResolvedValueOnce(base64);

        const reference: MediaReference = {
          id: 'test-001',
          filename: testFile.name,
          relativePath: `media/test/${testFile.name}`,
          type: 'audio',
          size: 100,
          lastModified: Date.now()
        };

        const blob = await manager.readMediaFile(reference);
        expect(blob.type).toBe(testFile.expectedType);
      }
    });
  });
});